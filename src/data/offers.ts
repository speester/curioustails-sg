// offers.ts — THE SINGLE PRICE SOURCE, in machine-readable form (golden rule "One price
// source"; Checkpoint 1 item 6 locks the numbers).
//
// WHY THIS FILE EXISTS (2026-09-02): the pipeline had a whole price apparatus —
// MONETIZATION: productized-services, a price locked at Checkpoint 1, and
// `python scripts/refresh_prices.py --check` failing any figure older than 90 days — and
// then shipped every one of those prices as TEXT ONLY. No price, currency or availability
// reached structured data, so the money pages were ineligible for the one rich result they
// actually qualify for. A price now enters the site ONCE, here, and leaves twice: rendered
// by the page and declared by lib/schema.ts. `node scripts/check-schema-rich.mjs` fails a
// page that renders a price without declaring it, and a declaration that does not match
// what the reader sees.
//
// STAMP RULE: every entry carries `sourceHref` and a "read <D Month YYYY>" note, in the
// exact spelling refresh_prices.py greps for. A price with no readable source is a price
// the owner confirmed — say so in `note` and leave sourceHref out; refresh_prices.py only
// re-reads what is stamped.
//
// A DELIBERATE SILENCE IS A VALID ENTRY: when the owner publishes no number, the page says
// "contact us" and this registry carries no row for that route. Never invent a placeholder
// — an invented price is a false claim in machine-readable form, which is the worst kind.

import type { OfferInput, ProductInput, ServiceInput } from '../lib/schema';

export interface OfferRecord {
  /** Canonical route this price belongs to, with the trailing slash. */
  route: string;
  /** What the reader is buying. Rendered by the page and used as Service/Product.name. */
  name: string;
  /** 'service' for a productized service or a local-service money page; 'product' for a
   *  physical/digital SKU (ecommerce, affiliate-review own-product). */
  kind: 'service' | 'product';
  offer: OfferInput;
  description?: string;
  serviceType?: string;
  image?: string | string[];
  sku?: string;
  /** Provenance. `sourceHref` is re-read by refresh_prices.py; `note` records a price the
   *  owner stated directly (read 2 September 2026). */
  sourceHref?: string;
  note?: string;
}

/** Scaffold writes the rows from Checkpoint 1. An EMPTY registry is honest for a site that
 *  publishes no prices; it is a defect only when a page renders a price anyway, which is
 *  exactly what check-schema-rich.mjs measures. */
export const OFFERS: OfferRecord[] = [];

export const offerFor = (route: string): OfferRecord | undefined =>
  OFFERS.find((o) => o.route === route);

/** The shapes lib/schema.ts takes, built from a registry row so a page never re-types a
 *  price into its own props. */
export function serviceFromOffer(rec: OfferRecord): ServiceInput {
  return {
    name: rec.name,
    description: rec.description,
    serviceType: rec.serviceType,
    offer: rec.offer,
  };
}

export function productFromOffer(rec: OfferRecord): ProductInput {
  return {
    name: rec.name,
    description: rec.description,
    image: rec.image,
    sku: rec.sku,
    offer: rec.offer,
  };
}
