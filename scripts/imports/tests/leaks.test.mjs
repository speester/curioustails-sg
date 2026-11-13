// T15: the leak scanner (spec §6.7). Every test runs over temp copies: a fixture
// private store, a fixture feed, fixture assets and a fixture dist. No network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { openStore } from '../lib/store.mjs';
import { buildDenylist, scanText, runLeakCheck } from '../lib/leaks.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = join(HERE, '..', 'check-leaks.mjs');
const REPO = join(HERE, '..', '..', '..');

const CHIP = '372141405123456';
const PHONE = '0871234567';
const SELLER = 'Brigid Fennelly';
const EMAIL = 'kennels.fennelly@example.ie';
const LISTING_ID = 'jrt-pups-naas-88231';
const SOURCE_URL = 'https://www.dogsy.ie/dogs-for-sale/jrt-pups-naas-88231.html';
const DESCRIPTION = 'Gorgeous litter raised in our family kitchen beside the range with two older dogs and lots of children so they are well used to noise';

function privateRecord(over = {}) {
  return {
    key: `dogsy:${LISTING_ID}`,
    supplier: 'dogsy',
    listingId: LISTING_ID,
    sourceUrl: SOURCE_URL,
    imageSourceUrls: ['https://www.dogsy.ie/storage/ad-media/zz9.jpg'],
    descriptionRaw: DESCRIPTION,
    seller: { name: SELLER, phone: PHONE, email: EMAIL, regNo: 'DBE-4471' },
    puppies: [{ microchip: CHIP, colour: 'Tan & White' }],
    ...over,
  };
}

function cleanFeed() {
  return {
    syncedAt: '2026-11-13T06:15:00.000Z',
    schema: 1,
    pups: [{
      id: 'imp-7f3a2c91de', ref: 'CT-IE-7F3A2C', breed: 'jack-russell-terrier', breedLabel: 'Jack Russell Terrier',
      crossLabel: null, name: null, sex: { male: 2, female: 1 }, colours: ['Tan & White'], dob: '2026-09-04',
      age: '10 weeks', priceSGD: 4550, depositPct: 50, depositSGD: 2275, balanceSGD: 2275, balanceDue: 'before-flight',
      arrivalEstimate: '2026-12', arrivalBasis: 'dob', imported: true, origin: 'IE', reservation: true,
      perks: ['starter-kit'], photos: ['imp-7f3a2c91de-1.webp'], photoAlt: ['tan & white Jack Russell Terrier puppy, male and female, 10 weeks'],
      status: 'published', publishedAt: '2026-11-13T06:15:00.000Z', updatedAt: '2026-11-13T06:15:00.000Z',
      sourceHash: 'a'.repeat(64), hdbApproved: true, eligibleSG: true, specified: false,
    }],
  };
}

// A minimal RIFF/WEBP file with no metadata chunks (VP8 payload is opaque here).
function webp({ exif = false } = {}) {
  const chunk = (fourcc, data) => {
    const pad = data.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0);
    const head = Buffer.alloc(8);
    head.write(fourcc, 0, 'ascii');
    head.writeUInt32LE(data.length, 4);
    return Buffer.concat([head, data, pad]);
  };
  const chunks = [chunk('VP8 ', Buffer.alloc(10, 1))];
  if (exif) chunks.push(chunk('EXIF', Buffer.from('Exif\0\0GPS')));
  const body = Buffer.concat([Buffer.from('WEBP', 'ascii'), ...chunks]);
  const head = Buffer.alloc(8);
  head.write('RIFF', 0, 'ascii');
  head.writeUInt32LE(body.length, 4);
  return Buffer.concat([head, body]);
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'ct-leaks-'));
  const store = openStore({ dir: join(root, 'private') });
  store.writeJson('imports-state.json', { version: 1, records: { [`dogsy:${LISTING_ID}`]: privateRecord() }, suppressed: [], published: {} });
  const repo = join(root, 'repo');
  mkdirSync(join(repo, 'src', 'data'), { recursive: true });
  mkdirSync(join(repo, 'src', 'assets', 'imported'), { recursive: true });
  writeFileSync(join(repo, 'src', 'data', 'imported-puppies.json'), JSON.stringify(cleanFeed(), null, 2));
  writeFileSync(join(repo, 'src', 'assets', 'imported', 'imp-7f3a2c91de-1.webp'), webp());
  writeFileSync(join(repo, 'src', 'assets', 'imported', 'imp-7f3a2c91de-1-card.webp'), webp());
  const dist = join(repo, 'dist');
  mkdirSync(join(dist, 'puppies', 'jack-russell-terrier'), { recursive: true });
  writeFileSync(join(dist, 'index.html'), '<!doctype html><html><body><h1>Curious Tails</h1><p>Call hello@curioustails.sg. Postal 238859. Build 20261113061500.</p></body></html>');
  writeFileSync(join(dist, 'puppies', 'jack-russell-terrier', 'index.html'),
    '<html><body><script type="application/ld+json">{"@type":"Product","offers":{"availability":"https://schema.org/PreOrder","priceCurrency":"SGD"}}</script><p>Tan & White Jack Russell Terrier, 10 weeks.</p></body></html>');
  writeFileSync(join(dist, '_redirects'), '/old /new 301\n');
  return { root, store, repo, dist, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

function cli(args, { privateDir }) {
  const r = spawnSync(process.execPath, [CLI, ...args], {
    encoding: 'utf8',
    env: { ...process.env, IMPORTS_PRIVATE_DIR: privateDir },
  });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

test('T15: a clean build (feed, assets, dist) exits 0', () => {
  const f = fixture();
  try {
    const r = cli(['--repo', f.repo, '--dist', f.dist], { privateDir: f.store.dir });
    assert.equal(r.code, 0, r.out);
  } finally { f.cleanup(); }
});

test("T15: injecting 'dogsy.ie' into a test copy of the public JSON exits 1", () => {
  const f = fixture();
  try {
    const feed = cleanFeed();
    feed.pups[0].colours = ['Tan & White (see dogsy.ie)'];
    writeFileSync(join(f.repo, 'src', 'data', 'imported-puppies.json'), JSON.stringify(feed));
    const r = cli(['--repo', f.repo], { privateDir: f.store.dir });
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /supplier-token/);
  } finally { f.cleanup(); }
});

test('T15: injecting a real microchip from the private store into the public JSON exits 1', () => {
  const f = fixture();
  try {
    const feed = cleanFeed();
    feed.pups[0].photoAlt = [`puppy ${CHIP}`];
    writeFileSync(join(f.repo, 'src', 'data', 'imported-puppies.json'), JSON.stringify(feed));
    const r = cli(['--repo', f.repo], { privateDir: f.store.dir });
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /microchip/);
    assert.equal(r.out.includes(CHIP), false, 'the scanner never prints the private value it found');
  } finally { f.cleanup(); }
});

test('T15: a private microchip in the built site (schema output) exits 1, even split by spaces', () => {
  const f = fixture();
  try {
    const spaced = `${CHIP.slice(0, 3)} ${CHIP.slice(3, 9)} ${CHIP.slice(9)}`;
    writeFileSync(join(f.dist, 'puppies', 'jack-russell-terrier', 'index.html'),
      `<script type="application/ld+json">{"@type":"Product","sku":"${spaced}"}</script>`);
    const r = cli(['--repo', f.repo, '--dist', f.dist], { privateDir: f.store.dir });
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /microchip/);
  } finally { f.cleanup(); }
});

test('T15: seller name, phone, email, listing id and source URL in dist are each caught', () => {
  const f = fixture();
  const deny = buildDenylist({ records: [privateRecord()] });
  try {
    const cases = {
      'seller-name': `<p>Bred by ${SELLER.toUpperCase()}</p>`,
      'seller-phone': '<a href="tel:+353 87 123 4567">call</a>',
      'seller-email': `<p>${EMAIL}</p>`,
      'listing-id': `<p>ref ${LISTING_ID}</p>`,
      'source-url': '<p>www.dogsy.ie/dogs-for-sale/jrt-pups-naas-88231.html</p>',
    };
    for (const [kind, html] of Object.entries(cases)) {
      const hits = scanText(html, deny, { label: 'x.html' });
      assert.ok(hits.some((h) => h.kind === kind), `${kind} not caught: ${JSON.stringify(hits)}`);
    }
  } finally { f.cleanup(); }
});

test('T15: an 8-word run copied from a source description is caught; 7 words are not', () => {
  const deny = buildDenylist({ records: [privateRecord()] });
  const eight = 'Our pups are raised in our family kitchen beside the range with two older dogs!';
  const seven = 'Raised in our family kitchen beside the hall.';
  assert.ok(scanText(`<p>${eight}</p>`, deny, { label: 'a' }).some((h) => h.kind === 'description-copy'));
  assert.equal(scanText(`<p>${seven}</p>`, deny, { label: 'b' }).filter((h) => h.kind === 'description-copy').length, 0);
});

test('T15: platform names are matched as words, not inside unrelated hashes', () => {
  const deny = buildDenylist({ records: [] });
  assert.ok(scanText('listed on DFSI today', deny, { label: 'a' }).some((h) => h.kind === 'supplier-token'));
  assert.ok(scanText('found on irishpuppies', deny, { label: 'a' }).some((h) => h.kind === 'supplier-token'));
  assert.equal(scanText('<script src="/_astro/index.xdfsi3Q.js"></script>', deny, { label: 'b' }).length, 0);
});

test('T15: an asset named after a supplier or a WebP carrying EXIF exits 1', () => {
  const f = fixture();
  try {
    writeFileSync(join(f.repo, 'src', 'assets', 'imported', 'dogsy-88231.jpg'), 'x');
    let r = cli(['--repo', f.repo], { privateDir: f.store.dir });
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /asset-name/);
    rmSync(join(f.repo, 'src', 'assets', 'imported', 'dogsy-88231.jpg'));
    writeFileSync(join(f.repo, 'src', 'assets', 'imported', 'imp-7f3a2c91de-2.webp'), webp({ exif: true }));
    r = cli(['--repo', f.repo], { privateDir: f.store.dir });
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /webp-metadata/);
  } finally { f.cleanup(); }
});

test('T15: a dist file whose path names a supplier is caught', () => {
  const f = fixture();
  try {
    mkdirSync(join(f.dist, '_astro'), { recursive: true });
    writeFileSync(join(f.dist, '_astro', 'dogquest-litter.webp'), 'x');
    const { leaks } = runLeakCheck({ repoRoot: f.repo, distDir: f.dist, store: f.store });
    assert.ok(leaks.some((l) => l.kind === 'supplier-token' && /dogquest-litter/.test(l.where)), JSON.stringify(leaks));
  } finally { f.cleanup(); }
});

test('T15: with no private store the scanner fails closed (exit 1), never silently passes', () => {
  const f = fixture();
  try {
    const missing = join(f.root, 'no-such-store');
    const r = cli(['--repo', f.repo], { privateDir: missing });
    assert.equal(r.code, 1, r.out);
    assert.equal(existsSync(missing), false, 'the scanner does not create a store');
  } finally { f.cleanup(); }
});

test('T15: build:deploy runs sync:imports --no-fetch and ends with the leak scan after astro build', () => {
  const pkg = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8'));
  const steps = pkg.scripts['build:deploy'].split('&&').map((s) => s.trim());
  assert.deepEqual(steps, [
    'npm run sync:puppies',
    'npm run sync:overseas',
    'npm run sync:imports -- --no-fetch',
    'npm run feed:check',
    'npm run build',
    'npm run check:import-leaks -- --dist',
  ]);
  assert.equal(pkg.scripts['check:import-leaks'], 'node scripts/imports/check-leaks.mjs');
});

test('T15: the deploy script runs the leak scan before wrangler, so a leaky dist never uploads', () => {
  const sh = readFileSync(join(REPO, 'scripts', 'deploy-pages.sh'), 'utf8');
  const scan = sh.indexOf('scripts/imports/check-leaks.mjs --dist');
  const wrangler = sh.search(/^[^#\n]*wrangler[^\n]*pages deploy/m);
  assert.ok(scan > 0, 'deploy-pages.sh runs check-leaks');
  assert.ok(wrangler > scan, 'the scan comes before the wrangler upload');
});
