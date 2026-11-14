// Leak scanner core (spec §6.7; T15). Used by check-leaks.mjs (the build gate)
// and by the pipeline before it writes the public feed.
//
// The denylist has three parts:
//   - static supplier and platform tokens (public.mjs SUPPLIER_TOKENS)
//   - private values from the private store: seller names, phones, emails and
//     registration numbers, microchips, listing ids, source and image URLs
//   - every 8-word run (shingle) of every source description
//
// A finding names the kind and the place, never the value: the value is
// private, and the scanner's output ends up in build logs.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { SUPPLIER_TOKENS, findLeaks } from './public.mjs';
import { isImageFilename } from './images.mjs';
import { BREED_MAP } from './breed-map.mjs';

export const SHINGLE_WORDS = 8;
export const DIST_EXTS = new Set(['.html', '.json', '.xml', '.txt', '.js', '.mjs', '.css', '.webmanifest']);
export const DIST_BARE = new Set(['_redirects', '_headers', 'CNAME']);

// Shorter values than these are too common to match as words on a built site
// ("Mary", a 4-digit reg no). They are still caught in the feed, where the
// generic microchip, phone, email and URL patterns apply to every string.
const MIN_LEN = { 'seller-name': 5, 'seller-regno': 4, 'seller-vet': 5, 'listing-id': 5 };
const MIN_DIGITS = { 'seller-phone': 7, microchip: 15 };

// K-129: listing ids that are the ad's public URL slug (dfsi). A slug made only of
// breed and puppy words ("labradoodles", "male-pug") identifies nobody, and on a
// puppy site it collides with the shop's own copy and image filenames. Such an id
// is not word-matched. The exception is deliberately narrow:
//   - only suppliers whose listing id is a slug (SLUG_ID_SUPPLIERS),
//   - only ids with no digit,
//   - only when EVERY hyphen token is in SLUG_VOCAB (a plural "s"/"es" allowed).
// Anything else ("antoinette-moore", "labradoodle-moore") stays denylisted. The
// source URL, seller name, regNo, phone, vet and microchip rules never use this.
export const SLUG_ID_SUPPLIERS = new Set(['dfsi']);
const GENERIC_SLUG_WORDS = ['male', 'female', 'puppy', 'puppies', 'pup', 'pups', 'dog', 'dogs', 'for', 'sale',
  'mini', 'miniature', 'toy', 'pedigree', 'purebred', 'cross', 'x'];
export const SLUG_VOCAB = new Set([
  ...GENERIC_SLUG_WORDS,
  ...Object.keys(BREED_MAP).flatMap((label) => label.toLowerCase().split(/[^a-z]+/)).filter(Boolean),
]);
const inVocab = (t) => SLUG_VOCAB.has(t) || (t.endsWith('es') && SLUG_VOCAB.has(t.slice(0, -2))) || (t.endsWith('s') && SLUG_VOCAB.has(t.slice(0, -1)));
export function isGenericSlugId(supplier, listingId) {
  if (!SLUG_ID_SUPPLIERS.has(supplier)) return false;
  const id = low(listingId).trim();
  if (!id || /\d/.test(id)) return false;
  const tokens = id.split('-');
  return tokens.every((t) => t && inVocab(t));
}

const PHONE_RE = /(?:\+|\b00)?\b353[\s-]?\(?0?\)?[\s-]?[1-9]\d?(?:[\s-]?\d){5,8}\b|\b0[1-9]\d?(?:[\s-]?\d){6,8}\b/;

const low = (s) => String(s ?? '').toLowerCase();
const digitsOf = (s) => String(s ?? '').replace(/\D/g, '');
const isWordChar = (c) => !!c && /[a-z0-9]/.test(c);

// Remove spaces, dashes, dots and brackets between digits so "087 123 4567"
// and "372 141405 123456" compare as one number.
const joinDigits = (s) => s.replace(/(?<=\d)[\s\-().]+(?=\d)/g, '');

function wordHit(hay, needle) {
  if (!needle) return false;
  let i = hay.indexOf(needle);
  while (i !== -1) {
    if (!isWordChar(hay[i - 1]) && !isWordChar(hay[i + needle.length])) return true;
    i = hay.indexOf(needle, i + 1);
  }
  return false;
}

function digitHit(hay, needle) {
  if (!needle) return false;
  let i = hay.indexOf(needle);
  while (i !== -1) {
    if (!/\d/.test(hay[i - 1] || '') && !/\d/.test(hay[i + needle.length] || '')) return true;
    i = hay.indexOf(needle, i + 1);
  }
  return false;
}

const words = (text) => low(text).match(/[a-z0-9]+/g) || [];

export function shinglesOf(text, n = SHINGLE_WORDS) {
  const w = words(text);
  const out = new Set();
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(' '));
  return out;
}

// Irish numbers appear as 087…, +353 87…, 00353 87…; deny every form.
function phoneForms(raw) {
  const d = digitsOf(raw);
  const forms = new Set([d]);
  const national = d.startsWith('00353') ? `0${d.slice(5)}` : d.startsWith('353') ? `0${d.slice(3)}` : d;
  forms.add(national);
  if (national.startsWith('0')) {
    forms.add(`353${national.slice(1)}`);
    forms.add(national.slice(1));
  }
  return [...forms].filter((f) => f.length >= MIN_DIGITS['seller-phone']);
}

const stripUrl = (u) => low(u).replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');

/**
 * buildDenylist({ records, suppressed }) → { tokens, words, digits, urls, shingles, counts }
 * records: private SourceRecords (imports-state.json). suppressed: taken-down entries.
 */
export function buildDenylist({ records = [], suppressed = [] } = {}) {
  const wordVals = new Map(); // value → kind
  const digitVals = new Map();
  const urls = new Map();
  const shingles = new Set();
  const addWord = (kind, v) => {
    const s = low(v).trim();
    if (s.length >= (MIN_LEN[kind] ?? 1)) wordVals.set(s, kind);
  };
  const addDigits = (kind, v) => {
    for (const f of kind === 'seller-phone' ? phoneForms(v) : [digitsOf(v)]) {
      if (f.length >= (MIN_DIGITS[kind] ?? 1)) digitVals.set(f, kind);
    }
  };
  const addUrl = (v) => { const u = stripUrl(v); if (u.includes('/') || u.includes('.')) urls.set(u, 'source-url'); };

  for (const r of records) {
    if (!r || typeof r !== 'object') continue;
    const s = r.seller && typeof r.seller === 'object' ? r.seller : {};
    if (s.name) addWord('seller-name', s.name);
    if (s.vet) addWord('seller-vet', s.vet);
    if (s.regNo) addWord('seller-regno', s.regNo);
    if (s.email) wordVals.set(low(s.email).trim(), 'seller-email');
    if (s.phone) addDigits('seller-phone', s.phone);
    for (const p of r.puppies || []) if (p?.microchip) addDigits('microchip', p.microchip);
    if (r.microchip) addDigits('microchip', r.microchip);
    if (r.listingId != null && !isGenericSlugId(r.supplier, r.listingId)) addWord('listing-id', r.listingId);
    if (r.sourceUrl) addUrl(r.sourceUrl);
    for (const u of r.imageSourceUrls || []) addUrl(u);
    for (const sh of shinglesOf(r.descriptionRaw)) shingles.add(sh);
  }
  for (const e of suppressed || []) {
    for (const c of e?.chips || []) addDigits('microchip', c);
    if (e?.microchip) addDigits('microchip', e.microchip);
  }
  return {
    tokens: SUPPLIER_TOKENS.map(low),
    words: wordVals,
    digits: digitVals,
    urls,
    shingles,
    counts: { values: wordVals.size + digitVals.size + urls.size, shingles: shingles.size },
  };
}

/**
 * scanText(text, deny, { label, generic }) → [{ kind, where }]
 * generic: also apply the shape patterns (any 15-digit number, any Irish
 * phone, any email or URL). Used for the feed, where no such value belongs.
 */
export function scanText(text, deny, { label = '', generic = false } = {}) {
  const hits = [];
  const seen = new Set();
  const hit = (kind) => { if (!seen.has(kind)) { seen.add(kind); hits.push({ kind, where: label }); } };
  const hay = low(text);
  const digitHay = joinDigits(hay);

  for (const t of deny.tokens) if (wordHit(hay, t)) hit('supplier-token');
  for (const [v, kind] of deny.words) if (wordHit(hay, v)) hit(kind);
  for (const [v, kind] of deny.digits) if (digitHit(digitHay, v)) hit(kind);
  for (const [v, kind] of deny.urls) if (hay.includes(v)) hit(kind);
  if (deny.shingles.size) {
    const w = words(hay.replace(/<[^>]+>/g, ' '));
    for (let i = 0; i + SHINGLE_WORDS <= w.length; i++) {
      if (deny.shingles.has(w.slice(i, i + SHINGLE_WORDS).join(' '))) { hit('description-copy'); break; }
    }
  }
  if (generic) {
    if (/(?<!\d)\d{15}(?!\d)/.test(digitHay)) hit('microchip');
    if (PHONE_RE.test(hay)) hit('phone');
    if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/.test(hay)) hit('email');
    if (/https?:\/\/|www\./.test(hay)) hit('url');
  }
  return hits;
}

// ---- WebP metadata --------------------------------------------------------------

// Walk the RIFF chunk list. Any EXIF or XMP chunk is metadata that must not ship.
export function webpMetadataChunks(buf) {
  if (buf.length < 12 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return ['not-webp'];
  const found = [];
  let off = 12;
  while (off + 8 <= buf.length) {
    const fourcc = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (fourcc === 'EXIF' || fourcc === 'XMP ') found.push(fourcc.trim());
    off += 8 + size + (size % 2);
  }
  return found;
}

// ---- file walkers ---------------------------------------------------------------

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

const rel = (root, p) => relative(root, p).replace(/\\/g, '/');

export function scanFeedFile(file, deny, root) {
  const where = rel(root, file);
  if (!existsSync(file)) return { leaks: [], files: 0 };
  const text = readFileSync(file, 'utf8');
  const leaks = scanText(text, deny, { label: where, generic: true });
  let feed = null;
  try { feed = JSON.parse(text); } catch { leaks.push({ kind: 'feed-not-json', where }); }
  // Banned keys (supplier, listingId, county …) are a leak even with a clean value.
  if (feed) for (const l of findLeaks(feed)) if (l.kind.startsWith('banned-key')) leaks.push({ kind: l.kind, where: `${where} ${l.path}` });
  return { leaks, files: 1 };
}

export function scanAssetDir(dir, deny, root) {
  if (!existsSync(dir)) return { leaks: [], files: 0 };
  const leaks = [];
  let files = 0;
  for (const p of walk(dir)) {
    files++;
    const name = p.slice(dir.length + 1).replace(/\\/g, '/');
    const where = rel(root, p);
    if (!isImageFilename(name)) leaks.push({ kind: 'asset-name', where });
    for (const h of scanText(name, deny, { label: where })) leaks.push(h);
    if (name.endsWith('.webp')) {
      for (const chunk of webpMetadataChunks(readFileSync(p))) leaks.push({ kind: 'webp-metadata', where: `${where} ${chunk}` });
    }
  }
  return { leaks, files };
}

export function scanDistDir(dir, deny, root) {
  if (!existsSync(dir)) return { leaks: [{ kind: 'dist-missing', where: rel(root, dir) }], files: 0 };
  const leaks = [];
  let files = 0;
  for (const p of walk(dir)) {
    const where = rel(root, p);
    // Every path is checked for names; text files are also checked for content.
    for (const h of scanText(rel(dir, p), deny, { label: where })) leaks.push(h);
    const base = p.split(/[\\/]/).pop();
    if (!DIST_EXTS.has(extname(p).toLowerCase()) && !DIST_BARE.has(base)) continue;
    files++;
    for (const h of scanText(readFileSync(p, 'utf8'), deny, { label: where })) leaks.push(h);
  }
  return { leaks, files };
}

/**
 * runLeakCheck({ repoRoot, feedPath?, assetDir?, distDir?, store }) → { leaks, scanned, counts }
 */
export function runLeakCheck({ repoRoot, feedPath, assetDir, distDir = null, store }) {
  const state = store.readJson('imports-state.json', {}) || {};
  const deny = buildDenylist({ records: Object.values(state.records || {}), suppressed: state.suppressed || [] });
  const feed = scanFeedFile(feedPath || join(repoRoot, 'src', 'data', 'imported-puppies.json'), deny, repoRoot);
  const assets = scanAssetDir(assetDir || join(repoRoot, 'src', 'assets', 'imported'), deny, repoRoot);
  const dist = distDir ? scanDistDir(distDir, deny, repoRoot) : { leaks: [], files: 0 };
  return {
    leaks: [...feed.leaks, ...assets.leaks, ...dist.leaks],
    scanned: { feed: feed.files, assets: assets.files, dist: dist.files },
    counts: deny.counts,
  };
}
