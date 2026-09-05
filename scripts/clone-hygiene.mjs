#!/usr/bin/env node
// clone-hygiene — when a build starts as a clone, the files that compile identically stay wrong.
// Sweeps source AND dist for sibling domains, sibling palette hexes (and their rgba() forms),
// sibling brand names, un-rewritten src/data/*.ts, and a @theme header comment that disagrees
// with the tokens. Reads the sibling lists from config/project-config.md.
// Usage: node scripts/clone-hygiene.mjs
// Exit 1 on any hit. Node built-ins only.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const cfg = existsSync('config/project-config.md') ? readFileSync('config/project-config.md', 'utf8') : '';
const list = (key) => {
  const m = cfg.match(new RegExp(`^\\s*-?\\s*${key}\\s*:\\s*(.+)$`, 'im'));
  return m ? m[1].split(/[,;]/).map((s) => s.trim()).filter(Boolean) : [];
};
const one = (key, d = '') => {
  const m = cfg.match(new RegExp(`^\\s*-?\\s*${key}\\s*:\\s*(.+)$`, 'im'));
  return m ? m[1].trim() : d;
};
// A gate that measures nothing must never report PASS. Without project-config.md every
// sibling list is empty by construction, so the sweep reported "0 hits" and exited 0 no
// matter what the tree contained. An EMPTY sibling list inside a real project is a
// legitimate answer (the build is not a clone); a MISSING config is not.
if (!cfg) {
  console.log('HALT: config/project-config.md missing - run from PROJECT_ROOT (the sibling lists come from it)');
  process.exit(1);
}
const DOMAIN = one('DOMAIN');
const SIBLING_DOMAINS = list('SIBLING_DOMAINS').filter((d) => d && d !== DOMAIN);
const SIBLING_PALETTE = list('SIBLING_PALETTE');      // e.g. #f3a5c0, #1b2a4a
const SIBLING_BRANDS = list('SIBLING_BRANDS');        // e.g. Corgi SG, Maltipoo SG

function walk(dir, filter, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e).replace(/\\/g, '/');
    if (/node_modules|\.git/.test(p)) continue;
    statSync(p).isDirectory() ? walk(p, filter, out) : (filter(p) && out.push(p));
  }
  return out;
}
const hexToRgba = (hex) => {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return `${parseInt(n.slice(0, 2), 16)}, ${parseInt(n.slice(2, 4), 16)}, ${parseInt(n.slice(4, 6), 16)}`;
};

const files = [
  ...walk('src', () => true),
  ...walk('public', (p) => /\.(txt|xml|json|webmanifest|html|svg|css)$/.test(p)),
  ...walk('dist', (p) => /\.(html|txt|xml|json|css|webmanifest)$/.test(p)),
  ...(existsSync('astro.config.mjs') ? ['astro.config.mjs'] : []),
];

const hits = [];
for (const f of files) {
  let s;
  try { s = readFileSync(f, 'utf8'); } catch { continue; }
  for (const d of SIBLING_DOMAINS) if (s.includes(d)) hits.push(`${f}: sibling domain "${d}"`);
  for (const hex of SIBLING_PALETTE) {
    if (s.toLowerCase().includes(hex.toLowerCase())) hits.push(`${f}: sibling palette "${hex}"`);
    const rgba = hexToRgba(hex);
    if (s.includes(rgba)) hits.push(`${f}: sibling palette rgba(${rgba})`);
  }
  for (const b of SIBLING_BRANDS) {
    const re = new RegExp(`\\b${b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(s) && !/compar|vs\.|versus|alternative/i.test(s.slice(Math.max(0, s.search(re) - 200), s.search(re) + 200)))
      hits.push(`${f}: sibling brand "${b}" outside comparison copy`);
  }
}

// src/data/*.ts must describe THIS site (ALWAYS-REWRITE after a clone)
for (const f of walk('src/data', (p) => /\.(ts|js|json)$/.test(p))) {
  const s = readFileSync(f, 'utf8');
  // Trigger on files that DECLARE SITE IDENTITY, not on any file that happens to contain the
  // word "site" in a comment. The old pattern matched every data module on this project - a
  // table of HDB rules, a list of currency figures - none of which has any reason to name the
  // domain, and the real clone signal (a sibling domain appearing anywhere) is checked above.
  const declaresIdentity = /\b(canonical|siteUrl|site_url|origin|baseUrl|homepage)\b/i.test(s);
  if (DOMAIN && !s.includes(DOMAIN) && declaresIdentity)
    hits.push(`${f}: no reference to ${DOMAIN} — confirm this file describes THIS site (ALWAYS-REWRITE)`);
}

// @theme header comment must match the tokens beneath it
for (const f of walk('src', (p) => p.endsWith('.css'))) {
  const s = readFileSync(f, 'utf8');
  const block = s.match(/@theme[\s\S]*?\{([\s\S]*?)\}/);
  if (!block) continue;
  const header = (s.slice(Math.max(0, s.indexOf('@theme') - 300), s.indexOf('@theme')).match(/\/\*[\s\S]*?\*\//g) || []).join(' ');
  for (const hex of (header.match(/#[0-9a-f]{3,8}/gi) || []))
    if (!block[1].toLowerCase().includes(hex.toLowerCase()))
      hits.push(`${f}: @theme header comment names ${hex} which is not in the token block`);
  // reserved Tailwind token names
  for (const bad of (block[1].match(/--color-(base|xs|sm|md|lg|xl|\d+)\b/g) || []))
    hits.push(`${f}: reserved Tailwind token name ${bad} in @theme (Critical)`);
}

// sibling-constant leak in the BUILT output specifically
for (const f of ['dist/robots.txt', 'dist/sitemap-index.xml', 'dist/sitemap-0.xml']) {
  if (!existsSync(f)) continue;
  const s = readFileSync(f, 'utf8');
  for (const d of SIBLING_DOMAINS) if (s.includes(d)) hits.push(`${f}: SIBLING-CONSTANT LEAK "${d}" (Critical)`);
}

for (const h of hits) console.log('HIT ' + h);
console.log(`clone hygiene: ${hits.length} hits (sibling domains ${SIBLING_DOMAINS.length}, palette ${SIBLING_PALETTE.length}, brands ${SIBLING_BRANDS.length})`);
// contracts section-1b: every gate prints WHAT IT MEASURED, not only what
// failed - the fixed shape `checked=<n> failed=<m>` on the verdict line.
console.log(`clone-hygiene: checked=${files.length} failed=${hits.length}`);
process.exit(hits.length ? 1 : 0);
