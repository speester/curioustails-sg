// T25: the daily runner's failure contract. No network: a fake adapter returns
// a blocked-host error, and the real pipeline + real alert writer are exercised.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { classifyRun, splitQueue, alertMarkdown, writeAlertFiles, postToBoard, boardPayload, sgtLabel, REVIEW_BACKLOG_COUNT } from '../lib/alert.mjs';
import { runDaily } from '../run-daily.mjs';
import { openStore } from '../lib/store.mjs';
import { cleanRecord, seed, tempRepo, NOW, PII_PATTERNS } from './_pipeline-fixtures.mjs';

function tempStore() {
  return openStore({ dir: mkdtempSync(join(tmpdir(), 'ct-imports-alert-store-')) });
}

function assertNoPii(text, label) {
  for (const [kind, re] of Object.entries(PII_PATTERNS)) {
    assert.equal(re.test(text), false, `${kind} in ${label}`);
  }
}

test('classifyRun: a clean summary has no reasons and status ok', () => {
  const r = classifyRun({ summary: { errors: [], gates: {} }, queue: [], startedAt: NOW });
  assert.deepEqual(r.reasons, []);
  assert.equal(r.status, 'ok');
  assert.equal(r.failed, false);
});

test('classifyRun: a blocked host is a hard failure', () => {
  const r = classifyRun({
    summary: { errors: [{ stage: 'http', source: 'dogsy', code: 'blocked', blocked: true }] },
    startedAt: NOW,
  });
  assert.equal(r.failed, true);
  assert.equal(r.status, 'failed');
  assert.equal(r.reasons[0].code, 'source-blocked');
});

test('classifyRun: an http blocked: alert without a flag is still hard', () => {
  const r = classifyRun({
    summary: { errors: [{ stage: 'http', host: 'dogsy.ie', code: 'blocked: 403' }] },
    startedAt: NOW,
  });
  assert.equal(r.failed, true);
  assert.equal(r.reasons[0].code, 'source-blocked');
});

test('classifyRun: a missing published photo is hard, an adapter error is soft', () => {
  const hard = classifyRun({
    summary: { errors: [{ stage: 'assets', code: 'missing-photo', count: 2 }] },
    startedAt: NOW,
  });
  assert.equal(hard.failed, true);
  assert.equal(hard.reasons[0].code, 'missing-photo');

  const soft = classifyRun({
    summary: { errors: [{ stage: 'adapter', source: 'dogsy', code: 'Error' }] },
    startedAt: NOW,
  });
  assert.equal(soft.failed, false);
  assert.equal(soft.status, 'attention');
  assert.equal(soft.reasons[0].code, 'adapter-error');
});

// K-139 queue fixtures, shaped like review-queue.json items. Publishable
// sources are dogsy/dogquest; dogsie (puppies.ie) and dfsi are lead-only.
const LEAD_FAILS = [
  { gate: 'G6', severity: 'review', detail: 'no-local-photo' },
  { gate: 'G14', severity: 'review', detail: 'lead-only,no-photos-source-blocked' },
];
function qItem(i, kind, at = NOW) {
  const base = { id: `imp-${kind}-${i}`, firstFailedAt: new Date(at).toISOString(), decision: null };
  if (kind === 'auto') return { ...base, disposition: 'auto-ready', leadOnly: false, source: { supplier: 'dogsy' }, failures: [] };
  if (kind === 'waive') return { ...base, disposition: 'review', leadOnly: false, source: { supplier: 'dogquest' }, failures: [{ gate: 'G12', severity: 'review', detail: 'short-description' }] };
  if (kind === 'edit') return { ...base, disposition: 'review', leadOnly: false, source: { supplier: 'dogsy' }, failures: [{ gate: 'G5', severity: 'review', detail: 'arrival-month-2026-10' }] };
  if (kind === 'lead') return { ...base, disposition: 'review', leadOnly: true, source: { supplier: i % 2 ? 'dfsi' : 'dogsie' }, failures: LEAD_FAILS };
  // An item written before the leadOnly flag existed: the supplier decides.
  if (kind === 'lead-legacy') return { ...base, disposition: 'review', source: { supplier: 'dogsie' }, failures: LEAD_FAILS };
  throw new Error(kind);
}
const many = (n, kind, at) => Array.from({ length: n }, (_, i) => qItem(i, kind, at));
const backlog = (r) => r.reasons.filter((x) => x.code === 'review-backlog');

test('classifyRun: the publishable backlog limit is 20 — 21 fires, 20 does not', () => {
  assert.equal(REVIEW_BACKLOG_COUNT, 20);
  const at21 = classifyRun({ summary: { errors: [] }, queue: [...many(11, 'auto'), ...many(8, 'waive'), ...many(2, 'edit')], startedAt: NOW });
  assert.equal(at21.failed, false);
  assert.equal(backlog(at21).length, 1, '21 publishable must fire');
  assert.match(backlog(at21)[0].message, /^21 publishable items/);

  const at20 = classifyRun({ summary: { errors: [] }, queue: [...many(11, 'auto'), ...many(7, 'waive'), ...many(2, 'edit')], startedAt: NOW });
  assert.equal(backlog(at20).length, 0, '20 publishable must not fire');
  assert.equal(at20.status, 'ok');

  // Auto-ready items are publishable work too: 21 of them alone fire.
  assert.equal(backlog(classifyRun({ summary: { errors: [] }, queue: many(21, 'auto'), startedAt: NOW })).length, 1);
  assert.equal(backlog(classifyRun({ summary: { errors: [] }, queue: many(21, 'waive'), startedAt: NOW })).length, 1);
});

test('classifyRun: lead-only records never fire the backlog, however many', () => {
  for (const kind of ['lead', 'lead-legacy']) {
    const only = classifyRun({ summary: { errors: [] }, queue: many(200, kind), startedAt: NOW });
    assert.deepEqual(only.reasons, [], `200 ${kind} must not alert`);
    assert.equal(only.status, 'ok');
  }
  // 200 leads on top of exactly 20 publishable still do not tip it over.
  const mixed = classifyRun({ summary: { errors: [] }, queue: [...many(200, 'lead'), ...many(20, 'waive')], startedAt: NOW });
  assert.equal(backlog(mixed).length, 0);
  // Old lead-only records never fire the age alert either.
  const stale = classifyRun({ summary: { errors: [] }, queue: many(200, 'lead', NOW.getTime() - 30 * 86400000), startedAt: NOW });
  assert.deepEqual(stale.reasons, []);
});

test('classifyRun: the K-135 queue (11 auto-ready, 3 review, 70 lead-only) is alert: none', () => {
  const queue = [...many(11, 'auto'), ...many(1, 'waive'), ...many(2, 'edit'), ...many(70, 'lead')];
  const r = classifyRun({ summary: { errors: [] }, queue, startedAt: NOW });
  assert.deepEqual(r.reasons, []);
  assert.equal(r.status, 'ok');
  const split = splitQueue(queue);
  assert.deepEqual(
    { autoReady: split.autoReady, review: split.review, needsEdit: split.needsEdit, leadOnly: split.leadOnly, publishable: split.publishable },
    { autoReady: 11, review: 3, needsEdit: 2, leadOnly: 70, publishable: 14 },
  );
  // The three top-level counts partition the queue.
  assert.equal(split.autoReady + split.review + split.leadOnly, queue.length);
  // The acceptance case: 12 publishable + 70 lead-only.
  assert.deepEqual(classifyRun({ summary: { errors: [] }, queue: [...many(11, 'auto'), ...many(1, 'waive'), ...many(70, 'lead')], startedAt: NOW }).reasons, []);
});

test('classifyRun: a publishable item older than 72 h is a soft alert', () => {
  const old = [qItem(0, 'waive', NOW.getTime() - 4 * 86400000)];
  const byAge = classifyRun({ summary: { errors: [] }, queue: old, startedAt: NOW });
  assert.ok(byAge.reasons.some((r) => r.code === 'review-backlog-age'));
});

test('alertMarkdown: the queue section splits publishable from lead-only', () => {
  const md = alertMarkdown({ status: 'attention', startedAt: NOW, reasons: [], queue: [...many(11, 'auto'), ...many(1, 'waive'), ...many(2, 'edit'), ...many(70, 'lead')] });
  assert.match(md, /- publishable: 14 /);
  assert.match(md, /- auto-ready: 11 /);
  assert.match(md, /- review: 3 \(2 need an edit/);
  assert.match(md, /- lead-only: 70 /);
});

test('classifyRun: a thrown feed-validation error is hard', () => {
  const r = classifyRun({ error: { code: 'feed-validation', message: 'public feed leak: supplier-token at $.pups[0].colours[0]' }, startedAt: NOW });
  assert.equal(r.failed, true);
  assert.equal(r.reasons[0].code, 'feed-validation');
});

test('writeAlertFiles: both durable files exist and carry no PII', () => {
  const root = tempRepo();
  try {
    const logPath = join(root, 'logs', 'imports', '2026-11-13.log');
    mkdirSync(join(root, 'logs', 'imports'), { recursive: true });
    const alert = writeAlertFiles({
      repoRoot: root,
      status: 'failed',
      startedAt: NOW,
      reasons: [{ code: 'run-failed', message: 'seller Siobhan Kearney 0861234567 buyer@example.com 372112345678901' }],
      summary: null,
      queue: [],
      logPath,
      board: { posted: false, skipped: 'no-board-token' },
    });
    assert.ok(existsSync(alert.full));
    assert.ok(existsSync(alert.pointer));
    const full = readFileSync(alert.full, 'utf8');
    const pointer = readFileSync(alert.pointer, 'utf8');
    assert.match(full, /NEEDS-ATTENTION/);
    assert.match(full, /run-failed/);
    assert.match(full, /no BOARD_TOKEN/);
    assert.match(full, /Autopublish: OFF/);
    assert.match(pointer, /logs\/imports\/NEEDS-ATTENTION\.md/);
    assertNoPii(full, 'alert');
    assertNoPii(pointer, 'pointer');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('postToBoard: no token skips, a token posts once with bearer auth', async () => {
  const skipped = await postToBoard({ env: {}, payload: { a: 1 } });
  assert.equal(skipped.posted, false);
  assert.equal(skipped.skipped, 'no-board-token');

  let seen = null;
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      seen = { headers: req.headers, body };
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"ok":true}');
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const port = server.address().port;
    const payload = { source: 'curious-tails-imports', severity: 'error' };
    const posted = await postToBoard({
      env: { BOARD_TOKEN: 'secret-board-token', BOARD_URL: `http://127.0.0.1:${port}/alert` },
      payload,
    });
    assert.equal(posted.posted, true);
    assert.equal(seen.headers.authorization, 'Bearer secret-board-token');
    assert.deepEqual(JSON.parse(seen.body), payload);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('runDaily: a blocked host exits 1 and leaves the alert artefacts', async () => {
  const root = tempRepo();
  const store = tempStore();
  const blocked = {
    SUPPLIER: 'dogsy',
    run: async () => ({
      supplier: 'dogsy',
      discovered: ['x-1'],
      records: [],
      errors: [{ stage: 'fetch', status: 403, blocked: true }],
    }),
  };
  try {
    const r = await runDaily({
      argv: ['--source', 'dogsy'],
      repoRoot: root,
      store,
      env: {},
      now: () => NOW,
      adapters: { dogsy: blocked },
    });
    assert.equal(r.exitCode, 1);
    assert.equal(r.status, 'failed');
    assert.equal(r.classification.hard[0].code, 'source-blocked');
    assert.ok(existsSync(join(root, 'logs', 'imports', 'NEEDS-ATTENTION.md')), 'full alert');
    assert.ok(existsSync(join(root, 'NEEDS-ATTENTION.md')), 'root pointer');
    assert.ok(existsSync(join(root, 'logs', 'imports', '2026-11-13.log')), 'log');
    const record = JSON.parse(readFileSync(join(root, 'logs', 'imports', 'last-run.json'), 'utf8'));
    assert.equal(record.status, 'failed');
    assert.equal(record.exitCode, 1);
    assert.equal(record.autopublish, false);
    assert.equal(record.board.skipped, 'no-board-token');
    const alert = readFileSync(join(root, 'logs', 'imports', 'NEEDS-ATTENTION.md'), 'utf8');
    assert.match(alert, /source-blocked/);
    assertNoPii(alert, 'blocked alert');
    assertNoPii(readFileSync(join(root, 'logs', 'imports', '2026-11-13.log'), 'utf8'), 'blocked log');
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(store.dir, { recursive: true, force: true });
  }
});

test('runDaily: a clean no-fetch run exits 0, records auto-ready and stays unpublished', async () => {
  const root = tempRepo();
  const store = tempStore();
  const rec = cleanRecord(store, { listingId: 'k092-clean-jrt' });
  seed(store, [rec]);
  try {
    const r = await runDaily({
      argv: ['--no-fetch'],
      repoRoot: root,
      store,
      // Proves the scheduled runner overrides an inherited auto-publish flag.
      env: { IMPORTS_AUTOPUBLISH: '1' },
      now: () => NOW,
    });
    assert.equal(r.exitCode, 0);
    assert.equal(r.status, 'ok');
    assert.equal(r.record.autopublish, false);
    assert.equal(r.record.autopublishEnvPresent, true);
    assert.equal(r.record.queue.autoReady, 1);
    assert.equal(r.record.queue.review, 0);
    assert.equal(r.record.queue.leadOnly, 0);
    assert.equal(r.record.queue.publishable, 1);
    assert.equal(r.record.counts.feedPups, 0);
    assert.equal(existsSync(join(root, 'logs', 'imports', 'NEEDS-ATTENTION.md')), false);
    assert.equal(existsSync(join(root, 'NEEDS-ATTENTION.md')), false);
    const record = JSON.parse(readFileSync(join(root, 'logs', 'imports', 'last-run.json'), 'utf8'));
    assert.equal(record.status, 'ok');
    assert.equal(record.exitCode, 0);
    assert.deepEqual(record.alerts, []);
    const feed = JSON.parse(readFileSync(join(root, 'src', 'data', 'imported-puppies.json'), 'utf8'));
    assert.equal(feed.pups.length, 0, 'an auto-ready item must not reach the public feed');
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(store.dir, { recursive: true, force: true });
  }
});

test('runDaily: last-run.json carries autoReady, review and leadOnly as separate counts', async () => {
  const root = tempRepo();
  const store = tempStore();
  const clean = cleanRecord(store, { listingId: 'k139-clean' });
  const lead = cleanRecord(store, { supplier: 'dogsie', listingId: 'k139-lead', viaSite: 'puppies.ie', dhashBase: 'abcdabcdabcdabc', chips: ['372112345678911'] });
  seed(store, [clean, lead]);
  try {
    const r = await runDaily({ argv: ['--no-fetch'], repoRoot: root, store, env: {}, now: () => NOW });
    assert.equal(r.exitCode, 0);
    const record = JSON.parse(readFileSync(join(root, 'logs', 'imports', 'last-run.json'), 'utf8'));
    assert.equal(record.queue.autoReady, 1);
    assert.equal(record.queue.review, 0);
    assert.equal(record.queue.leadOnly, 1);
    assert.equal(record.queue.publishable, 1);
    assert.equal(record.status, 'ok');
    assert.deepEqual(record.alerts, []);
    // The lead is kept in the queue, not dropped.
    const queue = JSON.parse(readFileSync(store.path('review-queue.json'), 'utf8'));
    assert.equal(queue.filter((q) => q.leadOnly).length, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(store.dir, { recursive: true, force: true });
  }
});

test('runDaily: a malformed carried feed entry is a hard schema failure, exit 1', async () => {
  const root = tempRepo();
  const store = tempStore();
  const id = 'imp-aaaaaaaaaa';
  const badPup = {
    id,
    ref: 'CT-IE-AAAAAA',
    breed: 'jack-russell-terrier',
    breedLabel: 'Jack Russell Terrier',
    crossLabel: null,
    name: null,
    sex: { male: 1, female: 0 },
    colours: ['Tan & White'],
    dob: '2026-09-04',
    age: '10 weeks',
    priceSGD: 'not-a-number',
    depositPct: 50,
    depositSGD: 2275,
    balanceSGD: 2275,
    balanceDue: 'before-flight',
    arrivalEstimate: '2026-12',
    arrivalBasis: 'dob',
    imported: true,
    origin: 'IE',
    reservation: true,
    perks: ['starter-kit'],
    photos: [`${id}-1.webp`],
    photoAlt: ['Tan & White Jack Russell Terrier puppy, male, 10 weeks'],
    status: 'published',
    publishedAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    sourceHash: 'a'.repeat(64),
    hdbApproved: true,
    eligibleSG: true,
    specified: false,
  };
  writeFileSync(
    join(root, 'src', 'data', 'imported-puppies.json'),
    JSON.stringify({ syncedAt: NOW.toISOString(), schema: 1, pups: [badPup] }, null, 2),
  );
  seed(store, [], {
    firstRunAt: '2026-10-01T00:00:00.000Z',
    published: {
      [id]: {
        publishedAt: '2026-11-01T00:00:00.000Z',
        firstPublishedAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
        status: 'published',
        missingRuns: 0,
      },
    },
  });
  try {
    const r = await runDaily({
      argv: ['--no-fetch'],
      repoRoot: root,
      store,
      env: { IMPORTS_SAFETY_VALVE: '0' },
      now: () => NOW,
    });
    assert.equal(r.exitCode, 1);
    assert.equal(r.status, 'failed');
    assert.equal(r.classification.hard[0].code, 'feed-validation');
    const alert = readFileSync(join(root, 'logs', 'imports', 'NEEDS-ATTENTION.md'), 'utf8');
    assert.match(alert, /feed-validation/);
    assert.match(alert, /priceSGD/);
    const written = JSON.parse(readFileSync(join(root, 'src', 'data', 'imported-puppies.json'), 'utf8'));
    assert.equal(written.pups[0].priceSGD, 'not-a-number', 'the malformed feed is left untouched, not silently rewritten');
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(store.dir, { recursive: true, force: true });
  }
});

test('sgtLabel is the owner clock, not the UTC date', () => {
  // 22:15 UTC on 13 Nov is 06:15 on 14 Nov in Singapore.
  assert.match(sgtLabel('2026-11-13T22:15:00.000Z'), /14\/11\/2026/);
});

test('boardPayload never carries a private field', () => {
  const payload = boardPayload({
    status: 'failed',
    startedAt: NOW,
    reasons: [{ code: 'source-blocked', message: 'dogsy blocked (403)' }],
    logPath: 'C:\\x\\logs\\imports\\2026-11-13.log',
    repoRoot: 'C:\\x',
  });
  assert.equal(payload.source, 'curious-tails-imports');
  assert.equal(payload.severity, 'error');
  assert.match(payload.body, /source-blocked/);
  assertNoPii(JSON.stringify(payload), 'board payload');
});
