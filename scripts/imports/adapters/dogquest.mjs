// Adapter: dogquest — T8, spec §6.3.
//
// Discover: https://www.dogquest.ie/sitemap.xml, '/listing/<slug>-<uuid>' URLs.
//           (www host directly: the bare host redirects, and redirects would
//           skip the robots check for the target host.)
// Detail:   the Next.js flight payload (self.__next_f.push chunks) carries an
//           `initialListing` object: id, price, min/max_price, location, breed,
//           breed_type, breed_1/2, date_of_birth, male/female_count, images[],
//           puppy_details[] {sex, color, price, microchipNumber,
//           microchipVerificationStatus}, created_at. Product JSON-LD is the
//           price fallback.
// Each chunk is searched on its own, so a change in chunk order doesn't matter;
// the joined payload is only a last resort for an object split across chunks.
import { nextFlightChunks, jsonAfterKey, jsonLdOfType, sitemapEntries, sexCode } from '../lib/html.mjs';
import { newSourceRecord, isoDob, numOrNull, cleanStr } from '../lib/source-record.mjs';

export const SUPPLIER = 'dogquest';
export const ORIGIN = 'https://www.dogquest.ie';
export const SITEMAP_URL = `${ORIGIN}/sitemap.xml`;
const UUID = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i;

export function parseSitemap(xml) {
  return sitemapEntries(xml)
    .map((e) => {
      let u;
      try { u = new URL(e.loc); } catch { return null; }
      if (!/^(www\.)?dogquest\.ie$/.test(u.hostname) || !u.pathname.startsWith('/listing/')) return null;
      const id = UUID.exec(u.pathname)?.[1]?.toLowerCase();
      return id ? { id, url: `${ORIGIN}${u.pathname}`, lastmod: e.lastmod } : null;
    })
    .filter(Boolean);
}

export function findInitialListing(html) {
  const chunks = nextFlightChunks(html);
  for (const c of chunks) {
    if (!c.includes('"initialListing":')) continue;
    const o = jsonAfterKey(c, 'initialListing');
    if (o && o.id) return o;
  }
  const joined = chunks.join('');
  const o = joined.includes('"initialListing":') ? jsonAfterKey(joined, 'initialListing') : null;
  return o && o.id ? o : null;
}

const undef = (v) => (v === '$undefined' ? null : v);

function imageUrl(x) {
  if (!x) return null;
  if (typeof x === 'string') return x;
  return x.url || x.publicUrl || x.src || null;
}

export function parseDetail(html, { url, fetchedAt, listingId = null } = {}) {
  const L = findInitialListing(html);
  const ld = jsonLdOfType(html, 'Product') || {};
  const id = String(listingId ?? L?.id ?? UUID.exec(url || '')?.[1] ?? '');
  const rec = newSourceRecord(SUPPLIER, id, { sourceUrl: url, fetchedAt });
  if (!L) {
    rec.sourceStatus = 'error';
    rec.parseError = 'initialListing not found';
    return rec;
  }

  rec.title = cleanStr(L.title) || cleanStr(ld.name) || '';
  rec.descriptionRaw = cleanStr(undef(L.description)) || cleanStr(ld.description) || '';
  rec.sourcePublishedAt = cleanStr(undef(L.created_at));

  const offer = [].concat(ld.offers || [])[0] || {};
  const min = numOrNull(undef(L.min_price));
  const max = numOrNull(undef(L.max_price));
  rec.priceNumber = numOrNull(undef(L.price)) ?? min ?? numOrNull(offer.price);
  rec.currency = cleanStr(offer.priceCurrency)?.toUpperCase() || null;
  const sym = rec.currency === 'GBP' ? '£' : rec.currency === 'EUR' ? '€' : '';
  rec.priceRaw = min != null && max != null && max > min ? `${sym}${min}-${max}` : rec.priceNumber != null ? `${sym}${rec.priceNumber}` : '';

  rec.breedRaw = cleanStr(undef(L.breed)) || '';
  rec.breed1 = cleanStr(undef(L.breed_1)) || undefined;
  rec.breed2 = cleanStr(undef(L.breed_2)) || undefined;
  rec.breedType = cleanStr(undef(L.breed_type));
  rec.dobRaw = cleanStr(undef(L.date_of_birth));
  rec.dob = isoDob(rec.dobRaw);
  rec.maleCount = numOrNull(undef(L.male_count));
  rec.femaleCount = numOrNull(undef(L.female_count));
  rec.county = cleanStr(undef(L.location));
  rec.countryOfOrigin = null; // not given; dogquest is an Irish marketplace (G10 decides)

  rec.puppies = (L.puppy_details || []).map((p) => {
    const st = cleanStr(undef(p.microchipVerificationStatus));
    return {
      sex: sexCode(p.sex),
      colour: cleanStr(undef(p.color)),
      price: numOrNull(undef(p.price)),
      microchip: cleanStr(undef(p.microchipNumber)),
      chipVerified: st ? st === 'animark_verified' : null,
      status: null,
      chipVerification: st,
    };
  });

  const vet = cleanStr(undef(L.vet_name));
  rec.seller = vet ? { vet } : {};

  const imgs = [
    ...(Array.isArray(L.images) ? L.images.map(imageUrl) : []),
    ...(L.puppy_details || []).map((p) => cleanStr(undef(p.imageUrl))),
  ].filter((u) => u && /^https:\/\//.test(u));
  rec.imageSourceUrls = [...new Set(imgs)];
  return rec;
}

export async function run({ http, store = null, seen = new Set(), now = () => new Date(), maxDetail = Infinity } = {}) {
  const errors = [];
  const r = await http.get(SITEMAP_URL, { kind: 'discover' });
  if (!r.ok || !r.body) {
    errors.push({ stage: 'discover', status: r.status ?? null, blocked: !!r.blocked });
    return { supplier: SUPPLIER, discovered: [], records: [], errors };
  }
  const discovered = parseSitemap(r.body);
  const records = [];
  for (const item of discovered.filter((d) => !seen.has(d.id))) {
    if (records.length >= maxDetail) break;
    const d = await http.get(item.url, { kind: 'detail' });
    const fetchedAt = now().toISOString();
    if (!d.ok || !d.body) {
      errors.push({ stage: 'detail', id: item.id, status: d.status ?? null, blocked: !!d.blocked, robotsDisallowed: !!d.robotsDisallowed });
      if (d.blocked) break;
      continue;
    }
    const rec = parseDetail(d.body, { url: item.url, fetchedAt, listingId: item.id });
    rec.httpLog.push({ url: item.url, status: d.status, at: fetchedAt });
    if (store) rec.snapshotPath = store.snapshot(SUPPLIER, item.id, fetchedAt, d.body, 'html');
    records.push(rec);
  }
  return { supplier: SUPPLIER, discovered: discovered.map((d) => d.id), records, errors };
}
