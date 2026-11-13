// Image download and processing for imported listings (spec §6.4; T12).
//
// Every image is fetched directly from the origin through the polite client.
// A 403 (or any failed fetch) returns null: there is no image-proxy fallback,
// no headless browser and no retry against another host.
//
// Processing: sharp().rotate() (auto-orient, EXIF/GPS/XMP dropped by default)
// -> 1200 px WebP for the detail page and 800 px WebP for cards, q78.
// withMetadata() is never called. The output filename is derived only from the
// public id: imp-<10 hex>-<n>.webp and imp-<10 hex>-<n>-card.webp.
//
// Originals are kept in the private images-src/ for takedown evidence. The repo
// only ever receives processed WebP bytes.
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

export const IMAGE_NAME_RE = /^imp-[0-9a-f]{10}-\d+(-card)?\.webp$/;
export const PUBLIC_ID_RE = /^imp-[0-9a-f]{10}$/;
export const DETAIL_WIDTH = 1200;
export const CARD_WIDTH = 800;
export const WEBP_QUALITY = 78;
export const MAX_IMAGES_PER_PUP = 3;

export function imageFilename(id, n, card = false) {
  if (!PUBLIC_ID_RE.test(String(id))) throw new Error(`invalid public image id: ${id}`);
  if (!Number.isInteger(n) || n < 1) throw new Error(`invalid image number: ${n}`);
  return `${id}-${n}${card ? '-card' : ''}.webp`;
}

export const isImageFilename = (name) => IMAGE_NAME_RE.test(String(name));

// 64-bit difference hash: 9x8 greyscale, one bit per horizontal neighbour.
export async function dhash(input) {
  const { data } = await sharp(input)
    .rotate()
    .resize(9, 8, { fit: 'fill' })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let bits = '';
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) bits += data[y * 9 + x] > data[y * 9 + x + 1] ? '1' : '0';
  }
  return BigInt('0b' + bits).toString(16).padStart(16, '0');
}

// Returns the two processed buffers plus the dHash and dimensions. No metadata
// call and no withMetadata(): sharp writes a clean WebP.
export async function processImage(input, { quality = WEBP_QUALITY } = {}) {
  if (!input || !input.length) throw new Error('processImage: empty input');
  const detail = await sharp(input)
    .rotate()
    .resize({ width: DETAIL_WIDTH, withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();
  const card = await sharp(input)
    .rotate()
    .resize({ width: CARD_WIDTH, withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();
  const meta = await sharp(detail).metadata();
  return {
    detail,
    card,
    dhash: await dhash(input),
    width: meta.width,
    height: meta.height,
    format: meta.format,
    bytes: detail.length,
  };
}

// Metadata check used by tests and by the pipeline's G6 photo gate.
export async function imageMetadata(input) {
  return sharp(input).metadata();
}

export async function isCleanWebp(input) {
  const m = await imageMetadata(input);
  return m.format === 'webp' && !m.exif && !m.xmp && !m.iptc && !m.orientation;
}

/**
 * downloadImage(http, url, { id, n, outDir?, sourceDir?, card? })
 * → { filename, cardFilename, dhash, width, height, bytes } or null.
 * A 403 returns null with no proxy attempt anywhere in this module.
 */
export async function downloadImage(http, url, {
  id, n, outDir = null, sourceDir = null, card = true, quality = WEBP_QUALITY,
} = {}) {
  let r;
  try {
    r = await http.get(url, { kind: 'image', as: 'buffer' });
  } catch {
    return null;
  }
  if (!r?.ok || !r.body || !Buffer.isBuffer(r.body) || r.body.length === 0) return null;

  let out;
  try {
    out = await processImage(r.body, { quality });
  } catch {
    return null; // a corrupt or non-image response is dropped, never published
  }

  const filename = imageFilename(id, n, false);
  const cardFilename = card ? imageFilename(id, n, true) : null;
  if (outDir) {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, filename), out.detail);
    if (cardFilename) writeFileSync(join(outDir, cardFilename), out.card);
  }
  if (sourceDir) {
    mkdirSync(sourceDir, { recursive: true });
    // Private evidence only; the source filename never leaves the store.
    writeFileSync(join(sourceDir, `${id}-${n}.src`), r.body);
  }
  return { filename, cardFilename, dhash: out.dhash, width: out.width, height: out.height, bytes: out.bytes };
}

/**
 * Download up to max images for one pup, sequentially through the same polite
 * client. Stops when the host becomes blocked. Never throws for a failed image.
 */
export async function downloadPupImages(http, urls, {
  id, startAt = 1, max = MAX_IMAGES_PER_PUP, outDir = null, sourceDir = null,
} = {}) {
  const images = [];
  let n = startAt;
  let failed = 0;
  for (const url of (urls || []).slice(0, Math.max(0, max))) {
    const img = await downloadImage(http, url, { id, n, outDir, sourceDir });
    if (img) {
      images.push(img);
      n++;
    } else {
      failed++;
      let host = null;
      try { host = new URL(url).host; } catch {}
      if (host && http.isBlocked?.(host)) break;
    }
  }
  return { images, failed };
}

export function imagePath(dir, name) {
  return join(dir, name);
}

export function hasImage(dir, name) {
  return !!dir && !!name && existsSync(join(dir, name));
}

export function purgeImages(dir, names) {
  const removed = [];
  for (const name of names || []) {
    const p = join(dir, name);
    if (existsSync(p)) {
      try { unlinkSync(p); removed.push(name); } catch {}
    }
  }
  return removed;
}
