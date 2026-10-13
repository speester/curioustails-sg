#!/usr/bin/env node
// check-loving-homes.mjs - "Puppies That Found Their Loving Homes" on BUILT html.
// Owner decision 2026-10-14. Fails when, on any page of dist/:
//   - the section sits above (or among) available puppy cards, or its heading drifts
//     from LOVING_HOMES_TITLE (src/lib/loving-homes.ts);
//   - a placed card shows a price or a booking link;
//   - /available-puppies/ shows more than 12 placed cards, a breed page more than 4;
//   - a placed puppy (src/data/placed-archive.json) has no page or photo, or its page
//     still declares a Product/InStock; an available puppy's page lost its Product;
//   - an archived puppy's URL is neither built nor 301'd, a 301 points at a page that
//     does not exist, or a 301 shadows a page that does.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pupPageSlug } from '../src/lib/pup-slug.mjs';
import { RETIRED_MARK } from './lib/puppy-redirects.mjs';

const ROOT = process.env.PROJECT_ROOT || process.cwd();
const DIST = join(ROOT, 'dist');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const TITLE = /LOVING_HOMES_TITLE\s*=\s*'([^']+)'/.exec(read('src/lib/loving-homes.ts'))?.[1];
const archive = JSON.parse(read('src/data/placed-archive.json'));
const feed = JSON.parse(read('src/data/available-puppies.json'));
const LIMIT_LISTING = 12;
const LIMIT_BREED = 4;

if (!existsSync(DIST)) {
  console.log('HALT: dist/ not found - run `npm run build`, or set PROJECT_ROOT.');
  process.exit(1);
}

const walk = (dir, out = []) => {
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (e === 'index.html') out.push(full);
  }
  return out;
};
const text = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const built = (urlPath) => existsSync(join(DIST, urlPath, 'index.html'));
const page = (urlPath) => readFileSync(join(DIST, urlPath, 'index.html'), 'utf8');
const photoDir = join(ROOT, 'src', 'assets', 'live');
const hasPhoto = (p) => !!p.image && existsSync(join(photoDir, p.image));

const fails = [];
const failed = { section: 0, pages: 0, redirects: 0 };
const fail = (cat, where, msg) => {
  failed[cat]++;
  fails.push(`${where}: ${msg}`);
};
const measured = { section: 0, pages: 0, redirects: 0 };

// ---- 1. the section, on every page that renders it ----------------------------
const placed = archive.pups.filter((p) => p.status === 'placed');
for (const file of walk(DIST)) {
  const html = readFileSync(file, 'utf8');
  const route = '/' + relative(DIST, file).replace(/\\/g, '/').replace(/index\.html$/, '');
  const start = html.search(/<section\b[^>]*\bdata-loving-homes\b/);
  if (start === -1) continue;
  measured.section++;
  if (html.slice(start + 1).search(/<section\b[^>]*\bdata-loving-homes\b/) !== -1) fail('section', route, 'renders the section twice');
  const block = html.slice(start, html.indexOf('</section>', start));
  const h2 = /<h2\b[^>]*>([\s\S]*?)<\/h2>/.exec(block);
  if (!TITLE || !h2 || text(h2[1]) !== TITLE) fail('section', route, `heading is "${h2 ? text(h2[1]) : '(none)'}", expected "${TITLE}"`);
  // Available cards are PupCards (<div class="pc">); none may follow the section.
  const lastAvailable = [...html.matchAll(/<div class="pc"[\s>]/g)].map((m) => m.index).pop() ?? -1;
  if (lastAvailable > start) fail('section', route, 'an available puppy card renders BELOW the loving-homes section');
  const cards = (block.match(/data-loving-home="/g) ?? []).length;
  if (cards === 0) fail('section', route, 'section rendered with no cards');
  const limit = route === '/available-puppies/' ? LIMIT_LISTING : /^\/puppies\/[^/]+\/$/.test(route) ? LIMIT_BREED : Infinity;
  if (cards > limit) fail('section', route, `${cards} placed cards (limit ${limit})`);
  // The cards end where the section's own CTA ("Missed one of these?") begins; its
  // copy may say "all-in prices" but never a number.
  const ctaAt = block.search(/Missed one of these\?/);
  if (/S?\$\s?\d/.test(text(ctaAt === -1 ? block : block.slice(0, ctaAt)))) fail('section', route, 'a price shows on a placed card');
  if (/cal\.com/i.test(block)) fail('section', route, 'a booking link sits in the section');
}
if (placed.length > 0) {
  if (!built('/available-puppies/')) fail('section', '/available-puppies/', 'page missing');
  else if (!/data-loving-homes/.test(page('/available-puppies/'))) fail('section', '/available-puppies/', 'placed puppies exist but the section is missing');
}

// ---- 2. placed puppies keep an honest page; available ones keep their Product --
for (const p of placed) {
  measured.pages++;
  const url = `/puppies/${p.breed}/${pupPageSlug(p)}/`;
  if (!hasPhoto(p)) { fail('pages', url, `placed puppy ${p.id} has no photo in src/assets/live`); continue; }
  if (!built(url)) { fail('pages', url, `placed puppy ${p.id} has no page`); continue; }
  const html = page(url);
  if (!/Found a Loving Home/.test(/<h1\b[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1] ?? '')) fail('pages', url, 'h1 does not say it found a loving home');
  if (/"@type":\s*"Product"/.test(html)) fail('pages', url, 'sold page still declares a Product');
  if (/schema\.org\/InStock/.test(html)) fail('pages', url, 'sold page still claims InStock');
}
for (const [breed, b] of Object.entries(feed.breeds)) {
  for (const p of b.available) {
    if (!p.image) continue;
    measured.pages++;
    const url = `/puppies/${breed}/${pupPageSlug(p)}/`;
    if (!built(url)) { fail('pages', url, `available puppy ${p.id} has no page`); continue; }
    const html = page(url);
    if (!/"@type":\s*"Product"/.test(html) || !/schema\.org\/InStock/.test(html)) fail('pages', url, 'available page lost its Product/InStock');
  }
}
if (placed.length > 0) {
  measured.pages++;
  if (!built('/found-loving-homes/')) fail('pages', '/found-loving-homes/', 'page missing');
  else {
    const n = (page('/found-loving-homes/').match(/data-loving-home="/g) ?? []).length;
    const expected = placed.filter(hasPhoto).length;
    if (n !== expected) fail('pages', '/found-loving-homes/', `${n} cards for ${expected} placed puppies with photos`);
  }
}

// ---- 3. every retired puppy URL 301s, to a page that exists -------------------
const redirectsFile = join(DIST, '_redirects');
const redirects = existsSync(redirectsFile) ? readFileSync(redirectsFile, 'utf8') : '';
const block = redirects.includes(RETIRED_MARK) ? redirects.slice(redirects.indexOf(RETIRED_MARK)) : '';
if (!block) fail('redirects', 'dist/_redirects', 'no retired-puppy block (is the puppy-redirects integration in astro.config.mjs?)');
const rules = new Map(
  block
    .split(/\r?\n/)
    .filter((l) => l.startsWith('/'))
    .map((l) => {
      const [from, to, code] = l.trim().split(/\s+/);
      return [from, { to, code }];
    }),
);
for (const [from, { to, code }] of rules) {
  measured.redirects++;
  if (code !== '301') fail('redirects', from, `redirect code ${code}, expected 301`);
  if (built(from)) fail('redirects', from, 'a 301 shadows a page that is built');
  if (!built(to)) fail('redirects', from, `301 target ${to} is not a built page`);
}
for (const p of archive.pups) {
  const url = `/puppies/${p.breed}/${pupPageSlug(p)}/`;
  if (!built(url) && !rules.has(url)) fail('redirects', url, `archived puppy ${p.id} (${p.status}) is neither built nor redirected`);
}

const row = (label, cat, detail) => console.log(`${label.padEnd(46)} ${failed[cat] ? 'FAIL' : 'PASS'}    ${detail}`);
console.log('CHECK                                          RESULT  DETAIL');
console.log('-'.repeat(78));
row('section below available, titled, no prices', 'section', `${measured.section} page(s)`);
row('placed pages honest, available pages intact', 'pages', `${placed.length} placed, ${measured.pages} page(s)`);
row('retired puppy URLs 301 to a built page', 'redirects', `${rules.size} rule(s)`);
for (const f of fails.slice(0, 25)) console.log('   ' + f);
if (fails.length > 25) console.log(`   ... and ${fails.length - 25} more`);
console.log('-'.repeat(78));
const checked = measured.section + measured.pages + measured.redirects;
if (checked === 0) {
  console.log('HALT: measured nothing - is dist/ a full build?');
  process.exit(1);
}
console.log(`check-loving-homes: checked=${checked} failed=${fails.length}`);
process.exit(fails.length ? 1 : 0);
