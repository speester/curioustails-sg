// Single source of truth for per-breed pricing (SGD, all-in).
// `low` is the published starting ("from") price shown on cards and in schema;
// `high` is the top of that breed's range. Update this map only — schema,
// breed cards, and aggregate copy all derive from it.
export const breedPricing = {
  'cavapoo': { low: 3288, high: 5988 },
  'maltipoo': { low: 3288, high: 5988 },
  'maltese': { low: 4288, high: 5988 },
  'mini-dachshund': { low: 4288, high: 6088 },
  'cockapoo': { low: 3288, high: 5300 },
  'bichonpoo': { low: 3288, high: 5988 },
  'bichon-frise': { low: 3888, high: 5988 },
  'cavapoochon': { low: 3688, high: 4988 },
  'chihuahua': { low: 4288, high: 4888 },
  'cavachon': { low: 3688, high: 5988 },
  'havanese': { low: 5700, high: 6500 },
  'coton-de-tulear': { low: 5888, high: 6888 },
  'shihpoo': { low: 4288, high: 4888 },
  'toy-poodle': { low: 3488, high: 5988 },
  'pomeranian': { low: 4888, high: 5388 },
  'japanese-spitz': { low: 4888, high: 5088 },
  'shih-tzu': { low: 3988, high: 5288 },
  'pug': { low: 4588, high: 5288 },
  'yorkshire-terrier': { low: 4688, high: 5388 },
  'silky-terrier': { low: 3288, high: 4588 },
  'miniature-schnauzer': { low: 4888, high: 5388 },
  'miniature-pinscher': { low: 4988, high: 5988 },
  'papillon': { low: 4088, high: 6088 },
  'pekingese': { low: 5988, high: 7000 },
  'japanese-chin': { low: 3288, high: 4488 },
  'cavalier-king-charles-spaniel': { low: 5588, high: 6588 },
  'jack-russell-terrier': { low: 3888, high: 5988 },
  'westie': { low: 4688, high: 5988 },
  'scottish-terrier': { low: 3588, high: 4588 },
  'boston-terrier': { low: 3288, high: 4488 },
  'italian-greyhound': { low: 6500, high: 7200 },
  'sheltie': { low: 4988, high: 6500 },
  'corgi': { low: 3688, high: 5500 },
  'shiba-inu': { low: 4788, high: 6500 },
  'french-bulldog': { low: 6800, high: 8800 },
  'golden-retriever': { low: 4588, high: 5500 },
  'samoyed': { low: 5500, high: 6988 },
  'chow-chow': { low: 6888, high: 10888 },
  'siberian-husky': { low: 5088, high: 6088 },
  'border-collie': { low: 5880, high: 6988 },
  'pomsky': { low: 5500, high: 6200 },
  'beagle': { low: 3588, high: 4500 },
  'cocker-spaniel': { low: 4588, high: 5988 },
  'english-bulldog': { low: 6988, high: 9988 },
  'german-shepherd': { low: 5988, high: 6500 },
  'goldendoodle': { low: 3800, high: 4988 },
  'labradoodle': { low: 3488, high: 4800 },
  'whippet': { low: 4580, high: 6280 },
} as const satisfies Record<string, { low: number; high: number }>;

export type BreedSlug = keyof typeof breedPricing;

// Site-wide band, derived from the map so it can never drift.
const lows = Object.values(breedPricing).map((p) => p.low);
const highs = Object.values(breedPricing).map((p) => p.high);
export const OVERALL_LOW = Math.min(...lows);   // 3288
export const OVERALL_HIGH = Math.max(...highs); // 10888
export const BREED_COUNT = Object.keys(breedPricing).length;

// "3,288" — comma-grouped, no currency symbol or cents.
export function fmtPrice(n: number): string {
  return n.toLocaleString('en-US');
}

// Slug from an href like "/puppies/bichon-frise" or "/puppies/bichon-frise/".
export function slugFromHref(href: string): BreedSlug | undefined {
  const slug = href.replace(/\/+$/, '').split('/').pop() ?? '';
  return slug in breedPricing ? (slug as BreedSlug) : undefined;
}

// Per-breed price by href, falling back to the site-wide low if unmatched.
export function priceForHref(href: string): { low: number; high: number } {
  const slug = slugFromHref(href);
  return slug ? breedPricing[slug] : { low: OVERALL_LOW, high: OVERALL_HIGH };
}
