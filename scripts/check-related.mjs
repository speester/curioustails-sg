#!/usr/bin/env node
// check-related.mjs — the READ NEXT module, measured on BUILT dist/.
// Every post page (page_tier = outer, contracts.md §1a — "blog" is a dead word)
// carries [data-related] with real, resolving, non-self links. The module lives in
// ArticleLayout.astro so it cannot be forgotten on one page; this is what catches it
// disappearing from ALL of them — which is exactly how it fails, because `related`
// silently collapses to [] the moment gen-posts.mjs has not run or `parent` is blank.
// Usage: node scripts/check-related.mjs
// Exit 0 clean, 1 on any failure. Node 20 built-ins only.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { parseCsv } from './lib/csv.mjs';   // THE one RFC-4180 row parser
import { join, relative, sep } from 'node:path';

const ROOT = process.env.PROJECT_ROOT || process.cwd();
const DIST = join(ROOT, 'dist');
const BLUEPRINT = join(ROOT, 'research', 'site-blueprint.csv');
const MIN = 3;

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    statSync(p).isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
}

const pages = walk(DIST).filter((f) => f.endsWith(`${sep}index.html`));
// A gate that measures nothing must never report PASS (contracts_check
// `gate-not-vacuous`): with no dist/ every counter below is 0 and this would exit 0.
if (!pages.length) {
  console.log(`HALT: no dist/**/index.html - run \`npm run build\` first, or set PROJECT_ROOT (looked in ${DIST})`);
  process.exit(1);
}

const routeOf = (f) => {
  const r = relative(DIST, f).split(sep).slice(0, -1).join('/');
  return r ? `${r}` : 'index';
};

// page_tier comes from the blueprint; without it we cannot say which routes are posts,
// and guessing "anything under /blog/" would bake in a dead word.
if (!existsSync(BLUEPRINT)) {
  console.log(`HALT: ${BLUEPRINT} missing - page_tier is what says which routes are posts`);
  process.exit(1);
}
// `line.split(',')` on a quoted CSV is a defect (lib/csv.mjs). The contract blueprint
// quotes `notes` and `serp_features`, both of which contain commas, so every cell after
// the first quoted comma shifted: this gate read `build_order` as `page_tier` and
// reported "tier values present: 11, 15, 17 ... low-demand" before HALTing by vacancy.
const csv = parseCsv(readFileSync(BLUEPRINT, 'utf8')).map((r) => r.cells);
const head = csv[0].map((h) => h.trim());
const iSlug = head.indexOf('url_slug');
const iTier = head.indexOf('page_tier');
if (iSlug < 0 || iTier < 0) {
  console.log('HALT: blueprint has no url_slug / page_tier column (contracts.md §9)');
  process.exit(1);
}
const tier = new Map();
for (const c of csv.slice(1)) {
  if (c.length <= Math.max(iSlug, iTier)) continue;
  tier.set((c[iSlug] || '').trim().replace(/^\/+|\/+$/g, '') || 'index',
           (c[iTier] || '').trim().toLowerCase());
}

const posts = pages.filter((f) => tier.get(routeOf(f)) === 'outer');
if (!posts.length) {
  // A zero-population gate must be LOUD. Audited 2026-09-04: only 8 of 29
  // blueprints spell the tier 'outer'; the rest carry L3 / 3 / blog / cluster,
  // so on 21 projects this printed nothing-to-check, exited 0, and exit-gate
  // letter (j) recorded a pass indistinguishable from a real one.
  const seen = [...new Set([...tier.values()].filter(Boolean))].sort();
  console.error(
    [
      'HALT related: 0 routes carry page_tier=outer, so nothing was checked.',
      '  tier values present in the blueprint: ' + (seen.join(', ') || '<none>'),
      '  the blueprint is not on the contracts s1a vocabulary '
        + '(core|outer|utility|compare|monetization|functional).',
      '  Fix the page_tier column, or state explicitly that this site has no '
        + 'outer tier - do not let this gate pass by vacancy.'
    ].join('\n')
  );
  process.exit(1);
}
// A site with 2 posts cannot show 3 siblings. Never demand more than exists.
const need = Math.min(MIN, posts.length - 1);
const built = new Set(pages.map(routeOf));

const missing = [], thin = [], selfref = [], dupe = [], dead = [];
for (const f of posts) {
  const route = routeOf(f);
  const html = readFileSync(f, 'utf8');
  const block = html.match(/<aside[^>]*\bdata-related\b[\s\S]*?<\/aside\s*>/i);
  if (!block) { missing.push(route); continue; }
  const hrefs = [...block[0].matchAll(/<a[^>]+href=["']([^"']+)["']/gi)]
    .map((m) => m[1].split('#')[0].split('?')[0])
    .filter((h) => h.startsWith('/'))
    .map((h) => h.replace(/^\/+|\/+$/g, '') || 'index');
  if (hrefs.length < need) thin.push(`${route}(${hrefs.length}/${need})`);
  if (hrefs.includes(route)) selfref.push(route);
  if (new Set(hrefs).size !== hrefs.length) dupe.push(route);
  for (const h of hrefs) if (!built.has(h)) dead.push(`${route} -> /${h}/`);
}

for (const r of missing) console.log(`FAIL no [data-related] READ NEXT block on post page: /${r}/`);
for (const r of thin) console.log(`FAIL READ NEXT block under-filled: ${r}`);
for (const r of selfref) console.log(`FAIL READ NEXT links to the page it is on: /${r}/`);
for (const r of dupe) console.log(`FAIL READ NEXT repeats the same target twice: /${r}/`);
for (const r of dead) console.log(`FAIL READ NEXT link has no built page: ${r}`);

const bad = missing.length + thin.length + selfref.length + dupe.length + dead.length;
console.log(`related: ${posts.length} post pages, need>=${need} each, missing=${missing.length}, under_filled=${thin.length}, self=${selfref.length}, dupes=${dupe.length}, dead=${dead.length}`);
// contracts: every gate prints WHAT IT MEASURED, not only what failed - the
// fixed shape `checked=<n> failed=<m>` on the verdict line. Without it a
// clean run and a run that measured nothing print the same words.
console.log(`check-related: checked=${posts.length} failed=${missing.length + thin.length + selfref.length + dupe.length + dead.length}`);
process.exit(bad ? 1 : 0);
