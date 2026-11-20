// HDB dog breed checker: the approved table, lookup aliases and verdict logic.
//
// Source: HDB's approved dog breeds table as reproduced on vetapprovedco.com
// (HDB Guidelines on Keeping Pets, checked 16 Sep 2026): 61 breeds plus crosses
// of any two breeds on the table. One dog per HDB flat. Lists change, so the
// page tells visitors to confirm on HDB's own page before committing.
//
// Pure TypeScript, no DOM: the page imports it for the server render and the
// client script alike.

export type Variant = {
  ok: string[]; // size words that make the breed listed
  no: string[]; // size words that make it not listed
  okLabel: string;
  noLabel: string;
  okQuery: string; // query that resolves to the listed size
  noQuery: string; // query that resolves to the unlisted size
};

export type Breed = {
  id: string;
  name: string; // display name
  listed: boolean; // on HDB's approved table
  aliases: string[]; // lookup names, first one is the canonical query
  slug?: string; // our breed page under /puppies/
  note?: string; // HDB condition or caveat, shown next to the breed
  variants?: Variant;
};

export type CrossDef = { name: string; slug?: string; parents: string[]; aliases: string[] };

export type Parent = { name: string; state: 'listed' | 'conditional' | 'unlisted' };

export type Option = { label: string; query: string; tone: 'ok' | 'no' };

export type Result =
  | { kind: 'empty' }
  | { kind: 'approved'; name: string; note?: string; slug?: string; parents?: Parent[] }
  | { kind: 'conditional'; name: string; note: string; slug?: string; parents?: Parent[] }
  | { kind: 'check'; name: string; note: string; slug?: string; parents?: Parent[] }
  | { kind: 'no'; name: string; note: string; slug?: string }
  | { kind: 'choose'; prompt: string; options: Option[]; more: number };

// ---------------------------------------------------------------------------
// The HDB table: 61 breeds, in HDB's order.
// ---------------------------------------------------------------------------

const POODLE: Variant = {
  ok: ['toy', 'mini', 'miniature'],
  no: ['standard'],
  okLabel: 'Toy or Miniature',
  noLabel: 'Standard',
  okQuery: 'toy poodle',
  noQuery: 'standard poodle',
};

const DACHSHUND: Variant = {
  ok: ['mini', 'miniature', 'light'],
  no: ['standard'],
  okLabel: 'Miniature or Light',
  noLabel: 'Standard',
  okQuery: 'miniature dachshund',
  noQuery: 'standard dachshund',
};

const BOSTON: Variant = {
  ok: ['lightweight', 'light', 'middleweight', 'middle'],
  no: ['heavyweight', 'heavy'],
  okLabel: 'Lightweight or Middle weight',
  noLabel: 'Heavyweight',
  okQuery: 'lightweight boston terrier',
  noQuery: 'heavyweight boston terrier',
};

const LISTED: Breed[] = [
  { id: 'affenpinscher', name: 'Affenpinscher', listed: true, aliases: ['affenpinscher', 'affen pinscher'] },
  { id: 'australian-silky-terrier', name: 'Australian Silky Terrier', listed: true, aliases: ['australian silky terrier', 'aussie silky'] },
  { id: 'australian-terrier', name: 'Australian Terrier', listed: true, aliases: ['australian terrier'] },
  { id: 'bichon-frise', name: 'Bichon Frise', listed: true, aliases: ['bichon frise', 'bichon frize'], slug: 'bichon-frise' },
  { id: 'bohemian-terrier', name: 'Bohemian Terrier', listed: true, aliases: ['bohemian terrier'] },
  { id: 'bolognese', name: 'Bolognese', listed: true, aliases: ['bolognese'] },
  { id: 'brussels-griffon', name: 'Brussels Griffon', note: 'Also known as Griffon Bruxellois', listed: true, aliases: ['brussels griffon', 'griffon bruxellois', 'griffon bruxaellois'] },
  { id: 'bichon-havanese', name: 'Bichon Havanese', note: 'The table lists Bichon Havanese; a plain Havanese is not on it', listed: true, aliases: ['bichon havanese'] },
  { id: 'border-terrier', name: 'Border Terrier', listed: true, aliases: ['border terrier'] },
  { id: 'boston-terrier', name: 'Boston Terrier', note: 'Lightweight or Middle weight only', listed: true, aliases: ['boston terrier', 'boston'], slug: 'boston-terrier', variants: BOSTON },
  { id: 'cairnterrier', name: 'Cairn Terrier', listed: true, aliases: ['cairn terrier', 'cairn'] },
  { id: 'cavalier-king-charles-spaniel', name: 'Cavalier King Charles Spaniel', listed: true, aliases: ['cavalier king charles spaniel', 'cavalier king charles', 'cavalier', 'cavvy', 'ckcs'], slug: 'cavalier-king-charles-spaniel' },
  { id: 'chihuahua', name: 'Chihuahua', listed: true, aliases: ['chihuahua'], slug: 'chihuahua' },
  { id: 'chinese-crested-dog', name: 'Chinese Crested Dog', listed: true, aliases: ['chinese crested dog', 'chinese crested'] },
  { id: 'chinese-imperial-chin', name: 'Chinese Imperial Chin', listed: true, aliases: ['chinese imperial chin', 'imperial chin'] },
  { id: 'chinese-temple-dog', name: 'Chinese Temple Dog', note: 'Classic or Miniature', listed: true, aliases: ['chinese temple dog', 'temple dog'] },
  { id: 'coton-de-tulear', name: 'Coton de Tulear', listed: true, aliases: ['coton de tulear', 'coton'], slug: 'coton-de-tulear' },
  { id: 'czech-terrier', name: 'Czech Terrier', listed: true, aliases: ['czech terrier'] },
  { id: 'dachshund', name: 'Dachshund', note: 'Light or Miniature only', listed: true, aliases: ['dachshund', 'miniature dachshund', 'mini dachshund', 'mini doxie', 'doxie', 'sausage dog'], slug: 'mini-dachshund', variants: DACHSHUND },
  { id: 'dandie-dinmont-terrier', name: 'Dandie Dinmont Terrier', listed: true, aliases: ['dandie dinmont terrier', 'dandie dinmont'] },
  { id: 'english-toy-spaniel', name: 'English Toy Spaniel', listed: true, aliases: ['english toy spaniel'] },
  { id: 'griffon-belge', name: 'Griffon Belge', listed: true, aliases: ['griffon belge', 'belgian griffon'] },
  { id: 'german-hunting-terrier', name: 'German Hunting Terrier', listed: true, aliases: ['german hunting terrier'] },
  { id: 'griffon-brabancon', name: 'Griffon Brabancon', listed: true, aliases: ['griffon brabancon', 'brabancon'] },
  { id: 'hairless-dog', name: 'Hairless Dog', listed: true, aliases: ['hairless dog', 'hairless'] },
  { id: 'italian-greyhound', name: 'Italian Greyhound', listed: true, aliases: ['italian greyhound', 'iggy'], slug: 'italian-greyhound' },
  { id: 'jack-russell-terrier', name: 'Jack Russell Terrier', listed: true, aliases: ['jack russell terrier', 'jack russell', 'jrt'], slug: 'jack-russell-terrier' },
  { id: 'japanese-spaniel', name: 'Japanese Spaniel', note: 'Also known as Chin', listed: true, aliases: ['japanese spaniel', 'japanese chin'], slug: 'japanese-chin' },
  { id: 'japanese-spitz', name: 'Japanese Spitz', listed: true, aliases: ['japanese spitz'], slug: 'japanese-spitz' },
  { id: 'lhasa-apso', name: 'Lhasa Apso', listed: true, aliases: ['lhasa apso', 'lhasa'] },
  { id: 'little-lion-dog', name: 'Little Lion Dog', listed: true, aliases: ['little lion dog', 'little lion'] },
  { id: 'lakeland-terrier', name: 'Lakeland Terrier', listed: true, aliases: ['lakeland terrier', 'lakeland'] },
  { id: 'maltese', name: 'Maltese', listed: true, aliases: ['maltese'], slug: 'maltese' },
  { id: 'manchester-terrier', name: 'Manchester Terrier', listed: true, aliases: ['manchester terrier'] },
  { id: 'miniature-pinscher', name: 'Miniature Pinscher', listed: true, aliases: ['miniature pinscher', 'mini pinscher', 'min pin', 'mini pin'], slug: 'miniature-pinscher' },
  { id: 'miniature-schnauzer', name: 'Miniature Schnauzer', listed: true, aliases: ['miniature schnauzer', 'mini schnauzer'], slug: 'miniature-schnauzer' },
  { id: 'norfolk-terrier', name: 'Norfolk Terrier', listed: true, aliases: ['norfolk terrier', 'norfolk'] },
  { id: 'norwich-terrier', name: 'Norwich Terrier', listed: true, aliases: ['norwich terrier', 'norwich'] },
  { id: 'papillon', name: 'Papillon', listed: true, aliases: ['papillon'], slug: 'papillon' },
  { id: 'pekingese', name: 'Pekingese', note: 'Listed as Pekinese', listed: true, aliases: ['pekingese', 'pekinese', 'peke'], slug: 'pekingese' },
  { id: 'pomeranian', name: 'Pomeranian', listed: true, aliases: ['pomeranian', 'pom'], slug: 'pomeranian' },
  { id: 'poodle', name: 'Poodle', note: 'Toy or Miniature only', listed: true, aliases: ['poodle', 'toy poodle', 'mini poodle', 'miniature poodle'], slug: 'toy-poodle', variants: POODLE },
  { id: 'pug', name: 'Pug', listed: true, aliases: ['pug'], slug: 'pug' },
  { id: 'schipperke', name: 'Schipperke', listed: true, aliases: ['schipperke'] },
  { id: 'scottish-terrier', name: 'Scottish Terrier', listed: true, aliases: ['scottish terrier', 'scottie'], slug: 'scottish-terrier' },
  { id: 'sealyham-terrier', name: 'Sealyham Terrier', listed: true, aliases: ['sealyham terrier', 'sealyham'] },
  { id: 'shetland-sheepdog', name: 'Shetland Sheepdog', note: 'Listed as Shetland Sheep dog', listed: true, aliases: ['shetland sheepdog', 'shetland sheep dog', 'sheltie'], slug: 'sheltie' },
  { id: 'shih-tzu', name: 'Shih Tzu', listed: true, aliases: ['shih tzu', 'shihtzu'], slug: 'shih-tzu' },
  { id: 'silky-terrier', name: 'Silky Terrier', listed: true, aliases: ['silky terrier'], slug: 'silky-terrier' },
  { id: 'small-continental-spaniel', name: 'Small Continental Spaniel', listed: true, aliases: ['small continental spaniel', 'continental spaniel'] },
  { id: 'small-english-terrier', name: 'Small English Terrier', listed: true, aliases: ['small english terrier'] },
  { id: 'small-spitz', name: 'Small Spitz', listed: true, aliases: ['small spitz'] },
  { id: 'smooth-fox-terrier', name: 'Smooth Fox Terrier', listed: true, aliases: ['smooth fox terrier'] },
  { id: 'toy-fox-terrier', name: 'Toy Fox Terrier', listed: true, aliases: ['toy fox terrier'] },
  { id: 'toy-terrier', name: 'Toy Terrier', listed: true, aliases: ['toy terrier'] },
  { id: 'tibetan-spaniel', name: 'Tibetan Spaniel', listed: true, aliases: ['tibetan spaniel'] },
  { id: 'volpino-italiano', name: 'Volpino Italiano', listed: true, aliases: ['volpino italiano', 'volpino'] },
  { id: 'west-highland-terrier', name: 'West Highland Terrier', note: 'The Westie', listed: true, aliases: ['west highland terrier', 'westie', 'west highland white terrier', 'west highland'], slug: 'westie' },
  { id: 'wire-haired-fox-terrier', name: 'Wire-Haired Fox Terrier', listed: true, aliases: ['wire haired fox terrier', 'wirehaired fox terrier'] },
  { id: 'welsh-terrier', name: 'Welsh Terrier', listed: true, aliases: ['welsh terrier'] },
  { id: 'yorkshire-terrier', name: 'Yorkshire Terrier', listed: true, aliases: ['yorkshire terrier', 'yorkie', 'yorkshire'], slug: 'yorkshire-terrier' },
];

// Breeds we know by name that are NOT on the table. Named so the checker can
// say "not on the list" rather than "not recognised".
export const NOT_LISTED: Breed[] = [
  { id: 'standard-poodle', name: 'Standard Poodle', listed: false, aliases: ['standard poodle', 'giant poodle'], note: 'Only Toy and Miniature Poodles are listed' },
  { id: 'standard-dachshund', name: 'Standard Dachshund', listed: false, aliases: ['standard dachshund', 'standard doxie', 'large dachshund'], note: 'Only Miniature and Light Dachshunds are listed' },
  { id: 'standard-schnauzer', name: 'Standard or Giant Schnauzer', listed: false, aliases: ['standard schnauzer', 'giant schnauzer'], note: 'Only the Miniature Schnauzer is listed' },
  { id: 'corgi', name: 'Corgi', listed: false, aliases: ['corgi', 'welsh corgi', 'pembroke corgi', 'cardigan corgi'], slug: 'corgi' },
  { id: 'shiba-inu', name: 'Shiba Inu', listed: false, aliases: ['shiba inu', 'shiba'], slug: 'shiba-inu' },
  { id: 'golden-retriever', name: 'Golden Retriever', listed: false, aliases: ['golden retriever', 'golden', 'goldie'], slug: 'golden-retriever' },
  { id: 'labrador', name: 'Labrador Retriever', listed: false, aliases: ['labrador retriever', 'labrador', 'lab'], slug: 'labrador' },
  { id: 'cocker-spaniel', name: 'Cocker Spaniel', listed: false, aliases: ['cocker spaniel', 'cocker'], slug: 'cocker-spaniel' },
  { id: 'beagle', name: 'Beagle', listed: false, aliases: ['beagle'], slug: 'beagle' },
  { id: 'border-collie', name: 'Border Collie', listed: false, aliases: ['border collie', 'collie'], slug: 'border-collie' },
  { id: 'french-bulldog', name: 'French Bulldog', listed: false, aliases: ['french bulldog', 'frenchie'], slug: 'french-bulldog' },
  { id: 'english-bulldog', name: 'English Bulldog', listed: false, aliases: ['english bulldog'], slug: 'english-bulldog' },
  { id: 'german-shepherd', name: 'German Shepherd', listed: false, aliases: ['german shepherd', 'alsatian'], slug: 'german-shepherd' },
  { id: 'siberian-husky', name: 'Siberian Husky', listed: false, aliases: ['siberian husky', 'husky'], slug: 'siberian-husky' },
  { id: 'samoyed', name: 'Samoyed', listed: false, aliases: ['samoyed'], slug: 'samoyed' },
  { id: 'chow-chow', name: 'Chow Chow', listed: false, aliases: ['chow chow', 'chow'], slug: 'chow-chow' },
  { id: 'whippet', name: 'Whippet', listed: false, aliases: ['whippet'], slug: 'whippet' },
  { id: 'bernese-mountain-dog', name: 'Bernese Mountain Dog', listed: false, aliases: ['bernese mountain dog', 'bernese'] },
  { id: 'rottweiler', name: 'Rottweiler', listed: false, aliases: ['rottweiler', 'rottie'] },
  { id: 'doberman', name: 'Doberman', listed: false, aliases: ['doberman', 'dobermann'] },
];

// Crosses. HDB's rule covers a cross of any two breeds on the table. The
// checker reads that strictly: both parents must be listed.
export const CROSS_DEFS: CrossDef[] = [
  { name: 'Cavapoo', slug: 'cavapoo', parents: ['cavalier-king-charles-spaniel', 'poodle'], aliases: ['cavapoo', 'cavoodle'] },
  { name: 'Maltipoo', slug: 'maltipoo', parents: ['maltese', 'poodle'], aliases: ['maltipoo'] },
  { name: 'Bichonpoo', slug: 'bichonpoo', parents: ['bichon-frise', 'poodle'], aliases: ['bichonpoo'] },
  { name: 'Cavachon', slug: 'cavachon', parents: ['cavalier-king-charles-spaniel', 'bichon-frise'], aliases: ['cavachon'] },
  { name: 'Cavapoochon', slug: 'cavapoochon', parents: ['cavalier-king-charles-spaniel', 'poodle', 'bichon-frise'], aliases: ['cavapoochon'] },
  { name: 'Cockapoo', slug: 'cockapoo', parents: ['cocker-spaniel', 'poodle'], aliases: ['cockapoo', 'cockerpoo'] },
  { name: 'Shihpoo', slug: 'shihpoo', parents: ['shih-tzu', 'poodle'], aliases: ['shihpoo'] },
  { name: 'Yorkipoo', parents: ['yorkshire-terrier', 'poodle'], aliases: ['yorkipoo'] },
  { name: 'Chipoo', parents: ['chihuahua', 'poodle'], aliases: ['chipoo'] },
  { name: 'Shichon', parents: ['shih-tzu', 'bichon-frise'], aliases: ['shichon'] },
  { name: 'Pomchi', parents: ['pomeranian', 'chihuahua'], aliases: ['pomchi'] },
  { name: 'Labradoodle', slug: 'labradoodle', parents: ['labrador', 'poodle'], aliases: ['labradoodle'] },
  { name: 'Goldendoodle', slug: 'goldendoodle', parents: ['golden-retriever', 'poodle'], aliases: ['goldendoodle'] },
  { name: 'Bernedoodle', slug: 'bernedoodle', parents: ['bernese-mountain-dog', 'poodle'], aliases: ['bernedoodle'] },
  { name: 'Pomsky', slug: 'pomsky', parents: ['siberian-husky', 'pomeranian'], aliases: ['pomsky'] },
];

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

export const BREEDS: Breed[] = [...LISTED, ...NOT_LISTED];
export { LISTED };
const BY_ID = new Map(BREEDS.map((b) => [b.id, b]));

// Filler words ignored when matching. "cross" also goes here, so "cavapoo cross"
// still finds the Cavapoo.
const STOP = new Set(['dog', 'puppy', 'puppie', 'breed', 'hdb', 'approved', 'allowed', 'the', 'a', 'an', 'of', 'for', 'is', 'can', 'i', 'my', 'in', 'flat', 'flats', 'cross', 'and', 'with']);

export const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’'`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// Plural 's' is dropped so "westies", "pugs" and "puppies" match the same keys.
const singular = (t: string) => (t.length > 3 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t);
export const tokenize = (s: string) => norm(s).split(' ').map(singular).filter((t) => t && !STOP.has(t));
const keyOf = (s: string) => tokenize(s).join(' ');

type Entry = { b: Breed; keys: Set<string>; tokens: Set<string> };
const INDEX: Entry[] = BREEDS.map((b) => {
  const keys = new Set([b.name.replace(/\s*\(.*?\)/g, ''), ...b.aliases].map(keyOf));
  const tokens = new Set<string>();
  for (const k of keys) k.split(' ').forEach((t) => t && tokens.add(t));
  if (b.variants) [...b.variants.ok, ...b.variants.no].forEach((w) => tokens.add(w));
  return { b, keys, tokens };
});

const exactEntry = (key: string) => INDEX.find((e) => e.keys.has(key));

const variantOf = (words: string[], v: Variant): 'ok' | 'no' | null =>
  v.no.some((w) => words.includes(w)) ? 'no' : v.ok.some((w) => words.includes(w)) ? 'ok' : null;

const cap = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

const optionQuery = (b: Breed) => (b.variants ? b.variants.okQuery : b.aliases[0] ?? b.name);

function breedResult(b: Breed, variant: 'ok' | 'no' | null): Result {
  if (!b.listed) {
    return { kind: 'no', name: b.name, slug: b.slug, note: `${b.note ? b.note + '. ' : ''}${b.name} is not on HDB's approved list, so it is not allowed in an HDB flat.` };
  }
  if (b.variants) {
    if (variant === 'no') return { kind: 'no', name: `${b.name} (${b.variants.noLabel})`, slug: b.slug, note: `Only the ${b.variants.okLabel} size is listed. ${b.variants.noLabel} is not.` };
    if (variant === null) {
      return {
        kind: 'choose',
        prompt: `${b.name} is listed by size. Which one is yours?`,
        options: [
          { label: `${b.variants.okLabel} ${b.name}`, query: b.variants.okQuery, tone: 'ok' },
          { label: `${b.variants.noLabel} ${b.name}`, query: b.variants.noQuery, tone: 'no' },
        ],
        more: 0,
      };
    }
  }
  if (b.variants) {
    return { kind: 'approved', name: `${b.variants.okLabel} ${b.name}`, note: `The ${b.variants.noLabel} size is not on the list.`, slug: b.slug };
  }
  return { kind: 'approved', name: b.name, note: b.note, slug: b.slug };
}

function judgeCross(name: string, slug: string | undefined, parents: { b: Breed; variant: 'ok' | 'no' | null }[]): Result {
  const label = (b: Breed, v: 'ok' | 'no' | null) => (v === 'no' && b.variants ? `${b.name} (${b.variants.noLabel})` : b.name);
  const parentInfo: Parent[] = parents.map(({ b, variant }) => ({
    name: label(b, variant),
    state: !b.listed || variant === 'no' ? 'unlisted' : b.variants && variant === null ? 'conditional' : 'listed',
  }));
  const unlisted = parents.filter((_, i) => parentInfo[i].state === 'unlisted');
  if (unlisted.length) {
    return {
      kind: 'check',
      name,
      slug,
      parents: parentInfo,
      note: `${unlisted.map((p) => label(p.b, p.variant)).join(' and ')} ${unlisted.length > 1 ? 'are' : 'is'} not on HDB's list. HDB's rule only covers crosses of two listed breeds, so this one is not covered. Check with HDB before you buy.`,
    };
  }
  if (parents.length !== 2) {
    return {
      kind: 'check',
      name,
      slug,
      parents: parentInfo,
      note: "HDB's rule is written for crosses of two breeds. A three-way cross is not clearly covered, so check with HDB first.",
    };
  }
  const open = parents.find((p, i) => parentInfo[i].state === 'conditional');
  if (open && open.b.variants) {
    return {
      kind: 'conditional',
      name,
      slug,
      parents: parentInfo,
      note: `Covered as long as the ${open.b.name} parent is ${open.b.variants.okLabel}. A Standard parent is not covered.`,
    };
  }
  return { kind: 'approved', name, slug, parents: parentInfo, note: "Both parents are on HDB's list, so the cross is covered." };
}

/** Turn whatever the visitor typed into a verdict. */
export function check(input: string): Result {
  const raw = input.toLowerCase().trim();
  const words = tokenize(raw);
  if (!words.length) return { kind: 'empty' };
  const key = words.join(' ');

  // 1. A named cross, e.g. "cavapoo". Poodle parent size unknown, so it is conditional.
  const cross = CROSS_DEFS.find((c) => c.aliases.some((a) => keyOf(a) === key));
  if (cross) {
    return judgeCross(
      cross.name,
      cross.slug,
      cross.parents.map((id) => ({ b: BY_ID.get(id)!, variant: null })),
    );
  }

  // 2. Two or more parents, e.g. "cavalier x toy poodle".
  const parts = raw
    .split(/\s*(?:\bx\b|×|\+|\/|\band\b|\bcross\b|\bwith\b)\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    const parents = parts.map((p) => {
      const e = exactEntry(keyOf(p));
      if (!e) return { b: { id: p, name: cap(p), listed: false, aliases: [] } as Breed, variant: null };
      return { b: e.b, variant: e.b.variants ? variantOf(tokenize(p), e.b.variants) : null };
    });
    return judgeCross(parents.map((p) => p.b.name).join(' × '), undefined, parents);
  }

  // 3. One breed, exact name.
  const exact = exactEntry(key);
  if (exact) return breedResult(exact.b, exact.b.variants ? variantOf(words, exact.b.variants) : null);

  // 4. Partial words: one breed with a size word, or a list of candidates to pick from.
  const cands = INDEX.filter((e) => words.every((w) => e.tokens.has(w)));
  if (cands.length === 1 && cands[0].b.variants) {
    const v = variantOf(words, cands[0].b.variants);
    if (v) return breedResult(cands[0].b, v);
  }
  if (cands.length) {
    const shown = cands.slice(0, 10);
    return {
      kind: 'choose',
      prompt: cands.length === 1 ? `Did you mean ${cands[0].b.name}?` : `A few breeds match "${input.trim()}". Which one?`,
      options: shown.map(({ b }) => ({ label: b.listed ? b.name : `${b.name} (not on the list)`, query: optionQuery(b), tone: b.listed ? 'ok' : 'no' })),
      more: cands.length - shown.length,
    };
  }

  // 5. Nothing matched.
  const mixed = words.some((w) => ['mongrel', 'mutt', 'local', 'special', 'mixed', 'mix'].includes(w));
  return {
    kind: 'no',
    name: input.trim(),
    note: mixed
      ? "Mixed-breed and local dogs are not on HDB's list. For a medium local dog, Project ADORE is the one structured route; check AVS for eligibility."
      : "We could not match that to HDB's list. Only breeds on the table, and crosses of two of them, are allowed. Try the full breed name, or type both parents for a cross.",
  };
}

/** Options for the cross builder: every breed, with a size option for each poodle-style entry. */
export function builderOptions(): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  const seen = new Set<string>();
  for (const b of LISTED) {
    if (b.variants) {
      out.push({ label: `${b.name}: ${b.variants.okLabel}`, value: b.variants.okQuery });
      out.push({ label: `${b.name}: ${b.variants.noLabel}`, value: b.variants.noQuery });
      seen.add(b.variants.okQuery).add(b.variants.noQuery);
    } else {
      out.push({ label: b.name, value: b.aliases[0] });
      seen.add(b.aliases[0]);
    }
  }
  for (const b of NOT_LISTED) {
    if (seen.has(b.aliases[0])) continue;
    out.push({ label: `${b.name} (not on the list)`, value: b.aliases[0] });
  }
  return out;
}
