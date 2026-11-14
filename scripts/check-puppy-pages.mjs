#!/usr/bin/env node
// K-130: npm run check:puppy-pages - the build gate for individual puppy pages.
//
//   node scripts/check-puppy-pages.mjs [--dist dist] [--no-write]
//
// 1. Publish report (src/lib/puppy-publish.mjs, the same rule the page and the
//    sitemap use): every Balestier puppy and whether its page is thin (and why);
//    every row excluded because it is not in Balestier. Both go to
//    NEEDS-ATTENTION.md, one line each, between the check:puppy-pages markers.
// 2. Hard fails (exit 1):
//    - a non-Balestier row in src/data/available-puppies.json (it would reach a card)
//    - a built puppy page, card or sitemap entry for a puppy outside Balestier
//    - a thin page that is indexable, in the sitemap, or carries Product/Offer
//    - an indexable available page without a Product whose price is on the page
//    - more than one H1; "null" / "undefined" / "NaN" / a wrong a-an article in
//      visible text; a banned word (pedigree, DNA, Malay, hypoallergenic, GST,
//      guaranteed arrival, "guarantee" outside the allowed negation)
//    - FAQPage text that differs from the visible FAQ
//    - an imported page that is indexable
//    - (K-136) an imported page that claims a shop location: a data-location
//      attribute, or "Balestier" anywhere in its <main> content or its JSON-LD.
//      Imported puppies are exempt from the Balestier rule (owner ruling
//      2026-11-14) and are delivered to the buyer's door; local and placed pages
//      must still say Balestier.
// Blockers and warnings never fail the build; they are written for staff.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { areaOf, localGate, localPupPath, localRows, MISSING_TEXT } from '../src/lib/puppy-publish.mjs';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const DIST = path.resolve(ROOT, args.includes('--dist') ? args[args.indexOf('--dist') + 1] : 'dist');
const WRITE = !args.includes('--no-write');
const FEED_FILE = path.join(ROOT, 'src', 'data', 'available-puppies.json');

const fails = [];
const warns = [];
const fail = (where, msg) => fails.push(`${where}: ${msg}`);

const feed = JSON.parse(readFileSync(FEED_FILE, 'utf8'));
const hasPhoto = (f) => !!f && existsSync(path.join(ROOT, 'src', 'assets', 'live', f));
const label = (pup) => `${pup.id ?? '(no id)'} ${pup.name ?? '(no name)'}`;

// ---- 1. the feed the cards read: Balestier only -----------------------------
for (const [breed, bucket] of Object.entries(feed.breeds ?? {})) {
  for (const pup of bucket.available ?? []) {
    if (!areaOf(pup.location)) fail(`feed ${breed}/${pup.id}`, `location "${pup.location}" is not Balestier, and this feed drives the cards`);
  }
}
for (const pup of feed.other ?? []) {
  if (!areaOf(pup.location)) fail(`feed other/${pup.id}`, `location "${pup.location}" is not Balestier, and this feed drives the cards`);
}

// ---- 2. publish report ---------------------------------------------------------
const thin = [];
const excluded = [];
const pages = new Map(); // path -> row info
for (const { breed, pup } of localRows(feed)) {
  const g = localGate(pup, { breed, hasPhoto: hasPhoto(pup.image) });
  if (!g.inScope) {
    excluded.push({ id: pup.id, name: pup.name, reason: g.reason, location: pup.location ?? null });
    continue;
  }
  const p = localPupPath(breed, pup);
  pages.set(p, { breed, pup, thin: g.thin, missing: g.missing });
  if (g.thin) thin.push({ id: pup.id, name: pup.name, path: p, missing: g.missing });
  const w = [];
  if (!pup.name) w.push('no name');
  if (!pup.gender) w.push('no gender');
  if (!pup.color) w.push('no colour');
  if (!pup.dob && !pup.age) w.push('no DOB or age');
  if (pup.hdbApproved !== true) w.push('HDB not ticked (shown as unknown)');
  if (w.length) warns.push(`${label(pup)} (${p}): ${w.join(', ')}`);
}
// Rows the sync dropped for location (page 1 of the sheet), recorded by sync-puppies.mjs.
for (const e of feed.excluded ?? []) excluded.push({ id: e.id, name: e.name, reason: e.reason, location: e.location ?? null, fromSync: true });

// ---- 3. built pages --------------------------------------------------------------
const text = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');
const BANNED = [
  [/\bpedigree\b/i, 'pedigree'],
  [/\bDNA\b/, 'DNA'],
  [/\bMalay\b/, 'Malay'],
  [/hypoallergenic/i, 'hypoallergenic'],
  [/\bGST\b/, 'GST'],
  [/guaranteed arrival/i, 'guaranteed arrival'],
];
const ALLOWED_GUARANTEE = [/not guaranteed until the deposit is received/gi];
const ARTICLE_RX = /\ba ([aeiou][a-z]+)/gi;
const ARTICLE_OK = /^(uni|use|usu|one|euro|u[bcdfgklmnpstvz][aeiou])/i; // "a usual", "a unique"…

const sitemapUrls = new Set();
if (existsSync(DIST)) {
  for (const f of readdirSync(DIST).filter((f) => /^sitemap-\d+\.xml$/.test(f))) {
    for (const m of readFileSync(path.join(DIST, f), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)) sitemapUrls.add(new URL(m[1]).pathname);
  }
}

const builtPups = [];
const puppiesDir = path.join(DIST, 'puppies');
if (!existsSync(puppiesDir)) fail('dist', `${path.relative(ROOT, puppiesDir)} does not exist - build first`);
else {
  for (const b of readdirSync(puppiesDir, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    for (const d of readdirSync(path.join(puppiesDir, b.name), { withFileTypes: true }).filter((d) => d.isDirectory())) {
      const file = path.join(puppiesDir, b.name, d.name, 'index.html');
      if (!existsSync(file)) continue;
      const html = readFileSync(file, 'utf8');
      if (!html.includes('data-puppy-page')) continue;
      const urlPath = `/puppies/${b.name}/${d.name}/`;
      builtPups.push(urlPath);
      const attr = (n) => (html.match(new RegExp(`${n}="([^"]*)"`)) ?? [])[1] ?? null;
      const variant = attr('data-variant');
      const isThin = attr('data-thin') === 'true';
      const robots = (html.match(/<meta name="robots" content="([^"]*)"/) ?? [])[1] ?? '';
      const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
      const product = ld.find((x) => x['@type'] === 'Product');
      const faqLd = ld.find((x) => x['@type'] === 'FAQPage');
      const body = text(html.slice(html.indexOf('data-puppy-page')));
      const where = urlPath;

      // location: local and placed pages are Balestier only, on the page and
      // behind it. Imported pages have no location and must not claim one.
      if (variant === 'imp') {
        if (attr('data-location') != null) fail(where, `imported page carries data-location="${attr('data-location')}" (imported puppies have no shop location)`);
        const main = html.slice(html.indexOf('<main'), html.indexOf('</main>') + 7);
        if (/balestier/i.test(text(main))) fail(where, 'imported page claims a shop location: "Balestier" in its content');
        if (ld.some((x) => /balestier/i.test(JSON.stringify(x)))) fail(where, 'imported page claims a shop location: "Balestier" in its schema');
      } else if (attr('data-location') !== 'Balestier') fail(where, `page location "${attr('data-location')}" is not Balestier`);
      if (variant === 'av' && !pages.has(urlPath)) fail(where, 'available page with no in-scope Balestier row behind it');

      // structure and words
      const h1s = (html.match(/<h1[\s>]/g) ?? []).length;
      if (h1s !== 1) fail(where, `${h1s} H1 elements`);
      for (const w of ['null', 'undefined', 'NaN']) if (new RegExp(`\\b${w}\\b`).test(body)) fail(where, `"${w}" in visible text`);
      for (const m of body.matchAll(ARTICLE_RX)) if (!ARTICLE_OK.test(m[1])) fail(where, `article artefact "a ${m[1]}"`);
      for (const [rx, name] of BANNED) if (rx.test(body)) fail(where, `banned word "${name}"`);
      let g = body;
      for (const rx of ALLOWED_GUARANTEE) g = g.replace(rx, '');
      if (/guarantee/i.test(g)) fail(where, '"guarantee" outside the allowed negation');

      // index rules
      const noindex = /noindex/.test(robots);
      if (variant === 'imp' && !noindex) fail(where, 'imported page is indexable');
      if (isThin) {
        if (!/noindex,\s*follow/.test(robots)) fail(where, `thin page robots is "${robots || '(none)'}", expected noindex, follow`);
        if (sitemapUrls.has(urlPath)) fail(where, 'thin page is in the sitemap');
        if (product || /"@type":"Offer"/.test(html)) fail(where, 'thin page ships Product/Offer schema');
      }
      if (variant === 'av' && !isThin) {
        if (noindex) fail(where, 'complete available page is noindex');
        if (!product?.offers?.price) fail(where, 'complete available page has no Product/Offer');
        else if (!body.includes(`$${Number(product.offers.price).toLocaleString('en-SG')}`)) fail(where, 'Offer price is not visible on the page');
      }
      if (variant === 'pl' && product) fail(where, 'placed page ships a Product');
      if (product && (product.review || product.aggregateRating)) fail(where, 'review/aggregateRating on the puppy Product');

      // FAQ: visible == schema
      const visibleQ = [...html.matchAll(/<summary>([\s\S]*?)<\/summary>/g)].map((m) => text(m[1]).trim());
      // inline links are part of the sentence: strip their tags without adding a space
      const visibleA = [...html.matchAll(/<p data-faq-answer[^>]*>([\s\S]*?)<\/p>/g)].map((m) => text(m[1].replace(/<\/?a\b[^>]*>/g, '')).trim());
      if (faqLd || visibleQ.length) {
        const schemaQ = (faqLd?.mainEntity ?? []).map((q) => q.name.replace(/\s+/g, ' ').trim());
        const schemaA = (faqLd?.mainEntity ?? []).map((q) => q.acceptedAnswer.text.replace(/\s+/g, ' ').trim());
        if (JSON.stringify(schemaQ) !== JSON.stringify(visibleQ)) fail(where, 'FAQPage questions differ from the visible FAQ');
        else if (JSON.stringify(schemaA) !== JSON.stringify(visibleA)) {
          const i = schemaA.findIndex((a, k) => a !== visibleA[k]);
          fail(where, `FAQPage answer ${i + 1} differs from the visible FAQ:
      schema:  ${schemaA[i]}
      visible: ${visibleA[i]}`);
        }
      }
    }
  }
}

// sitemap: every puppy URL is a complete Balestier page
for (const u of sitemapUrls) {
  if (!/^\/puppies\/[^/]+\/[^/]+\/$/.test(u)) continue;
  const file = path.join(DIST, u, 'index.html');
  if (!existsSync(file)) continue;
  const html = readFileSync(file, 'utf8');
  if (!html.includes('data-puppy-page')) continue;
  if (!/data-location="Balestier"/.test(html)) fail(`sitemap ${u}`, 'sitemap entry for a page outside Balestier');
  if (/data-thin="true"/.test(html)) fail(`sitemap ${u}`, 'sitemap entry for a thin page');
}

// cards: no excluded (non-Balestier) puppy may appear anywhere in dist
const excludedIds = [...new Set(excluded.map((e) => String(e.id ?? '')).filter((id) => /^\d+$/.test(id)))];
if (excludedIds.length && existsSync(DIST)) {
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : d.name.endsWith('.html') ? [path.join(dir, d.name)] : []));
  const rx = new RegExp(`(?:pup|sold|pup-video):(${excludedIds.join('|')})\\b|/puppies/[^/"]+/(${excludedIds.join('|')})-`, 'g');
  for (const f of walk(DIST)) {
    const html = readFileSync(f, 'utf8');
    for (const m of html.matchAll(rx)) {
      fail(path.relative(DIST, f), `card or link for excluded (non-Balestier) puppy ${m[1] ?? m[2]}`);
      break;
    }
  }
}

// ---- 4. report ----------------------------------------------------------------
const byLocation = {};
for (const e of excluded) {
  const k = e.location ?? '(blank)';
  byLocation[k] = (byLocation[k] ?? 0) + 1;
}
console.log(`check:puppy-pages  dist=${path.relative(ROOT, DIST) || '.'}`);
console.log(`  built puppy pages: ${builtPups.length} (in sitemap: ${builtPups.filter((u) => sitemapUrls.has(u)).length})`);
console.log(`  thin (built, noindex, out of the sitemap): ${thin.length}`);
for (const t of thin) console.log(`    ${t.id} ${t.name ?? '(no name)'} ${t.path}: ${t.missing.map((m) => MISSING_TEXT[m]).join('; ')}`);
console.log(`  excluded, not in Balestier (no page, no card): ${excluded.length} ${JSON.stringify(byLocation)}`);
console.log(`  warnings: ${warns.length}`);
for (const w of warns) console.log(`    ${w}`);

if (WRITE) {
  const NA = path.join(ROOT, 'NEEDS-ATTENTION.md');
  const START = '<!-- check:puppy-pages:start -->';
  const END = '<!-- check:puppy-pages:end -->';
  const stamp = new Intl.DateTimeFormat('en-SG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Singapore' }).format(new Date());
  const block = [
    START,
    `## Puppy pages (npm run check:puppy-pages, ${stamp} SGT)`,
    '',
    thin.length ? '**Thin pages** (built, noindex, out of the sitemap until the sheet row is filled):' : '**Thin pages:** none.',
    ...thin.map((t) => `- ${t.id} ${t.name ?? '(no name)'}: ${t.missing.map((m) => MISSING_TEXT[m]).join('; ')} (${t.path})`),
    '',
    excluded.length ? `**Not listed: not in Balestier** (${excluded.length} rows on page 1 of the sheet; no page, no card):` : '**Not listed:** none.',
    ...excluded.map((e) => `- ${e.id || '(no id)'} ${e.name ?? '(no name)'}: ${e.reason}`),
    '',
    fails.length ? `**Gate failures:** ${fails.length} (see the build log).` : '**Gate failures:** none.',
    END,
  ].join('\n');
  let cur = existsSync(NA) ? readFileSync(NA, 'utf8') : '# NEEDS-ATTENTION\n';
  cur = cur.includes(START) ? cur.replace(new RegExp(`${START}[\\s\\S]*?${END}`), block) : `${cur.trimEnd()}\n\n${block}\n`;
  writeFileSync(NA, cur);
  console.log(`  wrote NEEDS-ATTENTION.md (${thin.length} thin, ${excluded.length} excluded)`);
}

if (fails.length) {
  console.error(`\nFAIL: ${fails.length} puppy-page gate failure(s)`);
  for (const f of fails) console.error(`  ${f}`);
  process.exit(1);
}
console.log('\nPASS: puppy pages');
