// Imports pipeline: fetch → normalise → dedupe → gates → images → liveness → write
// (spec §1, §6.6; T14). The private store holds every source record, seller
// field, microchip, source URL and snapshot. The repo receives exactly two
// things: src/data/imported-puppies.json and src/assets/imported/*.webp.
//
// Flags:
//   --dry-run         full pipeline, no repo/state/queue/audit/log writes
//   --no-fetch        re-validate the private store; zero network calls
//   --source <name>    dogsy | dogquest | dfsi | puppiesie
//   --max-detail <n>   bound a manual run (default 60)
//
// Nothing publishes with IMPORTS_AUTOPUBLISH unset. A clean item is
// 'auto-ready': it goes to review-queue.json and is absent from the feed.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, appendFileSync, renameSync, unlinkSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createHttp } from './http.mjs';
import { REPO_ROOT } from './store.mjs';
import { publicIds } from './hash.mjs';
import { dedupe, selectPrimary } from './dedupe.mjs';
import { evaluateGates, ageWeeks, isLeadOnly } from './gates.mjs';
import { buildFeed, buildPublicPup, validateFeed, findLeaks, loadPublicSchema, ageLabel, PUP_KEYS } from './public.mjs';
import { downloadPupImages, imageFilename, isImageFilename } from './images.mjs';
import * as dogsy from '../adapters/dogsy.mjs';
import * as dogquest from '../adapters/dogquest.mjs';
import * as dfsi from '../adapters/dfsi.mjs';
import * as puppiesie from '../adapters/puppiesie.mjs';

export const DEFAULT_ADAPTERS = { dogsy, dogquest, dfsi, puppiesie };
export const SOURCE_NAMES = Object.keys(DEFAULT_ADAPTERS);
export const STATE_FILE = 'imports-state.json';
export const LOCK_FILE = 'run.lock';
export const LOCK_STALE_MS = 6 * 3600 * 1000;
export const VALVE_DAYS = 14;
export const VALVE_ITEMS = 20;

export class RunBusyError extends Error {}
export class FeedValidationError extends Error {}

// ---- args ---------------------------------------------------------------------

export function parseArgs(argv = []) {
  const args = { dryRun: false, noFetch: false, source: 'all', maxDetail: 60 };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--dry-run') args.dryRun = true;
    else if (k === '--no-fetch') args.noFetch = true;
    else if (k === '--source') {
      const v = argv[++i];
      if (!v || (v !== 'all' && !SOURCE_NAMES.includes(v))) throw new Error(`unknown source: ${v ?? '(missing)'}`);
      args.source = v;
    } else if (k === '--max-detail') {
      const v = Number(argv[++i]);
      if (!Number.isInteger(v) || v < 0) throw new Error('--max-detail must be a non-negative integer');
      args.maxDetail = v;
    } else if (k === '--help' || k === '-h') args.help = true;
    else throw new Error(`unknown argument: ${k} (known: --dry-run, --no-fetch, --source, --max-detail)`);
  }
  if (args.dryRun && args.noFetch) args.mode = 'validate';
  return args;
}

export const USAGE = [
  'usage: npm run sync:imports -- [--dry-run] [--no-fetch] [--source dogsy|dogquest|dfsi|puppiesie] [--max-detail N]',
  '  --dry-run       run the pipeline without writing the feed, assets, state, queue, audit or log',
  '  --no-fetch      re-validate the private store only; makes zero network requests',
  '  --source NAME   run one source (default: all)',
  '  --max-detail N  cap detail fetches per source (default 60)',
].join('\n');

// ---- small fs helpers ---------------------------------------------------------

function writeJsonAtomic(file, value) {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n');
  try {
    renameSync(tmp, file);
  } catch {
    // Windows can refuse a rename over an existing open file; the copy path is
    // still a complete write, never a partial JSON document.
    writeFileSync(file, readFileSync(tmp));
    try { unlinkSync(tmp); } catch {}
  }
}

function readJsonFile(file, fallback = null) {
  if (!existsSync(file)) return fallback;
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return fallback; }
}

const nowIso = (d) => new Date(d).toISOString();

function acquireLock(store, now) {
  const p = store.path(LOCK_FILE);
  if (existsSync(p)) {
    let old = null;
    try { old = JSON.parse(readFileSync(p, 'utf8')); } catch {}
    const age = old?.at ? new Date(now).getTime() - Date.parse(old.at) : Infinity;
    if (age < LOCK_STALE_MS) throw new RunBusyError('another sync:imports run is in progress (private run.lock is fresh)');
    try { unlinkSync(p); } catch {}
  }
  writeFileSync(p, JSON.stringify({ pid: process.pid, at: nowIso(now) }) + '\n', { flag: 'wx' });
  return p;
}

function releaseLock(p) {
  try { if (existsSync(p)) unlinkSync(p); } catch {}
}

// ---- state --------------------------------------------------------------------

function emptyState() {
  return {
    version: 1,
    firstRunAt: null,
    lastRunAt: null,
    runs: 0,
    records: {},
    suppressed: [],
    published: {},
    supplierStats: {},
  };
}

function readState(store) {
  const s = store.readJson(STATE_FILE, null);
  if (!s || typeof s !== 'object') return emptyState();
  return {
    ...emptyState(),
    ...s,
    records: s.records && typeof s.records === 'object' ? s.records : {},
    suppressed: Array.isArray(s.suppressed) ? s.suppressed : [],
    published: s.published && typeof s.published === 'object' ? s.published : {},
    supplierStats: s.supplierStats && typeof s.supplierStats === 'object' ? s.supplierStats : {},
  };
}

const recordsOf = (state) => Object.values(state.records || {});

function mergeFetchedRecord(state, rec, atIso) {
  const old = state.records[rec.key];
  state.records[rec.key] = {
    ...(old || {}),
    ...rec,
    firstSeenAt: old?.firstSeenAt || rec.firstSeenAt || atIso,
    lastSeenAt: atIso,
    missingRuns: 0,
    // Keep processed local images across a re-fetch; they belong to this listing.
    images: old?.images?.length ? old.images : rec.images || [],
  };
  return state.records[rec.key];
}

function markDiscovered(state, supplier, ids, atIso) {
  const present = new Set(ids || []);
  for (const rec of recordsOf(state)) {
    if (rec.supplier !== supplier) continue;
    if (present.has(rec.listingId)) {
      rec.lastSeenAt = atIso;
      rec.missingRuns = 0;
    } else {
      rec.missingRuns = (rec.missingRuns || 0) + 1;
    }
  }
}

// ---- seen set -----------------------------------------------------------------

export const DETAIL_REFRESH_DAYS = 3;

// Record keys whose public id is currently published (not reserved).
export function publishedRecordKeys(state, secret) {
  const keys = new Set();
  for (const r of recordsOf(state)) {
    if (!r?.supplier || r.listingId == null) continue;
    const { id } = publicIds(secret, r.supplier, r.listingId);
    if (state.published?.[id]?.status === 'published') keys.add(r.key);
  }
  return keys;
}

// The private state is the source of truth for "seen": an id counts as seen
// only if its record is in imports-state.json, so ids marked seen by another
// tool (capture.mjs --seed-seen) can never orphan a listing. A published
// listing whose detail is older than DETAIL_REFRESH_DAYS is dropped from the
// set so the adapter re-fetches it (spec §6.6 liveness).
export function effectiveSeen(state, supplier, ids, now, liveKeys = new Set()) {
  const out = new Set();
  const cutoff = new Date(now).getTime() - DETAIL_REFRESH_DAYS * 86400000;
  for (const id of ids || []) {
    const key = `${supplier}:${id}`;
    const rec = state.records?.[key];
    if (!rec) continue;
    if (liveKeys.has(key)) {
      const fetched = Date.parse(rec.fetchedAt || rec.lastSeenAt || '');
      if (!Number.isFinite(fetched) || fetched < cutoff) continue;
    }
    out.add(id);
  }
  return out;
}

// ---- valve / liveness ---------------------------------------------------------

export function valveActive(state, now, env = process.env) {
  const forced = String(env?.IMPORTS_SAFETY_VALVE ?? '').toLowerCase();
  if (['0', 'false', 'no', 'off'].includes(forced)) return false;
  if (['1', 'true', 'yes', 'on'].includes(forced)) return true;
  if (!state.firstRunAt) return true;
  const ageDays = (new Date(now).getTime() - Date.parse(state.firstRunAt)) / 86400000;
  return ageDays < VALVE_DAYS;
}

// Spec §8 first-run safety valve: 14 days OR the first 20 items per supplier.
// A supplier that has fewer than 20 published items stays auto-ready even after
// the 14-day window; the owner bulk-approves in T16.
export function valveActiveFor(state, supplier, now, env = process.env) {
  const forced = String(env?.IMPORTS_SAFETY_VALVE ?? '').toLowerCase();
  if (['0', 'false', 'no', 'off'].includes(forced)) return false;
  if (valveActive(state, now, env)) return true;
  const published = state.supplierStats?.[supplier]?.published || 0;
  return published < VALVE_ITEMS;
}

export function livenessReasons(group, now, nowMonth) {
  const reasons = [];
  const identity = group.identity || group.primary;
  if ((identity?.missingRuns || 0) >= 2) reasons.push('gone');
  if (['sold', 'reserved', 'gone'].includes(identity?.sourceStatus)) reasons.push('source-status');
  const weeks = ageWeeks(identity, now);
  if (weeks != null && weeks > 20) reasons.push('over-20-weeks');
  const month = group.outcome?.arrival?.month;
  if (month && month < nowMonth) reasons.push('arrival-passed');
  return reasons;
}

// ---- images -------------------------------------------------------------------

const uniqueImages = (list) => {
  const seen = new Set();
  const out = [];
  for (const img of list || []) {
    if (!img?.filename) continue;
    const key = img.dhash || img.filename;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(img);
  }
  return out;
};

// Lead-only records (dfsi, puppies.ie) may join a group so a cross-site
// duplicate never makes a second card, but they never supply public content:
// not the fields, not the photos. A group made only of lead-only records is
// evaluated as-is and G14 holds it in review.
export function contentRecords(group) {
  const publishable = group.records.filter((r) => !isLeadOnly(r));
  return publishable.length ? publishable : group.records;
}
const leadOnlyGroup = (group) => group.records.every(isLeadOnly);

function sourceUrlsOf(group) {
  return [...new Set(contentRecords(group).flatMap((r) => r.imageSourceUrls || []))].filter((u) => /^https?:\/\//i.test(u));
}

// Processed WebPs live in the private images-processed/ until a pup is in the
// public feed. Only feed pups' files are copied into src/assets/imported, so a
// queued or rejected listing's photo never reaches the repo (spec §6.4, T14).
const hasProcessed = (img, { stageDir, assetDir }) =>
  existsSync(join(stageDir, img.filename)) || (!!assetDir && existsSync(join(assetDir, img.filename)));

function stageFromAssets(img, { stageDir, assetDir }) {
  // An older run may have written straight into the repo; adopt that file.
  for (const name of [img.filename, img.cardFilename].filter(Boolean)) {
    const from = join(assetDir, name);
    const to = join(stageDir, name);
    if (!existsSync(to) && existsSync(from)) {
      mkdirSync(stageDir, { recursive: true });
      copyFileSync(from, to);
    }
  }
}

async function ensureGroupImages(group, { http, assetDir, stageDir, sourceDir, dryRun, noFetch }) {
  let images = uniqueImages(contentRecords(group).flatMap((r) => r.images || []));
  if (!dryRun) {
    images = images.filter((img) => hasProcessed(img, { stageDir, assetDir }));
    for (const img of images) stageFromAssets(img, { stageDir, assetDir });
  }
  // Lead-only groups never publish, so their hosts are not asked for photos.
  if (!images.length && http && !noFetch && !leadOnlyGroup(group)) {
    const id = group.id;
    const urls = sourceUrlsOf(group);
    const res = await downloadPupImages(http, urls, {
      id,
      startAt: 1,
      max: 3,
      outDir: dryRun ? null : stageDir,
      sourceDir: dryRun ? null : sourceDir,
    });
    images = uniqueImages(res.images);
    group.imageFailures = (group.imageFailures || 0) + res.failed;
    group.newImages = res.images.length;
  }
  group.images = images.slice(0, 3);
  return group.images;
}

function renameImagesToIdentity(group, { stageDir, dryRun }) {
  const id = group.id;
  const renamed = [];
  group.images.forEach((img, i) => {
    const n = i + 1;
    const want = imageFilename(id, n, false);
    const wantCard = imageFilename(id, n, true);
    if (img.filename === want && (img.cardFilename === wantCard || !img.cardFilename)) {
      renamed.push({ ...img, filename: want, cardFilename: wantCard });
      return;
    }
    const next = { ...img, filename: want, cardFilename: wantCard };
    if (stageDir && !dryRun && existsSync(join(stageDir, img.filename))) {
      try {
        if (img.filename !== want) copyFileSync(join(stageDir, img.filename), join(stageDir, want));
        if (img.cardFilename && img.cardFilename !== wantCard && existsSync(join(stageDir, img.cardFilename))) {
          copyFileSync(join(stageDir, img.cardFilename), join(stageDir, wantCard));
        }
      } catch {
        // Keep the old (still valid, still processed) name rather than failing
        // the whole run for a filesystem copy.
        renamed.push(img);
        return;
      }
    }
    renamed.push(next);
  });
  group.images = renamed;
  return renamed;
}

// A carried feed entry is rebuilt from the public whitelist (never by deleting
// keys) with its age recomputed. Price, arrival and photos stay as published:
// for a reserved pup they are what the buyer agreed to.
export function carryFeedPup(old, now, status = old.status) {
  const pup = Object.fromEntries(PUP_KEYS.map((k) => [k, old[k] ?? null]));
  pup.age = ageLabel({ dob: old.dob, ageRaw: old.age }, now) ?? old.age ?? null;
  pup.status = status;
  pup.updatedAt = new Date(now).toISOString();
  return pup;
}
const carryReservedPup = (old, now) => carryFeedPup(old, now, 'reserved');

const cardOf = (name) => name.replace(/\.webp$/, '-card.webp');

// Make src/assets/imported hold exactly the feed pups' WebPs. Files of feed
// pups (published or reserved) are never removed; any other pipeline-named
// imp-*.webp is pruned. Files that do not match the pipeline pattern are not
// touched. Returns { copied, pruned, missing }.
export function syncPublicAssets(feedPups, { assetDir, stageDir }) {
  const keep = new Set();
  for (const p of feedPups) for (const name of p.photos || []) { keep.add(name); keep.add(cardOf(name)); }
  mkdirSync(assetDir, { recursive: true });
  const copied = [];
  const missing = [];
  for (const name of keep) {
    const to = join(assetDir, name);
    if (existsSync(to)) continue;
    const from = join(stageDir, name);
    if (existsSync(from)) { copyFileSync(from, to); copied.push(name); }
    else if (!name.endsWith('-card.webp')) missing.push(name);
  }
  const pruned = [];
  for (const name of readdirSync(assetDir)) {
    if (!isImageFilename(name) || keep.has(name)) continue;
    try { unlinkSync(join(assetDir, name)); pruned.push(name); } catch {}
  }
  return { copied, pruned, missing };
}

// ---- logs ---------------------------------------------------------------------

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const URL_RE = /https?:\/\/\S+/gi;
const CHIP_RE = /\b\d{15}\b/g;

export function sanitiseLogLine(line) {
  return String(line)
    .replace(URL_RE, '[url]')
    .replace(EMAIL_RE, '[email]')
    .replace(CHIP_RE, '[chip]');
}

function logPathFor(repoRoot, now) {
  const date = new Date(now).toISOString().slice(0, 10);
  return join(repoRoot, 'logs', 'imports', `${date}.log`);
}

// ---- main pipeline ------------------------------------------------------------

/**
 * runPipeline({ args, store, repoRoot, env, now, adapters, createHttpFn, fetchImpl })
 * Returns { exitCode, summary, feed, queue, logPath }.
 */
export async function runPipeline({
  args = parseArgs([]),
  store,
  repoRoot = REPO_ROOT,
  env = process.env,
  now = () => new Date(),
  adapters = DEFAULT_ADAPTERS,
  createHttpFn = createHttp,
  fetchImpl = undefined,
} = {}) {
  if (!store) throw new Error('runPipeline: store is required');
  const started = now();
  const atIso = nowIso(started);
  const nowMonth = atIso.slice(0, 7);
  const state = readState(store);
  const feedPath = join(repoRoot, 'src', 'data', 'imported-puppies.json');
  const assetDir = join(repoRoot, 'src', 'assets', 'imported');
  const existingFeed = readJsonFile(feedPath, null);
  // If the private state is ever lost, the existing public feed is still a
  // publication record. Seed it so a run preserves those pages instead of
  // silently dropping them; liveness then has two runs to prove them gone.
  const beforePublished = { ...state.published };
  for (const p of existingFeed?.pups || []) {
    if (!p?.id) continue;
    beforePublished[p.id] ||= {
      publishedAt: p.publishedAt || atIso,
      firstPublishedAt: p.publishedAt || atIso,
      updatedAt: atIso,
      status: p.status === 'reserved' ? 'reserved' : 'published',
      missingRuns: 0,
      fromFeed: true,
    };
  }

  const summary = {
    at: atIso,
    mode: args.dryRun ? 'dry-run' : args.noFetch ? 'no-fetch' : 'live',
    sources: {},
    discovered: 0,
    fetched: 0,
    records: 0,
    groups: 0,
    merged: 0,
    rejected: 0,
    gates: { pass: 0, review: 0, reject: 0, 'auto-ready': 0, publish: 0 },
    images: { downloaded: 0, failed: 0 },
    feedPups: 0,
    assets: { copied: 0, pruned: 0, missing: 0 },
    errors: [],
    published: 0,
    unpublished: 0,
    valveActive: false,
  };
  const auditEvents = [];

  let lock = null;
  let http = null;
  let lastRequestAt = args.noFetch ? null : store.readJson('http-last.json', {});
  try {
    // Any run that can touch the network also takes the run lock, including a
    // dry run: two overlapping fetches would break the per-host 4 s spacing.
    if (!args.noFetch) lock = acquireLock(store, started);

    const names = args.source === 'all' ? Object.keys(adapters) : [args.source];
    const checkedSuppliers = new Set();

    if (!args.noFetch) {
      http = createHttpFn({
        fetchImpl,
        lastRequestAt: lastRequestAt || {},
        onEvent: (e) => {
          if (e.type === 'alert') summary.errors.push({ stage: 'http', code: e.reason, host: e.host });
        },
      });
    }

    // ---- fetch ----------------------------------------------------------------
    if (!args.noFetch) {
      const liveKeys = publishedRecordKeys(state, store.secret());
      for (const name of names) {
        const adapter = adapters[name];
        if (!adapter) throw new Error(`unknown adapter: ${name}`);
        const seenFile = join('seen', `${name}.json`);
        const seen = effectiveSeen(state, adapter.SUPPLIER || name, store.readJson(seenFile, []), started, liveKeys);
        let out = null;
        try {
          out = await adapter.run({ http, store, seen, now, maxDetail: args.maxDetail });
        } catch (e) {
          summary.errors.push({ stage: 'adapter', source: name, code: e?.name || 'error' });
          summary.sources[name] = { discovered: 0, records: 0, errors: 1, blocked: false };
          continue;
        }
        summary.sources[name] = {
          discovered: out.discovered?.length || 0,
          records: out.records?.length || 0,
          errors: out.errors?.length || 0,
          blocked: !!(out.errors || []).some((e) => e.blocked),
        };
        summary.discovered += summary.sources[name].discovered;
        summary.records += summary.sources[name].records;
        summary.fetched += out.records?.length || 0;
        checkedSuppliers.add(out.supplier || name);

        for (const rec of out.records || []) mergeFetchedRecord(state, rec, atIso);
        markDiscovered(state, out.supplier || name, out.discovered || [], atIso);
        if (!args.dryRun) {
          for (const id of out.records?.map((r) => r.listingId) || []) seen.add(id);
          store.writeJson(seenFile, [...seen].sort());
        }
        for (const e of out.errors || []) {
          summary.errors.push({ stage: e.stage || 'fetch', source: name, status: e.status ?? null, blocked: !!e.blocked });
        }
      }
      // Persist spacing even for a dry run: the next process must still wait 4 s.
      if (http) store.writeJson('http-last.json', { ...(lastRequestAt || {}), ...http.lastRequestAt() });
    }

    // ---- dedupe ---------------------------------------------------------------
    const flat = recordsOf(state);
    const firstPass = dedupe(flat, { suppressed: state.suppressed });
    summary.groups = firstPass.groups.length;
    summary.merged = firstPass.groups.filter((g) => g.merged).length;
    summary.rejected = firstPass.rejected.length;

    const secret = store.secret();
    const stageDir = store.path('images-processed');
    // The content primary is never a lead-only record when the group has any
    // other; dedupe's own primary may be one (most chips wins).
    const pickPrimary = (group) => { group.primary = selectPrimary(contentRecords(group)); };
    const attachImages = (group) => {
      group.primary.images = group.images;
      if (group.identity && group.identity !== group.primary && !isLeadOnly(group.identity)) group.identity.images = group.images;
    };
    for (const group of firstPass.groups) {
      pickPrimary(group);
      const identity = group.identity || group.primary;
      group.id = publicIds(secret, identity.supplier, identity.listingId).id;
    }

    // ---- images (needed before G6, and before the dHash dedupe pass) ----------
    for (const group of firstPass.groups) {
      await ensureGroupImages(group, {
        http,
        assetDir,
        stageDir,
        sourceDir: store.path('images-src'),
        dryRun: args.dryRun,
        noFetch: args.noFetch,
      });
      if (group.newImages) summary.images.downloaded += group.newImages;
      if (group.imageFailures) summary.images.failed += group.imageFailures;
      if (group.images?.length) renameImagesToIdentity(group, { stageDir, dryRun: args.dryRun });
      // Attach to the primary/identity records so the second dedupe pass sees
      // the hashes and the next --no-fetch run can reuse the files.
      attachImages(group);
    }

    // ---- second dedupe by image dHash ----------------------------------------
    const secondPass = dedupe(recordsOf(state), { suppressed: state.suppressed });
    for (const group of secondPass.groups) {
      pickPrimary(group);
      const identity = group.identity || group.primary;
      group.id = publicIds(secret, identity.supplier, identity.listingId).id;
      group.images = uniqueImages(contentRecords(group).flatMap((r) => r.images || [])).slice(0, 3);
      if (group.images.length) renameImagesToIdentity(group, { stageDir, dryRun: args.dryRun });
      attachImages(group);
    }
    summary.groups = secondPass.groups.length;
    summary.merged = secondPass.groups.filter((g) => g.merged).length;
    summary.rejected = secondPass.rejected.length;

    // ---- gates ----------------------------------------------------------------
    const valve = valveActive(state, started, env);
    summary.valveActive = valve;
    const feedPups = [];
    const publishedBySupplier = {};
    const nextPublished = {};
    const queue = [];
    const oldQueue = readJsonFile(store.path('review-queue.json'), []);
    const oldQueueById = new Map((Array.isArray(oldQueue) ? oldQueue : []).map((q) => [q.id, q]));
    const feedById = new Map((existingFeed?.pups || []).map((p) => [p.id, p]));
    const computedIds = new Set();

    for (const group of secondPass.groups) {
      const identity = group.identity || group.primary;
      const ids = publicIds(secret, identity.supplier, identity.listingId);
      const outcome = evaluateGates({
        record: group.primary,
        records: contentRecords(group),
        group,
        images: group.images,
        now: started,
        env,
        identity: ids,
      });
      group.outcome = outcome;
      group.ids = ids;
      group.decision = outcome.decision;
      group.disposition = outcome.disposition;
      computedIds.add(ids.id);
      const failures = outcome.gates.filter((g) => !g.pass);

      const already = beforePublished[ids.id]?.status === 'reserved' ? 'reserved'
        : beforePublished[ids.id]?.status === 'published' ? 'published' : null;
      if (already === 'reserved') {
        // A Curious Tails buyer holds it: never auto-unpublished (spec §6.6),
        // whatever the source now says (it will say sold) or the pup's age.
        group.disposition = 'reserved';
      } else if (already === 'published') {
        // Once live, a listing comes down on a liveness trigger or on a gate
        // that still applies. G4 (>16 weeks) and G5 (arrival month) are intake
        // gates; for a live listing the 20-week and arrival-passed triggers
        // below own age and arrival.
        const blocking = failures.filter((g) => !(g.gate === 'G4' && g.detail === 'age-over-16-weeks') && g.gate !== 'G5');
        const reasons = livenessReasons(group, started, nowMonth);
        if (reasons.length) {
          group.disposition = 'unpublished';
          group.liveness = reasons;
        } else if (blocking.length) {
          group.disposition = 'unpublished';
          group.unpublishGates = blocking.map((g) => g.gate);
        } else {
          group.disposition = 'published';
        }
      } else if (outcome.disposition === 'publish' && valveActiveFor(state, identity.supplier, started, env)) {
        group.disposition = 'auto-ready';
      }
      // Defence in depth for D3/D4: a group with no publishable record never
      // publishes, even if a future gate change let it through.
      if (group.disposition === 'publish' && leadOnlyGroup(group)) group.disposition = 'review';

      const queueItem = (disposition) => {
        const prev = oldQueueById.get(ids.id);
        queue.push({
          id: ids.id,
          key: identity.key,
          disposition,
          firstFailedAt: prev?.firstFailedAt || atIso,
          updatedAt: atIso,
          failures,
          candidate: outcome.candidate,
          source: {
            url: identity.sourceUrl || null,
            key: identity.key,
            supplier: identity.supplier,
          },
          imageCount: group.images.length,
          decision: prev?.decision || null,
          decidedBy: prev?.decidedBy || null,
          decidedAt: prev?.decidedAt || null,
          note: prev?.note || null,
        });
      };

      if (group.disposition === 'publish' || group.disposition === 'published' || group.disposition === 'reserved') {
        const publishedAt = beforePublished[ids.id]?.publishedAt || atIso;
        const status = group.disposition === 'reserved' ? 'reserved' : 'published';
        const old = feedById.get(ids.id);
        const pup = status === 'reserved' && old
          ? carryReservedPup(old, started)
          : buildPublicPup({
            record: group.primary,
            breed: outcome.breed,
            price: outcome.price,
            arrival: outcome.arrival,
            images: group.images,
            identity: ids,
            now: started,
            status,
            publishedAt,
          });
        feedPups.push(pup);
        nextPublished[ids.id] = {
          publishedAt,
          updatedAt: atIso,
          status,
          firstPublishedAt: beforePublished[ids.id]?.firstPublishedAt || publishedAt,
        };
        if (group.disposition === 'publish') {
          auditEvents.push({ event: 'published', id: ids.id, key: identity.key });
          // Valve counter: newly published items only, not every run a pup stays up.
          publishedBySupplier[identity.supplier] = (publishedBySupplier[identity.supplier] || 0) + 1;
        }
        summary.published++;
      } else if (group.disposition === 'auto-ready' || group.disposition === 'review') {
        queueItem(group.disposition);
        auditEvents.push({
          event: group.disposition === 'auto-ready' ? 'auto_ready' : 'gate_fail',
          id: ids.id,
          key: identity.key,
          detail: { gates: failures.map((g) => g.gate) },
        });
      } else if (group.disposition === 'unpublished') {
        auditEvents.push({
          event: 'unpublished',
          id: ids.id,
          key: identity.key,
          detail: { reason: group.liveness ? 'liveness' : 'gate', gates: group.unpublishGates || [], liveness: group.liveness || [] },
        });
        summary.unpublished++;
        // A gate that only needs the owner (review) puts it back in the queue.
        if (!group.liveness && outcome.decision === 'review') queueItem('review');
      } else {
        auditEvents.push({
          event: 'rejected',
          id: ids.id,
          key: identity.key,
          detail: { gates: outcome.rejectReasons.map((r) => r.split(':')[0]) },
        });
      }

      summary.gates.pass += outcome.decision === 'pass' ? 1 : 0;
      summary.gates.review += outcome.decision === 'review' ? 1 : 0;
      summary.gates.reject += outcome.decision === 'reject' ? 1 : 0;
      summary.gates['auto-ready'] += group.disposition === 'auto-ready' ? 1 : 0;
      summary.gates.publish += group.disposition === 'publish' || group.disposition === 'published' ? 1 : 0;
    }

    for (const r of secondPass.rejected) {
      const identity = r.record;
      const ids = publicIds(secret, identity.supplier, identity.listingId);
      auditEvents.push({ event: 'rejected', id: ids.id, key: identity.key, detail: { reason: r.reason } });
    }

    // A feed entry whose source group disappeared is kept only while the
    // private state still recognises it; it is never silently lost on a run.
    for (const [id, p] of feedById) {
      if (computedIds.has(id) || nextPublished[id]) continue;
      const prev = beforePublished[id];
      if (prev && (prev.status === 'reserved' || (prev.missingRuns || 0) < 2)) {
        feedPups.push(carryFeedPup(p, started, prev.status === 'reserved' ? 'reserved' : p.status));
        nextPublished[id] = { ...prev, updatedAt: atIso };
      }
    }

    const feed = buildFeed(feedPups, atIso);
    const validation = validateFeed(feed, loadPublicSchema());
    if (!validation.valid) {
      const first = validation.errors.slice(0, 3).map((e) => `${e.path}: ${e.message}`).join('; ');
      throw new FeedValidationError(`public feed failed schema: ${first}`);
    }
    const leaks = findLeaks(feed);
    if (leaks.length) throw new FeedValidationError(`public feed leak: ${leaks[0].kind} at ${leaks[0].path}`);
    summary.feedPups = feedPups.length;

    // ---- write ----------------------------------------------------------------
    if (!args.dryRun) {
      // Photos first: the feed never points at a WebP that is not in the repo.
      const assets = syncPublicAssets(feedPups, { assetDir, stageDir });
      summary.assets = { copied: assets.copied.length, pruned: assets.pruned.length, missing: assets.missing.length };
      if (assets.missing.length) summary.errors.push({ stage: 'assets', code: 'missing-photo', count: assets.missing.length });
      writeJsonAtomic(feedPath, feed);
      state.firstRunAt = state.firstRunAt || atIso;
      state.lastRunAt = atIso;
      state.runs = (state.runs || 0) + 1;
      state.published = nextPublished;
      for (const name of names) {
        const s = summary.sources[name] || { discovered: 0, records: 0 };
        const prev = state.supplierStats[name] || { discovered: 0, records: 0, published: 0 };
        state.supplierStats[name] = {
          discovered: (prev.discovered || 0) + s.discovered,
          records: (prev.records || 0) + s.records,
          published: (prev.published || 0) + (publishedBySupplier[name] || 0),
        };
      }
      store.writeJson(STATE_FILE, state);
      store.writeJson('review-queue.json', queue.sort((a, b) => a.id.localeCompare(b.id)));
      for (const ev of auditEvents) store.audit(ev);
      // Full detail stays private (spec §6.8): one entry per run, per day.
      const runsFile = join('runs', `${atIso.slice(0, 10)}.json`);
      const dayRuns = store.readJson(runsFile, []);
      store.writeJson(runsFile, [...(Array.isArray(dayRuns) ? dayRuns : []), {
        at: atIso,
        args: { dryRun: !!args.dryRun, noFetch: !!args.noFetch, source: args.source, maxDetail: args.maxDetail },
        summary,
        groups: secondPass.groups.map((g) => ({
          id: g.ids?.id ?? null,
          key: (g.identity || g.primary).key,
          records: g.records.map((r) => r.key),
          matchTypes: g.matchTypes,
          disposition: g.disposition,
          failures: (g.outcome?.gates || []).filter((x) => !x.pass),
          liveness: g.liveness || [],
          images: g.images.map((i) => i.filename),
        })),
        rejected: secondPass.rejected.map((r) => ({ key: r.record.key, reason: r.reason })),
        http: http?.log || [],
      }]);
      const lines = [
        `run start ${atIso} mode=${summary.mode} sources=${names.join(',')}`,
        ...names.map((n) => `source ${n} discovered=${summary.sources[n]?.discovered || 0} records=${summary.sources[n]?.records || 0} errors=${summary.sources[n]?.errors || 0} blocked=${summary.sources[n]?.blocked ? 1 : 0}`),
        `dedupe groups=${summary.groups} merged=${summary.merged} rejected=${summary.rejected}`,
        `gates pass=${summary.gates.pass} review=${summary.gates.review} reject=${summary.gates.reject} auto-ready=${summary.gates['auto-ready']} publish=${summary.gates.publish}`,
        `images downloaded=${summary.images.downloaded} failed=${summary.images.failed}`,
        `assets copied=${summary.assets.copied} pruned=${summary.assets.pruned} missing=${summary.assets.missing}`,
        `ids auto-ready=${queue.filter((q) => q.disposition === 'auto-ready').map((q) => q.id).join(',') || '-'}`,
        `ids review=${queue.filter((q) => q.disposition === 'review').map((q) => q.id).join(',') || '-'}`,
        `ids rejected=${secondPass.rejected.map((r) => publicIds(secret, r.record.supplier, r.record.listingId).id).join(',') || '-'}`,
        `run complete feedPups=${summary.feedPups} published=${summary.published} unpublished=${summary.unpublished}`,
      ].map(sanitiseLogLine);
      const lp = logPathFor(repoRoot, started);
      mkdirSync(dirname(lp), { recursive: true });
      appendFileSync(lp, lines.join('\n') + '\n');
      summary.logPath = lp;
    }

    return { exitCode: 0, summary, feed, queue };
  } finally {
    if (http) store.writeJson('http-last.json', { ...(lastRequestAt || {}), ...http.lastRequestAt() });
    if (lock) releaseLock(lock);
  }
}
