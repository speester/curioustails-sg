// Gates G1–G15 for imported listings (spec §8; T13).
//
// A gate fails with severity 'review' (owner queue) or 'reject' (never shown).
// A listing is publishable only when every gate passes. The safety valve is
// deliberately outside this module: with IMPORTS_AUTOPUBLISH unset a passing
// item gets disposition 'auto-ready' and the orchestrator queues it, never
// writes it to the public feed.
import { computePrice } from './price.mjs';
import { computeArrival, parseAge, parseDate } from './arrival.mjs';
import { resolveBreed } from './breed-map.mjs';
import { loadRules, lookup, findInText, normLabel } from './rules.mjs';
import { chipsOf } from './dedupe.mjs';
import { buildPublicPup, findLeaks, titleFromSlug, PUP_KEYS } from './public.mjs';

export const GATE_ORDER = Array.from({ length: 15 }, (_, i) => `G${i + 1}`);
export const GATE_SEVERITY = {
  G1: 'review', G2: 'review', G3: 'review', G4: 'reject', G5: 'review', G6: 'review',
  G7: 'reject', G8: 'reject', G9: 'review', G10: 'review', G11: 'review', G12: 'review',
  G13: 'reject', G14: 'review', G15: 'reject',
};

// Suppliers whose records may be queued for the owner but never published.
// 'dogsie' is the puppies.ie origin platform id (adapters/puppiesie.mjs).
export const LEAD_ONLY_SUPPLIERS = new Set(['dfsi', 'dogsie']);
export const isLeadOnly = (record) => LEAD_ONLY_SUPPLIERS.has(record?.supplier);

// Review gates an owner may waive with an explicit approval (T16). Every other
// failing gate means the listing is missing something only an edit can supply
// (breed, price, sex count, age, arrival, photo, leak-free public object), or is
// a hard reject, so the queue refuses to approve it.
export const OWNER_WAIVABLE_GATES = new Set(['G9', 'G10', 'G12', 'G14']);
export const isOwnerWaivable = (failure) => OWNER_WAIVABLE_GATES.has(failure?.gate) && failure?.severity !== 'reject';

export function autopublishEnabled(env = process.env) {
  return ['1', 'true', 'yes', 'on'].includes(String(env?.IMPORTS_AUTOPUBLISH ?? '').trim().toLowerCase());
}

const DAY_MS = 86400000;
export function ageWeeks(record, now = new Date()) {
  const dobMs = record?.dob ? Date.parse(`${record.dob}T00:00:00Z`) : parseDate(record?.dobRaw)?.getTime();
  if (Number.isFinite(dobMs)) return (Date.parse(now) - dobMs) / (7 * DAY_MS);
  const age = parseAge(record?.ageRaw);
  if (!age) return null;
  if (age.days != null) return age.days / 7;
  if (age.months != null) return (age.months * 30.4375) / 7;
  return null;
}

const IRISH = /^(ireland|republic of ireland|eire|éire|ie|northern ireland|ni)$/i;
const isIrish = (v) => !v || IRISH.test(String(v).trim());
const soldToken = (v) => /^(sold|reserved|gone|withdrawn)$/i.test(String(v ?? '').trim());

function gate(id, ok, detail, severity = GATE_SEVERITY[id]) {
  return { gate: id, pass: !!ok, severity: ok ? null : severity, detail: ok ? 'ok' : detail };
}

function hdbFor(breed, record) {
  if (!breed?.slug) return null;
  if (breed.crossLabel) return null; // a cross makes no HDB claim
  const hit = lookup('hdb-approved', record?.breedRaw) || lookup('hdb-approved', breed.breedLabel) || lookup('hdb-approved', breed.slug);
  return hit ? true : false;
}

function priceInput(record) {
  if (record?.priceRaw) return record.priceRaw;
  if (record?.priceNumber != null) {
    const sym = record.currency === 'GBP' ? '£' : record.currency === 'EUR' ? '€' : '';
    return `${sym}${record.priceNumber}`;
  }
  return '';
}

function scamFailures(record) {
  const rules = loadRules('scam-patterns');
  const title = String(record?.title ?? '');
  const description = String(record?.descriptionRaw ?? '');
  const fails = [];
  for (const p of rules.entries || []) {
    const text = p.field === 'title' ? title : p.field === 'description' ? description : `${title}\n${description}`;
    let hit = false;
    if (p.regex) hit = new RegExp(p.regex, 'i').test(text);
    else if (p.rule === 'no-letters') hit = !!title.trim() && !/[A-Za-z]/.test(title);
    else if (p.rule === 'min-length') hit = description.trim().length < Number(p.min ?? 0);
    if (hit) fails.push({ id: p.id, severity: p.severity === 'reject' ? 'reject' : 'review' });
  }
  return fails;
}

function specifiedHit(record) {
  const text = `${record?.title ?? ''} ${record?.breedRaw ?? ''} ${record?.descriptionRaw ?? ''}`;
  if (findInText('specified', text).length || lookup('specified', record?.breedRaw)) return true;
  const policy = loadRules('specified').policy_review?.entries || [];
  const n = ` ${normLabel(text)} `;
  return policy.some((p) => n.includes(` ${normLabel(p)} `));
}

/**
 * evaluateGates({ record, records?, group?, images?, now?, env?, duplicateOf?, imageFlags?, identity? })
 * → { gates, decision, disposition, status, reviewReasons, rejectReasons,
 *     breed, price, arrival, images, hdbApproved }
 */
export function evaluateGates({
  record = null, records = null, group = null, images = null, now = new Date(),
  env = process.env, duplicateOf = null, imageFlags = {}, identity = null, publicPup = null,
} = {}) {
  const all = records || group?.records || (record ? [record] : []);
  const primary = record || group?.primary || all[0];
  if (!primary) throw new Error('evaluateGates: no record');
  const processed = images ?? [...new Map(all.flatMap((r) => r.images || []).map((i) => [i.filename, i])).values()];

  const resolved = resolveBreed(primary.breedRaw || '', primary.breed1, primary.breed2);
  const breed = {
    slug: resolved.slug,
    breedLabel: titleFromSlug(resolved.slug),
    crossLabel: resolved.crossLabel,
    hdbApproved: null,
  };
  const price = computePrice({
    priceRaw: priceInput(primary),
    currency: primary.currency,
    puppyPrices: (primary.puppies || []).map((p) => p.price).filter((p) => Number.isFinite(p)),
  });
  const arrival = computeArrival({
    dob: primary.dob || primary.dobRaw,
    ageRaw: primary.ageRaw,
    listingDate: primary.sourcePublishedAt || primary.firstSeenAt,
    today: now,
  });
  const chips = [...new Set(all.flatMap(chipsOf))];
  const statuses = all.flatMap((r) => (r.puppies || []).map((p) => p.status)).filter(Boolean);
  const text = all.map((r) => `${r.title || ''} ${r.breedRaw || ''} ${r.descriptionRaw || ''}`).join('\n');
  const weeks = ageWeeks(primary, now);
  const nowMonth = new Date(now).toISOString().slice(0, 7);
  const gates = [];

  // G1 required fields
  const missing = [];
  if (!breed.slug) missing.push('breed');
  if (price.priceSGD == null) missing.push('price');
  if ((primary.maleCount ?? 0) + (primary.femaleCount ?? 0) < 1) missing.push('sex-count');
  if (!primary.dob && !primary.ageRaw) missing.push('dob-or-age');
  if (!(primary.imageSourceUrls || []).length && !processed.length) missing.push('photo');
  gates.push(gate('G1', missing.length === 0, `missing: ${missing.join(',') || 'none'}`));

  // G2 breed mapped
  gates.push(gate('G2', !!breed.slug, 'unmapped-breed'));

  // G3 price parsed per §3
  gates.push(gate('G3', price.review.length === 0, price.review.join(',') || 'price-ok'));

  // G4 age verifiable: 6–16 weeks pass, <6 or unknown review, >16 reject
  let g4 = true;
  let g4Detail = 'age-ok';
  if (weeks == null) { g4 = false; g4Detail = 'age-unverified'; }
  else if (weeks < 6) { g4 = false; g4Detail = 'age-below-6-weeks'; }
  else if (weeks > 16) { g4 = false; g4Detail = 'age-over-16-weeks'; }
  gates.push(gate('G4', g4, g4Detail, weeks != null && weeks > 16 ? 'reject' : 'review'));

  // G5 arrival derivable, month not already past
  const arrivalOk = !!arrival.month && arrival.month >= nowMonth;
  gates.push(gate('G5', arrivalOk, arrival.month ? `arrival-month-${arrival.month}` : 'arrival-unverified'));

  // G6 photo local, processed, no watermark/stock flag
  const g6Ok = processed.length > 0 && !imageFlags.watermark && !imageFlags.stockReused;
  gates.push(gate('G6', g6Ok, !processed.length ? 'no-local-photo' : imageFlags.watermark ? 'watermark' : 'stock-or-reused-photo'));

  // G7 duplicate policy
  const g7Reject = duplicateOf === 'taken-down' || duplicateOf === 'rejected' || duplicateOf === 'duplicate-of-taken-down';
  gates.push(gate('G7', !g7Reject, g7Reject ? `duplicate-of-${duplicateOf}` : group?.merged ? 'merged-live-duplicate' : 'new', g7Reject ? 'reject' : 'review'));

  // G8 prohibited breed — hard reject
  const prohibited = findInText('prohibited', text);
  gates.push(gate('G8', prohibited.length === 0, `prohibited-breed:${prohibited.join('|') || 'none'}`));

  // G9 specified breed — review only
  gates.push(gate('G9', !specifiedHit(primary), 'specified-breed'));

  // G10 Singapore eligibility: microchip + Irish/NI origin
  let g10 = true;
  let g10Detail = 'chip-and-origin-ok';
  if (!chips.length) { g10 = false; g10Detail = 'no-microchip'; }
  else if (!isIrish(primary.countryOfOrigin)) { g10 = false; g10Detail = 'origin-not-ie-ni'; }
  gates.push(gate('G10', g10, g10Detail));

  // G11 HDB status never fails; it sets the field
  breed.hdbApproved = hdbFor(breed, primary);
  gates.push(gate('G11', true, breed.hdbApproved === true ? 'hdb-approved' : breed.hdbApproved === false ? 'private-housing' : 'unknown'));

  // G12 scam / placeholder
  const scam = scamFailures(primary);
  const scamReject = scam.some((s) => s.severity === 'reject');
  gates.push(gate('G12', scam.length === 0, scam.map((s) => s.id).join(',') || 'clean', scamReject ? 'reject' : 'review'));

  // G13 source status
  const g13Bad = all.some((r) => ['sold', 'reserved', 'gone'].includes(r.sourceStatus)) || statuses.some(soldToken);
  gates.push(gate('G13', !g13Bad, g13Bad ? 'sold-reserved-or-gone' : 'live'));

  // G14 source access / lead-only contracts. dfsi (D3: T&Cs forbid
  // republishing) and puppies.ie (D4: photos only via blocked dogs.ie) are
  // lead-only by supplier id, whatever the adapter mode or env says.
  const leadReasons = [...new Set(all.flatMap((r) => r.reviewReasons || []))];
  let g14 = true;
  let g14Detail = 'source-ok';
  if (all.some((r) => LEAD_ONLY_SUPPLIERS.has(r.supplier))) {
    g14 = false;
    g14Detail = [...new Set(['lead-only', ...leadReasons])].join(',');
  } else if (all.some((r) => r.status === 'review') || leadReasons.length) { g14 = false; g14Detail = leadReasons.join(',') || 'source-review'; }
  else if (all.some((r) => ['blocked', 'error'].includes(r.sourceStatus))) { g14 = false; g14Detail = 'source-error-or-blocked'; }
  gates.push(gate('G14', g14, g14Detail));

  // G15 leak-safe public object
  const candidate = publicPup || buildPublicPup({
    record: primary,
    breed,
    price,
    arrival,
    images: processed,
    identity: identity || { id: 'imp-0000000000', ref: 'CT-IE-000000', sourceHash: '0'.repeat(64) },
    now,
    status: 'published',
  });
  const leaks = findLeaks(candidate);
  const extraKeys = Object.keys(candidate).filter((k) => !PUP_KEYS.includes(k));
  gates.push(gate('G15', leaks.length === 0 && extraKeys.length === 0, leaks.length ? `leak:${leaks[0].kind}` : `extra-key:${extraKeys.join(',')}`));

  const failedReview = gates.filter((g) => !g.pass && g.severity === 'review');
  const failedReject = gates.filter((g) => !g.pass && g.severity === 'reject');
  const decision = failedReject.length ? 'reject' : failedReview.length ? 'review' : 'pass';
  const disposition = decision === 'pass' ? (autopublishEnabled(env) ? 'publish' : 'auto-ready') : decision;

  return {
    gates,
    decision,
    disposition,
    status: disposition,
    reviewReasons: failedReview.map((g) => `${g.gate}:${g.detail}`),
    rejectReasons: failedReject.map((g) => `${g.gate}:${g.detail}`),
    breed,
    price,
    arrival,
    images: processed,
    hdbApproved: breed.hdbApproved,
    candidate,
  };
}
