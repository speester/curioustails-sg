// K-130: the puppy page adapter. Turns any of the three puppy feeds into ONE
// PuppyPageData object that src/components/puppy-page/ renders. These three
// functions (fromLocal, fromPlaced, fromImported) are the only code that reads the
// feed shapes; every component reads PuppyPageData, src/data/puppy-page-copy.ts,
// src/data/buying-terms.ts and src/data/site.ts, and nothing else.
//
// Publish rule: src/lib/puppy-publish.mjs (shared with the sitemap filter and the
// check:puppy-pages gate). A Balestier puppy missing its breed page, photo or
// price still gets a page, rendered as an honest placeholder, noindex,follow, out
// of the sitemap and with no Product/Offer schema.
import { site } from '../data/site';
import { breedName as breedDisplayName } from '../data/breed-names';
import { BY_SLUG } from '../data/registry';
import { factsFor, type BreedFacts } from '../data/breed-facts';
import { GOOGLE_REVIEWS, reviewsFor, type GoogleReview } from '../data/reviews';
import { photoFor, pupCard, type Pup } from './puppy-cards';
import { placedWhen, type PlacedPup } from './loving-homes';
import {
  arrivalLine,
  balanceText,
  depositText,
  displayName as importedDisplayName,
  importedPhotoFor,
  monthLabel,
  priceText as importedPriceText,
  sexLine,
  altFor as importedAltFor,
  type ImportedPup,
} from './imported-puppies';
import { AREA, importedGate, localGate, localPupPath, MISSING_TEXT } from './puppy-publish.mjs';
import { pupPageSlug } from './pup-slug.mjs';

export type Variant = 'av' | 'imp' | 'pl';
export type SectionId =
  | 'hero' | 'includes' | 'gifts' | 'about' | 'families' | 'fit' | 'final' | 'health'
  | 'payment' | 'next' | 'visit' | 'reviews' | 'faq' | 'others' | 'reserve';

/** Section order per variant (plan §4, K-124 order). Data-conditional sections drop at render. */
export const SECTION_ORDER: Record<Variant, SectionId[]> = {
  av: ['hero', 'includes', 'gifts', 'about', 'families', 'fit', 'final', 'health', 'payment', 'next', 'visit', 'reviews', 'faq', 'others', 'reserve'],
  // K-136: no 'families' (handovers at the Balestier shop) and no 'visit' (the shop
  // address and map): an imported puppy is delivered to the buyer's door and its
  // page must not claim a shop location.
  imp: ['hero', 'includes', 'gifts', 'about', 'fit', 'final', 'health', 'next', 'reviews', 'faq', 'others'],
  pl: ['hero', 'others', 'gifts', 'about', 'families', 'fit', 'final', 'next', 'visit', 'reviews'],
};

export interface PageImage {
  src: ImageMetadata;
  alt: string;
}

export interface Pronouns {
  subj: string; // she / he / they
  obj: string; // her / him / them
  poss: string; // her / his / their
}

export interface PuppyPageData {
  variant: Variant;
  /** true when a required field is missing: noindex,follow, no sitemap, no Offer. */
  thin: boolean;
  /** Which of breed / image / price are missing (thin reasons). */
  missing: ('breed' | 'image' | 'price')[];
  indexable: boolean;
  id: string;
  /** Shown on the ID stamp: the puppy ID, or the imported reference. */
  displayId: string;
  breed: string | null;
  breedName: string;
  /** What the page calls the puppy's breed: the cross label when set, never the pure breed. */
  breedNoun: string;
  /** /puppies/<breed>/ when that breed page exists, else null. */
  breedHref: string | null;
  name: string | null;
  /** "Biscuit" or "this puppy" (mid-sentence). */
  who: string;
  /** "Biscuit" or "This puppy" (sentence start). */
  Who: string;
  gender: 'Male' | 'Female' | null;
  /** Girl / Boy / Puppy. */
  genderWord: string;
  pron: Pronouns;
  color: string | null;
  colours: string[];
  ageLabel: string | null;
  dob: string | null;
  /** dob + 63 days, labelled "about"; `past` when that date has gone. */
  ready: { label: string; past: boolean } | null;
  images: PageImage[];
  video: string | null;
  bookHref: string | null;
  hdbApproved: boolean | null;
  price: number | null;
  priceText: string | null;
  /** 'Balestier' for local and placed puppies; null for imported (no location, K-136). */
  location: string | null;
  facts: BreedFacts | null;
  canonicalPath: string;
  /** GA4 wa_source stem: pup:<id> | sold:<id> | import:<id>. */
  waSource: string;
  placedPhrase: string | null;
  /** K-134: a demo-data sample (imported variant only). Labelled on the page, no reviews or families. */
  sample?: boolean;
  imported: ImportedPup | null;
  imp: {
    reserved: boolean;
    month: string;
    arrivalLine: string;
    priceText: string;
    depositText: string;
    balanceText: string;
    sexLine: string;
    perks: string[];
  } | null;
}

// ---------------------------------------------------------------------------
// Build-time "today", in Singapore. PUPPY_TODAY (yyyy-mm-dd) pins it for tests.
// ---------------------------------------------------------------------------
const sgtToday = (): Date => {
  const pinned = process.env.PUPPY_TODAY;
  if (pinned && /^\d{4}-\d{2}-\d{2}$/.test(pinned)) return new Date(`${pinned}T00:00:00Z`);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return new Date(`${parts}T00:00:00Z`);
};
const TODAY = sgtToday();
const DAY = 86_400_000;
const LONG_DATE = new Intl.DateTimeFormat('en-SG', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

const half = (g: Pup['gender']) => (g === 'Female' ? 'Girl' : g === 'Male' ? 'Boy' : 'Puppy');
const pronounsFor = (g: Pup['gender']): Pronouns =>
  g === 'Female' ? { subj: 'she', obj: 'her', poss: 'her' } : g === 'Male' ? { subj: 'he', obj: 'him', poss: 'his' } : { subj: 'they', obj: 'them', poss: 'their' };

export const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
/** "a" or "an" for the word that follows. */
export const article = (word: string) => (/^[aeiou]/i.test(word.trim()) ? 'an' : 'a');
export const money = (n: number) => `$${n.toLocaleString('en-SG')}`;
const titleCase = (s: string) => s.replace(/\b([a-z])/g, (m) => m.toUpperCase());

function ageFromDob(dob: string | null): string | null {
  if (!dob || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null;
  const days = Math.floor((TODAY.getTime() - Date.parse(`${dob}T00:00:00Z`)) / DAY);
  if (days < 0 || days > 730) return null;
  if (days < 56) return `About ${Math.max(1, Math.floor(days / 7))} weeks`;
  const months = Math.floor(days / 30.44);
  return `About ${months} month${months === 1 ? '' : 's'}`;
}

function readyFromDob(dob: string | null): PuppyPageData['ready'] {
  if (!dob || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null;
  const ready = new Date(Date.parse(`${dob}T00:00:00Z`) + 63 * DAY);
  return { label: LONG_DATE.format(ready), past: ready.getTime() < TODAY.getTime() };
}

const breedHrefFor = (breed: string | null) =>
  breed && (BY_SLUG[`/puppies/${breed}`] || BY_SLUG[`/puppies/${breed}/`]) ? `/puppies/${breed}/` : null;

function altText(p: { name: string | null; color: string | null; genderWord: string; breedNoun: string }, i: number, n: number, placed: boolean) {
  const who = [p.color?.toLowerCase(), p.breedNoun, p.genderWord.toLowerCase()].filter(Boolean).join(' ');
  const lead = p.name ? `${p.name}, ${article(who)} ${who}` : `${cap(article(who))} ${who}`;
  const where = placed ? 'who found a loving home through Curious Tails' : 'at Curious Tails, Balestier';
  return `${lead} ${p.genderWord === 'Puppy' ? '' : 'puppy '}${where}${n > 1 ? `, photo ${i + 1} of ${n}` : ''}`.replace(/\s+/g, ' ').trim();
}

type LocalPup = Pup & { dob?: string | null; images?: string[]; breedLabel?: string | null };

function baseLocal(pup: LocalPup, breed: string | null, variant: 'av' | 'pl', placed: PlacedPup | null): PuppyPageData {
  const breedName = breed ? breedDisplayName(breed) : (pup.breedLabel?.trim() || 'Puppy');
  const breedNoun = pup.crossLabel ?? breedName;
  const genderWord = half(pup.gender);
  const color = pup.color ? titleCase(pup.color.trim()) : null;
  const files = [...new Set([...(pup.images ?? []), ...(pup.image ? [pup.image] : [])])].slice(0, 5);
  // images[0] is image; keep the sheet order, Image- first.
  if (pup.image) files.sort((a, b) => Number(b === pup.image) - Number(a === pup.image));
  const srcs = files.map((f) => photoFor(f)).filter((x): x is ImageMetadata => Boolean(x));
  const gate = variant === 'av'
    ? localGate(pup, { breed, hasPhoto: srcs.length > 0 })
    : { inScope: true, thin: !breed || srcs.length === 0, missing: [...(!breed ? ['breed'] : []), ...(srcs.length === 0 ? ['image'] : [])] };
  if (!gate.inScope) throw new Error(`[puppy-page] ${pup.id} is out of scope: ${gate.reason}`);
  const name = pup.name?.trim() || null;
  const ctx = { name, color, genderWord, breedNoun };
  const dob = variant === 'av' ? (pup.dob ?? null) : null;
  const when = placed ? placedWhen(placed) : null;
  return {
    variant,
    thin: gate.thin,
    missing: gate.missing,
    indexable: !gate.thin,
    id: String(pup.id),
    displayId: String(pup.id),
    breed,
    breedName,
    breedNoun,
    breedHref: breedHrefFor(breed),
    name,
    who: name ?? 'this puppy',
    Who: name ?? 'This puppy',
    gender: pup.gender,
    genderWord,
    pron: pronounsFor(pup.gender),
    color,
    colours: color ? [color] : [],
    // A placed puppy's listed age is stale the day it leaves; none is shown.
    ageLabel: variant === 'av' ? (ageFromDob(dob) ?? (pup.age ? `About ${pup.age}` : null)) : null,
    dob,
    ready: variant === 'av' ? readyFromDob(dob) : null,
    images: srcs.map((src, i) => ({ src, alt: altText(ctx, i, srcs.length, variant === 'pl') })),
    video: variant === 'av' ? (pup.video ?? null) : null,
    bookHref: variant === 'av' ? (pup.bookHref ?? null) : null,
    hdbApproved: pup.hdbApproved === true ? true : null,
    price: variant === 'av' && typeof pup.price === 'number' && pup.price > 0 ? pup.price : null,
    priceText: variant === 'av' && typeof pup.price === 'number' && pup.price > 0 ? money(pup.price) : null,
    location: AREA,
    facts: factsFor(breed, pup.crossLabel),
    canonicalPath: localPupPath(breed, pup),
    waSource: variant === 'pl' ? `sold:${pup.id}` : `pup:${pup.id}`,
    placedPhrase: when?.phrase ?? null,
    imported: null,
    imp: null,
  };
}

/** An available puppy in the Balestier shop. Throws for a puppy outside Balestier. */
export const fromLocal = (pup: LocalPup, breed: string | null) => baseLocal(pup, breed, 'av', null);

/** A placed puppy inside its retention window. */
export const fromPlaced = (placed: PlacedPup) =>
  baseLocal(placed as unknown as LocalPup, placed.breed, 'pl', placed);

/** An imported reservation (always noindex,follow by owner decision D11). No location requirement (K-136). */
export function fromImported(pup: ImportedPup): PuppyPageData {
  const breedNoun = importedDisplayName(pup);
  const srcs = (pup.photos ?? [])
    .map((f, i) => ({ src: importedPhotoFor(f), alt: importedAltFor(pup, i) }))
    .filter((x): x is PageImage => Boolean(x.src));
  const gate = importedGate(pup, { hasPhoto: srcs.length > 0 });
  if (!gate.inScope) throw new Error(`[puppy-page] ${pup.id} is out of scope: ${gate.reason}`);
  const sexes = pup.sex.male > 0 && pup.sex.female === 0 ? 'Male' : pup.sex.female > 0 && pup.sex.male === 0 ? 'Female' : null;
  return {
    variant: 'imp',
    thin: gate.thin,
    missing: gate.missing as PuppyPageData['missing'],
    indexable: false,
    id: pup.id,
    displayId: pup.ref || pup.id,
    breed: pup.breed,
    breedName: pup.breedLabel,
    breedNoun,
    breedHref: breedHrefFor(pup.breed),
    name: pup.name?.trim() || null,
    who: pup.name?.trim() || 'this puppy',
    Who: pup.name?.trim() || 'This puppy',
    gender: sexes,
    genderWord: half(sexes),
    pron: pronounsFor(sexes),
    color: pup.colours?.[0] ?? null,
    colours: pup.colours ?? [],
    ageLabel: pup.age ? `${cap(pup.age)} old` : null,
    dob: pup.dob ?? null,
    ready: null,
    images: srcs,
    video: null,
    bookHref: null,
    hdbApproved: pup.hdbApproved === true ? true : null,
    price: pup.priceSGD,
    priceText: importedPriceText(pup),
    location: null,
    facts: factsFor(pup.breed, pup.crossLabel),
    canonicalPath: `/puppies/${pup.breed}/${pup.id}/`,
    waSource: `import:${pup.id}`,
    placedPhrase: null,
    sample: pup.sample === true,
    imported: pup,
    imp: {
      reserved: pup.status === 'reserved',
      month: monthLabel(pup.arrivalEstimate),
      arrivalLine: arrivalLine(pup),
      priceText: importedPriceText(pup),
      depositText: depositText(pup),
      balanceText: balanceText(pup),
      sexLine: sexLine(pup.sex, pup.origin),
      perks: pup.perks ?? [],
    },
  };
}

/** Why a local puppy is thin, in the words NEEDS-ATTENTION.md uses. */
export const thinReasons = (p: PuppyPageData) => p.missing.map((m) => MISSING_TEXT[m as keyof typeof MISSING_TEXT]);

// ---------------------------------------------------------------------------
// Reviews: a breed heading only over reviews that name the breed (plan §12, H3).
// ---------------------------------------------------------------------------
export function reviewsMentioning(term: string, n = 2): GoogleReview[] {
  const t = term.trim().toLowerCase();
  if (!t) return [];
  const rx = new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?\\b`, 'i');
  return GOOGLE_REVIEWS.filter((r) => rx.test(r.quote)).slice(0, n);
}

export function reviewsForPage(p: PuppyPageData): { breedMatched: boolean; reviews: GoogleReview[] } {
  // K-136: an imported puppy is delivered to the door, so its page never quotes a
  // review that places the purchase at the Balestier shop.
  const ok = (r: GoogleReview) => p.variant !== 'imp' || !/balestier/i.test(r.quote);
  const matched = reviewsMentioning(p.breedNoun, 8).filter(ok).slice(0, 2);
  if (matched.length >= 2) return { breedMatched: true, reviews: matched };
  if (p.variant !== 'imp') return { breedMatched: false, reviews: reviewsFor(p.breed ?? p.id, 2) };
  const pool = reviewsFor(p.breed ?? p.id, GOOGLE_REVIEWS.length).filter(ok);
  return { breedMatched: false, reviews: pool.slice(0, 2) };
}

// ---------------------------------------------------------------------------
// Other puppies: the live feed minus this one, with a photo, same breed first.
// ---------------------------------------------------------------------------
export function otherPuppies(p: PuppyPageData, rows: { breed: string | null; pup: LocalPup }[], max = 6) {
  return rows
    .filter(({ pup }) => String(pup.id) !== p.id && pup.image && photoFor(pup.image))
    .sort((a, b) => Number(b.breed === p.breed) - Number(a.breed === p.breed))
    .slice(0, max)
    .map(({ breed, pup }) => {
      const name = breed ? breedDisplayName(breed) : (pup.breedLabel ?? 'Puppy');
      const card = pupCard(pup, name, 'available', { breedLabel: true, breedSlug: breed ?? undefined });
      return { ...card, pageHref: localPupPath(breed, pup) as string, breedName: pup.crossLabel ?? name };
    });
}

export { pupPageSlug };
export const absoluteUrl = (path: string) => new URL(path, site.domain).toString();
