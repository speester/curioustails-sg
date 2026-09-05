#!/usr/bin/env node
// check-tokens.mjs — the gate that would have caught the Humva break.
//
// The site-kit components are authored against a token CONTRACT (--surface-*,
// --ink-on-deep, --text-*, --space-*, --radius-*, --shadow-*, --color-*,
// --border-*). design-system.md only ever named the PALETTE, so on humva.com
// ~150 var() references resolved to nothing: the hero band was transparent and
// every H1 rendered at the 18px body size. Nothing failed. The build was clean,
// astro was happy, the browser silently dropped each declaration.
//
// CSS has no error for an undefined custom property. This script is that error.
//
//   node scripts/check-tokens.mjs          # fail on any undefined var()
//   node scripts/check-tokens.mjs --list   # print the declared contract
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');

const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(astro|css|ts|js|tsx|jsx)$/.test(e.name)) out.push(p);
  }
  return out;
};

const files = walk(SRC);
const rel = (f) => path.relative(ROOT, f).replace(/\\/g, '/');

// ── 1. Everything DECLARED, anywhere: global.css, @theme, component <style>. ──
const declared = new Set();
const declaredIn = new Map();
for (const f of files) {
  const css = fs.readFileSync(f, 'utf8');
  // A declaration is `--x:` anywhere it is NOT the inside of a var() call. That
  // deliberately includes inline `style={`--i:${i}`}` and define:vars, which set
  // the property at runtime just as validly as a stylesheet rule does.
  for (const m of css.matchAll(/(?<!var\(\s{0,4})--([a-zA-Z0-9_-]+)\s*:/g)) {
    declared.add(m[1]);
    if (!declaredIn.has(m[1])) declaredIn.set(m[1], rel(f));
  }
}

if (process.argv.includes('--list')) {
  for (const t of [...declared].sort()) console.log(`--${t}`.padEnd(28), declaredIn.get(t));
  console.log(`\ndeclared=${declared.size}`);
  process.exit(0);
}

// ── 2. Every var() REFERENCE, with the file and line it sits on. ─────────────
const refs = [];
for (const f of files) {
  const text = fs.readFileSync(f, 'utf8');
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    for (const m of line.matchAll(/var\(\s*--([a-zA-Z0-9_-]+)\s*(,)?/g)) {
      refs.push({ token: m[1], hasFallback: Boolean(m[2]), file: rel(f), line: i + 1, text: line.trim() });
    }
  });
}

// ── 3. Report. A fallback downgrades the finding to a warning: the declaration
//       is still missing, but the element does not render unstyled. ───────────
const missing = refs.filter((r) => !declared.has(r.token));
const hard = missing.filter((r) => !r.hasFallback);
const soft = missing.filter((r) => r.hasFallback);

const byToken = (list) => {
  const m = new Map();
  for (const r of list) (m.get(r.token) ?? m.set(r.token, []).get(r.token)).push(r);
  return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
};

if (soft.length) {
  console.log('WARN — undeclared but has a fallback (renders, but the token is not in the contract):');
  for (const [t, rs] of byToken(soft)) console.log(`  --${t}  x${rs.length}  ${rs[0].file}:${rs[0].line}`);
  console.log('');
}

if (hard.length) {
  console.log('FAIL — var() references a custom property that is declared NOWHERE.');
  console.log('       The declaration is dropped silently; the element renders unstyled.\n');
  for (const [t, rs] of byToken(hard)) {
    console.log(`  --${t}  (${rs.length} reference${rs.length > 1 ? 's' : ''})`);
    for (const r of rs.slice(0, 4)) console.log(`      ${r.file}:${r.line}`);
    if (rs.length > 4) console.log(`      … and ${rs.length - 4} more`);
  }
}

const uniqueHard = new Set(hard.map((r) => r.token)).size;
console.log(
  `\nrefs=${refs.length} declared=${declared.size} undeclared_tokens=${uniqueHard} undeclared_refs=${hard.length}`,
);
console.log(hard.length ? 'FAIL check-tokens' : 'PASS check-tokens');
// contracts section-1b: every gate prints WHAT IT MEASURED, not only what
// failed - the fixed shape `checked=<n> failed=<m>` on the verdict line.
console.log(`check-tokens: checked=${hard.length + (typeof soft !== "undefined" ? soft.length : 0)} failed=${hard.length}`);
process.exit(hard.length ? 1 : 0);
