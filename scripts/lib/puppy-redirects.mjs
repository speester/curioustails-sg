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
export const RETIRED_MARK = '# Retired puppy pages: generated at build by scripts/lib/puppy-redirects.mjs';

/** The 301 rules for every archived puppy whose page is not in `distDir`. */
export function retiredPuppyRules(distDir) {
  if (!existsSync(ARCHIVE)) return [];
  const { pups = [] } = JSON.parse(readFileSync(ARCHIVE, 'utf8'));
  const built = (urlPath) => existsSync(path.join(distDir, urlPath, 'index.html'));
  const rules = [];
  for (const p of pups) {
    const from = `/puppies/${p.breed}/${pupPageSlug(p)}/`;
    if (built(from)) continue;
    const breedPage = `/puppies/${p.breed}/`;
    rules.push(`${from} ${built(breedPage) ? breedPage : '/puppies/'} 301`);
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
