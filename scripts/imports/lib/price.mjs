// Pricing for imported puppies (spec §3; owner D2b: listed number + S$4,000).
// The original priceRaw / priceNumber / currency stay in the private store only.

export const MARKUP_SGD = 4000;
export const MIN_SOURCE = 150;
export const MAX_SOURCE = 4000;
export const PLACEHOLDERS = new Set([1, 12, 123, 1234, 1111, 9999]);
const UNPARSED_RE = /POA|contact|offers|swap/i;

export function detectCurrency(raw) {
  const s = String(raw ?? '');
  if (/£|\bGBP\b|\bstg\b/i.test(s)) return 'GBP';
  if (/€|\bEUR\b|\beuros?\b/i.test(s)) return 'EUR';
  return null;
}

/** parsePrice("€1,200.00 (Negotiable)") → { priceNumber: 1200, currency: 'EUR', negotiable: true } */
export function parsePrice(raw, currencyHint = null) {
  if (typeof raw === 'number') return { priceNumber: Number.isFinite(raw) ? raw : null, currency: currencyHint, negotiable: false };
  const s = String(raw ?? '');
  const negotiable = /negotiable|\bono\b|\bo\.n\.o\b/i.test(s);
  const m = /(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?/.exec(s);
  const priceNumber = m ? Number(m[1].replace(/,/g, '')) + (m[2] ? Number(`0.${m[2]}`) : 0) : null;
  return { priceNumber, currency: detectCurrency(s) ?? currencyHint, negotiable };
}

/**
 * computePrice({ priceRaw, currency?, puppyPrices? })
 * → { priceSGD, depositSGD, balanceSGD, from, negotiable, priceNumber, currency, review: string[] }
 * review is empty when the price can publish; otherwise it lists §3 reasons.
 */
export function computePrice({ priceRaw, currency = null, puppyPrices = [] } = {}) {
  const review = [];
  const parsed = parsePrice(priceRaw, currency);
  let { priceNumber } = parsed;
  const cur = parsed.currency;
  let from = false;

  const pups = (puppyPrices || []).map((p) => (typeof p === 'number' ? p : parsePrice(p).priceNumber)).filter((n) => Number.isFinite(n) && n > 0);
  if (pups.length) {
    const lowest = Math.min(...pups);
    from = new Set(pups).size > 1;
    priceNumber = lowest;
  }

  if (priceNumber == null || (typeof priceRaw === 'string' && UNPARSED_RE.test(priceRaw))) review.push('price-unparsed');
  if (cur === 'GBP') review.push('currency-gbp');
  if (cur == null) review.push('currency-unknown');
  if (priceNumber != null) {
    if (PLACEHOLDERS.has(priceNumber)) review.push('price-placeholder');
    else if (priceNumber < MIN_SOURCE || priceNumber > MAX_SOURCE) review.push('price-out-of-band');
  }

  if (priceNumber == null || review.includes('price-unparsed')) {
    return { priceSGD: null, depositSGD: null, balanceSGD: null, from, negotiable: parsed.negotiable, priceNumber, currency: cur, review };
  }
  const priceSGD = Math.round(priceNumber) + MARKUP_SGD;
  const depositSGD = Math.round(priceSGD * 0.5);
  return { priceSGD, depositSGD, balanceSGD: priceSGD - depositSGD, from, negotiable: parsed.negotiable, priceNumber, currency: cur, review };
}
