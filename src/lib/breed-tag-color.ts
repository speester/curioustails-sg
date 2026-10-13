// Per-breed ticket colour, shared by the live puppy cards (ListingGrid/PupCard)
// and the "Puppies That Found Their Loving Homes" cards, so a breed wears the
// same colour wherever it appears.
//
// The common breeds are pinned to well-separated hues so visually close breeds
// (e.g. Cockapoo vs Shih Tzu) never share a near-identical tag; anything unpinned
// falls back to a hash over a palette whose hues are spaced far apart, so a
// future breed cannot land on an adjacent brown by accident.
const BREED_TAG: Record<string, string> = {
  Cavapoo: '#d64545', // red
  Cockapoo: '#e0861a', // orange
  'Shih Tzu': '#6a4bbd', // violet (kept far from Cockapoo's orange)
  Maltipoo: '#2f8b74', // teal
  Poodle: '#c2567f', // magenta
  'Toy Poodle': '#c2567f',
  Maltese: '#3f7cc0', // blue
  Pomeranian: '#2f9e9e', // cyan
  Corgi: '#b5671d', // brown
  Chihuahua: '#8a5a3c', // taupe
  'Bichon Frise': '#5a8f3c', // green
  Goldendoodle: '#c98b2f', // amber-gold
  Cavachon: '#b5497a', // rose
  Cavapoochon: '#7a6cc4', // periwinkle
};
// Evenly spaced hues (gap ~40deg) for breeds not pinned above.
const TAG_PALETTE = ['#d64545', '#e0861a', '#2f8b74', '#3f7cc0', '#6a4bbd', '#c2567f', '#5a8f3c', '#2f9e9e'];

export const breedTagColor = (breed: string) => {
  if (BREED_TAG[breed]) return BREED_TAG[breed];
  let h = 0;
  for (let i = 0; i < breed.length; i++) h = (h * 131 + breed.charCodeAt(i)) >>> 0;
  return TAG_PALETTE[h % TAG_PALETTE.length];
};
