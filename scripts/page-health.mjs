#!/usr/bin/env node
// kit:page-health@1.0.0 — headless assertions over the BUILT site (or a live origin).
// Usage: node scripts/page-health.mjs [--all | <slug> ...] [--live <origin>]
//        [--titles|--dates|--schema|--landmarks|--overflow|--ga4|--motion|--figures|--sections|--hero|--images|--keyboard|--jump]
// No check flag = run them all. Exit 1 on any FAIL.
// Dep: playwright  (npm i -D playwright && npx playwright install chromium)
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { exemptionFor, EXEMPT } from './lib/exemptions.mjs';

// A site may ship ONE palette by design; config/project-config.md says so once as
// `SITE_THEMES: light`, and contrast-check.mjs already reads it. Hardcoding both here
// measured every route twice and failed it against a palette that does not exist.
const THEMES = (() => {
  try {
    const m = fs.readFileSync('config/project-config.md', 'utf8').match(/^SITE_THEMES:(.*)$/m);
    if (m) {
      const v = m[1].split('#')[0].split(',').map((x) => x.trim()).filter(Boolean);
      if (v.length) return v;
    }
  } catch { /* no config: both, as before */ }
  return ['light', 'dark'];
})();

const argv = process.argv.slice(2);
const CHECKS = ['titles', 'dates', 'schema', 'landmarks', 'overflow', 'ga4', 'motion', 'figures', 'sections', 'hero', 'images', 'keyboard', 'jump'];
const chosen = CHECKS.filter((c) => argv.includes(`--${c}`));
const want = (c) => chosen.length === 0 || chosen.includes(c);
const liveIdx = argv.indexOf('--live');
const LIVE = liveIdx === -1 ? null : argv[liveIdx + 1];
const slugs = argv.filter((a) => !a.startsWith('--') && a !== LIVE);
const ALL = argv.includes('--all') || slugs.length === 0;
// An unrecognised --flag used to leave `chosen` empty, which means "run everything" —
// so a typo, or a flag this script never implemented, reported PASS over the whole site.
const KNOWN = new Set([...CHECKS.map((c) => `--${c}`), '--all', '--live']);
const unknown = argv.filter((a) => a.startsWith('--') && !KNOWN.has(a));
if (unknown.length) {
  console.error(`FAIL unknown option(s): ${unknown.join(' ')}`);
  console.error(`     known: ${[...KNOWN].join(' ')}`);
  process.exit(2);
}

// Imported AFTER argument validation so a bad flag fails fast with a usable message
// even in a checkout where `npm i -D playwright` has not been run yet.
const { chromium } = await import('playwright');
const WIDTHS = [320, 375, 768, 1440];

// ---------------------------------------------------------------- section patterns
// contracts 22. The axis tuple lives in design-system.md, not in the HTML, so the MOTION
// axis is read from there and matched to the `data-section-pattern` slugs on the page.
// Without the shortlist there is nothing to assert and the honest answer is a refusal,
// not a green.
function patternAxes() {
  const out = new Map();
  let md = '';
  try { md = fs.readFileSync('design-system.md', 'utf8'); } catch { return out; }
  const AX = ['skeleton', 'container', 'rhythm', 'edge', 'emphasis', 'motion', 'texture', 'evidence'];
  for (const line of md.split(/\r?\n/)) {
    const m = line.match(/^\|\s*PAT-\d+\s*\|(.*)$/);
    if (!m) continue;
    const cells = m[1].split('|').map((c) => c.trim()).filter((c, i, a) => !(c === '' && i === a.length - 1));
    if (cells.length < 7) continue;
    const [slug, tup] = cells;
    const vals = tup.split('/').map((v) => v.trim().toLowerCase());
    if (vals.length !== AX.length) continue;
    const axes = {};
    AX.forEach((k, i) => { axes[k] = vals[i]; });
    out.set(slug, axes);
  }
  return out;
}
const PATTERN_AXES = patternAxes();


const failures = [];
const fail = (route, check, msg) => failures.push({ route, check, msg });
const decode = (s) => String(s).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');

function builtRoutes() {
  const out = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (e.name !== 'index.html') continue;
      let r = '/' + path.relative('dist', p).replace(/\\/g, '/').replace(/index\.html$/, '');
      r = r.replace(/\/{2,}/g, '/');
      out.push(r.endsWith('/') ? r : r + '/');
    }
  };
  walk('dist');
  return out.sort();
}

function serveDist(port = 8791) {
  const types = { '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
    '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain' };
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    let file = path.join('dist', p);
    if (p.endsWith('/')) file = path.join(file, 'index.html');
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      const alt = path.join('dist', p + '.html');
      if (fs.existsSync(alt)) file = alt;
      else { res.writeHead(404, { 'Content-Type': 'text/html' }); res.end('<h1>404</h1>'); return; }
    }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' });
    res.end(fs.readFileSync(file));
  });
  // ALWAYS an ephemeral port. The EADDRINUSE fallback below was not enough: on Windows a
  // leaked server bound to 0.0.0.0:<port> does NOT stop this one binding 127.0.0.1:<port>,
  // so listen() succeeds, no fallback fires, and the browser is served by the ZOMBIE - which
  // answers 404 to every route. That produced 360 "console 404" failures across the suite
  // that had nothing to do with the site, and cost a bespoke playwright script to find.
  // A gate has no reason to want a predictable port; port 0 cannot be hijacked.
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve({ server, origin: `http://127.0.0.1:${server.address().port}` }));
  });
}

function ledgerCopyDates() {
  const f = 'config/pipeline-ledger.csv';
  if (!fs.existsSync(f)) return {};
  const lines = fs.readFileSync(f, 'utf8').trim().split(/\r?\n/);
  const head = lines[0].split(',').map((h) => h.trim());
  const iS = head.indexOf('slug'), iD = head.indexOf('copy_date');
  const out = {};
  if (iS === -1 || iD === -1) return out;
  for (const l of lines.slice(1)) { const c = l.split(','); out[(c[iS] || '').trim()] = (c[iD] || '').trim(); }
  return out;
}

const routes = LIVE ? (ALL ? builtRoutes() : slugs.map((s) => (s.startsWith('/') ? s : `/${s}/`)))
                    : (ALL ? builtRoutes() : slugs.map((s) => (s.startsWith('/') ? s : `/${s}/`)));

// SHELL SKIP: declared shells (PLACEHOLDER-COPY + draft=true) are excluded until content
// lands; Stage-3 exit re-runs the full set. Samples were measured pre-marker at CP3.
const SHELL_SET = (() => {
  const out = new Set(); const fs2 = fs;
  const w = (d, acc = []) => { try { for (const e of fs2.readdirSync(d, { withFileTypes: true })) { const p = `${d}/${e.name}`; if (e.isDirectory()) w(p, acc); else if (e.name.endsWith('.astro')) acc.push(p); } } catch {} return acc; };
  for (const p of w('src/pages')) {
    const t = fs2.readFileSync(p, 'utf8');
    if (t.includes('PLACEHOLDER-COPY') && /draft\s*=\s*true/.test(t)) {
      let r = p.split(String.fromCharCode(92)).join('/').replace(/^src\/pages\//, '').replace(/\.astro$/, '');
      out.add(r === 'index' ? '/' : '/' + r + '/');
    }
  }
  return out;
})();
const routesFiltered = routes.filter((r) => !SHELL_SET.has(r));
if (!routesFiltered.length && SHELL_SET.size) { console.log(`PASS page-health (all ${SHELL_SET.size} routes are declared shells)`); process.exit(0); }
// W11.7: ONE refusal message across every dist-reading gate.
if (!routes.length) { console.error('HALT: no dist/**/index.html - there is nothing to gate. Run `npm run build`, or set PROJECT_ROOT.'); process.exit(1); }
routes.length = 0; routes.push(...routesFiltered);

const local = LIVE ? null : await serveDist();
const ORIGIN = LIVE || local.origin;
const copyDates = ledgerCopyDates();
const today = new Date().toISOString().slice(0, 10);
const browser = await chromium.launch();

// ROUTE-LEVEL CONCURRENCY. Per route this gate opens TEN browser contexts -
// 4 widths x 2 themes, plus reduced-motion and no-js - each with a fixed 3s or
// 1.5s settle wait for the reveal dead-man's switch. On a 27-route build that
// is 270 contexts and ~729s of pure waiting, measured at 752.9s end to end,
// and it made exit-gate letters (c) and (d) 752s EACH. The waits are a
// correctness requirement and are kept; what was wasteful was serialising
// them. Routes are independent - each opens its own contexts and only appends
// to `failures` - so a small worker pool is safe. PH_POOL tunes it.
const PH_POOL = Math.max(1, Number(process.env.PH_POOL || 8));
const _routeQueue = routes.slice();
await Promise.all(Array.from(
  { length: Math.min(PH_POOL, _routeQueue.length || 1) },
  async () => {
    for (;;) {
      const route = _routeQueue.shift();
      if (route === undefined) break;
  for (const width of WIDTHS) {
    for (const theme of THEMES) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      const consoleErrors = []; const badResponses = [];
      page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
      page.on('response', (r) => { if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`); });

      await page.goto(ORIGIN + route, { waitUntil: 'load' });
      await page.waitForTimeout(3000);   // reveal dead-man's switch is 2.5s

      // `badResponses` already holds the URL behind a "Failed to load resource: 404".
      // Reporting only the browser's generic message made this gate unactionable: it took
      // a bespoke playwright script to learn WHICH resource was missing. Name it.
      if (consoleErrors.length) {
        const url = badResponses.length ? ` <- ${badResponses[0]}` : '';
        fail(route, 'console', `${consoleErrors.length} error(s) @${width}/${theme}: ${consoleErrors[0].slice(0, 120)}${url}`);
      }
      if (badResponses.length) fail(route, 'subresources', `${badResponses.length} 4xx/5xx @${width}: ${badResponses[0]}`);

      if (want('overflow')) {
        const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        if (over > 0) fail(route, 'overflow', `scrollWidth exceeds innerWidth by ${over}px @${width}/${theme}`);
      }

      if (want('images') && width === 1440 && theme === 'light') {
        const imgs = await page.evaluate(async () => {
          const out = [];
          for (const img of Array.from(document.images)) {
            img.loading = 'eager';
            if (!img.complete) { try { await img.decode(); } catch {} }
            out.push({ src: img.currentSrc || img.src, w: img.naturalWidth, hasDim: img.hasAttribute('width') && img.hasAttribute('height') });
          }
          return out;
        });
        for (const i of imgs) {
          if (i.w === 0) fail(route, 'images', `naturalWidth 0: ${i.src}`);
          if (!i.hasDim) fail(route, 'images', `img without width/height: ${i.src}`);
        }
        // Legal/utility routes are exempt with the error pages: the floor exists to stop a
        // THIN CONTENT page, and a privacy policy or terms page is neither thin nor content -
        // illustrating one is padding. (RTP Fix 2026-09-05)
        //
        // 2026-09-05: this was a SECOND inline utility-route list, which is the defect
        // contracts_check's one-exemption-impl rule exists to catch - two lists disagree the
        // moment either is edited. Ask the shared predicate instead; it is the same function
        // verify_page.py, audit_built_html.py and check-references.mjs ask.
        if (imgs.length < 2 && exemptionFor(route, 'FIGURE_EXEMPT_ROUTES') !== EXEMPT) {
          fail(route, 'images', `only ${imgs.length} <img> on the page (floor is 2)`);
        }
      }

      if (width === 1440 && theme === 'light') {
        const html = await page.content();

        if (want('titles')) {
          const t = decode((html.match(/<title>([\s\S]*?)<\/title>/) || [, ''])[1]).trim();
          const d = decode((html.match(/<meta name="description" content="([^"]*)"/) || [, ''])[1]).trim();
          const noindex = /name="robots"[^>]*noindex/.test(html);
          if (!noindex) {
            if (t.length > 60) fail(route, 'titles', `title ${t.length} chars > 60`);
            if (d.length < 140 || d.length > 158) fail(route, 'titles', `description ${d.length} chars outside 140-158`);
          }
          console.log(`TITLE ${route} | title_len=${t.length} | desc_len=${d.length}`);
        }

        if (want('dates')) {
          const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]).join(' ');
          const dm = (ld.match(/"dateModified":"(\d{4}-\d{2}-\d{2})/) || [, ''])[1];
          // A publisher's dateline says "Reviewed 18 August 2026", not "Last updated".
          // The narrower vocabulary failed 57 pages that carried a visible date in the
          // hero (Insight User Conference, 2026-09-05). Accept the wordings a reader
          // would recognise as a dateline, and both date orders.
          const visible = (html.replace(/<[^>]+>/g, ' ').match(/(?:Last updated|updated|Reviewed(?: on)?|Published|Checked against[^0-9]*)\s*([0-9]{1,2}\s+\w+\s+[0-9]{4}|\w+\s+[0-9]{1,2},?\s+[0-9]{4}|\d{4}-\d{2}-\d{2})/i) || [, ''])[1];
          const slug = route.replace(/^\/|\/$/g, '').split('/').pop() || 'index';
          if (dm) {
            if (dm > today) fail(route, 'dates', `dateModified ${dm} is in the future`);
            const cd = copyDates[slug];
            if (cd && dm < cd) fail(route, 'dates', `dateModified ${dm} predates ledger copy_date ${cd}`);
            if (!visible) fail(route, 'dates', 'schema dateModified present but no visible dateline');
          }
        }

        if (want('schema')) {
          const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
          const nodes = [];
          for (const b of blocks) {
            try { const j = JSON.parse(b); nodes.push(...(j['@graph'] ?? [j])); }
            catch { fail(route, 'schema', 'invalid JSON-LD block'); }
          }
          const exempt = /\/(404|thank-you|could-not-send)\/?\//.test(route + '/') || /noindex/.test(html.match(/<meta name="robots"[^>]*>/)?.[0] ?? '');
          const count = (pred) => nodes.filter(pred).length;
          const orgs = count((n) => String(n['@id'] ?? '').endsWith('#organization'));
          const sites = count((n) => String(n['@id'] ?? '').endsWith('#website'));
          const webpages = count((n) => ['WebPage', 'CollectionPage', 'Article', 'BlogPosting', 'MedicalWebPage', 'AboutPage', 'ContactPage'].includes(n['@type']));
          const crumbs = count((n) => n['@type'] === 'BreadcrumbList');
          if (exempt) { if (orgs || sites) fail(route, 'schema', 'noindex page emits business schema'); }
          else {
            if (orgs !== 1) fail(route, 'schema', `#organization nodes = ${orgs} (want 1)`);
            if (sites !== 1) fail(route, 'schema', `#website nodes = ${sites} (want 1)`);
            if (webpages > 1) fail(route, 'schema', `${webpages} WebPage-family nodes for one URL`);
            if (crumbs > 1) fail(route, 'schema', `${crumbs} BreadcrumbList nodes`);
          }
          if (/"name":\s*(null|""|undefined)/.test(JSON.stringify(nodes))) fail(route, 'schema', 'empty name in JSON-LD');
        }

        if (want('landmarks')) {
          const l = await page.evaluate(() => {
            const levels = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).map((h) => Number(h.tagName[1]));
            let skip = null;
            for (let i = 1; i < levels.length; i++) if (levels[i] - levels[i - 1] > 1) { skip = `${levels[i - 1]}->${levels[i]}`; break; }
            return {
              mains: document.querySelectorAll('main').length,
              h1s: document.querySelectorAll('h1').length,
              // A <p> inside a <figure> is only a defect when it is loose prose the
              // author should have put in <figcaption>. The standard markup for a pull
              // quote is figure > blockquote > p (it is MDN's own example), and a
              // <details> disclosure inside a figure is prose that belongs to the figure,
              // so neither is counted. Same question, narrower answer.
              badP: Array.from(document.querySelectorAll('form p, figure p, nav p'))
                .filter((el) => !el.closest('blockquote') && !el.closest('details')
                                && !el.closest('figcaption')
                                // an ARIA live region inside a form is the accessible way
                                // to announce a submit result, not loose prose
                                && !el.hasAttribute('aria-live') && el.getAttribute('role') !== 'status').length,
              skip,
            };
          });
          if (l.mains !== 1) fail(route, 'landmarks', `<main> count = ${l.mains}`);
          if (l.h1s !== 1) fail(route, 'landmarks', `<h1> count = ${l.h1s}`);
          if (l.badP) fail(route, 'landmarks', `${l.badP} <p> inside form/figure/nav`);
          if (l.skip) fail(route, 'landmarks', `heading level skip ${l.skip}`);
        }

        if (want('ga4')) {
          const ok = await page.evaluate(() => typeof window.gtag === 'function');
          if (!ok) fail(route, 'ga4', 'window.gtag is not a function (define:vars IIFE or missing config)');
        }

        if (want('hero')) {
          // E4 (owner decision 2026-09-03): gate against the DECLARED archetype.
          // Hero.astro implements five (split-panel, full-bleed-photo,
          // centered-statement, editorial-ledger, product-first) and stamps the chosen
          // one as data-hero-archetype. This check used to demand [data-tilt] and a
          // two-column shape on EVERY page, so a legitimately single-column
          // centered-statement hero failed for being what it was chosen to be.
          const ARCHETYPES = ['split-panel', 'full-bleed-photo', 'centered-statement',
                              'editorial-ledger', 'product-first'];
          const h = await page.evaluate(() => {
            const hero = document.querySelector('.hero, [data-hero-archetype]');
            const els = Array.from(document.querySelectorAll('[data-reveal], .hero img, .hero [data-tilt]'));
            const zero = els.filter((e) => getComputedStyle(e).opacity !== '1').length;
            const card = document.querySelectorAll('.hero .hero__card').length;
            const formInTilt = document.querySelectorAll('.hero [data-tilt] form, .hero [data-tilt] input').length;
            return {
              total: els.length,
              zero,
              archetype: hero ? hero.getAttribute('data-hero-archetype') : null,
              tilt: document.querySelectorAll('.hero [data-tilt], header + * [data-tilt]').length,
              cards: card,
              formInTilt,
              cols: hero ? getComputedStyle(hero.querySelector('.hero__inner') || hero).gridTemplateColumns : '',
            };
          });
          if (h.zero > 0) fail(route, 'hero', `${h.zero}/${h.total} reveal/hero elements still at opacity != 1 after 3s`);
          if (!h.archetype) {
            fail(route, 'hero', `no data-hero-archetype on the hero — declare one of: ${ARCHETYPES.join(' | ')} (design-system.md ## Direction)`);
          } else if (!ARCHETYPES.includes(h.archetype)) {
            fail(route, 'hero', `data-hero-archetype="${h.archetype}" is not one of the five: ${ARCHETYPES.join(' | ')}`);
          }
          // EVERY archetype owes ONE above-the-fold tilt element — that is the shared
          // contract, and the ghost mark satisfies it on the solo archetypes.
          if (h.tilt < 1) fail(route, 'hero', `no [data-tilt] element in the hero (archetype ${h.archetype || '?'})`);
          // A FORM IS NEVER INSIDE THE TILT WRAPPER, in any archetype: tilting a field
          // the visitor is typing into is hostile.
          if (h.formInTilt > 0) fail(route, 'hero', `${h.formInTilt} form field(s) inside [data-tilt] — tilt the card above the form, or use no tilt`);
          // ONE CARD PER COLUMN MAXIMUM ("two cards on hero is too squeezy", owner ES24H).
          if (h.cards > 1) fail(route, 'hero', `${h.cards} hero cards — one card per column maximum`);
          // The two SOLO archetypes are single-column BY CHOICE; the three panelled ones
          // must actually render two columns at 1440.
          // TRACK COUNT, NOT COMMAS (2026-09-05). getComputedStyle returns the resolved
          // tracks space-separated ("589.594px 482.406px"); a comma never appears, so the
          // comma test failed all 54 genuinely two-column heroes. Count the tracks, ignoring
          // any spaces inside functions like minmax(...) and [line-names].
          const trackCount = (v) => {
            const s = String(v || '').trim();
            if (!s || s === 'none') return 0;
            let depth = 0, n = 1, seen = false;
            for (const ch of s) {
              if (ch === '(' || ch === '[') depth++;
              else if (ch === ')' || ch === ']') depth--;
              else if (/\s/.test(ch) && depth === 0) { if (seen) { n++; seen = false; } }
              else if (depth === 0) seen = true;
            }
            return seen || n > 1 ? n : 1;
          };
          const twoCol = trackCount(h.cols) >= 2;
          if (['split-panel', 'editorial-ledger', 'product-first'].includes(h.archetype) && !twoCol)
            fail(route, 'hero', `archetype ${h.archetype} declares two columns; the hero renders one (grid-template-columns: ${h.cols || 'none'})`);
          if (['centered-statement', 'full-bleed-photo'].includes(h.archetype) && twoCol)
            fail(route, 'hero', `archetype ${h.archetype} is single-column by definition; the hero renders ${h.cols}`);
        }

        if (want('motion')) {
          const m = await page.evaluate(async () => {
            const track = document.querySelector('[data-marquee-track]');
            if (!track) return { present: false };
            const cs = getComputedStyle(track);
            const x1 = track.getBoundingClientRect().x;
            await new Promise((r) => setTimeout(r, 500));
            const x2 = track.getBoundingClientRect().x;
            const n = Number(track.dataset.tiles || 4);
            const container = track.parentElement;
            return {
              present: true, name: cs.animationName, state: cs.animationPlayState,
              moved: Math.abs(x2 - x1) > 0,
              coverage: track.scrollWidth - track.scrollWidth / n >= (container?.clientWidth ?? 0),
            };
          });
          if (m.present) {
            if (m.name === 'none') fail(route, 'motion', 'marquee animationName is none');
            if (m.state !== 'running') fail(route, 'motion', `marquee animationPlayState = ${m.state}`);
            if (!m.moved) fail(route, 'motion', 'marquee x did not change over 500ms (visually static band)');
            if (!m.coverage) fail(route, 'motion', 'marquee coverage arithmetic fails at this width');
          }
        }

        if (want('figures')) {
          // The STATIC half (>=2 <figure data-figure>, >=1 data-figure-interactive) is
          // audit_built_html.py --figures. This is the BEHAVIOUR half, and it was cited in
          // the skill as `page-health.mjs --figures` for months while no such flag existed:
          // the flag fell through to "run everything", so the assertion that the interactive
          // figure DEMONSTRABLY MOVES has never actually run. An attribute is not a behaviour.
          const f = await page.evaluate(async () => {
            const nodes = [...document.querySelectorAll('[data-figure-interactive]')];
            const still = [];
            for (const el of nodes) {
              const anims = el.getAnimations ? el.getAnimations({ subtree: true }).length : 0;
              const cs = getComputedStyle(el);
              const declared = cs.animationName !== 'none' || cs.transitionDuration !== '0s';
              const interactive = el.matches('a,button,[tabindex],[onclick]') ||
                                  !!el.querySelector('a,button,[tabindex],[onclick]');
              if (!anims && !declared && !interactive) still.push(el.id || el.className || '(unnamed)');
            }
            // measured in the SAME pass at this viewport
            const tiny = [], overflow = [];
            for (const t of document.querySelectorAll('svg text')) {
              const px = parseFloat(getComputedStyle(t).fontSize) || 0;
              if (px && px < 11) tiny.push(t.textContent.trim().slice(0, 24) + ` (${px}px)`);
              try {
                const b = t.getBBox();
                const owner = t.closest('g[data-lane]') || t.ownerSVGElement;
                const vb = owner && owner.viewBox && owner.viewBox.baseVal;
                if (vb && vb.width && (b.x < vb.x - 0.5 || b.x + b.width > vb.x + vb.width + 0.5))
                  overflow.push(t.textContent.trim().slice(0, 24));
              } catch { /* getBBox throws on a detached or display:none node */ }
            }
            return { total: nodes.length, still, tiny, overflow };
          });
          if (f.still.length)
            fail(route, 'figures', `${f.still.length}/${f.total} [data-figure-interactive] do not move and are not interactive: ${f.still.slice(0, 3).join(', ')}`);
          if (f.tiny.length)
            fail(route, 'figures', `${f.tiny.length} svg text node(s) under 11px @${width}: ${f.tiny.slice(0, 3).join(', ')}`);
          if (f.overflow.length)
            fail(route, 'figures', `${f.overflow.length} svg label(s) outside their viewBox/lane @${width}: ${f.overflow.slice(0, 3).join(', ')}`);
        }

        if (want('sections')) {
          // (1) DECLARED MOTION MOVES. Same predicate as the figure gate: a real
          // animation, a non-none computed animation/transition, an SMIL child, or a
          // resolvable interaction handler inside the pattern.
          const declared = [...PATTERN_AXES.entries()]
            .filter(([, ax]) => ax.motion && ax.motion !== 'none')
            .map(([slug]) => slug);
          if (!PATTERN_AXES.size) {
            fail(route, 'sections', 'design-system.md carries no `| PAT-n |` rows - the section-pattern shortlist (contracts 22) is missing, so pattern behaviour is unmeasurable');
          } else {
            const m = await page.evaluate((moving) => {
              const nodes = [...document.querySelectorAll('[data-section-pattern]')];
              const still = [], empty = [];
              for (const el of nodes) {
                const slug = el.getAttribute('data-section-pattern');
                if (!el.textContent.trim()) empty.push(slug);
                if (!moving.includes(slug)) continue;
                const anims = el.getAnimations ? el.getAnimations({ subtree: true }).length : 0;
                const cs = getComputedStyle(el);
                const own = cs.animationName !== 'none' || cs.transitionDuration !== '0s';
                const child = [...el.querySelectorAll('*')].some((c) => {
                  const s = getComputedStyle(c);
                  return s.animationName !== 'none' || s.transitionDuration !== '0s';
                });
                const smil = !!el.querySelector('animate,animateTransform,animateMotion,set');
                const handler = el.matches('a,button,[tabindex],[onclick]') ||
                                !!el.querySelector('a,button,[tabindex],[onclick]') ||
                                el.hasAttribute('data-pattern-motion');
                if (!anims && !own && !child && !smil && !handler) still.push(slug);
              }
              return { total: nodes.length, slugs: nodes.map((n) => n.getAttribute('data-section-pattern')), still, empty };
            }, declared);
            const live = m.slugs.filter((s) => declared.includes(s)).length;
            if (m.still.length)
              fail(route, 'sections', `patterns_motion_live ${live - m.still.length}/${live} - declares motion and does not move: ${[...new Set(m.still)].slice(0, 3).join(', ')}`);
            if (m.empty.length)
              fail(route, 'sections', `${m.empty.length} pattern root(s) render no text: ${[...new Set(m.empty)].slice(0, 3).join(', ')}`);

            // (2) REDUCED MOTION KILLS TRANSFORMS, NEVER CONTENT.
            const rmCtx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
            const rmPage = await rmCtx.newPage();
            await rmPage.goto(ORIGIN + route, { waitUntil: 'load' });
            await rmPage.waitForTimeout(3000);
            const rm = await rmPage.evaluate(() => {
              const out = [];
              for (const el of document.querySelectorAll('[data-section-pattern]')) {
                const cs = getComputedStyle(el);
                if (!el.textContent.trim() || cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) === 0)
                  out.push(el.getAttribute('data-section-pattern'));
              }
              return out;
            });
            await rmCtx.close();
            if (rm.length)
              fail(route, 'sections', `patterns_reduced_motion_ok - ${rm.length} pattern(s) hide their content under prefers-reduced-motion: ${[...new Set(rm)].slice(0, 3).join(', ')}`);

            // (3) JS OFF. Every pattern is server-rendered, and a horizontal rail still
            // scrolls natively - the whole reason carousels here are scroll-snap and not
            // a library.
            const njCtx = await browser.newContext({ viewport: { width, height: 900 }, javaScriptEnabled: false });
            const njPage = await njCtx.newPage();
            await njPage.goto(ORIGIN + route, { waitUntil: 'load' });
            const rails = [...PATTERN_AXES.entries()]
              .filter(([, ax]) => ax.skeleton === 'horizontal-rail')
              .map(([slug]) => slug);
            const nj = await njPage.evaluate((railSlugs) => {
              const present = [...document.querySelectorAll('[data-section-pattern]')]
                .map((el) => el.getAttribute('data-section-pattern'));
              const stuck = [];
              for (const el of document.querySelectorAll('[data-section-pattern]')) {
                const slug = el.getAttribute('data-section-pattern');
                if (!railSlugs.includes(slug)) continue;
                const scroller = [el, ...el.querySelectorAll('*')].find((n) => {
                  const ox = getComputedStyle(n).overflowX;
                  return ox === 'auto' || ox === 'scroll';
                });
                if (!scroller) stuck.push(slug);
              }
              return { present, stuck };
            }, rails);
            await njCtx.close();
            const lostOff = m.slugs.filter((s) => !nj.present.includes(s));
            if (lostOff.length)
              fail(route, 'sections', `patterns_nojs_ok - ${lostOff.length} pattern(s) vanish with JS off: ${[...new Set(lostOff)].slice(0, 3).join(', ')}`);
            if (nj.stuck.length)
              fail(route, 'sections', `patterns_nojs_ok - horizontal-rail pattern(s) with no native overflow-x scroller: ${[...new Set(nj.stuck)].slice(0, 3).join(', ')}`);
            console.log(`SECTIONS ${route} | patterns=${m.total} distinct=${new Set(m.slugs).size} declares_motion=${live} rails=${nj.stuck.length === 0 ? 'scrollable' : 'STUCK'}`);
          }
        }

        if (want('jump')) {
          // A085 - EVERY IN-PAGE JUMP LANDS BELOW THE STICKY HEADER. The header is
          // sticky by contract, so without scroll-margin-top the target heading sits
          // UNDER the bar and the visitor sees the tail of the previous section. Nothing
          // measured it, and it is the one defect that makes a working link read as
          // broken. Drive each hash for real; a computed CSS value would not prove the
          // header height token is the one actually in effect.
          const hashes = await page.evaluate(() => {
            const out = new Set();
            for (const a of Array.from(document.querySelectorAll('a[href^="#"]'))) {
              const h = a.getAttribute('href');
              if (h && h.length > 1) out.add(h);
            }
            if (document.getElementById('contact-form')) out.add('#contact-form');
            return [...out].slice(0, 12);
          });
          for (const h of hashes) {
            const res = await page.evaluate((hash) => {
              const el = document.querySelector(hash);
              if (!el) return { missing: true };
              location.hash = hash;
              const hdr = document.querySelector('[data-site-header], body > header, header.site-header');
              const hb = hdr ? hdr.getBoundingClientRect().bottom : 0;
              return { missing: false, top: el.getBoundingClientRect().top, headerBottom: hb };
            }, h);
            await page.waitForTimeout(80);
            if (res.missing) {
              fail(route, 'jump', `in-page link ${h} points at no element`);
            } else if (res.top < res.headerBottom - 1) {
              fail(route, 'jump',
                `${h} lands ${Math.round(res.headerBottom - res.top)}px UNDER the sticky header ` +
                '(add scroll-margin-top: calc(var(--header-height) + 1rem) — kit global.css ships it)');
            }
          }
          await page.evaluate(() => { history.replaceState(null, '', location.pathname); window.scrollTo(0, 0); });
        }

        if (want('keyboard')) {
          // THE KEYBOARD PATH. The components get :focus-visible right (ContactForm,
          // Figure, SvgStepLadder all paint a ring) and NOTHING measured the path between
          // them: no skip-link assertion, no focus order, no trap check — on figures the
          // kit makes tabbable BY CONTRACT (Figure.astro renders tabindex="0" on every
          // canvas). A ring on an element nobody can reach is decoration.
          const k = await page.evaluate(() => {
            const sel = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';
            const nodes = Array.from(document.querySelectorAll(sel))
              .filter((el) => el.offsetParent !== null || getComputedStyle(el).position === 'fixed');
            return {
              positive: nodes.filter((el) => Number(el.getAttribute('tabindex')) > 0)
                .map((el) => el.tagName.toLowerCase() + '[tabindex=' + el.getAttribute('tabindex') + ']').slice(0, 3),
              focusables: nodes.length,
              figures: document.querySelectorAll('[data-figure-interactive], .figure__canvas[tabindex="0"]').length,
              skip: (() => {
                const a = document.querySelector('a.skip-link, a[href="#main"], a[href^="#"][class*="skip"]');
                if (!a) return null;
                const first = nodes[0];
                return { href: a.getAttribute('href'), isFirst: first === a, targetExists: !!document.querySelector(a.getAttribute('href')) };
              })(),
            };
          });

          if (!k.skip) fail(route, 'keyboard', 'no skip link — a keyboard reader tabs the whole header on every page');
          else {
            if (!k.skip.isFirst) fail(route, 'keyboard', 'the skip link is not the first focusable element');
            if (!k.skip.targetExists) fail(route, 'keyboard', `skip link points at ${k.skip.href}, which no element carries`);
          }
          if (k.positive.length) fail(route, 'keyboard', `positive tabindex breaks DOM focus order: ${k.positive.join(', ')}`);

          // WALK the path. Focus order must follow document order, every stop must show a
          // visible indicator, and the walk must not get stuck.
          await page.evaluate(() => { document.body.focus(); window.scrollTo(0, 0); });
          const seen = [];
          const MAX = Math.min(60, k.focusables + 5);
          let stuck = 0, invisible = [], outOfOrder = 0, reachedFigure = 0;
          let prevPos = -1;
          for (let i = 0; i < MAX; i++) {
            await page.keyboard.press('Tab');
            const cur = await page.evaluate(() => {
              const el = document.activeElement;
              if (!el || el === document.body) return null;
              const all = Array.from(document.querySelectorAll('*'));
              const cs = getComputedStyle(el);
              const r = el.getBoundingClientRect();
              const ring = (parseFloat(cs.outlineWidth) || 0) > 0 && cs.outlineStyle !== 'none';
              const shadow = cs.boxShadow && cs.boxShadow !== 'none';
              return {
                pos: all.indexOf(el),
                // className on an SVG element is an SVGAnimatedString, which stringifies to
                // "[object Object]" - so every SVG focus stop reported itself as that and the
                // failure named nothing. Read the attribute.
                id: el.id || el.getAttribute('class') || el.tagName.toLowerCase(),
                figure: !!el.closest('[data-figure-interactive], .figure__canvas'),
                indicator: ring || shadow,
                offscreen: r.width === 0 && r.height === 0,
              };
            });
            if (!cur) break;                       // focus left the document: no trap
            if (seen.length && cur.pos === seen[seen.length - 1].pos) { stuck++; if (stuck > 2) break; }
            else stuck = 0;
            if (cur.pos < prevPos) outOfOrder++;
            prevPos = cur.pos;
            if (cur.figure) reachedFigure++;
            if (!cur.indicator && !cur.offscreen) invisible.push(cur.id);
            seen.push(cur);
          }
          if (stuck > 2) fail(route, 'keyboard', `focus stopped advancing at "${seen[seen.length - 1]?.id}" — a keyboard trap`);
          if (outOfOrder > 1) fail(route, 'keyboard', `${outOfOrder} focus stop(s) jump backwards in the DOM — the visual order and the tab order disagree`);
          if (invisible.length) fail(route, 'keyboard', `${invisible.length} focus stop(s) paint no visible indicator: ${invisible.slice(0, 3).join(', ')}`);
          // The walk is capped at 60 stops, so on a long page (a roster with 150+ links)
          // it never reaches the figures and "unreachable" would be the CAP talking, not
          // the page. Assert reachability only when the walk could cover every focusable.
          const walkCoveredAll = MAX >= k.focusables;
          if (k.figures && !reachedFigure && walkCoveredAll) fail(route, 'keyboard', `${k.figures} interactive figure(s) are tabindex="0" by contract and none was reached in ${MAX} tab stops`);
          else if (k.figures && !reachedFigure) console.log(`KEYBOARD ${route} | figure reachability NOT MEASURED: ${k.focusables} focusables > ${MAX}-stop walk cap`);
          console.log(`KEYBOARD ${route} | focusables=${k.focusables} | stops=${seen.length} | figures=${reachedFigure}/${k.figures}`);
        }

        // --tokens probe is appended by Task G2.13.
      }

      await ctx.close();
    }
  }

  // reduced-motion + no-JS passes (1440 only)
  for (const mode of ['reduced-motion', 'no-js']) {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: mode === 'reduced-motion' ? 'reduce' : 'no-preference',
      javaScriptEnabled: mode !== 'no-js',
    });
    const page = await ctx.newPage();
    await page.goto(ORIGIN + route, { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    const visible = await page.evaluate(() => {
      const main = document.querySelector('main');
      if (!main) return { ok: false, why: 'no <main>' };
      const hidden = Array.from(main.querySelectorAll('[data-reveal], section')).filter((e) => getComputedStyle(e).opacity === '0').length;
      const links = main.querySelectorAll('a[href^="/"]').length;
      return { ok: hidden === 0 && links > 0, hidden, links };
    });
    if (!visible.ok) fail(route, mode, `hidden=${visible.hidden ?? '?'} internalLinks=${visible.links ?? 0} (content must render without JS / with reduced motion)`);
    await ctx.close();
  }
    }
  },
));

await browser.close();
if (local) local.server.close();

// Workers finish out of order, so the DETAIL block would shuffle between runs
// and two identical runs would diff. Sort by (route, check, msg) to keep the
// output byte-stable - a gate whose output moves for no reason cannot be
// compared to yesterday's, which is the whole point of recording it.
failures.sort((a, b) => (a.route || '').localeCompare(b.route || '')
  || (a.check || '').localeCompare(b.check || '')
  || (a.msg || '').localeCompare(b.msg || ''));
const byCheck = {};
for (const f of failures) byCheck[f.check] = (byCheck[f.check] || 0) + 1;
const ran = chosen.length ? chosen : CHECKS.concat(['console', 'subresources', 'reduced-motion', 'no-js']);
console.log('\nCHECK          | RESULT');
for (const c of ran) console.log(`${c.padEnd(14)} | ${byCheck[c] ? `FAIL (${byCheck[c]})` : 'PASS'}`);
if (failures.length) {
  console.log('\nDETAIL:');
  for (const f of failures) console.log(`  ${f.route} [${f.check}] ${f.msg}`);
}
console.log(`\nroutes=${routes.length} widths=${WIDTHS.join(',')} themes=${THEMES.join(',')} failures=${failures.length}`);
console.log(failures.length ? 'FAIL page-health' : 'PASS page-health');
// contracts: every gate prints WHAT IT MEASURED, not only what failed - the
// fixed shape `checked=<n> failed=<m>` on the verdict line. Without it a
// clean run and a run that measured nothing print the same words. A gate
// whose checked is 0 must FAIL unless it also prints an exemption reason.
console.log(`page-health: checked=${routesFiltered.length} failed=${failures.length}`);
process.exit(failures.length ? 1 : 0);
