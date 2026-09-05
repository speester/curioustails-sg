#!/usr/bin/env node
// kit:wordcount@2.0.0 — rendered, chrome-stripped word count per page vs its tier floor.
// Usage: node scripts/wordcount.mjs [<slug>|--all]
//
// COLUMNS ARE READ BY NAME from the ONE 39-column blueprint header (contracts.md §9):
//   url_slug   (the route)
//   value_tier (A|B|C|D — the word floor)
//   page_tier  (core|outer|utility|compare|monetization — the utility test)
// There is NO `path`, `slug`, `tier` or `section_class` column. Looking those up returned
// -1, `c[-1]` was undefined, every row was skipped and the function fell back to 'C', so a
// 2,200-word money page was measured against the 1,100 floor and the gate printed PASS
// (CONS2-12). Unknown or absent tiers now FAIL loudly instead of falling back.
// The blueprint is RFC-4180 with every cell quoted (secondary_keywords is |-separated
// INSIDE quotes), so it is parsed with the shared parser, never `l.split(',')` — an
// unquoted comma breaking a naive split is the curio-2.7 witness.
import fs from 'node:fs';
import path from 'node:path';
import { parseCsv } from './lib/csv.mjs';   // RFC-4180 parser — exported by Task G1.2

const arg = process.argv[2] || '--all';
const FLOORS = { A: 2200, B: 1600, C: 1100, D: 900 };
const UTILITY_FLOOR = 600;
const BP = 'research/site-blueprint.csv';

export function visibleWords(html) {
  let s = html;
  for (const tag of ['header', 'footer', 'nav', 'script', 'style', 'aside', 'form', 'template']) {
    s = s.replace(new RegExp(`<${tag}[\\s\\S]*?</${tag}>`, 'gi'), ' ');
  }
  s = s.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ')
       .replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
  return s ? s.split(' ').length : 0;
}

let ROWS = null;
function blueprint() {
  if (ROWS) return ROWS;
  if (!fs.existsSync(BP)) {
    console.error(`FAIL ${BP} not found — the word floor comes from the blueprint, never a guess`);
    process.exit(1);
  }
  const parsed = parseCsv(fs.readFileSync(BP, 'utf8').replace(/^\uFEFF/, ''));
  if (!parsed.length) { console.error(`FAIL ${BP} is empty`); process.exit(1); }
  const head = parsed[0].cells.map((h) => h.trim());
  const iSlug = head.indexOf('url_slug');
  const iValue = head.indexOf('value_tier');
  const iPage = head.indexOf('page_tier');
  for (const [name, idx] of [['url_slug', iSlug], ['value_tier', iValue], ['page_tier', iPage]]) {
    if (idx === -1) {
      console.error(`FAIL ${BP} has no "${name}" column — expected the 39-column header of contracts.md §9`);
      process.exit(1);
    }
  }
  ROWS = new Map();
  for (const r of parsed.slice(1)) {
    let p = (r.cells[iSlug] || '').trim();
    if (!p) continue;
    if (!p.startsWith('/')) p = '/' + p;
    if (!p.endsWith('/')) p += '/';
    ROWS.set(p, {
      value: (r.cells[iValue] || '').trim(),                  // A|B|C|D — NOT case-folded
      page: (r.cells[iPage] || '').trim().toLowerCase(),
    });
  }
  return ROWS;
}

// Returns { tier, floor }. floor === null means "cannot be measured": a FAIL row, never a
// silent fallback to the smallest floor.
function floorFor(route) {
  const row = blueprint().get(route);
  if (!row) return { tier: 'unlisted', floor: null };
  if (row.page === 'utility' || route === '/contact/') return { tier: 'utility', floor: UTILITY_FLOOR };
  if (!Object.prototype.hasOwnProperty.call(FLOORS, row.value)) {
    return { tier: row.value || '(empty)', floor: null };
  }
  return { tier: row.value, floor: FLOORS[row.value] };
}

function pages(dir = 'dist', out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) pages(p, out);
    else if (e.name === 'index.html') out.push(p);
  }
  return out;
}

const all = pages().map((f) => {
  const route = ('/' + path.relative('dist', f).split(path.sep).join('/').replace(/index\.html$/, '')).replace(/\/{2,}/g, '/');
  return { file: f, route: route.endsWith('/') ? route : route + '/' };
});
const targets = arg === '--all' ? all : all.filter((p) => p.route.includes(arg));
if (!targets.length) { console.error(`FAIL no built page matches ${arg}`); process.exit(1); }

let failed = 0;
const counts = { A: 0, B: 0, C: 0, D: 0, utility: 0, unresolved: 0 };
console.log('ROUTE                                             | TIER     | WORDS | FLOOR | RESULT');
for (const t of targets) {
  const words = visibleWords(fs.readFileSync(t.file, 'utf8'));
  const { tier, floor } = floorFor(t.route);
  if (floor === null) {
    failed++; counts.unresolved++;
    console.log(`${t.route.padEnd(49)} | ${String(tier).padEnd(8)} | ${String(words).padEnd(5)} | ----- | FAIL no value_tier A|B|C|D for this route in ${BP}`);
    continue;
  }
  counts[tier] += 1;
  const ok = words >= floor;
  if (!ok) failed++;
  console.log(`${t.route.padEnd(49)} | ${String(tier).padEnd(8)} | ${String(words).padEnd(5)} | ${String(floor).padEnd(5)} | ${ok ? 'PASS' : 'FAIL'}`);
}
console.log(`\nfloors: A=${counts.A} B=${counts.B} C=${counts.C} D=${counts.D} utility=${counts.utility} unresolved=${counts.unresolved}`);
console.log(`pages=${targets.length} failed=${failed}`);
console.log(failed ? 'FAIL wordcount' : 'PASS wordcount');
// contracts section-1b: every gate prints WHAT IT MEASURED, not only what
// failed - the fixed shape `checked=<n> failed=<m>` on the verdict line.
console.log(`wordcount: checked=${targets.length} failed=${failed ? 1 : 0}`);
process.exit(failed ? 1 : 0);
