// T16: review queue, approve / reject / reserve / unpublish, audit, redirects.
// Temp repo + temp private store only; the review server is started on an
// ephemeral port of 127.0.0.1. No outside network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import http from 'node:http';
import { runPipeline, parseArgs } from '../lib/pipeline.mjs';
import { createReviewServer, REVIEW_HOST, REVIEW_PORT } from '../review.mjs';
import { queueView, approveItem, rejectItem, reserveItem, unpublishItem, OwnerActionError } from '../lib/owner.mjs';
import { retiredPuppyRules } from '../../lib/puppy-redirects.mjs';
import {
  NOW, CHIPS, SELLER_PHONE, SELLER_NAME, PII_PATTERNS,
  tempRepo, tempStore, cleanup, cleanRecord, seed, idOf,
} from './_pipeline-fixtures.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPTS = join(HERE, '..');

const sync = (store, repo, env = {}) => runPipeline({ args: parseArgs(['--no-fetch']), store, repoRoot: repo, env, now: () => NOW });
const feedOf = (repo) => JSON.parse(readFileSync(join(repo, 'src', 'data', 'imported-puppies.json'), 'utf8'));
const auditOf = (store) => readFileSync(store.path('audit.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
const stateOf = (store) => store.readJson('imports-state.json', {});

function request(port, { method = 'GET', path = '/', headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path, headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function withServer(store, repo, fn) {
  const review = createReviewServer({ store, repoRoot: repo, actor: 'owner:test', now: () => NOW });
  const { port } = await review.listen(0);
  try { return await fn({ review, port }); } finally { await review.close(); }
}

const action = (port, token, payload) => request(port, {
  method: 'POST',
  path: '/api/action',
  headers: { 'content-type': 'application/json', host: `127.0.0.1:${port}`, 'x-review-token': token },
  body: JSON.stringify(payload),
});

// One queued (auto-ready) clean listing.
async function queuedFixture(over = {}) {
  const repo = tempRepo();
  const store = tempStore();
  const rec = cleanRecord(store, over);
  seed(store, [rec]);
  await sync(store, repo);
  return { repo, store, rec, id: idOf(store, rec) };
}

// ---- bind address ----------------------------------------------------------------

test('T16: the review server binds only to 127.0.0.1, whatever HOST says', async () => {
  const repo = tempRepo();
  const store = tempStore();
  const saved = { HOST: process.env.HOST, IMPORTS_REVIEW_HOST: process.env.IMPORTS_REVIEW_HOST };
  process.env.HOST = '0.0.0.0';
  process.env.IMPORTS_REVIEW_HOST = '0.0.0.0';
  try {
    assert.equal(REVIEW_HOST, '127.0.0.1');
    assert.equal(REVIEW_PORT, 4791);
    await withServer(store, repo, async ({ review }) => {
      const addr = review.server.address();
      assert.equal(addr.address, '127.0.0.1');
      assert.equal(addr.family, 'IPv4');
    });
  } finally {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    cleanup(repo, store.dir);
  }
});

test('T16: a request with a foreign Host header, or an action without the page token, is refused', async () => {
  const { repo, store, id } = await queuedFixture();
  try {
    await withServer(store, repo, async ({ port, review }) => {
      const foreign = await request(port, { headers: { host: 'attacker.example:4791' } });
      assert.equal(foreign.status, 403);
      const noToken = await action(port, 'wrong-token', { action: 'approve', id });
      assert.equal(noToken.status, 403);
      const ok = await request(port, { headers: { host: `127.0.0.1:${port}` } });
      assert.equal(ok.status, 200);
      assert.ok(ok.body.includes(review.token), 'the page carries the action token');
    });
    assert.equal(stateOf(store).decisions?.[id], undefined, 'nothing was decided');
  } finally { cleanup(repo, store.dir); }
});

// ---- queue view ------------------------------------------------------------------

test('T16: the queue shows auto-ready and review items with source, breed, sex, age, price, photos, gates and reasons', async () => {
  const repo = tempRepo();
  const store = tempStore();
  const clean = cleanRecord(store);
  const noChip = cleanRecord(store, { listingId: 'nochip-2', chips: [], dhashBase: 'abcdef012345678' });
  noChip.puppies = [{ sex: 'F', colour: 'White', price: 550, microchip: null, status: 'For Sale' }];
  seed(store, [clean, noChip]);
  await sync(store, repo);
  try {
    const { queue } = queueView({ store, repoRoot: repo });
    const byId = Object.fromEntries(queue.map((q) => [q.id, q]));
    const a = byId[idOf(store, clean)];
    const b = byId[idOf(store, noChip)];
    assert.equal(a.disposition, 'auto-ready');
    assert.equal(b.disposition, 'review');
    assert.equal(a.source.site, 'irishpuppies.ie');
    assert.match(a.source.url, /^https:\/\/dogsy\.ie\//, 'the private listing link is shown to the owner');
    assert.equal(a.breedLabel, 'Jack Russell Terrier');
    assert.deepEqual(a.sex, { male: 2, female: 1 });
    assert.equal(a.age, '10 weeks');
    assert.equal(a.priceSGD, 4550);
    assert.equal(a.photos.length, 3);
    assert.ok(Array.isArray(a.gates) && a.gates.length === 15);
    assert.deepEqual(a.reviewReasons, []);
    assert.ok(b.reviewReasons.some((r) => r.startsWith('G10')));
    assert.equal(a.approvable, true);
  } finally { cleanup(repo, store.dir); }
});

test('T16: the queue carries no seller data, microchip or description, only the listing', async () => {
  const { repo, store } = await queuedFixture();
  try {
    const view = JSON.stringify(queueView({ store, repoRoot: repo }));
    for (const banned of [SELLER_NAME, SELLER_PHONE, ...CHIPS, 'Kildare', 'Naas', 'wormed, vaccinated']) {
      assert.equal(view.includes(banned), false, `queue view leaks ${banned}`);
    }
    for (const key of ['"seller"', '"microchip"', '"puppies"', '"descriptionRaw"', '"county"', '"town"', '"priceRaw"']) {
      assert.equal(view.includes(key), false, `queue view has key ${key}`);
    }
    await withServer(store, repo, async ({ port }) => {
      const page = await request(port, { headers: { host: `127.0.0.1:${port}` } });
      for (const banned of [SELLER_NAME, SELLER_PHONE, ...CHIPS]) assert.equal(page.body.includes(banned), false);
    });
  } finally { cleanup(repo, store.dir); }
});

test('T16: the review page serves a queued photo from the private stage, and nothing else', async () => {
  const { repo, store, id } = await queuedFixture();
  try {
    await withServer(store, repo, async ({ port }) => {
      const h = { host: `127.0.0.1:${port}` };
      const ok = await request(port, { path: `/photo/${id}-1.webp`, headers: h });
      assert.equal(ok.status, 200);
      assert.equal(ok.headers['content-type'], 'image/webp');
      assert.equal((await request(port, { path: '/photo/..%2Fimports-state.json', headers: h })).status, 404);
      assert.equal((await request(port, { path: '/photo/imp-0000000000-1.webp', headers: h })).status, 404);
    });
  } finally { cleanup(repo, store.dir); }
});

// ---- approve / reject ------------------------------------------------------------

test('T16: approve then sync publishes the item, and only after the approve', async () => {
  const { repo, store, id } = await queuedFixture();
  try {
    await sync(store, repo);
    assert.equal(feedOf(repo).pups.length, 0, 'auto-ready is not published by a second sync');
    await withServer(store, repo, async ({ port, review }) => {
      const r = await action(port, review.token, { action: 'approve', id });
      assert.equal(r.status, 200, r.body);
    });
    assert.equal(feedOf(repo).pups.length, 0, 'approve alone does not publish; the sync does');
    const { summary } = await sync(store, repo);
    const feed = feedOf(repo);
    assert.deepEqual(feed.pups.map((p) => p.id), [id]);
    assert.equal(feed.pups[0].status, 'published');
    assert.equal(summary.published, 1);
    for (const n of [1, 2, 3]) assert.ok(existsSync(join(repo, 'src', 'assets', 'imported', `${id}-${n}.webp`)));
    const approved = auditOf(store).find((e) => e.event === 'approved');
    assert.equal(approved.actor, 'owner:test');
    assert.ok(approved.at);
    assert.ok(auditOf(store).some((e) => e.event === 'published' && e.id === id));
  } finally { cleanup(repo, store.dir); }
});

test('T16: reject keeps the item out on later runs, even with autopublish on and the valve off', async () => {
  const { repo, store, id, rec } = await queuedFixture();
  try {
    rejectItem({ store, id, actor: 'owner:test', now: () => NOW });
    for (let i = 0; i < 2; i++) {
      const { queue } = await sync(store, repo, { IMPORTS_AUTOPUBLISH: '1', IMPORTS_SAFETY_VALVE: '0' });
      assert.equal(feedOf(repo).pups.length, 0);
      assert.equal(queue.some((q) => q.id === id), false, 'a rejected item does not come back to the queue');
    }
    // The same litter relisted on another site (shared chip) stays out too.
    const relist = cleanRecord(store, { supplier: 'dogquest', listingId: 'relist-9', chips: [CHIPS[0]], dhashBase: '123456789abcdef' });
    const st = stateOf(store);
    st.records[relist.key] = relist;
    store.writeJson('imports-state.json', st);
    await sync(store, repo, { IMPORTS_AUTOPUBLISH: '1', IMPORTS_SAFETY_VALVE: '0' });
    assert.equal(feedOf(repo).pups.length, 0, 'a relisting of a rejected litter is rejected');
    const rejected = auditOf(store).find((e) => e.event === 'rejected' && e.actor === 'owner:test');
    assert.equal(rejected.id, id);
    assert.ok(rec);
  } finally { cleanup(repo, store.dir); }
});

test('T16: a dfsi item cannot be approved: the UI refuses and nothing is recorded', async () => {
  const { repo, store, id } = await queuedFixture({ supplier: 'dfsi', listingId: 'dfsi-77', viaSite: 'dogsforsaleireland.ie' });
  try {
    const before = readFileSync(store.path('imports-state.json'), 'utf8');
    await withServer(store, repo, async ({ port, review }) => {
      const r = await action(port, review.token, { action: 'approve', id });
      assert.equal(r.status, 409, r.body);
      assert.match(JSON.parse(r.body).error, /lead-only/);
      const page = await request(port, { headers: { host: `127.0.0.1:${port}` } });
      assert.match(page.body, /lead-only/i, 'the page says why');
    });
    assert.equal(readFileSync(store.path('imports-state.json'), 'utf8'), before);
    assert.throws(() => approveItem({ store, id, actor: 'owner:test', now: () => NOW }), OwnerActionError);
    await sync(store, repo, { IMPORTS_AUTOPUBLISH: '1', IMPORTS_SAFETY_VALVE: '0' });
    assert.equal(feedOf(repo).pups.length, 0);
  } finally { cleanup(repo, store.dir); }
});

test('T16: a puppies.ie item cannot be approved either', async () => {
  const { repo, store, id } = await queuedFixture({ supplier: 'dogsie', listingId: 'pie-5', viaSite: 'puppies.ie', images: [] });
  try {
    assert.throws(() => approveItem({ store, id, actor: 'owner:test', now: () => NOW }), /lead-only/);
  } finally { cleanup(repo, store.dir); }
});

test('T16: a lead-only approval written straight into the state still never publishes', async () => {
  const { repo, store, id } = await queuedFixture({ supplier: 'dfsi', listingId: 'dfsi-78', viaSite: 'dogsforsaleireland.ie' });
  try {
    const st = stateOf(store);
    st.decisions = { [id]: { decision: 'approve', by: 'owner:forged', at: NOW.toISOString() } };
    store.writeJson('imports-state.json', st);
    await sync(store, repo);
    assert.equal(feedOf(repo).pups.length, 0);
  } finally { cleanup(repo, store.dir); }
});

test('T16: a review item missing a required field needs an edit and is refused; a no-microchip item can be approved', async () => {
  const repo = tempRepo();
  const store = tempStore();
  const noPrice = cleanRecord(store, { listingId: 'noprice-3', priceRaw: '', priceNumber: null, dhashBase: 'fedcba987654321' });
  noPrice.puppies = noPrice.puppies.map((p) => ({ ...p, price: null }));
  const noChip = cleanRecord(store, { listingId: 'nochip-4', chips: [], dhashBase: '0f0f0f0f0f0f0f0' });
  noChip.puppies = [{ sex: 'F', colour: 'White', price: 550, microchip: null, status: 'For Sale' }];
  seed(store, [noPrice, noChip]);
  await sync(store, repo);
  try {
    assert.throws(() => approveItem({ store, id: idOf(store, noPrice), actor: 'owner:test', now: () => NOW }), /needs an edit/);
    approveItem({ store, id: idOf(store, noChip), actor: 'owner:test', now: () => NOW });
    await sync(store, repo);
    assert.deepEqual(feedOf(repo).pups.map((p) => p.id), [idOf(store, noChip)]);
  } finally { cleanup(repo, store.dir); }
});

// ---- reserve / unpublish ---------------------------------------------------------

async function publishedFixture() {
  const f = await queuedFixture();
  approveItem({ store: f.store, id: f.id, actor: 'owner:test', now: () => NOW });
  await sync(f.store, f.repo);
  assert.equal(feedOf(f.repo).pups.length, 1);
  return f;
}

test('T16: reserve marks a published pup reserved, and a later "sold" at the source keeps it up', async () => {
  const { repo, store, id, rec } = await publishedFixture();
  try {
    await withServer(store, repo, async ({ port, review }) => {
      const r = await action(port, review.token, { action: 'reserve', id });
      assert.equal(r.status, 200, r.body);
    });
    assert.equal(feedOf(repo).pups[0].status, 'reserved', 'the feed shows reserved at once');
    const st = stateOf(store);
    st.records[rec.key].sourceStatus = 'sold';
    store.writeJson('imports-state.json', st);
    await sync(store, repo);
    assert.equal(feedOf(repo).pups[0].status, 'reserved');
    assert.ok(auditOf(store).some((e) => e.event === 'reserved' && e.actor === 'owner:test'));
  } finally { cleanup(repo, store.dir); }
});

test('T16: reserve and unpublish refuse an item that is not live', async () => {
  const { repo, store, id } = await queuedFixture();
  try {
    assert.throws(() => reserveItem({ store, repoRoot: repo, id, actor: 'owner:test', now: () => NOW }), /not live/);
    assert.throws(() => unpublishItem({ store, repoRoot: repo, id, actor: 'owner:test', now: () => NOW }), /not live/);
  } finally { cleanup(repo, store.dir); }
});

test('T16: unpublish --reason takedown removes the JSON entry and the WebPs, adds a redirect and writes an audit line with the actor', async () => {
  const { repo, store, id } = await publishedFixture();
  try {
    const r = spawnSync(process.execPath, [join(SCRIPTS, 'unpublish.mjs'), id, '--reason', 'takedown', '--actor', 'owner:cli-test', '--repo', repo], {
      encoding: 'utf8', env: { ...process.env, IMPORTS_PRIVATE_DIR: store.dir },
    });
    assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
    assert.equal(feedOf(repo).pups.length, 0, 'JSON entry removed');
    assert.deepEqual(readdirSync(join(repo, 'src', 'assets', 'imported')).filter((n) => n.startsWith(id)), [], 'repo WebPs removed');
    assert.deepEqual(readdirSync(store.path('images-processed')).filter((n) => n.startsWith(id)), [], 'takedown purges the private copies');
    const retired = JSON.parse(readFileSync(join(repo, 'src', 'data', 'imported-retired.json'), 'utf8'));
    assert.deepEqual(retired, [{ id, breed: 'jack-russell-terrier' }]);
    const line = auditOf(store).find((e) => e.event === 'takedown');
    assert.equal(line.id, id);
    assert.equal(line.actor, 'owner:cli-test');
    assert.match(line.at, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(line.detail.reason, 'takedown');
    assert.ok(auditOf(store).some((e) => e.event === 'purged' && e.id === id));
    // Later runs never bring it back, even with autopublish on.
    await sync(store, repo, { IMPORTS_AUTOPUBLISH: '1', IMPORTS_SAFETY_VALVE: '0' });
    assert.equal(feedOf(repo).pups.length, 0);
  } finally { cleanup(repo, store.dir); }
});

test('T16: imported-retired.json holds only {id, breed}, once per id', async () => {
  const { repo, store, id } = await publishedFixture();
  try {
    unpublishItem({ store, repoRoot: repo, id, reason: 'sold', actor: 'owner:test', now: () => NOW });
    const retired = JSON.parse(readFileSync(join(repo, 'src', 'data', 'imported-retired.json'), 'utf8'));
    assert.ok(Array.isArray(retired));
    for (const r of retired) assert.deepEqual(Object.keys(r).sort(), ['breed', 'id']);
    assert.equal(retired.filter((r) => r.id === id).length, 1);
  } finally { cleanup(repo, store.dir); }
});

test('T16: a retired imported pup 301s to its breed page at build', () => {
  const root = mkdtempSync(join(tmpdir(), 'ct-redirects-'));
  try {
    const dist = join(root, 'dist');
    mkdirSync(join(dist, 'puppies', 'jack-russell-terrier'), { recursive: true });
    writeFileSync(join(dist, 'puppies', 'jack-russell-terrier', 'index.html'), 'breed');
    const importedRetired = join(root, 'imported-retired.json');
    writeFileSync(importedRetired, JSON.stringify([{ id: 'imp-7f3a2c91de', breed: 'jack-russell-terrier' }, { id: 'imp-0123456789', breed: 'toy-poodle' }]));
    const rules = retiredPuppyRules(dist, { archive: join(root, 'none.json'), importedRetired });
    assert.ok(rules.includes('/puppies/jack-russell-terrier/imp-7f3a2c91de/ /puppies/jack-russell-terrier/ 301'));
    assert.ok(rules.includes('/puppies/toy-poodle/imp-0123456789/ /puppies/ 301'), 'falls back to /puppies/ when the breed page is not built');
  } finally { cleanup(root); }
});

// ---- logs ------------------------------------------------------------------------

test('T16: owner actions log no phone, email, URL or microchip (regex check on logs and CLI output)', async () => {
  const { repo, store, id } = await queuedFixture();
  try {
    const env = { ...process.env, IMPORTS_PRIVATE_DIR: store.dir };
    const run = (script, args) => spawnSync(process.execPath, [join(SCRIPTS, script), ...args, '--repo', repo, '--actor', 'owner:log-test'], { encoding: 'utf8', env });
    const outs = [run('approve.mjs', ['approve', id])];
    await sync(store, repo);
    outs.push(run('approve.mjs', ['reserve', id]));
    outs.push(run('unpublish.mjs', [id, '--reason', 'owner', '--purge-images']));
    for (const o of outs) assert.equal(o.status, 0, `${o.stdout}${o.stderr}`);
    const logDir = join(repo, 'logs', 'imports');
    const logs = readdirSync(logDir).map((n) => readFileSync(join(logDir, n), 'utf8')).join('\n');
    assert.match(logs, /owner approve/);
    assert.match(logs, /owner unpublish/);
    const text = `${logs}\n${outs.map((o) => o.stdout + o.stderr).join('\n')}`;
    for (const [kind, re] of Object.entries(PII_PATTERNS)) assert.equal(re.test(text), false, `${kind} in logs/output`);
  } finally { cleanup(repo, store.dir); }
});
