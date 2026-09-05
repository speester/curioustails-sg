#!/usr/bin/env node
// fix-link-spacing.mjs - repair framework whitespace-trim around inline elements.
// Usage: node scripts/fix-link-spacing.mjs [--write]
// Applies, only BELOW the Astro frontmatter fence:
//   /(\w)(\r?\n[ \t]*)(<a\s)/g      -> $1{' '}$2$3
//   /(<\/a>)(\r?\n[ \t]*)(\w)/g     -> $1{' '}$2$3
//   (same pair for <strong> and <em>)
// Exit 0 when nothing needs fixing (or --write applied cleanly), 1 when a dry
// run found boundaries to fix. Node 20 built-ins only.
import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.env.PROJECT_ROOT || process.cwd();
const SRC = join(ROOT, 'src');
const WRITE = process.argv.includes('--write');

function walk(d, out = []) {
  if (!existsSync(d)) return out;
  for (const n of readdirSync(d)) {
    if (n === 'node_modules') continue;
    const p = join(d, n);
    statSync(p).isDirectory() ? walk(p, out) : (/\.(astro|mdx|jsx|tsx)$/.test(n) && out.push(p));
  }
  return out;
}

const PAIRS = [
  [/(\w)(\r?\n[ \t]*)(<a\s)/g, "$1{' '}$2$3"],
  [/(<\/a>)(\r?\n[ \t]*)(\w)/g, "$1{' '}$2$3"],
  [/(\w)(\r?\n[ \t]*)(<strong[\s>])/g, "$1{' '}$2$3"],
  [/(<\/strong>)(\r?\n[ \t]*)(\w)/g, "$1{' '}$2$3"],
  [/(\w)(\r?\n[ \t]*)(<em[\s>])/g, "$1{' '}$2$3"],
  [/(<\/em>)(\r?\n[ \t]*)(\w)/g, "$1{' '}$2$3"],
];

let scanned = 0, fixed = 0, files = 0;
for (const f of walk(SRC)) {
  scanned++;
  const text = readFileSync(f, 'utf8');
  // Split at the closing frontmatter fence; never touch the fence itself.
  const m = text.match(/^---\r?\n[\s\S]*?\r?\n---/);
  const head = m ? m[0] : '';
  const bodyStart = head.length;
  let body = text.slice(bodyStart);
  let n = 0;
  for (const [re, rep] of PAIRS) {
    body = body.replace(re, (...a) => { n++; return rep.replace('$1', a[1]).replace('$2', a[2]).replace('$3', a[3]); });
  }
  if (n) {
    files++; fixed += n;
    console.log(`${WRITE ? 'fixed' : 'would fix'} ${n} boundaries: ${relative(ROOT, f)}`);
    if (WRITE) writeFileSync(f, head + body, 'utf8');
  }
}
console.log(`files scanned=${scanned} boundaries ${WRITE ? 'fixed' : 'to fix'}=${fixed} in ${files} files${WRITE ? '' : ' (dry run: use --write to apply)'}`);
process.exit(!WRITE && fixed ? 1 : 0);
