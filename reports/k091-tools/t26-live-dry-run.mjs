// K-091 / T26 live dry run harness.
//
// One run of the real pipeline against the live sources with IMPORTS_AUTOPUBLISH
// unset and IMPORTS_DFSI_MODE=lead-only. --dry-run means no repo, state, queue,
// audit or log writes; the only persisted thing the pipeline itself owns is the
// per-host last-request timestamp, which the 4 s politeness rule requires.
//
// Writes a JSON with counts and PUBLIC-ONLY review fields (id, breed, sex, age,
// price, arrival, gate reasons). Never a URL, seller field, county or microchip.
import { writeFileSync } from 'node:fs';
import { openStore } from '../../scripts/imports/lib/store.mjs';
import { createHttp } from '../../scripts/imports/lib/http.mjs';
import { parseArgs, runPipeline } from '../../scripts/imports/lib/pipeline.mjs';

delete process.env.IMPORTS_AUTOPUBLISH;
process.env.IMPORTS_DFSI_MODE = 'lead-only';

const store = openStore();
let httpRef = null;
const createHttpFn = (opts) => {
  httpRef = createHttp(opts);
  return httpRef;
};

const args = parseArgs(['--dry-run', '--max-detail', '3']);
const started = new Date();
const { summary, queue, feed } = await runPipeline({ args, store, createHttpFn, now: () => new Date() });

const hostCounts = {};
const requestLog = httpRef?.log || [];
for (const entry of requestLog) {
  let host = entry.host || 'unknown';
  if (host === 'unknown') {
    try { host = new URL(entry.url).host; } catch { /* keep unknown */ }
  }
  hostCounts[host] = (hostCounts[host] || 0) + 1;
}
const dogsieRequests = requestLog.filter((e) => {
  if (e.host) return /(^|\.)dogs\.ie$/i.test(e.host);
  try { return /(^|\.)dogs\.ie$/i.test(new URL(e.url).host); } catch { return false; }
}).length;

const publicItem = (q) => ({
  id: q.id,
  source: q.source?.supplier || null,
  disposition: q.disposition,
  leadOnly: !!q.leadOnly,
  breed: q.candidate?.breed || null,
  breedLabel: q.candidate?.breedLabel || null,
  crossLabel: q.candidate?.crossLabel ?? null,
  sex: q.candidate?.sex || null,
  age: q.candidate?.age || null,
  priceSGD: q.candidate?.priceSGD ?? null,
  arrivalEstimate: q.candidate?.arrivalEstimate || null,
  photos: Array.isArray(q.candidate?.photos) ? q.candidate.photos.length : 0,
  reviewReasons: q.reviewReasons || [],
});

const out = {
  at: started.toISOString(),
  mode: summary.mode,
  args: { dryRun: true, maxDetail: 3, source: 'all' },
  env: { IMPORTS_AUTOPUBLISH: 'unset', IMPORTS_DFSI_MODE: 'lead-only' },
  summary: {
    sources: summary.sources,
    discovered: summary.discovered,
    records: summary.records,
    groups: summary.groups,
    merged: summary.merged,
    rejected: summary.rejected,
    gates: summary.gates,
    images: summary.images,
    feedPups: summary.feedPups,
    published: summary.published,
    unpublished: summary.unpublished,
    errors: summary.errors,
    valveActive: summary.valveActive,
  },
  network: { requests: requestLog.length, hosts: hostCounts, dogsieRequests },
  feedValidatedPups: (feed?.pups || []).map((p) => ({ id: p.id, breed: p.breed, status: p.status })),
  queue: queue.map(publicItem),
};
writeFileSync('reports/k091-t26-live-dry-run.json', JSON.stringify(out, null, 2) + '\n');
console.log(`dry-run records=${summary.records} gates=${JSON.stringify(summary.gates)} feedPups=${summary.feedPups}`);
console.log(`requests=${requestLog.length} hosts=${JSON.stringify(hostCounts)} dogs.ie=${dogsieRequests}`);
console.log(`queue=${queue.length}`);
