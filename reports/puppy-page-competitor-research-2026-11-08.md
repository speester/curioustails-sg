# Individual puppy page: Singapore competitor research

**Task:** K-002 · **Date:** 2026-11-08 · **Scope:** Curious Tails only · **Status:** research complete, read-only (no production source changed)

Captured with Playwright (Chromium 156, desktop 1440×900 and iPhone 390×844 @2x) on 2026-11-08. Screenshots: `outputs/puppy-page-research/screens/<slug>-desktop.jpg`, `-mobile.jpg`, `-mobile-scrolled.jpg` (48 files). DOM extracts (headings, JSON-LD types, image counts, fixed/sticky elements, WhatsApp link counts, body text) were reviewed for each page.

> Language note: several competitors make parent genetic-testing and lineage-certificate claims. Those claim words are on our `WORDS_TO_AVOID` list, so this report describes them without using the words. Curious Tails must not copy those claims.

---

## 0. The owner's four reference pages: what was found

| Reference | Result |
|---|---|
| **Dawgs & Co: Japanese Spitz [Gyoza]** | Gyoza has been **taken down**. `dawgsandco.net/japanese-spitz-gyoza` returns the Wix "404" builder page, and Gyoza is not on `/available-puppies` or `/japanese-spitz`. Google still lists Gyoza only as an Instagram reel ("Meet Gyoza our Japanese Spitz boy from Australia", 2026-10-18). Analysed instead: **the same template** on two live Dawgs pages, `japanese-spitz-poochie` (same breed) and `maltipoo-mango` (same breed as Biscuit). |
| **Poppy: Cream Brown F1BB Mini Petite Golden Doodle (Girl)** | **Not found.** I searched Google SG (DataForSEO live SERP, 3 query variants), Bing-style web search and the puppy listings of 12 SG shops. The only "Poppy" results are US breeders (Pawrade, petfinder) and Pinterest. The listing is most likely sold and removed, or it exists only on social media. The closest live analogues analysed: Paw Palace doodle listings and the Woof Loof mini goldendoodle litter page. |
| **Echo: Cream Mini Pomsky Spitz (Boy)** | **Not found**, by the same method. Results were French classifieds and US shelters. Pomsky × Spitz in SG shows up only as Instagram/Facebook posts (OMO OMO Pet Shop, The Pet'z Company). Closest analogues analysed: the Furgive You Japanese Spitz listing and the Dawgs Spitz page. |
| **Wag a Tail: Yorkshire Terrier 8891** | Found and analysed. `https://www.wagatail.sg/product-page/yorkshire-terrier-microchip-8891` |

**Ask for the owner:** if Poppy and Echo are open in their browser or phone, a pasted URL or a screenshot is enough to add both to this matrix.

---

## 1. Pages analysed (14 competitor + 2 Curious Tails)

| # | Shop (AVS licence shown on page) | Page | Breed · status | Price | Notes |
|---|---|---|---|---|---|
| 1 | **Wag a Tail** (AS20J00033) | [yorkshire-terrier-microchip-8891](https://www.wagatail.sg/product-page/yorkshire-terrier-microchip-8891) | Yorkie M · available | $5,800 | Owner reference. Wix store. |
| 2 | Wag a Tail | [cavapoo-microchip-8317](https://www.wagatail.sg/product-page/cavapoo-microchip-8317) | Cavapoo · available | $4,600 | Same template. |
| 3 | **Dawgs & Co** (AS20A00013) | [japanese-spitz-poochie](https://dawgsandco.net/japanese-spitz-poochie) | J. Spitz M, 3 mo · available | not shown | Stand-in for Gyoza. Wix site behind a bot wall (curl 403; loads in a real browser). |
| 4 | Dawgs & Co | [maltipoo-mango](https://dawgsandco.net/maltipoo-mango) | Maltipoo M, white & apricot | not shown | Like-for-like with Biscuit. |
| 5 | **The Lovely Pets** | [product/toy-poodle-2](https://www.thelovelypets.com/product/toy-poodle-2/) | Toy Poodle | $4,988 | WooCommerce. |
| 6 | The Lovely Pets | [product/cavachon-male-2](https://www.thelovelypets.com/product/cavachon-male-2/) | Cavachon M · Australia | $4,500 | Has a "5-Day Health Protection Plan". |
| 7 | **Paw Palace** (AS24A00008) | [products/cavapoo-3345-m](https://www.pawpalace.sg/products/cavapoo-3345-m) | Cavapoo M · Ireland · **sold** | $4,500 | Shopify. |
| 8 | Paw Palace | [products/mini-goldendoodle-5656-m-2](https://www.pawpalace.sg/products/mini-goldendoodle-5656-m-2) | Bernedoodle M · **sold** | $8,000 | Slug says goldendoodle but the page title says Bernedoodle (slug reuse). |
| 9 | **Furgive You** (puppyforsale.sg, AS24C00019) | [maltipoo-for-sale/7a066cf4…](https://puppyforsale.sg/maltipoo-for-sale/7a066cf4-6bca-4636-a7dd-62ec3855d222) | Maltipoo (Pudding F, 12 wk, Australia) | S$5,200 | The "individual" UUID URL renders the **breed hub**. Strongest SEO in the set. |
| 10 | Furgive You | [japanese-spitz-for-sale/6cb8a935…](https://puppyforsale.sg/japanese-spitz-for-sale/6cb8a935-1196-43d6-922f-a9e4d5037e1d) | J. Spitz | n/a | Same hub pattern. |
| 11 | **Only Paws** (AS24D00024) | [product/maltipoo-12](https://onlypaws.sg/product/maltipoo-12/) | Maltipoo M, apricot | $3,288 nett | DOB 01/10/2024 and a CNY promo still showing in November 2026. Stale listing. |
| 12 | **Maya & Co Puppies** | [product/maltipoo](https://mayapups.com/product/maltipoo/) | Maltipoo (breed-level "product") | not shown | No individual puppy. Only a form and a FAQ. |
| 13 | **Tiara Pets** (AS22J…) | [product-page/yume-mini-bichon-frise](https://www.tiarapetssg.com/product-page/yume-mini-bichon-frise) | Mini Bichon F · Japan | `0` in schema | Expected adult size printed (2.5–2.8 kg). The only CTA is a form. |
| 14 | **Woof Loof** | [mini-goldendoodles](https://woofloof.sg/mini-goldendoodles) | Litter page, 8 named pups | not shown | Per-pup cards: birthday, coat, est. weight, ETA, honest "Not HDB-Approved". |
| — | Curious Tails (pilot) | [maltipoo/2938-apricot-girl](https://curioustails.sg/puppies/maltipoo/2938-apricot-girl/) | Biscuit · **placed (Nov 2026)** | — | Now renders the "found a loving home" variant. |
| — | Curious Tails (live available state) | [maltipoo/2950-red-boy](https://curioustails.sg/puppies/maltipoo/2950-red-boy/) | Smokey · available | $3,888 | Used to audit the *available* template. |

Also surveyed for listings, with no individual puppy page worth a row: All Paws Loft (home-page cards only), Cotton Pups (bot wall), Pet Me Please (did not load), The Pawsery (Instagram only).

---

## 2. Per-page notes

### 1–2. Wag a Tail (owner reference)
- **Above the fold:** one square photo. H1 "YORKSHIRE TERRIER - Microchip 8891" (microchip tail as the name), price, a leftover Wix **Quantity** selector, and the text line "WA / Call +65 9172 1114 for viewing!". No button-style WhatsApp CTA above the fold. Single image, no gallery or video.
- **Section order (all collapsed accordions):** Personal information → This puppy is → Documents include → HDB approved → Meet this puppy → AVS licence → Prices / taxes / payment → Why choose Wag a Tail (5 paragraphs) → address, hours, Telegram.
- **Personal info:** DOB **05-Aug-2026**, gender, microchip tail, UK import, "non-shedding / hypoallergenic" (an over-claim).
- **Health:** vaccinated, dewormed, tick/flea protected, microchipped, licensed, health checked.
- **Documents:** personal folder, vaccination record, deworming record, health check report, *basic parents' information*, import/export documents. This **documents checklist** is the strongest idea on the page.
- **Trust:** "a decade" in business, AVS licence in its own accordion, Instagram/TikTok claims. No reviews on the page.
- **Schema:** `Product` + `Offer` 5800 SGD InStock. No meta description, no breadcrumb.
- **Mobile:** two full-height fixed layers (Wix chrome) and no sticky CTA. The accordions hide all the substance from both readers and crawlers until tapped.
- **Strong:** DOB, microchip tail as a public ID, a documents list. **Weak:** one photo, collapsed content, no meta, a cart-style Quantity field on a live animal, no FAQ, no next steps. **We beat it on** content depth, real reviews, a visible all-in price explanation and a mobile CTA.

### 3–4. Dawgs & Co (Gyoza's template)
- **Above the fold (mobile):** WhatsApp text strip, logo, H1 "Maltipoo [Mango]", a dark "Licensed Pet Shop by NParks SG" band, then a designed **name card photo** ("Mango · Ireland Imported Maltipoo" typeset on the image). A floating WhatsApp bubble. No price anywhere.
- **Order:** breed blurb → emoji fact list (origin, colour, sex, HDB, "hypoallergenic", parent genetic-test claim) → health ticks (microchipped, vaccinated, health checked, internal and external parasite treatment, import licensed, AVS dog licensed) → perks (aftersale care "guaranteed", **free starter kit worth $150**, **free final vaccination**, Grade A licence, lifetime 10% off grooming) → "parentage viewing", "ethically sourced" → licence number → training programme cards (Puppy Culture, crate and pen, pee-pad trained) → partner vet card (Hillside Veterinary) → **6+ named reviews** → generic breed description → "Good To Know" → long buying guide → footer.
- **Video:** 1 embed. **Schema:** a single `Article` node (wrong type), meta description "Dawgs&Co.", two H1s. Image alts are empty.
- **Strong:** a designed name-card hero; a **"what this puppy has already learnt"** block (training cards); a named partner vet; many reviews on the page. **Weak:** no price, no schema, empty alts, emoji-wall formatting, and a $150 starter kit (ours is $533 itemised). **We beat it on** a visible price and a kit worth about 3.5× as much, with free delivery and setup.

### 5–6. The Lovely Pets
- **Above the fold:** a gallery of 5–6 images plus a video, H1, price, tags ("Parents [genetic] tested", "Australia Import", "SMALL BREEDS"), then a long tick list, then "Enquire on WhatsApp". The WhatsApp prefill **includes the product URL**.
- **Content:** import country, an ethical breeder line, socialised, gender, "hypoallergenic", HDB approved, thorough health checks, vaccinated, dewormed, microchipped, licensed, **free 1 month flea/tick and heartworm prevention**, **"5-Day Health Protection Plan: if puppy falls sick within 5 days, bring back to us and we nurse it free"**, free grooming before sale, unlimited after-sale consultation, trainer recommendation, "**Price quoted is inclusive of GST**".
- Then "More Puppies You May Like" and a browse-by-size/breed directory.
- **Mobile:** fixed top "Find Puppy" filter and a **fixed bottom "BOOK APPOINTMENT FOR VIEWING/GROOMING" bar**.
- **Schema:** `Product` + `Offer` (4500 SGD InStock), breadcrumb, organisation. **No meta description.** Alts are generic.
- **Strong:** gallery and video, GST-inclusive reassurance, a named 5-day plan (the same promise Curious Tails already makes), a sticky bottom CTA. **Weak:** about 350 words, no FAQ, no breed fit, no next steps, a sticky bar that mixes grooming with puppies. **We beat it** by naming *our* 5-day promise just as clearly and adding everything they lack.

### 7–8. Paw Palace
- **Above the fold:** zoomable gallery (16–19 images), "Sold" badge, price, a fake-urgency widget ("**Real time 2 visitor right now**"), MESSAGE button.
- **Content:** microchip number as the ID; male; import country; HDB approved; included: microchip with AVS licence registration, "2x vaccinations (minimally)", monthly deworming, identity documents, health certificate, **vet-certified health report**, 1 kg kibble, 1 pee pad, 10% grooming discount, **1 vet video consultation**.
- **Policy block:** collection (**self-collection only**), payments (**PayNow and cash only**), return policy (**non-refundable**), how to book a viewing ("screenshot the puppy with microchip number…").
- **Schema:** `Product`, Offer `OutOfStock` (correct for sold). Meta description is the raw bullet text. 24 forms (theme).
- **Strong:** a big gallery and an **explicit policy block** that answers collection, payment and returns before anyone asks. **Weak:** fake visitor counter, raw-text meta, sold pages full of sold "related" items. **We beat it** with free delivery *and* setup against their self-collect-only, and a starter kit against their 1 kg kibble.

### 9–10. Furgive You (puppyforsale.sg): the SEO benchmark
- Individual UUID URLs serve the **breed hub**, with the puppy's name and alt text but no unique page. It is effectively a breed page that ranks with live stock.
- **Above the fold:** H1 "Maltipoo Singapore: Maltipoo Puppies for Sale", then an **"at a glance" table**: guide price band, adult size 3–7 kg / 20–35 cm, daily exercise 20–40 min, coat ("low-shedding; not a true hypoallergenic guarantee"), **HDB nuance** (a cross qualifies only if both parent breeds are on the Schedule), licence required, a seller line with the AVS number, and "**Page reviewed October 2026. 3 Maltipoo puppies are currently listed.**"
- **Order:** at a glance → intro → **"Book a 45-minute play date, no obligation"** → available pups (name, sex, age, price, origin, View/Enquire) → price section (range, why it varies, what's included table, "the quoted price is the price you pay at collection") → ongoing costs → why cheap puppies are a red flag → **deposits, payment and what happens next** → is a Maltipoo right for your home (HDB, space and exercise, family and pets, neighbours) → climate care → FAQ → meet in person (storefront photo) → guides → past puppies.
- **Schema:** PetStore, BreadcrumbList ×2 (a duplicate), ItemList, **FAQPage**. Meta description: "Vet-checked, vaccinated, AVS-microchipped. WhatsApp us to book a private meet-and-greet…".
- **Mobile:** **fixed bottom bar with two buttons: "WhatsApp us" + "Book a visit"**.
- **Strong:** honesty framing ("not a true hypoallergenic guarantee", HDB nuance, "check current rules"), a dated freshness line, a deposits-and-next-steps section, a storefront photo, a two-button sticky bar. **Weak:** no true per-puppy page, so each puppy has no unique long-tail landing page; only 2 photos. **We beat it** with a real per-puppy page that carries this hub's honesty *and* the specific puppy.

### 11. Only Paws
- Video and gallery, emoji description (status, sex, colour, DOB, HDB, "NOW $3288 NETT", **a CNY promo still showing in November**), health ticks including "3x 9-in-1 vaccination" and "parvovirus tested", complimentary basic grooming, phone, hours, email, licence.
- "Add to cart" on a live puppy. No meta, no H1 (the theme drops it). `Product` schema has an offer.
- **Lesson:** stale data (a 2024 DOB, an expired promo) destroys trust faster than missing data. Our sync-driven data is an advantage. Keep it visibly dated.

### 12. Maya & Co Puppies
- A breed-level "product" with no specific puppy: breed blurb, enquiry form, FAQ. `Product` + 2× `FAQPage` schema. About 360 words.
- **Lesson:** a product page with no puppy on it is the weakest pattern. Never ship an individual page without a real photo (our route already enforces this).

### 13. Tiara Pets
- Gallery of 5 and a video. Name, breed, colour, sex, **birthday**, **expected adult size 2.5–2.8 kg**, vet-checked, vaccinated (incl. rabies), dewormed, microchipped, plus parent genetic-clearance and lineage-certificate claims. The only CTA is a 6-field appointment form. Product schema price `0`.
- **Lesson:** a per-puppy **expected adult weight** is a high-value field when the shop actually knows it. A form-only CTA is high friction in a WhatsApp market.

### 14. Woof Loof (litter page)
- Each pup is a card: **name and status (Available for reservation / Reserved)**, birthday and country, sex and coat type, **estimated adult weight**, **estimated arrival date**, a puppy-curriculum note, and an honest **"Not HDB-Approved"**. Then a "recently reserved past litters" section, then breeder-visit and home-raised trust blocks, then FAQ (FAQPage schema).
- **Lesson:** **reserved pups left visible** create social proof, and honest negatives ("Not HDB-Approved") make the positives believable.

---

## 3. Pattern matrix

● = present and done well · ◐ = present, weak · ○ = absent. CT = Curious Tails live *available* template (Smokey 2950).

| Pattern | Wag | Dawgs | Lovely | PawPal | Furgive | OnlyPaws | Maya | Tiara | WoofLoof | **CT now** |
|---|---|---|---|---|---|---|---|---|---|---|
| Multi-photo gallery | ○ (1) | ◐ (designed card) | ● 5–6 | ● 16+ | ◐ 2 | ● | ○ | ● 5 | ● | **○ (1)** |
| Video on page | ○ | ● | ● | ○ | ○ | ● | ○ | ● | ○ | **○** (feed field exists, empty) |
| Price visible above fold | ● | ○ | ● | ● | ● | ● | ○ | ○ | ○ | ● (but below fold on mobile) |
| "All-in / no add-ons" wording | ◐ (tax section) | ○ | ● GST incl. | ○ | ● | ● "nett" | ○ | ○ | ○ | ● |
| Trust chips near price | ○ | ◐ | ● | ◐ | ● | ◐ | ○ | ◐ | ◐ | ● |
| DOB / birthday | ● | ○ | ○ | ○ | ◐ age | ● | ○ | ● | ● | **○** (age only, frozen at sync) |
| Expected adult weight | ○ | ○ | ○ | ○ | ◐ breed range | ○ | ○ | ● | ● | **○** |
| Ready / arrival date | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ● | **○** |
| Health ticks | ● | ● | ● | ● | ● | ● | ○ | ● | ◐ | ● |
| Vaccination schedule / dates | ○ | ◐ "free final vacc" | ○ | ◐ "2x minimally" | ◐ | ◐ "3x 9-in-1" | ○ | ○ | ○ | **○** |
| Documents handed over list | ● | ○ | ○ | ● | ◐ | ○ | ○ | ○ | ○ | **○** |
| Post-purchase health promise | ○ | ◐ "guaranteed" | ● 5-day plan | ○ (non-refundable) | ◐ | ○ | ○ | ○ | ○ | ◐ (buried in a card) |
| Starter kit / inclusions | ○ | ● $150 | ● | ◐ kibble + pad | ● table | ◐ grooming | ○ | ○ | ○ | ● $500+ (marquee) |
| Delivery / collection stated | ○ | ○ | ○ | ● self-collect only | ● in-store | ○ | ○ | ○ | ◐ ETA | ◐ (in "why" card) |
| Payment / deposit / next steps | ◐ | ○ | ○ | ● | ● | ○ | ○ | ○ | ○ | **○** |
| Breed-fit (size, exercise, HDB, kids) | ○ | ◐ generic | ○ | ○ | ● | ○ | ◐ | ○ | ◐ | **○** (generic temperament fallback) |
| Licence number + verify link | ● | ● | ○ | ● | ● | ● | ○ | ● | ○ | ● (no link near the decision) |
| Reviews on page | ○ | ● many | ○ | ○ | ◐ | ○ | ○ | ○ | ◐ | ● (3 review/social bands) |
| Visit the shop (address, hours, photo) | ● | ● | ● | ● | ● storefront | ● | ○ | ○ | ○ | ◐ (one line) |
| FAQ / objection handling | ○ | ◐ guide | ○ | ◐ policies | ● | ○ | ● | ○ | ● | **○** |
| Sticky mobile CTA | ○ | ◐ float bubble | ● Book bar | ○ | ● 2-button bar | ○ | ○ | ○ | ○ | ◐ generic float bubble (no pup ID) |
| Product + Offer schema | ● | ○ (Article) | ● | ● | ○ (hub) | ● | ◐ | ◐ price 0 | ○ | ● |
| FAQPage schema | ○ | ○ | ○ | ○ | ● | ○ | ● | ○ | ● | **○** |
| Meta description | ○ | ◐ | ○ | ◐ raw | ● | ○ | ● | ○ | ◐ | ● |
| Descriptive image alt | ◐ | ○ | ◐ | ◐ | ● | ○ | ◐ | ◐ | ● | ● |
| Related / other pups | ○ | ○ | ● | ◐ sold | ● | ● | ○ | ○ | ● | ● |
| Freshness ("updated / listed today") | ○ | ○ | ○ | ○ | ● dated | ✗ stale | ○ | ○ | ◐ | **○** (sync date exists, unused) |

**Market read:** no Singapore shop has one page that combines a real gallery, the specific puppy's dated facts, an honest breed-fit block, an itemised all-in price, a "what happens next" path, a visible health promise, FAQ schema and a two-button sticky mobile bar. Furgive has the content but no per-puppy page. Lovely Pets and Paw Palace have galleries but thin content. Curious Tails already has the data plumbing (sync, prices, placed archive, booking links) and real proof. It can be the first to put it all together on one page.

---

## 4. Steal / avoid

### Steal (adapted to what Curious Tails can honestly say)
1. **Two-button sticky mobile bar** (Furgive, Lovely Pets): "WhatsApp about Biscuit" + "Book a viewing", carrying the puppy ID into the prefill and GA4 `wa_source`.
2. **"At a glance" fact table with honesty built in** (Furgive): size, exercise, coat ("low-shedding, no dog is truly allergen-free"), HDB, licence, with a dated "checked" line.
3. **Gallery and video first** (Lovely Pets, Paw Palace, Tiara): we already receive `Image2-` to `Image5-` and `Video-` from the sheet, but sync keeps only the first image.
4. **Named post-purchase promise** (Lovely Pets' "5-Day Health Protection Plan"): we make the same promise. Give it a name and a place beside the price, worded exactly as `business-context.md` states it.
5. **Documents you take home checklist** (Wag a Tail, Paw Palace): only once the owner confirms the exact list. Until then, show what is confirmed (vaccination and health records, AVS licence paperwork done at purchase).
6. **Deposits, payment and what happens next** (Furgive, Paw Palace): our version is stronger. Deposit → **free boarding up to 1 month, vaccinations continued at our cost** → delivery timed to you → playpen setup and kit walkthrough → free training lesson.
7. **Expected adult weight and DOB per puppy** (Tiara, Woof Loof, Wag): use DOB from the sheet's `DOB-` column. Show adult weight only if the owner adds the field. Otherwise show the breed range, labelled as a breed range.
8. **Reserved / found-a-home social proof** (Woof Loof): we already have the placed archive. Show "recently found homes: Finn, …" on available pages too.
9. **Storefront / shop photo and named owners at the visit block** (Furgive, Dawgs' partner-vet card): Nelson and Kim, 2 Balestier Road, hours, MRT and bus.
10. **WhatsApp prefill naming the exact puppy** (Lovely Pets includes the URL): ours already names the ID. Add the page URL so staff can open it on their phone.

### Avoid
1. **Collapsed accordions holding the core facts** (Wag a Tail). FAQ can collapse. Price, health and inclusions must not.
2. **Fake urgency** ("Real time 2 visitors right now", Paw Palace). It conflicts with "no pressure to buy".
3. **Cart mechanics on a live animal** (Wag's Quantity field, Only Paws' Add to cart).
4. **Stale promos and dates** (Only Paws' 2024 DOB and CNY promo in November). Every dated element must come from the sync, never typed.
5. **Over-claims**: "hypoallergenic / non-shedding" as a promise, "aftersale care guaranteed", parent genetic-testing and lineage-certificate claims (blocked words for us anyway).
6. **Designed text burned into the hero photo** (Dawgs). It hurts image search and alt honesty. Keep the name in HTML.
7. **Wrong or missing schema** (Dawgs `Article`, Tiara price `0`, two H1s, empty alts, missing meta descriptions).
8. **Form-only CTA** (Tiara, Maya). WhatsApp-first is the market norm.
9. **Breed hub served on a per-puppy URL** (Furgive). It wastes the long-tail ("apricot maltipoo girl") that a real per-puppy page can own.
10. **Promo bands stacked back to back** (our own current page: TestimonialWall → StarterKitMarquee → ReviewSlider). This dilutes the page and adds about 120 `<img>` tags.

---

## 5. Top 5 patterns worth stealing (summary)
1. Two-button sticky mobile bar with the puppy's ID in the prefill.
2. Gallery and video above the fold, from the `Image2–5` and `Video-` columns we already receive.
3. An honest "at a glance" fact table with a dated "checked" line.
4. A visible "what happens next / deposit / delivery" path. Ours includes free boarding up to a month.
5. A named post-purchase health promise beside the price (our 5-day nurse-back promise), plus a documents checklist once the owner confirms it.
