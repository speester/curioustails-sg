#!/usr/bin/env node
// Live sample run of the source adapters (T7–T10) — a dev tool, not the T14
// orchestrator. It fetches through the polite client (robots, 4 s per host,
// block detection, dogs.ie deny list), writes ONLY to the private store, and
// publishes nothing:
//   runs/<ts>-capture.json   request log, per-supplier counts, blocked hosts, alerts
//   runs/<ts>-records.json   parsed SourceRecords (private; contain seller fields)
//   seen/<supplier>.json     ids already fetched, so the next run skips them
//   http-last.json           last request time per host, so 4 s spacing holds across runs
//   raw/<supplier>/…         raw detail snapshots (adapters)
//   fixtures/<supplier>/     with --fixture: copies of this run's detail pages
//
//   node scripts/imports/capture.mjs [--supplier dogsy|dogquest|dfsi|puppiesie|all]
//        [--max-detail N] [--fixture] [--seed-seen] [--robots-check]
//
// Console output never includes seller fields or secret.key.
import { pathToFileURL } from 'node:url';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHttp } from './lib/http.mjs';
import { openStore, StoreError } from './lib/store.mjs';
import * as dogsy from './adapters/dogsy.mjs';
import * as dogquest from './adapters/dogquest.mjs';
import * as dfsi from './adapters/dfsi.mjs';
import * as puppiesie from './adapters/puppiesie.mjs';

export const ADAPTERS = { dogsy, dogquest, dfsi, puppiesie };
// A disallowed path per host, requested through the client to prove the skip.
const ROBOTS_CHECKS = { dogsy: 'https://dogsy.ie/dogs-for-sale?breed=poodle' };

function parseArgs(argv) {
  const a = { supplier: 'all', maxDetail: 2, fixture: false, seedSeen: false, robotsCheck: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--supplier') a.supplier = argv[++i];
    else if (k === '--max-detail') a.maxDetail = Number(argv[++i]);
    else if (k === '--fixture') a.fixture = true;
    else if (k === '--seed-seen') a.seedSeen = true;
    else if (k === '--robots-check') a.robotsCheck = true;
    else throw new Error(`unknown argument ${k}`);
  }
  if (a.supplier !== 'all' && !ADAPTERS[a.supplier]) throw new Error(`unknown supplier ${a.supplier}`);
  if (!Number.isInteger(a.maxDetail) || a.maxDetail < 0) throw new Error('--max-detail must be a non-negative integer');
  return a;
}

export async function main(argv = process.argv.slice(2)) {
  let args;
  let store;
  try {
    args = parseArgs(argv);
    store = openStore();
  } catch (e) {
    console.error(`capture: ${e instanceof StoreError ? e.message : e.message}`);
    return 1;
  }
  const startedAt = new Date().toISOString();
  const ts = startedAt.replace(/[:.]/g, '-');
  const alerts = [];
  const lastRequestAt = store.readJson('http-last.json', {});
  const http = createHttp({ lastRequestAt, onEvent: (e) => { if (e.type === 'alert') alerts.push({ host: e.host, level: e.level, reason: e.reason }); } });
  const names = args.supplier === 'all' ? Object.keys(ADAPTERS) : [args.supplier];
  const summary = {};
  const allRecords = [];

  for (const name of names) {
    const ad = ADAPTERS[name];
    const seenFile = join('seen', `${name}.json`);
    const seen = new Set(store.readJson(seenFile, []));
    const out = await ad.run({ http, store, seen, maxDetail: args.seedSeen ? 0 : args.maxDetail });
    const newIds = out.records.map((r) => r.listingId);
    for (const id of args.seedSeen ? out.discovered : newIds) seen.add(id);
    store.writeJson(seenFile, [...seen].sort());
    if (args.fixture) {
      mkdirSync(store.path('fixtures', name), { recursive: true });
      out.records.forEach((r, i) => r.snapshotPath && copyFileSync(store.path(r.snapshotPath), store.path('fixtures', name, `live-${ts}-${i + 1}.html`)));
    }
    if (args.robotsCheck && ROBOTS_CHECKS[name]) {
      const r = await http.get(ROBOTS_CHECKS[name], { kind: 'detail' });
      summary[`${name}:robotsCheck`] = { url: ROBOTS_CHECKS[name], skipped: !!r.robotsDisallowed };
    }
    summary[name] = {
      discovered: out.discovered.length,
      newRecords: newIds.length,
      statuses: out.records.reduce((m, r) => ((m[r.status ?? 'candidate'] = (m[r.status ?? 'candidate'] || 0) + 1), m), {}),
      errors: out.errors,
    };
    allRecords.push(...out.records);
  }

  store.writeJson('http-last.json', { ...lastRequestAt, ...http.lastRequestAt() });
  const report = { startedAt, finishedAt: new Date().toISOString(), args, summary, blockedHosts: http.blockedHosts(), alerts, requestLog: http.log, published: 0 };
  store.writeJson(join('runs', `${ts}-capture.json`), report);
  store.writeJson(join('runs', `${ts}-records.json`), allRecords);

  console.log(`capture: ${names.join(', ')} — ${http.log.length} log entries, nothing published.`);
  for (const [k, v] of Object.entries(summary)) console.log(`  ${k}: ${JSON.stringify(v)}`);
  if (report.blockedHosts.length) console.log(`  blocked hosts: ${JSON.stringify(report.blockedHosts)}`);
  console.log('  at                        host                    gapMs  status outcome     kind      path');
  for (const l of http.log) {
    console.log(`  ${l.at}  ${l.host.padEnd(22)} ${String(l.gapMs ?? '-').padStart(6)}  ${String(l.status ?? '-').padStart(5)}  ${l.outcome.padEnd(11)} ${l.kind.padEnd(9)} ${l.path.slice(0, 70)}`);
  }
  console.log(`  run file: runs/${ts}-capture.json (private store)`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((c) => { process.exitCode = c; }, (e) => { console.error(`capture: ${e?.message || e}`); process.exitCode = 1; });
}
