// Dedupe for imported source records (spec §6.5; T11).
//
// Matches are checked in this order. The first hit merges the new record into
// the existing group:
//   1. exact       same supplier + listingId
//   2. microchip   any shared 15-digit chip, across suppliers
//   3. image       dHash Hamming distance <= 6 on any processed photo
//   4. fuzzy       same breed slug, DOB within 2 days (owner/task rule),
//                  same county, price within 10%, and sex counts within 1
//
// A record that matches the private taken-down / rejected registry is never
// re-listed, even if it also matches a live group. That is the G7 rule.
//
// Merge policy: the primary record is the one with the most microchips, then
// the most photos, then the earliest firstSeenAt. The public identity is the
// earliest-seen record, so a later richer duplicate cannot change an existing
// public id on its own.
import { resolveBreed } from './breed-map.mjs';

export const MAX_DOB_DAYS = 2;
export const MAX_PRICE_DELTA = 0.10;
export const MAX_HASH_DISTANCE = 6;
export const MAX_COUNT_DELTA = 1;

const CHIP_RE = /\b\d{15}\b/g;
const DAY_MS = 86400000;

export function chipsOf(record) {
  const found = new Set();
  for (const pup of record?.puppies || []) {
    for (const m of String(pup?.microchip ?? '').match(CHIP_RE) || []) found.add(m);
  }
  return [...found];
}

export function hashesOf(record) {
  const out = new Set();
  for (const h of record?.imageHashes || []) if (h) out.add(String(h).toLowerCase());
  for (const img of record?.images || []) if (img?.dhash) out.add(String(img.dhash).toLowerCase());
  return [...out];
}

export function photoCount(record) {
  return Math.max((record?.images || []).length, (record?.imageSourceUrls || []).length, record?.imageCount || 0);
}

export function hammingHex(a, b) {
  const x = String(a ?? '').toLowerCase();
  const y = String(b ?? '').toLowerCase();
  if (!/^[0-9a-f]+$/.test(x) || !/^[0-9a-f]+$/.test(y)) return Infinity;
  // dHashes are 64-bit; pad so a shorter hex string is compared as a number.
  const width = Math.max(x.length, y.length);
  const n = BigInt('0x' + x.padStart(width, '0')) ^ BigInt('0x' + y.padStart(width, '0'));
  let bits = 0;
  let v = n;
  while (v) { bits += Number(v & 1n); v >>= 1n; }
  return bits;
}

export const hashesMatch = (a, b, max = MAX_HASH_DISTANCE) => hammingHex(a, b) <= max;

export function dateMs(value) {
  if (!value) return null;
  const t = Date.parse(String(value));
  return Number.isNaN(t) ? null : t;
}

export function sameDobWithin(a, b, days = MAX_DOB_DAYS) {
  const da = dateMs(a?.dob);
  const db = dateMs(b?.dob);
  if (da == null || db == null) return false;
  return Math.abs(da - db) <= days * DAY_MS;
}

const normCounty = (v) => String(v ?? '').toLowerCase().replace(/[^a-z]+/g, ' ').trim();

export function sameCounty(a, b) {
  const ca = normCounty(a?.county);
  const cb = normCounty(b?.county);
  return !!ca && ca === cb;
}

export function priceOf(record) {
  const n = record?.priceNumber;
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function priceWithin(a, b, pct = MAX_PRICE_DELTA) {
  const pa = priceOf(a);
  const pb = priceOf(b);
  if (pa == null || pb == null) return false;
  return Math.abs(pa - pb) / Math.min(pa, pb) <= pct + 1e-9;
}

function countsWithin(a, b, delta = MAX_COUNT_DELTA) {
  for (const k of ['maleCount', 'femaleCount']) {
    if (a?.[k] == null || b?.[k] == null) continue;
    if (Math.abs(Number(a[k]) - Number(b[k])) > delta) return false;
  }
  return true;
}

export function breedSlugOf(record) {
  return resolveBreed(record?.breedRaw || '', record?.breed1, record?.breed2)?.slug ?? null;
}

export function fuzzyMatch(a, b, opts = {}) {
  const slugA = breedSlugOf(a);
  const slugB = breedSlugOf(b);
  if (!slugA || slugA !== slugB) return false;
  if (!sameDobWithin(a, b, opts.maxDobDays ?? MAX_DOB_DAYS)) return false;
  if (!sameCounty(a, b)) return false;
  if (!priceWithin(a, b, opts.maxPriceDelta ?? MAX_PRICE_DELTA)) return false;
  return countsWithin(a, b, opts.maxCountDelta ?? MAX_COUNT_DELTA);
}

export function matchType(a, b, opts = {}) {
  if (a?.key && b?.key && a.key === b.key) return 'exact';
  const chipsB = new Set(chipsOf(b));
  if (chipsOf(a).some((c) => chipsB.has(c))) return 'microchip';
  const hashesB = hashesOf(b);
  if (hashesOf(a).some((h) => hashesB.some((h2) => hashesMatch(h, h2, opts.maxHashDistance ?? MAX_HASH_DISTANCE)))) return 'image';
  if (fuzzyMatch(a, b, opts)) return 'fuzzy';
  return null;
}

function earliest(records) {
  return [...records].sort((a, b) => {
    const fa = dateMs(a.firstSeenAt) ?? Infinity;
    const fb = dateMs(b.firstSeenAt) ?? Infinity;
    if (fa !== fb) return fa - fb;
    return String(a.key).localeCompare(String(b.key));
  })[0];
}

export function selectPrimary(records) {
  return [...records].sort((a, b) => {
    const ca = chipsOf(a).length;
    const cb = chipsOf(b).length;
    if (ca !== cb) return cb - ca;
    const pa = photoCount(a);
    const pb = photoCount(b);
    if (pa !== pb) return pb - pa;
    const fa = dateMs(a.firstSeenAt) ?? Infinity;
    const fb = dateMs(b.firstSeenAt) ?? Infinity;
    if (fa !== fb) return fa - fb;
    return String(a.key).localeCompare(String(b.key));
  })[0];
}

// Suppressed entries may be stored as { key }, { chips: [] }, { hashes: [] },
// or a full SourceRecord. Normalise all of them once.
export function normaliseSuppressed(entries = []) {
  const keys = new Set();
  const chips = new Set();
  const hashes = new Set();
  for (const e of entries) {
    if (!e) continue;
    if (e.key) keys.add(e.key);
    if (e.listingId && e.supplier) keys.add(`${e.supplier}:${e.listingId}`);
    for (const c of e.chips || []) chips.add(String(c));
    for (const h of e.hashes || []) hashes.add(String(h).toLowerCase());
    if (e.microchip) chips.add(String(e.microchip));
    if (e.dhash) hashes.add(String(e.dhash).toLowerCase());
  }
  return { keys, chips, hashes };
}

export function suppressedReason(record, registry) {
  const r = registry?.keys ? registry : normaliseSuppressed(registry);
  if (record?.key && r.keys.has(record.key)) return 'duplicate-of-taken-down';
  if (chipsOf(record).some((c) => r.chips.has(c))) return 'duplicate-of-taken-down';
  if (hashesOf(record).some((h) => [...r.hashes].some((h2) => hashesMatch(h, h2)))) return 'duplicate-of-taken-down';
  return null;
}

/**
 * dedupe(records, { suppressed, ...thresholds })
 * → { groups, rejected }
 *
 * groups: [{ records, primary, identity, chips, hashes, matchTypes, merged }]
 * rejected: [{ record, reason, match }]
 */
export function dedupe(records = [], opts = {}) {
  const registry = normaliseSuppressed(opts.suppressed || []);
  const rejected = [];
  const groups = [];

  for (const record of records) {
    if (!record) continue;
    const suppressed = suppressedReason(record, registry);
    if (suppressed) {
      rejected.push({ record, reason: suppressed, match: record.key || chipsOf(record)[0] || hashesOf(record)[0] || null });
      continue;
    }

    // Ask every existing group, then take the strongest match type. Checking
    // group-by-group and stopping at the first hit would let an earlier fuzzy
    // group win over a later exact-key group.
    const priority = { exact: 0, microchip: 1, image: 2, fuzzy: 3 };
    let match = null;
    for (const group of groups) {
      for (const other of group.records) {
        const type = matchType(record, other, opts);
        if (!type) continue;
        if (!match || priority[type] < priority[match.type]) match = { group, type, other };
        if (match.type === 'exact') break;
      }
      if (match?.type === 'exact') break;
    }

    if (match) {
      match.group.records.push(record);
      match.group.matchTypes.add(match.type);
      continue;
    }
    groups.push({ records: [record], matchTypes: new Set() });
  }

  for (const g of groups) {
    g.primary = selectPrimary(g.records);
    g.identity = earliest(g.records);
    g.chips = [...new Set(g.records.flatMap(chipsOf))];
    g.hashes = [...new Set(g.records.flatMap(hashesOf))];
    g.merged = g.records.length > 1;
    g.matchTypes = [...g.matchTypes];
  }

  return { groups, rejected };
}
