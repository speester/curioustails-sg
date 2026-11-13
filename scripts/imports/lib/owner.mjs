// Owner actions for imported listings (spec §6.6, T16).
//
// The only write path from the review UI into the public feed. The pipeline
// never publishes an `auto-ready` item: it needs an explicit approve decision
// written here. Everything stays local:
//   - state.decisions[id]  the owner's ruling, with actor and timestamp
//   - state.suppressed[]   key/chips/hashes that later runs must not relist
//   - src/data/imported-puppies.json   the public feed
//   - src/data/imported-retired.json   only { id, breed }, the redirect source
//   - src/assets/imported/*.webp       the public photos
//
// Lead-only sources (dfsi, puppies.ie) can be seen and rejected, never
// approved: the refusal here is the enforcement, not just a disabled button.
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { REPO_ROOT } from './store.mjs';
import { publicIds } from './hash.mjs';
import { chipsOf, hashesOf } from './dedupe.mjs';
import { LEAD_ONLY_SUPPLIERS, OWNER_WAIVABLE_GATES, GATE_ORDER } from './gates.mjs';

export const STATE_FILE = 'imports-state.json';
export const QUEUE_FILE = 'review-queue.json';
export const FEED_FILE = join('src', 'data', 'imported-puppies.json');
export const RETIRED_FILE = join('src', 'data', 'imported-retired.json');
export const ASSET_DIR = join('src', 'assets', 'imported');
const PUBLIC_ID_RE = /^imp-[0-9a-f]{10}$/;

export class OwnerActionError extends Error {
  constructor(message, status = 409) {
    super(message);
    this.name = 'OwnerActionError';
    this.status = status;
  }
}

const nowIso = (d) => new Date(d).toISOString();
const feedPath = (repoRoot) => join(repoRoot, FEED_FILE);
const retiredPath = (repoRoot) => join(repoRoot, RETIRED_FILE);
const assetDirOf = (repoRoot) => join(repoRoot, ASSET_DIR);

function readJson(file, fallback) {
  if (!existsSync(file)) return fallback;
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return fallback; }
}

function writeJson(file, value) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

function readState(store) {
  const s = store.readJson(STATE_FILE, {}) || {};
  return {
    ...s,
    records: s.records && typeof s.records === 'object' ? s.records : {},
    suppressed: Array.isArray(s.suppressed) ? s.suppressed : [],
    published: s.published && typeof s.published === 'object' ? s.published : {},
    decisions: s.decisions && typeof s.decisions === 'object' ? s.decisions : {},
  };
}

const readQueue = (store) => {
  const q = store.readJson(QUEUE_FILE, []);
  return Array.isArray(q) ? q : [];
};
const readFeed = (repoRoot) => readJson(feedPath(repoRoot), { schema: 1, pups: [] });
const writeFeed = (repoRoot, feed) => writeJson(feedPath(repoRoot), feed);

function recordsById(store, state) {
  const map = new Map();
  for (const rec of Object.values(state.records || {})) {
    if (!rec?.supplier || rec.listingId == null) continue;
    try {
      const { id } = publicIds(store.secret(), rec.supplier, rec.listingId);
      map.set(id, rec);
    } catch { /* an incomplete record cannot carry a public id */ }
  }
  return map;
}

function findRecord(store, state, id, key) {
  if (key && state.records[key]) return state.records[key];
  return recordsById(store, state).get(id) || null;
}

function findQueueItem(store, id) {
  return readQueue(store).find((q) => q?.id === id) || null;
}

function patchQueue(store, id, patch) {
  const q = readQueue(store);
  const i = q.findIndex((item) => item?.id === id);
  if (i === -1) return;
  q[i] = { ...q[i], ...patch };
  store.writeJson(QUEUE_FILE, q);
}

function removeFromQueue(store, id) {
  const q = readQueue(store);
  const next = q.filter((item) => item?.id !== id);
  if (next.length !== q.length) store.writeJson(QUEUE_FILE, next);
}

// A later run must never meet this listing again, whatever source it appears
// on. Key covers an exact relist; chips and dHash cover a cross-posted litter.
function addSuppressed(state, { id, record, reason, actor, at }) {
  const key = record?.key || null;
  const chips = record ? chipsOf(record) : [];
  const hashes = record ? hashesOf(record) : [];
  const already = (state.suppressed || []).some((e) => (
    (key && e?.key === key && e?.reason === reason) ||
    (chips.length && (e?.chips || []).some((c) => chips.includes(String(c)))) ||
    (hashes.length && (e?.hashes || []).some((h) => hashes.includes(String(h))))
  ));
  if (already) return;
  state.suppressed.push({
    id,
    key,
    supplier: record?.supplier ?? null,
    listingId: record?.listingId ?? null,
    chips,
    hashes,
    reason,
    by: actor,
    at,
  });
}

function removeRepoImages(repoRoot, id) {
  const dir = assetDirOf(repoRoot);
  if (!existsSync(dir)) return [];
  mkdirSync(dir, { recursive: true });
  const removed = [];
  for (const name of readdirSync(dir)) {
    if (!name.startsWith(`${id}-`) || !name.endsWith('.webp')) continue;
    try { unlinkSync(join(dir, name)); removed.push(name); } catch { /* locked file: next sync prunes */ }
  }
  return removed;
}

function purgeStageImages(store, id) {
  const dir = store.path('images-processed');
  if (!existsSync(dir)) return [];
  const removed = [];
  for (const name of readdirSync(dir)) {
    if (!name.startsWith(`${id}-`)) continue;
    try { unlinkSync(join(dir, name)); removed.push(name); } catch { /* best effort */ }
  }
  return removed;
}

function addRetired(repoRoot, { id, breed }) {
  if (!id || !breed) return [];
  const list = readJson(retiredPath(repoRoot), []);
  const out = Array.isArray(list) ? list.filter((r) => r && r.id !== id) : [];
  out.push({ id, breed });
  writeJson(retiredPath(repoRoot), out);
  return out;
}

function removePublished(state, id) {
  if (state.published && state.published[id]) delete state.published[id];
}

/**
 * queueView({ store, repoRoot }) → { queue, generatedAt }
 * Owner-facing projection only: the listing, its photos and its gates. Seller
 * contact, microchips, descriptions, county/town and original price never
 * enter this object, so the page and its JSON cannot leak them.
 */
export function queueView({ store, repoRoot = REPO_ROOT } = {}) {
  const state = readState(store);
  const feed = readFeed(repoRoot);
  const live = new Map((feed.pups || []).map((p) => [p.id, p]));
  const records = recordsById(store, state);

  const queue = readQueue(store).map((item) => {
    const id = item?.id;
    const record = (item?.key && state.records[item.key]) || records.get(id) || null;
    const candidate = item?.candidate || {};
    const failures = Array.isArray(item?.failures) ? item.failures : [];
    const failedIds = new Set(failures.map((f) => f?.gate));
    const gates = Array.isArray(item?.gates) && item.gates.length === GATE_ORDER.length
      ? item.gates
      : GATE_ORDER.map((gate) => {
        const f = failures.find((x) => x?.gate === gate);
        return { gate, pass: !failedIds.has(gate), severity: f?.severity ?? null, detail: f?.detail ?? 'ok' };
      });
    const reviewReasons = Array.isArray(item?.reviewReasons) && item.reviewReasons.length
      ? item.reviewReasons
      : failures.map((f) => `${f.gate}:${f.detail}`);
    const supplier = item?.source?.supplier || record?.supplier || null;
    const leadOnly = typeof item?.leadOnly === 'boolean' ? item.leadOnly : LEAD_ONLY_SUPPLIERS.has(supplier);
    const decision = state.decisions?.[id]?.decision || item?.decision || null;
    const blocked = failures.filter((f) => f?.severity === 'reject' || !OWNER_WAIVABLE_GATES.has(f?.gate));
    const livePup = live.get(id) || null;

    return {
      id,
      disposition: item?.disposition || null,
      decision,
      decidedBy: state.decisions?.[id]?.by || item?.decidedBy || null,
      decidedAt: state.decisions?.[id]?.at || item?.decidedAt || null,
      source: {
        // The private listing link is for the owner only; this page never
        // leaves 127.0.0.1.
        site: item?.source?.site || record?.viaSite || null,
        url: item?.source?.url || record?.sourceUrl || null,
        supplier,
      },
      breed: candidate.breed || null,
      breedLabel: candidate.breedLabel || null,
      crossLabel: candidate.crossLabel ?? null,
      sex: candidate.sex || { male: Number(record?.maleCount) || 0, female: Number(record?.femaleCount) || 0 },
      age: candidate.age || null,
      dob: candidate.dob || null,
      priceSGD: candidate.priceSGD ?? null,
      photos: Array.isArray(candidate.photos) ? candidate.photos : [],
      photoAlt: Array.isArray(candidate.photoAlt) ? candidate.photoAlt : [],
      gates,
      failures: failures.map((f) => ({ gate: f.gate, severity: f.severity, detail: f.detail })),
      reviewReasons,
      leadOnly,
      approvable: !leadOnly && blocked.length === 0 && decision !== 'reject' && decision !== 'unpublish',
      live: !!livePup,
      liveStatus: livePup?.status || null,
      firstFailedAt: item?.firstFailedAt || null,
      updatedAt: item?.updatedAt || null,
    };
  });

  return { queue, generatedAt: nowIso(new Date()) };
}

/**
 * approveItem({ store, repoRoot?, id, actor, now? })
 * Writes the owner's approval. The next sync is what publishes.
 */
export function approveItem({ store, id, actor, now = () => new Date() }) {
  if (!PUBLIC_ID_RE.test(String(id))) throw new OwnerActionError(`bad id: ${id}`, 400);
  const at = nowIso(now());
  const state = readState(store);
  const item = findQueueItem(store, id);
  if (!item) throw new OwnerActionError(`not in the review queue: ${id}`, 404);
  const record = findRecord(store, state, id, item.key);
  const supplier = item?.source?.supplier || record?.supplier || null;
  const leadOnly = typeof item.leadOnly === 'boolean' ? item.leadOnly : LEAD_ONLY_SUPPLIERS.has(supplier);
  if (leadOnly) {
    throw new OwnerActionError(`lead-only source (${supplier}): this listing can be reviewed but never approved or published`);
  }
  const failures = Array.isArray(item.failures) ? item.failures : [];
  const blocked = failures.filter((f) => f?.severity === 'reject' || !OWNER_WAIVABLE_GATES.has(f?.gate));
  if (blocked.length) {
    throw new OwnerActionError(`this item needs an edit before it can be approved: ${blocked.map((f) => f.gate).join(',')}`);
  }
  if (state.decisions[id]?.decision === 'approve') return { id, decision: 'approve', already: true };

  state.decisions[id] = { decision: 'approve', by: actor, at };
  store.writeJson(STATE_FILE, state);
  patchQueue(store, id, { decision: 'approve', decidedBy: actor, decidedAt: at });
  store.audit({ event: 'approved', id, key: item.key || record?.key || null, actor, at });
  return { id, decision: 'approve' };
}

/**
 * rejectItem({ store, repoRoot?, id, actor, now? })
 * Keeps the listing out on every later run, even with autopublish on.
 */
export function rejectItem({ store, repoRoot = REPO_ROOT, id, actor, now = () => new Date() }) {
  if (!PUBLIC_ID_RE.test(String(id))) throw new OwnerActionError(`bad id: ${id}`, 400);
  const at = nowIso(now());
  const state = readState(store);
  const item = findQueueItem(store, id);
  const record = findRecord(store, state, id, item?.key);
  if (!item && !record) throw new OwnerActionError(`nothing to reject: ${id}`, 404);

  state.decisions[id] = { decision: 'reject', by: actor, at };
  addSuppressed(state, { id, record, reason: 'rejected', actor, at });

  // A rejection of something already live takes it down in the same action.
  const feed = readFeed(repoRoot);
  const pup = (feed.pups || []).find((p) => p.id === id);
  let removed = false;
  if (pup) {
    feed.pups = feed.pups.filter((p) => p.id !== id);
    writeFeed(repoRoot, feed);
    removeRepoImages(repoRoot, id);
    addRetired(repoRoot, { id, breed: pup.breed });
    removePublished(state, id);
    removed = true;
  }
  store.writeJson(STATE_FILE, state);
  removeFromQueue(store, id);
  store.audit({ event: 'rejected', id, key: item?.key || record?.key || null, actor, at });
  if (removed) store.audit({ event: 'unpublished', id, actor, at, detail: { reason: 'rejected' } });
  return { id, decision: 'reject', removed };
}

/**
 * reserveItem({ store, repoRoot?, id, actor, now? })
 * Marks a live pup reserved in the public feed at once; a later sync keeps it
 * up even when the source says sold (the buyer holds it).
 */
export function reserveItem({ store, repoRoot = REPO_ROOT, id, actor, now = () => new Date() }) {
  if (!PUBLIC_ID_RE.test(String(id))) throw new OwnerActionError(`bad id: ${id}`, 400);
  const at = nowIso(now());
  const feed = readFeed(repoRoot);
  const pup = (feed.pups || []).find((p) => p.id === id);
  if (!pup) throw new OwnerActionError(`not live: ${id} is not in the public feed`, 409);

  if (pup.status !== 'reserved') {
    pup.status = 'reserved';
    pup.updatedAt = at;
    writeFeed(repoRoot, feed);
  }
  const state = readState(store);
  const prev = state.published[id] || {};
  state.published[id] = {
    ...prev,
    publishedAt: prev.publishedAt || pup.publishedAt || at,
    firstPublishedAt: prev.firstPublishedAt || pup.publishedAt || at,
    updatedAt: at,
    status: 'reserved',
  };
  state.decisions[id] = { decision: 'reserve', by: actor, at };
  store.writeJson(STATE_FILE, state);
  store.audit({ event: 'reserved', id, actor, at });
  return { id, status: 'reserved' };
}

/**
 * unpublishItem({ store, repoRoot?, id, reason?, purgeImages?, actor, now? })
 * Removes the feed entry and the public WebPs, adds the {id, breed} redirect
 * record, suppresses any relist and writes the audit line. `takedown` always
 * purges the private processed copies too.
 */
export function unpublishItem({
  store, repoRoot = REPO_ROOT, id, reason = 'owner', purgeImages = false, actor, now = () => new Date(),
}) {
  if (!PUBLIC_ID_RE.test(String(id))) throw new OwnerActionError(`bad id: ${id}`, 400);
  const at = nowIso(now());
  const feed = readFeed(repoRoot);
  const pup = (feed.pups || []).find((p) => p.id === id);
  if (!pup) throw new OwnerActionError(`not live: ${id} is not in the public feed`, 409);

  const state = readState(store);
  const item = findQueueItem(store, id);
  const record = findRecord(store, state, id, item?.key);

  feed.pups = feed.pups.filter((p) => p.id !== id);
  writeFeed(repoRoot, feed);
  removeRepoImages(repoRoot, id);
  const purge = purgeImages || reason === 'takedown';
  const purged = purge ? purgeStageImages(store, id) : [];
  addRetired(repoRoot, { id, breed: pup.breed });

  state.decisions[id] = { decision: 'unpublish', by: actor, at, reason };
  addSuppressed(state, { id, record, reason, actor, at });
  removePublished(state, id);
  store.writeJson(STATE_FILE, state);
  removeFromQueue(store, id);

  const event = reason === 'takedown' ? 'takedown' : 'unpublished';
  store.audit({ event, id, key: item?.key || record?.key || null, actor, at, detail: { reason } });
  if (purged.length) store.audit({ event: 'purged', id, actor, at, detail: { images: purged.length, reason } });
  return { id, reason, purged: purged.length, retired: true };
}

// CLI logs live in the repo's operational log, never in the audit (which is
// private). One line, no seller fields, no URL, no microchip, no phone.
const LOG_URL_RE = /https?:\/\/\S+/gi;
const LOG_EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const LOG_CHIP_RE = /\b\d{15}\b/g;
const LOG_PHONE_RE = /(?<!\d)(?:\+?353[\s-]?|0)8\d(?:[\s-]?\d){7}(?!\d)/g;

export function sanitiseOwnerLogLine(line) {
  return String(line)
    .replace(LOG_URL_RE, '[url]')
    .replace(LOG_EMAIL_RE, '[email]')
    .replace(LOG_PHONE_RE, '[phone]')
    .replace(LOG_CHIP_RE, '[chip]');
}

export function writeOwnerLog(repoRoot, line, now = new Date()) {
  const day = nowIso(now).slice(0, 10);
  const file = join(repoRoot, 'logs', 'imports', `${day}.log`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, sanitiseOwnerLogLine(line) + '\n', { flag: 'a' });
  return file;
}
