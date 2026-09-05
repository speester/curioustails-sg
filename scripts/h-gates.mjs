#!/usr/bin/env node
// kit:h-gates@1.0.0 — the H-series checks that read the BUILT dist/ (H10, H11, H12, H15).
//
//   node scripts/h-gates.mjs --entity-grouping    H10  one entity, one parent node
//   node scripts/h-gates.mjs --aside              H11  secondary links are supplementary
//   node scripts/h-gates.mjs --budget             H12  retrieval budget (contracts §20)
//   node scripts/h-gates.mjs --capsule-variance   H15  capsule scope vs stylometry (§18)
//   node scripts/h-gates.mjs --all
//
// Every check measures dist/, never src/ — the retrofit rule. LCP is NOT measured here
// (page-health.mjs owns the browser); --budget covers document weight and blocking requests,
// which are the halves a static grep can prove.
import fs from 'node:fs';
import path from 'node:path';

const DIST = path.join(process.env.PROJECT_ROOT || process.cwd(), 'dist');
const args = process.argv.slice(2);
// AN UNKNOWN FLAG IS AN ERROR, NOT AN ALL-GREEN RUN. `--bogus` used to print the same
// "PASS: 0 H-gate check(s) failing" as a real pass and exit 0.
const KNOWN_FLAGS = ['--entity-grouping', '--aside', '--budget', '--capsule-variance', '--all'];
const unknown = args.filter((a) => !KNOWN_FLAGS.includes(a));
if (unknown.length) {
  console.error(`FAIL unknown flag(s): ${unknown.join(' ')} — known: ${KNOWN_FLAGS.join(' ')}`);
  process.exit(2);
}
const want = (f) => args.includes(f) || args.includes('--all');
const ex = (p) => { try { fs.accessSync(p); return true; } catch { return false; } };

if (!ex(DIST)) { console.error('HALT: dist/ missing — build first.'); process.exit(1); }

const pages = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    // `index.html` ONLY. Walking every *.html made dist/404.html a "built page" on every
    // site (28 pages on a 27-route build), and no exemption predicate can name it.
    else if (e.name === 'index.html') pages.push(p);
  }
})(DIST);

const route = (f) => '/' + path.relative(DIST, f).replace(/\\/g, '/').replace(/index\.html$/, '');
// contracts §3: ONE predicate (scripts/lib/exemptions.mjs).
import { exemptionFor, EXEMPT as _EX } from './lib/exemptions.mjs';
// W11.2: the row, not the route alone — a keywordless utility row was graded here and
// exempt in letters (h)/(n).
const EXEMPT = { test: (route) => exemptionFor(route) === _EX };
// Prefer <main>. The skip link ("Skip to content") sits in <body> but OUTSIDE header/nav, so
// stripping chrome tags left it as the first sentence of every page: the capsule-pattern share
// then read 100% identical openings site-wide and the gate could never pass on any site.
const body = (h) =>
  (h.match(/<main[^>]*>([\s\S]*?)<\/main>/i) || h.match(/<body[^>]*>([\s\S]*?)<\/body>/i) || [, h])[1];
const strip = (h) => h
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<(header|footer|nav|aside)\b[\s\S]*?<\/\1>/gi, ' ')
  // VERBATIM QUOTED TEXT IS NOT THIS SITE'S PROSE. A customer review or an expert
  // quotation is reproduced word for word; grading its opener as machine-written slop
  // asks the site to rewrite what someone else actually said, which is falsification,
  // not editing. Quotations are dropped before the prose measures run.
  // (RTP Fix 2026-09-05: a real 5-star review opening "Overall, ..." failed this gate.)
  .replace(/<blockquote[\s\S]*?<\/blockquote>/gi, ' ')
  .replace(/<[^>]*data-(review|quote)[^>]*>[\s\S]*?<\/[a-z]+>/gi, ' ')
  // Block boundaries END a sentence. Without this an <h1> fuses with the paragraph that
  // follows it, so a page's "first sentence" is really heading+prose — which silently
  // defeated both the stock-opener check and the capsule-pattern measure below.
  .replace(/<\/(h[1-6]|p|li|dd|dt|blockquote|figcaption|td|th|div|section|article)>/gi, '. ')
  .replace(/<(br|hr)\s*\/?>/gi, '. ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&[a-z#0-9]+;/gi, ' ')
  .replace(/\s+/g, ' ')
  .replace(/(\.\s*){2,}/g, '. ')
  .trim();

let failures = 0;
const row = (name, ok, detail) => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(22)} ${detail}`);
};

/* ---------------- H10: one entity, one parent node ---------------- */
if (want('--entity-grouping')) {
  // A card declaring an entity must carry its price and its CTA INSIDE the same element.
  // Attributes that sit outside the node bind to whatever the parser reaches next.
  let cards = 0, leaks = 0; const examples = [];
  for (const f of pages) {
    const h = fs.readFileSync(f, 'utf8');
    const re = /<(article|li|div)[^>]*\bdata-entity(?:=["'][^"']*["'])?[^>]*>([\s\S]*?)<\/\1>/gi;
    let m;
    while ((m = re.exec(h))) {
      cards++;
      const inner = m[2];
      const hasPrice = /(\$|SGD|USD|£|€)\s?\d/.test(inner) || /data-price/.test(inner);
      const hasCta = /<a\b[\s\S]*?>/i.test(inner) || /<button\b/i.test(inner);
      const hasImg = /<img\b|<picture\b/i.test(inner);
      if (!(hasPrice && hasCta && hasImg)) {
        leaks++;
        if (examples.length < 3) examples.push(`${route(f)} (img:${hasImg} price:${hasPrice} cta:${hasCta})`);
      }
    }
  }
  row('entity grouping', leaks === 0,
      cards === 0
        ? 'no [data-entity] cards found — mark listing cards with data-entity to enable this gate'
        : `${cards} entity card(s), attributes outside the node: ${leaks}` +
          (examples.length ? ` — ${examples.join('; ')}` : ''));
}

/* ---------------- H11: secondary links inside <aside> ---------------- */
if (want('--aside')) {
  let bad = 0; const examples = [];
  for (const f of pages) {
    const h = fs.readFileSync(f, 'utf8');
    // a "related / you may also like" block that is NOT inside <aside> dilutes body-link weight
    const re = /<(section|div)[^>]*(class|id)=["'][^"']*(related|also-like|more-from|sidebar)[^"']*["'][^>]*>/gi;
    let m;
    while ((m = re.exec(h))) {
      const before = h.slice(0, m.index);
      const opens = (before.match(/<aside\b/gi) || []).length;
      const closes = (before.match(/<\/aside>/gi) || []).length;
      if (opens <= closes) { bad++; if (examples.length < 3) examples.push(route(f)); }
    }
  }
  row('aside isolation', bad === 0,
      `related/sidebar blocks outside <aside>: ${bad}` + (examples.length ? ` — ${examples.join(', ')}` : ''));
}

/* ---------------- H12: retrieval budget (contracts §20) ---------------- */
if (want('--budget')) {
  const CAP_KB = 100;
  let worst = 0, worstRoute = '', over = 0, blocking = 0; const blockers = [];
  for (const f of pages) {
    const h = fs.readFileSync(f, 'utf8');
    const kb = Buffer.byteLength(h, 'utf8') / 1024;
    if (kb > worst) { worst = kb; worstRoute = route(f); }
    if (kb > CAP_KB) over++;
    // render-blocking third-party: a <script src> in <head> without defer/async/module,
    // or a stylesheet from another origin
    const head = (h.match(/<head[\s\S]*?<\/head>/i) || [''])[0];
    for (const m of head.matchAll(/<script\b[^>]*src=["']([^"']+)["'][^>]*>/gi)) {
      const tag = m[0], src = m[1];
      const thirdParty = /^https?:\/\//.test(src);
      const deferred = /\b(defer|async)\b/.test(tag) || /type=["']module["']/.test(tag);
      if (thirdParty && !deferred) { blocking++; if (blockers.length < 3) blockers.push(`${route(f)} ${src.slice(0, 48)}`); }
    }
    for (const m of head.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*href=["'](https?:\/\/[^"']+)["']/gi)) {
      blocking++; if (blockers.length < 3) blockers.push(`${route(f)} css ${m[1].slice(0, 48)}`);
    }
  }
  // E6 (owner decision 2026-09-03): THE HTML-WEIGHT CAP IS DROPPED. contracts §20 capped
  // the built document at 100 KB while §1a's word floors put 20 of 28 real pages over it
  // with briefs that PASSED their word target — one contract failing another by
  // construction. Weight is now REPORTED, never gated; perf is gated by lab LCP and by
  // the render-blocking row below, which measure what a reader actually waits for.
  console.log(`  NOTE  html weight            max ${worst.toFixed(0)}KB on ${worstRoute || 'n/a'} (reported, not gated - E6)`);
  row('render-blocking 3P', blocking === 0,
      `blocking third-party requests: ${blocking}` + (blockers.length ? ` — ${blockers.join('; ')}` : ''));
}

/* ---------------- H15: capsule scope vs stylometry (contracts §18) ---------------- */
if (want('--capsule-variance')) {
  const STOCK = [/^overall,/i, /^in conclusion,/i, /^in summary,/i, /^furthermore,/i,
                 /^moreover,/i, /^it'?s important to note/i, /^when it comes to/i];
  const openings = new Map();
  let lowSigma = 0, warnSigma = 0, stock = 0, content = 0;
  const sigmaBad = [], stockBad = [];
  for (const f of pages) {
    const r = route(f);
    if (EXEMPT.test(r)) continue;
    const text = strip(body(fs.readFileSync(f, 'utf8')));
    if (text.length < 400) continue;
    content++;
    const sents = text.split(/(?<=[.!?])\s+(?=[A-Z0-9])/).map((s) => s.trim()).filter(Boolean);
    // Headings and labels became their own "sentences" at the block boundaries above; counting
    // them drags sigma down on well-written pages. Variance is measured on PROSE only.
    const prose = sents.filter((s) => s.split(/\s+/).length >= 5);
    // Thresholds calibrated against measured output, not guessed: a deliberately uniform page
    // reads sigma 0.7, varied human prose reads 4.0+. FAIL is the slop band; 4.0-6.0 WARNs so a
    // short-but-honest page is not blocked. Needs a real sample before it binds at all.
    if (prose.length >= 15) {
      const lens = prose.map((s) => s.split(/\s+/).length);
      const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
      const sigma = Math.sqrt(lens.reduce((a, b) => a + (b - mean) ** 2, 0) / lens.length);
      if (sigma < 4.0) { lowSigma++; if (sigmaBad.length < 3) sigmaBad.push(`${r} σ=${sigma.toFixed(1)}`); }
      else if (sigma < 6.0) { warnSigma++; }
    }
    for (const s of sents) {
      if (STOCK.some((re) => re.test(s.trim()))) {
        stock++; if (stockBad.length < 3) stockBad.push(`${r} "${s.trim().slice(0, 40)}…"`);
      }
    }
    // capsule opening pattern = first three words of the page's first sentence
    // The block-boundary rule above can leave a leading fragment with no words in it, so the
    // "first sentence" was a bare "." on every page - identical, and just as unpassable as the
    // skip link was. Take the first sentence that actually contains words.
    const firstReal = sents.find((x) => /[a-z]{3}/i.test(x)) || '';
    const first = firstReal.split(/\s+/).slice(0, 3).join(' ').toLowerCase();
    if (first) openings.set(first, (openings.get(first) || 0) + 1);
  }
  const top = [...openings.entries()].sort((a, b) => b[1] - a[1])[0];
  const share = top && content ? top[1] / content : 0;
  row('sentence variance', lowSigma === 0,
      `σ < 4.0 (fail): ${lowSigma}/${content} · σ 4.0-6.0 (warn): ${warnSigma}` +
      (sigmaBad.length ? ` — ${sigmaBad.join(', ')}` : ''));
  row('stock transitions', stock === 0,
      `stock openers: ${stock}` + (stockBad.length ? ` — ${stockBad.join('; ')}` : ''));
  // The 40% cap is a SITE-SCALE rule (contracts §18). On a handful of pages any opening is a
  // large share by arithmetic, so the cap only binds once there are enough pages for the
  // measurement to mean anything — otherwise the gate fires on every small site and gets ignored.
  const MIN_FOR_SHARE = 5;
  row('capsule pattern share', content < MIN_FOR_SHARE || share <= 0.40,
      top ? `max "${top[0]}" on ${(share * 100).toFixed(0)}% of ${content} page(s) (cap 40%` +
            (content < MIN_FOR_SHARE ? `, not binding under ${MIN_FOR_SHARE} pages)` : ')')
          : 'no content pages measured');
}

console.log('-'.repeat(72));
// A GATE THAT MEASURED NOTHING IS NOT A PASS. `PASS: 0 H-gate check(s) failing across 0
// built page(s)` exit 0 is what exit-gate letter (o) printed on an empty dist/ — which is
// every run made from the wrong cwd, and every run made before the build.
if (pages.length === 0) {
  console.log('HALT: no dist/**/index.html — there is nothing to gate. Run `npm run build`, or set PROJECT_ROOT.');
  process.exit(1);
}
console.log(`${failures ? 'FAIL' : 'PASS'}: ${failures} H-gate check(s) failing across ${pages.length} built page(s)`);
// contracts: every gate prints WHAT IT MEASURED, not only what failed - the
// fixed shape `checked=<n> failed=<m>` on the verdict line. Without it a
// clean run and a run that measured nothing print the same words. A gate
// whose checked is 0 must FAIL unless it also prints an exemption reason.
console.log(`h-gates: checked=${pages.length} failed=${failures}`);
process.exit(failures ? 1 : 0);
