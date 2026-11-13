// Adapter: dogsy (listings syndicated to irishpuppies.ie) — T7, spec §6.3.
//
// Discover: GET https://dogsy.ie/api/public/listings?page=1..last_page
// Detail:   /dogs-for-sale/<id>-<slug>.html, only for ids not seen before.
// Parse:    Product JSON-LD (price, priceCurrency, sku), the Details block
//           (Date of Birth DD/MM/YYYY, Sex counts, Location, Country of Origin,
//           Wormed/Vaccinated/Neutered/Microchipped), the microchip table
//           (chip, sex, colour, status), the tel: link → seller.phone, and the
//           Alpine ad JSON for photos / negotiable / publish date.
// The API's age_weeks is ignored (it is wrong, often negative).
// robots.txt disallows /dogs-for-sale?* — the http client enforces it.
import { decodeEntities, textOf, jsonLdOfType, sexCounts, sexCode } from '../lib/html.mjs';
import { newSourceRecord, isoDob, numOrNull, cleanStr } from '../lib/source-record.mjs';

export const SUPPLIER = 'dogsy';
export const ORIGIN = 'https://dogsy.ie';
export const listUrl = (page) => `${ORIGIN}/api/public/listings?page=${page}`;
const MAX_PAGES = 30; // safety stop if last_page is ever absurd

// ---- discovery ------------------------------------------------------------------

export function parseListPage(json) {
  const items = (json?.data || [])
    .map((d) => ({
      id: String(d.id),
      url: d.url,
      title: d.title ?? null,
      breed: d.breed ?? null,
      county: d.county ?? null,
      price: d.price ?? null,
      dob: d.dob ?? null,
      publishedText: d.published_at ?? null,
      // age_weeks deliberately dropped (bugged upstream)
    }))
    .filter((d) => d.id && d.url);
  return { items, lastPage: Number(json?.last_page) || 1 };
}

// Only follow detail URLs on dogsy.ie itself.
export function isDetailUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname === 'dogsy.ie' && /^\/dogs-for-sale\/\d+-[^/]+\.html$/.test(u.pathname);
  } catch {
    return false;
  }
}

// ---- detail parse ---------------------------------------------------------------

const TICK = 'M2.44368 7.24575'; // path of the green tick icon; the cross icon differs

function detailsRegion(html) {
  const start = html.search(/>\s*Details\s*<\/h2>/i);
  if (start === -1) return html;
  const end = html.indexOf('id="microchips-info"', start);
  return html.slice(start, end === -1 ? start + 60000 : end);
}

function field(region, label) {
  const re = new RegExp(`<span class="text-gray-5[^"]*">\\s*${label}:\\s*</span>([\\s\\S]*?)</div>`, 'i');
  const m = re.exec(region);
  return m ? textOf(m[1]) : null;
}

function flag(region, label) {
  const re = new RegExp(`<span class="text-black-1[^"]*">\\s*${label}\\b[\\s\\S]*?</span>\\s*<svg([\\s\\S]*?)</svg>`, 'i');
  const m = re.exec(region);
  return m ? m[1].includes(TICK) : undefined;
}

function microchipRows(html) {
  const sec = /id="microchips-info"[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i.exec(html);
  if (!sec) return [];
  return [...sec[1].matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((tr) => {
    const tds = [...tr[0].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((t) => t[1]);
    const chip = /\b(\d{15})\b/.exec(textOf(tds[0] || ''));
    return {
      sex: sexCode(textOf(tds[1] || '')),
      colour: cleanStr(textOf(tds[2] || '')),
      price: null,
      microchip: chip ? chip[1] : null,
      chipVerified: null,
      status: cleanStr(textOf(tds[3] || '')),
    };
  });
}

// The favourite button carries the full ad object as HTML-escaped JSON.
function alpineAd(html) {
  const m = /favouriteButtonComponent\((\{[\s\S]*?\})\)"/.exec(html);
  if (!m) return null;
  try { return JSON.parse(decodeEntities(m[1])); } catch { return null; }
}

export function parseDetail(html, { url, fetchedAt, listingId = null, summary = null } = {}) {
  const ld = jsonLdOfType(html, 'Product') || {};
  const ad = alpineAd(html) || {};
  const id = String(listingId ?? ld.sku ?? ad.id ?? /\/(\d+)-/.exec(url || '')?.[1] ?? '');
  const rec = newSourceRecord(SUPPLIER, id, { sourceUrl: url || ld.url || null, fetchedAt });

  rec.title = cleanStr(ld.name ?? ad.title) || '';
  rec.descriptionRaw = cleanStr(ld.description ?? ad.description) || '';
  rec.sourcePublishedAt = cleanStr(ad.published_at) || null;

  const offer = [].concat(ld.offers || [])[0] || {};
  rec.priceNumber = numOrNull(offer.price ?? ad.price);
  rec.currency = cleanStr(offer.priceCurrency ?? ad.currency)?.toUpperCase() || null;
  rec.priceRaw = rec.priceNumber != null ? `${rec.currency === 'GBP' ? '£' : '€'}${rec.priceNumber}` : '';
  rec.negotiable = Number(ad.price_negotiable) === 1;

  const region = detailsRegion(html);
  const breed = field(region, 'Breed');
  rec.breedRaw = (breed || ad.dog_breeds?.map((b) => b.title).join(', ') || summary?.breed || '').replace(/,\s*$/, '');
  const parts = rec.breedRaw.split(/\s*,\s*/).filter(Boolean);
  rec.breed1 = parts[0];
  rec.breed2 = parts[1];

  rec.dobRaw = field(region, 'Date of Birth') || cleanStr(ad.dob) || cleanStr(summary?.dob);
  rec.dob = isoDob(rec.dobRaw);
  rec.ageRaw = field(region, 'Age');
  Object.assign(rec, sexCounts(field(region, 'Sex')));

  const loc = field(region, 'Location');
  if (loc) {
    const [county, town] = loc.split(/\s*,\s*/);
    rec.county = cleanStr(county);
    rec.town = cleanStr(town);
  } else rec.county = cleanStr(summary?.county);
  rec.countryOfOrigin = field(region, 'Country of Origin');

  rec.flags = {
    wormed: flag(region, 'Wormed'),
    vaccinated: flag(region, 'Vaccinated'),
    neutered: flag(region, 'Neutered'),
    microchipped: flag(region, 'Microchipped'),
    ikc: ad.ikc_registered == null ? undefined : Number(ad.ikc_registered) === 1,
  };
  for (const k of Object.keys(rec.flags)) if (rec.flags[k] === undefined) delete rec.flags[k];

  rec.puppies = microchipRows(html);

  // Seller: name + phone only (spec §2.1 PII rules). Never logged.
  const tel = /href="tel:([+\d\s]+)"/.exec(html);
  const name = [ad.user?.name, ad.user?.surname].filter(Boolean).join(' ').trim();
  rec.seller = {};
  if (name) rec.seller.name = name;
  if (tel) rec.seller.phone = tel[1].replace(/\s+/g, '');
  if (cleanStr(ad.user?.seller_license)) rec.seller.regNo = cleanStr(ad.user.seller_license);

  const photos = (ad.photos || []).map((p) => `${ORIGIN}/storage/${String(p).replace(/^\/+/, '')}`);
  const ldImgs = [].concat(ld.image || []).map(String);
  rec.imageSourceUrls = [...new Set([...photos, ...ldImgs])].filter((u) => /\/storage\/ad-media\//.test(u));
  return rec;
}

// ---- run ------------------------------------------------------------------------

// seen: Set of listing ids already fetched (persisted by the caller).
// Returns new records only; ids beyond maxDetail stay unseen for the next run.
export async function run({ http, store = null, seen = new Set(), now = () => new Date(), maxDetail = Infinity } = {}) {
  const discovered = [];
  const errors = [];
  let lastPage = 1;
  for (let page = 1; page <= Math.min(lastPage, MAX_PAGES); page++) {
    const r = await http.getJson(listUrl(page), { kind: 'discover' });
    if (!r.ok || !r.json) {
      errors.push({ stage: 'discover', page, status: r.status ?? null, blocked: !!r.blocked });
      break;
    }
    const parsed = parseListPage(r.json);
    lastPage = parsed.lastPage;
    discovered.push(...parsed.items);
  }

  const records = [];
  const fresh = discovered.filter((d) => !seen.has(d.id));
  for (const item of fresh) {
    if (records.length >= maxDetail) break;
    if (!isDetailUrl(item.url)) {
      errors.push({ stage: 'detail', id: item.id, reason: 'not a dogsy detail URL' });
      continue;
    }
    const r = await http.get(item.url, { kind: 'detail' });
    const fetchedAt = now().toISOString();
    if (!r.ok || !r.body) {
      errors.push({ stage: 'detail', id: item.id, status: r.status ?? null, blocked: !!r.blocked, robotsDisallowed: !!r.robotsDisallowed });
      if (r.blocked) break;
      continue;
    }
    const rec = parseDetail(r.body, { url: item.url, fetchedAt, listingId: item.id, summary: item });
    rec.httpLog.push({ url: item.url, status: r.status, at: fetchedAt });
    if (store) rec.snapshotPath = store.snapshot(SUPPLIER, item.id, fetchedAt, r.body, 'html');
    records.push(rec);
  }
  return { supplier: SUPPLIER, discovered: discovered.map((d) => d.id), records, errors };
}
