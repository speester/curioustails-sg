// Shared card-building for real inventory (src/data/available-puppies.json,
// written by `npm run sync:puppies`). Used by the per-breed AvailablePuppies
// section and by the site-wide /available-puppies/ page.
import { whatsappLink } from '../data/site';

export interface Pup {
  id: number | string;
  name: string | null;
  color: string | null;
  gender: 'Male' | 'Female' | null;
  age: string | null;
  price: number | null;
  image: string | null;
  location: string | null;
  origin: string | null;
  sizeNote: string | null;
  // Set when the feed listed this pup as a cross ("Cavapoo X") and it is shown
  // on the base breed's page. It must reach the card, so the listing never
  // presents a cross as the pure breed.
  crossLabel?: string | null;
  // true when the shop's sheet ticks HDBApproved for this pup — the breed
  // transfers into an HDB flat with no separate HDB approval needed. null =
  // not stated; never render a claim from a blank.
  hdbApproved?: boolean | null;
}

export interface BreedBucket {
  available: Pup[];
  recentlyPlaced: Pup[];
}

const photos = import.meta.glob<ImageMetadata>('../assets/live/*.webp', {
  eager: true,
  import: 'default',
});
export const photoFor = (file: string | null) =>
  file ? photos[`../assets/live/${file}`] : undefined;

const half = (g: Pup['gender']) => (g === 'Female' ? 'Girl' : g === 'Male' ? 'Boy' : 'Puppy');

export const pupTitle = (p: Pup, breedName: string) => {
  // A cross is never titled with the pure breed name.
  const noun = p.crossLabel ?? breedName;
  const desc = p.color ? `${p.color} ${half(p.gender)}` : `${noun} ${half(p.gender)}`;
  return p.name ? `${p.name} - ${desc}` : `${desc} #${p.id}`;
};

const pupAlt = (p: Pup, breedName: string, state: 'available' | 'placed') =>
  `${p.color ?? ''} ${p.gender ?? ''} ${p.crossLabel ?? breedName} puppy${p.name ? ` ${p.name}` : ''} ${
    state === 'available' ? 'available in Singapore' : 'recently placed with a Singapore family'
  }`
    .replace(/\s+/g, ' ')
    .trim();

// `breedLabel` adds the breed to the card body on mixed-breed listings
// (the site-wide page), where the heading no longer says which breed it is.
export function pupCard(
  p: Pup,
  breedName: string,
  state: 'available' | 'placed',
  opts: { breedLabel?: boolean } = {},
) {
  const points = [
    ...(opts.breedLabel ? [`${breedName} puppy`] : []),
    ...(p.crossLabel ? [p.crossLabel] : []),
    ...(p.hdbApproved ? ['HDB approved'] : []),
    ...(p.sizeNote ? [p.sizeNote] : []),
  ];
  return {
    title: pupTitle(p, breedName),
    imageSrc: photoFor(p.image),
    imageAlt: pupAlt(p, breedName, state),
    price: p.price ?? undefined,
    gender: p.gender ?? undefined,
    age: p.age ?? undefined,
    points: points.length > 0 ? points : undefined,
    // Identifies the exact pup in GA4 `wa_source`, so the WhatsApp inbox can be
    // reconciled against the card that produced the enquiry (Workstream A4).
    waSource: `pup:${p.id}`,
    ...(state === 'available'
      ? {
          tag: 'Available',
          // The button is already WhatsApp green and carries the WhatsApp glyph, so
          // naming the channel in the label said the same thing twice. "Photos" also
          // undersold it: the prefilled message asks for photos AND the price, and
          // buyers use the same thread for temperament, HDB status and timing. The
          // label stays anchored to the individual puppy, which is the thing that makes
          // these cards convert at 13-24% where generic chrome converts near zero.
          // BUDGET: measured at the button's computed font (700 14px Nunito), the old
          // "WhatsApp for photos" rendered 142px and fits one line in a quarter-width
          // card, so 142px is the proven ceiling. This label is 138px. It also feeds the
          // aria-label as "{meta}: {title}, $price all-in", which reads correctly.
          meta: 'Ask about this puppy',
          href: whatsappLink(
            `Hi! I'd like more photos and the price for ${p.name ?? `puppy #${p.id}`}, the ${[
              p.color?.toLowerCase(),
              p.gender?.toLowerCase(),
            ]
              .filter(Boolean)
              .join(' ')} ${p.crossLabel ?? breedName} puppy (ID ${p.id}).`,
          ),
        }
      : {
          tag: 'Recently placed',
          tagVariant: 'muted' as const,
          meta: 'Ask about similar',
          href: whatsappLink(
            `Hi! The ${breedName} puppies on your site were recently placed - could you let me know about similar ${breedName} puppies coming up?`,
          ),
        }),
  };
}

// ---------------------------------------------------------------------------
// Live-inventory strips (Workstream A2)
//
// The homepage proved the mechanism: a page carrying named, priced,
// photographed puppies converts 13-24% to WhatsApp; a page carrying generic
// "WhatsApp us" chrome converts ~0%. These helpers let /puppies/, /pricing/,
// /starter-kit/ and the breed selector reuse it instead of reinventing it.
//
// Every card href is a wa.me deep link (pupCard), never an internal URL, so a
// strip never competes with /puppies/<breed>/ on breed queries.
// ---------------------------------------------------------------------------
import liveData from '../data/available-puppies.json';
import { breedName } from '../data/breed-names';

const liveBreeds = () => liveData.breeds as Record<string, BreedBucket>;

/** Breed slugs that currently have at least one puppy in stock, stable order. */
export const stockedBreeds = (): [string, BreedBucket][] =>
  Object.entries(liveBreeds())
    .filter(([, b]) => b.available.length > 0)
    .sort(([a], [b]) => a.localeCompare(b));

/** Total puppies in our care today, including any not filed under a breed. */
export const liveTotal = () =>
  stockedBreeds().reduce((n, [, b]) => n + b.available.length, 0) +
  ((liveData as { other?: unknown[] }).other?.length ?? 0);

export const liveSyncedAt = () => liveData.syncedAt;

/**
 * `count` available puppies, round-robin one per breed so a strip reads as
 * range rather than nine of the same breed. `only` restricts to given slugs
 * (used by the out-of-stock nearest-breed fallback and the quiz result).
 */
export function livePupCards(count: number, only?: string[]): ReturnType<typeof pupCard>[] {
  const pool = only
    ? (only
        .map((slug) => [slug, liveBreeds()[slug]] as [string, BreedBucket | undefined])
        .filter((e): e is [string, BreedBucket] => Boolean(e[1]?.available.length)))
    : stockedBreeds();
  const out: ReturnType<typeof pupCard>[] = [];
  for (let depth = 0; out.length < count; depth++) {
    let addedThisRound = 0;
    for (const [slug, bucket] of pool) {
      if (out.length >= count) break;
      const pup = bucket.available[depth];
      if (!pup) continue;
      out.push(pupCard(pup, breedName(slug), 'available', { breedLabel: true }));
      addedThisRound++;
    }
    if (addedThisRound === 0) break; // every bucket exhausted
  }
  return out;
}

/** Cheapest `count` available puppies, for price-intent pages. */
export function cheapestPupCards(count: number): ReturnType<typeof pupCard>[] {
  return stockedBreeds()
    .flatMap(([slug, b]) => b.available.map((p) => ({ p, slug })))
    .filter(({ p }) => typeof p.price === 'number')
    .sort((a, b) => (a.p.price as number) - (b.p.price as number))
    .slice(0, count)
    .map(({ p, slug }) => pupCard(p, breedName(slug), 'available', { breedLabel: true }));
}
