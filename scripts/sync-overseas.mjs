// Sync the overseas (Australia) reservation puppies from the owner's
// SpreadSimple sheet (overseas.spread.name) into src/data/overseas-puppies.json
// and src/assets/overseas/*.webp. Re-runnable: `npm run sync:overseas`.
//
// These are RESERVATION-ONLY imports: the puppy is in Australia now; the buyer
// pays a 50% deposit to begin the import, and the 50% balance before the puppy
// flies to Singapore. Feed columns: Breed-, Age-, DateofBirth-, Gender-, Price-
// (source/AUD), ImageURL-, ListingURL-, Website- (source), MarkUpPrice- (the
// all-in SGD price to the buyer), 50%Price- (the deposit), Notes-.
// PHOTOS: the feed's ImageURL- is best-effort downloaded to src/assets/overseas/.
// Third-party source hosts (Gumtree / petsforhomes) return HTTP 403, so those
// simply fall back to a branded placeholder on the card. When the owner hosts a
// puppy's photo on a fetchable URL (e.g. spread's own CDN), it downloads and
// shows automatically on the next sync.
import { createHash } from 'node:crypto';
import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'src', 'assets', 'overseas');
const DATA = path.join(ROOT, 'src', 'data', 'overseas-puppies.json');
const SHEET = '9AEgTOyw1JJaYXhf-5QzWUNwSD3qk-Q4X49LSocqhHWPhhEvHD4RS0ukcgrYJm7mXp0z';
const OPTIONS = 'eyJyb3dzTGltaXQiOjUwMDAsImRlYWxUeXBlIjoiYXBwc3VtbyIsImR5bmFtaWNEYXRhIjp7InNoZWV0SGFzaCI6IjIwOTU3NzEyMDYiLCJTQ1BUYWJsZUxhdGVzdFVwZGF0ZVRpbWVzdGFtcCI6MTc5MDE1MTMwODQ1Mn0sInNlYXJjaCI6eyJlbmFibGVkIjp0cnVlLCJjb2x1bW5zIjpbIkJyZWVkLSIsIkFnZS0iLCJEYXRlb2ZCaXJ0aC0iLCJHZW5kZXItIiwiUHJpY2UtIiwiSW1hZ2VVUkwtIiwiTGlzdGluZ1VSTC0iLCJXZWJzaXRlLSIsIk1hcmtVcFByaWNlLSIsIjUwJVByaWNlLSIsIk5vdGVzLSJdfSwic29ydGluZyI6eyJlbmFibGVkIjpmYWxzZSwic2h1ZmZsZSI6ZmFsc2V9LCJwYWdpbmF0aW9uIjp7ImVuYWJsZWQiOnRydWUsIml0ZW1zUGVyUGFnZSI6NDB9LCJmaWx0ZXJzIjp7ImVuYWJsZWQiOnRydWUsInZhbHVlcyI6W3siaWQiOiJCcmVlZC0iLCJ0eXBlIjoibXVsdGlwbGUifSx7ImlkIjoiUHJpY2UtIiwidHlwZSI6Im11bHRpcGxlIn1dfSwibWFwVmlldyI6eyJlbmFibGVkIjpmYWxzZSwiaWQiOm51bGwsIm1hcmtlclR5cGUiOiJwaW4iLCJpbWFnZUNvbElkIjoiIn0sImNhbGVuZGFyVmlldyI6eyJlbmFibGVkIjpmYWxzZSwic3RhcnREYXRlQ29sSWQiOm51bGwsInRpdGxlQ29sSWQiOiJCcmVlZC0ifX0=';

// Overseas breed label (lowercased, parens stripped) -> breed page slug. Only
// labels that map to a real page are shown; the rest are reported as unmapped.
const MAP = {
  'cavoodle': 'cavapoo', 'cavapoo': 'cavapoo',
  'dachshund': 'mini-dachshund', 'mini dachshund': 'mini-dachshund', 'miniature dachshund': 'mini-dachshund', 'sausage dog': 'mini-dachshund',
  'miniature poodle': 'toy-poodle', 'spoodle': 'cockapoo', 'cockapoo': 'cockapoo', 'cockerpoo': 'cockapoo',
  'maltese': 'maltese', 'pomeranian': 'pomeranian', 'chihuahua': 'chihuahua',
  'havanese': 'havanese', 'french bulldog': 'french-bulldog', 'cocker spaniel': 'cocker-spaniel',
  'golden retriever': 'golden-retriever', 'german shepherd': 'german-shepherd', 'german shepherd dog': 'german-shepherd',
  'jack russell': 'jack-russell-terrier', 'border collie': 'border-collie', 'japanese spitz': 'japanese-spitz',
  'boston terrier': 'boston-terrier', 'shih tzu': 'shih-tzu', 'bichon frise': 'bichon-frise', 'pug': 'pug',
  'samoyed': 'samoyed', 'siberian husky': 'siberian-husky', 'husky': 'siberian-husky', 'beagle': 'beagle',
  'corgi': 'corgi', 'welsh corgi': 'corgi', 'shiba inu': 'shiba-inu', 'yorkshire terrier': 'yorkshire-terrier',
  'miniature schnauzer': 'miniature-schnauzer', 'schnauzer': 'miniature-schnauzer', 'papillon': 'papillon',
  'toy poodle': 'toy-poodle', 'poodle': 'toy-poodle', 'labradoodle': 'labradoodle', 'goldendoodle': 'goldendoodle',
  'coton de tulear': 'coton-de-tulear', 'italian greyhound': 'italian-greyhound', 'whippet': 'whippet',
  'pekingese': 'pekingese', 'japanese chin': 'japanese-chin',
  'cavalier king charles spaniel': 'cavalier-king-charles-spaniel', 'cavalier': 'cavalier-king-charles-spaniel',
  'westie': 'westie', 'west highland terrier': 'westie', 'scottish terrier': 'scottish-terrier',
  'silky terrier': 'silky-terrier', 'miniature pinscher': 'miniature-pinscher', 'sheltie': 'sheltie',
  'english bulldog': 'english-bulldog', 'chow chow': 'chow-chow', 'pomsky': 'pomsky', 'pomapoo': 'pomeranian',
};

const cell = (r, k) => { const c = r.cells?.[k]; return c && c.value != null ? String(c.value).trim() : ''; };
const num = (r, k) => { const c = r.cells?.[k]; return c && typeof c.value === 'number' ? c.value : (parseFloat(cell(r, k).replace(/[^0-9.]/g, '')) || null); };
const stripParens = (s) => s.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim();

function resolveBreed(label) {
  const clean = stripParens(label).toLowerCase();
  if (MAP[clean]) return { slug: MAP[clean], cross: /\bx\b|\//.test(clean) };
  // try the token(s) before an " x " cross
  const base = clean.split(/\s+x\s+|\s*\/\s*/)[0].trim();
  if (MAP[base]) return { slug: MAP[base], cross: true };
  return { slug: null, cross: false };
}

function monthsFromDob(s) {
  const m = /^Date\((\d+),(\d+),(\d+)/.exec(s);
  if (!m) return null;
  const dob = new Date(Number(m[1]), Number(m[2]), Number(m[3]));
  const days = (Date.now() - dob.getTime()) / 86400000;
  if (days < 0 || days > 900) return null;
  return days / 30.44;
}
function ageLabel(months) {
  if (months == null) return null;
  return months < 2 ? `${Math.max(1, Math.round((months * 30.44) / 7))} weeks` : `${Math.floor(months)} months`;
}
// Download+convert a source image; returns a filename or null. Source hosts
// (Gumtree / petsforhomes) 403 direct hotlinks, so fetch through the weserv.nl
// image proxy, which retrieves server-side and returns a clean WebP. Falls back
// to a direct fetch for hosts that allow it.
async function fetchImageBytes(url) {
  const noScheme = url.replace(/^https?:\/\//, '');
  const proxy = `https://images.weserv.nl/?url=${encodeURIComponent(noScheme)}&w=800&output=webp&q=80`;
  for (const u of [proxy, url]) {
    try {
      const res = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.byteLength > 1500) return buf;
    } catch { /* try next */ }
  }
  return null;
}
async function savePhoto(id, url) {
  if (!/^https?:\/\//.test(url)) return null;
  const file = `${id}.webp`;
  const dest = path.join(OUT, file);
  if (existsSync(dest)) return file;
  const buf = await fetchImageBytes(url);
  if (!buf) return null;
  try {
    await sharp(buf, { pages: 1 }).rotate().resize({ width: 800, withoutEnlargement: true }).webp({ quality: 78 }).toFile(dest);
    return file;
  } catch { return null; }
}

const rows = [];
let total = Infinity;
for (let page = 1; rows.length < total; page++) {
  const q = Buffer.from(JSON.stringify({ paginate: { currentPage: page } })).toString('base64');
  const url = `https://spread.name/sheet/${SHEET}?query=${encodeURIComponent(q)}&options=${encodeURIComponent(OPTIONS)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (curious-tails sync)' } });
  if (!res.ok) throw new Error('feed HTTP ' + res.status);
  const json = await res.json();
  const batch = json.table?.rows ?? [];
  total = json.totalRows ?? batch.length;
  if (batch.length === 0) break;
  rows.push(...batch);
  if (batch.length < 40) break;
  await new Promise((r) => setTimeout(r, 300));
}
console.log('overseas rows', rows.length, '/', total);

await mkdir(OUT, { recursive: true });
const hash = (u) => createHash('sha1').update(u).digest('hex').slice(0, 8);
const breeds = {}; // slug -> [pup]
const unmapped = new Map();
const referenced = new Set();
for (const r of rows) {
  const label = cell(r, 'Breed-');
  const price = num(r, 'MarkUpPrice-');
  if (!label) continue;
  const { slug, cross } = resolveBreed(label);
  if (!slug) { unmapped.set(label, (unmapped.get(label) ?? 0) + 1); continue; }
  const g = cell(r, 'Gender-');
  const id = `os-${hash(cell(r, 'ListingURL-') || label + price)}`;
  const months = monthsFromDob(cell(r, 'DateofBirth-'));
  const image = await savePhoto(id, cell(r, 'ImageURL-'));
  if (image) referenced.add(image);
  // Owner-supplied listing ID (added to the sheet later). Accept a few column names.
  const listingId =
    cell(r, 'ID-') || cell(r, 'ListingID-') || cell(r, 'PuppyID-') || cell(r, 'ListingId-') || null;
  (breeds[slug] ??= []).push({
    id,
    listingId: listingId || null,
    breedLabel: stripParens(label),
    crossLabel: cross ? stripParens(label) : null,
    gender: /female/i.test(g) ? 'Female' : /^male/i.test(g) ? 'Male' : /both/i.test(g) ? 'Both' : null,
    age: ageLabel(months) || (cell(r, 'Age-') || null),
    // canFly: puppies fly to Singapore once they are 3 months or older.
    canFly: months != null ? months >= 3 : null,
    price,
    deposit: num(r, '50%Price-'),
    image: image || null,
  });
}
// prune only our generated files no longer referenced
for (const f of await readdir(OUT)) if (/^os-[0-9a-f]{8}\.webp$/.test(f) && !referenced.has(f)) await unlink(path.join(OUT, f));

const out = {
  syncedAt: new Date().toISOString(),
  breeds: Object.fromEntries(Object.entries(breeds).sort(([a], [b]) => a.localeCompare(b))),
  unmapped: [...unmapped.keys()].sort(),
};
await writeFile(DATA, JSON.stringify(out, null, 2) + '\n');
const totalShown = Object.values(breeds).reduce((n, a) => n + a.length, 0);
console.log(`wrote ${totalShown} overseas pups across ${Object.keys(breeds).length} breed pages`);
if (out.unmapped.length) console.log('unmapped (no breed page):', out.unmapped.join(', '));
