// K-130 D4: breed facts, built from the published breed pages and read by both
// the breed page itself and every puppy page of that breed. One source, so the
// puppy page can never state a breed fact the breed page does not.
//
// Rules for this file:
//  - Every string is copied verbatim from src/pages/puppies/<slug>.astro (the
//    `source` page). scripts/check-breed-facts.mjs fails the build when a string
//    is no longer on its source page, or a guide anchor is missing from dist/.
//  - A field the source page does not state stays undefined (owner decision D4).
//    The puppy page then hides that tile, card or section; it never fills a gap.
//  - Facts describe the BREED, never one puppy. A cross shown under a base breed
//    (crossLabel, e.g. "Maltese x Shih Tzu" in the maltese bucket) has no entry
//    of its own, so its puppy pages carry no breed facts at all.
//  - `match` rows are the breed page's "Is a <breed> right for your lifestyle?"
//    table. `fit` rows feed the puppy page's "A great fit if" column, `think` rows
//    its "Think twice if" column.

export interface MatchRow {
  situation: string;
  take: string;
  verdict: 'fit' | 'think';
}

export interface BreedFacts {
  /** The published breed page every string below is copied from. */
  source: string;
  /** "Maltese x Toy or Miniature Poodle" (crosses only; at-a-glance list). */
  parentage?: string;
  /** One verbatim span about the breed, from the page's temperament or definition block. */
  temperament?: string;
  /** Grown size, from the page's at-a-glance list. */
  size?: string;
  /** Size-table rows, rendered by the breed page from here. */
  coat?: string;
  exercise?: string;
  lifespan?: string;
  match?: MatchRow[];
  /** Section ids on the breed page that the puppy page links into. */
  guideAnchors?: { temperament?: string; size?: string; hdb?: string; grooming?: string };
}

export const BREED_FACTS: Record<string, BreedFacts> = {
  maltipoo: {
    source: '/puppies/maltipoo/',
    parentage: 'Maltese x Toy or Miniature Poodle',
    temperament: 'Maltipoos are affectionate, playful, and deeply people-oriented.',
    size: 'Roughly 3 to 6 kg fully grown',
    coat: 'Soft and low-shedding, wavy to curly; common colours include white, cream and apricot',
    exercise: 'About 30 minutes a day, plus indoor play and company',
    lifespan: '12 to 15 years',
    match: [
      { situation: 'Someone home most of the day (family, retiree, helper, remote work)', take: 'Ideal. This is the Maltipoo home; the company is exactly what they want', verdict: 'fit' },
      { situation: 'Family with children wanting an affectionate lap dog', take: 'Great fit. Gentle, playful, and endlessly cuddly', verdict: 'fit' },
      { situation: 'Adding a companion for an existing dog', take: 'Good fit. Sociable and rarely the one to start trouble', verdict: 'fit' },
      { situation: 'Nobody home 8am to 6pm on weekdays', take: 'Reconsider. A Maltipoo may fret; an independent Cavapoo is usually the kinder match', verdict: 'think' },
    ],
    guideAnchors: { temperament: 'temperament', size: 'size', hdb: 'hdb', grooming: 'grooming' },
  },
  'bichon-frise': {
    source: '/puppies/bichon-frise/',
    temperament:
      'The Bichon Frise is the breed people describe as "always happy," and for once the reputation is accurate.',
    size: 'Roughly 3 to 5 kg fully grown',
    coat: 'White, curly, low-shedding double coat; the loose hair stays in the coat until brushed out',
    exercise: 'About 30 minutes a day, plus indoor play and company',
    lifespan: '14 to 15 years, one of the longer-lived breeds we carry',
    match: [
      { situation: 'Someone home most of the day (family, retiree, helper, remote work)', take: 'Ideal. This is the Bichon home; the company is exactly what they want', verdict: 'fit' },
      { situation: 'Family with gentle children', take: 'Great fit. Sturdy for a small breed, patient, and playful without rough edges', verdict: 'fit' },
      { situation: 'Allergy-sensitive household', take: 'One of the best picks we carry, though no dog is allergen-free', verdict: 'fit' },
      { situation: 'Grooming feels like a chore, not a ritual', take: 'Reconsider. This coat needs real upkeep; a smooth-coated Mini Dachshund is the low-maintenance route', verdict: 'think' },
      { situation: 'Nobody home 8am to 6pm on weekdays', take: 'Reconsider. A Bichon may fret; an independent Cavapoo is usually the kinder match', verdict: 'think' },
    ],
    guideAnchors: { temperament: 'temperament', size: 'size', hdb: 'hdb', grooming: 'grooming' },
  },
  cavachon: {
    source: '/puppies/cavachon/',
    parentage: 'Cavalier × Bichon Frise cross',
    temperament:
      'A Cavachon is a cross between a Cavalier King Charles Spaniel and a Bichon Frise: roughly 5 to 9 kg of soft, wavy, low-shedding coat around one of the gentlest temperaments in the small-dog world.',
    size: 'Roughly 5 to 9 kg fully grown',
    coat: 'Soft, wavy, low-shedding; apricot, cream, white, sable, and Blenheim-style chestnut markings',
    exercise: 'About 30 to 40 minutes a day, plus indoor play; a flat is genuinely enough',
    lifespan: '12 to 15 years with good care',
    match: [
      { situation: 'Family with children, someone home part of the day', take: 'Ideal. The gentlest cross we carry, in its natural habitat', verdict: 'fit' },
      { situation: 'First-time owner wanting a soft, forgiving dog', take: 'Great fit. Eager, gentle, and kind to beginner mistakes', verdict: 'fit' },
      { situation: 'Allergy-sensitive household', take: 'Good fit. Low-shedding coat; visit first if allergies are severe', verdict: 'fit' },
      { situation: 'Out 8am to 6pm on weekdays', take: 'Reconsider honestly. This cross needs company; the Cavapoo handles that routine far better', verdict: 'think' },
      { situation: 'You want a watchdog', take: 'Wrong breed entirely. A Cavachon greets burglars; consider the Mini Schnauzer', verdict: 'think' },
    ],
    guideAnchors: { temperament: 'temperament', size: 'size', hdb: 'hdb', grooming: 'grooming' },
  },
  cavapoo: {
    source: '/puppies/cavapoo/',
    parentage: 'Cavalier King Charles Spaniel x Toy Poodle',
    temperament:
      'Cavapoo puppies in Singapore homes are affectionate, loyal, intelligent, and playful; that part every seller will tell you.',
    size: 'Toy 3 to 5 kg, mini 5 to 10 kg fully grown',
    coat: 'Wavy to curly, low-shedding; common colours include Blenheim, apricot, and cream',
    exercise: '30 to 60 minutes daily, split around the heat',
    lifespan: '12 to 15 years',
    match: [
      { situation: 'Working couple, out 8am to 6pm, nobody home in the day', take: 'Good fit. Cavapoos are independent enough for this, with a proper playpen routine from day one', verdict: 'fit' },
      { situation: 'Family with young children', take: 'Good fit. Gentle, playful, and patient; supervise early handling as with any puppy', verdict: 'fit' },
      { situation: 'Someone home most of the day and wants a constant-company dog', take: 'A Cavapoo works, but a Maltipoo or Bichonpoo may reward all that company even more', verdict: 'think' },
      { situation: 'HDB flat', take: 'Good fit. The Cavapoo is an HDB-approved small breed; just mind the one-dog-per-flat rule', verdict: 'fit' },
    ],
    guideAnchors: { temperament: 'temperament', size: 'size', hdb: 'hdb' },
  },
  cockapoo: {
    source: '/puppies/cockapoo/',
    parentage: 'Cocker Spaniel x Poodle',
    temperament:
      "The Cockapoo blends the Cocker Spaniel's warmth with the Poodle's brains, and the result is the most forgiving family dog we carry: sociable with everyone, patient with children, quick to learn, and happiest in the middle of household life.",
    size: '5 to 10 kg; the Poodle parent sets the size',
    coat: 'Wavy to loosely curled, low-shedding; apricot, red, cream, chocolate',
    exercise: '40 to 60 minutes daily, split around the heat',
    lifespan: '13 to 15 years',
    match: [
      { situation: 'Family with primary-school children', take: 'The strongest fit we place. A Cockapoo meets children at their energy and stays patient through the noisy end of the day', verdict: 'fit' },
      { situation: 'Working couple, out 8am to 6pm, nobody home in the day', take: 'Workable, not automatic. A Cockapoo tolerates the day alone only with the playpen routine and a real walk at both ends of it', verdict: 'think' },
      { situation: 'Quiet household that wants a calm lap dog', take: 'Look at the Cavapoo instead. A Cockapoo has a Spaniel engine and will ask for a game you did not plan', verdict: 'think' },
      { situation: 'First puppy, no dog experience', take: 'Good fit. Eager to please and forgiving of beginner mistakes, which is why we hand it to first-timers often', verdict: 'fit' },
      { situation: 'HDB flat', take: 'Good fit. The Cockapoo is HDB-approved; mind the one-dog-per-flat rule and book grooming every 6 to 8 weeks', verdict: 'fit' },
    ],
    guideAnchors: { temperament: 'temperament', size: 'size', hdb: 'hdb' },
  },
  maltese: {
    source: '/puppies/maltese/',
    temperament:
      'The Maltese has done exactly one job for over two thousand years: keep its people company.',
    size: 'Roughly 3 to 4 kg fully grown',
    coat: 'Silky, single-layer and straight; always white, sometimes with pale ivory or cream shading on the ears',
    exercise: 'About 30 minutes a day, plus indoor play and company',
    lifespan: '12 to 15 years',
    match: [
      { situation: 'Someone home most of the day (family, retiree, helper, remote work)', take: 'Ideal. This is the Maltese home; the company is exactly what they want', verdict: 'fit' },
      { situation: 'Adults or older children wanting a devoted lap dog', take: 'Great fit. Affectionate, portable, and endlessly loyal', verdict: 'fit' },
      { situation: 'Allergy-sensitive household', take: 'One of the better picks; very low-shedding single coat, though no dog is allergen-free', verdict: 'fit' },
      { situation: 'Home with boisterous toddlers', take: 'Reconsider. At 3 to 4 kg a Maltese is delicate; a sturdier Cockapoo is usually the kinder match', verdict: 'think' },
      { situation: 'Nobody home 8am to 6pm on weekdays', take: 'Reconsider. A Maltese may fret; an independent Cavapoo is usually the kinder match', verdict: 'think' },
    ],
    guideAnchors: { temperament: 'temperament', size: 'size', hdb: 'hdb', grooming: 'grooming' },
  },
  'toy-poodle': {
    source: '/puppies/toy-poodle/',
    temperament:
      "A Toy Poodle learns your household's routine in days: where the treats live, which sound is the lift door, what you do before a walk.",
    size: 'Roughly 3 to 4.5 kg fully grown',
    coat: 'Dense, curly, very low-shedding; colours include red, apricot, cream, white, black, brown and silver',
    exercise: 'About 30 to 45 minutes a day, plus daily mental work; a flat is genuinely enough space',
    lifespan: '14 to 17 years; Poodles are among the longest-lived breeds',
    match: [
      { situation: 'First-time owner who wants a trainable dog', take: 'Ideal. The fastest learner in the shop, and forgiving of beginner mistakes', verdict: 'fit' },
      { situation: 'Allergy-sensitive household', take: 'Ideal. The lowest-shedding coat we carry; the benchmark other breeds get measured against', verdict: 'fit' },
      { situation: 'Working household with a settled routine', take: 'Workable. Mental stimulation before and after work is the real requirement, not company every hour', verdict: 'think' },
      { situation: 'Family with calm, dog-respectful children', take: 'Great fit. Playful and gentle; just supervise around very young kids at this size', verdict: 'fit' },
      { situation: 'You want a wash-and-wear, no-grooming coat', take: 'Reconsider. The curly coat needs brushing every other day and a groom every 4 to 6 weeks; the smooth-coat Chihuahua or Mini Dachshund is the lower-maintenance pick', verdict: 'think' },
    ],
    guideAnchors: { temperament: 'temperament', size: 'size', hdb: 'hdb', grooming: 'grooming' },
  },
};

/** Facts for a puppy: a cross shown under a base breed never inherits the base breed's facts. */
export const factsFor = (breed: string | null | undefined, crossLabel?: string | null): BreedFacts | null =>
  !breed || crossLabel ? null : (BREED_FACTS[breed] ?? null);

/** The breed page's lifestyle table, in the shape ComparisonSplit takes. */
export const matchRows = (breed: string) =>
  (BREED_FACTS[breed]?.match ?? []).map((r) => ({ label: r.situation, values: [r.take] }));
