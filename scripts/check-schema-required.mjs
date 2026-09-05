// kit:check-schema-required@1.0.0 — REQUIRED SCHEMA PROPERTIES.
//
// WHY THIS EXISTS: valid JSON is not valid schema. check-schema-rich.mjs proves the
// JSON-LD parses and the @ids are distinct; nothing proved that a LocalBusiness
// carries an `address`, that an Article carries `datePublished`, or that a Product
// offer carries a `price`. Each of those parses cleanly, validates as JSON, and is
// INELIGIBLE for every rich result it was written to earn — silently, because
// Google reports ineligibility in Search Console weeks later, not at build time.
//
// The table below is Google's structured-data documentation stored as DATA, so
// updating it is an edit, not a rewrite. REQUIRED = the rich result cannot render
// without it (exit 1). RECOMMENDED = reported, never fatal.
//
// Usage: node scripts/check-schema-required.mjs [--all | <route substring>] [--json]
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const AS_JSON = argv.includes('--json');
const target = argv.find((a) => !a.startsWith('--')) ?? '';

// @type -> { required: [...], recommended: [...] }
// A property listed as `a|b` is satisfied by either name.
const TABLE = {
  Organization: { required: ['name', 'url'], recommended: ['logo', 'sameAs', 'contactPoint'] },
  LocalBusiness: {
    required: ['name', 'address'],
    recommended: ['telephone', 'openingHoursSpecification', 'geo', 'url', 'image', 'priceRange'],
  },
  WebSite: { required: ['name|url'], recommended: ['publisher', 'potentialAction'] },
  WebPage: { required: ['name|headline'], recommended: ['description', 'isPartOf'] },
  Article: {
    required: ['headline', 'datePublished'],
    recommended: ['author', 'dateModified', 'image', 'publisher'],
  },
  BlogPosting: {
    required: ['headline', 'datePublished'],
    recommended: ['author', 'dateModified', 'image', 'publisher'],
  },
  NewsArticle: { required: ['headline', 'datePublished'], recommended: ['author', 'image'] },
  FAQPage: { required: ['mainEntity'], recommended: [] },
  Question: { required: ['name', 'acceptedAnswer'], recommended: [] },
  BreadcrumbList: { required: ['itemListElement'], recommended: [] },
  Product: { required: ['name'], recommended: ['image', 'description', 'offers', 'brand'] },
  Offer: { required: ['price|priceSpecification', 'priceCurrency'], recommended: ['availability', 'url'] },
  Service: { required: ['name'], recommended: ['provider', 'areaServed', 'serviceType'] },
  Person: { required: ['name'], recommended: ['url', 'jobTitle', 'sameAs'] },
  Review: { required: ['reviewRating', 'author'], recommended: ['datePublished'] },
  AggregateRating: { required: ['ratingValue', 'reviewCount|ratingCount'], recommended: [] },
  HowTo: { required: ['name', 'step'], recommended: ['totalTime', 'supply'] },
  VideoObject: {
    required: ['name', 'thumbnailUrl', 'uploadDate'],
    recommended: ['description', 'duration', 'contentUrl'],
  },
  ItemList: { required: ['itemListElement'], recommended: ['numberOfItems'] },
  Event: { required: ['name', 'startDate', 'location'], recommended: ['endDate', 'offers'] },
};

const DIST = 'dist';
// W11.7: a gate that measured nothing is not a pass.
if (!fs.existsSync(DIST)) { console.log('HALT: no dist/**/index.html - there is nothing to gate. Run `npm run build`, or set PROJECT_ROOT.'); process.exit(1); }
const pages = [];
const walk = (dir) => {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name === 'index.html') {
      let route = p.split(path.sep).join('/').replace(/^dist/, '').replace(/index\.html$/, '');
      if (!route) route = '/';
      pages.push({ file: p, route });
    }
  }
};
walk(DIST);

if (!pages.length) {
  // A gate that measured nothing must never report PASS.
  console.log('FAIL check-schema-required: dist/ is empty or missing — run `npm run build` first');
  process.exit(1);
}

const LD_RX = /<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi;

const flatten = (node, out = []) => {
  if (Array.isArray(node)) {
    for (const n of node) flatten(n, out);
    return out;
  }
  if (!node || typeof node !== 'object') return out;
  out.push(node);
  for (const g of node['@graph'] ?? []) flatten(g, out);
  // Nested typed objects are schema in their own right (an Offer inside a Product,
  // a Question inside a FAQPage) and Google validates them as such.
  for (const [k, v] of Object.entries(node)) {
    if (k === '@graph') continue;
    if (v && typeof v === 'object') flatten(v, out);
  }
  return out;
};

const has = (node, spec) =>
  spec.split('|').some((k) => {
    const v = node[k];
    return v !== undefined && v !== null && v !== '' &&
      !(Array.isArray(v) && v.length === 0);
  });

const failures = [];
const warnings = [];
let nodesChecked = 0;
const typeCount = new Map();

for (const { file, route } of pages) {
  if (target && !route.includes(target)) continue;
  const html = fs.readFileSync(file, 'utf8');
  for (const m of html.matchAll(LD_RX)) {
    let data;
    try {
      data = JSON.parse(m[1]);
    } catch {
      failures.push(`${route}: JSON-LD block does not parse`);
      continue;
    }
    for (const node of flatten(data)) {
      const types = [].concat(node['@type'] ?? []);
      for (const t of types) {
        const spec = TABLE[t];
        if (!spec) continue;
        nodesChecked++;
        typeCount.set(t, (typeCount.get(t) ?? 0) + 1);
        for (const req of spec.required) {
          if (!has(node, req)) failures.push(`${route}: ${t} is missing REQUIRED ${req}`);
        }
        for (const rec of spec.recommended) {
          if (!has(node, rec)) warnings.push(`${route}: ${t} is missing recommended ${rec}`);
        }
      }
    }
  }
}

if (AS_JSON) {
  console.log(JSON.stringify({ pages: pages.length, nodesChecked, failures, warnings }, null, 2));
} else {
  console.log('TYPE                 | NODES');
  for (const [t, n] of [...typeCount].sort()) console.log(`${t.padEnd(20)} | ${n}`);
  console.log(`\npages=${pages.length} typed_nodes=${nodesChecked}`);
  console.log(`missing required properties: ${failures.length}`);
  console.log(`missing recommended properties: ${warnings.length}`);
  if (failures.length) {
    console.log('\nFAILURES:');
    for (const f of failures) console.log('  ' + f);
  }
  if (warnings.length) {
    console.log('\nWARNINGS (not counted as failures):');
    for (const w of warnings.slice(0, 40)) console.log('  ' + w);
    if (warnings.length > 40) console.log(`  …and ${warnings.length - 40} more`);
  }
}
if (!nodesChecked) {
  console.log('FAIL check-schema-required: no recognised schema types found across ' +
    `${pages.length} page(s) — the site ships no structured data at all`);
  process.exit(1);
}
// contracts: every gate prints WHAT IT MEASURED, not only what failed - the
// fixed shape `checked=<n> failed=<m>` on the verdict line. Without it a
// clean run and a run that measured nothing print the same words. A gate
// whose checked is 0 must FAIL unless it also prints an exemption reason.
console.log(`check-schema-required: checked=${pages.length} failed=${failures.length}`);
console.log(failures.length ? 'FAIL check-schema-required' : 'PASS check-schema-required');
process.exit(failures.length ? 1 : 0);
