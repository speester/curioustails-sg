#!/usr/bin/env node
// kit:contrast-check@1.1.0 — measured WCAG contrast, tokens and rendered pages, IN BOTH THEMES.
// Usage: node scripts/contrast-check.mjs --tokens
//        node scripts/contrast-check.mjs --pages [--all|<slug>...]
//        add --theme light|dark to measure one theme only (default: both)
// --tokens writes the matrix into design-system.md under "## Contrast matrix".
//
// WHAT 1.1.0 FIXED (2026-09-02): the site ships a full dark palette — tokens.css declares
// it three times (prefers-color-scheme, :root:not([data-theme='light']), [data-theme='dark'])
// and screenshots.mjs shoots both themes — while this script had no theme handling at all.
// --tokens flattened the whole stylesheet into ONE map, so a token redeclared in a dark
// block silently overwrote its light value and the "matrix" measured a palette that no
// reader ever sees: dark ink on light surfaces that were never redeclared. --pages rendered
// every route in the default (light) scheme. Gate (i)'s promise "contrast pairs >=4.5:1"
// was therefore true of half the surface the site ships, and false of the other half —
// a vacuous gate, which is worse than an absent one because it reports PASS.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const argv = process.argv.slice(2);
const CSS = 'src/styles/global.css';
const DS = 'design-system.md';


// Pairs that never co-occur on a rendered band: the deep band uses the on-deep ink set
// and light surfaces use the page ink set (STEP 2 rule: headings on deep heroes use the
// band's INVERSE ink). Measuring page ink against the deep band is a false failure.
const SKIP_PAIR = (t, s) =>
  (s === 'deep' && t !== 'on-deep') || (s !== 'deep' && t === 'on-deep');
// Both themes by default: the site ships two palettes, so the gate measures two.
const THEME_IDX = argv.indexOf('--theme');
const CFG_THEMES = (() => {
  // A site that ships one palette is a design decision, not a missing dark mode.
  // config/project-config.md `SITE_THEMES: light` says so once, and every reader obeys.
  try {
    const m = fs.readFileSync('config/project-config.md', 'utf8').match(/^SITE_THEMES:(.*)$/m);
    if (m) return m[1].split('#')[0].split(',').map((x) => x.trim()).filter(Boolean);
  } catch { /* no config: fall through to both */ }
  return null;
})();
const THEMES = THEME_IDX === -1 ? (CFG_THEMES ?? ['light', 'dark']) : [argv[THEME_IDX + 1]];
if (THEMES.some((t) => t !== 'light' && t !== 'dark')) {
  console.error(`FAIL --theme takes light|dark, got "${THEMES.join(',')}"`);
  process.exit(2);
}
const TEXT_TOKENS = ['ink', 'ink-soft', 'kicker', 'link', 'on-deep', 'on-tint', 'warn', 'badge', 'figure-label'];
const SURFACES = ['page', 'muted', 'tint', 'deep', 'card', 'warn-panel'];
const DISPLAY_TOKENS = new Set(['display', 'hero-title']);

/** Split a stylesheet into rule blocks, carrying the @media context down with them.
 *  A flat regex over the whole file cannot tell a light declaration from a dark one. */
function ruleBlocks(css) {
  const out = [];
  const parse = (text, media) => {
    let i = 0;
    while (i < text.length) {
      const open = text.indexOf('{', i);
      if (open < 0) break;
      // A STATEMENT at-rule (`@tailwind base;`, `@charset`, a bare `@import`) ends in a
      // semicolon and carries no block, so it stays glued to the NEXT selector. That made
      // sel `@tailwind base; ... :root`, which starts with '@' and was discarded as an
      // at-rule — the whole first :root block, i.e. the entire palette, went unparsed and
      // every text token read as "not declared". Keep only the text after the last ';'.
      const sel = text.slice(i, open).split(';').pop().trim();
      let depth = 1, j = open + 1;
      while (j < text.length && depth) { if (text[j] === '{') depth++; else if (text[j] === '}') depth--; j++; }
      const body = text.slice(open + 1, j - 1);
      if (sel.startsWith('@')) {
        if (/^@media/i.test(sel)) parse(body, media ? `${media} ${sel}` : sel);
        // @font-face / @keyframes / @theme declare no colour tokens this gate reads.
      } else {
        out.push({ sel, media: media || '', body });
      }
      i = j;
    }
  };
  parse(css, '');
  return out;
}

/** 'dark' | 'light' | 'both' — which theme a block's declarations apply to. */
function blockTheme({ sel, media }) {
  const dark = /prefers-color-scheme:\s*dark/i.test(media) || /\[data-theme=['"]?dark/i.test(sel);
  const light = /prefers-color-scheme:\s*light/i.test(media) || /\[data-theme=['"]?light['"]?\]/i.test(sel);
  // `:root:not([data-theme='light'])` inside a dark media query is the DARK block; the
  // :not() names the escape hatch, not the theme.
  if (dark) return 'dark';
  if (light && !/:not\(/i.test(sel)) return 'light';
  return 'both';
}

/** Two complete palettes, in declaration order. The dark map starts as the light one
 *  because a token declared only under :root (--surface-card, --ink-on-deep, the whole
 *  derived contract) is STILL in force in dark mode — which is exactly why measuring the
 *  dark theme matters: those inherited values sit on redeclared dark surfaces. */
/** check-kit.mjs says `src/styles/tokens.css` OWNS the token vocabulary, while this gate
 *  read only global.css. A project that split its tokens out exactly as check-kit demands
 *  therefore reported every text token MISSING - two instruments disagreeing about where
 *  tokens live. Follow the stylesheet's own local @import graph instead of guessing. */
function inlineImports(file, seen = new Set()) {
  const abs = path.resolve(file);
  if (seen.has(abs) || !fs.existsSync(abs)) return '';
  seen.add(abs);
  const dir = path.dirname(abs);
  return fs.readFileSync(abs, 'utf8').replace(
    /@import\s+(?:url\()?['"]([^'"]+)['"]\)?[^;]*;/gi,
    (whole, spec) => (/^(https?:)?\/\//.test(spec) || !/\.css$/i.test(spec)
      ? ''    // a bare package name (tailwindcss) or a URL: declares no token, and LEAVING it
              // makes ruleBlocks() read the next selector as an at-rule and discard the block
      : inlineImports(path.resolve(dir, spec), seen)));
}

function parseTokens() {
  if (!fs.existsSync(CSS)) { console.error(`FAIL ${CSS} not found`); process.exit(1); }
  // tokens.css DECLARES the vocabulary; global.css declares the shell classes, and the
  // kit ships no @import between them - the layout imports both. Reading global.css
  // alone therefore reported all 18 text tokens as "not declared" on a project whose
  // palette was complete (Insight User Conference, 2026-09-05). Every stylesheet the
  // site loads is a stylesheet this gate must read declarations from.
  const TOKENS = path.join(path.dirname(CSS), 'tokens.css');
  const css = (fs.existsSync(TOKENS) ? inlineImports(TOKENS) + String.fromCharCode(10) : '') + inlineImports(CSS);
  const light = {}, dark = {};
  for (const b of ruleBlocks(css)) {
    const theme = blockTheme(b);
    for (const m of b.body.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
      const name = m[1].trim(), value = m[2].trim();
      if (theme !== 'dark') light[name] = value;
      if (theme !== 'light') dark[name] = value;
    }
  }
  return { light, dark };
}

function resolve(map, value, depth = 0) {
  if (depth > 8 || !value) return value;
  const v = value.trim();
  const m = v.match(/^var\(\s*--([a-z0-9-]+)\s*(?:,\s*([^)]+))?\)$/i);
  if (m) return resolve(map, map[m[1]] ?? m[2] ?? '', depth + 1);
  return v;
}

function toRgb(c) {
  if (!c) return null;
  const s = c.trim().toLowerCase();
  let m = s.match(/^#([0-9a-f]{3})$/i);
  if (m) return m[1].split('').map((h) => parseInt(h + h, 16));
  m = s.match(/^#([0-9a-f]{6})$/i);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  m = s.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  m = s.match(/^oklch\(\s*([\d.]+)%?\s+([\d.]+)\s+([\d.]+)/i);
  if (m) return oklchToRgb(Number(m[1]) > 1 ? Number(m[1]) / 100 : Number(m[1]), Number(m[2]), Number(m[3]));
  m = s.match(/^hsl\(\s*([\d.]+)[,\s]+([\d.]+)%[,\s]+([\d.]+)%/i);
  if (m) return hslToRgb(Number(m[1]), Number(m[2]) / 100, Number(m[3]) / 100);
  return null;
}

function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m0 = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m0) * 255, (g + m0) * 255, (b + m0) * 255];
}

function oklchToRgb(L, C, Hdeg) {
  const h = (Hdeg * Math.PI) / 180;
  const a = C * Math.cos(h), b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  const lr = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
  const g = (u) => (u <= 0.0031308 ? 12.92 * u : 1.055 * Math.pow(Math.max(u, 0), 1 / 2.4) - 0.055);
  return [g(lr) * 255, g(lg) * 255, g(lb) * 255].map((v) => Math.min(255, Math.max(0, v)));
}

function relLum([r, g, b]) {
  const f = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function ratio(fg, bg) {
  const a = toRgb(fg), b = toRgb(bg);
  if (!a || !b) return null;
  const l1 = relLum(a), l2 = relLum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function matrixFor(map, theme) {
  const rows = [];
  let failed = 0;
  for (const t of TEXT_TOKENS) {
    const fg = resolve(map, map[`ink-${t}`] ?? map[`color-${t}`] ?? map[t]);
    if (!fg) { rows.push([theme, t, '-', 'MISSING', 'text token not declared']); failed++; continue; }
    for (const s of SURFACES) {
      if (SKIP_PAIR(t, s)) continue;
      const bg = resolve(map, map[`surface-${s}`] ?? map[`color-${s}`]);
      if (!bg) continue;
      const r = ratio(fg, bg);
      if (r === null) { rows.push([theme, t, s, 'UNPARSED', `${fg} on ${bg}`]); failed++; continue; }
      const min = DISPLAY_TOKENS.has(t) ? 3.0 : 4.5;
      const ok = r >= min;
      if (!ok) failed++;
      rows.push([theme, t, s, `${r.toFixed(2)}:1`, ok ? 'PASS' : `FAIL (< ${min})`]);
    }
  }
  return { rows, failed };
}

async function runTokens() {
  const maps = parseTokens();
  const themes = THEMES;
  const rows = [];
  let failed = 0;
  for (const theme of themes) {
    const r = matrixFor(maps[theme], theme);
    rows.push(...r.rows);
    failed += r.failed;
  }
  const table = ['| theme | text token | surface | ratio | result |', '|---|---|---|---|---|',
    ...rows.map((r) => `| ${r[0]} | ${r[1]} | ${r[2]} | ${r[3]} | ${r[4] ?? ''} |`)].join('\n');

  console.log('THEME | TEXT TOKEN    | SURFACE     | RATIO   | RESULT');
  for (const r of rows) console.log(`${String(r[0]).padEnd(5)} | ${String(r[1]).padEnd(13)} | ${String(r[2]).padEnd(11)} | ${String(r[3]).padEnd(7)} | ${r[4] ?? ''}`);
  console.log(`\nthemes=${THEMES.join(',')} pairs=${rows.length} failed=${failed}`);

  if (fs.existsSync(DS)) {
    const md = fs.readFileSync(DS, 'utf8');
    const block = `## Contrast matrix\n\n_Generated by scripts/contrast-check.mjs — do not hand-edit._\n\n${table}\n`;
    const next = /## Contrast matrix[\s\S]*?(?=\n## |$)/.test(md)
      ? md.replace(/## Contrast matrix[\s\S]*?(?=\n## |$)/, block)
      : md.trimEnd() + '\n\n' + block;
    fs.writeFileSync(DS, next, 'utf8');
    console.log(`wrote the matrix into ${DS}`);
  } else {
    // Labelled WARN but counted toward `failed`, which printed a warning and exited 1.
    // The absence IS a failure - the matrix has nowhere to live - so say FAIL and say why.
    console.log(`FAIL ${DS} not found — the contrast matrix has nowhere to be persisted, so a`);
    console.log('     passing matrix here proves nothing at the next review. Author it (Stage 1.9).');
    failed++;
  }
  console.log(failed ? 'FAIL contrast-check --tokens' : 'PASS contrast-check --tokens');
  process.exit(failed ? 1 : 0);
}

async function runPages() {
  const { chromium } = await import('playwright');
  const SELECTORS = ['.eyebrow', '.breadcrumb a', '.fig-label', '.badge', '.warn', '.wordmark', '.btn-primary', 'main p a'];
  const types = { '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2' };
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    let file = path.join('dist', p);
    if (p.endsWith('/')) file = path.join(file, 'index.html');
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('404'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' });
    res.end(fs.readFileSync(file));
  });
  await new Promise((r) => server.listen(8793, r));

  const routes = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (e.name !== 'index.html') continue;
      let r = '/' + path.relative('dist', p).replace(/\\/g, '/').replace(/index\.html$/, '');
      routes.push(r.replace(/\/{2,}/g, '/'));
    }
  };
  walk('dist');
  const wanted = argv.includes('--all') ? routes : routes.filter((r) => argv.some((a) => !a.startsWith('--') && r.includes(a)));
  const targets = wanted.length ? wanted : routes;

  const browser = await chromium.launch();
  const failures = [];
  // EVERY route, in EVERY theme the site ships. The dark palette redeclares nine tokens
  // and inherits the rest; a pair that passes on --surface-page in light can fail on the
  // dark redeclaration of the same name, and until 1.1.0 nothing ever looked.
  for (const route of targets) {
    for (const theme of THEMES) {
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: theme })).newPage();
    await page.goto('http://127.0.0.1:8793' + route, { waitUntil: 'load' });
    await page.emulateMedia({ colorScheme: theme });
    await page.waitForTimeout(150);
    const found = await page.evaluate((sels) => {
      const bgOf = (el) => {
        let n = el;
        while (n && n !== document.documentElement) {
          const c = getComputedStyle(n).backgroundColor;
          if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c;
          n = n.parentElement;
        }
        // The walk stops at <html>. If body AND html are both transparent the browser
        // still paints white, and returning the transparent value made every ratio a
        // measurement against BLACK - 126 false failures on one site.
        for (const n2 of [document.body, document.documentElement]) {
          const c = getComputedStyle(n2).backgroundColor;
          if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c;
        }
        return 'rgb(255, 255, 255)';
      };
      const out = [];
      for (const sel of sels) {
        for (const el of Array.from(document.querySelectorAll(sel)).slice(0, 5)) {
          const cs = getComputedStyle(el);
          out.push({ sel, fg: cs.color, bg: bgOf(el), size: parseFloat(cs.fontSize), weight: cs.fontWeight, underline: cs.textDecorationLine });
        }
      }
      return out;
    }, SELECTORS);
    for (const f of found) {
      const r = ratio(f.fg, f.bg);
      if (r === null) continue;
      const large = f.size >= 24 || (f.size >= 18.66 && Number(f.weight) >= 700);
      const min = large ? 3.0 : 4.5;
      if (r < min) failures.push(`${route} [${theme}] ${f.sel} ${r.toFixed(2)}:1 (${f.fg} on ${f.bg}, ${f.size}px, min ${min})`);
      if (f.sel === 'main p a' && f.underline === 'none' && r < 3.0) {
        failures.push(`${route} [${theme}] in-body link neither underlined nor >= 3:1 vs body text (${r.toFixed(2)}:1)`);
      }
    }
    await page.context().close();
    }
  }
  await browser.close();
  server.close();

  console.log('CHECK            | RESULT');
  console.log(`computed-contrast | ${failures.length ? `FAIL (${failures.length})` : 'PASS'}`);
  for (const f of failures) console.log('  ' + f);
  console.log(`\npages=${targets.length} themes=${THEMES.join(',')} failures=${failures.length}`);
  console.log(failures.length ? 'FAIL contrast-check --pages' : 'PASS contrast-check --pages');
// contracts section-1b: every gate prints WHAT IT MEASURED, not only what
// failed - the fixed shape `checked=<n> failed=<m>` on the verdict line.
  console.log(`contrast-check: checked=${routes.length} failed=${failures.length}`);
  process.exit(failures.length ? 1 : 0);
}

if (argv.includes('--pages')) await runPages();
else await runTokens();
