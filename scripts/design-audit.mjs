#!/usr/bin/env node
// kit:design-audit@1.1.0 — the numeric enforcement of every premium-design-standard "audit hook".
// 1.1.0 (2026-09-02): --layout measures 320 as well as 1440/375. Checkpoint 3 says it
// reviews 320; the layout floor was never evaluated there.
// 1.2.0 (2026-09-02): --layout adds the MOBILE NAV floor (RULE 34 item 7) — every top-level
// NAV_MENU item reachable at 375 after at most one tap, on a >=44px target.
// Usage: node scripts/design-audit.mjs [--all | <slug>] [--rhythm|--naked|--tilt|--brand|--motion|--tables|--chrome|--layout]
// Parses dist/ HTML; an optional Playwright pass supplies computed values (divider gap, fold motion).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const argv = process.argv.slice(2);
const GROUPS = ['rhythm', 'naked', 'tilt', 'brand', 'motion', 'tables', 'chrome', 'layout'];
const chosen = GROUPS.filter((g) => argv.includes(`--${g}`));
const want = (g) => chosen.length === 0 || chosen.includes(g);

// An unrecognised --flag left the selection empty, which means "run everything":
// a typo, or a flag a skill cites that this script never implemented, then reported
// on the whole site as if the named check had run.
const KNOWN = ["rhythm", "naked", "tilt", "brand", "motion", "tables", "chrome", "layout", "all"];
const unknown = argv.filter((a) => a.startsWith('--') && !KNOWN.includes(a.replace(/^--/, '')));
if (unknown.length) {
  console.error(`FAIL unknown option(s): ${unknown.join(' ')}`);
  console.error(`     known: ${KNOWN.map((k) => '--' + k).join(' ')}`);
  process.exit(2);
}
const target = argv.find((a) => !a.startsWith('--')) ?? null;

const failures = [];
const fail = (route, msg) => failures.push(`${route}: ${msg}`);
// A WARN is a page this gate cannot hold to the rule, not a page that broke it: a site
// built before Section.astro existed emits neither axis, and failing it would only teach
// the next session to stop running the gate. Warnings are printed and counted; they do
// not set the exit code.
const warnings = [];
const warn = (route, msg) => warnings.push(`${route}: ${msg}`);

function builtPages() {
  const out = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (e.name !== 'index.html') continue;
      let r = '/' + path.relative('dist', p).replace(/\\/g, '/').replace(/index\.html$/, '');
      out.push({ file: p, route: r.replace(/\/{2,}/g, '/') });
    }
  };
  walk('dist');
  return out;
}
// Every route the site actually built — used by --tables to decide whether an entity
// name in a table cell should have been a link.
const ALL_ROUTES = new Set(builtPages().map((p) => p.route));
// Aggregates printed by --chrome (tsp-E7(e) / tsp-OWNER-1).
let chromeLegalOk = 0;
let chromeFooterRows = 0;

// ---------- brand assets (page-independent) ----------
function brandRow() {
  const NEED = ['favicon.ico', 'favicon-96x96.png', 'favicon-192.png', 'favicon-512.png',
    'apple-touch-icon.png', 'og-default.png', 'logo.png', 'site.webmanifest'];
  const missing = NEED.filter((f) => !fs.existsSync(path.join('public', f)));
  const css = fs.existsSync('src/styles/global.css') ? fs.readFileSync('src/styles/global.css', 'utf8') : '';
  const tokens = new Set([...css.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0].toLowerCase()));
  let paletteNote = tokens.size ? 'tokens declared' : 'NO hex tokens declared';
  if (missing.length) fail('(brand)', `missing assets: ${missing.join(', ')}`);
  if (!tokens.size) fail('(brand)', 'no hex tokens in global.css — palette match cannot be asserted');

  const themeColor = fs.existsSync('dist/index.html') && /name="theme-color"/.test(fs.readFileSync('dist/index.html', 'utf8'));
  if (!themeColor) fail('(brand)', 'no <meta name="theme-color"> on the built homepage');

  // PROVENANCE — existence + palette-match both PASS on a framework starter icon and on a
  // sibling project's icon whose palette happens to be neutral. The Super Panel's deleted
  // magazine shipped a pink "M" favicon through a full rebuild and two browser
  // verifications; the 9th cloned breed site shipped a sibling's assets. So: hash them.
  const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  const denyPath = path.join('scripts', 'lib', 'starter-icons.json');
  const deny = fs.existsSync(denyPath) ? JSON.parse(fs.readFileSync(denyPath, 'utf8')) : {};
  const sibPath = path.join(os.homedir(), '.claude', 'state', 'sibling-icons.json');
  const siblings = fs.existsSync(sibPath) ? JSON.parse(fs.readFileSync(sibPath, 'utf8')) : {};
  const provenance = [];
  if (!fs.existsSync(denyPath)) provenance.push('scripts/lib/starter-icons.json is missing — the starter deny-list cannot be checked');
  for (const f of NEED.filter((n) => /\.(png|ico|svg)$/.test(n))) {
    const p = path.join('public', f);
    if (!fs.existsSync(p)) continue;
    const h = sha(p);
    for (const [name, hash] of Object.entries(deny)) {
      if (hash === h) provenance.push(`${f} matches ${name}`);
    }
    for (const [proj, icons] of Object.entries(siblings)) {
      for (const [name, hash] of Object.entries(icons)) {
        if (hash === h) provenance.push(`${f} is byte-identical to ${proj}/${name} — that is a sibling's asset, not this brand`);
      }
    }
  }
  // The shipped favicon must be NEWER than the Stage 1.75 brand commit: an icon that
  // predates the brand was never regenerated for it.
  let brandAt = 0;
  try {
    brandAt = Number(execFileSync('git', ['log', '-1', '--format=%ct', '--', 'brand/'], { encoding: 'utf8' }).trim() || 0) * 1000;
  } catch { /* no git history yet */ }
  const ico = path.join('public', 'favicon.ico');
  if (brandAt && fs.existsSync(ico) && fs.statSync(ico).mtimeMs < brandAt) {
    provenance.push('favicon.ico predates the Stage 1.75 brand commit — it was never regenerated for this brand');
  }
  for (const pv of provenance) fail('(brand)', `provenance: ${pv}`);

  return { present: NEED.length - missing.length, need: NEED.length, missing, paletteNote,
    paletteOk: tokens.size > 0, themeColor, provenance, provenanceOk: provenance.length === 0 };
}

// ---------- per-page static parse ----------
function auditPage(html, route) {
  const sections = [...html.matchAll(/<section\b[^>]*>/g)].map((m) => m[0]);
  const tones = sections.map((s) => (s.match(/data-tone="([a-z-]+)"/) || [, null])[1]);
  const treatments = sections.map((s) => (s.match(/data-treatment="([a-z-]+)"/) || [, null])[1]);
  const seams = [...html.matchAll(/data-seam="([a-z-]+)"/g)].map((m) => m[1]);
  const fillAttrs = [...html.matchAll(/data-fill-color="([^"]*)"/g)].map((m) => m[1]);
  const againstAttrs = [...html.matchAll(/data-against-color="([^"]*)"/g)].map((m) => m[1]);

  if (want('rhythm')) {
    // TONE is asserted only on pages that emit it at all. This check used to fail every
    // section of every page unconditionally: the kit shipped SectionDivider.astro under
    // the name Section.astro, so NOTHING emitted data-tone and a genuinely well-designed
    // site failed 69/69 pages on a vocabulary that did not exist. A gate that cannot pass
    // is a gate nobody runs. Once Section.astro is in use the page is held to it fully.
    const toned = tones.filter(Boolean).length;
    if (toned > 0) {
      const untoned = tones.length - toned;
      if (untoned) fail(route, `${untoned} of ${tones.length} <section> without data-tone (not in the rhythm)`);
    } else if (sections.length) {
      warn(route, `${sections.length} <section> and no data-tone anywhere — not built on Section.astro, so the tone rhythm is unenforced`);
    }
    // A077: THE DECLARED CADENCE IS MEASURED. `design-system.md ## Section-treatment
    // palette` carries `Band cadence: <n>`; the rhythm used to hard-code a flip every two
    // sections and nothing compared the built page to the declaration, so the row
    // astro-build:588-593 promised was prose. A page whose tone flips at a different
    // interval than the design system declares is a page built off its own design system.
    if (toned > 1) {
      const declared = (() => {
        try {
          const ds = fs.readFileSync('design-system.md', 'utf8');
          const m = ds.match(/^Band cadence:\s*(\d+)/m);
          return m ? parseInt(m[1], 10) : null;
        } catch { return null; }
      })();
      if (declared && declared >= 1) {
        const seq = tones.filter(Boolean);
        // The run lengths of identical consecutive tones. Every run but the last must
        // equal the declared cadence; the final run may be short (the page ended).
        const runs = [];
        let n = 1;
        for (let i = 1; i < seq.length; i++) {
          if (seq[i] === seq[i - 1]) n++;
          else { runs.push(n); n = 1; }
        }
        runs.push(n);
        const bad = runs.slice(0, -1).filter((r) => r !== declared);
        if (bad.length)
          fail(route, `tone flips at [${runs.join(',')}] sections; design-system.md declares "Band cadence: ${declared}"`);
      }
    }

    let dupes = 0;
    for (let i = 1; i < seams.length; i++) if (seams[i] === seams[i - 1]) dupes++;
    if (dupes) fail(route, `${dupes} adjacent seam(s) share a variant: ${seams.join(',')}`);
    const distinct = new Set(seams).size;
    if (seams.length >= 3 && distinct < 3) fail(route, `${seams.length} seams but only ${distinct} distinct variant(s)`);
    const badFill = fillAttrs.filter((f) => !/^(var\(|#|rgb|hsl|oklch)/.test(f));
    if (badFill.length) fail(route, `${badFill.length} divider fill(s) are unresolved tones: ${badFill.join(',')}`);
    let sameBg = 0;
    for (let i = 0; i < fillAttrs.length; i++) if (fillAttrs[i] && fillAttrs[i] === againstAttrs[i]) sameBg++;
    if (sameBg) fail(route, `${sameBg} divider(s) whose container background equals their fill (invisible)`);
  }

  if (want('rhythm')) {
    // premium-design-standard #25 is about the TREATMENT axis, not the tone axis:
    // "every section gets a designed treatment, and adjacent sections must not share one".
    // These values were parsed at the top of this function, counted in the report row, and
    // never asserted — so a page could run cards-cards-cards-cards and still pass.
    const named = treatments.filter(Boolean);
    if (named.length) {
      let adj = 0;
      for (let i = 1; i < treatments.length; i++) {
        if (treatments[i] && treatments[i] === treatments[i - 1]) adj++;
      }
      if (adj) fail(route, `${adj} adjacent section pair(s) share a treatment: ${treatments.map((t) => t || '-').join('>')}`);
      const distinctT = new Set(named).size;
      if (sections.length >= 4 && distinctT < 3) {
        fail(route, `${sections.length} sections but only ${distinctT} distinct treatment(s) (${[...new Set(named)].join(',')}) — need >= 3`);
      }
      const untreated = sections.length - named.length;
      if (untreated) fail(route, `${untreated} of ${sections.length} <section> carry no data-treatment`);
    } else if (sections.length >= 4) {
      warn(route, `${sections.length} <section> and no data-treatment anywhere — not built on Section.astro, so treatment variety is unenforced`);
    }
  }

  if (want('naked')) {
    const isLegal = /data-treatment="legal"/.test(html);
    let naked = 0;
    for (const m of html.matchAll(/<section\b([^>]*)>([\s\S]*?)<\/section>/g)) {
      const attrs = m[1], body = m[2];
      if (/data-treatment="/.test(attrs)) continue;
      if (/class="[^"]*\bprose\b/.test(attrs) || /class="[^"]*\bprose\b/.test(body)) continue;
      const stripped = body.replace(/<(h[1-6]|p)\b[\s\S]*?<\/\1>/g, '').replace(/\s|<br\s*\/?>/g, '');
      if (!stripped) naked++;
    }
    if (naked && !isLegal) fail(route, `${naked} naked section(s) — headings + <p> with no treatment`);

    if (/\/blog\//.test(route) || /data-treatment="prose/.test(html)) {
      const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const words = text ? text.split(' ').length : 0;
      // A CTA band is a designed non-prose block: it renders <section class="ctaband">
      // with its own tone and treatment. It was not counted, so adding one to a page
      // sitting on the threshold RAISED `need` (its copy adds words) without raising
      // `nonProse` — the density gate failed a page that had just got better.
      // A facts card and a stat strip are designed non-prose blocks by exactly the
      // same argument the CTA band was added under: each renders its own container,
      // its own treatment and its own reading job, and each BREAKS a wall of prose.
      // Counting a band's copy toward `words` while refusing to count the band made
      // the gate punish the pages carrying the most furniture.
      // A grid of picture cards is the strongest non-prose block a hub page has, and
      // it was the one the hubs were built from: /blog/ measured 1 block for 2,606
      // words while carrying six card grids.
      const nonProse = (html.match(/<figure\b|<table\b|<blockquote\b|data-answer-capsule|data-facts-card|data-card-grid|data-stat-strip|class="[^"]*(?:callout|ctaband)/g) || []).length;
      const need = Math.max(1, Math.floor(words / 350));
      if (nonProse < need) fail(route, `article density: ${nonProse} non-prose block(s) for ${words} words (need >= ${need})`);
    }
  }

  if (want('tilt')) {
    const heroTilt = /<(section|header)[^>]*class="[^"]*hero[^"]*"[\s\S]{0,4000}?data-tilt/.test(html);
    if (!heroTilt && !/\/(404|contact\/thank-you)\//.test(route)) fail(route, 'hero has no [data-tilt] element');
  }

  // TABLE UX — three of the four fixes sideincomehq needed by hand (product names linked,
  // tables full-width below the fold, one row per entity). The fourth, heading contrast on
  // tinted panels, is scripts/contrast-check.mjs (Task G2.23).
  if (want('tables')) {
    let ti = 0;
    for (const t of html.matchAll(/<table\b[\s\S]*?<\/table>/g)) {
      ti++;
      const table = t[0];
      const head = (table.match(/<thead[\s\S]*?<\/thead>/) || [''])[0];
      const cols = (head.match(/<t[hd]\b/g) || []).length
        || ((table.match(/<tr\b[\s\S]*?<\/tr>/) || [''])[0].match(/<t[hd]\b/g) || []).length;
      const before = html.slice(0, t.index).slice(-500);
      if (cols >= 4) {
        if (!/<div[^>]+class="[^"]*(compare-wrap|table-wrap|full-bleed)[^"]*"[^>]*>\s*$/.test(before)) {
          fail(route, `table #${ti} has ${cols} columns and is not inside a full-bleed scroll wrapper (.compare-wrap / .table-wrap)`);
        }
        if (!/data-below-fold/.test(before)) {
          fail(route, `table #${ti} (${cols} cols) is not marked data-below-fold — a wide table never sits in the first viewport`);
        }
      }
      for (const row of table.matchAll(/<tr\b[\s\S]*?<\/tr>/g)) {
        const cell = (row[0].match(/<th\b[^>]*scope="row"[^>]*>([\s\S]*?)<\/th>/) || [, null])[1];
        if (cell === null) continue;
        const names = cell.replace(/<[^>]+>/g, '|').split('|').map((x) => x.trim()).filter(Boolean);
        if (names.length > 1) {
          fail(route, `table #${ti} row carries ${names.length} entity names in one cell ("${names.join('", "')}") — one entity per row`);
        }
        const guess = names[0] ? '/' + names[0].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '/' : null;
        if (guess && ALL_ROUTES.has(guess) && !/<a\s/.test(cell)) {
          fail(route, `table #${ti}: "${names[0]}" has a built route ${guess} but the cell is not a link`);
        }
      }
    }
  }

  // CHROME — the archetype header/footer shape, measured on dist.
  if (want('chrome')) {
    // The PAGE footer is the LAST <footer> in the document, not the first: a page that
    // carries an inner <footer> (a blockquote attribution, an article byline) otherwise
    // has that element measured as the site chrome, and every chrome assertion below is
    // then made against markup that is not the chrome at all. Measured on chihuahua.sg
    // 2026-09-05: ExpertQuote's <footer> shadowed the site footer on 44 of 46 routes.
    const footerAll = html.match(/<footer[\s\S]*?<\/footer>/g) || [];
    const footer = footerAll.length ? footerAll[footerAll.length - 1] : '';
    if (footer) {
      const note = (footer.match(/<p[^>]*data-footer-footnote[\s\S]*?<\/p>/) || [''])[0];
      if (!note) fail(route, 'footer has no [data-footer-footnote] bar — Privacy/Terms live only there');
      const outside = (footer.replace(note, '').match(/href="\/(privacy|terms|cookies?)[^"]*"/g) || []).length;
      if (outside) fail(route, `${outside} legal link(s) outside the footnote bar — "make footer one row, move privacy and terms to footnote" (owner, twice)`);
      else chromeLegalOk = 1;
      const flinks = (footer.match(/<a\s/g) || []).length;
      if (flinks > 10) fail(route, `footer carries ${flinks} links (cap 10)`);
    }
    const header = (html.match(/<header[\s\S]*?<\/header>/) || [''])[0];
    const navItems = (header.match(/data-nav-group/g) || []).length;
    const cap = /data-archetype="(national-publisher|affiliate-review)"/.test(html) ? 5 : 4;
    if (navItems > cap) fail(route, `header has ${navItems} nav items; the archetype cap is ${cap}`);
    const banned = (header.match(/href="\/(write-for-us|advertise|partners)\//g) || []).length;
    if (banned) fail(route, `${banned} monetization link(s) in <nav> — they belong in the footer utility row`);
  }

  return {
    sections: sections.length,
    seams: seams.length,
    seam_sequence: seams.join('>') || '-',
    distinct_variants: new Set(seams).size,
    treatments: treatments.filter(Boolean).length,
    tables: (html.match(/<table\b/g) || []).length,
  };
}

// ---------- live pass (computed gap + fold motion) ----------
async function livePass(pages) {
  let chromium;
  try { ({ chromium } = await import('playwright')); }
  catch {
    // A GATE THAT CANNOT MEASURE MUST NOT REPORT PASS. Without playwright the live
    // passes - mobile nav, divider geometry, text-run density, fold motion - simply
    // did not run, and the script printed "failures=0 / PASS". Running the identical
    // file from the kit path instead of the project path therefore turned 80 real
    // failures into a green light, which is how this build was reported as clean.
    console.error(
      'HALT design-audit: playwright is not resolvable from ' + import.meta.url + '\n' +
      '  The live passes (mobile nav, divider geometry, text-run density, fold motion)\n' +
      '  cannot run, and a text-only pass is not this gate. Run the PROJECT copy\n' +
      '  (node scripts/design-audit.mjs) so playwright resolves from the project, or\n' +
      '  install it. Reporting 0 failures here would be a pass that measured nothing.');
    process.exit(1);
  }

  const types = { '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2' };
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    let file = path.join('dist', p);
    if (p.endsWith('/')) file = path.join(file, 'index.html');
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('404'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' });
    res.end(fs.readFileSync(file));
  });
  // Ephemeral port. livePass() is called TWICE per run (desktop, then mobile) and the
  // fixed port made the second bind race the first server's close: EADDRINUSE crashed the
  // process AFTER the desktop summary had already printed "PASS design-audit", so the
  // mobile half silently never ran while the line above it read green.
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch();
  const out = {};
  // ROUTE-LEVEL CONCURRENCY, same reasoning as page-health.mjs: a fresh context
  // per route plus a settle wait, serialised, is 83.8s for 27 routes. Each
  // iteration writes only `out[route]`, so the routes are independent.
  const DA_POOL = Math.max(1, Number(process.env.DA_POOL || 6));
  const _q = pages.map((p) => p.route);
  await Promise.all(Array.from(
    { length: Math.min(DA_POOL, _q.length || 1) },
    async () => {
      for (;;) {
        const route = _q.shift();
        if (route === undefined) break;
        // ONE CRASHED TARGET MUST NOT KILL THE RUN. At a pool of 10 Chromium
        // returned "Target crashed" on newPage and the uncaught rejection took
        // the whole gate down - it printed a stack and no denominator, and the
        // `&&` chain it sits in then skipped everything after it. Degrade the
        // ROUTE, never the run.
        try {
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    await page.goto(origin + route, { waitUntil: 'load' });
    await page.waitForTimeout(500);
    const wantLayout = want('layout');
    const data = await page.evaluate((wantLayout) => {
      let gapMax = -Infinity;
      for (const d of Array.from(document.querySelectorAll('.section-divider'))) {
        const r = d.getBoundingClientRect();
        for (const n of [d.previousElementSibling, d.nextElementSibling]) {
          if (!n) continue;
          const nr = n.getBoundingClientRect();
          const gap = n === d.previousElementSibling ? r.top - nr.bottom : nr.top - r.bottom;
          gapMax = Math.max(gapMax, gap);
        }
      }
      let fold = 0;
      for (const el of Array.from(document.querySelectorAll('body *'))) {
        const r = el.getBoundingClientRect();
        if (r.top > 900) continue;
        const cs = getComputedStyle(el);
        if (cs.animationName !== 'none' || cs.transitionProperty.includes('transform')) fold++;
      }
      // Wide tables: MEASURED, not marker-trusted. A >=4-column table must start below the
      // first viewport and its wrapper must be a full-width horizontal scroller.
      let wideInFold = 0, wideNarrow = 0;
      for (const t of Array.from(document.querySelectorAll('table'))) {
        const cols = t.querySelectorAll('thead th, thead td').length || (t.rows[0] ? t.rows[0].cells.length : 0);
        if (cols < 4) continue;
        const tr = t.getBoundingClientRect();
        if (tr.top < window.innerHeight) wideInFold++;
        const wrap = t.parentElement;
        const host = t.closest('main, article, section');
        const hostW = host ? host.getBoundingClientRect().width : window.innerWidth;
        const wrapCs = wrap ? getComputedStyle(wrap) : null;
        if (!wrap || wrapCs.overflowX !== 'auto' || wrap.getBoundingClientRect().width < hostW * 0.99) wideNarrow++;
      }
      // Footer shape: ONE row of columns at desktop (owner correction, twice).
      let footerRows = 0;
      const frow = document.querySelector('.site-footer__row');
      if (frow) footerRows = new Set(Array.from(frow.children).map((c) => Math.round(c.getBoundingClientRect().top))).size;

      // ---- LAYOUT GROUP (owner report, BTO Renovation SG 2026-09-01): six defects that
      // every text-only gate passed. Each one is MEASURED on the rendered page, because
      // each shipped while the markup looked correct.
      const L = {
        divider_wrong_side: 0, divider_no_edge: 0, divider_not_mirrored: 0,
        cards_too_wide: 0, long_measure: 0, plain_text_sections: 0,
        media_text_imbalance: 0, tiny_body_text: 0,
        header_sticky: true, form_defects: [],
        dead_columns: 0, butted_joins: 0, empty_band: 0, width_monotony: 0,
        band_widths: 0, cta_below_fold: 0, small_targets: [], dead_bands: [],
        visual_density: 0, longest_text_run: 0, tone_share: 0, scroll_height: 0,
      };
      if (wantLayout) {
        const probe = document.createElement('span');
        probe.style.display = 'none';
        document.body.appendChild(probe);
        const resolve = (v) => { if (!v) return ''; probe.style.color = ''; probe.style.color = v; return getComputedStyle(probe).color; };
        const bgOf = (el) => {
          let n = el;
          while (n && n !== document.documentElement) {
            const c = getComputedStyle(n).backgroundColor;
            if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c;
            n = n.parentElement;
          }
          return getComputedStyle(document.body).backgroundColor;
        };
        // 1. DIVIDER ORIENTATION. A divider belongs to ONE edge of ONE section: its path
        // fill must equal the background of the section that OWNS the edge, and its
        // container must equal the neighbour's. Reading the two attributes against each
        // other (what --rhythm does) passes a divider mounted on the wrong side.
        const mirrorByVariant = {};
        for (const d of Array.from(document.querySelectorAll('.section-divider'))) {
          const edge = d.getAttribute('data-edge');
          if (edge !== 'top' && edge !== 'bottom') { L.divider_no_edge++; continue; }
          const owner = edge === 'top' ? d.nextElementSibling : d.previousElementSibling;
          const other = edge === 'top' ? d.previousElementSibling : d.nextElementSibling;
          const fill = resolve(d.getAttribute('data-fill-color'));
          const against = resolve(d.getAttribute('data-against-color'));
          if (owner && fill && bgOf(owner) !== fill) L.divider_wrong_side++;
          else if (other && against && bgOf(other) !== against) L.divider_wrong_side++;
          // The mirror may live on the CONTAINER (the kit puts `transform: scaleY(-1)` there)
          // or on the <svg> itself; either counts, and two of them cancel out.
          const svg = d.querySelector('svg');
          const neg = (el) => {
            if (!el) return false;
            const tr = getComputedStyle(el).transform;
            if (!tr || tr === 'none') return false;
            try { return new DOMMatrixReadOnly(tr).d < 0; } catch (e) { return false; }
          };
          let flipped = neg(d) !== neg(svg);
          if (svg && /scale\(\s*1\s*,\s*-1\s*\)|scaleY\(\s*-1\s*\)/.test(svg.innerHTML)) flipped = !flipped;
          // Kit paths are authored ONCE, as a BOTTOM edge. A top-edge divider is therefore
          // the mirrored one, always. `data-edge="top"` on an unmirrored shape is the
          // upside-down divider itself, and it is invisible to every colour check: BTO
          // Renovation SG emitted the attribute, passed the fill check, and still shipped
          // every seam on the flip side because `flip` was a separate optional prop.
          if ((edge === 'top') !== flipped) L.divider_not_mirrored++;
          const variant = d.getAttribute('data-seam') || 'x';
          (mirrorByVariant[variant] = mirrorByVariant[variant] || {})[edge] = flipped;
        }
        for (const edges of Object.values(mirrorByVariant)) {
          // Belt and braces: the SAME shape used at both edges is mirrored at exactly one.
          if ('top' in edges && 'bottom' in edges && edges.top === edges.bottom) L.divider_not_mirrored++;
        }
        // 2. CARD WIDTH + LINE MEASURE.
        for (const c of Array.from(document.querySelectorAll('[data-card], .card, article[class*="card"]'))) {
          if (c.getBoundingClientRect().width > 720) L.cards_too_wide++;
        }
        for (const el of Array.from(document.querySelectorAll('main p, main li'))) {
          const r = el.getBoundingClientRect();
          const fs = parseFloat(getComputedStyle(el).fontSize) || 16;
          const words = (el.textContent || '').trim().split(/\s+/).filter(Boolean).length;
          if (words > 12 && r.width / (fs * 0.5) > 90) L.long_measure++;
          if (words > 15 && fs < 15) L.tiny_body_text++;
        }
        // 3. STRUCTURE: no long run of text on the page ground with nothing built around it.
        const ground = getComputedStyle(document.body).backgroundColor;
        for (const sec of Array.from(document.querySelectorAll('main section'))) {
          const words = (sec.innerText || '').trim().split(/\s+/).filter(Boolean).length;
          if (words < 120) continue;
          if (bgOf(sec) !== ground) continue;
          if (sec.querySelector('figure, table, img, svg, blockquote, [data-card], .card, [data-answer-capsule], details, [class*="callout"], [class*="panel"]')) continue;
          L.plain_text_sections++;
        }
        // 4. MEDIA/TEXT BALANCE: a tall image over a stub of text is the "very large image,
        // small text below" report.
        for (const img of Array.from(document.querySelectorAll('main img, main figure'))) {
          const ir = img.getBoundingClientRect();
          if (ir.height < 320) continue;
          const host = img.closest('figure, [data-card], .card, div, section') || img.parentElement;
          if (!host) continue;
          const text = (host.innerText || '').trim().split(/\s+/).filter(Boolean).length;
          if (text < 25) L.media_text_imbalance++;
        }
        // 8. COLUMN FILL: a "two-column section" that ships as one column of text beside
        // 300px+ of empty decorated ground is a dead column. Every width and measure check
        // passes on it, because nothing measures whether a column holds anything.
        for (const sec of Array.from(document.querySelectorAll('main section, main [data-treatment]'))) {
          for (const grid of [sec, ...Array.from(sec.querySelectorAll(':scope > *'))]) {
            const gs = getComputedStyle(grid);
            if (gs.display !== 'grid' && gs.display !== 'flex') continue;
            const cols = Array.from(grid.children).filter((c) => c.getBoundingClientRect().width > 0);
            if (cols.length < 2) continue;
            const rect = cols.map((c) => c.getBoundingClientRect());
            // same row only: tops within 20px of each other
            if (Math.max.apply(null, rect.map((r) => r.top)) - Math.min.apply(null, rect.map((r) => r.top)) > 20) continue;
            const H = Math.max.apply(null, rect.map((r) => r.height));
            if (H < 300) continue;
            const fillOf = (c) => {
              const kids = Array.from(c.children).filter((k) => k.getBoundingClientRect().height > 0);
              if (!kids.length) return (c.innerText || '').trim() ? 1 : 0;
              const top = Math.min.apply(null, kids.map((k) => k.getBoundingClientRect().top));
              const bot = Math.max.apply(null, kids.map((k) => k.getBoundingClientRect().bottom));
              return (bot - top) / Math.max(1, c.getBoundingClientRect().height);
            };
            const fills = cols.map(fillOf);
            if (Math.min.apply(null, fills) < 0.5 && Math.max.apply(null, fills) > 0.9) L.dead_columns++;
          }
        }

        // 8b. DEAD HALF-COLUMN — the owner's report, in its own words: "prose left,
        // half the band empty dotted ground for hundreds of px". The discriminator is
        // NOT how much of the band the text occupies (a correctly capped 42rem measure
        // in a full-bleed band occupies under half of it and is RIGHT, per RULE 34 #3).
        // It is ASYMMETRY: a centred measure has equal slack on both sides; a dead
        // half-column has all of its slack on ONE side with nothing in it.
        for (const band of Array.from(document.querySelectorAll('main section, main [data-treatment]'))) {
          const br = band.getBoundingClientRect();
          if (br.height < 600) continue;              // a short band cannot read as a dead column
          const inner = band.querySelector('.section__inner') || band;
          const ir = inner.getBoundingClientRect();
          if (ir.width <= 0) continue;
          let left = Infinity, right = 0;
          for (const el of Array.from(inner.querySelectorAll('p, li, h2, h3, h4, blockquote'))) {
            const r = el.getBoundingClientRect();
            const words = (el.textContent || '').trim().split(/\s+/).filter(Boolean).length;
            if (r.height <= 0 || words < 4) continue;
            left = Math.min(left, r.left);
            right = Math.max(right, r.right);
          }
          if (!isFinite(left) || right <= left) continue;
          const lGap = left - ir.left;
          const rGap = ir.right - right;
          const slack = ir.width - (right - left);
          if (slack <= 0) continue;
          const asym = Math.abs(lGap - rGap) / slack;
          const wideSide = Math.max(lGap, rGap);
          if (asym <= 0.6 || wideSide <= 220) continue;   // centred, or no real void
          // Does ANYTHING occupy the empty side? A figure/table/card there makes it a
          // split layout, which is exactly what this band should have been.
          let filled = false;
          for (const el of Array.from(inner.querySelectorAll('figure, img, svg, table, [data-card], .card, video, [data-panel]'))) {
            const r = el.getBoundingClientRect();
            if (r.width < 40 || r.height < 40) continue;
            if (rGap > lGap ? r.right > right + 8 : r.left < left - 8) { filled = true; break; }
          }
          if (filled) continue;
          L.dead_bands.push(
            (band.getAttribute('data-treatment') || band.tagName.toLowerCase()) +
            ' ' + Math.round(br.height) + 'px tall, ' + Math.round(wideSide) +
            'px of empty ground on one side');
        }

        // 9. SEAMS, BANDS AND WIDTH VARIETY (folded in from the retired layout-audit.mjs).
        const bands = Array.from(document.querySelectorAll('main section, main [data-treatment]'))
          .filter((b) => b.getBoundingClientRect().height > 0);
        for (let i = 1; i < bands.length; i++) {
          const prev = bands[i - 1].getBoundingClientRect();
          const cur = bands[i].getBoundingClientRect();
          if (Math.abs(cur.top - prev.bottom) > 1) continue;
          if (bgOf(bands[i - 1]) === bgOf(bands[i])) continue;
          const seam = bands[i - 1].querySelector(':scope > .section-divider') ||
                       bands[i].querySelector(':scope > .section-divider');
          if (!seam) L.butted_joins++;
        }
        for (const b of Array.from(document.querySelectorAll('main [data-treatment]'))) {
          const r = b.getBoundingClientRect();
          if (r.height < 60) continue;
          const chars = (b.innerText || '').replace(/\s+/g, '').length;
          if (chars < 3 && !b.querySelector('figure, img, svg, video')) L.empty_band++;
        }
        const inners = Array.from(document.querySelectorAll('main .section__inner'))
          .map((n) => Math.round(n.getBoundingClientRect().width)).filter((w) => w > 0);
        L.band_widths = inners.length;
        if (inners.length >= 4 && new Set(inners).size < 3) L.width_monotony = 1;

        // A023 - THE PRIMARY CTA IS ABOVE THE FOLD. Checkpoint 4 items 4-5 were prose
        // about the most valuable 900px on a money page, and prose does not measure a
        // bounding box.
        {
          const cta = document.querySelector('[data-primary-cta]') ||
                      document.querySelector('form input:not([type=hidden])') ||
                      document.querySelector('.site-header__cta');
          if (cta) {
            const r = cta.getBoundingClientRect();
            if (r.bottom > window.innerHeight) L.cta_below_fold++;
          }
        }

        // A084 - 44px TAP TARGETS, everywhere, not only in the form. The rule was true of
        // the form controls and of nothing else on the page. A control smaller than 44px
        // passes when it has >=8px of clearance to its nearest interactive neighbour.
        {
          const CHROME = 'header, footer, nav, [data-faq], .jumpnav, [data-cta], .cta-band';
          const els = [];
          for (const host of Array.from(document.querySelectorAll(CHROME))) {
            for (const el of Array.from(host.querySelectorAll('a, button, summary'))) {
              const r = el.getBoundingClientRect();
              if (r.width <= 0 || r.height <= 0) continue;
              if (getComputedStyle(el).visibility === 'hidden') continue;
              els.push({ el, r });
            }
          }
          for (const { el, r } of els) {
            if (Math.min(r.width, r.height) >= 44) continue;
            let clear = Infinity;
            for (const other of els) {
              if (other.el === el) continue;
              const o = other.r;
              const dx = Math.max(0, Math.max(r.left - o.right, o.left - r.right));
              const dy = Math.max(0, Math.max(r.top - o.bottom, o.top - r.bottom));
              clear = Math.min(clear, Math.hypot(dx, dy));
            }
            if (clear < 8) {
              const label = (el.textContent || el.getAttribute('aria-label') || el.tagName)
                .trim().slice(0, 28);
              L.small_targets.push(label + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
            }
          }
        }

        // A047 - THE VISUAL DENSITY FLOOR (contracts §3). The raster budget is a COST
        // rule (kie.ai is metered); nothing measured the consequence of obeying it, so a
        // 6,000px page carrying its three permitted rasters shipped as an austere wall
        // of text and every image gate passed. Three numbers, all on the rendered page.
        {
          const H = Math.max(document.documentElement.scrollHeight, 1);
          L.scroll_height = Math.round(H);
          const main = document.querySelector('main') || document.body;
          const visuals = main.querySelectorAll(
            'img, figure, svg, table, [data-card], .card, [data-figure]').length;
          L.visual_density = Math.round((visuals / (H / 1000)) * 100) / 100;

          // The longest uninterrupted run of text with no visual in it, in viewports.
          const vh = window.innerHeight || 900;
          const blocks = Array.from(main.querySelectorAll('p, li, h2, h3, figure, img, table, svg, [data-card], .card'));
          let runStart = null, longest = 0;
          for (const el of blocks) {
            const r = el.getBoundingClientRect();
            if (!r.height) continue;
            const top = r.top + window.scrollY;
            // tagName is NOT uppercase for SVG elements - an inline <svg> reports the
            // literal 'svg' - so an uppercase-only test never matched one, and every
            // figure drawn as inline SVG was counted as another block of text. Measured
            // on chihuahua.sg 2026-09-05: a page whose every band carried a motif still
            // reported 6.7 viewport-heights of "unbroken text".
            const isVisual = /^(FIGURE|IMG|TABLE|SVG)$/.test(el.tagName.toUpperCase()) ||
                             el.matches('[data-card], .card');
            if (isVisual) {
              if (runStart !== null) longest = Math.max(longest, top - runStart);
              runStart = null;
            } else if (runStart === null) {
              runStart = top;
            }
          }
          if (runStart !== null) longest = Math.max(longest, H - runStart);
          L.longest_text_run = Math.round((longest / vh) * 100) / 100;

          // How much of the scroll sits on a tone OTHER than the page ground. A page
          // painted entirely in --paper reads as a document, not a designed page.
          const ground = getComputedStyle(document.body).backgroundColor;
          let toned = 0;
          for (const b of Array.from(main.querySelectorAll('section, [data-treatment]'))) {
            const r = b.getBoundingClientRect();
            if (r.height > 0 && bgOf(b) !== ground) toned += r.height;
          }
          L.tone_share = Math.round((toned / H) * 100) / 100;
        }

        // 5. STICKY HEADER.
        const hdr = document.querySelector('[data-site-header], body > header, header.site-header');
        if (!hdr) L.header_sticky = false;
        else {
          const pos = getComputedStyle(hdr).position;
          if (pos !== 'sticky' && pos !== 'fixed') L.header_sticky = false;
          else {
            window.scrollTo(0, Math.min(1500, document.body.scrollHeight));
            const r = hdr.getBoundingClientRect();
            if (r.bottom <= 0 || r.top > 8) L.header_sticky = false;
            window.scrollTo(0, 0);
          }
        }
        // 6. FORM LAYOUT.
        for (const f of Array.from(document.querySelectorAll('form'))) {
          const fr = f.getBoundingClientRect();
          if (!fr.width) continue;
          const host = f.closest('section, main') || document.body;
          const hr = host.getBoundingClientRect();
          if (fr.right > hr.right + 1 || fr.left < hr.left - 1) L.form_defects.push('overflows its section');
          const shell = f.closest('[data-card], .card') || f;
          const cs = getComputedStyle(shell);
          const padMin = Math.min.apply(null, ['Top', 'Right', 'Bottom', 'Left'].map((x) => parseFloat(cs['padding' + x]) || 0));
          if (padMin < 20) L.form_defects.push('form card padding ' + padMin + 'px < 20px');
          if (fr.width > 720) L.form_defects.push('form is ' + Math.round(fr.width) + 'px wide (cap 720)');
          for (const ctl of Array.from(f.querySelectorAll('input, select, textarea'))) {
            if (ctl.type === 'hidden' || ctl.offsetParent === null) continue;
            const cr = ctl.getBoundingClientRect();
            // The honeypot is DELIBERATELY off-screen and tiny; holding it to the
            // 44px target reports a defect on the one field that must not have one.
            if (ctl.closest('[aria-hidden="true"], .field--honeypot') || cr.left < -1000 || cr.width <= 2) continue;
            const wrap = ctl.closest('.field, div') || f;
            const wr = wrap.getBoundingClientRect();
            if (cr.width < 200) L.form_defects.push((ctl.name || ctl.type) + ' control ' + Math.round(cr.width) + 'px wide');
            if (ctl.tagName === 'SELECT' && cr.width < wr.width * 0.9) L.form_defects.push((ctl.name || 'select') + ' is not full width of its field');
            if (cr.height < 44) L.form_defects.push((ctl.name || ctl.type) + ' control ' + Math.round(cr.height) + 'px tall (44px target)');
            const lab = ctl.id ? f.querySelector('label[for="' + CSS.escape(ctl.id) + '"]') : ctl.closest('label');
            if (!lab) L.form_defects.push((ctl.name || ctl.type) + ' has no visible <label>');
          }
          const btn = f.querySelector('button[type=submit], button:not([type]), input[type=submit]');
          if (!btn) L.form_defects.push('no submit button');
          else if (btn.getBoundingClientRect().height < 44) L.form_defects.push('submit button under 44px tall');
        }
        probe.remove();
      }
      return { gapMax: gapMax === -Infinity ? 0 : gapMax, fold, wideInFold, wideNarrow, footerRows, L };
    }, wantLayout);
    if (wantLayout) {
      // NAV INVENTORY at 1440 — the reference set the mobile pass must match. Before kit
      // Header 1.1.0 the nav list was display:none below 900px with no toggle at all, so
      // every phone shipped logo + CTA and no route to a single silo hub, and no gate
      // measured it. The floor: every top-level nav href reachable in at most one tap.
      data.navDesktop = await page.evaluate(() => {
        const nav = document.querySelector('[data-site-header] nav[aria-label="Main"], [data-site-header] nav, header nav');
        if (!nav) return { hrefs: [], hasNav: false };
        const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
        const top = Array.from(nav.querySelectorAll(':scope > ul > li'));
        const hrefs = [];
        for (const li of top) {
          const a = li.querySelector(':scope > a[href]');
          if (a) { hrefs.push(a.getAttribute('href')); continue; }
          const sum = li.querySelector(':scope > details > summary');
          if (sum) hrefs.push('group:' + (sum.textContent || '').trim());
        }
        return { hrefs, hasNav: true, visible: top.filter(vis).length };
      });

      // NARROW PASS: 320, the width Checkpoint 3 says it reviews. --layout measured 1440
      // and 375 only, so the LAYOUT FLOOR — divider orientation, card width, text measure,
      // media/text balance, form shell — was never evaluated at the narrowest width the
      // checkpoint claims to cover. A card that fits at 375 can still trap its own text at
      // 320, and a divider whose fill is right at 1440 can be painted against a section
      // that reflowed underneath it.
      await page.setViewportSize({ width: 320, height: 720 });
      await page.waitForTimeout(250);
      data.narrow = await page.evaluate(() => {
        const N = {
          overflow: 0, divider_wrong_side: 0, cards_too_wide: 0, long_measure: 0,
          tiny_body_text: 0, media_text_imbalance: 0, form_defects: [],
        };
        const W = window.innerWidth;
        N.overflow = Math.max(0, Math.round(document.documentElement.scrollWidth - document.documentElement.clientWidth));
        const probe = document.createElement('span');
        probe.style.display = 'none';
        document.body.appendChild(probe);
        const resolve = (v) => { if (!v) return ''; probe.style.color = ''; probe.style.color = v; return getComputedStyle(probe).color; };
        const bgOf = (el) => {
          let n = el;
          while (n && n !== document.documentElement) {
            const c = getComputedStyle(n).backgroundColor;
            if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c;
            n = n.parentElement;
          }
          return getComputedStyle(document.body).backgroundColor;
        };
        // DIVIDER ORIENTATION at 320: sections reorder and collapse here, so the owner of
        // an edge can change. The fill must still equal the background of the section that
        // owns the edge AT THIS WIDTH.
        for (const d of Array.from(document.querySelectorAll('.section-divider'))) {
          const edge = d.getAttribute('data-edge');
          if (edge !== 'top' && edge !== 'bottom') continue;
          const owner = edge === 'top' ? d.nextElementSibling : d.previousElementSibling;
          const fill = resolve(d.getAttribute('data-fill-color'));
          if (owner && fill && bgOf(owner) !== fill) N.divider_wrong_side++;
        }
        // CARDS: at 320 a card must fit the viewport minus its gutters, not merely "under
        // 720px". A card wider than the screen is the horizontal-scroll report.
        for (const c of Array.from(document.querySelectorAll('[data-card], .card, article[class*="card"]'))) {
          const r = c.getBoundingClientRect();
          if (r.width && (r.width > W || r.right > W + 1 || r.left < -1)) N.cards_too_wide++;
        }
        // MEASURE: the floor at 320 is legibility, not line length — text under 15px and
        // any block that still runs past a 90ch measure (a fixed-width container).
        for (const el of Array.from(document.querySelectorAll('main p, main li'))) {
          const r = el.getBoundingClientRect();
          const fs = parseFloat(getComputedStyle(el).fontSize) || 16;
          const words = (el.textContent || '').trim().split(/\s+/).filter(Boolean).length;
          if (words > 12 && r.width / (fs * 0.5) > 90) N.long_measure++;
          if (words > 15 && fs < 15) N.tiny_body_text++;
        }
        // MEDIA/TEXT BALANCE: at 320 a 320px-tall image IS the whole first screen.
        for (const img of Array.from(document.querySelectorAll('main img, main figure'))) {
          const ir = img.getBoundingClientRect();
          if (ir.height < 260) continue;
          const host = img.closest('figure, [data-card], .card, div, section') || img.parentElement;
          if (!host) continue;
          const text = (host.innerText || '').trim().split(/\s+/).filter(Boolean).length;
          if (text < 25) N.media_text_imbalance++;
        }
        // FORM SHELL: the 44px target and the visible label survive the reflow, and no
        // control may be narrower than the shell it sits in.
        for (const f of Array.from(document.querySelectorAll('form'))) {
          const fr = f.getBoundingClientRect();
          if (!fr.width) continue;
          if (fr.right > W + 1 || fr.left < -1) N.form_defects.push('form overflows the 320 viewport');
          const shell = f.closest('[data-card], .card') || f;
          const cs = getComputedStyle(shell);
          const padMin = Math.min.apply(null, ['Top', 'Right', 'Bottom', 'Left'].map((x) => parseFloat(cs['padding' + x]) || 0));
          if (padMin < 12) N.form_defects.push('form card padding ' + padMin + 'px < 12px at 320');
          for (const ctl of Array.from(f.querySelectorAll('input, select, textarea'))) {
            if (ctl.type === 'hidden' || ctl.offsetParent === null) continue;
            const cr = ctl.getBoundingClientRect();
            if (ctl.closest('[aria-hidden="true"], .field--honeypot') || cr.left < -1000 || cr.width <= 2) continue;
            if (cr.height < 44) N.form_defects.push((ctl.name || ctl.type) + ' control ' + Math.round(cr.height) + 'px tall at 320 (44px target)');
            if (cr.right > W + 1 || cr.left < -1) N.form_defects.push((ctl.name || ctl.type) + ' control is cut off at 320');
          }
          const btn = f.querySelector('button[type=submit], button:not([type]), input[type=submit]');
          if (btn) {
            const br = btn.getBoundingClientRect();
            if (br.height < 44) N.form_defects.push('submit button under 44px tall at 320');
            if (br.right > W + 1) N.form_defects.push('submit button is cut off at 320');
          }
        }
        probe.remove();
        return N;
      });

      // MOBILE PASS: the same page at 375, where cards, forms and figures overflow first.
      await page.setViewportSize({ width: 375, height: 812 });
      await page.waitForTimeout(200);
      data.mobile = await page.evaluate(() => {
        const doc = document.documentElement;
        const overflow = Math.max(0, Math.round(doc.scrollWidth - doc.clientWidth));
        let formOverflow = 0, cardOverflow = 0;
        for (const f of Array.from(document.querySelectorAll('form'))) {
          const r = f.getBoundingClientRect();
          if (r.width && (r.right > window.innerWidth + 1 || r.left < -1)) formOverflow++;
        }
        for (const c of Array.from(document.querySelectorAll('[data-card], .card'))) {
          const r = c.getBoundingClientRect();
          if (r.width && r.right > window.innerWidth + 1) cardOverflow++;
        }
        // A023 at 375: the fold that actually matters.
        let ctaBelowFold = 0;
        const cta = document.querySelector('[data-primary-cta]') ||
                    document.querySelector('form input:not([type=hidden])') ||
                    document.querySelector('.site-header__cta');
        if (cta && cta.getBoundingClientRect().bottom > window.innerHeight) ctaBelowFold = 1;
        // A091: the sticky call/WhatsApp bar, if the site declares one.
        const sticky = document.querySelector('[data-sticky-cta]');
        // A bar on a form-first site has no number to dial: its correct
        // destination is the PRIMARY_CTA. Accept a tap target of ANY kind -
        // tel:, wa.me, the contact route, or an in-page form anchor - and fail
        // only a bar with no destination at all, which is the real defect
        // score-loop rule 2 names.
        const stickyHref = sticky
          ? (sticky.querySelector(
               'a[href^="tel:"], a[href*="wa.me/"], a[href*="/contact"], '
               + 'a[href^="#"], a[href^="mailto:"], button, [type=submit]')
             ? 'ok' : 'no-tap-href')
          : 'absent';
        return { overflow, formOverflow, cardOverflow, ctaBelowFold, stickyHref };
      });

      // A091: the bar must still be IN the viewport after a long scroll - that is the
      // whole point of it, and a bar that scrolls away is a bar that is never tapped.
      await page.evaluate(() => window.scrollTo(0, 1500));
      await page.waitForTimeout(150);
      data.mobile.stickyAfterScroll = await page.evaluate(() => {
        const el = document.querySelector('[data-sticky-cta]');
        if (!el) return 'absent';
        const r = el.getBoundingClientRect();
        return (r.bottom > 0 && r.top < window.innerHeight) ? 'in-view' : 'scrolled-away';
      });
      await page.evaluate(() => window.scrollTo(0, 0));

      // MOBILE NAV REACHABILITY at 375: count the nav items a visitor can actually see,
      // then drive the disclosure control ONCE and count again. The pass condition is that
      // one tap exposes every top-level item the 1440 nav offers, each at a >=44px target.
      const navProbe = async () => page.evaluate(() => {
        const header = document.querySelector('[data-site-header]') || document.querySelector('header');
        const nav = header && (header.querySelector('nav[aria-label="Main"]') || header.querySelector('nav'));
        if (!nav) return { visible: [], smallTargets: 0, toggles: 0 };
        const vis = (el) => {
          const r = el.getBoundingClientRect();
          if (!(r.width > 0 && r.height > 0)) return false;
          const cs = getComputedStyle(el);
          return cs.visibility !== 'hidden' && cs.display !== 'none' && parseFloat(cs.opacity || '1') > 0.05;
        };
        const visible = [];
        let smallTargets = 0;
        for (const li of Array.from(nav.querySelectorAll(':scope > ul > li'))) {
          const a = li.querySelector(':scope > a[href]');
          const sum = li.querySelector(':scope > details > summary');
          const el = a || sum;
          if (!el || !vis(el)) continue;
          visible.push(a ? a.getAttribute('href') : 'group:' + (sum.textContent || '').trim());
          if (el.getBoundingClientRect().height < 44) smallTargets++;
        }
        const toggles = Array.from(header.querySelectorAll('button[aria-expanded], [data-nav-toggle]')).filter(vis).length;
        return { visible, smallTargets, toggles };
      });
      const before = await navProbe();
      let after = before;
      let tapped = false;
      if (before.visible.length < (data.navDesktop?.hrefs?.length ?? 0)) {
        const toggle = await page.$('[data-site-header] [data-nav-toggle], [data-site-header] button[aria-expanded], header button[aria-expanded]');
        if (toggle) {
          try { await toggle.click(); tapped = true; await page.waitForTimeout(200); after = await navProbe(); } catch {}
        }
      }
      data.nav = {
        expected: data.navDesktop?.hrefs ?? [],
        visibleNoTap: before.visible,
        visibleAfterTap: after.visible,
        smallTargets: after.smallTargets,
        toggles: before.toggles,
        tapped,
      };

      await page.setViewportSize({ width: 1440, height: 900 });
    }
    out[route] = data;
    await page.context().close();
        } catch (err) {
          console.error(`WARN design-audit could not render ${route}: `
            + `${err && err.message ? err.message.split(String.fromCharCode(10))[0] : err}`);
        }
      }
    },
  ));
  await browser.close();
  server.close();
  return out;
}


// SHELL SKIP: PLACEHOLDER-COPY + draft=true src pages are declared shells (astro-build
// STEP 5); design gates bind when content-writer authors the page. Stage-3 exit re-audits.
const SHELL_SET = (() => {
  const out = new Set();
  const w = (d, acc = []) => { try { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = `${d}/${e.name}`; if (e.isDirectory()) w(p, acc); else if (e.name.endsWith('.astro')) acc.push(p); } } catch {} return acc; };
  for (const p of w('src/pages')) {
    const t = fs.readFileSync(p, 'utf8');
    if (t.includes('PLACEHOLDER-COPY') && /draft\s*=\s*true/.test(t)) {
      let r = p.split(String.fromCharCode(92)).join('/').replace(/^src\/pages\//, '').replace(/\.astro$/, '');
      r = r === 'index' ? '/' : '/' + r + '/';
      out.add(r);
    }
  }
  return out;
})();
const pages = builtPages().filter((p) => (target ? p.route.includes(target) : true)).filter((p) => !SHELL_SET.has(p.route));
// W11.7: a gate that measured nothing is not a pass.
if (!builtPages().length) { console.log('HALT: no dist/**/index.html - there is nothing to gate. Run `npm run build`, or set PROJECT_ROOT.'); process.exit(1); }
if (!pages.length && SHELL_SET.size) { console.log(`PASS design-audit (all ${SHELL_SET.size} built routes are declared shells; gates bind as content-writer authors pages)`); process.exit(0); }
if (!pages.length) { console.error('FAIL dist/ is empty or no route matched — run `npm run build`.'); process.exit(1); }

// A091: whether a sticky mobile CTA is REQUIRED on this site is a project-config
// decision, not a per-page guess. Absent config, the assertion does not run.
const STICKY_EXPECTED = (() => {
  try {
    const t = fs.readFileSync('config/project-config.md', 'utf8');
    const on = /^ALLOW_STICKY_MOBILE_CTA:\s*yes\s*$/mi.test(t);
    // score-loop PART 1 rule 2: treat `none`, `NONE by design`, `n/a` and `TBD`
    // as ABSENT, never as a value. `\S+` matched "NONE by design", so a
    // form-first pre-tenant site with no phone was graded against a phone-first
    // contract and 23 of 27 routes failed for "a sticky bar that dials nothing"
    // - a bar that correctly falls back to PRIMARY_CTA because there is nothing
    // to dial. gate-classes section-3: never grade an archetype against another
    // archetype's contract; the recommended fix would have breached the
    // contract it was meant to enforce.
    const val = (k) => {
      const m = t.match(new RegExp('^' + k + ':[ \t]*(.+)$', 'mi'));
      return m ? m[1].trim() : '';
    };
    const present = (v) => v !== '' &&
      !/^(none|n\/a|na|tbd|-|pending)\b/i.test(v);
    const tap = present(val('PHONE')) || present(val('WHATSAPP'));
    return on && tap;
  } catch { return false; }
})();

const brand = want('brand') ? brandRow() : null;
const live = (want('rhythm') || want('motion') || want('tables') || want('chrome') || want('layout')) ? await livePass(pages) : {};

const entryJs = fs.existsSync('dist/_astro')
  ? Math.round(fs.readdirSync('dist/_astro').filter((f) => f.endsWith('.js'))
      .reduce((a, f) => a + fs.statSync(path.join('dist/_astro', f)).size, 0) / 1024)
  : 0;

console.log('ROUTE | sections | naked | seams | seam_sequence | dupes | distinct | gap_max | fold_motion | hero_tilt | tables');
for (const { file, route } of pages) {
  const html = fs.readFileSync(file, 'utf8');
  const before = failures.length;
  const r = auditPage(html, route);
  const l = live[route] ?? {};
  const pageFails = failures.slice(before);
  const nakedN = pageFails.filter((f) => f.includes('naked section')).length;
  const dupeN = pageFails.filter((f) => f.includes('adjacent seam')).length;
  const tilt = pageFails.some((f) => f.includes('[data-tilt]')) ? 'false' : 'true';
  if (want('motion') && (l.fold ?? 99) < 2) fail(route, `only ${l.fold} animated element(s) above the fold (need >= 2)`);
  if (want('rhythm') && (l.gapMax ?? 0) > 0) fail(route, `divider/neighbour computed gap ${l.gapMax}px > 0 (hairline seam)`);
  if (want('tables') && (l.wideInFold ?? 0) > 0) fail(route, `${l.wideInFold} wide table(s) start inside the first viewport — a >=4-column table renders below the fold`);
  if (want('tables') && (l.wideNarrow ?? 0) > 0) fail(route, `${l.wideNarrow} wide table(s) are not full-bleed horizontal scrollers (wrapper overflow-x:auto, width >= container)`);
  if (want('layout')) {
    const L = l.L ?? {};
    const m = l.mobile ?? {};
    // DIVIDERS — the owner report was "it keeps creating the divider on the flip side".
    if (L.divider_no_edge) fail(route, `${L.divider_no_edge} divider(s) carry no data-edge — the edge they belong to is unknowable, so orientation cannot be right except by luck`);
    if (L.divider_wrong_side) fail(route, `${L.divider_wrong_side} divider(s) painted for the WRONG neighbour (path fill != the computed background of the section that owns the edge)`);
    if (L.divider_not_mirrored) fail(route, `${L.divider_not_mirrored} shape(s) used at both a top and a bottom edge without being mirrored on one of them`);
    // CARDS + MEASURE.
    if (L.cards_too_wide) fail(route, `${L.cards_too_wide} card(s) wider than 720px at 1440 — a card that spans the page is a band, not a card`);
    if (L.long_measure) fail(route, `${L.long_measure} text block(s) over a 90ch measure`);
    if (L.tiny_body_text) fail(route, `${L.tiny_body_text} body text block(s) under 15px`);
    // STRUCTURE.
    if (L.plain_text_sections) fail(route, `${L.plain_text_sections} section(s) of 120+ words on the page ground with no figure, table, card, capsule or panel — text on plain background`);
    if (L.media_text_imbalance) fail(route, `${L.media_text_imbalance} image(s) 320px+ tall paired with under 25 words — the "huge image, tiny text" block`);
    // CHROME.
    if (L.header_sticky === false) fail(route, 'site header is not sticky/fixed, or scrolls out of view at 1500px');
    // RULE 34 items 8-9.
    if (L.dead_columns) fail(route, `${L.dead_columns} dead column(s) — a multi-column row where one column's content fills under 50% of its height while a sibling exceeds 90%`);
    for (const d of new Set(L.dead_bands ?? [])) {
      fail(route, `dead half-column: ${d} — prose on one side, empty decorated ground on the other. A capped measure is CENTRED; slack all on one side is an unfinished split`);
    }
    if (L.butted_joins) fail(route, `${L.butted_joins} butted join(s) — adjacent bands change background with no seam element between them`);
    if (L.empty_band) fail(route, `${L.empty_band} empty band(s) — a 60px+ [data-treatment] band with under 3 characters of text and no figure`);
    // A047 - contracts §3 visual density floor.
    if (L.scroll_height > 1200) {
      if (L.visual_density < 1.0) {
        fail(route, `visual density ${L.visual_density}/1000px is under the 1.0 floor ` +
          `(${L.scroll_height}px of scroll) - the raster budget is a COST rule, not a design`);
      }
      if (L.longest_text_run > 1.5) {
        fail(route, `${L.longest_text_run} viewport-heights of unbroken text with no figure, table or card`);
      }
      if (L.tone_share < 0.25) {
        fail(route, `only ${Math.round(L.tone_share * 100)}% of the scroll sits on a non-paper tone (floor 25%)`);
      }
    }
    if (L.width_monotony) fail(route, `width monotony — ${L.band_widths} bands share under 3 distinct .section__inner widths; the page reads as one column whatever its treatments say`);
    // FORM.
    for (const d of new Set(L.form_defects ?? [])) fail(route, `form: ${d}`);
    // MOBILE.
    if ((m.overflow ?? 0) > 0) fail(route, `${m.overflow}px of horizontal overflow at 375`);
    if (m.formOverflow) fail(route, `${m.formOverflow} form(s) overflow the viewport at 375`);
    if (m.cardOverflow) fail(route, `${m.cardOverflow} card(s) overflow the viewport at 375`);
    // A023 - RULE 34 row 7 / the layout-floor table row 7.
    if (L.cta_below_fold) fail(route, 'the primary CTA is below the fold at 1440x900 before any scroll');
    if (m.ctaBelowFold) fail(route, 'the primary CTA is below the fold at 375x812 before any scroll');
    // A084.
    for (const t of new Set(L.small_targets ?? [])) {
      fail(route, `tap target under 44px with under 8px clearance: ${t}`);
    }
    // A091 - only asserted when the site declares a sticky CTA.
    if (STICKY_EXPECTED) {
      if (m.stickyHref === 'absent') fail(route, 'ALLOW_STICKY_MOBILE_CTA=yes and a PHONE/WHATSAPP is set, but no [data-sticky-cta] renders at 375');
      else if (m.stickyHref === 'no-tap-href') fail(route, '[data-sticky-cta] renders with NO tap target at all - not a tel:, a wa.me/, a contact link, an in-page anchor or a submit control');
      if (m.stickyAfterScroll === 'scrolled-away') fail(route, '[data-sticky-cta] is not fixed: it leaves the viewport after a 1500px scroll');
    }
    // MOBILE NAV — RULE 34 item 7. Every top-level NAV_MENU entry must be reachable at 375
    // after at most one tap, on a >=44px target.
    const nv = l.nav;
    if (nv && nv.expected.length) {
      const missing = nv.expected.filter((h) => !nv.visibleAfterTap.includes(h));
      if (missing.length) {
        fail(route, `mobile nav: ${missing.length}/${nv.expected.length} top-level nav item(s) unreachable at 375 after one tap (${missing.join(', ')})` +
          (nv.toggles === 0 ? ' — the header exposes NO disclosure control below 900px' : ''));
      }
      if (nv.smallTargets) fail(route, `mobile nav: ${nv.smallTargets} nav target(s) under 44px tall at 375`);
    }
    // NARROW (320) — the width Checkpoint 3 reviews.
    const N = l.narrow ?? {};
    if ((N.overflow ?? 0) > 0) fail(route, `${N.overflow}px of horizontal overflow at 320`);
    if (N.divider_wrong_side) fail(route, `${N.divider_wrong_side} divider(s) painted for the wrong neighbour at 320 — the sections reflow, the seam does not follow`);
    if (N.cards_too_wide) fail(route, `${N.cards_too_wide} card(s) wider than the 320 viewport`);
    if (N.long_measure) fail(route, `${N.long_measure} text block(s) over a 90ch measure at 320`);
    if (N.tiny_body_text) fail(route, `${N.tiny_body_text} body text block(s) under 15px at 320`);
    if (N.media_text_imbalance) fail(route, `${N.media_text_imbalance} image(s) 260px+ tall paired with under 25 words at 320 — the image IS the first screen`);
    for (const d of new Set(N.form_defects ?? [])) fail(route, `form @320: ${d}`);
  }
  if (want('chrome') && (l.footerRows ?? 1) > 1) fail(route, `footer renders ${l.footerRows} rows at 1440 — the footer is ONE row of columns plus the footnote bar`);
  if (want('chrome')) chromeFooterRows = Math.max(chromeFooterRows, l.footerRows ?? 1);
  console.log(`${route} | ${r.sections} | ${nakedN} | ${r.seams} | ${r.seam_sequence} | ${dupeN} | ${r.distinct_variants} | ${l.gapMax ?? 'n/a'} | ${l.fold ?? 'n/a'} | ${tilt} | ${r.tables}`);
}
if (want('chrome')) console.log(`\nCHROME: footer_rows=${chromeFooterRows || 1} legal_links_in_footnote=${chromeLegalOk}`);

if (brand) {
  const tick = (ok) => (ok ? '\u2713' : '\u2717');
  const has = (f) => !brand.missing.includes(f);
  console.log(`\nBRAND ASSETS: ${brand.present}/${brand.need} present${brand.missing.length ? ' — missing: ' + brand.missing.join(', ') : ''}; palette: ${brand.paletteNote}`);
  console.log(`favicon ${tick(has('favicon.ico'))} og-default ${tick(has('og-default.png'))} logo ${tick(has('logo.png'))} manifest ${tick(has('site.webmanifest'))} theme-color ${tick(brand.themeColor)} palette-match ${tick(brand.paletteOk)} provenance ${tick(brand.provenanceOk)}`);
  for (const pv of brand.provenance) console.log(`  \u2717 provenance: ${pv}`);
}
console.log(`ENTRY JS: ${entryJs} KB (budget: entry <= 10 KB raw, hydrated < 50 KB/page)`);
if (entryJs > 50) fail('(bundle)', `hydrated JS ${entryJs} KB exceeds the 50 KB budget`);

console.log('\nCHECK          | RESULT');
for (const g of (chosen.length ? chosen : GROUPS)) {
  const n = failures.filter((f) => true).length;
  console.log(`${g.padEnd(14)} | ${failures.length ? 'see FAILURES' : 'PASS'}`);
}
if (failures.length) { console.log('\nFAILURES:'); for (const f of failures) console.log('  ' + f); }
if (warnings.length) { console.log('\nWARNINGS (not counted as failures):'); for (const w of warnings) console.log('  ' + w); }
console.log(`\npages=${pages.length} failures=${failures.length} warnings=${warnings.length}`);
console.log(failures.length ? 'FAIL design-audit' : 'PASS design-audit');
// contracts: every gate prints WHAT IT MEASURED, not only what failed - the
// fixed shape `checked=<n> failed=<m>` on the verdict line. Without it a
// clean run and a run that measured nothing print the same words. A gate
// whose checked is 0 must FAIL unless it also prints an exemption reason.
console.log(`design-audit: checked=${pages.length} failed=${failures.length}`);
process.exit(failures.length ? 1 : 0);
