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

// K-129: suppliers print an empty field as a word ("NULL", "N/A", "-"). Two dogsy
// records stored seller.regNo = "NULL", and the leak gate then matched that word
// against ordinary JS on every built page. An identifier that is only a placeholder
// is no identifier: the field stays absent.
export const PLACEHOLDER_RE = /^(?:null|undefined|\$undefined|none|nil|n\/?a|na|tbc|tba|unknown|not (?:applicable|available|provided)|-+|\.+|0+)$/i;
export const isPlaceholder = (v) => v != null && PLACEHOLDER_RE.test(String(v).trim());
export const cleanId = (v) => {
  const s = cleanStr(v);
  return s && !isPlaceholder(s) ? s : null;
};

// The store-entry gate: drop placeholder seller identifiers from a record before it
// is merged into imports-state.json, whatever adapter produced it. Returns the names
// of the fields it dropped (never their values, which may be private).
export const SELLER_ID_FIELDS = ['regNo', 'vet', 'type'];
export function dropPlaceholderSellerFields(rec) {
  const dropped = [];
  const s = rec?.seller;
  if (!s || typeof s !== 'object') return dropped;
  for (const k of SELLER_ID_FIELDS) {
    if (k in s && (s[k] == null || isPlaceholder(s[k]))) {
      delete s[k];
      dropped.push(k);
    }
  }
  return dropped;
}

// "5 minutes ago" / "3 days ago" / "1 week ago" → ISO at the time of first sight
// (spec §2.1 sourcePublishedAt fallback). Months count as 30 days. null if unparsed.
const UNIT_MS = { second: 1e3, minute: 6e4, hour: 36e5, day: 864e5, week: 6048e5, month: 2592e6, year: 31536e6 };
export function fromRelative(text, now = new Date()) {
  const t = String(text ?? '').trim().toLowerCase();
  if (/^(just now|now|today)$/.test(t)) return now.toISOString();
  if (t === 'yesterday') return new Date(now.getTime() - UNIT_MS.day).toISOString();
  const m = /^(\d+|an?|one)\s+(second|minute|hour|day|week|month|year)s?\s+ago$/.exec(t);
  if (!m) return null;
  const n = /^\d+$/.test(m[1]) ? Number(m[1]) : 1;
  return new Date(now.getTime() - n * UNIT_MS[m[2]]).toISOString();
}

// Mark a record as review-only (lead-only supplier). Idempotent.
export function forceReview(rec, reason) {
  rec.status = 'review';
  if (!rec.reviewReasons.includes(reason)) rec.reviewReasons.push(reason);
  return rec;
}
