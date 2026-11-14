#!/usr/bin/env node
// K-119 T02/T07: the all-in surcharge gate.
//
// RULE: every visible "all-in" must sit in a block that also states the 3% card
// surcharge. The block is the nearest ancestor with an id (the owner's page
// sections: #price, #puppies, #available ...), else the nearest <section>, else
// the element itself. Attributes (alt, aria-label, title) are not visible copy
// and are never read; <title>, <meta>, JSON-LD, <script>, <style> are stripped.
//
// It also fails on the two phrases the surcharge replaced:
//   "No add-ons quietly billed later" and "Nothing is added later".
//
// Usage: node scripts/check-all-in-surcharge.mjs [--quiet]
// Reads dist/index.html plus the 48 dist/puppies/<slug>/index.html pages.
import fs from 'node:fs';
import path from 'node:path';

const QUIET = process.argv.includes('--quiet');
const EXCLUDE = new Set(['index', 'bernedoodle', 'labrador']);
const BREEDS = fs.readdirSync('dist/puppies', { withFileTypes: true })
  .filter((e) => e.isDirectory() && fs.existsSync(path.join('dist/puppies', e.name, 'index.html')))
  .map((e) => e.name)
  .filter((s) => !EXCLUDE.has(s))
  .sort();

const PAGES = [
  { route: '/', file: 'dist/index.html' },
  ...BREEDS.map((slug) => ({ route: `/puppies/${slug}/`, file: `dist/puppies/${slug}/index.html` })),
];

if (!fs.existsSync('dist/index.html')) {
  console.error('FAIL check:surcharge - dist/index.html missing; run `npm run build` first');
  process.exit(1);
}

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
  'param', 'source', 'track', 'wbr', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon',
  'ellipse', 'use', 'stop', 'image']);
const RAW = ['script', 'style', 'template', 'svg', 'noscript'];

const decode = (s) => s
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'");

// Build a shallow element tree with direct text and aggregated text.
function parse(html) {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let body = bodyMatch ? bodyMatch[1] : html;
  body = body.replace(/<!--[\s\S]*?-->/g, ' ');
  for (const tag of RAW) body = body.replace(new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}>`, 'gi'), ' ');

  const root = { tag: '#root', id: null, direct: '', text: '', parent: null, children: [] };
  const stack = [root];
  const elements = [];
  const re = /<([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>|<\/([a-zA-Z][\w:-]*)>|([^<]+)/g;
  let m;
  while ((m = re.exec(body))) {
    if (m[1]) {
      const tag = m[1].toLowerCase();
      const attrs = m[2] ?? '';
      const idm = attrs.match(/\bid\s*=\s*"([^"]*)"/) ?? attrs.match(/\bid\s*=\s*'([^']*)'/);
      const marker = /\bdata-answer-capsule\b|\bdata-treatment\b/.test(attrs);
      const el = { tag, id: idm ? idm[1] : null, marker, direct: '', text: '', parent: stack[stack.length - 1], children: [] };
      el.parent.children.push(el);
      elements.push(el);
      const selfClosing = /\/\s*$/.test(attrs);
      if (!VOID.has(tag) && !selfClosing) stack.push(el);
    } else if (m[3]) {
      const tag = m[3].toLowerCase();
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tag === tag) { stack.length = i; break; }
      }
    } else if (m[4]) {
      const text = decode(m[4]);
      if (!text.trim()) continue;
      for (const el of stack) el.text += ' ' + text;
      stack[stack.length - 1].direct += ' ' + text;
    }
  }
  return { root, elements };
}

const squash = (s) => s.replace(/\s+/g, ' ').trim();
const IGNORED_IDS = new Set(['main', 'body', 'html']);

function scopeFor(el) {
  let section = null;
  let marker = null;
  for (let p = el; p && p.tag !== '#root'; p = p.parent) {
    if (!section && p.tag === 'section') section = p;
    if (!marker && p.marker) marker = p;
    if (p.id && !IGNORED_IDS.has(p.id)) return p;
  }
  return marker ?? section ?? el;
}

function headingOf(el) {
  const h = el.children.flatMap(function walk(n) {
    const out = [];
    if (/^h[23]$/.test(n.tag) && n.text.trim()) out.push(n);
    for (const c of n.children) out.push(...walk(c));
    return out;
  })[0];
  if (h) return squash(h.text).slice(0, 70);
  if (el.id) return '#' + el.id;
  return squash(el.text).slice(0, 50) || '(unnamed block)';
}

const BANNED = [
  /No add-ons quietly billed later/i,
  /Nothing is added later/i,
];

const failures = [];
let checkedBlocks = 0;
let allInBlocks = 0;

for (const page of PAGES) {
  const { elements } = parse(fs.readFileSync(page.file, 'utf8'));
  let bannedHit = false;
  for (const el of elements) {
    const direct = squash(el.direct);
    if (direct && BANNED.some((rx) => rx.test(direct))) {
      failures.push(`${page.route} :: banned phrase :: "${direct.slice(0, 90)}"`);
      bannedHit = true;
    }
    if (!direct || !/all-in/i.test(direct)) continue;
    allInBlocks++;
    const scope = scopeFor(el);
    checkedBlocks++;
    const scopeText = squash(scope.text);
    if (!/3% bank surcharge/i.test(scopeText)) {
      failures.push(`${page.route} :: ${headingOf(scope)} :: all-in here, no surcharge in this block`);
    }
  }
  if (!QUIET) {
    const inPage = elements.filter((e) => /all-in/i.test(squash(e.direct))).length;
    console.log(`${page.route.padEnd(34)} all-in blocks=${String(inPage).padStart(2)} banned=${bannedHit ? 'yes' : 'no'}`);
  }
}

console.log(`\ncheck-all-in-surcharge: pages=${PAGES.length} all-in-blocks=${allInBlocks} checked=${checkedBlocks} failed=${failures.length}`);
if (failures.length) {
  for (const f of failures) console.log('  FAIL ' + f);
  console.log('FAIL check:surcharge');
  process.exit(1);
}
console.log('PASS check:surcharge');
