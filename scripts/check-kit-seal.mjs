#!/usr/bin/env node
// K-141 follow-up: the "N+ ITEMS INCLUDED" seal may never claim more items than the kit holds.
//
// RULE (buying-terms.ts): the starter-kit total and count are computed from the kit data, never typed.
// The seal renders KIT_COUNT, so today it can only drift if someone types a number into it again. This
// gate reads what buyers see: every .dc-seal in the built pages, the figure in its <b>, compared with the
// number of items in src/data/starter-kit-items.json. A figure above the item count fails the build.
// "30+" with exactly 30 items passes; "31+" with 30 items fails.
//
// Usage: node scripts/check-kit-seal.mjs [--items N]   (--items overrides the kit count, for the negative test)
import fs from 'node:fs';
import path from 'node:path';

const arg = process.argv.indexOf('--items');
const kit = JSON.parse(fs.readFileSync('src/data/starter-kit-items.json', 'utf8'));
const ITEMS = arg > -1 ? Number(process.argv[arg + 1]) : kit.items.length;

function pages(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...pages(p));
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

if (!fs.existsSync('dist')) {
  console.error('check:kit-seal FAIL: no dist/ (run the build first)');
  process.exit(1);
}
const SEAL = /<div[^>]*class="[^"]*\bdc-seal\b[^"]*"[^>]*>([\s\S]*?)<\/div>/g;
let seen = 0;
const bad = [];
for (const file of pages('dist')) {
  const html = fs.readFileSync(file, 'utf8');
  for (const m of html.matchAll(SEAL)) {
    seen += 1;
    const fig = /<b>\s*(\d+)\s*\+?\s*<\/b>/.exec(m[1]);
    if (!fig) bad.push(`${file}: seal has no numeric figure`);
    else if (Number(fig[1]) > ITEMS) bad.push(`${file}: seal claims ${fig[1]}+ items, the kit has ${ITEMS}`);
  }
}
if (bad.length) {
  console.error(`check:kit-seal FAIL (${bad.length})`);
  for (const b of bad) console.error('  ' + b);
  process.exit(1);
}
console.log(`check:kit-seal PASS: ${seen} seal(s), every figure <= ${ITEMS} kit items`);
