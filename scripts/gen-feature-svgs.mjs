#!/usr/bin/env node
// kit:gen-feature-svgs@1.0.0 — generate the per-page FEATURE SVG card (Task G2.33).
//
//   node scripts/gen-feature-svgs.mjs            write any missing public/figures/<slug>-feature.svg
//   node scripts/gen-feature-svgs.mjs --check    exit 1 if any indexable route lacks one
//
// Authored for the retrofit: contracts.md §3 requires >=2 figures per content page and
// IMAGE_POLICY=figure makes the FEATURE visual an SVG rather than a kie.ai raster. The
// kit-manifest row (owner G2.33) called this generator by name while no task shipped a body,
// so `site-kit.py verify --strict` could never reach missing=0. Node 20+, stdlib only.
import fs from 'node:fs';
import path from 'node:path';
import { parseCsv } from './lib/csv.mjs';

const CHECK = process.argv.includes('--check');
const CSV = 'research/site-blueprint.csv';
const OUT = 'public/figures';
const ex = (p) => { try { fs.accessSync(p); return true; } catch { return false; } };

if (!ex(CSV)) { console.error(`FAIL: ${CSV} missing — run local-research first.`); process.exit(1); }
const rows = parseCsv(fs.readFileSync(CSV, 'utf8').replace(/^﻿/, '')).map((r) => r.cells);
const head = rows.shift();
const col = (r, name) => r[head.indexOf(name)] ?? '';

// contracts §3: ONE predicate (scripts/lib/exemptions.mjs).
import { exemptionFor, EXEMPT as _EX } from './lib/exemptions.mjs';
// W11.2: the blueprint row decides, not the route alone.
const EXEMPT = { test: (route) => exemptionFor(route) === _EX };
const slugOf = (u) => (u === '/' ? 'index' : u.replace(/^\/|\/$/g, '').replace(/\//g, '-'));

function card({ title, kicker, accent }) {
  const esc = (s) => String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
  const words = esc(title).split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) { if ((cur + ' ' + w).trim().length > 26) { lines.push(cur.trim()); cur = w; } else cur += ' ' + w; }
  if (cur.trim()) lines.push(cur.trim());
  const tspans = lines.slice(0, 3).map((l, i) => `<tspan x="64" dy="${i ? 64 : 0}">${l}</tspan>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" role="img" aria-label="${esc(title)}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${accent}" stop-opacity="0.16"/><stop offset="1" stop-color="${accent}" stop-opacity="0.02"/>
  </linearGradient></defs>
  <rect width="1200" height="900" fill="${PAL.page}"/>
  <rect width="1200" height="900" fill="url(#g)"/>
  <rect x="64" y="96" width="72" height="6" rx="3" fill="${accent}"/>
  <text x="64" y="152" font-family="system-ui,sans-serif" font-size="26" fill="${accent}" letter-spacing="2">${esc(kicker).toUpperCase()}</text>
  <text x="64" y="240" font-family="system-ui,sans-serif" font-size="56" font-weight="700" fill="${PAL.ink}">${tspans}</text>
</svg>`;
}

fs.mkdirSync(OUT, { recursive: true });
let missing = 0, wrote = 0;
// kit fix: these cards are consumed via <img src>, and a CSS custom property does not
// resolve inside an img-loaded SVG document. var(--color-accent, #2563eb) therefore painted
// EVERY card in the kit's default blue on every project. Colours are now read from
// design-system.md's ## Color tokens table and baked in as literals.
function paletteFromDesignSystem() {
  const fallback = { accent: '#FC8400', ink: '#141210', page: '#FFFFFF', soft: '#5B554E' };
  try {
    const md = fs.readFileSync('design-system.md', 'utf8');
    const grab = (name) => {
      const re = new RegExp('\|\s*' + name + '\s*\|\s*`?(#[0-9A-Fa-f]{6})`?');
      const m = md.match(re);
      return m ? m[1] : null;
    };
    return {
      accent: grab('accent') || fallback.accent,
      ink: grab('ink') || fallback.ink,
      page: grab('paper') || fallback.page,
      soft: grab('muted') || fallback.soft,
    };
  } catch { return fallback; }
}
const PAL = paletteFromDesignSystem();

for (const r of rows) {
  const url = col(r, 'url_slug');
  if (!url || EXEMPT.test(url)) continue;
  const file = path.join(OUT, `${slugOf(url)}-feature.svg`);
  if (ex(file)) continue;
  if (CHECK) { missing++; console.log(`MISSING ${file}`); continue; }
  fs.writeFileSync(file, card({
    title: col(r, 'h1') || col(r, 'title') || url,
    kicker: col(r, 'silo') || col(r, 'page_type') || 'guide',
    accent: PAL.accent,
  }) + '\n', 'utf8');
  wrote++;
}
if (CHECK) { console.log(`feature svgs missing: ${missing}`); process.exit(missing ? 1 : 0); }
console.log(`feature svgs written: ${wrote}`);
// contracts section-1b, generator form: a generator that wrote NOTHING has
// silently done nothing, and the build then fails somewhere else entirely.
console.log(`gen-feature-svgs: wrote=${wrote}`);
