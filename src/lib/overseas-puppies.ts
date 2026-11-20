// Legacy Australian reservation puppies (src/data/overseas-puppies.json, written by
// `npm run sync:overseas`). Shared by OverseasPuppies (the cards) and ReservePuppies
// (the one merged "Reserve a <breed> from ..." section on breed pages), so both see
// exactly the same list.
import overseas from '../data/overseas-puppies.json';
import { AU_CUTOVER } from './imported-puppies';

export interface OsPup {
  id: string; listingId: string | null; breedLabel: string; crossLabel: string | null;
  gender: 'Male' | 'Female' | 'Both' | null; age: string | null; canFly: boolean | null;
  price: number | null; deposit: number | null; image: string | null;
}

const photos = import.meta.glob<ImageMetadata>('../assets/overseas/*.webp', { eager: true, import: 'default' });
export const overseasImage = (file: string | null) => (file ? photos[`../assets/overseas/${file}`] : undefined);

// Owner decision 2026-09-30: only list an overseas reservation puppy when it has
// a real photo. Pups whose source image could not be fetched are hidden.
//
// K-136: LEGACY. The Australian reservations now live on the imports instrument
// (src/data/au-reservations.json, rendered by ImportedPuppies with the written
// terms link). Once the owner approves and `au-reservations.mjs sync --cutover`
// runs, this list is empty; until then it keeps the live site as is.
export function overseasForBreed(breed: string): OsPup[] {
  if (AU_CUTOVER) return [];
  return ((overseas.breeds as Record<string, OsPup[]>)[breed] ?? []).filter((p) => overseasImage(p.image));
}
