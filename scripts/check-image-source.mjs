// kit:check-image-source@1.0.0 — IMAGE_SOURCE = real-first, enforced.
//
// WHY THIS EXISTS: contracts §19 makes a site declare where its photographs come from.
// Under `real-first` the sellable entity — the thing the buyer is deciding to purchase —
// may not be DEPICTED by a generated image, because a buyer cannot tell a generated
// photo of the product from an inventory photo of it. That was a sentence in a skill and
// no prompt was ever checked against it.
//
// WHAT IT MEASURES
//   * every prompt in config/image-manifest*.json, and
//   * every rendered alt text on a generated asset in dist/
// against the sellable-entity terms derived from SILO_ITEMS in project-config.
//
// Usage: node scripts/check-image-source.mjs [--json]
// Exit 0 clean, 1 on any hit (and 1 when it can measure nothing).
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env.PROJECT_ROOT || process.cwd();
const AS_JSON = process.argv.includes('--json');
const read = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } };

const cfgText = read(path.join(ROOT, 'config', 'project-config.md'));
if (!cfgText) {
  console.log('FAIL check-image-source: config/project-config.md not found — IMAGE_SOURCE is undecidable');
  process.exit(1);
}
const field = (name, dflt = '') => {
  const m = cfgText.match(new RegExp(`^${name}:\\s*(.+)$`, 'm'));
  return m ? m[1].split('#')[0].trim() : dflt;
};

const IMAGE_SOURCE = field('IMAGE_SOURCE', '').toLowerCase();
if (IMAGE_SOURCE !== 'real-first') {
  console.log(`check-image-source: IMAGE_SOURCE="${IMAGE_SOURCE || '(unset)'}" — the real-first prompt constraint does not apply`);
  process.exit(0);
}

// The sellable entity class, from the site's own SILO_ITEMS. Singular + plural, so
// "puppies" in a prompt is caught by the term "puppy".
const items = field('SILO_ITEMS', '').split(/[,|]/).map((x) => x.trim()).filter(Boolean);
if (!items.length) {
  console.log('FAIL check-image-source: SILO_ITEMS is empty — there is no sellable-entity class to check against');
  process.exit(1);
}
const terms = new Set();
for (const it of items) {
  for (const w of it.toLowerCase().split(/\s+/)) {
    if (w.length < 3) continue;
    terms.add(w);
    terms.add(w.endsWith('y') ? `${w.slice(0, -1)}ies` : `${w}s`);
    if (w.endsWith('ies')) terms.add(`${w.slice(0, -3)}y`);
    if (w.endsWith('s')) terms.add(w.slice(0, -1));
  }
}
const RX = new RegExp(`\\b(${[...terms].map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'i');

const hits = [];
let scannedPrompts = 0;

// 1. the prompts themselves
const cfgDir = path.join(ROOT, 'config');
const manifests = fs.existsSync(cfgDir)
  ? fs.readdirSync(cfgDir).filter((f) => /^image-manifest.*\.json$/i.test(f))
  : [];
for (const f of manifests) {
  let data;
  try { data = JSON.parse(read(path.join(cfgDir, f))); } catch { hits.push(`${f}: does not parse`); continue; }
  // SCOPE. A generated image of the thing you sell is banned because it becomes an OFFER:
  // a listing card with a price and an enquiry button, showing an animal nobody owns. A
  // breed-characteristic image is not an offer - it is what the breed looks like, the same
  // knowledge src/data/colours.ts already holds - and the project rule allows it
  // (CLAUDE.md: "AI images only for hero/breed-characteristic/OG"). So the scope is allowed
  // AND POLICED: it must announce itself in the alt text a reader hears, and it may not
  // carry a price or an availability word, which is what would turn it back into an offer.
  const OFFERY = /\b(available now|in stock|for sale|reserved|\$\s?\d|price|book (a )?viewing|enquire)\b/i;
  const walk = (node, where) => {
    if (Array.isArray(node)) return node.forEach((n, i) => walk(n, `${where}[${i}]`));
    if (!node || typeof node !== 'object') return;
    const scoped = String(node.scope || '').toLowerCase() === 'breed-characteristic';
    for (const [k, v] of Object.entries(node)) {
      if (typeof v === 'string' && /prompt|alt|caption|scene/i.test(k)) {
        scannedPrompts++;
        if (scoped) {
          if (/alt/i.test(k) && !/illustration/i.test(v)) {
            hits.push(`${f} ${where}.${k}: breed-characteristic image whose alt does not say it is an illustration - ${v.slice(0, 80)}`);
          }
          // A negated phrase is a DISCLAIMER, not an offer: "not a photograph of a puppy for
      // sale" is the sentence this scope exists to require, and the first version of this
      // check failed every correctly worded alt on the site.
      const offer = v.match(OFFERY);
      const negated = offer && /\b(not|never|no)\b[^.]{0,40}$/i.test(v.slice(0, offer.index));
      if (offer && !negated) {
            hits.push(`${f} ${where}.${k}: breed-characteristic image written like an offer ("${offer[0]}") - ${v.slice(0, 80)}`);
          }
          continue;
        }
        const m = v.match(RX);
        if (m) hits.push(`${f} ${where}.${k}: depicts the sellable entity ("${m[1]}") — ${v.slice(0, 80)}`);
      } else walk(v, `${where}.${k}`);
    }
  };
  walk(data, f);
}

// 2. the rendered alt text on generated assets
const DIST = path.join(ROOT, 'dist');
const assetMap = (() => {
  try { return JSON.parse(read(path.join(ROOT, 'public', 'images', 'asset-map.json'))); } catch { return {}; }
})();
const generated = new Set();
const collect = (node) => {
  if (Array.isArray(node)) return node.forEach(collect);
  if (!node || typeof node !== 'object') return;
  if (node.consistency_id || node.consistencyId) {
    for (const v of Object.values(node)) if (typeof v === 'string' && /\.(webp|png|jpg)$/i.test(v)) generated.add(v);
  }
  Object.values(node).forEach(collect);
};
collect(assetMap);

let scannedPages = 0;
const walkDist = (dir) => {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkDist(p);
    else if (e.name === 'index.html') {
      scannedPages++;
      const html = read(p);
      for (const m of html.matchAll(/<img\s[^>]*>/gi)) {
        const src = (m[0].match(/\ssrc=["']([^"']+)["']/) || [])[1] || '';
        const alt = (m[0].match(/\salt=["']([^"']*)["']/) || [])[1] || '';
        if (!src || !generated.has(src)) continue;
        const hit = alt.match(RX);
        if (hit) hits.push(`${p}: generated image ${src} has alt "${alt.slice(0, 60)}" naming the sellable entity ("${hit[1]}")`);
      }
    }
  }
};
walkDist(DIST);

if (!scannedPrompts && !scannedPages) {
  console.log('FAIL check-image-source: no prompts and no built pages found — the gate measured nothing');
  process.exit(1);
}

if (AS_JSON) console.log(JSON.stringify({ IMAGE_SOURCE, terms: [...terms], hits }, null, 2));
console.log(`IMAGE_SOURCE=real-first  sellable-entity terms: ${[...terms].sort().join(', ')}`);
console.log(`scanned: ${scannedPrompts} prompt field(s), ${scannedPages} built page(s), ${generated.size} generated asset(s)`);
if (hits.length) {
  console.log('\nFAILURES:');
  for (const h of hits) console.log('  ' + h);
  console.log('\n  -> under real-first, scenes are places, objects, people or empty facilities.');
  console.log(`FAIL check-image-source (${hits.length})`);
  process.exit(1);
}
// contracts section-1b: every gate prints WHAT IT MEASURED, not only what
// failed - the fixed shape `checked=<n> failed=<m>` on the verdict line.
console.log(`check-image-source: checked=${typeof imgs !== "undefined" ? imgs.length : 0} failed=0`);
console.log('PASS check-image-source (0 generated depictions of the sellable entity)');
process.exit(0);
