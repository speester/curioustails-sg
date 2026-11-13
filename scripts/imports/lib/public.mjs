// The public ImportedPup / ImportedFeed builder (spec §2.2, T13 G15, T14).
//
// Objects are built from an explicit whitelist, never by deleting private
// fields. The same whitelist is the G15 check: if a key or a human-facing value
// carries a supplier token, a URL, an email or a microchip, the item is not
// allowed into the feed.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from './schema.mjs';

export const SCHEMA_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'public-schema.json');
export const FEED_KEYS = ['syncedAt', 'schema', 'pups'];
export const PUP_KEYS = [
  'id', 'ref', 'breed', 'breedLabel', 'crossLabel', 'name', 'sex', 'colours',
  'dob', 'age', 'priceSGD', 'depositPct', 'depositSGD', 'balanceSGD', 'balanceDue',
  'arrivalEstimate', 'arrivalBasis', 'imported', 'origin', 'reservation', 'perks',
  'photos', 'photoAlt', 'status', 'publishedAt', 'updatedAt', 'sourceHash',
  'hdbApproved', 'eligibleSG', 'specified',
];
export const PERKS = ['starter-kit', 'home-delivery-setup', 'training-lesson', 'whatsapp-support', 'five-day-promise-from-arrival'];

export const BANNED_KEYS = new Set([
  'supplier', 'viaSite', 'listingId', 'sourceUrl', 'sourceurl', 'county', 'town',
  'microchip', 'microchips', 'seller', 'priceRaw', 'priceraw', 'currency',
  'descriptionRaw', 'description', 'title', 'listing', 'sourcehashraw', 'key',
  'snapshotPath', 'httpLog', 'imageSourceUrls', 'sourceStatus', 'flags', 'puppies',
]);

export const SUPPLIER_TOKENS = [
  'dogsy', 'dogquest', 'dogs.ie', 'puppies.ie', 'irishpuppies', 'dogsforsaleireland',
  'dfsi', 'supabase.co', 'images.dogs.ie', 'wp-content/uploads/20', 'animark',
];

const LABELS = {
  'jack-russell-terrier': 'Jack Russell Terrier',
  'mini-dachshund': 'Miniature Dachshund',
  'toy-poodle': 'Toy Poodle',
  'cavalier-king-charles-spaniel': 'Cavalier King Charles Spaniel',
  'bichon-frise': 'Bichon Frise',
  'westie': 'West Highland White Terrier',
  'sheltie': 'Shetland Sheepdog',
  'shih-tzu': 'Shih Tzu',
  'yorkshire-terrier': 'Yorkshire Terrier',
  'golden-retriever': 'Golden Retriever',
  'border-collie': 'Border Collie',
  'german-shepherd': 'German Shepherd',
  'miniature-schnauzer': 'Miniature Schnauzer',
  'french-bulldog': 'French Bulldog',
  'english-bulldog': 'English Bulldog',
  'cavalier': 'Cavalier King Charles Spaniel',
  'cocker-spaniel': 'Cocker Spaniel',
  'italian-greyhound': 'Italian Greyhound',
  'coton-de-tulear': 'Coton de Tulear',
  'japanese-chin': 'Japanese Chin',
  'japanese-spitz': 'Japanese Spitz',
  'chow-chow': 'Chow Chow',
  'siberian-husky': 'Siberian Husky',
  'miniature-pinscher': 'Miniature Pinscher',
  'scottish-terrier': 'Scottish Terrier',
  'silky-terrier': 'Silky Terrier',
  'boston-terrier': 'Boston Terrier',
  'shiba-inu': 'Shiba Inu',
};

const cap = (s) => String(s).replace(/\b[a-z]/g, (c) => c.toUpperCase());

export function titleFromSlug(slug) {
  if (!slug) return '';
  return LABELS[slug] ?? cap(String(slug).replace(/-/g, ' '));
}

export function normaliseColour(value) {
  const s = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (!s) return null;
  return s
    .replace(/\band\b/gi, '&')
    .replace(/\s*&\s*/g, ' & ')
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((w) => (w === '&' ? w : cap(w)))
    .join(' ');
}

export function ageLabel(record, now = new Date()) {
  if (record?.dob) {
    const dob = Date.parse(`${record.dob}T00:00:00Z`);
    if (!Number.isNaN(dob)) {
      const days = Math.max(0, Math.floor((Date.parse(now) - dob) / 86400000));
      const weeks = Math.floor(days / 7);
      if (weeks >= 1) return `${weeks} weeks`;
      return `${days} days`;
    }
  }
  const raw = String(record?.ageRaw ?? '').trim();
  if (!raw) return null;
  const m = /(\d+(?:\.\d+)?)\s*(day|week|wk|month|mth|mo)s?\b/i.exec(raw);
  if (!m) return raw;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  if (unit.startsWith('day')) return `${n} day${n === 1 ? '' : 's'}`;
  if (unit.startsWith('w')) return `${n} week${n === 1 ? '' : 's'}`;
  return `${n} month${n === 1 ? '' : 's'}`;
}

function sexLabel(sex) {
  if (sex.male > 0 && sex.female > 0) return 'male and female';
  if (sex.female > 0) return 'female';
  return 'male';
}

export function photoAltText({ colours, breedLabel, sex, age }) {
  const colour = colours?.[0] ? colours[0].toLowerCase() : 'Puppy';
  const parts = [`${colour} ${breedLabel} puppy`, sexLabel(sex)];
  if (age) parts.push(age);
  return parts.join(', ');
}

/**
 * buildPublicPup — whitelisted by construction.
 * identity: { id, ref, sourceHash }; status: 'published'|'reserved'.
 */
export function buildPublicPup({
  record, breed, price, arrival, images = [], identity, now = new Date(), status, publishedAt = null,
}) {
  if (!identity?.id || !identity?.ref || !identity?.sourceHash) throw new Error('buildPublicPup: identity is required');
  const colours = [...new Set((record?.puppies || []).map((p) => normaliseColour(p?.colour)).filter(Boolean))];
  const sex = { male: Math.max(0, Number(record?.maleCount) || 0), female: Math.max(0, Number(record?.femaleCount) || 0) };
  const age = ageLabel(record, now);
  const photos = (images || []).map((i) => i.filename).filter(Boolean);
  const alt = photoAltText({ colours, breedLabel: breed?.breedLabel, sex, age });

  return {
    id: identity.id,
    ref: identity.ref,
    breed: breed?.slug ?? '',
    breedLabel: breed?.breedLabel ?? titleFromSlug(breed?.slug),
    crossLabel: breed?.crossLabel ?? null,
    name: null,
    sex,
    colours,
    dob: record?.dob ?? arrival?.dob ?? null,
    age,
    priceSGD: price?.priceSGD ?? 0,
    depositPct: 50,
    depositSGD: price?.depositSGD ?? 0,
    balanceSGD: price?.balanceSGD ?? 0,
    balanceDue: 'before-flight',
    arrivalEstimate: arrival?.month ?? '',
    arrivalBasis: arrival?.basis ?? 'listing-date',
    imported: true,
    origin: 'IE',
    reservation: true,
    perks: [...PERKS],
    photos,
    photoAlt: photos.map(() => alt),
    status,
    publishedAt: publishedAt ?? now.toISOString(),
    updatedAt: now.toISOString(),
    sourceHash: identity.sourceHash,
    hdbApproved: breed?.hdbApproved ?? null,
    eligibleSG: true,
    specified: false,
  };
}

export function buildFeed(pups = [], syncedAt = new Date().toISOString()) {
  return { syncedAt, schema: 1, pups };
}

export function loadPublicSchema() {
  return JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
}

export function validateFeed(feed, schema = loadPublicSchema()) {
  return validate(feed, schema);
}

const URL_RE = /https?:\/\/|www\./i;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const CHIP_RE = /\b\d{15}\b/;

/**
 * findLeaks(value) → [{ path, kind, token }]
 * Scans keys and human-facing strings. Technical hex fields (id, sourceHash,
 * photos) are still shape-checked by the schema and cannot carry words.
 */
export function findLeaks(value, { extraTokens = [] } = {}) {
  const leaks = [];
  const tokens = [...SUPPLIER_TOKENS, ...extraTokens].map((t) => String(t).toLowerCase()).filter(Boolean);
  const skipValueScan = new Set(['id', 'sourceHash', 'photos']);

  const walk = (v, path, key = '') => {
    if (typeof v === 'string') {
      if (BANNED_KEYS.has(key.toLowerCase())) leaks.push({ path, kind: 'banned-key-value', token: key });
      if (!skipValueScan.has(key)) {
        const low = v.toLowerCase();
        for (const t of tokens) if (low.includes(t)) leaks.push({ path, kind: 'supplier-token', token: t });
        if (URL_RE.test(v)) leaks.push({ path, kind: 'url', token: v.slice(0, 40) });
        if (EMAIL_RE.test(v)) leaks.push({ path, kind: 'email', token: 'email' });
        if (CHIP_RE.test(v)) leaks.push({ path, kind: 'microchip', token: '15-digit' });
      }
      return;
    }
    if (Array.isArray(v)) return v.forEach((item, i) => walk(item, `${path}[${i}]`, key));
    if (v && typeof v === 'object') {
      for (const [k, val] of Object.entries(v)) {
        if (BANNED_KEYS.has(k.toLowerCase()) && !(path === '$' && k === 'key')) {
          leaks.push({ path: `${path}.${k}`, kind: 'banned-key', token: k });
        }
        walk(val, `${path}.${k}`, k);
      }
    }
  };
  walk(value, '$');
  return leaks;
}

export function isLeakSafe(value, opts = {}) {
  return findLeaks(value, opts).length === 0;
}
