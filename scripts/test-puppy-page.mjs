#!/usr/bin/env node
// K-130: npm run test:puppy-page - the proof that a brand-new puppy row renders a
// complete page with no hand editing, and that the thin-page rule flips by itself.
//
// Builds the real site twice into node_modules/.cache (never dist/), with the fixture
// rows in scripts/fixtures/puppy-page/fixtures.json merged in through
// PUPPY_FIXTURES (src/lib/puppy-publish.mjs). The real feeds are never written.
//
//   build 1: av-min, av-min-nofacts, av-max, av-thin, av-cck, pl-min, imp-min, imp-au
//   build 2: the same, with av-thin's photo and price filled in (the index flip)
//
// Then runs check:puppy-pages against each build, and twice more against a
// tampered copy of a page to prove the gate fails loudly.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FIX = path.join(ROOT, 'scripts', 'fixtures', 'puppy-page', 'fixtures.json');
// Same drive as the project (Astro moves built assets with rename), and git-ignored.
const TMP = path.join(ROOT, 'node_modules', '.cache', 'k130-puppy-page-test');
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

let failures = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? '  ok  ' : '  FAIL'} ${msg}`);
  if (!cond) failures++;
};

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
function build(fixFile, outDir) {
  const r = spawnSync(npx, ['astro', 'build'], {
    cwd: ROOT,
    env: { ...process.env, PUPPY_FIXTURES: fixFile, PUPPY_OUTDIR: outDir, PUPPY_TODAY: '2026-11-14' },
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (r.status !== 0) {
    console.error(r.stdout.slice(-3000), r.stderr.slice(-3000));
    throw new Error(`astro build failed for ${path.basename(fixFile)}`);
  }
}
function gate(fixFile, dist) {
  const r = spawnSync(process.execPath, ['scripts/check-puppy-pages.mjs', '--dist', dist, '--no-write'], {
    cwd: ROOT,
    env: { ...process.env, PUPPY_FIXTURES: fixFile },
    encoding: 'utf8',
  });
  return { status: r.status, out: `${r.stdout}\n${r.stderr}` };
}

const page = (dist, urlPath) => {
  const f = path.join(dist, urlPath, 'index.html');
  return existsSync(f) ? readFileSync(f, 'utf8') : null;
};
const attr = (html, n) => (html.match(new RegExp(`${n}="([^"]*)"`)) ?? [])[1] ?? null;
const ld = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
const sitemap = (dist) =>
  new Set(
    readdirSync(dist)
      .filter((f) => /^sitemap-\d+\.xml$/.test(f))
      .flatMap((f) => [...readFileSync(path.join(dist, f), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname)),
  );
const mainText = (html) => html.slice(html.indexOf('<main'), html.indexOf('</main>')).replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const visible = (html) => html.slice(html.indexOf('data-puppy-page')).replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&#39;/g, "'").replace(/\s+/g, ' ');

const AV15 = 'hero includes gifts about families fit final health payment next visit reviews faq others reserve';

// ---- build 1 ----------------------------------------------------------------
const D1 = path.join(TMP, 'dist-1');
console.log('build 1: fixtures as they come from the sheet');
build(FIX, D1);
const map1 = sitemap(D1);

{
  const u = '/puppies/maltipoo/99001-puppy/';
  const h = page(D1, u);
  console.log(`\nav-min ${u}`);
  ok(Boolean(h), 'page exists at the pupPageSlug URL');
  if (h) {
    ok(attr(h, 'data-sections') === AV15, `15 sections in K-124 order (${attr(h, 'data-sections')})`);
    ok((h.match(/<h1[\s>]/g) ?? []).length === 1, 'exactly one H1');
    ok(/<h1[^>]*>Maltipoo Puppy<\/h1>/.test(h), 'unnamed H1 falls back to "{Breed} Puppy"');
    ok(!/\b(null|undefined|NaN)\b/.test(visible(h)), 'no null / undefined / NaN in visible text');
    ok(attr(h, 'data-thin') === 'false' && !/name="robots"/.test(h), 'indexable');
    ok(map1.has(u), 'in the sitemap');
    const prod = ld(h).find((x) => x['@type'] === 'Product');
    ok(prod?.offers?.price === 3888 && visible(h).includes('$3,888'), 'Product/Offer price 3888, visible on the page');
    ok(h.includes('data-wa-source="pup:99001'), 'data-wa-source carries the puppy id');
    const title = (h.match(/<title>([^<]*)<\/title>/) ?? [])[1] ?? '';
    const meta = (h.match(/<meta name="description" content="([^"]*)"/) ?? [])[1] ?? '';
    ok(title.length <= 60, `title <= 60 (${title.length}: "${title}")`);
    ok(meta.length <= 155, `meta <= 155 (${meta.length})`);
    ok(!/HDB approved/.test(visible(h).split('Questions about')[0]), 'no HDB chip without a tick');
    ok(/Ask for a video of this puppy/.test(visible(h)), 'one photo + the ask-for-a-video slide');
  }
}
{
  const u = '/puppies/pomeranian/99002-puppy/';
  const h = page(D1, u);
  console.log(`\nav-min-nofacts ${u}`);
  ok(Boolean(h), 'page exists');
  if (h) {
    ok(attr(h, 'data-sections') === AV15.replace(' fit', ''), '14 sections (no Breed fit)');
    ok((h.match(/class="dossier-card"/g) ?? []).length === 2, 'two-card dossier (no breed card)');
  }
}
{
  const u = '/puppies/maltipoo/99003-apricot-girl/';
  const h = page(D1, u);
  console.log(`\nav-max ${u}`);
  ok(Boolean(h), 'page exists');
  if (h) {
    ok(/<h1[^>]*>Pebble, the Apricot Maltipoo Girl<\/h1>/.test(h), 'H1 "Pebble, the Apricot Maltipoo Girl"');
    ok((h.match(/class="slide"/g) ?? []).length === 5 && /Watch Pebble's video/.test(visible(h)), '5 photo slides + the video slide');
    ok(/About 2 months/.test(visible(h)), 'age derived from DOB at build time');
    ok(/About 3 November 2026 for Pebble|Ready to go home now/.test(visible(h)), 'ready date = DOB + 63 days, labelled "about"');
    ok(/HDB approved/.test(visible(h)) && /Can Pebble live in an HDB flat\?/.test(h), 'HDB chip and FAQ only with a tick');
    ok(h.includes('cal.com/puppy-singapore/appointment?puppyid=99003'), 'Book a viewing uses the sheet booking link');
  }
}
{
  const u = '/puppies/cavapoo/99004-cream-boy/';
  const h = page(D1, u);
  console.log(`\nav-thin ${u} (no photo, no price)`);
  ok(Boolean(h), 'page still builds and is reachable');
  if (h) {
    ok(attr(h, 'data-thin') === 'true' && attr(h, 'data-missing') === 'image price', 'flagged thin: image price');
    ok(/<meta name="robots" content="noindex, follow">/.test(h), 'robots noindex, follow');
    ok(!map1.has(u), 'excluded from the sitemap');
    ok(!ld(h).some((x) => x['@type'] === 'Product') && !/"Offer"/.test(h), 'no Product / Offer schema');
    ok(/Photos coming/.test(visible(h)) && /Ask for price/.test(visible(h)), 'honest placeholders: "Photos coming", "Ask for price"');
    ok(!/<img[^>]+alt="[^"]*Bean/.test(h), 'no invented photo of the puppy');
  }
}
{
  console.log('\nav-cck (Choa Chu Kang)');
  const anywhere = readdirSync(path.join(D1, 'puppies'), { recursive: true }).some((f) => String(f).includes('99005'));
  ok(!anywhere, 'no page built for a Choa Chu Kang puppy');
}
{
  const u = '/puppies/cockapoo/99006-puppy/';
  const h = page(D1, u);
  console.log(`\npl-min ${u}`);
  ok(Boolean(h), 'page exists');
  if (h) {
    ok(attr(h, 'data-sections')?.startsWith('hero others '), 'Others in slot 2');
    ok(!ld(h).some((x) => x['@type'] === 'Product' || x['@type'] === 'FAQPage'), 'no Product, no FAQPage');
    ok(!/\$\d/.test(visible(h).split('With us now')[0]), 'no price in the hero');
  }
}
{
  const u = '/puppies/cavapoo/imp-0000fcafe1/';
  const h = page(D1, u);
  console.log(`\nimp-min ${u}`);
  ok(Boolean(h), 'page exists');
  if (h) {
    ok(/<meta name="robots" content="noindex, follow">/.test(h), 'noindex, follow');
    ok(!map1.has(u), 'out of the sitemap');
    ok(/January 2027/.test(visible(h)) && /subject to import approval/.test(visible(h)), 'arrival month + "subject to import approval"');
    ok(!/up to a month/.test(visible(h)), 'no local "up to a month" boarding line');
    ok(!/Payment methods/.test(visible(h)), 'no local payment section');
    // K-136: imported puppies are exempt from the Balestier rule and never claim a shop location.
    const fxRow = JSON.parse(readFileSync(FIX, 'utf8')).imported.find((r) => r.id === 'imp-0000fcafe1');
    ok(fxRow && !('location' in fxRow), 'fixture row has no location field at all, and the page still publishes');
    ok(attr(h, 'data-location') === null, 'no data-location on an imported page');
    ok(!/balestier/i.test(mainText(h)), 'no "Balestier" anywhere in the page content (<main>)');
    ok(!ld(h).some((x) => /balestier/i.test(JSON.stringify(x))), 'no "Balestier" in any JSON-LD');
    ok(!/(visit|families)/.test(attr(h, 'data-sections') ?? ''), `no Visit or Families section (${attr(h, 'data-sections')})`);
    ok(/href="\/reservation-terms\/"[^>]*>Reservation terms \(under legal review\)/.test(h), 'terms link, labelled "under legal review"');
  }
}
{
  const u = '/puppies/golden-retriever/imp-0000fcafe2/';
  const h = page(D1, u);
  console.log(`
imp-au ${u} (Australian reservation, K-136)`);
  ok(Boolean(h), 'page exists');
  if (h) {
    ok(attr(h, 'data-origin') === 'AU' && attr(h, 'data-location') === null, 'origin AU, no location');
    ok(/<meta name="robots" content="noindex, follow">/.test(h), 'noindex, follow');
    ok(!/balestier/i.test(mainText(h)) && !ld(h).some((x) => /balestier/i.test(JSON.stringify(x))), 'no "Balestier" in content or schema');
    ok(/CT-AU-FX0002/.test(visible(h)) && /S\$4,900/.test(visible(h)) && /S\$2,450/.test(visible(h)), 'ref, price and deposit exactly as recorded');
    ok(/href="\/reservation-terms\/"/.test(h), 'terms link');
  }
}
{
  console.log('\ngate on build 1');
  const g = gate(FIX, D1);
  ok(g.status === 0, `check:puppy-pages passes (${g.out.match(/built puppy pages: \d+/)?.[0]})`);
  ok(/99004 Bean .*no photo in the sheet; no price in the sheet/.test(g.out), 'thin reason reported: "no photo in the sheet; no price in the sheet"');
  ok(/excluded, not in Balestier/.test(g.out), 'excluded rows reported');

  // tamper: a banned word, then a non-Balestier location, on a copy of av-min
  const f = path.join(D1, 'puppies', 'maltipoo', '99001-puppy', 'index.html');
  const orig = readFileSync(f, 'utf8');
  writeFileSync(f, orig.replace('</h1>', '</h1><p>A pedigree puppy</p>'));
  const g2 = gate(FIX, D1);
  ok(g2.status === 1 && /banned word "pedigree"/.test(g2.out), 'gate FAILS on an injected "pedigree"');
  writeFileSync(f, orig.replace('data-location="Balestier"', 'data-location="Choa Chu Kang"'));
  const g3 = gate(FIX, D1);
  ok(g3.status === 1 && /is not Balestier/.test(g3.out), 'gate FAILS on a page located outside Balestier');
  writeFileSync(f, orig);

  // K-136 tamper: an imported page that claims Balestier, in copy or as an attribute
  const fi = path.join(D1, 'puppies', 'cavapoo', 'imp-0000fcafe1', 'index.html');
  const origI = readFileSync(fi, 'utf8');
  writeFileSync(fi, origI.replace('</h1>', '</h1><p>Collect from our Balestier shop</p>'));
  const g4 = gate(FIX, D1);
  ok(g4.status === 1 && /imported page claims a shop location/.test(g4.out), 'gate FAILS on an imported page that says "Balestier"');
  writeFileSync(fi, origI.replace('data-variant="imp"', 'data-variant="imp" data-location="Balestier"'));
  const g5 = gate(FIX, D1);
  ok(g5.status === 1 && /imported page carries data-location/.test(g5.out), 'gate FAILS on an imported page tagged data-location="Balestier"');
  writeFileSync(fi, origI);
}

// ---- build 2: the index flip ----------------------------------------------------
console.log('\nbuild 2: av-thin row gets its photo and price in the sheet (no code change)');
const fx = JSON.parse(readFileSync(FIX, 'utf8'));
const row = fx.local.find((r) => r.pup.id === 99004).pup;
Object.assign(row, { image: '2954-1-494c6ce2.webp', images: ['2954-1-494c6ce2.webp'], price: 3488 });
const FIX2 = path.join(TMP, 'fixtures-filled.json');
writeFileSync(FIX2, JSON.stringify(fx, null, 2));
const D2 = path.join(TMP, 'dist-2');
build(FIX2, D2);
{
  const u = '/puppies/cavapoo/99004-cream-boy/';
  const h = page(D2, u);
  const map2 = sitemap(D2);
  ok(Boolean(h) && attr(h, 'data-thin') === 'false', 'same URL, no longer thin');
  ok(h && !/name="robots"/.test(h), 'indexable (no robots noindex)');
  ok(map2.has(u), 'now in the sitemap');
  ok(h && ld(h).find((x) => x['@type'] === 'Product')?.offers?.price === 3488, 'Product/Offer with the new price');
  const g = gate(FIX2, D2);
  ok(g.status === 0, 'check:puppy-pages passes on build 2');
}

console.log(`\n${failures ? `FAIL: ${failures} assertion(s)` : 'PASS: test:puppy-page'}  (builds in ${TMP})`);
process.exit(failures ? 1 : 0);
