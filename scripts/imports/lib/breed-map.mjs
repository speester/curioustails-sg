// One breed label → breed page slug map for the imports pipeline (spec §6.1, T4).
//
// Combines BREED_MAP (scripts/sync-puppies.mjs) and MAP (scripts/sync-overseas.mjs)
// — copied, those files are not edited — plus Irish ad wording and misspellings.
// The SG-feed CROSS_MAP is deliberately NOT copied: its 'poodle x' → Cockapoo rule
// is specific to the Chinese labels in the local feed and would be wrong here.
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PAGES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'src', 'pages', 'puppies');

// From sync-puppies.mjs BREED_MAP (2026-11-13)
const FROM_SYNC_PUPPIES = {
  'cavapoo': 'cavapoo', 'maltipoo': 'maltipoo', 'dachshund': 'mini-dachshund', 'poodle': 'toy-poodle',
  'toy poodle': 'toy-poodle', 'corgi': 'corgi', 'welsh corgi': 'corgi', 'golden retriever': 'golden-retriever',
  'border collie': 'border-collie', 'goldendoodle': 'goldendoodle', 'shih tzu': 'shih-tzu', 'bichon frise': 'bichon-frise',
  'french bulldog': 'french-bulldog', 'labradoodle': 'labradoodle', 'cavalier king charles spaniel': 'cavalier-king-charles-spaniel',
  'poochon': 'bichonpoo', 'bichonpoo': 'bichonpoo', 'maltese': 'maltese', 'japanese spitz': 'japanese-spitz',
  'cockapoo': 'cockapoo', 'shiba inu': 'shiba-inu', 'west highland terrier': 'westie', 'west highland white terrier': 'westie',
  'westie': 'westie', 'chihuahua': 'chihuahua', 'yorkshire terrier': 'yorkshire-terrier', 'cavachon': 'cavachon', 'pug': 'pug',
  'chow chow': 'chow-chow', 'schnauzer': 'miniature-schnauzer', 'miniature schnauzer': 'miniature-schnauzer',
  'pomeranian': 'pomeranian', 'jack russell terrier': 'jack-russell-terrier', 'papillon': 'papillon', 'cavapoochon': 'cavapoochon',
  'pomski': 'pomsky', 'pomsky': 'pomsky', 'american cocker spaniel': 'cocker-spaniel', 'cocker spaniel': 'cocker-spaniel',
  'english cocker spaniel': 'cocker-spaniel', 'whippet': 'whippet', 'shihpoo': 'shihpoo', 'shih poo': 'shihpoo',
  'samoyed': 'samoyed', 'siberian husky': 'siberian-husky', 'husky': 'siberian-husky', 'beagle': 'beagle',
  'boston terrier': 'boston-terrier', 'english bulldog': 'english-bulldog', 'german shepherd': 'german-shepherd',
  'sheltie': 'sheltie', 'shetland sheepdog': 'sheltie', 'scottish terrier': 'scottish-terrier', 'silky terrier': 'silky-terrier',
  'miniature pinscher': 'miniature-pinscher', 'pekingese': 'pekingese', 'havanese': 'havanese', 'coton de tulear': 'coton-de-tulear',
  'italian greyhound': 'italian-greyhound', 'japanese chin': 'japanese-chin',
};

// From sync-overseas.mjs MAP (2026-11-13)
const FROM_SYNC_OVERSEAS = {
  'cavoodle': 'cavapoo', 'cavapoo': 'cavapoo', 'dachshund': 'mini-dachshund', 'mini dachshund': 'mini-dachshund',
  'miniature dachshund': 'mini-dachshund', 'sausage dog': 'mini-dachshund', 'miniature poodle': 'toy-poodle', 'spoodle': 'cockapoo',
  'cockapoo': 'cockapoo', 'cockerpoo': 'cockapoo', 'maltese': 'maltese', 'pomeranian': 'pomeranian', 'chihuahua': 'chihuahua',
  'havanese': 'havanese', 'french bulldog': 'french-bulldog', 'cocker spaniel': 'cocker-spaniel', 'golden retriever': 'golden-retriever',
  'german shepherd': 'german-shepherd', 'german shepherd dog': 'german-shepherd', 'jack russell': 'jack-russell-terrier',
  'border collie': 'border-collie', 'japanese spitz': 'japanese-spitz', 'boston terrier': 'boston-terrier', 'shih tzu': 'shih-tzu',
  'bichon frise': 'bichon-frise', 'pug': 'pug', 'samoyed': 'samoyed', 'siberian husky': 'siberian-husky', 'husky': 'siberian-husky',
  'beagle': 'beagle', 'corgi': 'corgi', 'welsh corgi': 'corgi', 'shiba inu': 'shiba-inu', 'yorkshire terrier': 'yorkshire-terrier',
  'miniature schnauzer': 'miniature-schnauzer', 'schnauzer': 'miniature-schnauzer', 'papillon': 'papillon', 'toy poodle': 'toy-poodle',
  'poodle': 'toy-poodle', 'labradoodle': 'labradoodle', 'goldendoodle': 'goldendoodle', 'coton de tulear': 'coton-de-tulear',
  'italian greyhound': 'italian-greyhound', 'whippet': 'whippet', 'pekingese': 'pekingese', 'japanese chin': 'japanese-chin',
  'cavalier king charles spaniel': 'cavalier-king-charles-spaniel', 'cavalier': 'cavalier-king-charles-spaniel', 'westie': 'westie',
  'west highland terrier': 'westie', 'scottish terrier': 'scottish-terrier', 'silky terrier': 'silky-terrier',
  'miniature pinscher': 'miniature-pinscher', 'sheltie': 'sheltie', 'english bulldog': 'english-bulldog', 'chow chow': 'chow-chow',
  'pomsky': 'pomsky', 'pomapoo': 'pomeranian',
};

// Irish ad wording and common misspellings (K-072 T4).
const IRISH_ALIASES = {
  'jack russel': 'jack-russell-terrier', 'jack russell': 'jack-russell-terrier', 'jack russel terrier': 'jack-russell-terrier',
  'jrt': 'jack-russell-terrier', 'miniture jack russell': 'jack-russell-terrier', 'miniture jack russel': 'jack-russell-terrier',
  'miniature jack russell': 'jack-russell-terrier', 'mini jack russell': 'jack-russell-terrier', 'jack russell terrier': 'jack-russell-terrier',
  'dachund': 'mini-dachshund', 'dashaund': 'mini-dachshund', 'daschund': 'mini-dachshund', 'dachshund': 'mini-dachshund',
  'miniature dachshund': 'mini-dachshund', 'mini dachshund': 'mini-dachshund', 'sausage dog': 'mini-dachshund',
  'west highland white terrier': 'westie', 'westie': 'westie', 'shetland sheepdog': 'sheltie', 'sheltie': 'sheltie',
  'border collie': 'border-collie', 'chihuahua': 'chihuahua', 'samoyed': 'samoyed', 'poochon': 'bichonpoo',
  'cavapoo': 'cavapoo', 'cavoodle': 'cavapoo', 'cockapoo': 'cockapoo', 'cockerpoo': 'cockapoo',
  'yorkie': 'yorkshire-terrier', 'labrador': 'labrador', 'labrador retriever': 'labrador', 'lab': 'labrador',
  'shih tzu': 'shih-tzu', 'shitzu': 'shih-tzu', 'shih tzhu': 'shih-tzu', 'pomeranian': 'pomeranian',
  'cavalier king charles': 'cavalier-king-charles-spaniel', 'bichon': 'bichon-frise', 'bichon frise': 'bichon-frise',
  'pembroke welsh corgi': 'corgi', 'cardigan welsh corgi': 'corgi', 'beagle': 'beagle', 'miniature schnauzer': 'miniature-schnauzer',
  'cocker spaniel': 'cocker-spaniel', 'springer spaniel': null, 'maltipoo': 'maltipoo', 'cavachon': 'cavachon',
  'french bulldog': 'french-bulldog', 'frenchie': 'french-bulldog', 'pug': 'pug', 'german shepherd': 'german-shepherd',
};

// Labels that are crosses even though they map to a parent breed page.
const CROSS_LABELS = { 'pomapoo': 'Pomeranian x Poodle' };

export const BREED_MAP = Object.fromEntries(
  Object.entries({ ...FROM_SYNC_PUPPIES, ...FROM_SYNC_OVERSEAS, ...IRISH_ALIASES }).filter(([, v]) => v),
);

export const pageExists = (slug) => !!slug && existsSync(join(PAGES_DIR, `${slug}.astro`));

export const normBreed = (s) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[-_.]/g, ' ')
    .replace(/\b(puppies|puppy|pups|pup|dogs|dog for sale|for sale)\b/g, ' ')
    .replace(/[^a-z0-9,/&x ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const titleCase = (s) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());

// Split "A, B" / "A x B" / "A/B" / "A & B" / "A cross B" into parts.
export function splitParts(label) {
  return normBreed(label)
    .split(/\s*,\s*|\s+x\s+|\s*\/\s*|\s+&\s+|\s+cross(?:ed)?(?: with)?\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function slugFor(part) {
  const slug = BREED_MAP[part];
  return pageExists(slug) ? slug : null;
}

/**
 * resolveBreed(label, breed1?, breed2?) → { slug, crossLabel }
 * slug is null when no parent has a page (the item is then 'unmapped-breed').
 */
export function resolveBreed(label, breed1, breed2) {
  const parts = breed1 || breed2 ? [breed1, breed2].filter(Boolean).map(normBreed) : splitParts(label);
  if (!parts.length) return { slug: null, crossLabel: null };

  if (parts.length === 1) {
    // "Shih Tzu x" / "Cavapoo cross": a cross with an unnamed second parent.
    const m = /^(.*?)\s+(?:x|cross)$/.exec(parts[0]);
    if (m) return { slug: slugFor(m[1]), crossLabel: `${titleCase(m[1])} cross` };
    const p = parts[0];
    return { slug: slugFor(p), crossLabel: CROSS_LABELS[p] ?? null };
  }
  const crossLabel = parts.map(titleCase).join(' x ');
  for (const p of parts) {
    const slug = slugFor(p);
    if (slug) return { slug, crossLabel };
  }
  return { slug: null, crossLabel };
}
