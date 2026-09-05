#!/usr/bin/env node
/**
 * crawl-path.mjs — BFS from / over IN-CONTENT links only (chrome stripped).
 *
 *   node scripts/crawl-path.mjs dist/
 *
 * Fails when any indexable built route is unreachable from / through body links, or when an
 * L2 hub (from research/site-blueprint.csv) has fewer than 2 in-content inbound links.
 * Node 20+, stdlib only.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = (process.argv[2] || 'dist').replace(/\/+$/, '');
const CSV = process.argv.includes('--csv') ? process.argv[process.argv.indexOf('--csv') + 1] : 'research/site-blueprint.csv';
const ex = p => { try { fs.accessSync(p); return true; } catch { return false; } };
const rd = p => fs.readFileSync(p, 'utf8');

if (!ex(root)) { console.error(`FAIL: ${root} does not exist — build first.`); process.exit(1); }

/* ---- collect built routes ---- */
const pages = new Map();  // route -> html
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name === 'index.html') {
      const route = ('/' + path.relative(root, p).replace(/\\/g, '/')).replace(/index\.html$/, '');
      pages.set(route === '' ? '/' : route, rd(p));
    }
  }
})(root);

/* ---- strip chrome ---- */
function stripChrome(html) {
  let out = html;
  for (const tag of ['header', 'footer', 'nav', 'aside']) {
    const re = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi');
    out = out.replace(re, ' ');
  }
  // remove any element carrying data-chrome, with depth counting on its own tag name
  let guard = 0;
  while (guard++ < 200) {
    const m = out.match(/<([a-zA-Z][\w-]*)\b[^>]*\bdata-chrome\b[^>]*>/);
    if (!m) break;
    const tag = m[1];
    const start = m.index;
    let i = start + m[0].length, depth = 1;
    const open = new RegExp(`<${tag}\\b`, 'gi'), close = new RegExp(`<\\/${tag}>`, 'gi');
    while (depth > 0 && i < out.length) {
      open.lastIndex = i; close.lastIndex = i;
      const o = open.exec(out), c = close.exec(out);
      if (!c) { i = out.length; break; }
      if (o && o.index < c.index) { depth++; i = o.index + 1; }
      else { depth--; i = c.index + `</${tag}>`.length; }
    }
    out = out.slice(0, start) + ' ' + out.slice(i);
  }
  return out;
}
const norm = href => {
  let h = href.split('#')[0].split('?')[0];
  if (!h.startsWith('/') || h.startsWith('//')) return null;
  if (/\.(png|jpe?g|webp|svg|pdf|xml|txt|ico|css|js|json)$/i.test(h)) return null;
  if (h !== '/' && !h.endsWith('/')) h += '/';
  return h;
};
const graph = new Map(), inbound = new Map();
for (const [route, html] of pages) {
  const body = stripChrome(html);
  const links = new Set();
  for (const m of body.matchAll(/href\s*=\s*"([^"]+)"/gi)) {
    const h = norm(m[1]);
    if (h && h !== route) links.add(h);
  }
  graph.set(route, links);
  for (const l of links) { if (!inbound.has(l)) inbound.set(l, new Set()); inbound.get(l).add(route); }
}
const noindex = r => /<meta[^>]+name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(pages.get(r) || '');

/* ---- BFS ---- */
const seen = new Set(['/']);
const queue = ['/'];
while (queue.length) {
  const cur = queue.shift();
  for (const l of (graph.get(cur) || [])) if (pages.has(l) && !seen.has(l)) { seen.add(l); queue.push(l); }
}
const indexable = [...pages.keys()].filter(r => !noindex(r) && r !== '/404/');
const orphans = indexable.filter(r => !seen.has(r));

/* ---- hubs from the blueprint ---- */
let hubs = [];
if (ex(CSV)) {
  // lib/csv.mjs is THE RFC-4180 row parser. A hand-rolled splitter here yields a phantom
  // route from any quoted field, and the contract blueprint quotes notes/serp_features.
  const rowsRaw = parseCsv(rd(CSV)).map((r) => r.cells);
  const head = rowsRaw[0].map((s) => s.trim());
  const iSlug = head.indexOf('url_slug'), iHub = head.indexOf('hub_or_node');
  for (const cells of rowsRaw.slice(1)) {
    if (cells[iHub] === 'L2') hubs.push(cells[iSlug]);
  }
}
const weakHubs = hubs.filter(h => pages.has(h) && (inbound.get(h) || new Set()).size < 2);

/* ---- report ---- */
const rows = [
  ['built routes', pages.size, 'PASS'],
  ['indexable routes reached from /', `${indexable.length - orphans.length}/${indexable.length}`, orphans.length ? 'FAIL' : 'PASS'],
  ['hubs with >=2 in-content inbound', `${hubs.length - weakHubs.length}/${hubs.length}`, weakHubs.length ? 'FAIL' : 'PASS']
];
console.log('check'.padEnd(38) + 'value'.padEnd(14) + 'result');
console.log('-'.repeat(64));
for (const [n, v, r] of rows) console.log(String(n).padEnd(38) + String(v).padEnd(14) + r);
if (orphans.length) console.log('\norphans: ' + orphans.join(', '));
if (weakHubs.length) for (const h of weakHubs) console.log(`weak hub ${h}: inbound=${[...(inbound.get(h) || [])].join(', ') || 'none'}`);
console.log(`\norphans=${orphans.length} hubs_min_inbound=${hubs.length ? Math.min(...hubs.filter(h => pages.has(h)).map(h => (inbound.get(h) || new Set()).size)) : 0}`);
// contracts section-1b: every gate prints WHAT IT MEASURED, not only what
// failed - the fixed shape `checked=<n> failed=<m>` on the verdict line.
console.log(`crawl-path: checked=${pages.length} failed=${orphans.length + weakHubs.length}`);
process.exit(orphans.length || weakHubs.length ? 1 : 0);
