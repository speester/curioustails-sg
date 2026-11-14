// K-136: the Australian reservations on the imports instrument. Temp repo and
// temp private store only; no network, no real feed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { migrate, sync } from '../au-reservations.mjs';
import { approveItem, reserveItem, unpublishItem, OwnerActionError } from '../lib/owner.mjs';
import { auIds, evaluateAu } from '../lib/au.mjs';
import { runPipeline, parseArgs } from '../lib/pipeline.mjs';
import { tempRepo, tempStore, cleanup } from './_pipeline-fixtures.mjs';

const NOW = new Date('2026-11-14T04:00:00Z');
const SYNCED = '2026-11-10T00:00:00.000Z'; // 4 days old: G14 passes

// Five rows: priced+photo+age (approvable), no price, no photo, too old, and a
// second listing sharing the no-price row's photo.
const LEGACY = {
  syncedAt: SYNCED,
  breeds: {
    'golden-retriever': [
      { id: 'os-aaaa0001', listingId: '1001', breedLabel: 'Golden Retriever', crossLabel: null, gender: 'Male', age: '8 weeks', canFly: false, price: 4900, deposit: 2450, image: 'os-aaaa0001.webp' },
      { id: 'os-aaaa0002', listingId: '1002', breedLabel: 'Golden Retriever', crossLabel: null, gender: 'Female', age: '8 weeks', canFly: false, price: null, deposit: null, image: 'os-aaaa0002.webp' },
    ],
    cavapoo: [
      { id: 'os-aaaa0003', listingId: '1003', breedLabel: 'Cavoodle', crossLabel: null, gender: 'Both', age: '9 weeks', canFly: false, price: 6500, deposit: 3250, image: null },
      { id: 'os-aaaa0004', listingId: '1004', breedLabel: 'Cavoodle', crossLabel: null, gender: 'Female', age: '5 months', canFly: true, price: 5300, deposit: 2650, image: 'os-aaaa0004.webp' },
      { id: 'os-aaaa0002', listingId: '1005', breedLabel: 'Cavoodle', crossLabel: null, gender: 'Male', age: '8 weeks', canFly: false, price: 6000, deposit: 3000, image: 'os-aaaa0002.webp' },
    ],
  },
};

function setup() {
  const repo = tempRepo();
  writeFileSync(join(repo, 'src', 'data', 'overseas-puppies.json'), JSON.stringify(LEGACY));
  mkdirSync(join(repo, 'src', 'assets', 'overseas'), { recursive: true });
  for (const f of ['os-aaaa0001.webp', 'os-aaaa0002.webp', 'os-aaaa0004.webp']) writeFileSync(join(repo, 'src', 'assets', 'overseas', f), Buffer.from(`webp-${f}`));
  const store = tempStore();
  return { repo, store };
}
const queueOf = (store) => store.readJson('review-queue.json', []);
const auFeed = (repo) => JSON.parse(readFileSync(join(repo, 'src', 'data', 'au-reservations.json'), 'utf8'));
const auditOf = (store) => readFileSync(store.path('audit.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));

test('migrate queues every AU row for review, keeps Irish items, and writes nothing public', () => {
  const { repo, store } = setup();
  try {
    store.writeJson('review-queue.json', [{ id: 'imp-ffffffffff', key: 'dogsy:x', disposition: 'review' }]);
    const out = migrate({ store, repoRoot: repo, actor: 'owner:test', now: NOW });
    const q = queueOf(store);
    assert.equal(out.report.length, 5);
    assert.equal(q.filter((i) => i.origin === 'AU').length, 5);
    assert.ok(q.some((i) => i.id === 'imp-ffffffffff'), 'Irish queue item kept');
    assert.equal(existsSync(join(repo, 'src', 'data', 'au-reservations.json')), false, 'no public feed written by migrate');
    assert.equal(auditOf(store).filter((e) => e.event === 'au-migrated').length, 5);
  } finally { cleanup(repo, store.dir); }
});

test('prices and deposits are carried exactly as recorded; nothing is invented', () => {
  const { repo, store } = setup();
  try {
    migrate({ store, repoRoot: repo, now: NOW });
    const byListing = Object.fromEntries(queueOf(store).filter((i) => i.origin === 'AU').map((i) => [i.legacy.listingId, i]));
    assert.equal(byListing['1001'].candidate.priceSGD, 4900);
    assert.equal(byListing['1001'].candidate.depositSGD, 2450);
    assert.equal(byListing['1001'].candidate.balanceSGD, 2450);
    assert.equal(byListing['1001'].candidate.origin, 'AU');
    assert.match(byListing['1001'].candidate.ref, /^CT-AU-[0-9A-F]{6}$/);
    assert.equal(byListing['1001'].candidate.dob, null, 'no DOB worked back from a stale age');
    assert.equal(byListing['1001'].approvable, true);
    assert.equal(byListing['1002'].approvable, false, 'no price: needs an edit');
    assert.ok(byListing['1002'].blockedBy.some((b) => b.startsWith('G1:') && b.includes('price')));
    assert.equal(byListing['1003'].approvable, false, 'no photo');
    assert.equal(byListing['1004'].disposition, 'reject', 'over 16 weeks today');
    assert.ok(byListing['1005'].blockedBy.some((b) => b.startsWith('G7:')), 'shared photo is a duplicate');
  } finally { cleanup(repo, store.dir); }
});

test('nothing reaches the site without an owner approval, then sync publishes exactly that one', () => {
  const { repo, store } = setup();
  try {
    migrate({ store, repoRoot: repo, now: NOW });
    sync({ store, repoRoot: repo, now: NOW });
    assert.equal(auFeed(repo).pups.length, 0, 'no decision, nothing published');
    const ok = queueOf(store).find((i) => i.legacy?.listingId === '1001');
    const blocked = queueOf(store).find((i) => i.legacy?.listingId === '1002');
    assert.throws(() => approveItem({ store, id: blocked.id, actor: 'owner:test', now: () => NOW }), OwnerActionError);
    approveItem({ store, id: ok.id, actor: 'owner:test', now: () => NOW });
    const out = sync({ store, repoRoot: repo, now: NOW });
    const feed = auFeed(repo);
    assert.deepEqual(out.published, [ok.id]);
    assert.equal(feed.pups.length, 1);
    assert.equal(feed.pups[0].priceSGD, 4900);
    assert.equal(feed.cutover, false, 'no cutover without --cutover');
    assert.ok(existsSync(join(repo, 'src', 'assets', 'imported-au', `${ok.id}-1.webp`)));
    assert.equal(sync({ store, repoRoot: repo, now: NOW, cutover: true }).cutover, true);
  } finally { cleanup(repo, store.dir); }
});

test('a buyer-held AU listing can be marked reserved from the queue and publishes reserved', () => {
  const { repo, store } = setup();
  try {
    migrate({ store, repoRoot: repo, now: NOW });
    const ok = queueOf(store).find((i) => i.legacy?.listingId === '1001');
    const r = reserveItem({ store, repoRoot: repo, id: ok.id, actor: 'owner:test', now: () => NOW });
    assert.equal(r.queued, true);
    sync({ store, repoRoot: repo, now: NOW });
    assert.equal(auFeed(repo).pups[0].status, 'reserved');
  } finally { cleanup(repo, store.dir); }
});

test('takedown uses the same unpublish path: feed entry and photo gone, audit line, never relisted', () => {
  const { repo, store } = setup();
  try {
    migrate({ store, repoRoot: repo, now: NOW });
    const ok = queueOf(store).find((i) => i.legacy?.listingId === '1001');
    approveItem({ store, id: ok.id, actor: 'owner:test', now: () => NOW });
    sync({ store, repoRoot: repo, now: NOW });
    unpublishItem({ store, repoRoot: repo, id: ok.id, reason: 'takedown', actor: 'owner:test', now: () => NOW });
    assert.equal(auFeed(repo).pups.length, 0);
    assert.equal(existsSync(join(repo, 'src', 'assets', 'imported-au', `${ok.id}-1.webp`)), false);
    const line = auditOf(store).find((e) => e.event === 'takedown' && e.id === ok.id);
    assert.equal(line.actor, 'owner:test');
    assert.ok(line.at);
    const retired = JSON.parse(readFileSync(join(repo, 'src', 'data', 'imported-retired.json'), 'utf8'));
    assert.deepEqual(retired, [{ id: ok.id, breed: 'golden-retriever' }]);
    migrate({ store, repoRoot: repo, now: NOW });
    sync({ store, repoRoot: repo, now: NOW });
    assert.equal(auFeed(repo).pups.length, 0, 'a re-run never brings a taken-down listing back');
    assert.equal(queueOf(store).some((i) => i.id === ok.id), false);
  } finally { cleanup(repo, store.dir); }
});

test('the daily Irish pipeline carries AU queue items instead of dropping them', async () => {
  const { repo, store } = setup();
  try {
    migrate({ store, repoRoot: repo, now: NOW });
    await runPipeline({ args: parseArgs(['--no-fetch']), store, repoRoot: repo, env: {}, now: () => NOW });
    assert.equal(queueOf(store).filter((i) => i.origin === 'AU').length, 5);
  } finally { cleanup(repo, store.dir); }
});

test('stale sheet data is flagged (owner-waivable G14), and ids are stable per listing', () => {
  const store = tempStore();
  try {
    const identity = auIds(store.secret(), '1001');
    assert.deepEqual(identity, auIds(store.secret(), '1001'));
    const out = evaluateAu({
      breed: 'golden-retriever', row: LEGACY.breeds['golden-retriever'][0], syncedAt: '2026-10-02T06:55:38.669Z',
      identity, hasPhoto: true, now: NOW,
    });
    assert.ok(out.failures.some((f) => f.gate === 'G14' && /42 days/.test(f.detail)));
  } finally { cleanup(store.dir); }
});
