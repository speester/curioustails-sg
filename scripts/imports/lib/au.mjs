// K-136: the Australian reservations on the imports instrument.
//
// The 40 AU listings in src/data/overseas-puppies.json (npm run sync:overseas)
// were live reservation cards taking 50% deposits with no written terms. This
// module brings each one onto the same instrument as the Irish imports:
//   - the same public record shape (scripts/imports/public-schema.json, origin
//     "AU", ref CT-AU-XXXXXX, id imp-<10 hex> from the same HMAC as Ireland);
//   - the same gates G1–G15, adapted only where Australia differs (G10 origin,
//     G12/G13 are not applicable to the owner's own sheet);
//   - the same review queue (review-queue.json in the private store, so the owner
//     approves in the same UI or `npm run approve:import`), the same audit log,
//     and the same takedown (`npm run unpublish:import`, lib/owner.mjs).
//
// Nothing here changes a price, a deposit or a buyer: priceSGD and depositSGD are
// the sheet's MarkUpPrice- and 50%Price- values exactly as recorded. A value the
// data file does not hold is never invented; the gate that needs it fails and the
// listing waits in the queue until the sheet is filled in.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sourceHash, idFromHash } from './hash.mjs';
import { computeArrival, parseAge } from './arrival.mjs';
import { findInText, lookup } from './rules.mjs';
import { GATE_ORDER, GATE_SEVERITY, OWNER_WAIVABLE_GATES } from './gates.mjs';
import { findLeaks, validateFeed, loadPublicSchema, PERKS, PUP_KEYS } from './public.mjs';

export const AU_SUPPLIER = 'au-sheet';
export const AU_ORIGIN = 'AU';
export const AU_LEGACY_FILE = join('src', 'data', 'overseas-puppies.json');
export const AU_LEGACY_PHOTOS = join('src', 'assets', 'overseas');
export const AU_FEED_FILE = join('src', 'data', 'au-reservations.json');
export const AU_ASSET_DIR = join('src', 'assets', 'imported-au');
/** Private-store file for AU source records (kept apart from the Irish state.records). */
export const AU_RECORDS_FILE = 'au-records.json';
/** Older than this, the sheet data needs a fresh sync before a listing goes live (G14). */
export const AU_STALE_DAYS = 14;

const DAY_MS = 86400000;

/** Same HMAC as the Irish ids (hash.mjs), with an AU reference prefix. */
export function auIds(secret, listingId) {
  const hash = sourceHash(secret, AU_SUPPLIER, listingId);
  return { sourceHash: hash, id: idFromHash(hash), ref: 'CT-AU-' + hash.slice(0, 6).toUpperCase() };
}

/** Every row of the legacy AU data file, in file order, with its breed page bucket. */
export function legacyRows(legacy) {
  const rows = [];
  for (const [breed, list] of Object.entries(legacy?.breeds ?? {})) {
    for (const row of list ?? []) rows.push({ breed, row });
  }
  return rows;
}

export function readLegacy(repoRoot) {
  return JSON.parse(readFileSync(join(repoRoot, AU_LEGACY_FILE), 'utf8'));
}

/** Male / Female / Both -> which sexes are listed. The sheet never gives a count. */
export function sexOf(gender) {
  if (gender === 'Female') return { male: 0, female: 1 };
  if (gender === 'Male') return { male: 1, female: 0 };
  if (gender === 'Both') return { male: 1, female: 1 };
  return { male: 0, female: 0 };
}

const gateResult = (id, ok, detail, severity = GATE_SEVERITY[id]) => ({
  gate: id, pass: !!ok, severity: ok ? null : severity, detail: ok ? 'ok' : detail,
});

/** Weeks old today, from the age recorded at the sheet sync plus the time since. */
export function weeksNow(ageRaw, syncedAt, now) {
  const age = parseAge(ageRaw);
  if (!age) return null;
  const atSync = age.days != null ? age.days / 7 : (age.months * 30.4375) / 7;
  return atSync + (Date.parse(now) - Date.parse(syncedAt)) / (7 * DAY_MS);
}

function hdbFor(breed, label, crossLabel) {
  if (!breed || crossLabel) return null; // a cross makes no HDB claim
  return lookup('hdb-approved', label) || lookup('hdb-approved', breed.replace(/-/g, ' ')) ? true : false;
}

/**
 * evaluateAu({ breed, row, syncedAt, identity, hasPhoto, sharedWith, now })
 * → { gates, failures, decision, approvable, arrival, candidate }
 * The candidate is the public record the feed would carry once approved.
 */
export function evaluateAu({ breed, row, syncedAt, identity, hasPhoto, sharedWith = [], now = new Date() }) {
  const nowIso = new Date(now).toISOString();
  const nowMonth = nowIso.slice(0, 7);
  const label = row.crossLabel ?? row.breedLabel ?? '';
  const sex = sexOf(row.gender);
  const price = typeof row.price === 'number' && row.price > 0 ? row.price : null;
  const deposit = typeof row.deposit === 'number' && row.deposit > 0 ? row.deposit : null;
  const arrival = computeArrival({ ageRaw: row.age, listingDate: syncedAt, today: now });
  const weeks = weeksNow(row.age, syncedAt, now);
  const staleDays = Math.floor((Date.parse(now) - Date.parse(syncedAt)) / DAY_MS);
  const hdbApproved = hdbFor(breed, row.breedLabel, row.crossLabel);
  const photo = hasPhoto ? `${identity.id}-1.webp` : null;

  const candidate = {
    id: identity.id,
    ref: identity.ref,
    breed,
    breedLabel: row.breedLabel,
    crossLabel: row.crossLabel ?? null,
    name: null,
    sex,
    colours: [],
    // The sheet's age is as of the last sync; publishing it now would be stale, and
    // a DOB worked back from it would be an estimate shown as a fact. Neither is shown.
    dob: null,
    age: null,
    priceSGD: price ?? 0,
    depositPct: 50,
    depositSGD: deposit ?? 0,
    balanceSGD: price != null && deposit != null ? price - deposit : 0,
    balanceDue: 'before-flight',
    arrivalEstimate: arrival.month ?? '',
    arrivalBasis: arrival.basis,
    imported: true,
    origin: AU_ORIGIN,
    reservation: true,
    perks: [...PERKS],
    photos: photo ? [photo] : [],
    photoAlt: photo ? [`${label} puppy for reservation from Australia`] : [],
    status: 'published',
    publishedAt: nowIso,
    updatedAt: nowIso,
    sourceHash: identity.sourceHash,
    hdbApproved,
    eligibleSG: true,
    specified: false,
  };

  const gates = [];
  // G1 required fields
  const missing = [];
  if (!breed) missing.push('breed');
  if (price == null) missing.push('price');
  if (sex.male + sex.female < 1) missing.push('sex');
  if (!parseAge(row.age)) missing.push('dob-or-age');
  if (!hasPhoto) missing.push('photo');
  gates.push(gateResult('G1', missing.length === 0, `missing: ${missing.join(',')}`));
  // G2 breed mapped to a page
  gates.push(gateResult('G2', !!breed, 'unmapped-breed'));
  // G3 price: the deposit must be exactly the recorded 50%
  const g3 = price != null && deposit != null && deposit * 2 === price;
  gates.push(gateResult('G3', g3, price == null ? 'no-price' : deposit == null ? 'no-deposit' : 'deposit-not-50-percent'));
  // G4 age verifiable today: 6–16 weeks pass, <6 or unknown review, >16 reject
  let g4 = true;
  let g4Detail = 'age-ok';
  if (weeks == null) { g4 = false; g4Detail = 'age-unverified'; }
  else if (weeks < 6) { g4 = false; g4Detail = 'age-below-6-weeks'; }
  else if (weeks > 16) { g4 = false; g4Detail = `age-over-16-weeks (about ${Math.round(weeks)} today)`; }
  gates.push(gateResult('G4', g4, g4Detail, weeks != null && weeks > 16 ? 'reject' : 'review'));
  // G5 arrival derivable from the age, month not already past
  const g5 = arrival.basis !== 'listing-date' && !!arrival.month && arrival.month >= nowMonth;
  gates.push(gateResult('G5', g5, arrival.basis === 'listing-date' ? 'arrival-unverified (no age)' : `arrival-month-${arrival.month}-passed`));
  // G6 a local photo exists
  gates.push(gateResult('G6', hasPhoto, 'no-local-photo'));
  // G7 duplicate: two sheet rows sharing one photo cannot both be the puppy shown
  gates.push(gateResult('G7', sharedWith.length === 0, `shares-photo-with-listing-${sharedWith.join(',')}`, 'review'));
  // G8 prohibited breed, G9 specified breed
  const prohibited = findInText('prohibited', label);
  gates.push(gateResult('G8', prohibited.length === 0, `prohibited-breed:${prohibited.join('|')}`));
  const specified = findInText('specified', label);
  gates.push(gateResult('G9', specified.length === 0, 'specified-breed'));
  // G10 Singapore eligibility: the sheet records no microchip (owner-waivable)
  gates.push(gateResult('G10', false, 'origin-au, microchip-not-recorded'));
  // G11 HDB never fails
  gates.push(gateResult('G11', true, 'ok'));
  gates[gates.length - 1].detail = hdbApproved === true ? 'hdb-approved' : hdbApproved === false ? 'private-housing' : 'unknown';
  // G12 scam patterns and G13 source status apply to scraped listings, not the owner's own sheet
  gates.push({ gate: 'G12', pass: true, severity: null, detail: 'not-applicable-owner-sheet' });
  gates.push({ gate: 'G13', pass: true, severity: null, detail: 'not-recorded-in-sheet' });
  // G14 source freshness (owner-waivable)
  gates.push(gateResult('G14', staleDays <= AU_STALE_DAYS, `au-sheet-synced-${String(syncedAt).slice(0, 10)} (${staleDays} days ago)`));
  // G15 leak-safe public object and schema
  const leaks = findLeaks(candidate);
  const extra = Object.keys(candidate).filter((k) => !PUP_KEYS.includes(k));
  // The schema check runs only on a complete candidate: a missing price, deposit,
  // arrival or photo is G1/G3/G5/G6 (an edit fixes it), never a G15 hard reject.
  const schemaOk = price != null && deposit != null && !!arrival.month && hasPhoto ? validateFeed({ syncedAt: nowIso, schema: 1, pups: [candidate] }, loadPublicSchema()).valid : true;
  gates.push(gateResult('G15', leaks.length === 0 && extra.length === 0 && schemaOk,
    leaks.length ? `leak:${leaks[0].kind}` : extra.length ? `extra-key:${extra.join(',')}` : 'schema-invalid'));

  if (gates.map((g) => g.gate).join() !== GATE_ORDER.join()) throw new Error('evaluateAu: gate order drifted from GATE_ORDER');
  const failures = gates.filter((g) => !g.pass).map(({ gate, severity, detail }) => ({ gate, severity, detail }));
  const rejected = failures.some((f) => f.severity === 'reject');
  const blocked = failures.filter((f) => f.severity === 'reject' || !OWNER_WAIVABLE_GATES.has(f.gate));
  return {
    gates,
    failures,
    decision: rejected ? 'reject' : 'review',
    approvable: blocked.length === 0,
    blockedBy: blocked.map((f) => `${f.gate}:${f.detail}`),
    arrival,
    candidate,
  };
}

/** Group legacy rows by photo so G7 can see two listings sharing one picture. */
export function sharedPhotoMap(rows) {
  const byImage = new Map();
  for (const { row } of rows) {
    if (!row.image) continue;
    if (!byImage.has(row.image)) byImage.set(row.image, []);
    byImage.get(row.image).push(String(row.listingId));
  }
  return (row) => (row.image ? (byImage.get(row.image) ?? []).filter((l) => l !== String(row.listingId)) : []);
}

export const legacyPhotoPath = (repoRoot, file) => (file ? join(repoRoot, AU_LEGACY_PHOTOS, file) : null);
export const hasLegacyPhoto = (repoRoot, file) => !!file && existsSync(legacyPhotoPath(repoRoot, file));
