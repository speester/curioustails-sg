// K-092 / T25: prove the daily runner's failure and success contract against
// the real pipeline, in temp repos and temp private stores. No network, no
// production write, no deploy.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runDaily } from '../../scripts/imports/run-daily.mjs';
import { openStore } from '../../scripts/imports/lib/store.mjs';
import { cleanRecord, seed, tempRepo, NOW, PII_PATTERNS } from '../../scripts/imports/tests/_pipeline-fixtures.mjs';

const steps = [];
const record = (step, value) => { steps.push({ step, ...value }); console.log(step, JSON.stringify(value)); };
const noPii = (text) => !Object.values(PII_PATTERNS).some((re) => re.test(text));

function tempStore() {
  return openStore({ dir: mkdtempSync(join(tmpdir(), 'k092-t25-store-')) });
}

function artifacts(root, result) {
  const alert = join(root, 'logs', 'imports', 'NEEDS-ATTENTION.md');
  const pointer = join(root, 'NEEDS-ATTENTION.md');
  const recordFile = join(root, 'logs', 'imports', 'last-run.json');
  const log = result.logPath;
  return {
    exitCode: result.exitCode,
    status: result.status,
    reasonCodes: result.classification.reasons.map((r) => r.code),
    alertExists: existsSync(alert),
    pointerExists: existsSync(pointer),
    logExists: existsSync(log),
    lastRunStatus: existsSync(recordFile) ? JSON.parse(readFileSync(recordFile, 'utf8')).status : null,
    lastRunAutopublish: existsSync(recordFile) ? JSON.parse(readFileSync(recordFile, 'utf8')).autopublish : null,
    board: result.board,
    alertText: existsSync(alert) ? readFileSync(alert, 'utf8') : null,
    logText: existsSync(log) ? readFileSync(log, 'utf8') : null,
  };
}

let failed = 0;
try {
  // ---- A. forced blocked host ------------------------------------------------
  {
    const root = tempRepo();
    const store = tempStore();
    const blocked = {
      SUPPLIER: 'dogsy',
      run: async () => ({
        supplier: 'dogsy',
        discovered: ['probe-1'],
        records: [],
        errors: [{ stage: 'fetch', status: 403, blocked: true }],
      }),
    };
    const result = await runDaily({
      argv: ['--source', 'dogsy'],
      repoRoot: root,
      store,
      env: {},
      now: () => NOW,
      adapters: { dogsy: blocked },
    });
    const a = artifacts(root, result);
    record('forced-blocked-host', {
      ...a,
      alertText: undefined,
      logText: undefined,
      hasSourceBlocked: /source-blocked/.test(a.alertText || ''),
      logNoPii: noPii(a.logText || ''),
      alertNoPii: noPii(a.alertText || ''),
    });
    if (a.exitCode !== 1 || a.status !== 'failed' || !a.alertExists || !a.pointerExists || !a.logExists || a.lastRunStatus !== 'failed') failed++;
    if (!/source-blocked/.test(a.alertText || '') || !noPii(a.alertText || '') || !noPii(a.logText || '')) failed++;
    rmSync(root, { recursive: true, force: true });
    rmSync(store.dir, { recursive: true, force: true });
  }

  // ---- B. forced schema violation (malformed carried feed) -------------------
  {
    const root = tempRepo();
    const store = tempStore();
    const id = 'imp-bbbbbbbbbb';
    const badPup = {
      id,
      ref: 'CT-IE-BBBBBB',
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
      sourceHash: 'b'.repeat(64),
      hdbApproved: true,
      eligibleSG: true,
      specified: false,
    };
    writeFileSync(join(root, 'src', 'data', 'imported-puppies.json'), JSON.stringify({ syncedAt: NOW.toISOString(), schema: 1, pups: [badPup] }, null, 2));
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
    const result = await runDaily({
      argv: ['--no-fetch'],
      repoRoot: root,
      store,
      env: { IMPORTS_SAFETY_VALVE: '0' },
      now: () => NOW,
    });
    const a = artifacts(root, result);
    record('forced-schema-violation', {
      ...a,
      alertText: undefined,
      logText: undefined,
      hasFeedValidation: /feed-validation/.test(a.alertText || ''),
      hasPricePath: /priceSGD/.test(a.alertText || ''),
      malformedFeedUntouched: JSON.parse(readFileSync(join(root, 'src', 'data', 'imported-puppies.json'), 'utf8')).pups[0].priceSGD === 'not-a-number',
    });
    if (a.exitCode !== 1 || a.status !== 'failed' || !a.alertExists || !a.logExists || !/feed-validation/.test(a.alertText || '')) failed++;
    rmSync(root, { recursive: true, force: true });
    rmSync(store.dir, { recursive: true, force: true });
  }

  // ---- C. clean success, with IMPORTS_AUTOPUBLISH inherited as 1 ------------
  {
    const root = tempRepo();
    const store = tempStore();
    const rec = cleanRecord(store, { listingId: 'k092-t25-clean' });
    seed(store, [rec]);
    const result = await runDaily({
      argv: ['--no-fetch'],
      repoRoot: root,
      store,
      env: { IMPORTS_AUTOPUBLISH: '1' },
      now: () => NOW,
    });
    const a = artifacts(root, result);
    const feed = JSON.parse(readFileSync(join(root, 'src', 'data', 'imported-puppies.json'), 'utf8'));
    record('clean-success', {
      ...a,
      alertText: undefined,
      logText: undefined,
      queueAutoReady: result.record.queue.autoReady,
      queueReview: result.record.queue.review,
      feedPups: feed.pups.length,
      counts: result.record.counts,
      logNoPii: noPii(a.logText || ''),
    });
    if (a.exitCode !== 0 || a.status !== 'ok' || a.alertExists || a.pointerExists || a.lastRunStatus !== 'ok') failed++;
    if (result.record.autopublish !== false || result.record.autopublishEnvPresent !== true) failed++;
    if (result.record.queue.autoReady !== 1 || feed.pups.length !== 0) failed++;
    rmSync(root, { recursive: true, force: true });
    rmSync(store.dir, { recursive: true, force: true });
  }
} catch (e) {
  record('error', { message: e?.message || String(e) });
  failed++;
}

mkdirSync('reports', { recursive: true });
writeFileSync('reports/k092-t25-proof.json', JSON.stringify({
  generatedAt: new Date().toISOString(),
  pass: failed === 0,
  failures: failed,
  steps,
}, null, 2) + '\n');
console.log('DONE', JSON.stringify({ pass: failed === 0, failures: failed }));
process.exitCode = failed === 0 ? 0 : 1;
