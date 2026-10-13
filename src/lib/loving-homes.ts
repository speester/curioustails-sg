// "Puppies That Found Their Loving Homes" (owner decision 2026-10-14).
//
// Real puppies that left the available list, kept by `npm run sync:puppies` in
// src/data/placed-archive.json, shown BELOW the available puppies as proof that
// real Singapore families buy here and that puppies go fast. Rules that hold
// everywhere this renders:
//  - available puppies always come first; this section never sits above them;
//  - never a price and never a booking link on a placed card; the only action
//    is the section's "missed this one? ask for a similar puppy" WhatsApp;
//  - only puppies with sold evidence (status "placed") appear, newest first,
//    with the month they went when the daily snapshots pin it, and otherwise
//    the window the snapshots bound - never a guessed month.
import archive from '../data/placed-archive.json';
import liveData from '../data/available-puppies.json';
import { breedName } from '../data/breed-names';
import { whatsappLink } from '../data/site';
import { photoFor, pupPageHref, pupTitle, type BreedBucket, type Pup } from './puppy-cards';

export const LOVING_HOMES_TITLE = 'Puppies That Found Their Loving Homes';
export const LOVING_HOMES_ACCENT = 'Loving Homes';
export const LOVING_HOMES_PATH = '/found-loving-homes/';
export const LOVING_HOMES_ID = 'loving-homes';

export interface PlacedPup {
  id: number | string;
  breed: string; // breed page slug
  status: 'placed' | 'withdrawn' | 'expired' | null;
  evidence?: string;
  placedAt: string; // YYYY-MM-DD (SGT): first sync that no longer listed it
  lastListed?: string | null; // YYYY-MM-DD (SGT): last sync that did
  source?: string;
  name: string | null;
  color: string | null;
  gender: 'Male' | 'Female' | null;
  age?: string | null;
  image: string | null;
  origin?: string | null;
  sizeNote?: string | null;
  crossLabel?: string | null;
  hdbApproved?: boolean | null;
}

const archived = (archive as unknown as { pups: PlacedPup[] }).pups;
const liveBreeds = () => liveData.breeds as Record<string, BreedBucket>;

const newestFirst = (a: PlacedPup, b: PlacedPup) =>
  b.placedAt.localeCompare(a.placedAt) || Number(b.id) - Number(a.id);

/**
 * Placed puppies with a live page: sold evidence, inside the retention window
 * (the sync expires older ones), and a real photo. Newest first.
 */
export const placedPups = (breed?: string): PlacedPup[] =>
  archived
    .filter((p) => p.status === 'placed' && photoFor(p.image))
    .filter((p) => !breed || p.breed === breed)
    .sort(newestFirst);

/** Every archived id that must never render as "found a home" undated (withdrawn, expired). */
const unproven = new Set(archived.filter((p) => p.status !== 'placed').map((p) => String(p.id)));

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-SG', { ...opts, timeZone: 'UTC' });
const SHORT_MONTH = fmt({ month: 'short', year: 'numeric' });
const LONG_MONTH = fmt({ month: 'long', year: 'numeric' });

/**
 * The month a puppy found its home ("Oct 2026"), or null when the snapshots
 * cannot pin it: placedAt is the first snapshot WITHOUT the puppy, so the real
 * date sits between lastListed and placedAt. The early history was synced weeks
 * apart; a window that crosses a month boundary by more than a few days is not
 * one month, and placedWhen() prints the window instead of a guess.
 */
export function placedMonth(p: Pick<PlacedPup, 'placedAt' | 'lastListed'>, style: 'short' | 'long' = 'short') {
  if (!p.placedAt) return null;
  const sameMonth = p.lastListed?.slice(0, 7) === p.placedAt.slice(0, 7);
  const gapDays = p.lastListed ? (Date.parse(p.placedAt) - Date.parse(p.lastListed)) / 86_400_000 : Infinity;
  if (!sameMonth && !(gapDays <= 3)) return null;
  return (style === 'long' ? LONG_MONTH : SHORT_MONTH).format(new Date(p.placedAt));
}

export interface PlacedWhen {
  short: string; // "Oct 2026" | "Sept–Oct 2026"
  phrase: string; // "in October 2026" | "between September and October 2026"
  key: string; // grouping key: "2026-10" | "2026-09..2026-10"
}

/** When a puppy found its home: its month, or the honest window when the snapshots straddle two. */
export function placedWhen(p: Pick<PlacedPup, 'placedAt' | 'lastListed'>): PlacedWhen | null {
  if (!p.placedAt) return null;
  const exact = placedMonth(p, 'long');
  if (exact) return { short: placedMonth(p, 'short')!, phrase: `in ${exact}`, key: p.placedAt.slice(0, 7) };
  if (!p.lastListed) return null;
  const from = new Date(p.lastListed);
  const to = new Date(p.placedAt);
  const withYear = from.getUTCFullYear() !== to.getUTCFullYear();
  const part = (d: Date, month: 'short' | 'long', year: boolean) => fmt(year ? { month, year: 'numeric' } : { month }).format(d);
  return {
    short: `${part(from, 'short', withYear)}–${part(to, 'short', true)}`,
    phrase: `between ${part(from, 'long', withYear)} and ${part(to, 'long', true)}`,
    key: `${p.lastListed.slice(0, 7)}..${p.placedAt.slice(0, 7)}`,
  };
}

const half = (g: Pup['gender']) => (g === 'Female' ? 'girl' : g === 'Male' ? 'boy' : 'puppy');

export interface LovingHomeCard {
  id: string;
  title: string;
  breed: string; // display breed, or the cross label
  imageSrc: ImageMetadata;
  imageAlt: string;
  gender: 'Male' | 'Female' | null;
  month: string | null; // "Oct 2026", "Sept–Oct 2026", or null (undated history)
  href?: string; // the puppy's own page, when it is still live
}

function card(p: PlacedPup | Pup, breedSlug: string, when: PlacedWhen | null, href?: string): LovingHomeCard {
  const breed = p.crossLabel ?? breedName(breedSlug);
  const who = p.name ? `${p.name}, a` : 'A';
  return {
    id: String(p.id),
    title: pupTitle(p as Pup, breedName(breedSlug)),
    breed,
    imageSrc: photoFor(p.image)!,
    imageAlt: `${who} ${(p.color ?? '').toLowerCase()} ${breed} ${half(p.gender)} who found a loving home in Singapore${when ? ` ${when.phrase}` : ''}`
      .replace(/\s+/g, ' ')
      .trim(),
    gender: p.gender ?? null,
    month: when?.short ?? null,
    href,
  };
}

/**
 * Up to `limit` cards for one breed (or site-wide): the dated placed archive
 * first, then - only to fill a short row - the sheet's undated recently-placed
 * history (no month, no page link), never repeating a puppy and never showing
 * one the archive could not confirm as sold.
 */
export function lovingHomeCards({ breed, limit }: { breed?: string; limit: number }): LovingHomeCard[] {
  const out = placedPups(breed)
    .slice(0, limit)
    .map((p) => card(p, p.breed, placedWhen(p), pupPageHref(p.breed, p as unknown as Pup)));
  if (out.length >= limit) return out;

  const used = new Set(out.map((c) => c.id));
  const buckets = breed
    ? [[breed, liveBreeds()[breed]?.recentlyPlaced ?? []] as const]
    : Object.entries(liveBreeds()).map(([slug, b]) => [slug, b.recentlyPlaced] as const);
  // Round-robin across breeds so a site-wide top-up reads as range.
  for (let depth = 0; out.length < limit; depth++) {
    let any = false;
    for (const [slug, pups] of buckets) {
      const p = pups[depth];
      if (!p) continue;
      any = true;
      const id = String(p.id);
      if (used.has(id) || unproven.has(id) || !photoFor(p.image)) continue;
      used.add(id);
      out.push(card(p, slug, null));
      if (out.length >= limit) break;
    }
    if (!any) break;
  }
  return out;
}

/** Placed puppies on record, and the month the record starts, for honest headline counts. */
export function placedStats(breed?: string) {
  const pups = placedPups(breed);
  const oldest = pups.at(-1);
  return {
    count: pups.length,
    since: oldest ? LONG_MONTH.format(new Date(oldest.lastListed ?? oldest.placedAt)) : null,
  };
}

/** The "missed this one?" WhatsApp ask for the section. */
export function similarPuppyLink(breedDisplay?: string) {
  return whatsappLink(
    breedDisplay
      ? `Hi! I saw the ${breedDisplay} puppies that found their homes on your site. Do you have a similar ${breedDisplay} puppy available now or coming soon?`
      : `Hi! I saw the puppies that found their homes on your site. Could you tell me which similar puppies are available now or coming soon?`,
  );
}
