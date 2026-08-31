// Sync real puppy inventory from the owner's SpreadSimple site
// (availablepuppies.spread.name) into src/data/available-puppies.json and
// src/assets/live/*.webp. Re-runnable: `npm run sync:puppies`.
//
// Rules (see docs/superpowers/specs/2026-07-30-live-puppy-listings-design.md):
// - Available = top 33 feed rows (page 1 of the spread site), minus any pup
//   whose Image1 already carries the "found a loving home" sold overlay.
// - Recently placed per breed = newest historical pups with a clean photo
//   (collected for every breed, whether or not it currently has stock)
//   (Image2 preferred, else Image1 if it passes the overlay check), max 4.
// - Photos are downloaded, resized to 800px WebP, and served natively by
//   Astro; files no longer referenced get pruned.

import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSET_DIR = path.join(ROOT, 'src', 'assets', 'live');
const DATA_FILE = path.join(ROOT, 'src', 'data', 'available-puppies.json');

const SHEET = 'I1dT5XVf1N96882pe1ZISdPxULIp0uvEMWU1nEaf-qstyqVRK-IKhTNhSjTAY1GevnSG';
// Options blob captured from the live site (33 rows/page, its known-good config).
const OPTIONS =
  'eyJyb3dzTGltaXQiOjUwMDAsImRlYWxUeXBlIjoiYXBwc3VtbyIsImR5bmFtaWNEYXRhIjp7InNoZWV0SGFzaCI6IjEwNzA0MzA4NTMiLCJTQ1BUYWJsZUxhdGVzdFVwZGF0ZVRpbWVzdGFtcCI6MTc4NTM5MTI4NDg3MX0sInNlYXJjaCI6eyJlbmFibGVkIjp0cnVlLCJjb2x1bW5zIjpbIkJyZWVkLSIsIlByaWNlJC0iLCJDb2xvci0iLCJBZ2UtIiwiR2VuZGVyLSIsIkhEQkFwcHJvdmVkLSIsIlNpemUtIiwiTG9jYXRpb24tIiwiT3JpZ2luLSIsIkltYWdlLSJdfSwic29ydGluZyI6eyJlbmFibGVkIjp0cnVlLCJzaHVmZmxlIjpmYWxzZX0sInBhZ2luYXRpb24iOnsiZW5hYmxlZCI6dHJ1ZSwiaXRlbXNQZXJQYWdlIjoiMzMifSwiZmlsdGVycyI6eyJlbmFibGVkIjp0cnVlLCJ2YWx1ZXMiOlt7ImlkIjoiQnJlZWQtIiwidHlwZSI6Im11bHRpcGxlIn0seyJpZCI6IkdlbmRlci0iLCJ0eXBlIjoibXVsdGlwbGUifSx7ImlkIjoiTG9jYXRpb24tIiwidHlwZSI6Im11bHRpcGxlIn0seyJpZCI6IkhEQkFwcHJvdmVkLSIsInR5cGUiOiJtdWx0aXBsZSJ9XX0sIm1hcFZpZXciOnsiZW5hYmxlZCI6ZmFsc2UsImlkIjpudWxsLCJtYXJrZXJUeXBlIjoicGluIiwiaW1hZ2VDb2xJZCI6IiJ9LCJjYWxlbmRhclZpZXciOnsiZW5hYmxlZCI6ZmFsc2UsInN0YXJ0RGF0ZUNvbElkIjpudWxsLCJ0aXRsZUNvbElkIjoiQnJlZWQtIn19';

const AVAILABLE_ROWS = 33; // top of the sheet = page 1 of the spread site
const MAX_PLACED = 4;
const IMG_WIDTH = 800;

// Feed breed label (Chinese stripped, lowercased) -> breed page slug.
// Labels with no page here are reported as unmapped and never rendered.
const BREED_MAP = {
  'cavapoo': 'cavapoo',
  'maltipoo': 'maltipoo',
  'dachshund': 'mini-dachshund',
  'poodle': 'toy-poodle',
  'toy poodle': 'toy-poodle',
  'corgi': 'corgi',
  'welsh corgi': 'corgi',
  'golden retriever': 'golden-retriever',
  'border collie': 'border-collie',
  'goldendoodle': 'goldendoodle',
  'shih tzu': 'shih-tzu',
  'bichon frise': 'bichon-frise',
  'french bulldog': 'french-bulldog',
  'labradoodle': 'labradoodle',
  'cavalier king charles spaniel': 'cavalier-king-charles-spaniel',
  'poochon': 'bichonpoo',
  'bichonpoo': 'bichonpoo',
  'maltese': 'maltese',
  'japanese spitz': 'japanese-spitz',
  'cockapoo': 'cockapoo',
  'shiba inu': 'shiba-inu',
  'west highland terrier': 'westie',
  'west highland white terrier': 'westie',
  'westie': 'westie',
  'chihuahua': 'chihuahua',
  'yorkshire terrier': 'yorkshire-terrier',
  'cavachon': 'cavachon',
  'pug': 'pug',
  'chow chow': 'chow-chow',
  'schnauzer': 'miniature-schnauzer',
  'miniature schnauzer': 'miniature-schnauzer',
  'pomeranian': 'pomeranian',
  'jack russell terrier': 'jack-russell-terrier',
  'papillon': 'papillon',
  'cavapoochon': 'cavapoochon',
  'pomski': 'pomsky',
  'pomsky': 'pomsky',
  'american cocker spaniel': 'cocker-spaniel',
  'cocker spaniel': 'cocker-spaniel',
  'english cocker spaniel': 'cocker-spaniel',
  'whippet': 'whippet',
  'shihpoo': 'shihpoo',
  'shih poo': 'shihpoo',
  'samoyed': 'samoyed',
  'siberian husky': 'siberian-husky',
  'husky': 'siberian-husky',
  'beagle': 'beagle',
  'boston terrier': 'boston-terrier',
  'english bulldog': 'english-bulldog',
  'german shepherd': 'german-shepherd',
  'sheltie': 'sheltie',
  'shetland sheepdog': 'sheltie',
  'scottish terrier': 'scottish-terrier',
  'silky terrier': 'silky-terrier',
  'miniature pinscher': 'miniature-pinscher',
  'pekingese': 'pekingese',
  'havanese': 'havanese',
  'coton de tulear': 'coton-de-tulear',
  'italian greyhound': 'italian-greyhound',
  'japanese chin': 'japanese-chin',
};

// Crosses whose base breed is unambiguous from the label itself ("Cavapoo X" is
// a Cavapoo cross, whatever the other half is). These ride on the base breed's
// page, but `crossLabel` is carried onto the card so the listing never reads as
// the pure breed. A cross whose base breed we cannot name from the label alone
// (Maltelier) or which is a different breed entirely (Sheepadoodle is Old
// English Sheepdog x Poodle, not a Goldendoodle) must NOT be mapped here — it
// goes to the `other` bucket under its own name instead.
const CROSS_MAP = {
  'cavapoo x': { slug: 'cavapoo', crossLabel: 'Cavapoo cross' },
  'poodle x': { slug: 'toy-poodle', crossLabel: 'Poodle cross' },
};

const cell = (row, key) => {
  const c = row.cells?.[key];
  return c && c.value != null ? String(c.value).trim() : '';
};
const numCell = (row, key) => {
  const c = row.cells?.[key];
  return c && typeof c.value === 'number' ? c.value : null;
};

async function fetchAllRows() {
  const rows = [];
  let page = 1;
  for (;;) {
    const query = Buffer.from(
      JSON.stringify({ paginate: { currentPage: page }, sortBy: { id: 'INDEX', direction: 'asc' } }),
    ).toString('base64');
    const url = `https://spread.name/sheet/${SHEET}?query=${encodeURIComponent(query)}&options=${encodeURIComponent(OPTIONS)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (curious-tails sync)' } });
    if (!res.ok) throw new Error(`feed page ${page}: HTTP ${res.status}`);
    const json = await res.json();
    const batch = json.table?.rows ?? [];
    if (batch.length === 0) break;
    rows.push(...batch);
    process.stdout.write(`\rfeed: ${rows.length}/${json.totalRows} rows`);
    if (rows.length >= json.totalRows) break;
    page += 1;
    await new Promise((r) => setTimeout(r, 400));
  }
  process.stdout.write('\n');
  return rows;
}

// ---- overlay detection ------------------------------------------------------
// The "FOUND A LOVING HOME" sold overlay comes in two styles:
//  1. dark: photo multiplied dark + white text mid-frame
//     -> p95 of grayscale < 140 (clean photos measure 222-255) AND >0.5% of
//        pixels in the 42-58% vertical band near-white (>240)
//  2. bright: photo untouched, white text flanked by thin ruled lines
//     -> a 2..2%-of-height run of rows in the 35-65% band where BOTH edge
//        zones (5-25% and 75-95% width) are >65% near-white, isolated (rows
//        above/below the run are dark) — a white studio background floods the
//        surroundings and fails the isolation test.
// Calibrated 13/13 on live samples, 2026-07-30.
async function isOverlaid(buffer) {
  const { data, info } = await sharp(buffer, { pages: 1 })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const rowFrac = (y, x0, x1, thr) => {
    if (y < 0 || y >= h) return 0;
    let n = 0;
    const base = y * w;
    for (let x = x0; x < x1; x++) if (data[base + x] > thr) n++;
    return n / (x1 - x0);
  };

  // style 1: dark
  const hist = new Array(256).fill(0);
  for (let i = 0; i < data.length; i++) hist[data[i]]++;
  let acc = 0;
  let p95 = 255;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= data.length * 0.95) { p95 = v; break; }
  }
  let centerWhite = 0;
  const cy0 = Math.floor(h * 0.42), cy1 = Math.floor(h * 0.58);
  for (let y = cy0; y < cy1; y++) centerWhite += rowFrac(y, 0, w, 240);
  centerWhite /= Math.max(1, cy1 - cy0);
  if (p95 < 140 && centerWhite > 0.005) return true;

  // style 2: bright streak
  const L = [Math.floor(w * 0.05), Math.floor(w * 0.25)];
  const R = [Math.floor(w * 0.75), Math.floor(w * 0.95)];
  const edgeWhite = (y, thr) => Math.min(rowFrac(y, L[0], L[1], thr), rowFrac(y, R[0], R[1], thr));
  const y0 = Math.floor(h * 0.35), y1 = Math.floor(h * 0.65);
  const marked = [];
  for (let y = y0; y < y1; y++) marked.push(edgeWhite(y, 240) > 0.65 ? 1 : 0);
  const maxRun = Math.max(4, Math.round(h * 0.02));
  let s = -1;
  for (let i = 0; i <= marked.length; i++) {
    if (i < marked.length && marked[i]) { if (s < 0) s = i; continue; }
    if (s >= 0) {
      const len = i - s;
      const yStart = y0 + s, yEnd = y0 + i - 1;
      let above = 0, below = 0;
      for (let k = 2; k <= 8; k++) { above += edgeWhite(yStart - k, 235); below += edgeWhite(yEnd + k, 235); }
      above /= 7; below /= 7;
      if (len >= 2 && len <= maxRun && above < 0.35 && below < 0.35) return true;
      s = -1;
    }
  }
  return false;
}

// ---- photo pipeline ---------------------------------------------------------
const urlHash = (url) => createHash('sha1').update(url).digest('hex').slice(0, 8);

// Overlay verdicts are stable per URL (the shop uploads a NEW image when it
// stamps the overlay), so cache them across runs to avoid re-downloading.
const VERDICT_FILE = path.join(ROOT, 'src', 'data', '.puppy-photo-verdicts.json');
const verdicts = existsSync(VERDICT_FILE)
  ? JSON.parse(await readFile(VERDICT_FILE, 'utf8'))
  : {};
async function checkOverlaid(url) {
  const key = urlHash(url);
  if (!(key in verdicts)) verdicts[key] = await isOverlaid(await fetchImage(url));
  return verdicts[key];
}

const downloadCache = new Map(); // url -> Buffer promise
function fetchImage(url) {
  if (!downloadCache.has(url)) {
    downloadCache.set(
      url,
      fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (curious-tails sync)' } }).then(async (res) => {
        if (!res.ok) throw new Error(`image HTTP ${res.status}: ${url}`);
        return Buffer.from(await res.arrayBuffer());
      }),
    );
  }
  return downloadCache.get(url);
}

// Returns the asset filename, downloading + converting if not cached on disk.
async function savePhoto(id, imgIndex, url) {
  const file = `${id}-${imgIndex}-${urlHash(url)}.webp`;
  const dest = path.join(ASSET_DIR, file);
  if (!existsSync(dest)) {
    const buf = await fetchImage(url);
    await sharp(buf, { pages: 1 })
      .rotate() // respect EXIF orientation
      .resize({ width: IMG_WIDTH, withoutEnlargement: true })
      .webp({ quality: 78 })
      .toFile(dest);
  }
  return file;
}

// ---- row normalization ------------------------------------------------------
const stripLabel = (s) => s.replace(/\s*\(.*?\)\s*/g, '').trim();

function parseGvizDate(s) {
  const m = /^Date\((\d+),(\d+),(\d+)/.exec(s);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]), Number(m[3])); // month is 0-based
}

function ageLabel(row, { live }) {
  const ageText = cell(row, 'Age-');
  const dob = parseGvizDate(cell(row, 'DOB-')) ?? (Number.isNaN(Date.parse(ageText)) ? null : new Date(ageText));
  if (dob && live) {
    const days = (Date.now() - dob.getTime()) / 86400000;
    if (days < 0 || days > 730) return null; // implausible -> omit
    const months = Math.floor(days / 30.44);
    if (months < 2) return `${Math.max(1, Math.round(days / 7))} weeks`;
    return `${months} months`;
  }
  // Placed pups: age when listed is the honest figure; only text like
  // "2 Months" carries it (a bare date tells us nothing about sale time).
  if (/month|week/i.test(ageText)) return ageText.toLowerCase();
  if (live && ageText && !dob) return ageText.toLowerCase();
  return null;
}

function normalize(row) {
  const rawBreed = cell(row, 'Breed-');
  const label = stripLabel(rawBreed);
  const gender = /female/i.test(cell(row, 'Gender-')) ? 'Female' : /male/i.test(cell(row, 'Gender-')) ? 'Male' : null;
  const sizeNote = cell(row, 'Size-') || null;
  const key = label.toLowerCase();
  const cross = CROSS_MAP[key];
  return {
    id: numCell(row, 'ID-') ?? cell(row, 'ID-') ?? String(row.rowIndex),
    breedLabel: label,
    slug: BREED_MAP[key] ?? cross?.slug ?? null,
    crossLabel: cross?.crossLabel ?? null,
    name: cell(row, 'Name-') || null,
    color: cell(row, 'Color-') || null,
    gender,
    price: numCell(row, 'Price$-'),
    location: cell(row, 'Location-') || null,
    origin: cell(row, 'Origin-') || null,
    sizeNote,
    images: ['Image-', 'Image2-', 'Image3-', 'Image4-', 'Image5-']
      .map((k) => cell(row, k))
      .filter((u) => /^https?:\/\//.test(u)),
    row,
  };
}

// ---- main -------------------------------------------------------------------
const rows = await fetchAllRows();
await mkdir(ASSET_DIR, { recursive: true });

const pups = rows.map(normalize);
const summary = { droppedOverlaid: [], unmapped: new Map(), imageErrors: [] };

const breeds = {}; // slug -> { available: [], recentlyPlaced: [] }
const ensure = (slug) => (breeds[slug] ??= { available: [], recentlyPlaced: [] });

const toJson = (p, imageFile, { live }) => ({
  id: p.id,
  name: p.name,
  color: p.color,
  gender: p.gender,
  age: ageLabel(p.row, { live }),
  price: p.price,
  image: imageFile,
  location: p.location,
  origin: p.origin,
  sizeNote: p.sizeNote,
  crossLabel: p.crossLabel ?? null,
});

// Stock whose label matches no breed page and is not a nameable cross. It still
// exists and is still for sale, so it is listed on the site-wide available page
// under the label the shop actually uses, rather than dropped on the floor.
const other = [];

// Available: top rows, drop sold-overlaid photos.
for (const p of pups.slice(0, AVAILABLE_ROWS)) {
  let imageFile = null;
  if (p.images[0]) {
    try {
      if (await checkOverlaid(p.images[0])) {
        summary.droppedOverlaid.push(`${p.id} ${p.breedLabel}`);
        continue; // sold between sheet edits — not available after all
      }
      imageFile = await savePhoto(p.id, 1, p.images[0]);
    } catch (e) {
      summary.imageErrors.push(`${p.id}: ${e.message}`);
    }
  }
  if (p.slug) {
    ensure(p.slug).available.push(toJson(p, imageFile, { live: true }));
  } else {
    summary.unmapped.set(p.breedLabel, (summary.unmapped.get(p.breedLabel) ?? 0) + 1);
    other.push({ ...toJson(p, imageFile, { live: true }), breedLabel: p.breedLabel });
  }
}

// Recently placed: walk history (below the fold), newest first, per breed,
// until MAX_PLACED pups with a clean photo. Collected for EVERY breed, in
// stock or not — breed pages show available + recently placed side by side. Image2 preferred (Image1 is
// usually the overlay); Image1 only if it passes the overlay check.
for (const p of pups.slice(AVAILABLE_ROWS)) {
  if (!p.slug) continue;
  const bucket = ensure(p.slug);
  if (bucket.recentlyPlaced.length >= MAX_PLACED) continue;
  if (p.images.length === 0) continue;
  try {
    // Prefer any non-first photo (Image1 usually carries the sold overlay),
    // then Image1 itself — every candidate must pass the overlay check.
    let chosen = null; // [imgIndex, url]
    const order = [2, 3, 4, 5, 1];
    for (const n of order) {
      const url = p.images[n - 1];
      if (url && !(await checkOverlaid(url))) { chosen = [n, url]; break; }
    }
    if (!chosen) continue;
    const imageFile = await savePhoto(p.id, chosen[0], chosen[1]);
    bucket.recentlyPlaced.push(toJson(p, imageFile, { live: false }));
  } catch (e) {
    summary.imageErrors.push(`${p.id}: ${e.message}`);
  }
}

// Prune assets no longer referenced.
const referenced = new Set(
  [
    ...Object.values(breeds).flatMap((b) => [...b.available, ...b.recentlyPlaced]),
    ...other,
  ]
    .map((p) => p.image)
    .filter(Boolean),
);
let pruned = 0;
for (const f of await readdir(ASSET_DIR)) {
  if (f.endsWith('.webp') && !referenced.has(f)) {
    await unlink(path.join(ASSET_DIR, f));
    pruned++;
  }
}

const out = {
  syncedAt: new Date().toISOString(),
  breeds: Object.fromEntries(Object.entries(breeds).sort(([a], [b]) => a.localeCompare(b))),
  other: other.sort((a, b) => (a.breedLabel ?? '').localeCompare(b.breedLabel ?? '')),
  unmapped: [...summary.unmapped.keys()].sort(),
};
await writeFile(DATA_FILE, JSON.stringify(out, null, 2) + '\n');
await writeFile(VERDICT_FILE, JSON.stringify(verdicts) + '\n');

// ---- report -----------------------------------------------------------------
console.log('\n=== sync summary ===');
const avail = Object.entries(breeds).filter(([, b]) => b.available.length > 0);
console.log(`available: ${avail.reduce((n, [, b]) => n + b.available.length, 0)} pups across ${avail.length} breeds`);
for (const [slug, b] of avail.sort()) console.log(`  ${slug}: ${b.available.length}`);
const placedOnly = Object.entries(breeds).filter(([, b]) => b.available.length === 0 && b.recentlyPlaced.length > 0);
console.log(`recently-placed sections: ${placedOnly.length} breeds (${MAX_PLACED} pups max each)`);
if (summary.droppedOverlaid.length)
  console.log(`dropped from available (sold overlay): ${summary.droppedOverlaid.join(', ')}`);
if (out.unmapped.length) {
  // Count per label. These have no breed page, so they appear only on the
  // site-wide available page; the number is how much stock that carries.
  const labels = [...summary.unmapped.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, n]) => `${label} (${n})`)
    .join(', ');
  console.log(
    `no breed page (top ${AVAILABLE_ROWS}): ${labels} — ${other.length} pup(s) listed under "other" on /available-puppies/`,
  );
}
if (summary.imageErrors.length) console.log(`image errors:\n  ${summary.imageErrors.join('\n  ')}`);
console.log(`photos pruned: ${pruned}`);
console.log(`wrote ${path.relative(ROOT, DATA_FILE)}`);
