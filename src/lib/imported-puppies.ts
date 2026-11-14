// The public imported-puppy feed, read the way the site is allowed to read it:
// src/data/imported-puppies.json (Ireland, written by scripts/imports/sync-imports.mjs
// from the private store after the gates and the owner's decision) and, since
// K-136, src/data/au-reservations.json (the Australian reservations, same record
// shape, written by scripts/imports/au-reservations.mjs only for owner-approved
// queue items). Nothing here
// touches the private store, and nothing here invents a fact: every value below
// comes from the feed, and every sentence comes from the copy deck
// (reports/imported-puppy-copy-deck-2026-11-08.md).
import { fmtPrice } from '../data/pricing';
import feed from '../data/imported-puppies.json';
import auFeed from '../data/au-reservations.json';

export interface ImportedPup {
  id: string;
  ref: string;
  breed: string;
  breedLabel: string;
  crossLabel: string | null;
  name: string | null;
  sex: { male: number; female: number };
  colours: string[];
  dob: string | null;
  age: string | null;
  priceSGD: number;
  depositPct: 50;
  depositSGD: number;
  balanceSGD: number;
  balanceDue: 'before-flight';
  arrivalEstimate: string; // YYYY-MM
  arrivalBasis: 'dob' | 'age' | 'listing-date';
  imported: true;
  /** IE: the Irish feed. AU: an Australian reservation migrated onto the same instrument (K-136). */
  origin: 'IE' | 'AU';
  reservation: true;
  perks: string[];
  photos: string[];
  photoAlt: string[];
  status: 'published' | 'reserved';
  publishedAt: string;
  updatedAt: string;
  sourceHash: string;
  hdbApproved: boolean | null;
  eligibleSG: true;
  specified: false;
  /** K-134: a demo-data sample, never a real puppy. Only ever set by the sample feed below. */
  sample?: true;
}

const photos = import.meta.glob<ImageMetadata>('../assets/imported/*.webp', {
  eager: true,
  import: 'default',
});
// AU photos live in their own folder: the Irish pipeline prunes any imp-*.webp in
// src/assets/imported that is not in ITS feed (syncPublicAssets).
const auPhotos = import.meta.glob<ImageMetadata>('../assets/imported-au/*.webp', {
  eager: true,
  import: 'default',
});

/** Local bundle for an imp-*.webp feed filename; undefined when the file is absent. */
export const importedPhotoFor = (file: string | null | undefined) =>
  file
    ? (photos[`../assets/imported/${file}`] ??
      auPhotos[`../assets/imported-au/${file}`] ??
      (SAMPLES_ON ? samplePhotos[`../assets/imported-samples/${file}`] : undefined))
    : undefined;

// K-134 sample listings: demo data for an owner review on a preview branch only.
// Two locks, both needed: the build must run with IMPORT_SAMPLES=1 AND the file
// src/data/imported-puppies.sample.json must exist. The file is written only by
// scripts/imports/make-sample-feed.mjs into a stage copy, never into this repo, so
// a production build cannot render a sample. Every sample carries sample: true and
// renders with SAMPLE_LABEL on the card and the detail page.
const sampleFiles = import.meta.glob<{ pups?: ImportedPup[] }>('../data/imported-puppies.sample.json', {
  eager: true,
  import: 'default',
});
const samplePhotos = import.meta.glob<ImageMetadata>('../assets/imported-samples/*.webp', {
  eager: true,
  import: 'default',
});
export const SAMPLES_ON = process.env.IMPORT_SAMPLES === '1';
const samplePups: ImportedPup[] = SAMPLES_ON
  ? (Object.values(sampleFiles)[0]?.pups ?? []).map((p) => ({ ...p, sample: true as const }))
  : [];

export const SAMPLE_LABEL = 'Sample listing — demo data, not a real puppy';
export const SAMPLE_NOTE =
  'Built from pipeline test fixtures to preview the layout. This puppy does not exist and cannot be reserved; the photos are from our breed library.';

const isShown = (p: ImportedPup) => p && (p.status === 'published' || p.status === 'reserved');

/** Every imported pup the site may show: published or reserved, never anything else. */
export function importedPups(): ImportedPup[] {
  return [
    ...((feed.pups ?? []) as ImportedPup[]).filter(isShown),
    ...auPups(),
    ...samplePups.filter(isShown),
  ];
}

/**
 * K-136: the Australian reservations on the imports instrument. Only owner-approved
 * records are in this feed. `cutover` is set by `au-reservations.mjs sync --cutover`
 * once the owner has approved the preview; until then the legacy OverseasPuppies
 * section keeps rendering the old AU cards and this feed is not shown, so a build
 * of this tree cannot drop the live AU listings before the owner has decided.
 */
export const AU_CUTOVER = (auFeed as { cutover?: boolean }).cutover === true;
export function auPups(): ImportedPup[] {
  if (!AU_CUTOVER) return [];
  return ((auFeed.pups ?? []) as ImportedPup[]).filter((p) => p.origin === 'AU').filter(isShown);
}

/** Breed pages never show samples: the preview is scoped to /available-puppies/ and the detail pages. */
export function importedForBreed(breed: string): ImportedPup[] {
  return importedPups().filter((p) => p.breed === breed && !p.sample);
}

/** "2026-12" -> "December 2026" (month precision only, as the spec requires). */
export function monthLabel(month: string | null | undefined): string {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return '';
  const d = new Date(`${month}-01T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-SG', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

export const arrivalLine = (p: ImportedPup) =>
  `Estimated arrival ${monthLabel(p.arrivalEstimate)} · subject to import approval`;

/** The exact "2 boys / 1 girl" title suffix from copy deck §1. Zero counts are omitted. */
export function sexLine(sex: ImportedPup['sex'], origin: ImportedPup['origin'] = 'IE'): string {
  // An AU record only knows which sexes are listed (Male / Female / Both), never a
  // count, so it is never given one.
  if (origin === 'AU') return sex.male > 0 && sex.female > 0 ? 'boy & girl' : sex.female > 0 ? 'girl' : sex.male > 0 ? 'boy' : '';
  const parts: string[] = [];
  if (sex.male > 0) parts.push(`${sex.male} ${sex.male === 1 ? 'boy' : 'boys'}`);
  if (sex.female > 0) parts.push(`${sex.female} ${sex.female === 1 ? 'girl' : 'girls'}`);
  return parts.join(' / ');
}

export function ageWeeks(age: string | null | undefined): number | null {
  const m = /(\d+)\s*week/i.exec(age ?? '');
  return m ? Number(m[1]) : null;
}

/** Copy deck: the second badge appears only when the puppy is 12 weeks or older. */
export const oldEnoughToFly = (p: ImportedPup) => (ageWeeks(p.age) ?? 0) >= 12;

export const cardTitle = (p: ImportedPup) =>
  `${p.crossLabel ?? p.breedLabel} · ${sexLine(p.sex, p.origin)}`.replace(/\s+·\s*$/, '');

export const displayName = (p: ImportedPup) => p.crossLabel ?? p.breedLabel;

export const detailPath = (p: ImportedPup) => `/puppies/${p.breed}/${p.id}/`;

export const priceText = (p: ImportedPup) => `S$${fmtPrice(p.priceSGD)}`;
export const depositText = (p: ImportedPup) => `S$${fmtPrice(p.depositSGD)}`;
export const balanceText = (p: ImportedPup) => `S$${fmtPrice(p.balanceSGD)}`;

/** true / false / null (cross or unknown) — null renders no HDB claim at all. */
export const hdbLine = (p: ImportedPup): string | null =>
  p.hdbApproved === true ? 'HDB-approved breed' : p.hdbApproved === false ? 'Private housing only' : null;

const interest = (sex: ImportedPup['sex']) =>
  sex.male > 0 && sex.female > 0 ? 'boy or girl' : sex.female > 0 ? 'girl' : 'boy';

/** Copy deck §5, card/detail prefilled message. No supplier, county or chip. */
export function reserveMessage(p: ImportedPup): string {
  if (p.sample) return sampleMessage(p);
  return `Hi Curious Tails! I'd like to reserve the ${p.breedLabel} puppy, ref ${p.ref} (${priceText(p)}, arriving around ${monthLabel(p.arrivalEstimate)}). I'm interested in a ${interest(p.sex)}. Is it still available?`;
}

/** K-134: a sample's prefill says it is a sample and carries the puppy id, so a tap never reads as a real enquiry. */
export function sampleMessage(p: ImportedPup): string {
  return `[SAMPLE LISTING PREVIEW - demo data, not a real puppy] Puppy id ${p.id}, ref ${p.ref}: ${p.breedLabel} (${priceText(p)}, arriving around ${monthLabel(p.arrivalEstimate)}).`;
}

/** Copy deck §5, reserved state. */
export function reservedMessage(p: ImportedPup): string {
  if (p.sample) return sampleMessage(p);
  return `Hi! I saw the ${p.breedLabel} puppy (ref ${p.ref}) is reserved. Could you let me know when the next one is available?`;
}

export const altFor = (p: ImportedPup, i = 0): string =>
  p.photoAlt?.[i] ??
  `${p.colours?.[0]?.toLowerCase() ?? 'Puppy'} ${p.breedLabel} puppy, ${sexLine(p.sex, p.origin)}${p.age ? `, ${p.age} old` : ''}`;

/** Copy deck §1, one fixed line for every imported card. */
export const PERKS_LINE = 'Starter kit, free delivery & setup, free training lesson';

/** "2026-12" -> "2026-12-01" for schema availabilityStarts (first day of the month). */
export const availabilityStarts = (p: ImportedPup) =>
  /^\d{4}-\d{2}$/.test(p.arrivalEstimate) ? `${p.arrivalEstimate}-01` : undefined;
