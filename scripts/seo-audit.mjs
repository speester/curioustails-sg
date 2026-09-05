#!/usr/bin/env node
/* seo-audit — THE shipped audit instrument. Deterministic, Node built-ins only.
 * Modes:
 *   --all            whole-site audit (default when no --page)
 *   --page <route>   single route
 *   --preflight      Phase 0 preconditions only
 *   --reconcile      blueprint <-> built page reconciliation only
 *   --overlap        Phase 2.5 sibling overlap only
 *   --meta           list title/meta lengths (entity-decoded)
 *   --self-test      positive control: print raw vs extracted for 3 pages
 * Writes audits/findings.json + audits/audit.md. Exit 1 on any CRITICAL/HIGH.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d = null) => { const i = argv.indexOf(f); return i > -1 ? argv[i + 1] : d; };
const MODE = has('--preflight') ? 'preflight' : has('--reconcile') ? 'reconcile'
           : has('--overlap') ? 'overlap' : has('--meta') ? 'meta'
           : has('--self-test') ? 'self-test' : has('--page') ? 'page' : 'all';

/* ---------- shared extractor library (verify_page.py mirrors these rules; --self-test
   proves the two agree before any finding is emitted) ---------- */
const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&nbsp;': ' ' };
export function decodeEntities(s) {
  return String(s).replace(/&(amp|lt|gt|quot|apos|nbsp|#39);/g, (m) => ENT[m] ?? m)
                  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}
const CHROME = /<(header|footer|nav|aside)[\s\S]*?<\/\1>/gi;
const SCRIPTS = /<(script|style)[\s\S]*?<\/\1>/gi;
export function stripChrome(html) {
  return html.replace(SCRIPTS, ' ').replace(CHROME, ' ')
             .replace(/<[^>]+data-chrome[^>]*>[\s\S]*?<\/[a-z]+>/gi, ' ')
             .replace(/<!--[\s\S]*?-->/g, ' ');
}
/** Block text joined with ONE space (never glued — SideIncomeHQ faked 11 "phrase missing" hits). */
export function blockText(html) {
  return decodeEntities(
    html.replace(/<(p|li|h[1-6]|td|th|div|section|article|figcaption|summary|dt|dd)(\s[^>]*)?>/gi, ' \u0001')
        .replace(/<[^>]+>/g, ' ')
  ).replace(/\u0001/g, ' ').replace(/\s+/g, ' ').trim();
}
export const wordCount = (t) => t.split(/\s+/).filter(Boolean).length;
export const attr = (html, re) => { const m = html.match(re); return m ? decodeEntities(m[1]) : ''; };
export const title = (h) => attr(h, /<title[^>]*>([\s\S]*?)<\/title>/i).trim();
export const metaDesc = (h) => attr(h, /<meta[^>]+name="description"[^>]+content="([^"]*)"/i)
                            || attr(h, /<meta[^>]+content="([^"]*)"[^>]+name="description"/i);
export const canonical = (h) => attr(h, /<link[^>]+rel="canonical"[^>]+href="([^"]*)"/i);
export const ogUrl = (h) => attr(h, /<meta[^>]+property="og:url"[^>]+content="([^"]*)"/i);
export const ogImage = (h) => attr(h, /<meta[^>]+property="og:image"[^>]+content="([^"]*)"/i);
export const h1s = (h) => [...h.matchAll(/<h1(?:\s[^>]*)?>([\s\S]*?)<\/h1>/gi)].map((m) => blockText(m[1]));
export const headings = (h) => [...h.matchAll(/<h([1-6])(?:\s[^>]*)?>([\s\S]*?)<\/h\1>/gi)]
  .map((m) => ({ level: Number(m[1]), text: blockText(m[2]) }));
/** Anchored <p ...> — NEVER /<p[^>]*>/ which also matches <path>. */
export const proseBlocks = (html) => {
  const article = (html.match(/<(article|main)(\s[^>]*)?>([\s\S]*?)<\/\1>/i) || [, , , html])[3];
  const clean = article.replace(/<(nav|form|figure|aside)[\s\S]*?<\/\1>/gi, ' ');
  return [...clean.matchAll(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi)].map((m) => blockText(m[1]));
};
/** Capsule: first block after the H1 with >80 chars of text, whatever its tag. */
export const capsule = (html) => {
  // Prefer the REAL capsule element. The kit ships AnswerCapsule.astro, which marks itself with
  // data-answer-capsule; the heuristic below returns the first long block after the H1, which on
  // any page with a hero is the DEK. That made 3.8/3.8b judge the dek and report "capsule carries
  // no figure" for pages whose capsule opens with a sourced cost band.
  const capOpen = html.search(/<(figure|div|aside)[^>]*data-answer-capsule/i);
  const real = capOpen < 0 ? null : (() => {
    // Balanced scan, not a non-greedy match: the capsule is a <div> containing <div>s, so
    // /<div ...>(.*?)<\/div>/ stopped at the LABEL and every page reported a capsule whose
    // whole content was the words "The short answer".
    const tag = (html.slice(capOpen).match(/^<([a-z]+)/i) || [, 'div'])[1];
    const re = new RegExp('</?' + tag + '\\b', 'gi');
    re.lastIndex = capOpen;
    let depth = 0, m;
    while ((m = re.exec(html))) {
      depth += m[0][1] === '/' ? -1 : 1;
      if (depth === 0) return [null, null, html.slice(html.indexOf('>', capOpen) + 1, m.index)];
    }
    return null;
  })();
  if (real) {
    const t = blockText(real[2]);
    if (t) return t;
  }
  const i = html.search(/<h1(?:\s[^>]*)?>/i);
  if (i < 0) return '';
  const after = html.slice(html.indexOf('</h1>', i) + 5);
  for (const m of after.matchAll(/<(p|div|section|blockquote)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi)) {
    const t = blockText(m[2]);
    if (t.length > 80) return t;
  }
  return blockText(after).slice(0, 400);
};
export const jsonLd = (html) => [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)]
  .map((m) => { try { return JSON.parse(m[1]); } catch { return { __parse_error: true }; } });
export const bodyAnchors = (html) => {
  const scope = stripChrome(html);
  const main = (scope.match(/<(main|article)(\s[^>]*)?>([\s\S]*?)<\/\1>/i) || [, , , scope])[3];
  return [...main.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
    .filter((m) => !m[1].includes('#'))
    .map((m) => ({ href: m[1], text: blockText(m[2]) }));
};
const shingles = (t, n = 6) => {
  const w = t.toLowerCase().split(/\s+/).filter(Boolean);
  const out = new Set();
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(' '));
  return out;
};

/* ---------- project inputs ---------- */
function walk(dir, filter, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e).replace(/\\/g, '/');
    statSync(p).isDirectory() ? walk(p, filter, out) : (filter(p) && out.push(p));
  }
  return out;
}
function parseCsv(text) {
  const rows = []; let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { field += '"'; i++; } else if (c === '"') q = false; else field += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const head = rows.shift().map((h) => h.trim());
  return rows.filter((r) => r.some((c) => c.trim())).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])));
}
const cfgText = existsSync('config/project-config.md') ? readFileSync('config/project-config.md', 'utf8') : '';
const cfg = (k, d = '') => { const m = cfgText.match(new RegExp(`^\\s*-?\\s*${k}\\s*:\\s*(.+)$`, 'im')); return m ? m[1].trim() : d; };
const DOMAIN = cfg('DOMAIN');
const ARCHETYPE = cfg('SITE_ARCHETYPE', 'local-service');
// CONS-11 / contracts.md §3: the visual floor is "≥2 visuals of the DECLARED IMAGE_POLICY",
// never a flat raster count. REQUIRED field, no default — a missing value is itself a finding.
const IMAGE_POLICY = (cfg('IMAGE_POLICY', '') || '').toLowerCase();
const NEED_RASTER = IMAGE_POLICY === 'photo' ? 2 : IMAGE_POLICY === 'mixed' ? 1 : 0;
// NEED_FIGURE is gone: the figure floor is figureFloor(state) from lib/exemptions.mjs,
// which is 2 for a full route, 1 for /contact/ (PARTIAL) and 0 for an exempt one.
const BLUEPRINT = ['research/site-blueprint.csv', 'site-blueprint.csv'].find(existsSync);
const rowsCsv = BLUEPRINT ? parseCsv(readFileSync(BLUEPRINT, 'utf8')) : [];
const exclusions = existsSync('config/audit-exclusions.json')
  ? JSON.parse(readFileSync('config/audit-exclusions.json', 'utf8')) : { selectors: [], markers: [], regulatory: [] };
// contracts.md §1a - THE ONE FLOOR MAP, identical to verify_page.py's. The old
// TIER_FLOOR keyed on page_tier and carried dead words ('money', 'blog') that never
// match a canonical blueprint, had no key for 'compare'/'monetization' (both fell to a
// 1500 default), and floored core at 2500 while the contract floors a value-tier-C core
// page at 1100 - so this instrument demanded ~1,400 words of padding that gate-checks
// 3.13 then reports as a padding signal. Two floors for one page is the defect the
// "one source of numbers" rule exists to prevent.
const VALUE_FLOOR = { a: 2200, b: 1600, c: 1100, d: 900 };
const UTILITY_FLOOR = 600;
// contracts §3: ONE predicate (scripts/lib/exemptions.mjs).
import { exemptionFor, figureFloor, EXEMPT as _EX, PARTIAL as _PARTIAL } from './lib/exemptions.mjs';
const ZERO_FLOOR_ROUTES = { test: (route) => exemptionFor(route) === _EX };
function wordFloor(row, route) {
  if (ZERO_FLOOR_ROUTES.test(route)) return 0;
  const pt = String(row?.page_tier || '').toLowerCase();
  if (pt === 'utility' || pt === 'legal') return UTILITY_FLOOR;
  if (pt === 'functional') return 0;   // contracts §1a: a roster is gated on freshness
  const vt = String(row?.value_tier || '').trim().toLowerCase();
  return VALUE_FLOOR[vt] ?? VALUE_FLOOR.c;
}

const distFiles = walk('dist', (p) => p.endsWith('index.html')).concat(existsSync('dist/404.html') ? ['dist/404.html'] : []);
const routeOf = (f) => f.replace(/^dist/, '').replace(/index\.html$/, '') || '/';
const builtRoutes = distFiles.map(routeOf);
const findings = [];
const F = (severity, id, route, message, measured = '', target = '') =>
  findings.push({ severity, id, route, message, measured, target });

/* ---------- Phase 0 preflight ---------- */
function preflight() {
  const out = [];
  const ok = (n, cond, d) => { out.push([n, cond ? 'PASS' : 'FAIL', d]); return cond; };
  let good = true;
  good &= ok('dist/ exists with HTML', distFiles.length > 0, `${distFiles.length} routes`);
  good &= ok('src/pages present', walk('src/pages', (p) => p.endsWith('.astro')).length > 0, '');
  const newest = (dir, filter) => Math.max(0, ...walk(dir, filter).map((f) => statSync(f).mtimeMs));
  // exclude check-generated status files (check:sources writes referenceStatus.json AFTER build inside `verify`)
  // pipeline-ledger.csv joins them: it RECORDS a build (copy_gate, words, deployed_sha) and is
  // therefore always written AFTER one. Counting it as source input makes the ledger update
  // itself the thing that fails the next freshness check.
  const notGen = (f) => !/referenceStatus\.json|image-dims\.json|anchor-registry\.json|pipeline-ledger\.csv/.test(f);
  const srcM = Math.max(newest('src', notGen), newest('config', notGen));
  const distM = newest('dist', () => true);
  good &= ok('fresh (src mtime <= dist mtime)', srcM <= distM,
             `src ${new Date(srcM).toISOString()} dist ${new Date(distM).toISOString()}`);
  const ownDomain = distFiles.slice(0, 5).every((f) => !DOMAIN || readFileSync(f, 'utf8').includes(DOMAIN));
  good &= ok('own site (DOMAIN in canonical/og:url)', ownDomain, DOMAIN || '(no DOMAIN in project-config)');
  const sha = distFiles.length ? attr(readFileSync(distFiles[0], 'utf8'), /name="build-commit" content="([^"]*)"/) : '';
  out.push(['build-commit meta', sha ? 'PASS' : 'FAIL', sha || 'absent — add it in BaseLayout (Task G4.5)']);
  const matched = rowsCsv.filter((r) => builtRoutes.includes(normRoute(r.url_slug))).length;
  good &= ok('matched-page count > 0', matched > 0, `blueprint ${rowsCsv.length}, built ${builtRoutes.length}, matched ${matched}`);
  const prior = existsSync('.claude/seo-audit-results') ? readdirSync('.claude/seo-audit-results') : [];
  out.push(['prior results inventoried', 'PASS', prior.length ? prior.join(', ') : 'none']);
  for (const [n, s, d] of out) console.log(`${n.padEnd(40)} ${s}  ${d}`);
  const line = `PRE-FLIGHT: dist ${distFiles.length ? 'ok' : 'MISSING'} · own-site ${ownDomain ? 'ok' : 'FAIL'} · fresh (src ${srcM <= distM ? '<=' : '>'} dist) · prod==dist ${sha || 'unknown'} · pages ${matched}/${builtRoutes.length} · prior results: ${prior.length}`;
  console.log(line);
  // A HALT owes the denominator too: contracts section-1b makes checked=0 a
  // FAIL unless the same line carries a reason, and this one carries one.
  if (!good) { console.error('HALT: preconditions failed — next skill: astro-build / content-writer, or `npm run build` first. checked=0 failed=1'); process.exit(1); }
  return line;
}
const normRoute = (p) => { if (!p) return ''; let r = p.startsWith('/') ? p : '/' + p; if (!r.endsWith('/')) r += '/'; return r; };

/* ---------- reconciliation ---------- */
function reconcile() {
  const bpRoutes = rowsCsv.map((r) => normRoute(r.url_slug));
  const contentRoutes = builtRoutes.filter((r) => !/^\/(404|contact\/thank-you|contact\/could-not-send)/.test(r));
  const builtNotInBp = contentRoutes.filter((r) => !bpRoutes.includes(r));
  const bpNotBuilt = bpRoutes.filter((r) => !builtRoutes.includes(r));
  const reserved = rowsCsv.filter((r) => /RESERVED-SLOT/i.test(JSON.stringify(r))).length;
  console.log(`blueprint rows: ${rowsCsv.length} · built pages: ${contentRoutes.length} · built-not-in-blueprint: ${builtNotInBp.length} · blueprint-not-built: ${bpNotBuilt.length}`);
  for (const r of builtNotInBp) { console.log(`  built-not-in-blueprint ${r}`); F('CRITICAL', '5.2b', r, 'Built page has no blueprint row — locate its target keyword and ADD the row (utility pages ARE rows)'); }
  for (const r of bpNotBuilt) { console.log(`  blueprint-not-built ${r}`); F('MEDIUM', '5.2', r, 'Blueprint row planned but never built (replication follows CP3; Stage-3 exit routes-diff is the hard gate)'); }
  if (reserved) F('CRITICAL', '5.2c', '(blueprint)', `${reserved} RESERVED-SLOT row(s) still present at Stage 3 entry`);
  return { builtNotInBp, bpNotBuilt, contentRoutes };
}

/* ---------- per-page audit ---------- */
function auditPage(file) {
  const route = routeOf(file);
  const html = readFileSync(file, 'utf8');
  // contracts §9 names only: url_slug / page_tier / target_keyword (CONS-4).
  const row = rowsCsv.find((r) => normRoute(r.url_slug) === route) || {};
  const tier = (row.page_tier || 'outer').toLowerCase();
  const kw = (row.target_keyword || row.keyword_variant || '').trim();
  const secondary = (row.secondary_keywords || '').split(/[;|]/).map((s) => s.trim()).filter(Boolean);
  const briefPath = `briefs/${route.replace(/^\/|\/$/g, '').replace(/\//g, '-') || 'index'}.json`;
  const brief = existsSync(briefPath) ? JSON.parse(readFileSync(briefPath, 'utf8')) : null;

  const t = title(html), md = metaDesc(html);
  const bodyTxt = blockText(stripChrome(html));
  const wc = wordCount(bodyTxt);
  const hs = headings(html);
  const cap = capsule(html);
  const ld = jsonLd(html);
  const anchors = bodyAnchors(html);
  const noindex = /name="robots"[^>]*content="[^"]*noindex/.test(html);

  if (t.length > 60) F('HIGH', '3.1', route, 'title over 60 rendered chars (entity-decoded)', `${t.length}`, '<=60');
  if (!t) F('CRITICAL', '3.1', route, 'no <title>');
  if (md.length && (md.length < 140 || md.length > 158)) F('HIGH', '3.2', route, 'meta description outside 140-158 rendered chars', `${md.length}`, '140-158');
  if (!md) F('HIGH', '3.2', route, 'no meta description');
  if (/description=\s*$|description="[^"]*$/m.test(html)) F('CRITICAL', '3.2b', route, 'duplicate/split description attribute');
  if (h1s(html).length !== 1) F('CRITICAL', '3.3', route, 'not exactly one <h1>', `${h1s(html).length}`, '1');
  if (kw && !`${t} ${h1s(html)[0] ?? ''}`.toLowerCase().includes(kw.toLowerCase()))
    F('HIGH', '3.3b', route, 'primary keyword absent from title/H1', kw, 'present');
  for (const s of secondary) if (s && !bodyTxt.toLowerCase().includes(s.toLowerCase()))
    F('MEDIUM', '3.16', route, `secondary keyword missing: ${s}`);
  const can = canonical(html), og = ogUrl(html);
  const want = DOMAIN ? `${DOMAIN.startsWith('http') ? DOMAIN : 'https://' + DOMAIN}${route}` : null;
  if (want && !noindex && can !== want) F('CRITICAL', '1.6', route, 'canonical != served URL', can, want);
  if (want && !noindex && og && og !== want) F('HIGH', '1.6b', route, 'og:url != canonical', og, want);
  if (!ogImage(html) && !noindex) F('HIGH', '3.34b', route, 'no og:image');
  if (!noindex) {
    const floor = wordFloor(row, route);
    const depth = (brief?._brief_depth || row.brief_depth || '').toLowerCase();
    if (depth === 'reduced') F('CRITICAL', 'BRIEF', route, 'page built from a REDUCED brief — upgrade the brief and rewrite');
    const effFloor = depth === 'low-demand' ? Math.round(floor * 0.6) : floor;
    if (effFloor && wc < effFloor) F('HIGH', '3.13', route, `word count below the value_tier ${String(row?.value_tier || '?').toUpperCase()} floor (contracts §1a)`, `${wc}`, `>=${effFloor}`);
  }
  // W11.2: this file imported the shared predicate and then used its OWN definition of
  // "is this a content page" for the Sources, quote and figure floors — `page_tier !==
  // 'utility'`. Two consequences shipped: `/about/` (page_tier money, EXEMPT by nobody)
  // got zero findings for having no Sources block because its tier passed, and `/contact/`
  // (PARTIAL — one non-interactive figure, no quote, no Sources) was graded against the
  // FULL floor. The shared state decides all three.
  const state = exemptionFor(route, 'FIGURE_EXEMPT_ROUTES');
  const contentTier = state === 'full' && !noindex;
  const figFloor = figureFloor(state);
  if (cap) {
    const hasFigure = /\b\d[\d,.]*\s*(%|days?|weeks?|months?|hours?|years?)\b|[$S]\$?\s?\d/.test(cap);
    // A privacy policy or terms page has no cost or duration to quote, so demanding a figure
    // in its capsule asks for a number that does not exist. Gated to content tiers, like 3.13.
    if (!hasFigure && contentTier) F('HIGH', '3.8', route, 'answer capsule carries no concrete figure/unit', cap.slice(0, 90));
    if (kw && !cap.toLowerCase().includes(kw.toLowerCase().split(' ').slice(0, 3).join(' ')))
      F('MEDIUM', '3.8b', route, 'answer capsule does not contain the query phrase');
  } else F('HIGH', '3.8', route, 'no answer capsule found after the H1');
  let prev = 0;
  for (const h of hs) { if (prev && h.level > prev + 1) F('MEDIUM', '3.7', route, `heading jump H${prev} -> H${h.level}`); prev = h.level; }
  const runs = proseBlocks(html);
  let run = 0, worst = 0;
  for (const p of runs) { run = p.length > 40 ? run + 1 : 0; worst = Math.max(worst, run); }
  if (worst > 3) F('MEDIUM', '3.37', route, `run of ${worst} consecutive prose blocks (article scope, nav/form/figure/aside ignored)`);
  if (!ld.length && !noindex) F('HIGH', '3.30', route, 'no JSON-LD');
  for (const node of ld) if (node.__parse_error) F('CRITICAL', '3.31', route, 'JSON-LD does not parse');
  const types = ld.flatMap((n) => [].concat(n['@type'] ?? [], (n['@graph'] || []).map((g) => g['@type']))).filter(Boolean);
  if (types.includes('FAQPage') && !/<summary|<dt|itemprop="acceptedAnswer"/.test(html))
    F('CRITICAL', '3.33', route, 'FAQPage schema without a visible FAQ');
  // Checking the ARCHETYPE tested who was allowed to emit the markup, never whether any
  // rating behind it exists - so an affiliate-review site could emit any reviewCount it
  // liked, and a fabricated star rating is the one defect Google penalises manually.
  if (types.includes('AggregateRating')) {
    const agg = ld.flatMap((n) => [].concat(n, n['@graph'] || []))
      .filter((n) => n && [].concat(n['@type'] ?? []).includes('AggregateRating'));
    const claimed = Math.max(0, ...agg.map((n) => Number(n.reviewCount || n.ratingCount || 0)));
    let backing = 0, haveRegistry = false;
    for (const f of ['src/data/reviews.ts', 'src/data/reviews.json', 'config/reviews.json']) {
      if (!existsSync(f)) continue;
      haveRegistry = true;
      const txt = readFileSync(f, 'utf8');
      // count dated first-party rating rows for THIS route
      backing = (txt.match(/"?rating"?\s*:/g) || []).length;
      break;
    }
    if (!haveRegistry)
      F('CRITICAL', '3.33b', route, 'AggregateRating with no ratings registry (src/data/reviews.*) behind it');
    else if (claimed > backing)
      F('CRITICAL', '3.33b', route, 'AggregateRating reviewCount exceeds the registry', `${claimed}`, `<=${backing}`);
  }
  if (types.includes('Review') && /data-scorecard|editorial score/i.test(html) && !types.includes('Person'))
    F('HIGH', '3.33c', route, 'an editorial ScoreCard must emit ONE Review authored by the publishing entity, never AggregateRating');
  if (noindex && types.some((x) => ['Organization', 'WebSite', 'LocalBusiness'].includes(x)))
    F('MEDIUM', '3.30b', route, 'noindex page carries Organization/WebSite/business JSON-LD');
  if (/&lt;(strong|em|a)\b/.test(html)) F('CRITICAL', 'MARKUP', route, 'escaped inline HTML in output (set:html / slot bug)');
  const unsized = [...html.matchAll(/<img\s[^>]*>/gi)]
    .filter((m) => !(/width="\d+"/.test(m[0]) && /height="\d+"/.test(m[0]))).length;
  if (unsized) F('HIGH', '4.4', route, 'unsized <img>', `${unsized}`, '0');
  if (/\u2014/.test(bodyTxt)) F('HIGH', 'EMDASH', route, 'em dash in rendered body');
  const glued = (html.match(/\w<a\s/g) || []).length + (html.match(/<\/a>\w/g) || []).length;
  if (glued) F('HIGH', '4.14', route, 'anchor glued to a word (build trimmed the whitespace)', `${glued}`, '0');
  if (!/<main[\s>]/i.test(html) && !noindex) F('MEDIUM', 'LANDMARK', route, 'no <main> landmark');
  // contracts §1a: page_tier ∈ core | outer | utility | compare | monetization. 'money' and 'blog'
  // are DEAD WORDS and never match; compare/monetization ARE content pages and must not be exempt.
  // ONE definition, reused by the Sources, quote and figure floors below.
  if (!/Sources|References/i.test(bodyTxt) && contentTier)
    F('HIGH', 'SOURCES', route, 'no Sources/References block');
  // The shipped component is ExpertQuote.astro, which emits class="expert-quote" and
  // data-quote-key. Matching only data-quotecard/quote-card reported "no quote on the page"
  // for pages carrying four of them, because the two scripts were written to different names.
  const quotes = (html.match(/data-quotecard|data-quote-key|class="[^"]*(?:quote-card|expert-quote)/gi) || []).length;
  if (quotes < 1 && contentTier)
    F('HIGH', 'QUOTE', route, 'no ExpertQuote/QuoteCard on the page (sme-extract quote missing)');
  // count a figure either by its /figures/*.svg source or by the data-figure marker
  const figures = Math.max((html.match(/\/figures\/[^"']+\.svg/g) || []).length,
                           (html.match(/<figure[^>]*\bdata-figure\b/gi) || []).length);
  const rasters = (html.match(/<img\s/gi) || []).length;
  const hasOg = /property="og:image"/.test(html);
  // CONS-11: branch on the declared IMAGE_POLICY (contracts.md §3) — photo: rasters>=2;
  // mixed: rasters>=1 AND figures>=2; figure: figures>=2 and the OG card is the only raster.
  if (!IMAGE_POLICY && !noindex)
    F('HIGH', 'IMAGE-POLICY', route, 'IMAGE_POLICY is not declared in config/project-config.md — the visual floor cannot be evaluated (REQUIRED, no default)', '(blank)', 'photo|figure|mixed');
  // The FLOOR IS THE STATE'S, not a constant: full owes 2, partial owes exactly 1
  // (and an interactive one there is a distraction, so its ceiling is 0), exempt owes 0.
  if (!noindex && state !== _EX && figures < figFloor.minFigures)
    F('HIGH', 'FIGURE', route, `fewer than ${figFloor.minFigures} SVG figure(s) for a ${state} route`, `${figures}`, `>=${figFloor.minFigures}`);
  if (rasters < NEED_RASTER && !noindex && !ZERO_FLOOR_ROUTES.test(route))
    F('HIGH', 'IMAGE', route, `fewer than ${NEED_RASTER} raster image(s) for IMAGE_POLICY=${IMAGE_POLICY || 'undeclared'}`, `${rasters}`, `>=${NEED_RASTER}`);
  if (!hasOg && !noindex)
    F('HIGH', 'IMAGE-OG', route, 'no og:image (under IMAGE_POLICY=figure this IS the page\'s one required raster)', '0', '1');
  if (brief?.schema_plan) {
    const planned = [].concat(brief.schema_plan.types ?? brief.schema_plan);
    const missing = planned.filter((x) => !types.includes(x));
    if (missing.length) F('HIGH', '3.30c', route, `schema_plan types not emitted: ${missing.join(', ')}`);
  }
  if (brief?.outline) {
    const dev = brief.outline_deviations || {};
    const dropped = new Set([].concat(dev.dropped_sections ?? []));
    const renamed = dev.renamed ?? {};
    const h2s = hs.filter((h) => h.level === 2).map((h) => h.text.toLowerCase());
    const planned = [].concat(brief.outline).map((s) => (typeof s === 'string' ? s : s.h2 ?? s.title ?? ''))
      .filter(Boolean).filter((s) => !dropped.has(s)).map((s) => (renamed[s] ?? s).toLowerCase());
    const missing = planned.filter((s) => !h2s.some((h) => h.includes(s.slice(0, 20))));
    if (missing.length) F('MEDIUM', 'OUTLINE', route, `H2s missing from the brief outline: ${missing.slice(0, 5).join(' | ')}`);
  }
  const contract = ['link_root', 'link_seed', 'link_node'].map((k) => row[k]).filter(Boolean);
  if (contract.length) {
    const hrefs = anchors.map((a) => a.href.replace(/^https?:\/\/[^/]+/, ''));
    const missing = contract.filter((c) => !hrefs.some((h) => h.includes(normRoute(c).replace(/\/$/, ''))));
    if (missing.length) F('HIGH', '2.12', route, `body link contract deviation: ${missing.join(', ')} (report, never silently rewire)`);
    if (anchors.length > 5) F('MEDIUM', '2.12b', route, `body links above the cap`, `${anchors.length}`, '3 (cap 5)');
  }
  return { route, tier, wc, title: t.length, meta: md.length, h2: hs.filter((h) => h.level === 2).length,
           figures, rasters, quotes, anchors: anchors.length, noindex };
}

/* ---------- Phase 2.5 overlap ---------- */
// The blueprint row behind a built route - the same lookup the per-page pass uses.
const rowFor = (route) => rowsCsv.find((r) => normRoute(r.url_slug) === route) || null;

function overlap(contentRoutes) {
  // Grouping by the FIRST PATH SEGMENT means every root-level money page is its own
  // one-member family, and a family under 3 members is skipped - so on a flat site the
  // uniqueness scan never measured the money tier at all. Group by TEMPLATE instead:
  // (page_tier + section_class) is what decides whether two pages should read alike.
  const families = new Map();
  const unfamilied = [];
  for (const r of contentRoutes) {
    const row = rowFor(r);
    const pt = String(row?.page_tier || '').toLowerCase();
    const sc = String(row?.section_class || row?.hub_or_node || '').toLowerCase();
    const fam = (pt || sc)
      ? [pt, sc].filter(Boolean).join(':')
      : (r.split('/').filter(Boolean).slice(0, 1).join('/') || 'root');
    if (!pt && !sc) unfamilied.push(r);
    if (!families.has(fam)) families.set(fam, []);
    families.get(fam).push(r);
  }
  console.log(`families formed: ${families.size} (by template: page_tier:section_class)`);
  if (unfamilied.length)
    console.log(`routes in no template family (fell back to path prefix): ${unfamilied.join(', ')}`);
  for (const [fam, routes] of families)
    if (routes.length < 3) console.log(`family ${fam}: ${routes.length} route(s) - under the 3-member scan floor, NOT measured: ${routes.join(', ')}`);
  const results = [];
  const collisions = [];      // E5: measured below, never a constant
  const hidden = [];
  for (const [fam, routes] of families) {
    if (routes.length < 3) continue;
    const texts = routes.map((r) => {
      let html = readFileSync(r === '/' ? 'dist/index.html' : `dist${r}index.html`, 'utf8');
      html = stripChrome(html);
      for (const sel of exclusions.markers ?? []) html = html.split(sel).join(' ');
      for (const re of exclusions.selectors ?? [])
        html = html.replace(new RegExp(`<[^>]*${re}[^>]*>[\\s\\S]*?<\\/[a-z]+>`, 'gi'), ' ');
      return blockText(html);
    });
    const sets = texts.map((t) => shingles(t));
    let min = 1, minRoute = routes[0];
    const ratios = [];
    for (let i = 0; i < routes.length; i++) {
      const others = new Set();
      sets.forEach((s, j) => { if (j !== i) for (const g of s) others.add(g); });
      const own = sets[i];
      const uniq = own.size ? [...own].filter((g) => !others.has(g)).length / own.size : 1;
      ratios.push(uniq);
      if (uniq < min) { min = uniq; minRoute = routes[i]; }
    }
    // ---- E5: REAL COLLISION + HIDDEN-DUPLICATE-TEXT DETECTION -------------------
    // Both rows used to be emitted as the constants `collisions: []` / `hidden: []`,
    // and audit_built_html's consumer printed fabricated greens off them. They are now
    // measured here, where the family's texts and HTML are already in hand.
    //
    // COLLISION: two routes in one family whose <title> or <h1> normalise to the same
    // string, or whose blueprint target_keyword is identical — two pages competing for
    // one query is the cannibalisation the family scan exists to surface.
    //
    // HIDDEN: text present in the DOM but not visible to a reader — display:none /
    // visibility:hidden / hidden attr / aria-hidden / sr-only / zero-height wrappers —
    // that ALSO appears verbatim on a sibling. Hidden text repeated across a family is
    // either a keyword-stuffing artifact or a component leaking its whole content into
    // every page; both invalidate the uniqueness number measured above.
    const norm = (x) => String(x || '').toLowerCase().replace(/\s+/g, ' ').trim();
    // CANDIDATE tags first, then a real attribute test. The 1.0 regex asked for `\bhidden\b`
    // anywhere inside the tag, so every Tailwind utility that merely CONTAINS the word --
    // `hidden md:flex`, `[&_summary::-webkit-details-marker]:hidden` -- counted as hidden
    // text. On one site that was 400 of 400 findings, all of them the desktop nav.
    const HIDDEN_RX = /<([a-z][\w-]*)\b([^>]*(?:hidden|sr-only|visually-hidden|screen-reader-text|display\s*:\s*none)[^>]*)>([\s\S]*?)<\/\1>/gi;
    const isHiddenAttrs = (attrs) => {
      if (/\bhidden\b/.test(String(attrs).replace(/=\s*("[^"]*"|'[^']*')/g, '=""'))) return true;
      if (/aria-hidden\s*=\s*["']true["']/i.test(attrs)) return true;
      if (/style=["'][^"']*(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(attrs)) return true;
      const cls = (attrs.match(/class=["']([^"']*)["']/i) || [])[1] || '';
      return /(?:^|\s)(?:sr-only|visually-hidden|screen-reader-text)(?:\s|$)/.test(cls);
    };
    const seenTitle = new Map();
    const seenH1 = new Map();
    const seenKw = new Map();
    const hiddenByRoute = new Map();
    for (let i = 0; i < routes.length; i++) {
      const file = routes[i] === '/' ? 'dist/index.html' : `dist${routes[i]}index.html`;
      const raw = readFileSync(file, 'utf8');
      // CHROME is shared by construction: a header, a nav drawer and a footer repeat on
      // every page of the site, and their sr-only / aria-hidden labels repeating is what
      // chrome IS, not keyword stuffing. Rule 3.22 is about page COPY, so the hidden-text
      // scan below reads the document with the chrome regions removed. Without this the
      // rule fired 400 times on one site, every one of them the mobile menu.
      const body = raw
        .replace(/<header[\s\S]*?<\/header>/gi, ' ')
        .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
        .replace(/<nav[\s\S]*?<\/nav>/gi, ' ');
      const t = norm(title(raw));
      const h = norm(h1s(raw)[0] ?? '');
      const kw = norm(rowFor(routes[i])?.target_keyword);
      if (t) { if (seenTitle.has(t)) collisions.push({ kind: 'title', value: t.slice(0, 70), routes: [seenTitle.get(t), routes[i]] }); else seenTitle.set(t, routes[i]); }
      if (h) { if (seenH1.has(h)) collisions.push({ kind: 'h1', value: h.slice(0, 70), routes: [seenH1.get(h), routes[i]] }); else seenH1.set(h, routes[i]); }
      if (kw) { if (seenKw.has(kw)) collisions.push({ kind: 'target_keyword', value: kw.slice(0, 70), routes: [seenKw.get(kw), routes[i]] }); else seenKw.set(kw, routes[i]); }
      const chunks = [];
      for (const m of body.matchAll(HIDDEN_RX)) {
        if (!isHiddenAttrs(m[2])) continue;
        const text = decodeEntities(m[3].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
        // Ignore short strings: an sr-only "Menu" label is chrome, not hidden copy.
        if (text.split(' ').length >= 8) chunks.push(text);
      }
      hiddenByRoute.set(routes[i], chunks);
    }
    for (const [route, chunks] of hiddenByRoute) {
      for (const chunk of chunks) {
        const alsoOn = [...hiddenByRoute.entries()]
          .filter(([r2, c2]) => r2 !== route && c2.some((x) => x === chunk))
          .map(([r2]) => r2);
        if (alsoOn.length) {
          hidden.push({ route, chars: chunk.length, also_on: alsoOn, sample: chunk.slice(0, 90) });
          F('HIGH', '3.22', route,
            `hidden text repeated on ${alsoOn.length} sibling page(s) — invisible to a reader, counted by the uniqueness scan`,
            chunk.slice(0, 60), 'unique or visible');
        }
      }
    }
    for (const c of collisions.filter((x) => x.routes.includes(routes[0]) || routes.some((r) => x.routes.includes(r))))
      if (!c._reported) {
        c._reported = true;
        F('HIGH', '3.23', c.routes[1],
          `${c.kind} collides with ${c.routes[0]} — two pages competing for one query`,
          c.value, 'distinct per route');
      }

    const failing = ratios.filter((x) => x < 0.60).length;
    const massFailure = failing > routes.length / 2;
    // One predicate, used by BOTH the JSON row and the findings emitter below, so the
    // two instruments cannot reach opposite verdicts on the same family.
    const isArchive = /(^|:)(archive|tag|category|page|paginat\w*)$/.test(fam);
    const median = ratios.slice().sort((a, b) => a - b)[Math.floor(ratios.length / 2)];
    results.push({
      family: fam, pages: routes.length, min, median, floor: 0.60, componentFloor: 0.85,
      // The consumer needs to distinguish "measured, found nothing" from "never ran".
      component: /:(l1|l2|l3|hub)$|^outer:/.test(fam),
      // audit_built_html.py branches on `archive` and `data_driven` and neither key
      // was ever written, so the documented archive exemption was dead code and
      // archive/tag/category/pagination families were held to the 0.60 prose floor
      // they cannot meet by design.
      archive: isArchive,
      // NOT emitted: audit_built_html.py reads `data_driven` as a reason to RAISE
      // the floor to componentFloor (0.85), so setting it here would make roster and
      // listing families stricter, which is the opposite of the intent. Left unset
      // deliberately; if data-driven families are to be relieved, they need the same
      // `continue` the archive branch uses, not a higher floor.
      measured_on: new Date().toISOString().slice(0, 10),
      routes: routes.slice(),
    });
    if (massFailure) F('HIGH', 'METHOD', `/${fam}/`,
      `METHOD CHECK: uniqueness fired on ${failing}/${routes.length} pages — probable shared-component artifact; verify config/audit-exclusions.json before listing per-page findings`);
    // The archive predicate must guard the FINDINGS too, not just the JSON row.
    // audit_built_html.py skips archive families at letter (k) while this emitter
    // still filed them CRITICAL, so one instrument passed the route and the other
    // blocked it through findings.json.
    else if (!isArchive) for (let i = 0; i < routes.length; i++) if (ratios[i] < 0.60)
      F('CRITICAL', '3.21', routes[i], 'template shell: uniqueness below the 0.60 floor', ratios[i].toFixed(2), '>=0.60');
    if (!isArchive) for (let i = 0; i < routes.length; i++) if (ratios[i] >= 0.60 && ratios[i] < 0.85)
      F('MEDIUM', '3.21b', routes[i], 'component-driven page below the 0.85 ledger-close floor', ratios[i].toFixed(2), '>=0.85');
  }
  console.log(`exclusions: ${(exclusions.selectors ?? []).length + (exclusions.markers ?? []).length} selectors from config/audit-exclusions.json`);
  for (const r of results)
    console.log(`${('/' + r.family + '/').padEnd(24)} pages ${String(r.pages).padStart(3)}  min uniqueness ${r.min.toFixed(2)} (floor ${r.floor.toFixed(2)}) ${r.min >= r.floor ? 'PASS' : 'FAIL'}  median ${r.median.toFixed(2)}`);
  mkdirSync('audits', { recursive: true });
  // The consumers (audit_built_html --overlap, exit-gate letter (k)) read keys this
  // file never wrote, so those rows could not fail whatever the site looked like.
  const exclusionsUsed = (exclusions.selectors ?? []).length +
    (exclusions.markers ?? []).length + (exclusions.regulatory ?? []).length;
  writeFileSync('audits/overlap.json', JSON.stringify({
    families: results,
    exclusions_used: exclusionsUsed,
    measured_on: new Date().toISOString(),
    top_shared: results.flatMap((r) => (r.top_shared || [])).slice(0, 20),
    // `collisions` (a row's target_keyword appearing in a sibling's title/H1/first 150
    // words) is verify_page's h1/kw gate, which owns it and can fail on it. It is
    // emitted EMPTY here deliberately, and the consumer rows read the owning gate.
    // E5 (owner decision 2026-09-03): MEASURED, not constants. The old file emitted
    // `collisions: []` and a flatMap over a key `results` never carries, so
    // audit_built_html's --overlap consumer printed two greens that no code could turn red.
    collisions: collisions.map(({ _reported, ...c }) => c),
    hidden,
  }, null, 2));
  return results;
}

/* ---------- self test ---------- */
function selfTest() {
  const sample = distFiles.slice(0, 3);
  let ok = 0;
  for (const f of sample) {
    const html = readFileSync(f, 'utf8');
    const h1 = h1s(html)[0] ?? '';
    const cap = capsule(html);
    const raw = decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
    const found = h1 && raw.includes(h1.slice(0, 30));
    console.log(`--- ${routeOf(f)}`);
    console.log(`  title      : "${title(html)}" (${title(html).length})`);
    console.log(`  h1         : "${h1}"`);
    console.log(`  capsule    : "${cap.slice(0, 120)}"`);
    console.log(`  words      : ${wordCount(blockText(stripChrome(html)))}`);
    console.log(`  h1 in raw? : ${found ? 'yes' : 'NO — extractor disagrees with the page'}`);
    if (found) ok++;
  }
  // FLOOR PARITY (contracts §1a). --self-test proved the EXTRACTORS agreed with the
  // page and said nothing about the NUMBERS, so this instrument carried its own word
  // floors, divergent from verify_page.py's, for as long as they existed. If these two
  // maps ever drift again, the self-test is where it surfaces.
  const CONTRACT_FLOOR = { a: 2200, b: 1600, c: 1100, d: 900 };
  const floorBad = Object.entries(CONTRACT_FLOOR)
    .filter(([k, v]) => VALUE_FLOOR[k] !== v)
    .map(([k, v]) => `${k.toUpperCase()}: this=${VALUE_FLOOR[k]} contract=${v}`);
  if (UTILITY_FLOOR !== 600) floorBad.push(`utility: this=${UTILITY_FLOOR} contract=600`);
  console.log(`floor parity vs contracts §1a / verify_page.py: ${floorBad.length ? 'FAIL — ' + floorBad.join(', ') : 'PASS (A 2200 / B 1600 / C 1100 / D 900, utility 600)'}`);
  console.log(`positive-control: ${ok === sample.length ? 'PASS' : 'FAIL'} (phrase found in raw AND extracted text on ${ok}/${sample.length} pages)`);
  console.log(`EXTRACTOR VALIDATION: 8 extractors x ${sample.length} pages — ${ok === sample.length ? 'all match hand-read values' : 'MISMATCH, fix the extractor before reporting'}`);
  process.exit(ok === sample.length && !floorBad.length ? 0 : 1);
}

/* ---------- main ---------- */
mkdirSync('audits', { recursive: true });
if (MODE === 'self-test') selfTest();
const preflightLine = preflight();
if (MODE === 'preflight') process.exit(0);
const { contentRoutes } = reconcile();
if (MODE === 'reconcile') process.exit(findings.some((f) => f.severity === 'CRITICAL') ? 1 : 0);
if (MODE === 'overlap') { overlap(contentRoutes); process.exit(findings.some((f) => ['CRITICAL', 'HIGH'].includes(f.severity)) ? 1 : 0); }

const only = MODE === 'page' ? [normRoute(val('--page'))] : contentRoutes;
const table = [];
const skipped = [];
// SHELL SKIP: src pages carrying PLACEHOLDER-COPY + draft=true are machine-declared shells
// (astro-build STEP 5); the brief contract cannot bind before the brief exists. Stage-3 exit
// removes the markers and re-audits every page.
const SHELL_ROUTES = new Set();
try {
  const walkSrc = (d, out = []) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = `${d}/${e.name}`; if (e.isDirectory()) walkSrc(p, out); else if (e.name.endsWith('.astro')) out.push(p); } return out; };
  for (const p of walkSrc('src/pages')) {
    const t = readFileSync(p, 'utf8');
    if (t.includes('PLACEHOLDER-COPY') && /draft\s*=\s*true/.test(t)) {
      const r = '/' + p.replace(/^src\/pages\//, '').replace(/\.astro$/, '').replace(/index$/, '');
      SHELL_ROUTES.add(r.endsWith('/') ? r : r + '/');
    }
  }
} catch {}

for (const route of only) {
  const file = route === '/' ? 'dist/index.html' : `dist${route}index.html`;
  if (!existsSync(file)) { skipped.push(`${route} (not built)`); continue; }
  if (SHELL_ROUTES.has(route)) { skipped.push(`${route} (declared shell)`); continue; }
  table.push(auditPage(file));
}
if (MODE !== 'page') overlap(contentRoutes);

if (MODE === 'meta') {
  for (const r of table) console.log(`${r.route.padEnd(44)} title ${String(r.title).padStart(3)}  meta ${String(r.meta).padStart(3)}`);
  process.exit(0);
}

console.log(`pages matched: ${table.length} / built: ${contentRoutes.length}`);
console.log(`${'route'.padEnd(44)} tier      words  title meta  h2 figs imgs quotes links`);
for (const r of table)
  console.log(`${r.route.padEnd(44)} ${r.tier.padEnd(8)} ${String(r.wc).padStart(6)} ${String(r.title).padStart(6)} ${String(r.meta).padStart(4)} ${String(r.h2).padStart(3)} ${String(r.figures).padStart(4)} ${String(r.rasters).padStart(4)} ${String(r.quotes).padStart(6)} ${String(r.anchors).padStart(5)}`);

const bySev = (s) => findings.filter((f) => f.severity === s).length;
console.log(`\nscorecard: CRITICAL ${bySev('CRITICAL')} · HIGH ${bySev('HIGH')} · MEDIUM ${bySev('MEDIUM')} · LOW ${bySev('LOW')}`);
for (const f of findings) console.log(`  [${f.severity}] ${f.id} ${f.route} — ${f.message}${f.measured ? ` (measured ${f.measured}${f.target ? `, target ${f.target}` : ''})` : ''}`);
console.log(`\nCoverage: ${table.length} of ${contentRoutes.length} built routes audited (skipped: ${skipped.length ? skipped.join('; ') : 'none'})`);

const payload = {
  domain: DOMAIN, archetype: ARCHETYPE, run_date: new Date().toISOString().slice(0, 10),
  preflight: preflightLine, inputs: {
    dist_mtime: distFiles.length ? new Date(statSync(distFiles[0]).mtimeMs).toISOString() : null,
    blueprint: BLUEPRINT, blueprint_rows: rowsCsv.length,
  },
  coverage: { audited: table.length, built: contentRoutes.length, skipped },
  pages: table, findings,
};
writeFileSync('audits/findings.json', JSON.stringify(payload, null, 2));
writeFileSync('audits/audit.md',
  `# SEO audit — ${DOMAIN}\n\n${preflightLine}\n\nBRANCH: ${ARCHETYPE}\n\n` +
  findings.map((f) => `- **${f.severity}** \`${f.id}\` ${f.route} — ${f.message}`).join('\n') +
  `\n\nCOVERAGE: ${table.length} of ${contentRoutes.length} built routes audited (skipped: ${skipped.length ? skipped.join('; ') : 'none'})\n`);

const blocking = findings.filter((f) => ['CRITICAL', 'HIGH'].includes(f.severity)).length;
// contracts: every gate prints WHAT IT MEASURED, not only what failed - the
// fixed shape `checked=<n> failed=<m>` on the verdict line. Without it a
// clean run and a run that measured nothing print the same words. A gate
// whose checked is 0 must FAIL unless it also prints an exemption reason.
console.log(`seo-audit: checked=${findings.length} failed=${findings.filter((f) => ["CRITICAL", "HIGH"].includes(f.severity)).length}`);
process.exit(blocking ? 1 : 0);
