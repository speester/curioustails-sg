// K-130: the ONE publish rule for an individual puppy page. Plain JS so the page
// route (src/pages/puppies/[breed]/[id].astro via src/lib/puppy-page.ts), the
// sitemap filter (astro.config.mjs via sitemap-exclusions.mjs) and the build gate
// (scripts/check-puppy-pages.mjs) all decide with the same code.
//
// Owner rulings, 2026-11-14:
//   * Only puppies in Balestier are listed. A row anywhere else (or with no
//     location) is not our inventory: no page, no card, no listing. It is
//     recorded in NEEDS-ATTENTION.md by check:puppy-pages.
//   * Every Balestier puppy gets a page, even when the breed, photo or price is
//     missing. That page is THIN: it renders an honest placeholder ("Photos
//     coming", "Ask for price"), carries noindex,follow, stays out of the
//     sitemap and ships no Product/Offer schema. When the fields arrive, the next
//     build makes it indexable with no code change.
//
// The five required fields: id, location (both decide whether the puppy is in
// scope at all), breed bucket, image and price (the three that make a page thin).
//
// Owner ruling, 2026-11-14 (K-136): imported puppies are EXEMPT from the
// Balestier rule. They come from overseas (Ireland, and the Australian
// reservations) and are delivered to the buyer's door, so they have no location
// requirement at all: importedGate() never reads a location. Their page is the
// imported variant (reservation, arrival estimate) and must not claim a shop
// location: no data-location, no Visit section, no "Balestier" in its copy or
// schema. check:puppy-pages fails the build if one does. Local puppies remain
// Balestier-only through localGate(), unchanged.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pupPageSlug } from './pup-slug.mjs';

export const AREA = 'Balestier';

/** "Balestier Area" -> "Balestier"; anything else (incl. blank) -> null. */
export const areaOf = (loc) =>
  typeof loc === 'string' && /^\s*balestier(\s+area)?\s*$/i.test(loc) ? AREA : null;

/** URL segment for a Balestier puppy whose sheet breed has no breed page. */
export const NO_BREED_SEGMENT = 'other';

export const MISSING_TEXT = {
  breed: 'no breed page for this breed label',
  image: 'no photo in the sheet',
  price: 'no price in the sheet',
};

/**
 * Local puppy (available feed).
 * @param {{ id?: unknown, location?: string|null, price?: unknown }} pup
 * @param {{ breed: string|null, hasPhoto: boolean }} ctx
 * @returns {{ inScope: false, reason: string } | { inScope: true, thin: boolean, missing: string[] }}
 */
export function localGate(pup, { breed, hasPhoto }) {
  if (pup == null || pup.id == null || String(pup.id).trim() === '') {
    return { inScope: false, reason: 'no ID in the sheet, so the puppy has no address' };
  }
  if (!areaOf(pup.location)) {
    return {
      inScope: false,
      reason: pup.location ? `location "${pup.location}" is not Balestier` : 'no location in the sheet',
    };
  }
  const missing = [];
  if (!breed) missing.push('breed');
  if (!hasPhoto) missing.push('image');
  if (!(typeof pup.price === 'number' && pup.price > 0)) missing.push('price');
  return { inScope: true, thin: missing.length > 0, missing };
}

export const IMPORTED_ID_RE = /^imp-[0-9a-f]{10}$/;

/**
 * Imported reservation (public feed record). No location requirement: an
 * imported puppy is in scope with a valid id, a breed page segment and a shown
 * status (published or reserved), wherever it is. With no photo it is thin.
 * @param {{ id?: unknown, breed?: unknown, status?: unknown, location?: unknown }} pup
 * @param {{ hasPhoto: boolean }} ctx
 * @returns {{ inScope: false, reason: string } | { inScope: true, thin: boolean, missing: string[] }}
 */
export function importedGate(pup, { hasPhoto }) {
  if (pup == null || !IMPORTED_ID_RE.test(String(pup.id ?? ''))) {
    return { inScope: false, reason: 'no imp- id, so the puppy has no address' };
  }
  if (typeof pup.breed !== 'string' || !pup.breed.trim()) return { inScope: false, reason: 'no breed page segment' };
  if (pup.status !== 'published' && pup.status !== 'reserved') return { inScope: false, reason: `status "${pup.status}" is not shown` };
  const missing = hasPhoto ? [] : ['image'];
  return { inScope: true, thin: missing.length > 0, missing };
}

/** Path of a local puppy's page. A puppy without a breed page lives under /puppies/other/. */
export const localPupPath = (breed, pup) => `/puppies/${breed ?? NO_BREED_SEGMENT}/${pupPageSlug(pup)}/`;

// ---------------------------------------------------------------------------
// Feed walking (Node side: sitemap filter and gate script). Astro pages use the
// same localGate() through src/lib/puppy-page.ts with bundled photo lookups.
// ---------------------------------------------------------------------------
const ROOT = process.cwd();
const livePhotoExists = (file) => !!file && existsSync(path.join(ROOT, 'src', 'assets', 'live', file));

const readJson = (file, fallback) => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
};

/**
 * Test fixtures (scripts/test-puppy-page.mjs) are merged in ONLY when
 * PUPPY_FIXTURES points at a fixture file. The real feeds are never written.
 * Shape: { local: [{ breed: string|null, pup }], placed: [PlacedPup], imported: [ImportedPup] }
 */
export function fixtureRows() {
  const file = process.env.PUPPY_FIXTURES;
  if (!file) return { local: [], placed: [], imported: [] };
  const raw = readJson(path.resolve(ROOT, file), {});
  return { local: raw.local ?? [], placed: raw.placed ?? [], imported: raw.imported ?? [] };
}

/** Every local row the site knows about: breed buckets, the `other` list, then fixtures. */
export function localRows(feed = readJson(path.join(ROOT, 'src', 'data', 'available-puppies.json'), { breeds: {} })) {
  const rows = [];
  for (const [breed, bucket] of Object.entries(feed.breeds ?? {})) {
    for (const pup of bucket.available ?? []) rows.push({ breed, pup });
  }
  for (const pup of feed.other ?? []) rows.push({ breed: null, pup });
  for (const r of fixtureRows().local) rows.push({ breed: r.breed ?? null, pup: r.pup });
  return rows;
}

/** Paths of thin local pages (noindex, out of the sitemap). */
export function thinLocalPaths(rows = localRows()) {
  const out = new Set();
  for (const { breed, pup } of rows) {
    const g = localGate(pup, { breed, hasPhoto: livePhotoExists(pup.image) });
    if (g.inScope && g.thin) out.add(localPupPath(breed, pup));
  }
  return out;
}
