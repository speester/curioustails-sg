#!/usr/bin/env node
// K-134: write a SAMPLE imported feed into a stage copy of the site, so the owner
// can review how an imported listing looks before any real record is approved.
//
//   node scripts/imports/make-sample-feed.mjs --root <stage dir> [--today 2026-11-14]
//   then build the stage copy with IMPORT_SAMPLES=1
//
// Where the data comes from: the pipeline's own test fixtures (cleanRecord() in
// scripts/imports/tests/_pipeline-fixtures.mjs, with the overrides the K-091 e2e
// run seeded and the sync-imports dedupe test uses), run through the real gates,
// price and arrival code. Nothing is typed by hand except the photo choice, and the
// photos are copies of existing breed-library images (src/assets/<breed>/), never a
// supplier photo. Every sample is published as sample: true and renders with the
// "Sample listing" label (src/lib/imported-puppies.ts).
//
// Safety: refuses to write into this repo. The output lives only in --root:
//   <root>/src/data/imported-puppies.sample.json
//   <root>/src/assets/imported-samples/imp-5a3d1e000N-K.webp
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { REPO_ROOT } from './lib/store.mjs';
import { evaluateGates } from './lib/gates.mjs';
import { buildPublicPup, findLeaks } from './lib/public.mjs';
import { cleanRecord } from './tests/_pipeline-fixtures.mjs';
import sharp from 'sharp';

const args = process.argv.slice(2);
const arg = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const root = arg('--root') ? resolve(arg('--root')) : null;
if (!root) { console.error('make-sample-feed: --root <stage dir> is required'); process.exit(2); }
if (root === resolve(REPO_ROOT)) { console.error('make-sample-feed: refusing to write samples into the repo itself; use a stage copy'); process.exit(2); }
if (!existsSync(join(root, 'src', 'data'))) { console.error(`make-sample-feed: ${root} is not a site copy (no src/data)`); process.exit(2); }
const today = arg('--today') || new Date().toISOString().slice(0, 10);
const NOW = new Date(`${today}T06:00:00Z`);

// cleanRecord() only needs store.secret() for the hashed id of its own image names.
const stubStore = { secret: () => 'k134-sample-not-a-real-store' };

// The fixtures: [source, overrides, breed-library photos (file, alt from asset-map.json)].
const SAMPLES = [
  {
    from: 'K-091 e2e snapshot: clean dogsy JRT (reports/k091-tools/t26-fixture-e2e.mjs, record 1)',
    over: { listingId: 'k091-clean-jrt' },
    breedDir: 'jack-russell-terrier',
    photos: [1, 2, 7],
  },
  {
    from: 'K-091 e2e snapshot: lead-only Chihuahua (t26-fixture-e2e.mjs, record 2; lead-only, would never publish)',
    over: { supplier: 'dfsi', listingId: 'k091-lead-chihuahua', breedRaw: 'Chihuahua', priceRaw: '€500', priceNumber: 500, chips: ['372112345678910'] },
    breedDir: 'chihuahua',
    photos: [13, 10, 14],
  },
  {
    from: 'K-091 e2e snapshot: Beagle (t26-fixture-e2e.mjs, record 3; sold there, shown here as if live)',
    over: { listingId: 'k091-sold-beagle', breedRaw: 'Beagle', priceRaw: '€600', priceNumber: 600, chips: ['372112345678920'] },
    breedDir: 'beagle',
    photos: [7, 9, 2],
  },
  {
    from: 'sync-imports.test.mjs dedupe fixture: dogquest JRT, one White girl at €560',
    over: { supplier: 'dogquest', listingId: 'uuid-9', priceRaw: '€560', priceNumber: 560, puppies: [{ sex: 'F', colour: 'White', price: 560, microchip: '372112345678901', status: 'For Sale' }] },
    breedDir: 'jack-russell-terrier',
    photos: [10, 12],
  },
];

const assetMap = (dir) => JSON.parse(readFileSync(join(REPO_ROOT, 'src', 'assets', dir, 'asset-map.json'), 'utf8')).images;
const outImg = join(root, 'src', 'assets', 'imported-samples');
mkdirSync(outImg, { recursive: true });

const pups = [];
const provenance = [];
for (const [n, s] of SAMPLES.entries()) {
  const record = cleanRecord(stubStore, { ...s.over });
  const g = evaluateGates({ record, now: NOW, env: {} });
  if (!g.breed?.slug || g.price?.priceSGD == null || !g.arrival?.month) {
    throw new Error(`sample ${n + 1}: the fixture gives no breed/price/arrival (${s.from})`);
  }
  const id = `imp-5a3d1e${String(n + 1).padStart(4, '0')}`;
  const map = assetMap(s.breedDir);
  const images = [];
  for (const [k, num] of s.photos.entries()) {
    const a = map.find((m) => m.image_number === num);
    if (!a) throw new Error(`sample ${n + 1}: no image ${num} in ${s.breedDir}/asset-map.json`);
    const filename = `${id}-${k + 1}.webp`;
    // Re-encoded, not copied: a byte-identical copy makes Vite emit the breed page's
    // own library image under this sample's file name.
    await sharp(join(REPO_ROOT, 'src', 'assets', s.breedDir, a.file)).webp({ quality: 80 }).toFile(join(outImg, filename));
    // Library alts say "available in Singapore"; a sample photo is not of an available puppy.
    const alt = a.alt_text.replace(/,? one of the .*$/i, '').replace(/\s+available in Singapore\.?$/i, '');
    images.push({ filename, alt: `Sample photo from our breed library: ${alt}` });
  }
  const pup = buildPublicPup({
    record,
    breed: { slug: g.breed.slug, breedLabel: g.breed.breedLabel, crossLabel: g.breed.crossLabel ?? null, hdbApproved: g.hdbApproved },
    price: g.price,
    arrival: g.arrival,
    images,
    identity: { id, ref: `SAMPLE-${n + 1}`, sourceHash: '0'.repeat(64) },
    now: NOW,
    status: 'published',
  });
  // The photos are library images, so the alt describes the photo, not the fixture puppy.
  pup.photoAlt = images.map((i) => i.alt);
  pups.push(pup);
  provenance.push({ id, ref: pup.ref, from: s.from, pipelineDecision: g.decision, reasons: [...g.reviewReasons, ...g.rejectReasons], photos: s.photos.map((num) => `${s.breedDir}#${num}`) });
}

const feed = { syncedAt: NOW.toISOString(), schema: 1, sample: true, pups };
const leaks = findLeaks(feed);
if (leaks.length) { console.error('make-sample-feed: leak tokens in the sample feed', leaks); process.exit(1); }
writeFileSync(join(root, 'src', 'data', 'imported-puppies.sample.json'), `${JSON.stringify(feed, null, 2)}\n`);
console.log(JSON.stringify({ wrote: pups.length, root, provenance }, null, 2));
