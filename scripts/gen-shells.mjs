#!/usr/bin/env node
/**
 * gen-shells.mjs — create a PLACEHOLDER-COPY shell for every registry route that has
 * no page file yet, so internal link contracts resolve while Stage 3 fills pages in
 * build_order.
 *
 *   node scripts/gen-shells.mjs [--force]
 *
 * A shell is NOT a page. It carries the literal marker PLACEHOLDER-COPY, which
 * scripts/check-content.mjs fails on in src/ AND dist/, so no shell can survive the
 * Stage 3 exit gate. content-writer deletes the marker as part of authoring.
 *
 * Never overwrites a file that does not contain the marker: a written page is safe.
 */
import fs from 'node:fs';
import path from 'node:path';

const force = process.argv.includes('--force');
const MARKER = 'PLACEHOLDER-COPY';

const siteTs = fs.readFileSync('src/data/site.ts', 'utf8');
const routes = [];
const re = /\{\s*slug:\s*'([^']+)'[\s\S]*?title:\s*'((?:[^'\\]|\\.)*)'[\s\S]*?h1:\s*'((?:[^'\\]|\\.)*)'[\s\S]*?tier:\s*'([^']*)'[\s\S]*?pageType:\s*'([^']*)'[\s\S]*?parent:\s*'([^']*)'[\s\S]*?schema:\s*\[([^\]]*)\]/g;
let m;
while ((m = re.exec(siteTs))) {
  routes.push({
    slug: m[1], title: m[2].replace(/\\'/g, "'"), h1: m[3].replace(/\\'/g, "'"),
    tier: m[4], pageType: m[5], parent: m[6],
    schema: m[7].split(',').map(s => s.trim().replace(/^'|'$/g, '')).filter(Boolean),
  });
}
if (!routes.length) { console.error('FAIL: no routes parsed from src/data/site.ts'); process.exit(1); }

/** /pricing/heygen/ -> src/pages/pricing/heygen.astro ; / -> src/pages/index.astro */
function fileFor(slug) {
  if (slug === '/') return 'src/pages/index.astro';
  if (slug === '/404') return 'src/pages/404.astro';
  const clean = slug.replace(/^\/|\/$/g, '');
  return `src/pages/${clean}.astro`;
}

const SCHEMA_TO_TYPE = {
  CollectionPage: 'CollectionPage', Article: 'Article', Organization: 'WebPage',
  WebSite: 'WebPage', AboutPage: 'AboutPage', ContactPage: 'ContactPage',
};
function layoutType(r) {
  if (r.slug === '/about/') return 'AboutPage';
  if (r.slug === '/contact/') return 'ContactPage';
  for (const s of r.schema) if (SCHEMA_TO_TYPE[s] && SCHEMA_TO_TYPE[s] !== 'WebPage') return SCHEMA_TO_TYPE[s];
  return 'WebPage';
}

function crumbs(r) {
  const out = [{ label: 'Home', href: '/' }];
  if (r.parent && r.parent !== '/') {
    const p = routes.find(x => x.slug === r.parent);
    if (p) out.push({ label: p.title, href: p.slug });
  }
  if (r.slug !== '/') out.push({ label: r.title, href: r.slug });
  return out;
}

const q = s => JSON.stringify(String(s));

function shell(r) {
  const noindex = r.slug === '/404' || /thank-you/.test(r.slug);
  const bc = r.slug === '/' ? [] : crumbs(r);
  return `---
// ${MARKER} — shell only. Stage 3 (page-brief -> content-writer) replaces this file
// entirely and deletes this marker. scripts/check-content.mjs fails while it is present.
import BaseLayout from '../${'../'.repeat(Math.max(0, r.slug.replace(/^\/|\/$/g, '').split('/').length - 1))}layouts/BaseLayout.astro';
import Hero from '../${'../'.repeat(Math.max(0, r.slug.replace(/^\/|\/$/g, '').split('/').length - 1))}components/Hero.astro';

const draft = true;
const title = ${q(r.title)};
const description = ${q(`${r.h1}. This page is being written and is noindexed as a draft until the Stage 3 loop authors it.`)};
const breadcrumbs = ${JSON.stringify(bc)};
---
<BaseLayout title={title} description={description} path=${q(r.slug.endsWith('/') || r.slug === '/404' ? r.slug : r.slug + '/')} draft={draft}${noindex ? ' noindex={true}' : ''}>
  <Hero title=${q(r.h1)} crumbs={breadcrumbs} />
  <section data-tone="paper" data-treatment="callout"><div class="mx-auto max-w-3xl px-4 py-12"><p data-shell>${MARKER}: this route exists so internal links resolve. Copy lands in Stage 3.</p></div></section>
</BaseLayout>
`;
}

let made = 0, kept = 0, skipped = 0;
for (const r of routes) {
  const file = fileFor(r.slug);
  if (fs.existsSync(file)) {
    const cur = fs.readFileSync(file, 'utf8');
    if (!cur.includes(MARKER)) { skipped++; continue; }      // a real page — never clobber
    if (!force) { kept++; continue; }
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, shell(r), 'utf8');
  made++;
}
console.log(`gen-shells: routes=${routes.length} created=${made} existing_shells=${kept} written_pages_skipped=${skipped}`);
// contracts section-1b, generator form: a generator that wrote NOTHING has
// silently done nothing, and the build then fails somewhere else entirely.
console.log(`gen-shells: wrote=${made} routes=${routes.length}`);
