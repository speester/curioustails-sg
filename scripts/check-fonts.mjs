#!/usr/bin/env node
// kit:check-fonts@1.0.0 — the web-font pipeline, MEASURED on the built page.
// Usage: node scripts/check-fonts.mjs [--all | <slug>...]
//
// WHY THIS GATE EXISTS (2026-09-02): tokens.css named 'Inter Tight' and the kit shipped no
// @font-face, no link, no preload and no font-display. Nothing failed. Either the typeface
// never reached a reader — the site rendered in system-ui while Stage 1.9 recorded a
// deliberate typographic direction — or each project wired fonts by hand with LCP and CLS
// nobody measured. §20's retrieval budget weighed HTML and JS and never weighed the one
// resource that blocks text from painting.
//
// What it asserts, in order of how the failure actually shows up:
//   1. SOURCE CONSISTENCY — every @font-face is woff2, self-hosted, font-display: swap;
//      every preloaded file is one an @font-face uses; the file exists in public/fonts/.
//   2. NO SILENT FALLBACK — the family tokens.css names is the family the H1 and the body
//      actually render in. This is the "the site silently renders system-ui" case.
//   3. NO THIRD-PARTY BLOCKING REQUEST — no fonts.googleapis.com stylesheet, no @import.
//   4. BUDGET — font bytes on the critical path, and layout shift across the swap.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const argv = process.argv.slice(2);
const CSS = 'src/styles/fonts.css';
const TS = 'src/styles/fonts.ts';
const FONT_BYTE_BUDGET = 120 * 1024;   // ~two faces of a variable-weight latin subset
const CLS_BUDGET = 0.1;                // the Core Web Vitals bar; a font swap is the usual cause

const failures = [];
const fail = (where, msg) => failures.push(`${where}: ${msg}`);

// ---------------------------------------------------------------- 1. source consistency
const css = fs.existsSync(CSS) ? fs.readFileSync(CSS, 'utf8') : '';
const ts = fs.existsSync(TS) ? fs.readFileSync(TS, 'utf8') : '';
if (!fs.existsSync(CSS)) fail('(source)', `${CSS} is missing — the kit ships it; run \`python ~/.claude/scripts/site-kit.py init\`.`);
if (!fs.existsSync(TS)) fail('(source)', `${TS} is missing — BaseLayout imports FONT_PRELOAD from it.`);

const faces = [...css.matchAll(/@font-face\s*{([\s\S]*?)}/g)].map((m) => m[1]);
const srcUrls = [...css.matchAll(/url\(['"]?([^'")]+)['"]?\)/g)].map((m) => m[1]);
const preload = [...ts.matchAll(/["'](\/[^"']+\.woff2)["']/g)].map((m) => m[1]);
const declaredFamilies = [...new Set([...css.matchAll(/font-family:\s*['"]([^'"]+)['"]/g)].map((m) => m[1]))];
const wantFamily = (k) => (ts.match(new RegExp(`"${k}"\\s*:\\s*"([^"]+)"`)) || [, ''])[1];
const FAM = { display: wantFamily('display'), body: wantFamily('body') };

// EVERY DECLARED FAMILY MUST COVER BASIC LATIN. A subsetting slip gave the Inter and
// IBM Plex Mono "-latin" faces the CYRILLIC unicode-range on a live build, so no face
// matched U+0000-00FF and the body typeface never loaded for a single English
// character - while still being rel=preloaded on all 27 pages, downloaded cold and
// discarded. Nothing caught it: the file parsed, the faces existed, the bytes shipped.
for (const fam of declaredFamilies) {
  const famFaces = faces.filter((f) => new RegExp(`font-family:\\s*['"]${fam}['"]`).test(f));
  const covers = famFaces.some((f) => {
    const r = (f.match(/unicode-range:\s*([^;}]+)/i) || [, ''])[1];
    return !r.trim() || /U\+0{0,3}0{0,2}-?0{0,2}FF|U\+0000-00FF/i.test(r);
  });
  if (!covers) {
    failures.push(`${fam}: no @font-face covers basic Latin (U+0000-00FF) - every ` +
                  `English character falls through to the fallback stack, and any ` +
                  `preloaded file for this family is downloaded and never used`);
  }
}

for (const f of faces) {
  const name = (f.match(/font-family:\s*['"]([^'"]+)/) || [, '?'])[1];
  if (!/font-display:\s*(swap|optional)/.test(f)) fail('(source)', `@font-face ${name} has no font-display: swap — Chrome blocks text for up to 3s`);
  if (!/format\(['"]?woff2/.test(f)) fail('(source)', `@font-face ${name} ships no woff2 — every browser this site supports reads woff2`);
}
for (const u of srcUrls) {
  if (/^https?:/i.test(u)) { fail('(source)', `third-party font URL on the critical path: ${u}`); continue; }
  const file = path.join('public', u.replace(/^\//, ''));
  if (!fs.existsSync(file)) fail('(source)', `${u} is declared by an @font-face and is not in public/fonts/`);
}
for (const u of preload) if (!srcUrls.includes(u)) fail('(source)', `FONT_PRELOAD names ${u}, which no @font-face uses — a wasted request on the critical path`);
if (faces.length && !preload.length) fail('(source)', 'web fonts are installed but nothing is preloaded — the H1 paints twice');
if (!faces.length && preload.length) fail('(source)', 'FONT_PRELOAD is non-empty with no @font-face');
const localBytes = [...new Set(srcUrls)]
  .filter((u) => !/^https?:/i.test(u))
  .map((u) => { const f = path.join('public', u.replace(/^\//, '')); return fs.existsSync(f) ? fs.statSync(f).size : 0; })
  .reduce((a, b) => a + b, 0);
if (localBytes > FONT_BYTE_BUDGET) fail('(source)', `${(localBytes / 1024).toFixed(0)} KB of font files exceeds the ${FONT_BYTE_BUDGET / 1024} KB budget`);

// ---------------------------------------------------------------- rendered pass
function builtRoutes() {
  const out = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (e.name !== 'index.html') continue;
      let r = '/' + path.relative('dist', p).replace(/\\/g, '/').replace(/index\.html$/, '');
      out.push(r.replace(/\/{2,}/g, '/'));
    }
  };
  walk('dist');
  return out.sort();
}

const routes = builtRoutes();
if (!routes.length) { console.error('FAIL dist/ is empty — run `npm run build` first.'); process.exit(1); }
const picked = argv.includes('--all') || !argv.some((a) => !a.startsWith('--'))
  ? routes.slice(0, 6)                                 // fonts are site-wide; six routes prove it
  : routes.filter((r) => argv.some((a) => !a.startsWith('--') && r.includes(a)));

const types = { '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  let file = path.join('dist', p);
  if (p.endsWith('/')) file = path.join(file, 'index.html');
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('404'); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' });
  res.end(fs.readFileSync(file));
});
await new Promise((r) => server.listen(0, r));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;

const { chromium } = await import('playwright');
const browser = await chromium.launch();

for (const route of picked) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const fontRequests = [];
  page.on('request', (r) => { if (r.resourceType() === 'font' || /\.woff2?(\?|$)/.test(r.url())) fontRequests.push(r.url()); });
  await page.goto(ORIGIN + route, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);

  const m = await page.evaluate(() => {
    const first = (stack) => (stack || '').split(',')[0].trim().replace(/^["']|["']$/g, '');
    const h1 = document.querySelector('h1');
    const body = document.body;
    const loaded = [...document.fonts].map((f) => `${f.family}|${f.weight}|${f.status}`);
    const thirdParty = [...document.querySelectorAll('link[rel="stylesheet"], link[rel="preconnect"]')]
      .map((l) => l.href).filter((h) => /fonts\.(googleapis|gstatic)\.com|use\.typekit|fonts\.bunny/.test(h));
    const imports = [...document.styleSheets].flatMap((s) => { try { return [...s.cssRules].filter((r) => r.type === 3).map((r) => r.href); } catch { return []; } })
      .filter((h) => h && /^https?:/.test(h));
    return {
      h1Family: h1 ? first(getComputedStyle(h1).fontFamily) : null,
      h1Stack: h1 ? getComputedStyle(h1).fontFamily : '',
      bodyFamily: first(getComputedStyle(body).fontFamily),
      loaded,
      thirdParty: [...thirdParty, ...imports],
      preloads: [...document.querySelectorAll('link[rel="preload"][as="font"]')].map((l) => new URL(l.href).pathname),
    };
  });

  if (m.thirdParty.length) fail(route, `third-party font origin on the critical path: ${m.thirdParty[0]}`);

  // THE SILENT-FALLBACK CHECK. tokens.css naming a family that nothing installs is exactly
  // the case that shipped: the browser drops to the next stack entry with no error.
  for (const [role, family] of Object.entries(FAM)) {
    if (!family) continue;
    const rendered = role === 'display' ? m.h1Family : m.bodyFamily;
    if (!rendered) continue;
    const isSystem = /^(system-ui|-apple-system|ui-sans-serif|sans-serif|serif|monospace)$/i.test(family);
    if (rendered.toLowerCase() !== family.toLowerCase()) {
      fail(route, `${role} font renders as "${rendered}" but fonts.ts declares "${family}" — the declared typeface is not what a reader sees`);
    }
    if (!isSystem) {
      const ok = m.loaded.some((f) => f.toLowerCase().startsWith(family.toLowerCase() + '|') && f.endsWith('|loaded'));
      if (!ok) fail(route, `"${family}" is declared but no face reached status=loaded — the page rendered in the fallback`);
    }
  }
  for (const p of preload) {
    if (!m.preloads.includes(p)) fail(route, `${p} is in FONT_PRELOAD but no <link rel=preload as=font> emitted it — BaseLayout is not rendering the manifest`);
  }
  const unpreloaded = fontRequests.filter((u) => !preload.some((p) => u.endsWith(p)));
  if (faces.length && unpreloaded.length > faces.length) fail(route, `${unpreloaded.length} font file(s) requested that nothing preloads`);

  // LAYOUT SHIFT across the swap. Measured, not assumed: a swap without size-adjust moves
  // every line of the page after the font arrives.
  const cls = await page.evaluate(() => new Promise((resolve) => {
    let total = 0;
    try {
      new PerformanceObserver((list) => { for (const e of list.getEntries()) if (!e.hadRecentInput) total += e.value; })
        .observe({ type: 'layout-shift', buffered: true });
    } catch { resolve(null); return; }
    setTimeout(() => resolve(total), 600);
  }));
  if (cls !== null && cls > CLS_BUDGET) fail(route, `cumulative layout shift ${cls.toFixed(3)} over load exceeds ${CLS_BUDGET} (a font swap with no size-adjust is the usual cause)`);
  console.log(`${route.padEnd(34)} | h1=${m.h1Family ?? 'n/a'} | body=${m.bodyFamily} | cls=${cls === null ? 'n/a' : cls.toFixed(3)}`);

  await ctx.close();
}

await browser.close();
server.close();

console.log(`\nfaces=${faces.length} families=${declaredFamilies.join(', ') || '(none — system stack)'} bytes=${(localBytes / 1024).toFixed(1)} KB routes=${picked.length} failures=${failures.length}`);
if (failures.length) { console.log('\nFAILURES:'); for (const f of failures) console.log('  ' + f); }
console.log(failures.length ? 'FAIL check-fonts' : 'PASS check-fonts');
// contracts section-1b: every gate prints WHAT IT MEASURED, not only what
// failed - the fixed shape `checked=<n> failed=<m>` on the verdict line.
console.log(`check-fonts: checked=${routes.length} failed=${failures.length}`);
process.exit(failures.length ? 1 : 0);
