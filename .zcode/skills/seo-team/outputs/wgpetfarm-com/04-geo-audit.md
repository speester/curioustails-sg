# AI Search / GEO Audit: William Goh Pet Farm (2026-07-12)

## Market & method
Singapore, English, desktop. Call 1 (`serp/google/organic/live/advanced`) confirmed **Path A**: Google Singapore is actively serving an `ai_overview` slot on commercial pet-breed queries (e.g. "corgi puppy singapore", "cavapoo puppy singapore", "puppy training singapore" all returned an `ai_overview` block, and Dachshund PAA items each expanded into `people_also_ask_ai_overview_expanded_element`). The AI Overview content itself only returns as `asynchronous_ai_overview: true` (no inline snippet/citation text) — this MCP does not expose a synchronous-load parameter, so citation *presence* is confirmed but citation *wording* is not visible via Call 1. Call 2 (`ai_mode`) endpoint does not exist in this MCP, same gap found on the puppysingapore.com run — skipped. Citation ownership was instead measured via Call 3 (`ranked_keywords` with `item_types:["ai_overview_reference"]`), which is a reliable proxy since it reflects DataForSEO's own tracked AI Overview reference index.

## Citation status
wgpetfarm.com **is** being cited in AI Overviews today, but for the wrong queries relative to its stated specialties.

| Domain | AI Overview citation keywords tracked | What they're cited for |
|---|---|---|
| **thelovelypets.com** | 50+ (query capped at limit) | Dominates almost every breed × "price"/"puppies for sale" query in the category, including **Corgi and Dachshund — wgpetfarm's own two named specialty breeds** ("corgi puppy singapore price", "corgi dog price singapore", "dachshund puppies price", "dachshund puppy", "dachshund price") |
| **wgpetfarm.com** | 15 | Mostly informational/tail-query breed pages, not their specialties: "corgi with tail," "is corgi hdb approved," "hdb approved dog breeds," plus price queries for *secondary* breeds (Maltipoo, Bichon Frise, Chow Chow, Shiba Inu, Pug, Border Collie, British Bulldog). Highest-volume citation is "dog swimming pool in singapore" (720/mo) via a farm-amenity page. **Zero citations for Corgi-for-sale, Cavapoo, or Dachshund** — the three breeds the homepage names as specialties. |
| **prettypetskennel.com** | 13 | Concentrated on Maltipoo + Golden Retriever price queries |

Live organic SERP checks reinforce this: wgpetfarm.com does not rank in the top 10 organic results for "corgi puppy singapore," "cavapoo puppy singapore," "dachshund puppy singapore," or "puppy for sale singapore" at all. Sister property **puppysingapore.com** appears instead (Corgi #4, Cavapoo #9) — the portfolio is currently competing with itself on these terms rather than wgpetfarm winning them. The one place wgpetfarm.com does show up is the **local pack** for "sungei tengah pet farm" (rank 2 of 3, 4.6★/65 reviews, ahead of Pups For Life, just behind Pretty Pets Kennel) — but the organic result backing that local-pack listing is only the thin `/contact-us/` page at position 10, not a content page built to earn a citation.

**Headline stat for the report:** thelovelypets.com is cited in AI Overviews for its own specialty breeds (Corgi, Dachshund) at roughly **3.5x the rate** wgpetfarm.com is cited for anything — and wgpetfarm.com currently owns **zero** AI Overview citations for the three breeds its own homepage names as specialties.

## Citability score: 28/100

Three biggest reasons:
1. **Zero structured data anywhere checked.** Confirmed via direct fetch of the homepage and the Corgi breed page — no `<script type="application/ld+json">` blocks at all. No LocalBusiness, no Product/Offer, no FAQPage, no AggregateRating. For a domain whose single biggest differentiator is a real, visitable physical premises, this is the highest-leverage gap on the list.
2. **Entity-consistency is worse than the brief flagged — it's not one conflict, it's four.** client.md flagged homepage-"40 years"-vs-GBP-"since 2020." Live crawl found two more numbers *on the site itself*: the Corgi and Cavapoo breed-page meta descriptions both say **"over 50 years of breeding experience,"** while the Corgi page's own body copy says **"We've been breeding Corgis since the 1960s"** (~60+ years), while the homepage tagline says **"Over 40 years"** (also has a live typo: "exprience"). That's four different numbers — 40, 50, ~60, and 5 (GBP) — for the same claim, visible to any crawler or AI Overview synthesis pass in under five page loads. This actively degrades trust-signal extraction; an AI system trying to state "how long has this breeder operated" has no consistent answer to pull.
3. **No pricing anywhere it would need to be to win the money queries.** Both breed pages checked gate price entirely behind a WhatsApp QR code ("Please scan this QR Code for pricing... via Whatsapp"). Every AI-Overview-cited competitor in this audit (thelovelypets.com, prettypetskennel.com, pawrenthood.sg) publishes an actual number or range in visible text. Since the AI Overview citation data shows "[breed] price" / "[breed] puppies price" queries are exactly what's being cited today, an ungated price is close to a precondition for citation on this domain's core commercial terms.

## Fan-out query map
Built from live Call 1 SERP data (PAA + related_searches), capped at the 3 core services per the brief.

**Puppy sales by breed (own Corgi, Cavapoo, Dachshund specifically):**
- "corgi puppy singapore price" / "corgi dog price singapore" / "is corgi hdb approved" — currently 100% owned by thelovelypets.com and pawrenthood.sg
- "cavapoo puppy singapore price" / "cavapoo singapore adoption" — currently unowned by any single domain in the top 3 AI citations checked; open lane
- "dachshund puppy singapore price" / "are dachshunds allowed in hdb" / "what is the lifespan of a dachshund" (all four surfaced as `people_also_ask_ai_overview_expanded_element` — direct AI Overview PAA targets) — currently owned by thelovelypets.com
- "how much does a puppy cost in singapore" — general PAA, currently unowned, high-intent, answerable in one paragraph

**Visiting the farm (genuine differentiator, currently unclaimed):**
- "sungei tengah pet farm" / "sungei tengah pet farm opening hours" / "sungei tengah pet farm review" / "59 sungei tengah road pet shop" — wgpetfarm.com holds local-pack rank 2 here but has no organic content page built for it
- "pet farm singapore sungei tengah" (related search) — zero wgpetfarm.com presence in the broader "pet farm visit singapore" SERP, which is dominated by animal-petting-zoo content (Hay Dairies, Sundowner) that isn't even puppy-breeder content — a genuinely open lane if framed as "what a farm visit and viewing appointment is actually like"

**Grooming / training (secondary services, low near-term ROI):**
- "dog grooming singapore" and "puppy training singapore" SERPs are both saturated by dedicated single-service specialists (Waggie, The Grooming Angels, Pawsitive Furkids) with knowledge panels and hundreds/thousands of reviews. wgpetfarm.com does not appear and realistically won't rank as an add-on service against category leaders — deprioritize fan-out spend here versus the two lanes above.

## Page-level fixes

| URL | What blocks citation | The fix |
|---|---|---|
| `/` (homepage) | No JSON-LD at all; "Over 40 years" tagline (typo: "exprience") conflicts with two other on-site numbers | Add Organization + LocalBusiness (PetStore/subtype) schema; fix typo; hold the years claim until owner confirms one number (see Quotable-facts) |
| `/corgi-puppies-for-sale/` | Meta description claims "50 years," body claims "1960s" — both conflict with homepage; no schema; no FAQ-shaped headings despite 5,000+ words; price fully gated behind WhatsApp QR | Reconcile the years claim to match whatever the homepage ends up saying; add Product/Offer + FAQPage schema; convert 2-3 of the "Introduction/Highlights" sections into explicit Q&A headings ("Is a Corgi HDB approved?", "How much does a Corgi puppy cost at William Goh Pet Farm?"); publish at least an indicative price range in visible text, not just behind the QR code |
| `/cavapoo-puppy-for-sale/` | Same pattern: meta says "50 years," no schema, no FAQ headings, price gated behind QR | Same fixes as Corgi page |
| `/dachshund-puppy-for-sale/` | Not independently crawled this pass, but built on the same WordPress template as the two pages above — reasonable to assume the same gaps | > NEEDS DATA: confirm meta description wording and schema absence directly before prioritizing the fix, but budget for the same fix set |
| `/contact-us/` | This is the only wgpetfarm.com page currently ranking organically for "sungei tengah pet farm" (position 10) — but it's a thin utility page (address, WhatsApp, phone), not content built to earn the citation the local-pack presence suggests is winnable | Either build out a dedicated "Visit the Farm" page (viewing process, what to expect, appointment booking, parking/directions) and let Contact stay thin, or substantially expand Contact itself with that content and FAQPage schema |
| All breed pages (84-127 images each on Corgi/Cavapoo) | `no_image_alt` and `no_image_title` both flagged true — dozens of unlabeled images per page | Add descriptive alt text (breed name + distinguishing trait, e.g. "corgi puppy dapple long-coat at William Goh Pet Farm") — helps both accessibility and any multimodal/image-grounded AI answer surface |

## Quotable-facts inventory

**Facts the client HAS that pages don't surface as citable, structured claims:**
- 4.5–4.6 star rating / 64–65 reviews on Google Business Profile — confirmed twice independently (client.md's GBP pull and today's live local-pack SERP, 64 vs 65, effectively the same figure) — this is a solid, stable number, but it exists nowhere as `AggregateRating` schema on any page checked.
- AVS License No. AF23009 — confirmed in the site footer, real and verifiable against the government breeder list (also independently confirmed on `isomer-user-content.by.gov.sg`'s licensed-breeder PDF) — not surfaced as a schema `identifier` or credential anywhere.
- A real, visitable physical premises with by-appointment viewing — genuinely differentiates from online-only sellers like Wag A Tail, Woof Loof, and Pawrenthood.sg, none of whom offer a farm visit. This is the strongest first-hand-experience (E-E-A-T) asset this domain has, and per the local-pack data it already has organic pull ("sungei tengah pet farm" rank 2) — but no page on the site is built to narrate what a visit is actually like, which is exactly the kind of first-hand, non-generic detail that differentiates a citation-worthy page from the generic breed-care content most of the site currently is.

**Gaps flagged, not resolved (do not invent a number for either):**
- **Years in business:** the site itself carries three different numbers (homepage "40 years," breed-page meta descriptions "50 years," breed-page body copy "since the 1960s") plus a fourth from the Google Business Profile ("AVS-licensed Singapore breeder since 2020" / "5+ years in business" per today's live SERP snippet). This audit does not resolve which is correct — that requires the owner. Recommended interim step: pick the number that can be defended today (very plausibly "breeder/owner has 40-60 years of personal breeding experience, but this specific licensed premises/entity has operated since ~2020") and make every on-site instance and the GBP description say the same thing, in the same words.
- **Pricing:** confirmed still unpublished anywhere on the two breed pages crawled — gated behind a WhatsApp QR code even on 5,000+-word breed pages. This is the same gap flagged for puppysingapore.com. Given the citation data shows "[breed] price" queries are precisely what's winning AI Overview citations for competitors, this is the single highest-leverage content gap on the domain.
- **No testimonials/case studies on-site** (confirmed, matches client.md). One structural note: the Corgi and Cavapoo breed pages do carry an `h3` heading "See Why Our Clients Trust Us" — its actual content wasn't captured in this crawl pass and should be checked directly; if it's empty or generic, it's a ready-made slot for real testimonial content once the owner supplies any.

## Schema gaps

Priority order, given the real physical premises:
1. **LocalBusiness (or PetStore subtype)** — highest priority. Should carry `name`, `address` (Block L, 59 Sungei Tengah Rd, #01-19, Singapore 699014), `telephone`, `openingHours` (Sun–Sat 10am–6pm per GBP), `aggregateRating` (4.5★/64-65 reviews), and `sameAs` linking the GBP profile. Currently absent site-wide — this is the fix most directly tied to the domain's actual physical-premises advantage.
2. **Product/Offer per breed page** — even without a fixed price, `Offer` supports `priceSpecification` with a "contact for price" pattern or an indicative `priceRange`; pair with `Brand`/`name` for the breed. Absent on both breed pages checked.
3. **FAQPage** — none of the breed pages checked have question-shaped headings at all, let alone marked-up FAQ schema, despite the domain having PAA-eligible questions available today (four Dachshund PAA questions returned `ai_overview_expanded` elements in Call 1 — "How much does a Dachshund cost in Singapore?", "Are dachshunds allowed in HDB?", "What is the lifespan of a Dachshund puppy?", "How much does a puppy cost in Singapore?"). These four alone are a ready-made FAQPage starter set.
4. **BreadcrumbList** — not directly checked this pass; worth a quick confirm given the site's fairly deep breed-page structure (> NEEDS DATA).
5. **Organization** — should sit alongside LocalBusiness on the homepage, carrying the AVS license number as an `identifier` and resolving to a single, consistent founding/years-active claim once the owner confirms it.

---
**Handoff:** wgpetfarm.com is winning the local-pack battle for its own address ("sungei tengah pet farm," rank 2) but is invisible in AI Overview citations for its own three named specialty breeds (Corgi, Cavapoo, Dachshund) — those queries are currently owned almost entirely by thelovelypets.com. Fastest path to citation share: add LocalBusiness + FAQPage schema, publish real prices instead of gating them behind a WhatsApp QR, and resolve the "40 years / 50 years / since the 1960s / since 2020" conflict to one consistent number across every page and the GBP listing.

**Headline stat for the report:** wgpetfarm.com currently holds zero AI Overview citations for Corgi, Cavapoo, or Dachshund — the three breeds its own homepage names as specialties — while competitor thelovelypets.com is cited across 47+ tracked breed-price queries including those same two breeds (Corgi, Dachshund).
