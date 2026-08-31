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
  return p.name ? `${p.name} — ${desc}` : `${desc} #${p.id}`;
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
    ...(state === 'available'
      ? {
          tag: 'Available',
          // Card CTA labels must stay short enough for one line in a quarter-width card.
          meta: 'WhatsApp for photos',
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
            `Hi! The ${breedName} puppies on your site were recently placed — could you let me know about similar ${breedName} puppies coming up?`,
          ),
        }),
  };
}
