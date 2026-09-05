#!/usr/bin/env node
// kit:clone-sweep@1.0.0 — find every trace of a sibling project after a clone/fork/rebrand.
// Usage: node scripts/clone-sweep.mjs --siblings "maltese.sg,bichon.sg,corgi.sg" [--names "Maltese,Bichon"]
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const get = (f, d = '') => { const i = args.indexOf(f); return i === -1 ? d : args[i + 1]; };
const siblings = get('--siblings').split(',').map((s) => s.trim()).filter(Boolean);
const names = get('--names').split(',').map((s) => s.trim()).filter(Boolean);
if (!siblings.length) { console.error('FAIL --siblings "<domain,domain>" is required'); process.exit(1); }

const DIRS = ['src', 'public', 'config', 'scripts', 'functions'];
const FILES = ['astro.config.mjs', 'package.json', 'design-system.md', 'README.md'];
const EXT = new Set(['.astro', '.ts', '.tsx', '.js', '.mjs', '.json', '.css', '.md', '.txt', '.xml', '.webmanifest', '']);

function collect(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!['node_modules', 'dist', '.git', 'fonts', 'images'].includes(e.name)) collect(p, out); continue; }
    if (EXT.has(path.extname(e.name))) out.push(p);
  }
  return out;
}
const files = [...DIRS.flatMap((d) => collect(d)), ...FILES.filter((f) => fs.existsSync(f))];

// Own tokens: every hex declared in the project's @theme / global.css.
const css = fs.existsSync('src/styles/global.css') ? fs.readFileSync('src/styles/global.css', 'utf8') : '';
const ownHex = new Set([...css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0].toLowerCase()));

const rows = []; const detail = [];
const add = (c, hits, note = '') => {
  rows.push([c, hits.length ? `FAIL (${hits.length})` : 'PASS', note]);
  for (const h of hits.slice(0, 40)) detail.push(`  [${c}] ${h}`);
  if (hits.length > 40) detail.push(`  [${c}] ...${hits.length - 40} more`);
};

const domainHits = []; const hexHits = []; const nameHits = []; const scriptLiterals = [];
for (const f of files) {
  const txt = fs.readFileSync(f, 'utf8');
  txt.split(/\r?\n/).forEach((line, i) => {
    for (const s of siblings) if (line.includes(s)) domainHits.push(`${f}:${i + 1} ${s} :: ${line.trim().slice(0, 110)}`);
    for (const n of names) if (new RegExp(`\\b${n}\\b`, 'i').test(line) && !/compar|versus|vs\./i.test(line)) nameHits.push(`${f}:${i + 1} ${n} :: ${line.trim().slice(0, 110)}`);
    for (const m of line.matchAll(/#[0-9a-fA-F]{6}\b/g)) {
      const hex = m[0].toLowerCase();
      if (!ownHex.has(hex) && !/global\.css|design-system\.md/.test(f)) hexHits.push(`${f}:${i + 1} foreign hex ${hex}`);
    }
    for (const m of line.matchAll(/rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+/g)) {
      if (/scripts[\\/]/.test(f)) scriptLiterals.push(`${f}:${i + 1} rgba literal in a script`);
    }
  });
  if (/scripts[\\/]/.test(f)) {
    for (const m of txt.matchAll(/['"]([a-z0-9-]+\.(?:sg|com|store|net|org))['"]/g)) {
      scriptLiterals.push(`${f} hard-coded domain literal: ${m[1]} (read it from src/data/site.ts)`);
    }
  }
}

add('sibling-domains', [...new Set(domainHits)]);
add('foreign-palette-hex', [...new Set(hexHits)], 'hex not declared in global.css @theme');
add('sibling-brand-names', [...new Set(nameHits)], 'outside legitimate comparison copy');
add('script-literals', [...new Set(scriptLiterals)], 'verification scripts must read site.ts');

// ALWAYS-REWRITE: every src/data/*.ts must mention this site's own domain or name.
const own = (fs.existsSync('src/data/site.ts') ? fs.readFileSync('src/data/site.ts', 'utf8') : '')
  .match(/origin\s*:\s*['"]https?:\/\/([^'"/]+)/);
const ownDomain = own ? own[1] : '';
const stale = [];
for (const f of collect('src/data')) {
  if (!f.endsWith('.ts') && !f.endsWith('.json')) continue;
  const t = fs.readFileSync(f, 'utf8');
  if (siblings.some((s) => t.includes(s))) stale.push(`${f} still references a sibling domain`);
}
add('data-files-rewritten', stale, 'src/data/*.ts read like config — ALWAYS re-read them after a clone');

// @theme header comment matches actual tokens
const headerComment = css.match(/^\s*\/\*([\s\S]{0,400}?)\*\//);
const mismatch = [];
if (headerComment) {
  for (const m of headerComment[1].matchAll(/#[0-9a-fA-F]{6}\b/g)) {
    if (!ownHex.has(m[0].toLowerCase())) mismatch.push(`global.css header comment names ${m[0]} which is not a token`);
  }
}
add('theme-header-comment', mismatch);

console.log('CHECK                 | RESULT     | NOTE');
for (const [c, r, n] of rows) console.log(`${c.padEnd(21)} | ${r.padEnd(10)} | ${n}`);
if (detail.length) { console.log('\nDETAIL:'); for (const d of detail) console.log(d); }
const failed = rows.filter((r) => r[1].startsWith('FAIL')).length;
console.log(`\nsiblings=${siblings.join(',')} own_domain=${ownDomain || 'UNKNOWN'} failed=${failed}`);
console.log(failed ? 'FAIL clone-sweep' : 'PASS clone-sweep');
// contracts section-1b: every gate prints WHAT IT MEASURED, not only what
// failed - the fixed shape `checked=<n> failed=<m>` on the verdict line.
console.log(`clone-sweep: checked=${files.length} failed=${failed ? 1 : 0}`);
process.exit(failed ? 1 : 0);
