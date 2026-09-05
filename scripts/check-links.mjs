#!/usr/bin/env node
// kit:check-links@1.0.0 — internal hrefs, asset srcs, card images, form handlers.
// Usage: node scripts/check-links.mjs [--cards] [--forms]
import fs from 'node:fs';
import { parseCsv } from './lib/csv.mjs';
import path from 'node:path';

const args = process.argv.slice(2);
const only = (n) => args.length === 0 || args.includes(`--${n}`);

// An unrecognised --flag left the selection empty, which means "run everything":
// a typo, or a flag a skill cites that this script never implemented, then reported
// on the whole site as if the named check had run.
const KNOWN = ["cards", "forms"];
const unknown = args.filter((a) => a.startsWith('--') && !KNOWN.includes(a.replace(/^--/, '')));
if (unknown.length) {
  console.error(`FAIL unknown option(s): ${unknown.join(' ')}`);
  console.error(`     known: ${KNOWN.map((k) => '--' + k).join(' ')}`);
  process.exit(2);
}
const rows = []; const detail = [];
const add = (c, fails, note = '') => {
  rows.push([c, fails.length ? `FAIL (${fails.length})` : 'PASS', note]);
  for (const f of fails.slice(0, 40)) detail.push(`  [${c}] ${f}`);
  if (fails.length > 40) detail.push(`  [${c}] ... ${fails.length - 40} more`);
};

function htmlFiles(dir = 'dist', out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) htmlFiles(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

const pages = htmlFiles();
if (!pages.length) { console.error('FAIL dist/ is empty — run `npm run build` first.'); process.exit(1); }

const routes = new Set(pages.map((p) => {
  let r = '/' + path.relative('dist', p).replace(/\\/g, '/');
  r = r.replace(/index\.html$/, '').replace(/\.html$/, '/');
  return r.endsWith('/') ? r : r + '/';
}));

const blueprint = fs.existsSync('research/site-blueprint.csv')
  ? new Set(parseCsv(fs.readFileSync('research/site-blueprint.csv', 'utf8')).slice(1)
      .map((r) => (r.cells[0] || '').trim()).filter(Boolean)
      .map((p) => (p.startsWith('/') ? p : '/' + p)).map((p) => (p.endsWith('/') ? p : p + '/')))
  : new Set();

const broken = []; const unbuiltPlanned = []; const missingAssets = [];
const cardsNoImg = []; const formNoHandler = [];

for (const file of pages) {
  const html = fs.readFileSync(file, 'utf8');

  for (const m of html.matchAll(/href="(\/[^"#?]*)"/g)) {
    const href = m[1];
    if (/\.[a-z0-9]{2,12}$/i.test(href)) continue;             // asset/file link
    if (href.startsWith('/api/')) continue;
    const r = href.endsWith('/') ? href : href + '/';
    if (routes.has(r)) continue;
    if (blueprint.has(r)) unbuiltPlanned.push(`${file} -> ${href} (planned, not built)`);
    else broken.push(`${file} -> ${href}`);
  }

  for (const m of html.matchAll(/src="(\/(?:images|figures|fonts)\/[^"]+)"/g)) {
    const p = m[1];
    if (!fs.existsSync(path.join('dist', p)) && !fs.existsSync(path.join('public', p))) {
      missingAssets.push(`${file} -> ${p}`);
    }
  }

  if (only('cards')) {
    for (const card of html.matchAll(/<(?:article|a|div)[^>]*class="[^"]*\b(?:listing-card|article-card|pillar-card|hub-card)\b[^"]*"[\s\S]{0,1200}?<\/(?:article|a|div)>/g)) {
      const block = card[0];
      const img = block.match(/<img[^>]*src="([^"]+)"/);
      if (!img) cardsNoImg.push(`${file} card with no <img>`);
      else if (/placeholder|figures\/features\//.test(img[1])) cardsNoImg.push(`${file} card using a placeholder src: ${img[1]}`);
    }
  }

  if (only('forms')) {
    for (const m of html.matchAll(/<form[^>]*action="([^"]+)"/g)) {
      const a = m[1];
      if (a.startsWith('/api/')) {
        const ts = path.join('functions', a.replace(/^\//, '') + '.ts');
        const js = path.join('functions', a.replace(/^\//, '') + '.js');
        if (!fs.existsSync(ts) && !fs.existsSync(js)) formNoHandler.push(`${file} form action ${a} has NO handler`);
      } else if (!/^https?:/.test(a)) {
        formNoHandler.push(`${file} form action ${a} is neither /api/* nor an external provider`);
      }
    }
  }
}

add('internal-links', broken, 'every internal href resolves to a built route');
rows.push(['planned-not-built', unbuiltPlanned.length ? `INFO (${unbuiltPlanned.length})` : 'PASS', 'blueprint rows not yet built — listed, not failed']);
for (const u of unbuiltPlanned.slice(0, 20)) detail.push(`  [planned-not-built] ${u}`);
add('asset-srcs', missingAssets, '/images and /figures srcs exist on disk');
if (only('cards')) add('card-images', cardsNoImg, 'every card that links to a page renders its feature image');
if (only('forms')) add('form-handlers', formNoHandler, 'every <form action> has a Pages Function or an external provider');

console.log('CHECK             | RESULT     | NOTE');
for (const [c, r, n] of rows) console.log(`${c.padEnd(17)} | ${r.padEnd(10)} | ${n}`);
if (detail.length) { console.log('\nDETAIL:'); for (const d of detail) console.log(d); }
const failed = rows.filter((r) => r[1].startsWith('FAIL')).length;
console.log(`\npages=${pages.length} routes=${routes.size} failed=${failed}`);
// contracts section-1b: every gate prints WHAT IT MEASURED, not only what
// failed - the fixed shape `checked=<n> failed=<m>` on the verdict line.
console.log(`check-links: checked=${pages.length} failed=${failed ? 1 : 0}`);
console.log(failed ? 'FAIL check:links' : 'PASS check:links');
process.exit(failed ? 1 : 0);
