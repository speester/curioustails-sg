import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { openStore } from '../lib/store.mjs';
import { publicIds } from '../lib/hash.mjs';
import { runPipeline, parseArgs, valveActive } from '../lib/pipeline.mjs';
import { validateFeed, loadPublicSchema } from '../lib/public.mjs';
import { createHttp } from '../lib/http.mjs';
import { fakeClock } from './_helpers.mjs';

const NOW = new Date('2026-11-13T06:15:00Z');
const CHIPS = ['372112345678901', '372112345678902', '372112345678903'];

function tempRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'ct-imports-repo-'));
  mkdirSync(join(dir, 'src', 'data'), { recursive: true });
  mkdirSync(join(dir, 'src', 'assets', 'imported'), { recursive: true });
  mkdirSync(join(dir, 'src', 'pages'), { recursive: true });
  writeFileSync(join(dir, 'src', 'pages', 'index.astro'), '<h1>marker</h1>\n');
  writeFileSync(join(dir, 'README.md'), 'marker\n');
  return dir;
}

function tempStore() {
  return openStore({ dir: mkdtempSync(join(tmpdir(), 'ct-imports-store-')) });
}

function cleanRecord(store, over = {}) {
  const id = publicIds(store.secret(), over.supplier || 'dogsy', over.listingId || 'clean-1').id;
  return {
    key: `${over.supplier || 'dogsy'}:${over.listingId || 'clean-1'}`,
    supplier: 'dogsy',
    viaSite: 'irishpuppies.ie',
    listingId: 'clean-1',
    sourceUrl: 'https://dogsy.ie/dogs-for-sale/clean-1.html',
    fetchedAt: '2026-11-13T06:00:00.000Z',
    firstSeenAt: '2026-11-01T00:00:00.000Z',
    lastSeenAt: '2026-11-13T06:00:00.000Z',
    sourcePublishedAt: '2026-11-01T00:00:00.000Z',
    title: 'Beautiful Jack Russell Terrier puppies',
    descriptionRaw: 'Healthy Jack Russell Terrier puppies, wormed, vaccinated and microchipped, looking for loving homes.',
    breedRaw: 'Jack Russell Terrier',
    priceRaw: '€550',
    priceNumber: 550,
    currency: 'EUR',
    dob: '2026-09-04',
    ageRaw: '10 weeks',
    maleCount: 2,
    femaleCount: 1,
    puppies: CHIPS.map((microchip) => ({ sex: 'M', colour: 'Tan & White', price: 550, microchip, chipVerified: null, status: 'For Sale' })),
    county: 'Kildare',
    town: 'Naas',
    countryOfOrigin: 'Ireland',
    imageSourceUrls: ['https://dogsy.ie/storage/ad-media/a.jpg', 'https://dogsy.ie/storage/ad-media/b.jpg', 'https://dogsy.ie/storage/ad-media/c.jpg'],
    images: [
      { filename: `${id}-1.webp`, cardFilename: `${id}-1-card.webp`, dhash: '0000000000000001' },
      { filename: `${id}-2.webp`, cardFilename: `${id}-2-card.webp`, dhash: '1111111111111111' },
      { filename: `${id}-3.webp`, cardFilename: `${id}-3-card.webp`, dhash: '2222222222222222' },
    ],
    flags: { wormed: true, vaccinated: true },
    sourceStatus: 'live',
    status: null,
    reviewReasons: [],
    missingRuns: 0,
    ...over,
  };
}

function seed(store, repo, records, extraState = {}) {
  const assetDir = join(repo, 'src', 'assets', 'imported');
  for (const r of records) {
    for (const img of r.images || []) {
      if (img.filename) writeFileSync(join(assetDir, img.filename), Buffer.from('processed-webp'));
      if (img.cardFilename) writeFileSync(join(assetDir, img.cardFilename), Buffer.from('processed-webp'));
    }
  }
  store.writeJson('imports-state.json', {
    version: 1, firstRunAt: '2026-11-01T00:00:00.000Z', lastRunAt: null, runs: 1,
    records: Object.fromEntries(records.map((r) => [r.key, r])),
    suppressed: [], published: {}, supplierStats: {},
    ...extraState,
  });
}

function tree(root) {
  const out = {};
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      const rel = relative(root, p).replace(/\\/g, '/');
      const st = statSync(p);
      if (st.isDirectory()) { out[rel + '/'] = 'dir'; walk(p); } else out[rel] = `${st.size}:${readFileSync(p, 'utf8').slice(0, 80)}`;
    }
  };
  walk(root);
  return out;
}

function changed(before, after) {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((k) => before[k] !== after[k])
    .sort();
}

const envPublish = { IMPORTS_AUTOPUBLISH: '1', IMPORTS_SAFETY_VALVE: '0' };

test('--no-fetch makes zero network requests and writes a schema-valid feed', async () => {
  const repo = tempRepo();
  const store = tempStore();
  const rec = cleanRecord(store);
  seed(store, repo, [rec]);
  let httpCalls = 0;
  try {
    const { exitCode, feed, summary } = await runPipeline({
      args: parseArgs(['--no-fetch']),
      store, repoRoot: repo, env: {}, now: () => NOW,
      createHttpFn: () => { httpCalls++; throw new Error('network used with --no-fetch'); },
      fetchImpl: () => { httpCalls++; throw new Error('fetch used with --no-fetch'); },
    });
    assert.equal(exitCode, 0);
    assert.equal(httpCalls, 0, 'zero network calls');
    assert.equal(summary.feedPups, 0, 'autopublish unset: nothing publishes');
    const validation = validateFeed(feed, loadPublicSchema());
    assert.deepEqual(validation.errors, []);
    assert.equal(existsSync(join(repo, 'src', 'data', 'imported-puppies.json')), true);
  } finally {
    rmSync(repo, { recursive: true, force: true });
    rmSync(store.dir, { recursive: true, force: true });
  }
});

test('IMPORTS_AUTOPUBLISH=1 with the valve off publishes a clean record (temp repo only)', async () => {
  const repo = tempRepo();
  const store = tempStore();
  const rec = cleanRecord(store);
  seed(store, repo, [rec]);
  try {
    const { feed, summary, queue } = await runPipeline({
      args: parseArgs(['--no-fetch']), store, repoRoot: repo, env: envPublish, now: () => NOW,
    });
    assert.equal(summary.gates.publish, 1);
    assert.equal(feed.pups.length, 1);
    assert.equal(feed.pups[0].breed, 'jack-russell-terrier');
    assert.equal(feed.pups[0].status, 'published');
    assert.equal(queue.length, 0);
    assert.deepEqual(validateFeed(feed, loadPublicSchema()).errors, []);
    const written = JSON.parse(readFileSync(join(repo, 'src', 'data', 'imported-puppies.json'), 'utf8'));
    assert.deepEqual(written, feed);
  } finally {
    rmSync(repo, { recursive: true, force: true });
    rmSync(store.dir, { recursive: true, force: true });
  }
});

test('with IMPORTS_AUTOPUBLISH unset a clean record is queued auto-ready, never in the feed', async () => {
  const repo = tempRepo();
  const store = tempStore();
  const rec = cleanRecord(store);
  seed(store, repo, [rec]);
  try {
    const { feed, queue, summary } = await runPipeline({
      args: parseArgs(['--no-fetch']), store, repoRoot: repo, env: {}, now: () => NOW,
    });
    assert.equal(feed.pups.length, 0);
    assert.equal(summary.feedPups, 0);
    assert.equal(queue.length, 1);
    assert.equal(queue[0].disposition, 'auto-ready');
    assert.equal(queue[0].failures.length, 0);
    assert.equal(summary.gates['auto-ready'], 1);
    const state = JSON.parse(readFileSync(join(store.dir, 'imports-state.json'), 'utf8'));
    assert.deepEqual(state.published, {});
  } finally {
    rmSync(repo, { recursive: true, force: true });
    rmSync(store.dir, { recursive: true, force: true });
  }
});

test('dfsi and puppies.ie records never publish, even with autopublish on', async () => {
  const repo = tempRepo();
  const store = tempStore();
  const dfsiRec = cleanRecord(store, {
    supplier: 'dfsi', listingId: 'x', key: 'dfsi:x', status: 'review', reviewReasons: ['lead-only'],
    sourceUrl: 'https://dogsforsaleireland.ie/ad/x/',
  });
  const dogsieRec = cleanRecord(store, {
    supplier: 'dogsie', listingId: 'y', key: 'dogsie:y', sourceUrl: 'https://puppies.ie/sale/y',
    breedRaw: 'Chihuahua', breed1: 'Chihuahua', title: 'Chihuahua puppies',
    puppies: [{ microchip: null, colour: 'White', price: 550, status: null }],
    imageSourceUrls: [], images: [],
  });
  seed(store, repo, [dfsiRec, dogsieRec]);
  try {
    const { feed, queue } = await runPipeline({
      args: parseArgs(['--no-fetch']), store, repoRoot: repo, env: envPublish, now: () => NOW,
    });
    assert.equal(feed.pups.length, 0);
    assert.equal(queue.length, 2);
    assert.ok(queue.every((q) => q.disposition === 'review'));
  } finally {
    rmSync(repo, { recursive: true, force: true });
    rmSync(store.dir, { recursive: true, force: true });
  }
});

test('logs/imports/<date>.log contains no phone, email, URL or microchip', async () => {
  const repo = tempRepo();
  const store = tempStore();
  const rec = cleanRecord(store);
  rec.seller = { name: 'Private Seller', phone: '+353861234567', email: 'seller@example.com' };
  rec.county = 'Kildare';
  seed(store, repo, [rec]);
  try {
    const { summary } = await runPipeline({
      args: parseArgs(['--no-fetch']), store, repoRoot: repo, env: {}, now: () => NOW,
    });
    assert.ok(summary.logPath);
    const log = readFileSync(summary.logPath, 'utf8');
    assert.doesNotMatch(log, /https?:\/\//i, 'URL in log');
    assert.doesNotMatch(log, /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, 'email in log');
    assert.doesNotMatch(log, /\b\d{15}\b/, 'microchip in log');
    assert.doesNotMatch(log, /\+353861234567/, 'phone in log');
    assert.doesNotMatch(log, /Private Seller/, 'seller name in log');
    assert.doesNotMatch(log, /dogsy\.ie|dogsforsaleireland|puppies\.ie/i, 'supplier domain in log');
  } finally {
    rmSync(repo, { recursive: true, force: true });
    rmSync(store.dir, { recursive: true, force: true });
  }
});

test('a real run touches only the feed, imported assets and the operational log', async () => {
  const repo = tempRepo();
  const store = tempStore();
  seed(store, repo, [cleanRecord(store)]);
  try {
    const before = tree(repo);
    await runPipeline({ args: parseArgs(['--no-fetch']), store, repoRoot: repo, env: envPublish, now: () => NOW });
    const after = tree(repo);
    const diff = changed(before, after);
    const unexpected = diff.filter((p) => !(
      p === 'src/data/imported-puppies.json'
      || p.startsWith('src/assets/imported/')
      || p.startsWith('logs/imports/')
      || p === 'logs/' || p === 'logs/imports/'
    ));
    assert.deepEqual(unexpected, []);
    assert.ok(diff.includes('src/data/imported-puppies.json'));
  } finally {
    rmSync(repo, { recursive: true, force: true });
    rmSync(store.dir, { recursive: true, force: true });
  }
});

test('--dry-run writes nothing to the repo, state, queue or audit', async () => {
  const repo = tempRepo();
  const store = tempStore();
  seed(store, repo, [cleanRecord(store)]);
  try {
    const beforeRepo = tree(repo);
    const beforeStore = tree(store.dir);
    const { feed } = await runPipeline({
      args: parseArgs(['--dry-run', '--no-fetch']), store, repoRoot: repo, env: {}, now: () => NOW,
    });
    assert.equal(feed.pups.length, 0);
    assert.deepEqual(changed(beforeRepo, tree(repo)), []);
    assert.deepEqual(changed(beforeStore, tree(store.dir)), []);
  } finally {
    rmSync(repo, { recursive: true, force: true });
    rmSync(store.dir, { recursive: true, force: true });
  }
});

test('a fetch run keeps the persisted 4 s per-host spacing and saves http-last.json', async () => {
  const repo = tempRepo();
  const store = tempStore();
  store.writeJson('http-last.json', { 'host.test': NOW.getTime() - 1000 });
  const clock = fakeClock(NOW.getTime());
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.endsWith('/robots.txt')) return new Response('User-agent: *\nAllow: /\n', { status: 200 });
    return new Response('ok', { status: 200 });
  };
  const adapter = {
    run: async ({ http }) => {
      const r = await http.get('https://host.test/page', { kind: 'detail' });
      assert.equal(r.ok, true);
      return { supplier: 'dogsy', discovered: ['clean-1'], records: [cleanRecord(store)], errors: [] };
    },
  };
  try {
    const { summary } = await runPipeline({
      args: parseArgs(['--dry-run', '--source', 'dogsy']),
      store, repoRoot: repo, env: {}, now: () => new Date(clock.now()),
      adapters: { dogsy: adapter },
      createHttpFn: (opts) => createHttp({ ...opts, fetchImpl, now: clock.now, sleep: clock.sleep }),
    });
    const first = calls[0];
    assert.match(first, /host\.test\/robots\.txt$/);
    const persisted = store.readJson('http-last.json', {});
    assert.equal(typeof persisted['host.test'], 'number');
    assert.ok(persisted['host.test'] >= NOW.getTime(), 'the previous run time was replaced by this run');
    assert.equal(summary.records, 1);
    assert.equal(summary.groups, 1);
    assert.equal(summary.gates['auto-ready'], 1);
  } finally {
    rmSync(repo, { recursive: true, force: true });
    rmSync(store.dir, { recursive: true, force: true });
  }
});

test('liveness unpublishes a listing missing from the feed twice, but never a reserved one', async () => {
  const repo = tempRepo();
  const store = tempStore();
  const rec = cleanRecord(store);
  seed(store, repo, [rec]);
  const id = publicIds(store.secret(), 'dogsy', 'clean-1').id;
  try {
    await runPipeline({ args: parseArgs(['--no-fetch']), store, repoRoot: repo, env: envPublish, now: () => NOW });
    const state = store.readJson('imports-state.json', {});
    state.records[rec.key].missingRuns = 2;
    store.writeJson('imports-state.json', state);
    const second = await runPipeline({ args: parseArgs(['--no-fetch']), store, repoRoot: repo, env: envPublish, now: () => NOW });
    assert.equal(second.summary.unpublished, 1);
    assert.equal(second.feed.pups.length, 0);
    assert.equal(JSON.parse(readFileSync(join(repo, 'src', 'data', 'imported-puppies.json'), 'utf8')).pups.length, 0);
  } finally {
    rmSync(repo, { recursive: true, force: true });
    rmSync(store.dir, { recursive: true, force: true });
  }

  const repo2 = tempRepo();
  const store2 = tempStore();
  const rec2 = cleanRecord(store2);
  seed(store2, repo2, [rec2]);
  const id2 = publicIds(store2.secret(), 'dogsy', 'clean-1').id;
  try {
    await runPipeline({ args: parseArgs(['--no-fetch']), store: store2, repoRoot: repo2, env: envPublish, now: () => NOW });
    const state = store2.readJson('imports-state.json', {});
    state.records[rec2.key].missingRuns = 2;
    state.published ??= {};
    state.published[id2].status = 'reserved';
    store2.writeJson('imports-state.json', state);
    const third = await runPipeline({ args: parseArgs(['--no-fetch']), store: store2, repoRoot: repo2, env: envPublish, now: () => NOW });
    assert.equal(third.summary.unpublished, 0);
    assert.equal(third.feed.pups.length, 1);
    assert.equal(third.feed.pups[0].status, 'reserved');
  } finally {
    rmSync(repo2, { recursive: true, force: true });
    rmSync(store2.dir, { recursive: true, force: true });
  }
});

test('safety valve: the first 14 days keep even an autopublish run auto-ready', () => {
  assert.equal(valveActive({ firstRunAt: '2026-11-13T00:00:00.000Z' }, NOW, {}), true);
  assert.equal(valveActive({ firstRunAt: '2026-10-01T00:00:00.000Z' }, NOW, {}), false);
  assert.equal(valveActive({ firstRunAt: '2026-11-13T00:00:00.000Z' }, NOW, { IMPORTS_SAFETY_VALVE: '0' }), false);
});

function auditEvents(store) {
  const p = join(store.dir, 'audit.jsonl');
  if (!existsSync(p)) return [];
  return readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

test('lead-only is enforced in the orchestrator: dfsi in auto mode never reaches the feed', async () => {
  const repo = tempRepo();
  const store = tempStore();
  const rec = cleanRecord(store, {
    supplier: 'dfsi', listingId: 'auto-1', key: 'dfsi:auto-1', status: null, reviewReasons: [],
    sourceUrl: 'https://dogsforsaleireland.ie/ad/auto-1/',
  });
  seed(store, repo, [rec]);
  try {
    const { feed, queue } = await runPipeline({
      args: parseArgs(['--no-fetch']), store, repoRoot: repo,
      env: { ...envPublish, IMPORTS_DFSI_MODE: 'auto' }, now: () => NOW,
    });
    assert.equal(feed.pups.length, 0);
    assert.equal(queue.length, 1);
    assert.equal(queue[0].disposition, 'review');
  } finally {
    rmSync(repo, { recursive: true, force: true });
    rmSync(store.dir, { recursive: true, force: true });
  }
});

test('a reserved pup stays in the feed when the source later says sold and it is past 16 weeks', async () => {
  const repo = tempRepo();
  const store = tempStore();
  const rec = cleanRecord(store);
  seed(store, repo, [rec]);
  const id = publicIds(store.secret(), 'dogsy', 'clean-1').id;
  try {
    await runPipeline({ args: parseArgs(['--no-fetch']), store, repoRoot: repo, env: envPublish, now: () => NOW });
    const state = store.readJson('imports-state.json', {});
    state.published[id].status = 'reserved';
    // Our buyer reserved it, so the supplier marks it sold; weeks pass.
    state.records[rec.key].sourceStatus = 'sold';
    state.records[rec.key].puppies = state.records[rec.key].puppies.map((p) => ({ ...p, status: 'Sold' }));
    state.records[rec.key].missingRuns = 3;
    store.writeJson('imports-state.json', state);
    const later = new Date('2027-01-20T06:15:00Z'); // ~19.7 weeks from DOB, arrival month passed
    const out = await runPipeline({ args: parseArgs(['--no-fetch']), store, repoRoot: repo, env: envPublish, now: () => later });
    assert.equal(out.summary.unpublished, 0);
    assert.equal(out.feed.pups.length, 1);
    assert.equal(out.feed.pups[0].id, id);
    assert.equal(out.feed.pups[0].status, 'reserved');
    assert.deepEqual(validateFeed(out.feed, loadPublicSchema()).errors, []);
    assert.equal(store.readJson('imports-state.json', {}).published[id].status, 'reserved');
  } finally {
    rmSync(repo, { recursive: true, force: true });
    rmSync(store.dir, { recursive: true, force: true });
  }
});

test('a published pup past 16 weeks stays up until the 20-week liveness trigger', async () => {
  const repo = tempRepo();
  const store = tempStore();
  // DOB 2026-09-04: 10 weeks on NOW; the arrival month is 2026-12.
  const rec = cleanRecord(store);
  seed(store, repo, [rec]);
  try {
    await runPipeline({ args: parseArgs(['--no-fetch']), store, repoRoot: repo, env: envPublish, now: () => NOW });
    const at16 = new Date('2026-12-28T06:15:00Z'); // ~16.4 weeks; arrival month still current
    const mid = await runPipeline({ args: parseArgs(['--no-fetch']), store, repoRoot: repo, env: envPublish, now: () => at16 });
    assert.equal(mid.summary.unpublished, 0, 'G4 (>16 weeks) is an intake gate, not an unpublish trigger');
    assert.equal(mid.feed.pups.length, 1);
  } finally {
    rmSync(repo, { recursive: true, force: true });
    rmSync(store.dir, { recursive: true, force: true });
  }
});

test('a published pup that later fails a gate is unpublished and audited as such', async () => {
  const repo = tempRepo();
  const store = tempStore();
  const rec = cleanRecord(store);
  seed(store, repo, [rec]);
  const id = publicIds(store.secret(), 'dogsy', 'clean-1').id;
  try {
    await runPipeline({ args: parseArgs(['--no-fetch']), store, repoRoot: repo, env: envPublish, now: () => NOW });
    const state = store.readJson('imports-state.json', {});
    state.records[rec.key].title = 'Gorgeous XL Bully pups'; // edited at source
    store.writeJson('imports-state.json', state);
    const out = await runPipeline({ args: parseArgs(['--no-fetch']), store, repoRoot: repo, env: envPublish, now: () => NOW });
    assert.equal(out.feed.pups.length, 0);
    assert.equal(out.summary.unpublished, 1);
    const ev = auditEvents(store).filter((e) => e.id === id && e.event === 'unpublished');
    assert.equal(ev.length, 1);
    assert.ok(ev[0].detail.gates.includes('G8'));
    assert.equal(store.readJson('imports-state.json', {}).published[id], undefined);
  } finally {
    rmSync(repo, { recursive: true, force: true });
    rmSync(store.dir, { recursive: true, force: true });
  }
});

test('only published or reserved pups have WebPs in src/assets/imported; queued photos stay private', async () => {
  const { default: sharp } = await import('sharp');
  const png = await sharp({ create: { width: 900, height: 600, channels: 3, background: { r: 200, g: 120, b: 60 } } }).png().toBuffer();
  // Bright left half, black right half: a real edge, so its dHash is far (>6)
  // from the flat image's all-zero hash and the two never image-merge.
  const png2 = await sharp({ create: { width: 900, height: 600, channels: 3, background: { r: 20, g: 220, b: 160 } } })
    .composite([{ input: Buffer.from('<svg width="900" height="600"><rect x="450" y="0" width="450" height="600" fill="#000"/></svg>'), top: 0, left: 0 }])
    .png().toBuffer();
  const repo = tempRepo();
  const store = tempStore();
  const assetDir = join(repo, 'src', 'assets', 'imported');
  // A stale, unreferenced pipeline WebP from an older run must be pruned.
  writeFileSync(join(assetDir, 'imp-0123456789-1.webp'), Buffer.from('stale'));
  const clock = fakeClock(NOW.getTime());
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.endsWith('/robots.txt')) return new Response('User-agent: *\nAllow: /\n', { status: 200 });
    if (url.includes('/img/a')) return new Response(png, { status: 200 });
    if (url.includes('/img/b')) return new Response(png2, { status: 200 });
    return new Response('nope', { status: 404 });
  };
  const fresh = (over) => ({ ...cleanRecord(store, over), images: [], ...over });
  const clean = fresh({ imageSourceUrls: ['https://img.test/img/a.jpg'] });
  const bully = fresh({
    listingId: 'bully-1', key: 'dogsy:bully-1', title: 'XL Bully pups', breedRaw: 'XL Bully',
    county: 'Cork', dob: '2026-08-20',
    puppies: [{ sex: 'M', colour: 'Blue', price: 550, microchip: '372112345678999', status: 'For Sale' }],
    imageSourceUrls: ['https://img.test/img/b.jpg'],
  });
  const adapter = { run: async () => ({ supplier: 'dogsy', discovered: ['clean-1', 'bully-1'], records: [clean, bully], errors: [] }) };
  const createHttpFn = (opts) => createHttp({ ...opts, fetchImpl, now: clock.now, sleep: clock.sleep });
  const cleanId = publicIds(store.secret(), 'dogsy', 'clean-1').id;
  const bullyId = publicIds(store.secret(), 'dogsy', 'bully-1').id;
  const imps = () => readdirSync(assetDir).filter((f) => f.startsWith('imp-')).sort();
  try {
    // Run 1: autopublish unset → clean is auto-ready, bully rejected. No public WebP.
    const r1 = await runPipeline({
      args: parseArgs(['--source', 'dogsy']), store, repoRoot: repo, env: {},
      now: () => new Date(clock.now()), adapters: { dogsy: adapter }, createHttpFn,
    });
    assert.equal(r1.summary.gates['auto-ready'], 1);
    assert.equal(r1.summary.images.downloaded, 2);
    assert.deepEqual(imps(), [], 'no queued or rejected photo (and no stale file) in the repo');

    // Run 2: --no-fetch with autopublish on → clean publishes from the private
    // processed copy with zero network calls; the rejected photo never lands.
    const before = calls.length;
    const r2 = await runPipeline({
      args: parseArgs(['--no-fetch']), store, repoRoot: repo, env: envPublish, now: () => NOW,
    });
    assert.equal(calls.length, before, '--no-fetch reuses the private processed images');
    assert.equal(r2.feed.pups.length, 1);
    assert.equal(r2.feed.pups[0].id, cleanId);
    assert.deepEqual(imps(), [`${cleanId}-1-card.webp`, `${cleanId}-1.webp`]);
    assert.ok(!imps().some((f) => f.startsWith(bullyId)));
    for (const f of imps()) assert.match(f, /^imp-[0-9a-f]{10}-\d+(-card)?\.webp$/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
    rmSync(store.dir, { recursive: true, force: true });
  }
});

test('two suppliers sharing one microchip produce one public pup in the feed', async () => {
  const repo = tempRepo();
  const store = tempStore();
  const a = cleanRecord(store);
  const b = cleanRecord(store, {
    supplier: 'dogquest', listingId: 'uuid-9', key: 'dogquest:uuid-9', firstSeenAt: '2026-11-05T00:00:00.000Z',
    puppies: [{ sex: 'F', colour: 'White', price: 560, microchip: CHIPS[0], status: 'For Sale' }],
  });
  seed(store, repo, [a, b]);
  try {
    const { feed, summary } = await runPipeline({
      args: parseArgs(['--no-fetch']), store, repoRoot: repo, env: envPublish, now: () => NOW,
    });
    assert.equal(summary.groups, 1);
    assert.equal(summary.merged, 1);
    assert.equal(feed.pups.length, 1);
    assert.equal(feed.pups[0].id, publicIds(store.secret(), 'dogsy', 'clean-1').id, 'earliest-seen identity');
  } finally {
    rmSync(repo, { recursive: true, force: true });
    rmSync(store.dir, { recursive: true, force: true });
  }
});

test('a dfsi duplicate merges into a dogsy listing but supplies no content and no photo request', async () => {
  const { default: sharp } = await import('sharp');
  const png = await sharp({ create: { width: 900, height: 600, channels: 3, background: { r: 200, g: 120, b: 60 } } }).png().toBuffer();
  const repo = tempRepo();
  const store = tempStore();
  const clock = fakeClock(NOW.getTime());
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.endsWith('/robots.txt')) return new Response('User-agent: *\nAllow: /\n', { status: 200 });
    if (url.includes('/img/')) return new Response(png, { status: 200 });
    return new Response('nope', { status: 404 });
  };
  const dogsyRec = { ...cleanRecord(store), images: [], imageSourceUrls: ['https://img.test/img/a.jpg'] };
  // dfsi has more chips, so dedupe alone would pick it as the primary.
  const dfsiRec = {
    ...cleanRecord(store, { supplier: 'dfsi', listingId: 'dup', key: 'dfsi:dup' }),
    firstSeenAt: '2026-11-03T00:00:00.000Z', status: 'review', reviewReasons: ['lead-only'],
    title: 'DFSI-ONLY TITLE Jack Russell Terrier',
    puppies: [...CHIPS, '372112345678904'].map((microchip) => ({ sex: 'F', colour: 'Black', price: 900, microchip, status: 'For Sale' })),
    images: [], imageSourceUrls: ['https://dfsi-img.test/img/x.jpg'],
  };
  const adapters = {
    dogsy: { run: async () => ({ supplier: 'dogsy', discovered: ['clean-1'], records: [dogsyRec], errors: [] }) },
    dfsi: { run: async () => ({ supplier: 'dfsi', discovered: ['dup'], records: [dfsiRec], errors: [] }) },
  };
  try {
    const { queue, summary } = await runPipeline({
      args: parseArgs([]), store, repoRoot: repo, env: {}, now: () => new Date(clock.now()), adapters,
      createHttpFn: (opts) => createHttp({ ...opts, fetchImpl, now: clock.now, sleep: clock.sleep }),
    });
    assert.equal(summary.groups, 1);
    assert.equal(calls.some((u) => u.includes('dfsi-img.test')), false, 'no request to the lead-only photo host');
    assert.equal(queue.length, 1);
    assert.equal(queue[0].disposition, 'auto-ready', 'the dogsy content passes; dfsi only merged');
    assert.equal(queue[0].key, 'dogsy:clean-1');
    assert.deepEqual(queue[0].candidate.colours, ['Tan & White'], 'colours come from the dogsy record, not dfsi');
  } finally {
    rmSync(repo, { recursive: true, force: true });
    rmSync(store.dir, { recursive: true, force: true });
  }
});

test('a seen id with no record in the private state is fetched again (capture --seed-seen cannot orphan it)', async () => {
  const repo = tempRepo();
  const store = tempStore();
  const kept = cleanRecord(store);
  seed(store, repo, [kept]);
  store.writeJson('seen/dogsy.json', ['clean-1', 'orphan-1']);
  let got = null;
  const adapter = {
    SUPPLIER: 'dogsy',
    run: async ({ seen }) => { got = [...seen].sort(); return { supplier: 'dogsy', discovered: [], records: [], errors: [] }; },
  };
  try {
    await runPipeline({
      args: parseArgs(['--dry-run', '--source', 'dogsy']), store, repoRoot: repo, env: {}, now: () => NOW,
      adapters: { dogsy: adapter }, createHttpFn: (opts) => createHttp({ ...opts, fetchImpl: async () => { throw new Error('no network'); } }),
    });
    assert.deepEqual(got, ['clean-1'], 'orphan-1 has no state record, so it is not treated as seen');
  } finally {
    rmSync(repo, { recursive: true, force: true });
    rmSync(store.dir, { recursive: true, force: true });
  }
});

test('a published listing whose detail is over 3 days old is re-fetched (liveness)', async () => {
  const repo = tempRepo();
  const store = tempStore();
  const rec = cleanRecord(store, { fetchedAt: '2026-11-09T06:00:00.000Z' });
  seed(store, repo, [rec]);
  store.writeJson('seen/dogsy.json', ['clean-1']);
  const id = publicIds(store.secret(), 'dogsy', 'clean-1').id;
  let got = null;
  const adapter = {
    SUPPLIER: 'dogsy',
    run: async ({ seen }) => { got = [...seen]; return { supplier: 'dogsy', discovered: ['clean-1'], records: [], errors: [] }; },
  };
  try {
    const st = store.readJson('imports-state.json', {});
    st.published = { [id]: { status: 'published', publishedAt: '2026-11-09T06:00:00.000Z' } };
    store.writeJson('imports-state.json', st);
    await runPipeline({
      args: parseArgs(['--dry-run', '--source', 'dogsy']), store, repoRoot: repo, env: {}, now: () => NOW,
      adapters: { dogsy: adapter }, createHttpFn: (opts) => createHttp({ ...opts, fetchImpl: async () => { throw new Error('no network'); } }),
    });
    assert.deepEqual(got, [], 'the stale published detail is due for a re-fetch');
  } finally {
    rmSync(repo, { recursive: true, force: true });
    rmSync(store.dir, { recursive: true, force: true });
  }
});

test('a real run writes full detail to the private runs/<date>.json, never to the repo', async () => {
  const repo = tempRepo();
  const store = tempStore();
  seed(store, repo, [cleanRecord(store)]);
  try {
    await runPipeline({ args: parseArgs(['--no-fetch']), store, repoRoot: repo, env: {}, now: () => NOW });
    await runPipeline({ args: parseArgs(['--no-fetch']), store, repoRoot: repo, env: {}, now: () => NOW });
    const runs = store.readJson('runs/2026-11-13.json', null);
    assert.ok(Array.isArray(runs), 'runs/<date>.json is a list of the day\'s runs');
    assert.equal(runs.length, 2);
    assert.equal(runs[0].summary.gates['auto-ready'], 1);
    assert.equal(runs[0].groups.length, 1);
    assert.equal(runs[0].groups[0].disposition, 'auto-ready');
    assert.equal(runs[0].groups[0].key, 'dogsy:clean-1');
    assert.equal(existsSync(join(repo, 'runs')), false);
  } finally {
    rmSync(repo, { recursive: true, force: true });
    rmSync(store.dir, { recursive: true, force: true });
  }
});
