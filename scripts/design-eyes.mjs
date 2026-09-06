#!/usr/bin/env node
// kit:design-eyes@1.0.0 — CAPTURE + DETERMINISTIC PROBE for the design-eyes skill.
//
// design-audit.mjs asks "is a divider present, is the gap right". It cannot ask
// "does this curve point the wrong way" — a flipped divider has a correct `d`, a
// correct gap and a correct data-treatment, and has shipped that way repeatedly.
// This script does not answer that question either. It produces the FRAMES in which
// a blind judge can answer it (seam crops, squint downscales, state pairs), and it
// settles everything that is computable so no vision token is ever spent on a number.
//
// Usage:
//   node scripts/design-eyes.mjs [routes...] [--all] [--cap N] [--only <route>]
//                                [--out <dir>] [--vp 1440,768,375] [--json] [--quiet]
//
// Exits 1 when it cannot measure (no playwright, no sharp, no dist, no routes) or
// when a deterministic S3 is found. A GATE THAT CANNOT MEASURE MUST NOT REPORT PASS.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';

const argv = process.argv.slice(2);
const KNOWN = ['all', 'cap', 'only', 'out', 'vp', 'json', 'quiet', 'help'];
const unknown = argv.filter((a) => a.startsWith('--') && !KNOWN.includes(a.replace(/^--/, '').split('=')[0]));
if (unknown.length) {
  // An unrecognised flag must never silently mean "run everything" — that is how a
  // typo'd group name turned into a full-site PASS on 2026-09-02.
  console.error(`FAIL unknown option(s): ${unknown.join(' ')}`);
  console.error(`     known: ${KNOWN.map((k) => '--' + k).join(' ')}`);
  process.exit(2);
}
const flag = (n, d = null) => {
  const eq = argv.find((a) => a.startsWith(`--${n}=`));
  if (eq) return eq.split('=').slice(1).join('=');
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};
const has = (n) => argv.includes(`--${n}`);

if (has('help')) {
  console.log(`design-eyes.mjs — capture + deterministic probe

  routes...        explicit routes to capture (e.g. / /services/ /blog/foo/)
  --all            capture every route in dist/ (removes the cap)
  --cap N          max routes per run (default 5)
  --only <route>   capture exactly one route (used by the fix loop)
  --out <dir>      output root (default audits/design-eyes)
  --vp a,b,c       viewport widths (default 1440,768,375)
  --json           print the probe JSON to stdout instead of the table
  --quiet          suppress the per-route capture log

Route selection with no arguments: one page per archetype from
research/site-blueprint.csv when it exists (home + one Core + one Outer + one
functional), otherwise the homepage plus the shallowest routes, capped.`);
  process.exit(0);
}

const CAP = has('all') ? Infinity : Number(flag('cap', 5));
const OUT_ROOT = flag('out', path.join('audits', 'design-eyes'));
const VPS = String(flag('vp', '1440,768,375')).split(',').map(Number).filter(Boolean);
const QUIET = has('quiet');
const SEAM_BAND = 200;      // px of each neighbour kept in a seam crop
const SQUINT = 0.25;        // the downscale at which only mass and contrast survive

const halt = (why, fix) => {
  console.error(`HALT design-eyes: ${why}`);
  if (fix) console.error(`  ${fix}`);
  process.exit(1);
};

// ---------------------------------------------------------------- dependencies
let chromium, sharp;
try { ({ chromium } = await import('playwright')); }
catch {
  halt('playwright is not resolvable from ' + import.meta.url,
    'Run the PROJECT copy (node scripts/design-eyes.mjs) so playwright resolves from the project. A text-only pass is not this gate.');
}
try { sharp = (await import('sharp')).default; }
catch {
  halt('sharp is not resolvable — the squint downscale and the accent histogram cannot be produced',
    'npm i sharp, then re-run. Reporting findings without the squint frame would be a different gate.');
}
if (!fs.existsSync('dist')) halt('dist/ does not exist', 'npm run build first — this gate reads the built site, not the source.');

// ---------------------------------------------------------------- route pick
function allRoutes() {
  const out = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === 'index.html') {
        const r = '/' + path.relative('dist', dir).split(path.sep).filter(Boolean).join('/');
        out.push(r === '/' ? '/' : r + '/');
      }
    }
  })('dist');
  return out.sort();
}

function blueprintTiers() {
  // route -> page_tier, when the blueprint is present. Lets the default run cover one
  // page per archetype rather than five near-identical blog posts.
  const f = path.join('research', 'site-blueprint.csv');
  if (!fs.existsSync(f)) return {};
  const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/).filter(Boolean);
  const head = lines[0].split(',').map((s) => s.trim().replace(/^"|"$/g, ''));
  const iSlug = head.findIndex((h) => /^(slug|url|route|path)$/i.test(h));
  const iTier = head.findIndex((h) => /page_tier|tier/i.test(h));
  if (iSlug < 0 || iTier < 0) return {};
  const map = {};
  for (const l of lines.slice(1)) {
    const c = l.match(/("([^"]*)"|[^,]*)(,|$)/g)?.map((s) => s.replace(/,$/, '').replace(/^"|"$/g, '').trim()) ?? [];
    let slug = c[iSlug] || '';
    if (!slug) continue;
    if (!slug.startsWith('/')) slug = '/' + slug;
    if (!slug.endsWith('/')) slug += '/';
    map[slug] = (c[iTier] || '').toLowerCase();
  }
  return map;
}

function pickRoutes(available) {
  const explicit = argv.filter((a) => !a.startsWith('--') && a.startsWith('/'));
  const only = flag('only');
  if (only) return available.includes(only) ? [only] : halt(`--only ${only} is not in dist/`, 'Check the trailing slash; this project is trailing-slash canonical.');
  if (explicit.length) {
    const missing = explicit.filter((r) => !available.includes(r));
    if (missing.length) halt(`route(s) not built: ${missing.join(' ')}`, 'Build first, or check the trailing slash.');
    return explicit.slice(0, CAP);
  }
  if (has('all')) return available;

  const tiers = blueprintTiers();
  const picked = [];
  const take = (r) => { if (r && !picked.includes(r) && available.includes(r)) picked.push(r); };
  take('/');
  // One representative per tier, deepest-first inside a tier so a real page is picked
  // over an index that shares the homepage's layout.
  for (const want of ['core', 'money', 'service', 'item', 'outer', 'blog', 'informational', 'functional']) {
    const hit = Object.keys(tiers).filter((r) => tiers[r].includes(want)).sort((a, b) => b.length - a.length)[0];
    take(hit);
    if (picked.length >= CAP) break;
  }
  for (const r of available) { if (picked.length >= CAP) break; take(r); }
  return picked.slice(0, CAP);
}

// ---------------------------------------------------------------- ground truth
function designSystemNumbers() {
  const g = {};
  const tokens = ['src/styles/tokens.css', 'src/styles/global.css'].find((f) => fs.existsSync(f));
  if (tokens) {
    const css = fs.readFileSync(tokens, 'utf8');
    const grab = (n) => (css.match(new RegExp(`--${n}\\s*:\\s*([^;]+);`)) || [])[1]?.trim() ?? null;
    g.accent = grab('accent');
    g.font_display = grab('font-display');
    g.font_body = grab('font-body');
    g.radius_card = grab('radius-card') ?? grab('radius-lg');
    g.radius_btn = grab('radius-btn') ?? grab('radius-sm');
  }
  const ds = 'design-system.md';
  if (fs.existsSync(ds)) {
    const md = fs.readFileSync(ds, 'utf8');
    g.elevation_carrier = (md.match(/elevation[^\n]*?:\s*(shadow|border|bg-step|background-step)/i) || [])[1] ?? null;
    g.motion_kit = (md.match(/^##\s*Motion kit\s*\n+([^\n]+)/mi) || [])[1] ?? null;
    g.section_padding_multiple = Number((md.match(/section padding[^\n]*?([\d.]+)\s*x/i) || [])[1]) || null;
  }
  return g;
}

// ---------------------------------------------------------------- static server
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.avif': 'image/avif', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml', '.txt': 'text/plain' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  let file = path.join('dist', p);
  if (p.endsWith('/')) file = path.join(file, 'index.html');
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('404'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' });
  res.end(fs.readFileSync(file));
});
// Ephemeral port: a fixed one races its own previous close when the loop re-runs.
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const ORIGIN = 'http://127.0.0.1:' + server.address().port;

// ---------------------------------------------------------------- in-page probe
// Everything below runs in the browser. It is the whole "math before vision" half:
// any code it can decide is never put to a judge.
const IN_PAGE = String(function inPage(GT) {
  const out = { findings: [], facts: {}, sections: [], seams: [] };
  const add = (code, severity, evidence, what_to_change, extra = {}) =>
    out.findings.push({ code, severity, evidence, what_to_change, source: 'probe', ...extra });
  const px = (v) => Math.round(parseFloat(v) || 0);
  const vw = window.innerWidth;

  // COLOURS MUST BE RESOLVED, NOT REGEXED. getComputedStyle returns a literal
  // oklch() for a value that came from a custom property; reading its three numbers
  // as r,g,b turned a near-white ground into black and invented contrast failures.
  const oklchToRgb = (L, C, H) => {
    const h = (H * Math.PI) / 180, a = C * Math.cos(h), b2 = C * Math.sin(h);
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b2;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b2;
    const s_ = L - 0.0894841775 * a - 1.2914855480 * b2;
    const l = l_ ** 3, m = m_ ** 3, sX = s_ ** 3;
    const lin = [
      +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * sX,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * sX,
      -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * sX,
    ];
    return lin.map((v) => Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055)));
  };
  const rgb = (s) => {
    const str = String(s || '').trim();
    if (!str || str === 'none' || str === 'transparent') return [0, 0, 0, 0];
    let m = str.match(/^rgba?\(([^)]+)\)/);
    if (m) { const n = m[1].split(/[\s,\/]+/).filter(Boolean).map(Number); return [n[0], n[1], n[2], n[3] === undefined ? 1 : n[3]]; }
    m = str.match(/^oklch\(([^)]+)\)/);
    if (m) {
      const parts = m[1].split(/[\s,\/]+/).filter(Boolean);
      const L = parts[0].endsWith('%') ? parseFloat(parts[0]) / 100 : parseFloat(parts[0]);
      const c = [...oklchToRgb(L, parseFloat(parts[1]) || 0, parseFloat(parts[2]) || 0)];
      c.push(parts[3] === undefined ? 1 : parseFloat(parts[3]));
      return c;
    }
    m = str.match(/^color\(\s*srgb\s+([^)]+)\)/);
    if (m) { const n = m[1].split(/[\s,\/]+/).filter(Boolean).map(Number); return [Math.round(n[0] * 255), Math.round(n[1] * 255), Math.round(n[2] * 255), n[3] === undefined ? 1 : n[3]]; }
    m = str.match(/^#([0-9a-f]{3,8})$/i);
    if (m) { let h = m[1]; if (h.length === 3) h = h.split('').map((x) => x + x).join(''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1]; }
    m = str.match(/^oklab\(([^)]+)\)/);
    if (m) {
      const q = m[1].split(/[\s,\/]+/).filter(Boolean).map((x) => (x.endsWith('%') ? parseFloat(x) / 100 : parseFloat(x)));
      const C = Math.hypot(q[1], q[2]), H = (Math.atan2(q[2], q[1]) * 180) / Math.PI;
      const c = [...oklchToRgb(q[0], C, H)]; c.push(q[3] === undefined ? 1 : q[3]); return c;
    }
    // A LAST-RESORT NUMBER SCRAPE MUST NOT GUESS. Reading the three numbers out of an
    // unrecognised colour function turned oklab(0.18 0.002 0.005) into rgb(0,0,0) and
    // reported a legible heading as a 1.12:1 contrast failure. Unknown means unknown.
    const n = str.match(/-?[\d.]+/g);
    if (!n || n.length < 3) return null;
    const v = n.slice(0, 3).map(Number);
    return v.every((x) => x >= 0 && x <= 255 && (x > 1 || Number.isInteger(x))) ? [...v, 1] : null;
  };
  const lum = (c) => { const f = c.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2]; };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  const bgOf = (el) => { for (let n = el; n && n !== document.documentElement; n = n.parentElement) { const c = rgb(getComputedStyle(n).backgroundColor); if (c && c[3] > 0.5) return c; } return [255, 255, 255]; };
  const hasImageBg = (el) => { for (let n = el; n && n !== document.documentElement; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.backgroundImage && cs.backgroundImage !== 'none') return true; } return false; };

  // ---- sections and seams
  const main = document.querySelector('main') || document.body;
  // A SEAM IS A BOUNDARY, NOT A DIV EDGE. Taking every direct child of <main> found 34
  // "sections" on a 12-section page and 33 "seams" that no visitor would call a seam.
  // Prefer real <section>/<article> landmarks; fall back to block children only when a
  // page has none, and never treat a sub-80px sliver as a section.
  let secs = Array.from(main.querySelectorAll(':scope > section, :scope > article, :scope > header'));
  if (secs.length < 2) secs = Array.from(document.querySelectorAll('main section, body > section'));
  if (secs.length < 2) secs = Array.from(main.children);
  secs = secs.filter((el) => el.getBoundingClientRect().height > 120);
  const scrollTopAbs = window.scrollY;
  secs.forEach((el, i) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const media = el.querySelectorAll('img, svg, picture, video, canvas, [class*="icon"]').length;
    const plates = el.querySelectorAll('[class*="card"], [class*="panel"], [class*="plate"], figure, blockquote, table, ul, ol, form').length;
    out.sections.push({
      i, top: Math.round(r.top + scrollTopAbs), height: Math.round(r.height),
      tone: el.dataset.tone ?? null, treatment: el.dataset.treatment ?? null,
      bg: getComputedStyle(el).backgroundColor, pad_top: px(cs.paddingTop), pad_bottom: px(cs.paddingBottom),
      media, plates, headings: el.querySelectorAll('h2,h3').length,
      words: (el.innerText || '').trim().split(/\s+/).length,
      id: el.id || el.className.split(/\s+/)[0] || el.tagName.toLowerCase(),
    });
  });

  const dividers = Array.from(document.querySelectorAll('.section-divider, [data-divider], [class*="divider"]'));
  const bandBg = (el) => { const c = bgOf(el); return c.slice(0, 3).join(','); };
  for (let i = 0; i < secs.length - 1; i++) {
    const a = secs[i], b = secs[i + 1];
    const hasDiv = !!(a.querySelector('.section-divider, [data-divider]') || b.querySelector('.section-divider, [data-divider]'));
    // Two stacked sections on one continuous ground with no divider are ONE visual
    // band. Cropping and judging that non-boundary is how 33 seams appeared on a page
    // with 12 real ones, and every one of them was a question with no answer.
    if (!hasDiv && bandBg(a) === bandBg(b)) continue;
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    const boundary = Math.round((ra.bottom + rb.top) / 2 + scrollTopAbs);
    const d = dividers.find((x) => { const r = x.getBoundingClientRect(); return r.top + scrollTopAbs >= ra.top + scrollTopAbs && r.bottom + scrollTopAbs <= rb.bottom + scrollTopAbs && Math.abs((r.top + r.bottom) / 2 + scrollTopAbs - boundary) < Math.max(ra.height, rb.height) / 2; })
      ?? a.querySelector('.section-divider, [data-divider]') ?? b.querySelector('.section-divider, [data-divider]');
    const shape = d ? (d.dataset.variant ?? d.dataset.shape ?? (d.querySelector('path')?.getAttribute('d') || '').slice(0, 24)) : null;
    const fill = d ? (getComputedStyle(d.querySelector('path, svg') ?? d).fill || getComputedStyle(d).backgroundColor) : null;
    const seam = {
      i, boundary, above: i, below: i + 1, has_divider: !!d, shape, fill,
      bg_above: getComputedStyle(a).backgroundColor, bg_below: getComputedStyle(b).backgroundColor,
      divider_h: d ? Math.round(d.getBoundingClientRect().height) : 0,
      border_top: px(getComputedStyle(b).borderTopWidth),
    };
    out.seams.push(seam);

    const sameBg = bandBg(a) === bandBg(b);
    const ba2 = bgOf(a), bb2 = bgOf(b);
    const bgDelta = Math.abs(ba2[0] - bb2[0]) + Math.abs(ba2[1] - bb2[1]) + Math.abs(ba2[2] - bb2[2]);
    // Two near-whites 1 unit apart are one ground, not a missing transition.
    if (!d && !sameBg && bgDelta > 24) add('seam.missing', 2, `boundary ${i} at y=${boundary}: rgb(${bandBg(a)}) meets rgb(${bandBg(b)}) with no transition element`, `Insert a section divider at boundary ${i}, carrying the colour of the section below.`, { seam: i });
    if (d && seam.border_top > 0) add('seam.doubled', 2, `boundary ${i} at y=${boundary}: a divider and a ${seam.border_top}px border-top on the section below`, `Remove the border-top on section ${i + 1}; the divider is already the transition.`, { seam: i });
    // seam.color_mismatch is deliberately NOT decided here. getComputedStyle on the
    // wrapper returns the initial black for any path painted via currentColor or a
    // utility class, which reported 162 false ship-blockers on a correct site. The
    // fill is recorded as a FACT for the Seam Inspector, which reads the actual pixels.

    if (d && vw <= 480 && seam.divider_h > 0 && seam.divider_h < 8) add('seam.scale_break', 3, `boundary ${i} at ${vw}px: divider renders ${seam.divider_h}px tall`, `Give the divider a viewport-relative height so it survives 375px.`, { seam: i });
  }
  const shapes = out.seams.map((s) => s.shape ?? '-');
  for (let i = 0; i + 2 < shapes.length; i++) {
    if (shapes[i] !== '-' && shapes[i] === shapes[i + 1] && shapes[i] === shapes[i + 2]) {
      add('seam.repetition', 2, `seams ${i}, ${i + 1} and ${i + 2} all use variant "${shapes[i]}"`, `Vary the separator shape: no more than two consecutive seams may share a variant.`, { seam: i });
      break;
    }
  }

  // ---- section rhythm and alternation
  const pads = out.sections.map((s) => s.pad_top);
  if (pads.length >= 4 && new Set(pads).size === 1) add('section.rhythm_flat', 2, `all ${pads.length} sections use ${pads[0]}px top padding`, `Vary section padding so the page has a breathing pattern instead of one interval.`);
  const tones = out.sections.map((s) => s.bg);
  if (tones.length >= 5) {
    let alt = 0; for (let i = 1; i < tones.length; i++) if (tones[i] !== tones[i - 1]) alt++;
    const firstHalf = tones.slice(0, Math.ceil(tones.length / 2));
    const uniqFirst = new Set(firstHalf).size, uniqSecond = new Set(tones.slice(Math.ceil(tones.length / 2))).size;
    if (uniqFirst > 1 && uniqSecond === 1) add('section.bg_alternation_broken', 2, `backgrounds alternate across the first ${firstHalf.length} sections then hold one colour for the rest`, `Carry the background alternation through to the last section.`);
  }

  // ---- layout integrity
  if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) {
    let worst = null;
    for (const el of document.querySelectorAll('body *')) { const r = el.getBoundingClientRect(); if (r.right > vw + 1 && (!worst || r.right > worst.r)) worst = { r: Math.round(r.right), el: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(/\s+/)[0] : '') }; }
    add('resp.h_overflow', 3, `page scrolls sideways at ${vw}px (scrollWidth ${document.documentElement.scrollWidth})${worst ? `; widest element ${worst.el} reaches x=${worst.r}` : ''}`, `Constrain ${worst ? worst.el : 'the overflowing element'} to the container width at ${vw}px.`);
  }
  if (vw <= 480) {
    const small = [];
    for (const el of document.querySelectorAll('a, button, [role="button"], input, select, summary')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (Math.min(r.width, r.height) < 44) small.push(`${el.tagName.toLowerCase()}"${(el.textContent || '').trim().slice(0, 24)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    if (small.length) add('resp.tap_target_small', 3, `${small.length} target(s) under 44px at 375: ${small.slice(0, 4).join('; ')}`, `Raise every interactive target to at least 44px in its smallest dimension at 375.`);
  }
  for (const t of document.querySelectorAll('table')) {
    const host = t.parentElement;
    if (!host) continue;
    if (t.scrollWidth > host.clientWidth + 2 && !/auto|scroll/.test(getComputedStyle(host).overflowX)) add('resp.table_blowout', 3, `a table ${t.scrollWidth}px wide sits in a ${host.clientWidth}px container with no horizontal scroller`, `Wrap the table in a container with overflow-x: auto.`);
  }

  // ---- type
  const bodyEls = Array.from(document.querySelectorAll('main p, main li')).filter((e) => (e.innerText || '').trim().length > 40);
  const sizes = new Set(), weights = { h: new Set(), b: new Set() };
  for (const e of document.querySelectorAll('main h1, main h2, main h3, main p, main li, main a, main button')) {
    const cs = getComputedStyle(e); sizes.add(px(cs.fontSize));
    (/^H[1-3]$/.test(e.tagName) ? weights.h : weights.b).add(Number(cs.fontWeight));
  }
  if (sizes.size > 6) add('type.scale_sprawl', 2, `${sizes.size} distinct font sizes rendered: ${[...sizes].sort((a, b) => a - b).join(', ')}px`, `Collapse the page onto at most 6 sizes from the type scale.`);
  const hMax = Math.max(...weights.h, 0), bMin = Math.min(...weights.b, 999);
  if (hMax && bMin < 999 && hMax - bMin < 100) add('type.no_contrast', 2, `heading weight ${hMax} against body weight ${bMin}`, `Open the weight gap between headings and body to at least 200.`);
  // MEASURE IS CHARACTERS PER RENDERED LINE, not a width divided by a guessed glyph
  // width — the guess reported 208ch for a block that wraps at 74. Count the lines the
  // browser actually drew.
  for (const e of bodyEls.slice(0, 40)) {
    const cs = getComputedStyle(e);
    const lh = parseFloat(cs.lineHeight) || px(cs.fontSize) * 1.5;
    const lines = Math.max(1, Math.round(e.getBoundingClientRect().height / lh));
    const ch = (e.innerText || '').trim().length / lines;
    if (ch > 85) { add('type.measure_long', 2, `a body block averages ${Math.round(ch)} characters per rendered line across ${lines} line(s)`, `Cap the body measure at 75ch.`); break; }
  }
  for (const e of bodyEls.slice(0, 20)) {
    const cs = getComputedStyle(e);
    const lh = parseFloat(cs.lineHeight) / px(cs.fontSize);
    if (lh && lh < 1.4) { add('type.leading_tight_body', 2, `body line-height computes to ${lh.toFixed(2)}`, `Raise body line-height to at least 1.5.`); break; }
    if (cs.textTransform === 'uppercase' && (e.innerText || '').length > 90) { add('type.all_caps_paragraph', 2, `a body block of ${(e.innerText || '').length} characters is set uppercase`, `Set body copy in sentence case; reserve uppercase for short labels.`); break; }
  }
  if (GT.font_display) {
    const want = GT.font_display.split(',')[0].replace(/["']/g, '').trim();
    const h1 = document.querySelector('h1, h2');
    if (h1 && want && !getComputedStyle(h1).fontFamily.toLowerCase().includes(want.toLowerCase())) add('type.font_fallback_visible', 3, `headings render as ${getComputedStyle(h1).fontFamily} but the token names ${want}`, `Fix the webfont load so ${want} actually renders.`);
  }

  // ---- radius, elevation, colour
  const radii = new Set(), shadows = new Set(); let borderCards = 0, shadowCards = 0, stepCards = 0;
  const cards = Array.from(document.querySelectorAll('main [class*="card"], main article, main figure, main .panel, main form'));
  for (const e of cards) {
    const cs = getComputedStyle(e);
    radii.add(px(cs.borderTopLeftRadius));
    if (cs.boxShadow && cs.boxShadow !== 'none') { shadows.add(cs.boxShadow); shadowCards++; }
    if (px(cs.borderTopWidth) > 0) borderCards++;
    const pb = bgOf(e.parentElement || document.body), sb = rgb(cs.backgroundColor);
    if (sb && sb[3] > 0.5 && Math.abs(lum(sb) - lum(pb)) > 0.01) stepCards++;
  }
  if (radii.size > 3) add('radius.sprawl', 2, `${radii.size} distinct card radii rendered: ${[...radii].sort((a, b) => a - b).join(', ')}px`, `Reduce to at most three radii from the token scale.`);
  const carriers = [shadowCards && 'shadow', borderCards && 'border', stepCards && 'bg-step'].filter(Boolean);
  if (cards.length >= 3 && carriers.length >= 3) add('elev.language_mixed', 2, `depth is carried by ${carriers.join(' + ')} at once across ${cards.length} panels`, `Pick ONE elevation carrier${GT.elevation_carrier ? ` (the design system names ${GT.elevation_carrier})` : ''} and remove the other two.`);

  const ownsText = (e) => Array.from(e.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim().length > 3);
  const visible = (e) => {
    if (e.closest('[aria-hidden="true"], [hidden]')) return false;
    const cs = getComputedStyle(e);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.1) return false;
    const r = e.getBoundingClientRect();
    return r.height > 4 && r.width > 4;
  };
  const textEls = Array.from(document.querySelectorAll('main p, main li, main h1, main h2, main h3, main a, main button, main span'))
    .filter((e) => (e.textContent || '').trim().length > 3 && ownsText(e) && visible(e));
  const seenPair = new Set();
  for (const e of textEls.slice(0, 400)) {
    const cs = getComputedStyle(e);
    const fg = rgb(cs.color); if (!fg) continue;
    if (hasImageBg(e)) {
      const has_scrim = !!e.closest('[class*="scrim"], [class*="overlay"], [class*="plate"]') || /gradient/.test(getComputedStyle(e.parentElement || e).backgroundImage || '');
      if (!has_scrim) { if (!seenPair.has('scrim')) { seenPair.add('scrim'); add('color.text_on_image_no_scrim', 3, `text "${(e.textContent || '').trim().slice(0, 40)}" sits on a background image with no scrim, overlay or plate`, `Add a gradient scrim or a solid plate behind text that sits on photography.`); } }
      continue;
    }
    const bg = bgOf(e);
    const size = px(cs.fontSize), bold = Number(cs.fontWeight) >= 700;
    const need = (size >= 24 || (size >= 18.66 && bold)) ? 3 : 4.5;
    const r = ratio(fg, bg);
    const key = cs.color + '|' + bg.join(',');
    if (r < need && !seenPair.has(key)) {
      seenPair.add(key);
      add('color.contrast_fail', 3, `${cs.color} on rgb(${bg.slice(0, 3).join(',')}) computes ${r.toFixed(2)}:1, below ${need}:1 — "${(e.textContent || '').trim().slice(0, 40)}"`, `Darken the foreground or lighten the ground until this pair clears ${need}:1.`);
    }
  }

  // ---- imagery
  const srcs = {};
  for (const img of document.querySelectorAll('img')) {
    const r = img.getBoundingClientRect();
    if (r.width < 16 || r.height < 16) continue;
    const nat = img.naturalWidth / (img.naturalHeight || 1), ren = r.width / r.height;
    if (img.naturalWidth && Math.abs(nat - ren) / nat > 0.02 && getComputedStyle(img).objectFit === 'fill') add('img.stretched', 3, `${img.currentSrc.split('/').pop()} renders at ${ren.toFixed(2)} against a natural ratio of ${nat.toFixed(2)}`, `Set object-fit: cover or correct the rendered box so the aspect is preserved.`);
    if (/placehold|placeholder|lorem|via\.placeholder|dummyimage/i.test(img.currentSrc || img.src)) add('img.placeholder_shipped', 3, `${(img.currentSrc || img.src).slice(-60)} is a placeholder host`, `Replace the placeholder with the real asset.`);
    // A repeated icon, avatar or logo is not a duplicate-image defect; a repeated
    // CONTENT image is. 21 of these on a correct site were all 32px icons.
    if (r.width >= 200 && r.height >= 150 && !img.closest('header, footer, nav')) {
      const key = (img.currentSrc || img.src).split('?')[0];
      srcs[key] = (srcs[key] || 0) + 1;
    }
  }
  for (const [k, n] of Object.entries(srcs)) if (n > 1) add('img.duplicate', 2, `${k.split('/').pop()} appears ${n} times on this page`, `Use a distinct image for each slot, or drop the repeat.`);

  // ---- motion and state
  const anims = new Set();
  let stuck = 0, farthest = 0, easeInEntrance = 0, sectionEntrances = 0;
  for (const el of document.querySelectorAll('main *')) {
    const cs = getComputedStyle(el);
    if (cs.animationName && cs.animationName !== 'none') cs.animationName.split(',').forEach((n) => anims.add(n.trim()));
    if (cs.transitionProperty && cs.transitionProperty !== 'none' && cs.transitionProperty !== 'all') anims.add('t:' + cs.transitionProperty.split(',')[0].trim());
    const r = el.getBoundingClientRect();
    if (r.height > 4 && Number(cs.opacity) < 0.05) stuck++;
    const ambient = cs.animationIterationCount === 'infinite' || el.closest('[aria-hidden="true"], [class*="marquee"], [class*="ticker"]');
    const animatesTransform = !ambient && ((cs.transitionProperty || '').includes('transform') || (cs.animationName && cs.animationName !== 'none'));
    const m = animatesTransform && cs.transform && cs.transform !== 'none' ? cs.transform.match(/matrix\(([^)]+)\)/) : null;
    if (m) { const p = m[1].split(',').map(Number); farthest = Math.max(farthest, Math.abs(p[4] || 0), Math.abs(p[5] || 0)); }
    if (/ease-in$|cubic-bezier\(0\.4,\s*0,\s*1/.test(cs.transitionTimingFunction) && /opacity|transform/.test(cs.transitionProperty)) easeInEntrance++;
    if (el.dataset.reveal !== undefined || /reveal|fade-?in|animate-in/.test(String(el.className))) { if (el.parentElement === main) sectionEntrances++; }
  }
  out.facts.animation_kinds = [...anims].slice(0, 12);
  if (stuck) add('motion.reveal_stuck', 3, `${stuck} element(s) remain below 0.05 opacity after the scroll settled — content the visitor never sees`, `Fire the reveal for every element, or remove the initial opacity when the observer does not cover it.`);
  if (anims.size < 3) add('motion.absent', 2, `only ${anims.size} kind(s) of animation on the page: ${[...anims].join(', ') || 'none'}`, `Bring the page to at least three distinct kinds of motion from the motion kit.`);
  if (farthest > 24) add('motion.distance_excessive', 2, `an entrance is offset ${Math.round(farthest)}px from its resting position`, `Cap entrance travel at 24px; beyond that it reads as a slide deck.`);
  if (easeInEntrance) add('motion.easing_wrong', 2, `${easeInEntrance} element(s) use an ease-in curve on an opacity/transform entrance`, `Entrances arrive: use ease-out. Reserve ease-in for exits.`);
  if (sectionEntrances && sectionEntrances >= out.sections.length - 1 && out.sections.length >= 4) add('motion.every_section', 2, `${sectionEntrances} of ${out.sections.length} top-level sections carry a whole-section entrance`, `Animate alternating sections only; back-to-back section entrances read noisy, not premium.`);
  if (vw >= 1024) {
    const hero = secs[0];
    if (hero && !hero.querySelector('[data-tilt]')) add('motion.tilt_missing', 2, `the hero on this page has no cursor-tracking tilt panel`, `Add a data-tilt panel to the hero, per the premium build standard.`);
  }
  const focusables = document.querySelectorAll('a[href], button');
  if (focusables.length) {
    const e = focusables[0], cs = getComputedStyle(e, ':focus-visible');
    if ((cs.outlineStyle === 'none' || px(cs.outlineWidth) === 0) && !/inset/.test(cs.boxShadow || '')) out.facts.focus_probe = 'inconclusive-static';
  }

  // ---- chrome
  const footerLinks = document.querySelectorAll('footer a').length;
  if (footerLinks > 10) add('chrome.footer_bloat', 1, `${footerLinks} links in the footer`, `Trim the footer to 10 links or fewer.`);
  const navLinks = document.querySelectorAll('header nav a').length;
  out.facts.nav_links = navLinks; out.facts.footer_links = footerLinks;

  // ---- CTA fold position
  const cta = document.querySelector('main a[class*="btn"], main a[class*="cta"], main button[type="submit"], main a[href^="tel:"], main a[href*="wa.me"]');
  if (cta) {
    const r = cta.getBoundingClientRect();
    out.facts.cta_top = Math.round(r.top + scrollTopAbs);
    out.facts.fold = window.innerHeight;
  }

  // ---- proximity: the gap inside a group must be smaller than the gap around it
  for (const g of Array.from(document.querySelectorAll('main figure, main .card, main li')).slice(0, 60)) {
    const kids = Array.from(g.children).filter((k) => k.getBoundingClientRect().height > 0);
    if (kids.length < 2) continue;
    let inner = 0;
    for (let i = 1; i < kids.length; i++) inner = Math.max(inner, kids[i].getBoundingClientRect().top - kids[i - 1].getBoundingClientRect().bottom);
    const next = g.nextElementSibling;
    if (!next) continue;
    const outer = next.getBoundingClientRect().top - g.getBoundingClientRect().bottom;
    if (inner > 0 && outer > 0 && inner >= outer) {
      add('space.proximity_broken', 3, `a group leaves ${Math.round(inner)}px between its own parts and ${Math.round(outer)}px to the next block — its parts read as unrelated`, `Tighten the gap inside the group below the gap around it.`);
      break;
    }
  }

  // ---- grid gutters
  for (const g of document.querySelectorAll('main [class*="grid"]')) {
    const cs = getComputedStyle(g);
    if (cs.display !== 'grid') continue;
    if (px(cs.columnGap) && px(cs.rowGap) && Math.abs(px(cs.columnGap) - px(cs.rowGap)) > 8 && px(cs.columnGap) < px(cs.rowGap) / 2) {
      add('grid.uneven_gutters', 2, `a grid uses a ${px(cs.columnGap)}px column gap against a ${px(cs.rowGap)}px row gap`, `Bring the grid gaps onto one spacing step unless the asymmetry is deliberate.`);
      break;
    }
  }
  return out;
}).replace(/^function inPage\(GT\) \{|\}$/g, '');

// ---------------------------------------------------------------- capture
const RUN = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const RUN_DIR = path.join(OUT_ROOT, RUN);
const SHOT_DIR = path.join(RUN_DIR, 'shots');
fs.mkdirSync(SHOT_DIR, { recursive: true });

const available = allRoutes();
if (!available.length) halt('dist/ contains no index.html', 'Build the site first.');
const routes = pickRoutes(available);
if (!routes.length) halt('no routes selected', 'Pass routes explicitly or check research/site-blueprint.csv.');

const GT = designSystemNumbers();
const browser = await chromium.launch();
const manifest = { run: RUN, generated: new Date().toISOString(), ground_truth: GT, viewports: VPS, routes: [] };
const probe = { run: RUN, findings: [], facts: {} };

const slugOf = (r) => (r === '/' ? 'home' : r.replace(/^\/|\/$/g, '').replace(/\//g, '__'));

for (const route of routes) {
  const slug = slugOf(route);
  const dir = path.join(SHOT_DIR, slug);
  fs.mkdirSync(dir, { recursive: true });
  const entry = { route, slug, shots: [], sections: [], seams: [], viewports: {} };

  for (const width of VPS) {
    const height = width >= 1024 ? 900 : width >= 700 ? 1024 : 812;
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: width < 700, hasTouch: width < 700 });
    const page = await ctx.newPage();
    try {
      await page.goto(ORIGIN + route, { waitUntil: 'load' });
      // Settle: scroll the whole page so every intersection observer has fired, then
      // return to the top. A reveal audited before the scroll is an audit of nothing.
      const preShot = path.join(dir, `${width}-prescroll.png`);
      await page.waitForTimeout(400);
      await page.screenshot({ path: preShot });
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight * 0.8) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); }
        window.scrollTo(0, 0); await new Promise((r) => setTimeout(r, 400));
      });
      await page.waitForTimeout(500);

      const full = path.join(dir, `${width}-full.png`);
      await page.screenshot({ path: full, fullPage: true });
      const squint = path.join(dir, `${width}-squint.png`);
      const meta = await sharp(full).metadata();
      await sharp(full).resize(Math.max(1, Math.round(meta.width * SQUINT))).toFile(squint);
      entry.shots.push(`${slug}/${width}-full.png`, `${slug}/${width}-squint.png`, `${slug}/${width}-prescroll.png`);

      const data = await page.evaluate(new Function('GT', IN_PAGE), GT);
      entry.viewports[width] = { sections: data.sections, seams: data.seams, facts: data.facts };
      if (width === Math.max(...VPS)) { entry.sections = data.sections; entry.seams = data.seams; }
      for (const f of data.findings) probe.findings.push({ ...f, route, viewport: width });

      // Per-section crops and, between every adjacent pair, the SEAM band — the frame
      // in which a flipped divider is visible and a full-page shot is not.
      const pageH = meta.height;
      for (const s of data.sections) {
        const top = Math.max(0, s.top), h = Math.min(s.height, pageH - top);
        if (h < 40) continue;
        const p = path.join(dir, `${width}-sec-${s.i}.png`);
        await sharp(full).extract({ left: 0, top: Math.round(top), width: meta.width, height: Math.round(h) }).toFile(p);
        entry.shots.push(`${slug}/${width}-sec-${s.i}.png`);
      }
      for (const sm of data.seams) {
        const top = Math.max(0, sm.boundary - SEAM_BAND);
        const h = Math.min(SEAM_BAND * 2, pageH - top);
        if (h < 40) continue;
        const p = path.join(dir, `${width}-seam-${sm.i}.png`);
        await sharp(full).extract({ left: 0, top: Math.round(top), width: meta.width, height: Math.round(h) }).toFile(p);
        entry.shots.push(`${slug}/${width}-seam-${sm.i}.png`);
      }

      // State pairs, desktop only — the diff IS the finding, so both frames or neither.
      if (width === Math.max(...VPS)) {
        const cta = await page.$('main a[class*="btn"], main a[class*="cta"], main button[type="submit"]');
        if (cta) {
          const box = await cta.boundingBox();
          if (box) {
            const clip = { x: Math.max(0, box.x - 40), y: Math.max(0, box.y - 40), width: Math.min(width, box.width + 80), height: box.height + 80 };
            await page.screenshot({ path: path.join(dir, `${width}-cta-rest.png`), clip });
            await cta.hover(); await page.waitForTimeout(350);
            await page.screenshot({ path: path.join(dir, `${width}-cta-hover.png`), clip });
            entry.shots.push(`${slug}/${width}-cta-rest.png`, `${slug}/${width}-cta-hover.png`);
            const shift = await page.evaluate(() => document.documentElement.scrollHeight);
            entry.viewports[width].hover_scrollheight = shift;
          }
        }
        // Keyboard focus: a ring you cannot see is a ring that is not there.
        await page.keyboard.press('Tab');
        const ring = await page.evaluate(() => {
          const e = document.activeElement; if (!e || e === document.body) return null;
          const cs = getComputedStyle(e);
          return { outline: cs.outlineStyle, w: parseFloat(cs.outlineWidth) || 0, shadow: cs.boxShadow };
        });
        if (ring && ring.outline === 'none' && ring.w === 0 && (!ring.shadow || ring.shadow === 'none')) {
          probe.findings.push({ code: 'focus.invisible', severity: 3, route, viewport: width, source: 'probe', evidence: 'the first tab stop renders no outline and no ring shadow', what_to_change: 'Give :focus-visible a visible ring on every interactive element.' });
        }
      }
    } catch (err) {
      // ONE CRASHED TARGET MUST NOT KILL THE RUN — degrade the route, never the run,
      // and record the degradation so nothing downstream reads silence as a pass.
      probe.findings.push({ code: 'capture.failed', severity: 3, route, viewport: width, source: 'probe', evidence: `capture threw: ${String(err).slice(0, 200)}`, what_to_change: 'Fix the page error, then re-run design-eyes for this route.' });
    } finally { await ctx.close(); }
  }

  // Reduced-motion and dark pairs, once per route at the widest viewport.
  for (const [key, opts] of [['reduced', { reducedMotion: 'reduce' }], ['dark', { colorScheme: 'dark' }]]) {
    const ctx = await browser.newContext({ viewport: { width: Math.max(...VPS), height: 900 }, ...opts });
    const page = await ctx.newPage();
    try {
      await page.goto(ORIGIN + route, { waitUntil: 'load' });
      await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight * 0.8) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 80)); } window.scrollTo(0, 0); });
      await page.waitForTimeout(500);
      const p = path.join(dir, `${Math.max(...VPS)}-${key}.png`);
      await page.screenshot({ path: p, fullPage: true });
      entry.shots.push(`${slug}/${Math.max(...VPS)}-${key}.png`);
      if (key === 'reduced') {
        const moving = await page.evaluate(() => {
          let n = 0;
          for (const el of document.querySelectorAll('main *')) { const cs = getComputedStyle(el); if (cs.animationName !== 'none' && parseFloat(cs.animationDuration) > 0.05) n++; }
          return n;
        });
        if (moving > 0) probe.findings.push({ code: 'rm.not_respected', severity: 3, route, viewport: Math.max(...VPS), source: 'probe', evidence: `${moving} element(s) still animate under prefers-reduced-motion: reduce`, what_to_change: 'Wrap the motion kit in a prefers-reduced-motion media query that stops animation.' });
      }
    } catch { /* an absent dark scheme is not a failure; the judge is told the pair is missing */ }
    finally { await ctx.close(); }
  }

  // Accent share, measured off the rendered pixels rather than the stylesheet.
  try {
    const wide = path.join(dir, `${Math.max(...VPS)}-full.png`);
    if (GT.accent && fs.existsSync(wide)) {
      const accentHue = await hueOfToken(browser, GT.accent);
      if (accentHue !== null) {
        const { data, info } = await sharp(wide).resize(240).raw().toBuffer({ resolveWithObject: true });
        let hits = 0; const total = info.width * info.height;
        for (let i = 0; i < data.length; i += info.channels) {
          const h = rgbHue(data[i], data[i + 1], data[i + 2]);
          if (h.s > 0.18 && Math.abs(((h.h - accentHue + 540) % 360) - 180) > 168) hits++;
        }
        const share = hits / total;
        entry.accent_share = Number(share.toFixed(4));
        if (share > 0.15) probe.findings.push({ code: 'color.accent_overuse', severity: 2, route, viewport: Math.max(...VPS), source: 'probe', evidence: `the accent hue covers ${(share * 100).toFixed(1)}% of rendered pixels`, what_to_change: 'Reduce accent coverage below 15% so it reads as an accent.' });
        if (share < 0.002) probe.findings.push({ code: 'color.accent_absent', severity: 2, route, viewport: Math.max(...VPS), source: 'probe', evidence: `the accent hue covers ${(share * 100).toFixed(2)}% of rendered pixels — effectively absent`, what_to_change: 'Put the accent to work: at least one deliberate accent moment per screenful.' });
      }
    }
  } catch { /* histogram is advisory; its absence is reported by the empty accent_share */ }

  // CTA fold check needs the tier, which only the blueprint knows.
  const tier = blueprintTiers()[route] || '';
  const wideVp = Math.max(...VPS);
  const f = entry.viewports[wideVp]?.facts;
  if (f && f.cta_top !== undefined && /core|money|service|item/.test(tier) && f.cta_top > f.fold) {
    probe.findings.push({ code: 'cta.below_fold_money_page', severity: 2, route, viewport: wideVp, source: 'probe', evidence: `the primary CTA starts at y=${f.cta_top} against a ${f.fold}px fold on a ${tier} page`, what_to_change: 'Raise the primary CTA above the fold on this money page.' });
  }

  manifest.routes.push(entry);
  if (!QUIET) console.log(`  captured ${route}  (${entry.shots.length} shots, ${entry.sections.length} sections, ${entry.seams.length} seams)`);
}

await browser.close();
server.close();

// ---------------------------------------------------------------- helpers
async function hueOfToken(browser, tokenValue) {
  // The token may be oklch(); ask the browser to resolve it rather than reimplementing
  // a colour space here, where a rounding error would silently mis-measure the accent.
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await page.setContent('<div id="p"></div>');
    const rgbStr = await page.evaluate((v) => { const d = document.getElementById('p'); d.style.color = v; return getComputedStyle(d).color; }, tokenValue);
    const m = String(rgbStr).match(/[\d.]+/g);
    if (!m) return null;
    return rgbHue(+m[0], +m[1], +m[2]).h;
  } catch { return null; } finally { await ctx.close(); }
}
function rgbHue(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
  return { h, s: mx === 0 ? 0 : d / mx };
}

// ---------------------------------------------------------------- write + report
fs.writeFileSync(path.join(RUN_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
fs.writeFileSync(path.join(RUN_DIR, 'probe.json'), JSON.stringify(probe, null, 2));
const latest = path.join(OUT_ROOT, 'latest.json');
fs.writeFileSync(latest, JSON.stringify({ run: RUN, dir: RUN_DIR, routes, shots: manifest.routes.reduce((n, r) => n + r.shots.length, 0), probe_findings: probe.findings.length }, null, 2));

if (has('json')) { console.log(JSON.stringify({ manifest, probe }, null, 2)); process.exit(probe.findings.some((f) => f.severity === 3) ? 1 : 0); }

const byCode = {};
for (const f of probe.findings) byCode[f.code] = (byCode[f.code] || 0) + 1;
const s3 = probe.findings.filter((f) => f.severity === 3).length;
const s2 = probe.findings.filter((f) => f.severity === 2).length;
console.log('');
console.log(`design-eyes capture ${RUN}`);
console.log(`  routes    ${routes.length}  (${routes.join(' ')})`);
console.log(`  viewports ${VPS.join(', ')}`);
console.log(`  shots     ${manifest.routes.reduce((n, r) => n + r.shots.length, 0)} -> ${SHOT_DIR}`);
console.log(`  probe     ${probe.findings.length} deterministic finding(s): S3=${s3} S2=${s2}`);
for (const [c, n] of Object.entries(byCode).sort((a, b) => b[1] - a[1])) console.log(`            ${String(n).padStart(3)}  ${c}`);
console.log('');
console.log(s3 ? `FAIL design-eyes probe: ${s3} ship-blocking defect(s) before any judge has looked.`
              : `PASS design-eyes probe (deterministic half). The judges have not run — that is the skill's job.`);
process.exit(s3 ? 1 : 0);
