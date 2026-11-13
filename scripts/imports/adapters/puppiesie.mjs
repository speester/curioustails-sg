// Adapter: puppies.ie — T10, spec §6.3. LEAD-ONLY (owner D4).
//
// puppies.ie fronts dogs.ie, and dogs.ie / images.dogs.ie hard-block us
// (Cloudflare 403). So this adapter reads only puppies.ie itself:
//   - the home page's Inertia data-page JSON → props.initialLatestAds
//   - /api/latest-ads?page=1..3 (stops early when canLoadMore is false)
// and stores summaries only: title, breed_name, price, currency_symbol,
// county_name, male/female counts, image_count, published text, url.
// It makes NO request to dogs.ie or images.dogs.ie (the http client's deny list
// is the backstop), keeps no image URL, and sends every record to the review
// queue with gate 'no-photos-source-blocked'.
import { decodeEntities } from '../lib/html.mjs';
import { newSourceRecord, numOrNull, cleanStr, forceReview, fromRelative } from '../lib/source-record.mjs';

export const SUPPLIER = 'dogsie'; // origin platform; viaSite is puppies.ie
export const ORIGIN = 'https://puppies.ie';
export const HOME_URL = `${ORIGIN}/`;
export const apiUrl = (page) => `${ORIGIN}/api/latest-ads?page=${page}`;
export const API_PAGES = 3;
export const REVIEW_REASON = 'no-photos-source-blocked';

const CURRENCY = { '€': 'EUR', '£': 'GBP' };

export function homeAds(html) {
  const m = /data-page="([^"]*)"/.exec(html);
  if (!m) return [];
  try {
    const page = JSON.parse(decodeEntities(m[1]));
    const ads = page?.props?.initialLatestAds;
    return Array.isArray(ads) ? ads : Array.isArray(ads?.data) ? ads.data : [];
  } catch {
    return [];
  }
}

// dogs.ie/sale/<breed>/<slug> → "<breed>/<slug>"
export function listingIdOf(url) {
  try {
    const p = new URL(url).pathname.replace(/^\/sale\//, '').replace(/\/+$/, '');
    return p || null;
  } catch {
    return null;
  }
}

export function toRecord(ad, { fetchedAt, now = new Date(fetchedAt) }) {
  const id = listingIdOf(ad.url);
  if (!id) return null;
  const rec = newSourceRecord(SUPPLIER, id, { sourceUrl: ad.url, fetchedAt });
  const sym = cleanStr(ad.currency_symbol);
  rec.title = cleanStr(ad.title) || '';
  rec.breedRaw = cleanStr(ad.breed_name) || '';
  rec.breed1 = rec.breedRaw || undefined;
  rec.priceNumber = numOrNull(ad.price);
  rec.currency = CURRENCY[sym] ?? null;
  rec.priceRaw = rec.priceNumber != null ? `${sym ?? ''}${rec.priceNumber}` : '';
  rec.county = cleanStr(ad.county_name);
  rec.maleCount = numOrNull(ad.male_count);
  rec.femaleCount = numOrNull(ad.female_count);
  rec.imageCount = numOrNull(ad.image_count); // count only: the images live on blocked images.dogs.ie
  rec.publishedText = cleanStr(ad.published_at_for_humans);
  rec.sourcePublishedAt = fromRelative(rec.publishedText, now);
  rec.imageSourceUrls = [];
  rec.leadOnly = true;
  forceReview(rec, REVIEW_REASON);
  forceReview(rec, 'lead-only');
  return rec;
}

export async function run({ http, seen = new Set(), now = () => new Date() } = {}) {
  const errors = [];
  const ads = [];
  const home = await http.get(HOME_URL, { kind: 'discover' });
  if (home.ok && home.body) ads.push(...homeAds(home.body));
  else errors.push({ stage: 'discover', url: HOME_URL, status: home.status ?? null, blocked: !!home.blocked });

  if (!home.blocked) {
    for (let page = 1; page <= API_PAGES; page++) {
      const r = await http.getJson(apiUrl(page), { kind: 'discover' });
      if (!r.ok || !r.json) {
        errors.push({ stage: 'discover', url: apiUrl(page), status: r.status ?? null, blocked: !!r.blocked });
        break;
      }
      ads.push(...(r.json.ads || r.json.data || []));
      if (r.json.canLoadMore === false) break;
    }
  }

  const fetchedAt = now().toISOString();
  const byId = new Map();
  for (const ad of ads) {
    const rec = toRecord(ad, { fetchedAt, now: now() });
    if (rec && !byId.has(rec.listingId)) byId.set(rec.listingId, rec);
  }
  const discovered = [...byId.keys()];
  const records = [...byId.values()].filter((r) => !seen.has(r.listingId));
  return { supplier: SUPPLIER, discovered, records, errors };
}
