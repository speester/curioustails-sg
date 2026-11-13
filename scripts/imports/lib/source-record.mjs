// SourceRecord factory (spec §2.1). PRIVATE: these objects live only in the
// private store; nothing here is ever written to src/ or logged with seller fields.
import { parseDate, toISODate } from './arrival.mjs';

export const SUPPLIERS = {
  dogsy: 'irishpuppies.ie',
  dogquest: 'dogquest.ie',
  dfsi: 'dogsforsaleireland.ie',
  dogsie: 'puppies.ie',
};

export function newSourceRecord(supplier, listingId, { sourceUrl, fetchedAt }) {
  if (!SUPPLIERS[supplier]) throw new Error(`unknown supplier ${supplier}`);
  const id = String(listingId);
  return {
    key: `${supplier}:${id}`,
    supplier,
    viaSite: SUPPLIERS[supplier],
    listingId: id,
    sourceUrl,
    fetchedAt,
    firstSeenAt: fetchedAt,
    lastSeenAt: fetchedAt,
    sourcePublishedAt: null,
    snapshotPath: null,
    title: '',
    descriptionRaw: '',
    breedRaw: '',
    breed1: undefined,
    breed2: undefined,
    priceRaw: '',
    priceNumber: null,
    currency: null,
    negotiable: false,
    dobRaw: null,
    dob: null, // ISO yyyy-mm-dd parsed from dobRaw
    ageRaw: null,
    maleCount: null,
    femaleCount: null,
    puppies: [],
    county: null,
    town: null,
    countryOfOrigin: null,
    flags: {},
    seller: {},
    imageSourceUrls: [],
    sourceStatus: 'live',
    httpLog: [],
    // Pipeline hints for gates (T13). `status: 'review'` + reasons force the
    // review queue regardless of other gates (lead-only suppliers, owner D3/D4).
    status: null,
    reviewReasons: [],
  };
}

export function isoDob(raw) {
  const d = parseDate(raw);
  return d ? toISODate(d) : null;
}

export const numOrNull = (v) => {
  if (v == null || v === '' || v === '$undefined') return null;
  const n = Number(String(v).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && String(v).match(/\d/) ? n : null;
};

export const cleanStr = (v) => (v == null || v === '$undefined' ? null : String(v).trim() || null);

// Mark a record as review-only (lead-only supplier). Idempotent.
export function forceReview(rec, reason) {
  rec.status = 'review';
  if (!rec.reviewReasons.includes(reason)) rec.reviewReasons.push(reason);
  return rec;
}
