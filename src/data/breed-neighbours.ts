// Nearest-breed map for the out-of-stock case (Workstream A2.4).
//
// A breed page with no stock used to end in a "contact us for availability"
// card and converted 0%. The fix is to put real, available puppies of the
// closest breeds in front of the visitor, alongside a waitlist ask: someone who
// came for a Toy Poodle will look at a Maltipoo or a Cockapoo, but only if the
// page shows them one.
//
// Neighbours are grouped by what a buyer actually substitutes on: adult size,
// coat and shedding, and temperament — not by kennel-club group. Order matters;
// the first stocked neighbour is shown first. Anything without an entry falls
// back to the general pool in `nearestBreeds()`.

const NEIGHBOURS: Record<string, string[]> = {
  // Small low-shedding poodle crosses and their pure-breed cousins
  'toy-poodle': ['maltipoo', 'cockapoo', 'bichonpoo', 'cavapoo', 'bichon-frise'],
  maltipoo: ['toy-poodle', 'maltese', 'bichonpoo', 'cavapoo', 'cockapoo'],
  cockapoo: ['cavapoo', 'maltipoo', 'goldendoodle', 'bichonpoo', 'toy-poodle'],
  cavapoo: ['cavapoochon', 'cockapoo', 'maltipoo', 'cavachon', 'bichonpoo'],
  cavapoochon: ['cavapoo', 'cavachon', 'bichonpoo', 'bichon-frise', 'cockapoo'],
  bichonpoo: ['bichon-frise', 'maltipoo', 'cavapoo', 'cockapoo', 'toy-poodle'],
  cavachon: ['cavapoochon', 'cavapoo', 'bichon-frise', 'cavalier-king-charles-spaniel'],
  shihpoo: ['shih-tzu', 'maltipoo', 'bichonpoo', 'toy-poodle'],
  goldendoodle: ['labradoodle', 'cockapoo', 'golden-retriever', 'cavapoo'],
  labradoodle: ['goldendoodle', 'cockapoo', 'golden-retriever'],

  // Small white and cream companions
  'bichon-frise': ['bichonpoo', 'maltese', 'cavapoochon', 'coton-de-tulear', 'maltipoo'],
  maltese: ['maltipoo', 'bichon-frise', 'shih-tzu', 'havanese', 'coton-de-tulear'],
  'coton-de-tulear': ['bichon-frise', 'maltese', 'havanese', 'bichonpoo'],
  havanese: ['maltese', 'coton-de-tulear', 'shih-tzu', 'bichon-frise'],
  'shih-tzu': ['shihpoo', 'maltese', 'pekingese', 'havanese'],
  pekingese: ['shih-tzu', 'japanese-chin', 'pug'],
  'japanese-chin': ['pekingese', 'papillon', 'shih-tzu'],
  papillon: ['chihuahua', 'japanese-chin', 'yorkshire-terrier'],

  // Toy companions
  chihuahua: ['miniature-pinscher', 'papillon', 'yorkshire-terrier', 'pomeranian'],
  pomeranian: ['japanese-spitz', 'chihuahua', 'yorkshire-terrier'],
  'yorkshire-terrier': ['silky-terrier', 'maltese', 'chihuahua', 'maltipoo'],
  'silky-terrier': ['yorkshire-terrier', 'chihuahua', 'maltese'],
  'miniature-pinscher': ['chihuahua', 'mini-dachshund', 'papillon'],

  // Small hounds and terriers
  'mini-dachshund': ['beagle', 'miniature-pinscher', 'jack-russell-terrier', 'chihuahua'],
  beagle: ['mini-dachshund', 'jack-russell-terrier', 'cocker-spaniel'],
  'jack-russell-terrier': ['mini-dachshund', 'beagle', 'westie', 'scottish-terrier'],
  westie: ['scottish-terrier', 'jack-russell-terrier', 'miniature-schnauzer'],
  'scottish-terrier': ['westie', 'miniature-schnauzer', 'jack-russell-terrier'],
  'miniature-schnauzer': ['westie', 'scottish-terrier', 'bichonpoo', 'cockapoo'],

  // Spitz
  'japanese-spitz': ['pomeranian', 'samoyed', 'shiba-inu'],
  samoyed: ['japanese-spitz', 'siberian-husky', 'chow-chow'],
  'shiba-inu': ['japanese-spitz', 'corgi', 'pomsky'],
  pomsky: ['siberian-husky', 'shiba-inu', 'pomeranian'],
  'siberian-husky': ['pomsky', 'samoyed', 'german-shepherd'],
  'chow-chow': ['samoyed', 'siberian-husky'],

  // Flat-faced
  pug: ['french-bulldog', 'boston-terrier', 'english-bulldog', 'pekingese'],
  'french-bulldog': ['boston-terrier', 'pug', 'english-bulldog'],
  'boston-terrier': ['french-bulldog', 'pug'],
  'english-bulldog': ['french-bulldog', 'pug'],

  // Spaniels and mid-size family dogs
  'cavalier-king-charles-spaniel': ['cavapoo', 'cavachon', 'cocker-spaniel', 'cavapoochon'],
  'cocker-spaniel': ['cockapoo', 'cavalier-king-charles-spaniel', 'beagle'],
  'golden-retriever': ['goldendoodle', 'labradoodle', 'border-collie'],
  corgi: ['sheltie', 'shiba-inu', 'mini-dachshund'],
  sheltie: ['corgi', 'border-collie', 'papillon'],
  'border-collie': ['sheltie', 'golden-retriever', 'german-shepherd'],
  'german-shepherd': ['border-collie', 'golden-retriever', 'siberian-husky'],
  whippet: ['italian-greyhound', 'border-collie'],
  'italian-greyhound': ['whippet', 'chihuahua', 'miniature-pinscher'],
};

/**
 * Substitute breed slugs for `slug`, closest first. `stocked` is the set of
 * slugs that actually have puppies today; anything not in it is dropped, and
 * the list is topped up from the rest of the stocked pool so the section is
 * never empty while there is inventory anywhere.
 */
export function nearestBreeds(slug: string, stocked: string[], count = 3): string[] {
  const pool = stocked.filter((s) => s !== slug);
  const ranked = (NEIGHBOURS[slug] ?? []).filter((s) => pool.includes(s));
  const rest = pool.filter((s) => !ranked.includes(s));
  return [...ranked, ...rest].slice(0, count);
}
