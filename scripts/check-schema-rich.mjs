#!/usr/bin/env node
// kit:check-schema-rich@1.0.0 — the RICH-RESULT half of the graph, measured on dist/.
// Usage: node scripts/check-schema-rich.mjs [--all | <slug>...]
//
// page-health.mjs --schema counts the identity nodes (one #organization, one #website, one
// WebPage-family node, one BreadcrumbList). This gate covers what page-health never looked
// at, and what the pipeline specified in prose and encoded nowhere:
//
//   (a) ITEMLIST. stage-3-toolkit.md specifies "ItemList schema" on EVERY hub row
//       (/blog/, /category/<slug>/, /reviews/, /services/). src/lib/schema.ts had no
//       emitter and no gate grepped for one, which is precisely the failure mode the
//       skill's opening rule names: a prose rule is not an encoded rule.
//   (b) PRICE. The pipeline locks a single price source at Checkpoint 1 and re-reads it
//       every 90 days, then shipped those prices as TEXT ONLY — no price, currency or
//       availability in structured data, so no rich-result eligibility on the money pages.
//       THE SITE'S OWN prices are the ones this gate binds: every row of src/data/offers.ts
//       must reach both the copy and the graph, and any element the page marks data-price
//       must have an Offer behind it. A MARKET FIGURE quoted in editorial prose ("BTO
//       renovations run S$25,000-S$51,000") is NOT the site's price, and declaring an Offer
//       for it would be a false claim in machine-readable form — the exact defect the
//       pre-tenant archetype rules already forbid. Those are reported as warnings that name
//       the number, so an owner price hiding in prose is visible without being fabricated.
//   (c) HONESTY. Every ItemList row must be a link the page actually renders; every
//       aggregateRating must carry a reviewCount; a Product offer needs priceValidUntil.
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const failures = [];
const warnings = [];
const fail = (route, msg) => failures.push(`${route}: ${msg}`);
const warn = (route, msg) => warnings.push(`${route}: ${msg}`);

const SITE_TS = fs.existsSync('src/data/site.ts') ? fs.readFileSync('src/data/site.ts', 'utf8') : '';
// The kit spells this `export const SITE_ARCHETYPE: Archetype = '<value>'`; projects that
// predate that spelling carry `archetype: "<value>"` inside SITE and re-export it. Read
// both, or the price half of this gate silently switches itself off.
const ARCHETYPE = (
  SITE_TS.match(/SITE_ARCHETYPE(?:\s*:\s*Archetype)?\s*=\s*['"]([^'"]+)['"]/) ||
  SITE_TS.match(/archetype\s*:\s*['"]([^'"]+)['"]/) || [, '']
)[1];
// Archetypes whose money pages are expected to publish a number of their own. A publisher's
// pages are not, so a price in prose there is never even worth a warning.
const PRICED = new Set(['productized-services', 'ecommerce', 'local-service', 'affiliate-review']);

// THE SINGLE PRICE SOURCE, read as data. Each OFFERS row names the route it belongs to and
// the number that route must both render and declare.
const OFFERS_TS = fs.existsSync('src/data/offers.ts') ? fs.readFileSync('src/data/offers.ts', 'utf8') : '';
const OFFER_ROWS = [];
for (const m of OFFERS_TS.matchAll(/\{[^{}]*route:\s*['"]([^'"]+)['"][\s\S]*?\}\s*,?\n\s*\}/g)) {
  const chunk = m[0];
  // The declaration block (`export const OFFERS: OfferRecord[] = []`) and the interface
  // above it carry no route, so only real rows reach here.
  OFFER_ROWS.push({
    route: m[1],
    price: (chunk.match(/\bprice:\s*['"]?([\d.]+)/) || [, ''])[1],
    currency: (chunk.match(/priceCurrency:\s*['"]([A-Z]{3})['"]/) || [, ''])[1],
    name: (chunk.match(/\bname:\s*['"]([^'"]+)['"]/) || [, ''])[1],
  });
}
// Hub routes carry a listing grid as their centerpiece.
const HUB = /^\/(blog|reviews|services|category\/[^/]+|guides|tools)\/$/;

function builtPages() {
  const out = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (e.name !== 'index.html') continue;
      let route = '/' + path.relative('dist', p).replace(/\\/g, '/').replace(/index\.html$/, '');
      out.push({ route: route.replace(/\/{2,}/g, '/'), html: fs.readFileSync(p, 'utf8') });
    }
  };
  walk('dist');
  return out.sort((a, b) => a.route.localeCompare(b.route));
}

// SHELL SKIP: a declared shell has no content yet, so it has no listing and no price.
const SHELL_SET = (() => {
  const out = new Set();
  const w = (d, acc = []) => { try { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = `${d}/${e.name}`; if (e.isDirectory()) w(p, acc); else if (e.name.endsWith('.astro')) acc.push(p); } } catch {} return acc; };
  for (const p of w('src/pages')) {
    const t = fs.readFileSync(p, 'utf8');
    if (t.includes('PLACEHOLDER-COPY') && /draft\s*=\s*true/.test(t)) {
      let r = p.split('/').join('/').replace(/^src\/pages\//, '').replace(/\.astro$/, '');
      out.add(r === 'index' ? '/' : '/' + r + '/');
    }
  }
  return out;
})();

const all = builtPages().filter((p) => !SHELL_SET.has(p.route));
const target = argv.find((a) => !a.startsWith('--'));
const pages = target ? all.filter((p) => p.route.includes(target)) : all;
// W11.7: a gate that measured nothing is not a pass.
if (!all.length) { console.log('HALT: no dist/**/index.html - there is nothing to gate. Run `npm run build`, or set PROJECT_ROOT.'); process.exit(1); }
if (!pages.length) { console.error('FAIL dist/ is empty or no route matched — run `npm run build`.'); process.exit(1); }

// A currency amount as a READER sees it: "S$1,200", "$99", "USD 4,500", "€30".
const PRICE_TEXT = /(?:[A-Z]{1,3}\$|\$|€|£|¥|₹|\bSGD\b|\bUSD\b|\bAUD\b|\bGBP\b|\bEUR\b)\s?\d[\d,]*(?:\.\d{2})?/;

console.log('ROUTE                              | LIST | OFFERS | RICH');
for (const { route, html } of pages) {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const nodes = [];
  for (const b of blocks) {
    try { const j = JSON.parse(b); nodes.push(...(j['@graph'] ?? [j])); }
    catch { fail(route, 'invalid JSON-LD block'); }
  }
  const typeOf = (n) => (Array.isArray(n['@type']) ? n['@type'] : [n['@type']]).filter(Boolean);
  const of = (t) => nodes.filter((n) => typeOf(n).includes(t));
  const noindex = /name="robots"[^>]*noindex/.test(html);
  const main = (html.split('<main')[1] || '').split('</main>')[0] || '';
  const text = main.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ');
  const hrefs = new Set([...main.matchAll(/href="([^"#?]+)"/g)].map((m) => m[1].replace(/^https?:\/\/[^/]+/, '')));

  const lists = of('ItemList');
  const products = of('Product');
  const services = of('Service');
  // Offers nested inside an ItemList row are still this page's offers. Reading only the
  // TOP-LEVEL graph nodes reported "68 data-price elements and no Offer node" on a
  // listing page whose every row carries one.
  const nested = [];
  const walkNodes = (v) => {
    if (Array.isArray(v)) return v.forEach(walkNodes);
    if (v && typeof v === 'object') {
      if (v.offers) nested.push(v);
      Object.values(v).forEach(walkNodes);
    }
  };
  walkNodes(nodes);
  const offers = [...new Set([...products, ...services].filter((n) => n.offers).concat(nested))];

  // ---- (a) ITEMLIST -------------------------------------------------------------------
  const isHub = HUB.test(route) || typeOf(nodes.find((n) => String(n['@id'] || '').endsWith('#webpage')) || {}).includes('CollectionPage');
  if (!noindex && isHub) {
    if (!lists.length) {
      fail(route, 'hub/CollectionPage emits no ItemList — stage-3-toolkit specifies the listing grid AND its schema on every hub row');
    } else if (lists.length > 1) {
      fail(route, `${lists.length} ItemList nodes for one listing`);
    }
  }
  for (const l of lists) {
    const items = l.itemListElement ?? [];
    if (!items.length) { fail(route, 'ItemList with no itemListElement'); continue; }
    if (l.numberOfItems !== undefined && Number(l.numberOfItems) !== items.length) {
      fail(route, `ItemList numberOfItems=${l.numberOfItems} but ships ${items.length} rows`);
    }
    const positions = items.map((i) => Number(i.position));
    if (positions.some((p, i) => p !== i + 1)) fail(route, 'ItemList positions are not 1..n in order');
    for (const it of items) {
      // A ListItem may carry its URL directly, or wrap a node that carries `url` or `@id`.
      // Reading `it.item` last stringified the node itself as "[object Object]" and failed
      // every row on a correctly shaped ItemList.
      const url = String(it.url || it.item?.url || it.item?.['@id'] || (typeof it.item === 'string' ? it.item : '') || '').replace(/^https?:\/\/[^/]+/, '');
      if (!url) { fail(route, `ItemList row "${it.name || '?'}" has no url`); continue; }
      // The listed row must be a link the READER can click on this page. A listing that
      // declares ten children and renders three is a claim about a page that does not exist.
      if (!hrefs.has(url) && !hrefs.has(url.replace(/\/$/, '')) && !hrefs.has(url + '/')) {
        fail(route, `ItemList declares ${url}, which this page does not link to`);
      }
    }
  }

  // ---- (b) PRICE ----------------------------------------------------------------------
  // 1. THE REGISTRY BINDS. A row in src/data/offers.ts is the owner's own price, locked at
  //    Checkpoint 1: it must reach the reader AND the graph, with the same number.
  for (const row of OFFER_ROWS.filter((r) => r.route === route)) {
    if (!offers.length) {
      fail(route, `src/data/offers.ts carries a price for this route and the page declares no Offer — the locked price stops at the copy`);
    }
    if (row.price && !text.includes(row.price) && !text.includes(Number(row.price).toLocaleString('en-US'))) {
      fail(route, `offers.ts price ${row.price} is not rendered anywhere on the page — the reader and the SERP would see different numbers`);
    }
    if (row.price && offers.length) {
      const declared = offers.flatMap((n) => (Array.isArray(n.offers) ? n.offers : [n.offers])).map((o) => String(o.price ?? ''));
      if (!declared.includes(String(row.price))) {
        fail(route, `the graph declares ${declared.filter(Boolean).join('/') || '(no price)'} but offers.ts locks ${row.price}`);
      }
    }
  }
  // 2. A MARKED PRICE BINDS. `data-price` is how a money page renders its own figure; an
  //    element carrying it with no Offer behind it is the text-only failure, measured.
  const marked = [...main.matchAll(/data-price(?:=["'][^"']*["'])?/g)].length;
  if (!noindex && marked && !offers.length) {
    fail(route, `${marked} element(s) marked data-price and no Offer node — the money page's own price is invisible to the SERP`);
  }
  // 3. A LOOSE price in prose on a priced archetype is a WARNING, never a failure: on a
  //    pre-tenant or editorial page it is a market figure, and declaring an Offer for a
  //    number the business does not charge is a lie the graph would carry forever.
  const renderedPrice = PRICE_TEXT.test(text);
  if (!noindex && renderedPrice && !offers.length && !marked && PRICED.has(ARCHETYPE) && !OFFER_ROWS.some((r) => r.route === route)) {
    const shown = (text.match(PRICE_TEXT) || [''])[0].trim();
    warn(route, `renders "${shown}" with no Offer — if that is THIS business's price it belongs in src/data/offers.ts and in the graph; if it is a market figure, leave it`);
  }
  for (const n of [...products, ...services]) {
    const o = n.offers;
    if (!o) { warn(route, `${typeOf(n)[0]} "${n.name || '?'}" carries no offers — priced pages declare their price`); continue; }
    const list = Array.isArray(o) ? o : [o];
    for (const off of list) {
      if (!off.priceCurrency) fail(route, `Offer on "${n.name || '?'}" has no priceCurrency`);
      // An AggregateOffer prices a RANGE (lowPrice/highPrice) and never carries `price`;
      // demanding one failed every correctly-shaped breed listing on a marketplace site.
      const aggregate = String(off['@type'] || '').includes('AggregateOffer');
      const priced = off.price !== undefined || off.priceRange
        || (aggregate && off.lowPrice !== undefined && off.highPrice !== undefined);
      if (!priced) fail(route, `Offer on "${n.name || '?'}" declares neither price nor priceRange`);
      // The page writes prices for humans ("$4,988"); the offer writes them for machines
      // (4988). Comparing the raw strings failed every correctly-priced page on this site, so
      // both sides are compared with thousands separators removed.
      const plainText = text.replace(/(\d),(?=\d{3})/g, '$1');
      if (off.price !== undefined && !plainText.includes(String(off.price).replace(/\.00$/, ''))) {
        fail(route, `Offer price ${off.price} appears nowhere in the rendered page — schema and copy disagree`);
      }
      if (typeOf(n).includes('Product') && !off.priceValidUntil) {
        warn(route, `Product offer has no priceValidUntil — Google downgrades the result once the price is stale`);
      }
      // The full schema.org ItemAvailability enum. The short list rejected BackOrder, which is
      // exactly what a waitlisted breed with no puppy at the farm today should declare.
      if (off.availability && !/schema\.org\/(InStock|InStoreOnly|OnlineOnly|OutOfStock|PreOrder|PreSale|BackOrder|LimitedAvailability|SoldOut|Discontinued|MadeToOrder|Reserved)$/.test(off.availability)) {
        fail(route, `Offer availability "${off.availability}" is not a schema.org enum URL`);
      }
    }
  }

  // ---- (c) THE REST OF THE RICH SURFACE ------------------------------------------------
  for (const n of nodes) {
    const r = n.aggregateRating;
    if (r) {
      if (!(Number(r.reviewCount) >= 1)) fail(route, 'aggregateRating with no reviewCount — an aggregate of nothing');
      const best = Number(r.bestRating ?? 5);
      if (!(Number(r.ratingValue) >= Number(r.worstRating ?? 1) && Number(r.ratingValue) <= best)) {
        fail(route, `aggregateRating ratingValue ${r.ratingValue} outside its own scale`);
      }
    }
  }
  for (const h of of('HowTo')) {
    const steps = h.step ?? [];
    if (steps.length < 2) fail(route, `HowTo "${h.name || '?'}" has ${steps.length} step(s) — a one-step procedure is not a HowTo`);
    for (const st of steps) if (!st.text) fail(route, `HowTo step "${st.name || '?'}" has no text`);
    // The steps must be on the page, not invented for the SERP.
    for (const st of steps.slice(0, 3)) {
      const probe = String(st.name || '').slice(0, 24);
      if (probe && !text.includes(probe)) fail(route, `HowTo step "${probe}" is not rendered on the page`);
    }
  }
  for (const v of of('VideoObject')) {
    if (!v.thumbnailUrl) fail(route, `VideoObject "${v.name || '?'}" has no thumbnailUrl`);
    if (!v.uploadDate) fail(route, `VideoObject "${v.name || '?'}" has no uploadDate`);
    if (!v.contentUrl && !v.embedUrl) fail(route, `VideoObject "${v.name || '?'}" is unplayable (no contentUrl/embedUrl)`);
  }
  const sp = nodes.map((n) => n.speakable).filter(Boolean);
  for (const s of sp) {
    const sels = s.cssSelector ?? [];
    if (!sels.length) fail(route, 'SpeakableSpecification with no cssSelector');
    for (const sel of sels) {
      if (/^(body|html|main)$/.test(String(sel).trim())) fail(route, `speakable selector "${sel}" reads the whole page — name the capsule`);
    }
  }

  console.log(`${route.padEnd(34)} | ${String(lists.length).padStart(4)} | ${String(offers.length).padStart(6)} | ${[of('HowTo').length && 'HowTo', of('VideoObject').length && 'Video', sp.length && 'Speakable'].filter(Boolean).join(',') || '-'}`);
}

console.log(`\narchetype=${ARCHETYPE || '(unset)'} pages=${pages.length} failures=${failures.length} warnings=${warnings.length}`);
if (failures.length) { console.log('\nFAILURES:'); for (const f of failures) console.log('  ' + f); }
if (warnings.length) { console.log('\nWARNINGS (not counted):'); for (const w of warnings) console.log('  ' + w); }
console.log(failures.length ? 'FAIL check-schema-rich' : 'PASS check-schema-rich');
// contracts: every gate prints WHAT IT MEASURED, not only what failed - the
// fixed shape `checked=<n> failed=<m>` on the verdict line. Without it a
// clean run and a run that measured nothing print the same words. A gate
// whose checked is 0 must FAIL unless it also prints an exemption reason.
console.log(`check-schema-rich: checked=${pages.length} failed=${failures.length}`);
process.exit(failures.length ? 1 : 0);
