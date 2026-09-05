#!/usr/bin/env node
// kit:codemod-trailing-slash@1.0.0
// Adds the trailing slash to internal paths in all FOUR syntactic shapes.
// Usage: node scripts/codemod-trailing-slash.mjs --dry | --write [--dir src]
// CRLF-aware. Never validates with the pattern that produced the edit — validate on dist/.
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const write = args.includes('--write');
const dirArg = args.indexOf('--dir');
const ROOTS = dirArg === -1 ? ['src', 'public', 'functions', 'scripts'] : [args[dirArg + 1]];
const EXT = new Set(['.astro', '.ts', '.tsx', '.js', '.mjs', '.json', '.md', '.css', '.html']);
// A path segment with a dot is a file (image, xml, txt) and is left alone.
const SLASHABLE = String.raw`\/(?:[A-Za-z0-9][A-Za-z0-9\-_]*\/)*[A-Za-z0-9][A-Za-z0-9\-_]*`;

const SHAPES = [
  { name: 'attr',      re: new RegExp(String.raw`(href=")(${SLASHABLE})(")`, 'g') },
  { name: 'prop',      re: new RegExp(String.raw`(href=\{")(${SLASHABLE})("\})`, 'g') },
  { name: 'jsobject',  re: new RegExp(String.raw`(href:\s*['"])(${SLASHABLE})(['"])`, 'g') },
  { name: 'json',      re: new RegExp(String.raw`("href"\s*:\s*")(${SLASHABLE})(")`, 'g') },
];
// Reported, never auto-edited: these often address assets or APIs.
const REPORT_ONLY = [
  { name: 'path-prop', re: new RegExp(String.raw`(path:\s*['"])(${SLASHABLE})(['"])`, 'g') },
  { name: 'url-prop',  re: new RegExp(String.raw`(url:\s*['"])(${SLASHABLE})(['"])`, 'g') },
];
const SKIP_PREFIX = ['/api/', '/_astro/', '/images/', '/figures/', '/fonts/'];

function collect(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') collect(p, out); continue; }
    if (EXT.has(path.extname(e.name))) out.push(p);
  }
  return out;
}

const counts = {}; const reportOnly = []; let filesChanged = 0;
for (const file of ROOTS.flatMap((r) => collect(r))) {
  const before = fs.readFileSync(file, 'utf8');
  let after = before;
  for (const { name, re } of SHAPES) {
    after = after.replace(re, (m, a, p, b) => {
      if (SKIP_PREFIX.some((s) => p.startsWith(s))) return m;
      counts[name] = (counts[name] || 0) + 1;
      return `${a}${p}/${b}`;
    });
  }
  for (const { name, re } of REPORT_ONLY) {
    for (const m of before.matchAll(re)) {
      if (SKIP_PREFIX.some((s) => m[2].startsWith(s))) continue;
      reportOnly.push(`${name} ${file} ${m[2]}`);
    }
  }
  if (after !== before) { filesChanged++; if (write) fs.writeFileSync(file, after, 'utf8'); }
}

console.log('SHAPE     | HITS');
for (const s of [...SHAPES.map((x) => x.name)]) console.log(`${s.padEnd(9)} | ${counts[s] || 0}`);
const total = Object.values(counts).reduce((a, b) => a + b, 0);
console.log(`\nfiles_changed=${filesChanged} total_edits=${total} mode=${write ? 'WRITE' : 'DRY'}`);
if (reportOnly.length) {
  console.log('\nREPORT-ONLY (decide by hand — may be assets or API paths):');
  for (const r of reportOnly) console.log('  ' + r);
}
console.log(total === 0 ? 'PASS no slash-less internal paths in source' : 'FAIL slash-less internal paths present');
console.log('NOTE: validate on dist/ with the STEP 1a greps, never with this pattern.');
process.exit(total === 0 ? 0 : 1);
