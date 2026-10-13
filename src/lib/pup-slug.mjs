// The ONE definition of a puppy page's URL slug (/puppies/<breed>/<slug>/).
// Plain JS so the build-time redirect integration (scripts/lib/puppy-redirects.mjs)
// can import it alongside the TypeScript page code (src/lib/puppy-cards.ts): a
// retired page's 301 source must be byte-identical to the URL it was served at.
const half = (g) => (g === 'Female' ? 'Girl' : g === 'Male' ? 'Boy' : 'Puppy');

/** @param {{ id: number | string, color?: string | null, gender?: string | null }} p */
export const pupPageSlug = (p) =>
  `${p.id}-${p.color ?? ''}-${half(p.gender)}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
