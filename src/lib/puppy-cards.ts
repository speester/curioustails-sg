// Shared card-building for real inventory (src/data/available-puppies.json,
// written by `npm run sync:puppies`). Used by the per-breed AvailablePuppies
// section and by the site-wide /available-puppies/ page.
import { whatsappLink } from '../data/site';

// Owner decision (2026-10-02): the rotating WhatsApp-label A/B experiment is
// retired on the card in favour of one fixed, question-led label that tests best
// in review ("is this exact pup still available?" is the buyer's real first
// question). The GA4 wa_variant stamp is pinned to this constant so the inbox
// attribution keeps working without the rotation.
const WA_LABEL = 'Check Availability';
const WA_VARIANT = 'fixed-2026-10b';

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
  // true when the shop's sheet ticks HDBApproved for this pup - the breed
  // transfers into an HDB flat with no separate HDB approval needed. null =
  // not stated; never render a claim from a blank.
  hdbApproved?: boolean | null;
  // Per-puppy short clip URL (feed Video- column). Empty until the shop fills
  // it in; when set, the card shows a play badge that opens a video lightbox.
  video?: string | null;
  // The shop's cal.com booking link for this exact pup (feed CalLink-), used by
  // the "Book Appointment" button under available cards.
  bookHref?: string | null;
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

// Canonical URL of a puppy's own page (/puppies/<breed>/<id>/). The individual
// puppy route and every card that links to it MUST derive the slug from here, so
// the link and the generated path can never drift apart.
export const pupPageSlug = (p: Pup) =>
  `${p.id}-${p.color ?? ''}-${half(p.gender)}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
export const pupPageHref = (breedSlug: string, p: Pup) => `/puppies/${breedSlug}/${pupPageSlug(p)}/`;

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
  opts: { breedLabel?: boolean; breedSlug?: string } = {},
) {
  return {
    title: pupTitle(p, breedName),
    imageSrc: photoFor(p.image),
    imageAlt: pupAlt(p, breedName, state),
    price: p.price ?? undefined,
    gender: p.gender ?? undefined,
    age: p.age ?? undefined,
    location: p.location ?? undefined,
    video: p.video ?? undefined,
    // New card (2026-10): breed rides a coloured "ticket" tag beside the price
    // instead of a bullet in the points list; a cross is tagged as the cross,
    // never the pure breed. HDB status becomes a chip in the gender/age row.
    isPup: true as const,
    breed: p.crossLabel ?? breedName,
    hdbApproved: p.hdbApproved ?? null,
    sizeNote: p.sizeNote ?? undefined,
    pupId: String(p.id),
    color: p.color ?? undefined,
    origin: p.origin ?? undefined,
    state,
    // Identifies the exact pup in GA4 `wa_source`, so the WhatsApp inbox can be
    // reconciled against the card that produced the enquiry (Workstream A4).
    waSource: `pup:${p.id}`,
    ...(state === 'available'
      ? {
          tag: 'Available',
          meta: WA_LABEL,
          waVariant: WA_VARIANT,
          // Link to this puppy's own page (when the breed has the route wired).
          pageHref: opts.breedSlug ? pupPageHref(opts.breedSlug, p) : undefined,
          href: whatsappLink(
            `Hi! I'd like more photos and the price for ${p.name ?? 'your pup'}, the ${[
              p.color?.toLowerCase(),
              p.gender?.toLowerCase(),
            ]
              .filter(Boolean)
              .join(' ')} ${p.crossLabel ?? breedName} puppy (ID ${p.id}).`,
          ),
          // Always-present Video action: when the shop hasn't filled a clip yet,
          // the button opens WhatsApp pre-asking for a video of this exact pup,
          // so the action never dead-ends (owner decision 2026-10-02).
          videoHref: whatsappLink(
            `Hi! Could you send a video of ${p.name ?? 'your pup'}, the ${[
              p.color?.toLowerCase(),
              p.gender?.toLowerCase(),
            ]
              .filter(Boolean)
              .join(' ')} ${p.crossLabel ?? breedName} puppy (ID ${p.id})? I'd love to see it.`,
          ),
          // Secondary CTA: the shop's cal.com booking link for this exact pup.
          bookHref: p.bookHref ?? undefined,
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
      out.push(pupCard(pup, breedName(slug), 'available', { breedLabel: true, breedSlug: slug }));
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
    .map(({ p, slug }) => pupCard(p, breedName(slug), 'available', { breedLabel: true, breedSlug: slug }));
}
