// Astro integration: 301 every retired puppy page to its breed page.
//
// A puppy page (/puppies/<breed>/<slug>/) is built while the puppy is available
// and, once it has found its home, for the placed archive's retention window
// (src/data/placed-archive.json). Every other archived puppy - withdrawn, expired,
// or placed without a photo - no longer has a page, and before 2026-10-14 its URL
// simply 404'd. After the build, this appends one 301 per such URL to
// dist/_redirects (Cloudflare Pages), pointing at the breed page.
//
// It writes to dist/ only: public/_redirects stays owned by gen-redirects.mjs,
// whose --check would otherwise call the file stale on every build. A URL that
// was built is never redirected, whatever the archive says.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pupPageSlug } from '../../src/lib/pup-slug.mjs';

const ARCHIVE = fileURLToPath(new URL('../../src/data/placed-archive.json', import.meta.url));
const IMPORTED_RETIRED = fileURLToPath(new URL('../../src/data/imported-retired.json', import.meta.url));
export const RETIRED_MARK = '# Retired puppy pages: generated at build by scripts/lib/puppy-redirects.mjs';

/**
 * The 301 rules for every archived puppy whose page is not in `distDir`, plus
 * every imported puppy the owner took down (imported-retired.json, only
 * {id, breed} — no supplier, seller or microchip can be in that file).
 */
export function retiredPuppyRules(distDir, { archive = ARCHIVE, importedRetired = IMPORTED_RETIRED } = {}) {
  const built = (urlPath) => existsSync(path.join(distDir, urlPath, 'index.html'));
  const rules = [];
  const seen = new Set();
  const add = (from, breed) => {
    if (!from || !breed || seen.has(from)) return;
    seen.add(from);
    if (built(from)) return;
    const breedPage = `/puppies/${breed}/`;
    rules.push(`${from} ${built(breedPage) ? breedPage : '/puppies/'} 301`);
  };

  if (existsSync(archive)) {
    try {
      const { pups = [] } = JSON.parse(readFileSync(archive, 'utf8'));
      for (const p of pups) add(`/puppies/${p.breed}/${pupPageSlug(p)}/`, p.breed);
    } catch { /* a malformed archive must not stop a build; imported rules still apply */ }
  }
  if (existsSync(importedRetired)) {
    try {
      const list = JSON.parse(readFileSync(importedRetired, 'utf8'));
      for (const r of Array.isArray(list) ? list : []) {
        if (!r?.id || !r?.breed) continue;
        add(`/puppies/${r.breed}/${r.id}/`, r.breed);
      }
    } catch { /* malformed retired list: skip it rather than fail the build */ }
  }
  return rules;
}

export function puppyRedirects() {
  return {
    name: 'curious-tails:puppy-redirects',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const distDir = fileURLToPath(dir);
        const rules = retiredPuppyRules(distDir);
        const file = path.join(distDir, '_redirects');
        const base = existsSync(file) ? readFileSync(file, 'utf8') : '';
        // Idempotent: drop a previous run's block before appending this one.
        const kept = base.includes(RETIRED_MARK) ? base.slice(0, base.indexOf(RETIRED_MARK)) : base;
        writeFileSync(file, `${kept.trimEnd()}\n\n${RETIRED_MARK}\n${rules.join('\n')}${rules.length ? '\n' : ''}`);
        logger.info(`${rules.length} retired puppy page(s) now 301 to their breed page`);
      },
    },
  };
}
