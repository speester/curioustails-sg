// sitemap-exclusions.mjs — the ONE predicate astro.config.mjs's sitemap filter uses.
//
// astro-build described an `EXCLUDED_ROUTES` block built from `draftRoutes()` + `readState()`
// "from the kit"; nothing shipped either, so every project hand-wrote a filter (or had none
// and shipped noindex URLs in the sitemap, which launch gate item 12 fails on).
//
// A route is out of the sitemap when it is:
//   * noindex by policy (thank-you pages, staging-only routes, the search page),
//   * a DRAFT — listed in .claude/state/draft-routes.json, which the build loop writes as it
//     scaffolds shells before the copy exists,
//   * an endpoint that is not a page (rss.xml, llms.txt, the sitemap itself).
import { readFileSync } from 'node:fs';
import { thinLocalPaths } from './puppy-publish.mjs';

// Routes that are noindex wherever they appear. Keep the list short and justified; the
// per-page `noindex` frontmatter is the general mechanism, this is for framework routes.
export const NOINDEX_ROUTES = [
  '/thank-you/',
  '/contact/thank-you/',
  '/search/',
  '/404/',
  // the kit's section-pattern gallery (contracts 22): placeholder content by
  // design, so it is noindex wherever a project chooses to publish it
  '/patterns/',
  '/_patterns/',
  // K-136: the reservation terms are a draft with counsel; the page is noindex
  // until counsel signs (src/pages/reservation-terms.astro).
  '/reservation-terms/',
];

const ENDPOINT_RX = /\.(xml|txt|json|js|ts)$/i;

// Imported reservation pages (/puppies/<breed>/imp-<10 hex>/) are noindex by
// owner decision D11: they live for days to weeks, the breed page carries the
// SEO, and a retired one 301s to the breed page. A noindex URL in the sitemap
// is a contradiction Search Console reports as an error.
const IMPORTED_PUP_RX = /^\/puppies\/[^/]+\/imp-[0-9a-f]{10}\/$/;

export function isImportedPupPath(page) {
  let path = String(page || '');
  try {
    path = new URL(path).pathname;
  } catch {
    /* already a path */
  }
  if (!path.startsWith('/')) path = '/' + path;
  if (!path.endsWith('/')) path += '/';
  return IMPORTED_PUP_RX.test(path);
}

function draftRoutes() {
  try {
    const raw = JSON.parse(readFileSync('.claude/state/draft-routes.json', 'utf8'));
    const list = Array.isArray(raw) ? raw : raw.routes || [];
    return new Set(list.map((r) => (typeof r === 'string' ? r : r.slug)).filter(Boolean));
  } catch {
    return new Set();
  }
}

const DRAFTS = draftRoutes();

// K-130: a thin puppy page (Balestier puppy with no breed page, photo or price)
// is built but noindex,follow, so it stays out of the sitemap. Computed from the
// same feed and the same rule as the page (src/lib/puppy-publish.mjs); when the
// missing field arrives, the next build drops it from this set automatically.
const THIN_PUPS = thinLocalPaths();
export const isThinPupPath = (p) => THIN_PUPS.has(p);

/** `page` is the absolute URL @astrojs/sitemap offers the filter. */
export function isExcludedFromSitemap(page) {
  let path = String(page || '');
  try {
    path = new URL(path).pathname;
  } catch {
    /* already a path */
  }
  if (!path.startsWith('/')) path = '/' + path;
  if (ENDPOINT_RX.test(path)) return true;
  if (IMPORTED_PUP_RX.test(path)) return true;
  if (THIN_PUPS.has(path)) return true;
  if (NOINDEX_ROUTES.includes(path)) return true;
  if (DRAFTS.has(path)) return true;
  return false;
}

export default isExcludedFromSitemap;
