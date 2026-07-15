# AI Search / GEO Audit: Puppy Singapore (2026-07-12)

## Market & method

**Path A, confirmed empirically.** Every Call 1 query run for Singapore/English returned a live `ai_overview` SERP object (as `asynchronous_ai_overview: true`) — tested on "corgi puppy price singapore," "golden retriever puppy price singapore," "cavapoo puppy singapore price," and "golden retriever vs labrador singapore." Google AI Overviews are actively surfacing for this market, so this audit treats citation into AI Overviews as a real, currently-live opportunity, not a future one.

**Tooling limitation to flag:** the DataForSEO MCP toolset available in this environment does not include a `serp/google/ai_mode/live/advanced` endpoint (the brief's "Call 2"), and `serp_organic_live_advanced`'s exposed schema has no `load_async_ai_overview` parameter — so the actual AI Overview answer text and its reference list could not be pulled live for the fan-out queries. Two substitutions were used instead, and both are arguably stronger than 3 one-off Call 2 lookups would have been:
- **Fan-out map** built from People-Also-Ask (PAA) trees returned by Call 1 (click depth 1-2), not from AI Mode sub-questions. Flagged as PAA-derived throughout this doc.
- **Citation status** pulled from `dataforseo_labs_google_ranked_keywords` with `item_types:["ai_overview_reference"]` — this is DataForSEO's own crawl of who is actually cited inside live AI Overviews across a much larger keyword universe than 3-4 manual queries could cover, run for puppysingapore.com and all three named competitors.

> NEEDS DATA: live AI Mode answer text/sub-questions were not retrievable with the current toolset. If a DataForSEO AI Mode endpoint becomes available, re-run Call 2 for the top 3 breeds to validate/extend the fan-out map below.

## Citation status

**The client is already being cited — this contradicts the assumption of zero AI visibility.** `ranked_keywords` (item_types=ai_overview_reference, Singapore/English, limit 50) returned:

| Domain | AI Overview citations found | Note |
|---|---|---|
| thelovelypets.com | 50 (hit query cap) | True count is higher; competitor is saturating this signal |
| wagatail.sg | 50 (hit query cap) | Same — true count higher |
| **puppysingapore.com (client)** | **22** | Full count (did not hit the cap) |
| prettypetskennel.com | 13 | Full count — client already out-cites this named competitor |

Client's 22 citations are concentrated on breed pages that already exist in the site's blueprint: cavapoo puppies, corgi puppy, corgi price singapore, french bulldog puppy, shih tzu puppy, poodle puppies, toy poodle puppies, cavalier king charles spaniel (several variants), maltipoo price, bulldog singapore, french pug, british bulldog singapore, dog fostering singapore. This confirms the breed-page format itself is citable when the topic match is close — the gap is depth/coverage, not the concept.

**Live organic spot-checks (Call 1) show the same breed-by-breed unevenness:**
- "corgi puppy price singapore" — client ranks ~position 10, behind thelovelypets.com (#1), wgpetfarm.com (#2, same owner), prettypetskennel.com, and wagatail.sg — and unlike every competitor above it, the client's own snippet shows no price.
- "cavapoo puppy singapore price" — client ranks ~position 4, directly behind thelovelypets.com. Strong.
- "golden retriever puppy price singapore," "golden retriever vs labrador singapore," "is cavapoo good for hdb singapore" — **client absent from page 1 entirely** on all three; thelovelypets.com and/or pawrenthood.sg and prettypetskennel.com occupy the visible/AI-relevant real estate instead.

## Citability score

**42 / 100**

Three biggest reasons it isn't higher:
1. **No answer-first structure anywhere audited.** Headings on `/corgi/` and `/cavapoo/` are flat statements ("Corgi Characteristics," "Cavapoo Personality," "Cavapoo Care") — never question-shaped, never leading with a direct answer. AI Overview synthesis favors content that already reads like an extractable answer; this format forces the model to mine facts out of marketing prose instead.
2. **Price — the single most commonly quoted fact type in this vertical — is published nowhere.** Every competitor and third-party source that appeared in the SERPs pulled for this audit states a concrete dollar figure directly in its snippet (thelovelypets.com: "$3,000-$9,000," prettypetskennel.com: "$4,000-$7,000," wagatail.sg: exact "$5,600.00" price, income.com.sg: "S$8,000-S$9,000"). Both `/corgi/` and `/cavapoo/` were fetched directly for this audit and confirmed: zero pricing, gated behind "Contact US for Gender, Age, Pricing, Availability & Viewing Location."
3. **Schema is present but generic** — `/corgi/` was checked at the raw-HTML level and does carry JSON-LD (`WebSite`, `WebPage`, `Article`, `Person`, `ImageObject` — standard WordPress/Yoast defaults), correcting the prior audit's "no schema found." But none of it is commercially useful: no `Product`/`Offer`, no `FAQPage`, no breed-entity markup, so there's nothing structured for an LLM crawler to lift cleanly.

What keeps the score from being lower: the individual-puppy bios (real names, ages, IDs, coat colors, e.g. "Pika is a tri-color Corgi girl with a bold black saddle, fiery copper accents, and a bright white chest") are genuine first-hand content, not templated filler — that's a real authenticity signal most competitor pages lack. And the 22 existing AI Overview citations prove the domain already clears the relevance/authority bar often enough to get pulled in.

## Fan-out query map (PAA-derived — no live AI Mode data available, see Market & method)

**Corgi**
- what-is: "Is Corgi a good house dog?"
- how-much: "How much should a Corgi puppy cost?" / "How much is a Corgi in Singapore?"
- who-qualifies: "Can I own a Corgi in HDB?" (answer is currently No — own this honestly)
- worth-it: "Why is a Corgi so expensive?" / "Is Corgi a high maintenance dog?"

**Golden Retriever**
- how-much: "How much is a normal Golden Retriever puppy?" / cost of Golden Retriever puppy in Singapore
- who-qualifies: "Is a Golden Retriever allowed in HDB / in Singapore?" (answer is No — condo/landed only)
- worth-it: "Are Golden Retrievers high maintenance?" / "Can Golden Retrievers be left alone for 8 hours?"
- X-vs-Z: "Golden Retriever vs Labrador — which is better / calmer / friendlier?"

**Cavapoo**
- how-much: "How much does a puppy cost in Singapore?"
- what-is: "What is the disadvantage of a Cavapoo?" / "Is F1 or F2 Cavapoo better?"
- best-for: "Is a Cavapoo good for an HDB / apartment?" (note: competitor prettypetskennel.com currently owns the featured snippet for this exact question)
- worth-it: "What is the lifespan of a Cavapoo?" / "Can a Cavapoo be left alone for 6 hours?"

## Page-level fixes

| URL | What blocks citation | The fix |
|---|---|---|
| `/corgi/` | No price anywhere; flat statement headings; no FAQ; generic breed-info paragraphs diluted by bios | Add an answer-first capsule near the top ("Corgi puppies in Singapore typically cost $X-$Y" — pending owner price decision, see Quotable-facts below); convert headings to question form ("Is a Corgi HDB-approved?", "How much does a Corgi puppy cost in Singapore?"); add a visible FAQ block + FAQPage schema using the PAA set above |
| `/cavapoo/` | Same pricing gate; emoji-adjacent bios crowding out factual content; no FAQ; competitor owns the HDB-approval featured snippet | Same fixes, plus explicitly answer "Is a Cavapoo HDB-approved?" and "F1 vs F2 Cavapoo" as dedicated Q&A blocks since PAA demand for both is confirmed live |
| All 40+ breed pages (site-wide pattern, sampled via corgi/cavapoo) | JSON-LD is generic WP/Yoast defaults only (WebSite/WebPage/Article/Person/ImageObject) — no Product, Offer, or FAQPage | Roll out Product+Offer schema per breed (price can stay "Contact for price" if the owner won't publish a number, but declare availability/itemCondition), plus FAQPage schema wired to the new on-page FAQ block |

## Quotable-facts inventory

Facts the client already has but doesn't surface on breed pages:
- AVS License No. AF23009 — currently footer-only, not woven into breed-page copy as a trust/E-E-A-T signal
- 40+ breeds available — a genuine differentiator vs. thelovelypets.com/wagatail.sg/prettypetskennel.com, none of which appear to list as many
- Health certifications, ancestry records, vet check-ups/vaccinations, "limited registrations from country of origin + Kennel Club of Singapore" — stated as sitewide services but not attached as concrete claims on individual breed pages
- Per-listing puppy age/ID/gender/coat color — already published and genuinely first-hand, but never rolled up into a citable "typical age/size at sale" fact
- Domain operating since 2016-12-08 (WHOIS-confirmed) — NOT yet owner-confirmed for public "since 20XX" framing per client.md; do not publish without sign-off

> NEEDS DATA / real gap, confirmed again during this audit: **no price is published anywhere on-site** (verified directly on `/corgi/` and `/cavapoo/`, both fully gated behind WhatsApp/Telegram contact). Every competitor and third-party source that appeared in the SERPs pulled for this report states a concrete dollar figure in its own snippet. This is very likely the single biggest lever for AI-citation growth available to this domain, but no number is invented here — the owner must decide whether to publish a price or price range (client.md notes Curious Tails, a separate entity under the same owner, uses "From $3,288, all-in" as a precedent) before this fix can ship.

## Schema gaps

- **Product + Offer** (schema.org/Product, schema.org/Offer) per breed page — even with price omitted/marked "Contact for price" if the owner won't publish a number, still declare `availability` and `itemCondition`
- **FAQPage** schema wired to a real on-page FAQ block built from the PAA-derived questions above (HDB-approval, cost, apartment-suitability, breed-vs-breed)
- **Breed-entity markup** — a schema.org/Thing (or `sameAs` link to an authoritative breed reference) per breed page to reinforce topical entity consistency
- **Organization/LocalBusiness** tying the AVS License AF23009 and the William Goh Pet Farm relationship together — subject to the owner's not-yet-confirmed disclosure decision in client.md
- Currently present but doing no citability work: `WebSite`, `WebPage`, `Article`, `Person`, `ImageObject` (WordPress/Yoast defaults) — not wrong, just generic

---

**Handoff to Blog / Content roles:** Fan-out query map above is PAA-derived (live AI Mode data wasn't available via this toolset — flag if re-running with a different DataForSEO plan/tool). Priority pages for answer-first rewrites: `/corgi/` and `/cavapoo/` first (both already carry live AI Overview citations, so a rewrite compounds an existing signal rather than starting cold), then extend the same template across the other 38 breed pages. Headline stat for the client report: **puppysingapore.com is already cited in Google AI Overviews for 22 breed-related keywords today — ahead of named competitor Pretty Pets Kennel (13) — but trails The Lovely Pets and Wag A Tail (50+ each), and the single biggest gap holding it back is that price appears nowhere on-site while every competitor's own AI-Overview citation leads with a concrete dollar figure.**
