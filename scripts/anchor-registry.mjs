#!/usr/bin/env node
// anchor-registry.mjs - derive config/anchor-registry.json from BUILT dist/ body links.
// Usage: node scripts/anchor-registry.mjs --regenerate | --report
// Counts DISTINCT PAGES per (anchor -> target). Exit 1 when a non-exempt pair
// exceeds the cap of 3. Node 20 built-ins only.
import { readdirSync, statSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, relative, dirname, sep } from 'node:path';

const ROOT = process.env.PROJECT_ROOT || process.cwd();
const DIST = join(ROOT, 'dist');
const REG = join(ROOT, 'config', 'anchor-registry.json');
const CAP = 3;
// A bare `node scripts/anchor-registry.mjs`, or any typo'd flag, used to fall through to
// 'regenerate' — the mode that WRITES the registry. A check that silently rewrites the
// file it is checking can never fail. The mode is now explicit.
const _argv = process.argv.slice(2);
const _bad = _argv.filter((a) => !['--report', '--regenerate'].includes(a));
if (_bad.length || _argv.length === 0) {
  console.error(`FAIL usage: node scripts/anchor-registry.mjs --regenerate | --report${_bad.length ? ` (unknown: ${_bad.join(' ')})` : ''}`);
  process.exit(2);
}
const mode = _argv.includes('--report') ? 'report' : 'regenerate';

function cfg() {
  const p = join(ROOT, 'config', 'project-config.md');
  const out = {};
  if (existsSync(p)) {
    for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*[-*]?\s*([A-Z][A-Z0-9_]+)\s*[:=]\s*(.+?)\s*$/);
      if (m) out[m[1]] = m[2].trim().replace(/^`|`$/g, '');
    }
  }
  return out;
}
const BRAND = (cfg().BUSINESS_NAME || '').toLowerCase();
// 2026-09-05: the list held the bare nouns only, so the way these links are ACTUALLY
// written - "privacy policy", "terms of service", an editorial-correction invitation -
// was graded as ordinary body-link over-optimisation. A compliance link is site-wide by
// design and its anchor must not be varied for SEO; match the phrasings people use.
const COMPLIANCE = /^(privacy( policy| notice)?|terms( of (service|use))?|cookie[s]?( policy)?|disclosure|editorial policy|accessibility|contact us|tell us and we will correct it)$/i;

function walk(d, out = []) {
  if (!existsSync(d)) return out;
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    statSync(p).isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
}
const stripChrome = (html) => {
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main\s*>/i);
  return (main ? main[1] : html)
    .replace(/<(nav|footer|header|aside)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<[^>]*data-chrome\b[^>]*>[\s\S]*?<\/[a-z]+>/gi, ' ')
    .replace(/<ol[^>]*breadcrumb[^>]*>[\s\S]*?<\/ol\s*>/gi, ' ');
};
const textOf = (s) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const pairs = new Map(); // "anchor\u0000target" -> Set(page)
let pages = 0;
for (const f of walk(DIST)) {
  if (!f.endsWith(`${sep}index.html`)) continue;
  pages++;
  const route = '/' + (relative(DIST, dirname(f)).split(sep).join('/') + '/').replace(/^\/?$/, '');
  const body = stripChrome(readFileSync(f, 'utf8'));
  for (const m of body.matchAll(/<a\b([^>]*)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a\s*>/gi)) {
    const attrs = m[1] + m[3];
    if (/\bclass=["'][^"']*\b(btn|button|cta)\b/i.test(attrs)) continue;
    if (/\brole=["']button["']/i.test(attrs)) continue;
    const target = m[2].split('#')[0].split('?')[0];
    if (!target.startsWith('/')) continue;
    const anchor = textOf(m[4]).toLowerCase();
    if (!anchor) continue;
    const key = `${anchor}\u0000${target}`;
    if (!pairs.has(key)) pairs.set(key, new Set());
    pairs.get(key).add(route);
  }
}

const anchors = {}, over = [];
for (const [key, set] of pairs) {
  const [anchor, target] = key.split('\u0000');
  anchors[key] = { anchor, target, pages: [...set].sort() };
  if (set.size > CAP) {
    const exempt = (BRAND && anchor.includes(BRAND)) ? 'brand'
      : COMPLIANCE.test(anchor) ? 'compliance' : 'other';
    over.push({ anchor, target, pages: [...set].sort(), reason: exempt });
  }
}
const payload = {
  generated: new Date().toISOString().slice(0, 10),
  cap: CAP,
  scope: 'body links in dist/ (nav, breadcrumb, footer, buttons and data-chrome excluded)',
  counting_unit: 'distinct pages per (anchor -> target)',
  // validate-blueprint.mjs reads `_scope` and `_chrome`, not the prose keys above: the two
  // scripts were written against different names, so the registry always failed that check.
  // The chrome exclusions are emitted as DATA here rather than only as words in a sentence.
  _scope: 'body-links-in-dist',
  _chrome: ['nav', 'breadcrumb', 'footer', 'button', 'data-chrome'],
  anchors, over_soft_cap: over,
};
// A gate that measures nothing must never report PASS. With no dist/ (wrong cwd, or
// run before `astro build`) this regenerated an EMPTY registry, printed
// "over_soft_cap=0 (... other: 0)" and exited 0 - so Stage-3 exit-gate item (j) went
// green AND overwrote the real registry with an empty one, which is worse than a
// false pass: the next honest run has nothing to compare against.
if (!pages) {
  console.log('HALT: no dist/ pages to regenerate the anchor registry from - run `npm run build` first, or set PROJECT_ROOT');
  process.exit(1);
}
if (mode === 'regenerate') {
  mkdirSync(dirname(REG), { recursive: true });
  writeFileSync(REG, JSON.stringify(payload, null, 2), 'utf8');
}
const brand = over.filter((o) => o.reason === 'brand').length;
const comp = over.filter((o) => o.reason === 'compliance').length;
const other = over.filter((o) => o.reason === 'other');
for (const o of other) console.log(`FAIL over cap "${o.anchor}" -> ${o.target} on ${o.pages.length} pages: ${o.pages.join(', ')}`);
console.log(`anchors=${pairs.size} targets=${new Set([...pairs.keys()].map((k) => k.split('\u0000')[1])).size} pages=${pages} over_soft_cap=${over.length} (brand: ${brand}, compliance: ${comp}, other: ${other.length})`);
// contracts: every gate prints WHAT IT MEASURED, not only what failed - the
// fixed shape `checked=<n> failed=<m>` on the verdict line. Without it a
// clean run and a run that measured nothing print the same words.
console.log(`anchor-registry: checked=${pairs.size} failed=${other.length}`);
process.exit(other.length ? 1 : 0);
