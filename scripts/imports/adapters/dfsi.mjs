// Adapter: dogsforsaleireland.ie (dfsi) — T9, spec §6.3. LEAD-ONLY until owner decision D3.
//
// Discover: sitemap_index.xml → every ad_post-sitemap*.xml → only /ad/<slug>/
//           entries whose lastmod is within the last 21 days (spec §6.2).
// Detail:   Product JSON-LD (price, EUR) and the details block: Breed, Date of
//           Birth ("Month D, YYYY"), Number of dogs (Male/Female), Microchips,
//           Registered Seller ID, seller type, posted date; gallery images from
//           wp-content/uploads, collapsed to the largest variant per photo.
// Sold:     a 'sold' token in the title or slug → sourceStatus 'sold'.
// Mode:     IMPORTS_DFSI_MODE=lead-only|auto (default lead-only). lead-only marks
//           every record status 'review' with reason 'lead-only' (gate G14), so no
//           dfsi item can auto-publish (dfsi T&Cs prohibit republishing photos).
import { textOf, jsonLdOfType, sitemapEntries, decodeEntities } from '../lib/html.mjs';
import { newSourceRecord, isoDob, numOrNull, cleanStr, cleanId, forceReview } from '../lib/source-record.mjs';

export const SUPPLIER = 'dfsi';
export const ORIGIN = 'https://dogsforsaleireland.ie';
export const INDEX_URL = `${ORIGIN}/sitemap_index.xml`;
export const WINDOW_DAYS = 21;
export const LEAD_ONLY_REASON = 'lead-only';

export function dfsiMode(env = process.env) {
  return env.IMPORTS_DFSI_MODE === 'auto' ? 'auto' : 'lead-only';
}

// ---- discovery ------------------------------------------------------------------

const within = (lastmod, cutoffMs) => !!lastmod && Date.parse(lastmod) >= cutoffMs;

export function adSitemapsFromIndex(xml, cutoffMs) {
  return sitemapEntries(xml)
    .filter((e) => /\/ad_post-sitemap\d*\.xml$/.test(e.loc) && e.loc.startsWith(ORIGIN))
    .filter((e) => !e.lastmod || within(e.lastmod, cutoffMs))
    .map((e) => e.loc);
}

export function slugOf(url) {
  const m = /^\/ad\/([^/]+)\/?$/.exec(new URL(url).pathname);
  if (!m) return null;
  try { return decodeURIComponent(m[1]); } catch { return m[1]; }
}

export function adsFromSitemap(xml, cutoffMs) {
  return sitemapEntries(xml)
    .filter((e) => within(e.lastmod, cutoffMs))
    .map((e) => {
      let id;
      try { id = new URL(e.loc).hostname === 'dogsforsaleireland.ie' ? slugOf(e.loc) : null; } catch { id = null; }
      return id ? { id, url: e.loc, lastmod: e.lastmod } : null;
    })
    .filter(Boolean);
}

// ---- detail parse ---------------------------------------------------------------

// <span><strong>Label</strong> :</span> value …</div>  →  { label: valueText }
export function labelledFields(html) {
  const out = {};
  const re = /<span>\s*<strong>([\s\S]*?)<\/strong>\s*:\s*<\/span>([\s\S]*?)<\/div>/gi;
  let m;
  while ((m = re.exec(html))) {
    const label = textOf(m[1]).toLowerCase();
    if (label && !(label in out)) out[label] = textOf(m[2].replace(/&nbsp;?/g, ' '));
  }
  return out;
}

const yesNo = (v) => (v == null ? undefined : /^\s*yes/i.test(v) ? true : /^\s*no/i.test(v) ? false : undefined);
const MONTH_DATE = /([A-Z][a-z]+ \d{1,2}, \d{4})/;

export const hasSoldToken = (title, slug) =>
  /\bsold\b/i.test(title || '') || String(slug || '').toLowerCase().split(/[^a-z0-9]+/).includes('sold');

// wp-content/uploads/2026/10/name-760x410.jpg, name-scaled.jpg, name.jpg → one URL per
// photo, preferring -scaled, then the unsuffixed original, then the largest WxH.
export function collapseImageVariants(urls) {
  const best = new Map();
  const rank = (u) => {
    if (/-scaled\.[a-z]+$/i.test(u)) return Number.MAX_SAFE_INTEGER;
    const wh = /-(\d+)x(\d+)\.[a-z]+$/i.exec(u);
    return wh ? Number(wh[1]) * Number(wh[2]) : Number.MAX_SAFE_INTEGER - 1;
  };
  for (const raw of urls) {
    const u = raw.replace(/^\/\//, 'https://');
    const base = u.replace(/-(?:\d+x\d+|scaled)(\.[a-z]+)$/i, '$1');
    const cur = best.get(base);
    if (!cur || rank(u) > rank(cur)) best.set(base, u);
  }
  return [...best.values()];
}

// Gallery only: from the single-page slider to the details block, so logos,
// avatars and "similar ads" thumbnails are excluded.
export function galleryImages(html) {
  const start = html.indexOf('single-page-slider');
  if (start === -1) return [];
  let end = html.indexOf('<strong>Breed</strong>', start);
  if (end === -1) end = start + 40000;
  const region = html.slice(start, end);
  const re = /(?:https?:)?\/\/dogsforsaleireland\.ie\/wp-content\/uploads\/\d{4}\/\d{2}\/[^"'\s)]+?\.(?:jpe?g|png|webp)/gi;
  return collapseImageVariants([...new Set(region.match(re) || [])]);
}

export function parseDetail(html, { url, fetchedAt, listingId = null, mode = dfsiMode() } = {}) {
  const ld = jsonLdOfType(html, 'Product') || {};
  const slug = listingId ?? (url ? slugOf(url) : null) ?? '';
  const rec = newSourceRecord(SUPPLIER, slug, { sourceUrl: url, fetchedAt });
  const f = labelledFields(html);

  rec.title = cleanStr(textOf(/<div class="details-edition">\s*<h1>([\s\S]*?)<\/h1>/i.exec(html)?.[1] || '')) || cleanStr(decodeEntities(ld.name)) || '';
  const descHtml = /<div class="desc-points">([\s\S]*?)(?:<div class="addtoany|<div class="adforest-owner-text"|<div id="map-location")/i.exec(html)?.[1];
  rec.descriptionRaw = cleanStr(textOf(descHtml || '')) || cleanStr(decodeEntities(ld.description)) || '';

  const offer = [].concat(ld.offers || [])[0] || {};
  const priceText = textOf((/<div class="details-price">\s*<h2>([\s\S]*?)<\/h2>/i.exec(html)?.[1] || '').replace(/&nbsp;?/g, ' '));
  rec.priceRaw = priceText || (offer.price != null ? `€${offer.price}` : '');
  rec.priceNumber = numOrNull(offer.price) ?? numOrNull(/[\d,.]+/.exec(priceText)?.[0]?.replace(/,/g, ''));
  rec.currency = cleanStr(offer.priceCurrency)?.toUpperCase() || (/£/.test(priceText) ? 'GBP' : /€/.test(priceText) ? 'EUR' : null);
  rec.negotiable = /negotiable/i.test(priceText);

  rec.breedRaw = f['breed'] || '';
  const parts = rec.breedRaw.split(/\s*,\s*/).filter(Boolean);
  rec.breed1 = parts[0];
  rec.breed2 = parts[1];

  const dobText = f['date of birth'] || '';
  rec.dobRaw = MONTH_DATE.exec(dobText)?.[1] || /\d{1,2}\/\d{1,2}\/\d{4}/.exec(dobText)?.[0] || null;
  rec.dob = isoDob(rec.dobRaw);
  rec.ageRaw = cleanStr(/Current Age:\s*([^()]+?)\s*(?:\(|$)/i.exec(dobText)?.[1]);

  rec.maleCount = numOrNull(f['number of dogs (male)']);
  rec.femaleCount = numOrNull(f['number of dogs (female)']);
  if (rec.maleCount != null && rec.femaleCount == null) rec.femaleCount = 0;
  if (rec.femaleCount != null && rec.maleCount == null) rec.maleCount = 0;

  const colour = cleanStr(f['colour'] || f['color']);
  const chips = [...new Set((f['microchips'] || f['microchip'] || '').match(/\b\d{15}\b/g) || [])];
  rec.puppies = chips.map((c) => ({ sex: null, colour, price: null, microchip: c, chipVerified: null, status: null }));

  rec.town = cleanStr(f['location']);
  rec.countryOfOrigin = cleanStr(f['country of origin']);
  rec.flags = { wormed: yesNo(f['wormed']), vaccinated: yesNo(f['vaccinated']), neutered: yesNo(f['neutered']), ikc: yesNo(f['ikc registered']) };
  for (const k of Object.keys(rec.flags)) if (rec.flags[k] === undefined) delete rec.flags[k];

  const posted = cleanStr(f['date']) || cleanStr(/<span>Posted<\/span>\s*([A-Z][a-z]+ \d{1,2}, \d{4})/.exec(html)?.[1]);
  rec.sourcePublishedAt = isoDob(posted);

  // Seller: registration id and type when the ad shows them (PII minimised, never logged).
  rec.seller = {};
  const regKey = Object.keys(f).find((k) => /registered seller id|seller id|registration (no|number)/.test(k));
  if (regKey && cleanId(f[regKey])) rec.seller.regNo = cleanId(f[regKey]);
  const typeKey = Object.keys(f).find((k) => /seller type/.test(k));
  if (typeKey && cleanStr(f[typeKey])) rec.seller.type = cleanStr(f[typeKey]);
  const nameKey = Object.keys(f).find((k) => /^(seller( name)?|name)$/.test(k));
  if (nameKey && cleanStr(f[nameKey])) rec.seller.name = cleanStr(f[nameKey]);

  rec.imageSourceUrls = galleryImages(html);
  if (!rec.imageSourceUrls.length && ld.image) rec.imageSourceUrls = collapseImageVariants([].concat(ld.image).map((i) => (typeof i === 'string' ? i : i.url)).filter(Boolean));

  if (hasSoldToken(rec.title, slug)) rec.sourceStatus = 'sold';
  if (mode !== 'auto') forceReview(rec, LEAD_ONLY_REASON);
  return rec;
}

// ---- run ------------------------------------------------------------------------

export async function run({ http, store = null, seen = new Set(), now = () => new Date(), maxDetail = Infinity, mode = dfsiMode() } = {}) {
  const errors = [];
  const cutoffMs = now().getTime() - WINDOW_DAYS * 86400000;
  const idx = await http.get(INDEX_URL, { kind: 'discover' });
  if (!idx.ok || !idx.body) {
    errors.push({ stage: 'discover', url: INDEX_URL, status: idx.status ?? null, blocked: !!idx.blocked });
    return { supplier: SUPPLIER, mode, discovered: [], records: [], errors };
  }
  const discovered = [];
  for (const sm of adSitemapsFromIndex(idx.body, cutoffMs)) {
    const r = await http.get(sm, { kind: 'discover' });
    if (!r.ok || !r.body) {
      errors.push({ stage: 'discover', url: sm, status: r.status ?? null, blocked: !!r.blocked });
      if (r.blocked) break;
      continue;
    }
    for (const a of adsFromSitemap(r.body, cutoffMs)) if (!discovered.some((d) => d.id === a.id)) discovered.push(a);
  }

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
    const rec = parseDetail(d.body, { url: item.url, fetchedAt, listingId: item.id, mode });
    rec.httpLog.push({ url: item.url, status: d.status, at: fetchedAt });
    if (store) rec.snapshotPath = store.snapshot(SUPPLIER, item.id, fetchedAt, d.body, 'html');
    records.push(rec);
  }
  return { supplier: SUPPLIER, mode, discovered: discovered.map((d) => d.id), records, errors };
}
