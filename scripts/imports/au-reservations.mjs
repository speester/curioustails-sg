#!/usr/bin/env node
// K-136: move the Australian reservations onto the imports instrument.
//
//   npm run au:reservations -- migrate [--store dir] [--repo dir] [--actor name] [--json file]
//   npm run au:reservations -- sync    [--store dir] [--repo dir] [--actor name] [--cutover]
//
// migrate  Reads every row of src/data/overseas-puppies.json, runs the gates
//          (lib/au.mjs) and puts each one in the private review queue
//          (review-queue.json, origin "AU"), with its photo staged privately in
//          images-processed/. Writes one `au-migrated` audit line per listing.
//          Changes nothing in the repo and nothing on the site. Re-runnable: an
//          AU item keeps the owner's decision and is refreshed in place; Irish
//          queue items are never touched.
// sync     Publishes what the owner has ruled on, and only that: every AU queue
//          item with an `approve` decision whose gates allow it (and every
//          `reserve` decision) is written to src/data/au-reservations.json with
//          its photo in src/assets/imported-au/. Rejected or unpublished ids are
//          never written. --cutover sets the feed's `cutover` flag, which hides
//          the legacy OverseasPuppies cards in the same build; without it the
//          flag keeps its current value.
//
// Approve, reject, reserve and take down with the existing commands:
//   npm run approve:import -- approve <imp-id>     (then `sync`)
//   npm run unpublish:import -- <imp-id> --reason takedown
// Prices, deposits and buyers are never changed here.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { openStore, REPO_ROOT } from './lib/store.mjs';
import { STATE_FILE, QUEUE_FILE, writeOwnerLog } from './lib/owner.mjs';
import { findLeaks, validateFeed, loadPublicSchema } from './lib/public.mjs';
import {
  AU_ASSET_DIR, AU_FEED_FILE, AU_ORIGIN, AU_RECORDS_FILE, AU_SUPPLIER,
  auIds, evaluateAu, hasLegacyPhoto, legacyPhotoPath, legacyRows, readLegacy, sharedPhotoMap,
} from './lib/au.mjs';

const USAGE = 'usage: au-reservations.mjs <migrate|sync> [--store dir] [--repo dir] [--actor name] [--cutover] [--json file]';

export function parseArgs(argv) {
  const a = { cmd: null, store: null, repo: REPO_ROOT, actor: 'owner:cli', cutover: false, json: null };
  const rest = [...argv];
  a.cmd = rest.shift() || null;
  for (let i = 0; i < rest.length; i++) {
    const k = rest[i];
    if (k === '--store') a.store = rest[++i];
    else if (k === '--repo') a.repo = resolve(rest[++i]);
    else if (k === '--actor') a.actor = rest[++i];
    else if (k === '--json') a.json = rest[++i];
    else if (k === '--cutover') a.cutover = true;
    else if (k === '--help' || k === '-h') a.help = true;
    else throw new Error(`unknown argument: ${k}`);
  }
  return a;
}

const readJsonSafe = (store, name, fallback) => {
  try { return store.readJson(name, fallback); } catch { return fallback; }
};

export function migrate({ store, repoRoot = REPO_ROOT, actor = 'owner:cli', now = new Date() }) {
  const at = new Date(now).toISOString();
  const legacy = readLegacy(repoRoot);
  const rows = legacyRows(legacy);
  const shared = sharedPhotoMap(rows);
  const secret = store.secret();
  const state = readJsonSafe(store, STATE_FILE, {}) || {};
  const decisions = state.decisions || {};
  const queue = readJsonSafe(store, QUEUE_FILE, []);
  const oldById = new Map(queue.filter((q) => q?.origin === AU_ORIGIN).map((q) => [q.id, q]));
  const kept = queue.filter((q) => q?.origin !== AU_ORIGIN);
  const records = {};
  const stageDir = store.path('images-processed');
  mkdirSync(stageDir, { recursive: true });

  const items = [];
  const report = [];
  rows.forEach(({ breed, row }, i) => {
    const listingId = String(row.listingId);
    const identity = auIds(secret, listingId);
    const hasPhoto = hasLegacyPhoto(repoRoot, row.image);
    const out = evaluateAu({ breed, row, syncedAt: legacy.syncedAt, identity, hasPhoto, sharedWith: shared(row), now });
    if (hasPhoto) copyFileSync(legacyPhotoPath(repoRoot, row.image), join(stageDir, `${identity.id}-1.webp`));
    const key = `${AU_SUPPLIER}:${listingId}`;
    records[key] = {
      key, supplier: AU_SUPPLIER, listingId, legacyId: row.id, breed, row, syncedAt: legacy.syncedAt, migratedAt: at,
    };
    const prev = oldById.get(identity.id);
    const decision = decisions[identity.id]?.decision ?? null;
    items.push({
      id: identity.id,
      key,
      origin: AU_ORIGIN,
      disposition: out.decision === 'reject' ? 'reject' : 'review',
      firstFailedAt: prev?.firstFailedAt || at,
      updatedAt: at,
      decision,
      leadOnly: false,
      source: { site: 'AU owner sheet', url: null, supplier: AU_SUPPLIER },
      candidate: out.candidate,
      gates: out.gates,
      failures: out.failures,
      reviewReasons: out.failures.map((f) => `${f.gate}:${f.detail}`),
      approvable: out.approvable,
      blockedBy: out.blockedBy,
      legacy: { id: row.id, listingId },
    });
    report.push({
      n: i + 1, id: identity.id, ref: identity.ref, legacyId: row.id, listingId, breed, label: row.crossLabel ?? row.breedLabel,
      priceSGD: row.price ?? null, depositSGD: row.deposit ?? null, photo: hasPhoto, arrival: out.arrival.month,
      disposition: out.decision, approvable: out.approvable, blockedBy: out.blockedBy, waivable: out.failures.filter((f) => !out.blockedBy.includes(`${f.gate}:${f.detail}`)).map((f) => `${f.gate}:${f.detail}`),
    });
  });

  // A re-run must not lose an AU item the owner already took down or rejected.
  const ruledOut = new Set(Object.entries(decisions).filter(([, d]) => d?.decision === 'reject' || d?.decision === 'unpublish').map(([id]) => id));
  const next = [...kept, ...items.filter((q) => !ruledOut.has(q.id))].sort((a, b) => a.id.localeCompare(b.id));
  store.writeJson(QUEUE_FILE, next);
  store.writeJson(AU_RECORDS_FILE, records);
  for (const r of report) {
    store.audit({ event: 'au-migrated', id: r.id, key: `${AU_SUPPLIER}:${r.listingId}`, actor, at, detail: { approvable: r.approvable, blockedBy: r.blockedBy } });
  }
  writeOwnerLog(repoRoot, `au migrate rows=${report.length} queued=${report.length - ruledOut.size} approvable=${report.filter((r) => r.approvable).length}`, now);
  return { at, syncedAt: legacy.syncedAt, report };
}

export function sync({ store, repoRoot = REPO_ROOT, actor = 'owner:cli', cutover = false, now = new Date() }) {
  const at = new Date(now).toISOString();
  const state = readJsonSafe(store, STATE_FILE, {}) || {};
  const decisions = state.decisions || {};
  const queue = readJsonSafe(store, QUEUE_FILE, []);
  const feedPath = join(repoRoot, AU_FEED_FILE);
  const oldFeed = existsSync(feedPath) ? JSON.parse(readFileSync(feedPath, 'utf8')) : { schema: 1, pups: [] };
  const live = new Map((oldFeed.pups || []).map((p) => [p.id, p]));
  const stageDir = store.path('images-processed');
  const assetDir = join(repoRoot, AU_ASSET_DIR);
  mkdirSync(assetDir, { recursive: true });

  const published = [];
  const pups = [];
  // Already live: kept unless the owner has since rejected or taken it down.
  for (const p of live.values()) {
    const d = decisions[p.id]?.decision;
    if (d === 'reject' || d === 'unpublish') continue;
    pups.push({ ...p, status: d === 'reserve' ? 'reserved' : p.status });
  }
  const remaining = [];
  for (const q of queue) {
    if (q?.origin !== AU_ORIGIN) { remaining.push(q); continue; }
    const d = decisions[q.id]?.decision;
    const ok = (d === 'approve' && q.approvable) || (d === 'reserve' && !(q.failures || []).some((f) => ['G1', 'G3', 'G15'].includes(f.gate)));
    if (!ok || live.has(q.id)) { remaining.push(q); continue; }
    pups.push({ ...q.candidate, status: d === 'reserve' ? 'reserved' : 'published', publishedAt: at, updatedAt: at });
    published.push(q.id);
  }

  const feed = { syncedAt: at, schema: 1, cutover: cutover || oldFeed.cutover === true, pups: pups.sort((a, b) => a.id.localeCompare(b.id)) };
  const v = validateFeed(feed, loadPublicSchema());
  if (!v.valid) throw new Error(`AU feed failed schema: ${v.errors.slice(0, 3).map((e) => `${e.path}: ${e.message}`).join('; ')}`);
  const leaks = findLeaks(feed);
  if (leaks.length) throw new Error(`AU feed leak: ${leaks[0].kind} at ${leaks[0].path}`);

  // Photos first: the feed never points at a file that is not in the repo.
  const keep = new Set(feed.pups.flatMap((p) => p.photos || []));
  for (const name of keep) {
    const to = join(assetDir, name);
    if (existsSync(to)) continue;
    const from = join(stageDir, name);
    if (!existsSync(from)) throw new Error(`photo ${name} is not staged in the private store; run migrate first`);
    copyFileSync(from, to);
  }
  for (const name of readdirSync(assetDir)) {
    if (/^imp-[0-9a-f]{10}-\d+\.webp$/.test(name) && !keep.has(name)) unlinkSync(join(assetDir, name));
  }
  mkdirSync(dirname(feedPath), { recursive: true });
  writeFileSync(feedPath, JSON.stringify(feed, null, 2) + '\n');
  store.writeJson(QUEUE_FILE, remaining);
  for (const id of published) store.audit({ event: 'published', id, actor, at, detail: { origin: AU_ORIGIN } });
  if (feed.cutover && !oldFeed.cutover) store.audit({ event: 'au-cutover', actor, at, detail: { pups: feed.pups.length } });
  writeOwnerLog(repoRoot, `au sync published=${published.length} live=${feed.pups.length} cutover=${feed.cutover}`, now);
  return { published, live: feed.pups.length, cutover: feed.cutover };
}

export function main(argv = process.argv.slice(2)) {
  let a;
  try { a = parseArgs(argv); } catch (e) { console.error(`au-reservations: ${e.message}`); return 2; }
  if (a.help || !['migrate', 'sync'].includes(a.cmd)) { console.error(USAGE); return a.help ? 0 : 2; }
  try {
    const store = openStore(a.store ? { dir: a.store, repoRoot: a.repo } : { repoRoot: a.repo });
    if (a.cmd === 'migrate') {
      const out = migrate({ store, repoRoot: a.repo, actor: a.actor });
      if (a.json) writeFileSync(a.json, JSON.stringify(out, null, 2) + '\n');
      const ok = out.report.filter((r) => r.approvable).length;
      console.log(`au migrate: ${out.report.length} listings queued for review (${ok} approvable, ${out.report.length - ok} need an edit first)`);
    } else {
      const out = sync({ store, repoRoot: a.repo, actor: a.actor, cutover: a.cutover });
      console.log(`au sync: published ${out.published.length}, live ${out.live}, cutover ${out.cutover}`);
    }
    return 0;
  } catch (e) {
    console.error(`au-reservations: ${e?.message || e}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
