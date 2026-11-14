# K-128 — Plan: the Biscuit page becomes the template for every puppy page

**Date:** 2026-11-14 · **Type:** plan only. No file under `src/`, `scripts/` or `public/` was edited for this card.
**Design source:** `outputs/puppy-page-redesign-biscuit.html` (K-124 build, preview at `https://k124-biscuit-reorder.curioustails-staging.pages.dev/outputs/`).
**Read for this plan:** the prototype (every section, its `.note` spec blocks and its script), `src/pages/puppies/[breed]/[id].astro`, `src/components/PuppyDetail.astro`, `src/components/ImportedPuppyDetail.astro`, `src/lib/puppy-cards.ts`, `src/lib/imported-puppies.ts`, `src/lib/loving-homes.ts`, `scripts/sync-puppies.mjs`, `src/data/{available-puppies,placed-archive,imported-puppies}.json`, `src/data/{site,buying-terms,reviews,registry}.ts`, `reports/puppy-page-template-spec-2026-11-08.md`, `reports/imported-puppy-copy-deck-2026-11-08.md`, `reports/k124-biscuit-reorder-report-2026-11-14.md`.
**Tasks:** `reports/puppy-page-template-tasks.json` (16 tasks).

---

## 0. What the plan does, in one paragraph

The site now has two puppy page components: `PuppyDetail.astro` (local and placed puppies, the 2026-10-01 layout) and `ImportedPuppyDetail.astro` (imported reservations). The Biscuit prototype is a third, hand-typed page that the owner has signed off. The plan replaces the first two with **one** component tree, `src/components/puppy-page/`, which renders the prototype's 15 sections in the owner's K-124 order. A single adapter (`src/lib/puppy-page.ts`) turns any of the three data sources into one `PuppyPageData` object. A publish gate in the same adapter decides whether a puppy gets a page at all. The URL (`/puppies/<breed>/<id-slug>/`), the slug function, the redirects and the sitemap rules stay as they are. Biscuit's copy is not carried over. Her sections are, and each sentence becomes a template string that reads its facts from data or from the shared terms file.

**Headline numbers**

| | |
|---|---|
| Sections on the page | **15** + the sticky action bar |
| Shown on all three variants with no data condition | **4**: Hero, About (dossier), Final CTA, Visit |
| Conditional on variant or on data | **11** (table in §1) |
| Data-contract rows | 52, of which **24 are required** (§2) |
| Per-puppy fields that block a thin local puppy | **5**: `id`, breed bucket, `image`, `price`, `location` |
| Tasks | **16** |

---

## 1. Section inventory (the live page, in the K-124 order)

Variant key: **AV** = `available` (in the Balestier shop) · **IMP** = `imported` (reservation, arrival estimate) · **PL** = `placed` (found a home).
The prototype already marks branches with `only-av` / `only-placed`, toggled by `body.is-placed`. The template keeps that vocabulary and adds **`only-imp`**. One change of mechanism: in the prototype both branches ship in the HTML and CSS hides one. In Astro the variant is known at build time, so each branch becomes a conditional render (`<Only on="av">`, `<Only on={['av','imp']}>`). The hidden branch never reaches `dist/`. That matters for SEO: the prototype has both H1 texts in the markup, and the built page must have one.

"Field names" below are exact. Feed = `src/data/available-puppies.json` (`breeds.<slug>.available[]`, written by `npm run sync:puppies`). Archive = `src/data/placed-archive.json` (`pups[]`). Imported = `src/data/imported-puppies.json` (`pups[]`). Terms = `src/data/buying-terms.ts`. Site = `src/data/site.ts`. Facts = `breedFacts[breed]` (new file, §2.4). Copy = `src/data/puppy-page-copy.ts` (new: the local copy deck as template strings) or `reports/imported-puppy-copy-deck-2026-11-08.md` (imported, already coded in `src/lib/imported-puppies.ts`).

### §1 Hero — gallery + buy box · AV · IMP · PL
- **Job:** answers "which puppy, how much, is she still here, how do I ask" above the fold on a 390×844 phone. It is the only section most mobile visitors see before tapping WhatsApp.
- **Fields:** breadcrumb `breed` → `breedName(breed)` (`src/data/breed-names.ts`) + route `/puppies/<breed>` (registry). Gallery `images[]` (new, feed) else `image`; imported `photos[]` + `photoAlt[]`. ID stamp `id` (imported: `ref`). Kicker `crossLabel ?? breedName` · gender noun from `gender` (imported: `sexLine(sex)`). H1: AV `{name}, the {color} {breed} {Girl|Boy}`; PL `{name} the {breed} Found a Loving Home`; IMP copy-deck title. Availability line: AV "Available now · {date} · Balestier" (see honesty rule H6); PL `placedAt` → `placedWhen()`; IMP `arrivalLine(pup)` from `arrivalEstimate`. Price card: AV `price` + `INCLUSIONS_LINE` + `SURCHARGE_LINE` + five-day line (Terms); IMP `priceSGD`, `depositSGD`, copy-deck small print; PL copy "no longer available". CTAs: `whatsappLink()` (Site) with the prefill from Copy, `bookHref` (feed). Chips: Vaccinated, Microchipped, Vet health-checked (shop policy, AV only), HDB approved (`hdbApproved === true` only). Trust line: `site.license.avsNumber`, `site.reviews.rating`, `site.reviews.count`.
- **Fallbacks:** one photo and no video, which is the normal case: one plate plus the "Ask for a video of {name}" slide, counter "1 / 2". This is exactly Biscuit's page today. With 2–5 photos, the strip gets N plates plus the ask slide. With a `video`, the last slide is the clip and the ask slide is dropped. No `bookHref`: Book a viewing becomes a WhatsApp booking prefill. No `name`: the H1 becomes `{Color} {Breed} {Girl|Boy}`, and headings elsewhere say "this puppy". No `gender`: the noun is "Puppy" and pronouns are they/them. No `color`: it is dropped from the H1 and alt text. No `hdbApproved`: no HDB chip. No `site.reviews`: the rating half of the trust line is hidden. No photo at all: **no page** (gate).

### §2 What {price} includes · AV · IMP
- **Job:** makes the all-in price read as generous and closes the "hidden costs?" objection right under the price.
- **Fields:** heading from `price` (AV) or `priceSGD` (IMP). AV items come from Terms (`INCLUSIONS_LINE`, `BOARDING_LINE`, `SURCHARGE_LINE`), `KIT_COUNT` and `KIT_TOTAL` (computed from `starter-kit-items.json`, never typed), and links to `/starter-kit/`, `/delivery/`, `/free-training/`, `/pricing/`. IMP items come from `perks[]` (Imported) and the copy-deck "What's included" line. **Never** from Terms, because imported terms differ (14 days' boarding after arrival, not a month after deposit).
- **Fallbacks:** no price means no AV page (gate). IMP with empty `perks[]` shows the section with the copy-deck sentence only. **PL: hidden** (no price on a placed page).

### §3 Thirty free gifts (starter-kit marquee, two rows) · AV · IMP · PL
- **Job:** shows the 30 real kit items with photos so "starter kit" is concrete. It is the page's strongest value proof.
- **Fields:** `src/data/starter-kit-items.json` (name, category, price, photo), `KIT_COUNT`, `KIT_TOTAL`. The heading number is spelled from `KIT_COUNT`. Today's "Thirty" is a literal, and the template computes it instead.
- **Fallbacks:** hidden when the kit file has fewer than 8 items (it cannot fill a row). No per-puppy data. On PL it stays, as in K-124, because the kit comes with every puppy.

### §4 About {name} — the dossier · AV · IMP · PL
- **Job:** the one place the puppy is described as an individual: five facts at a glance, the portrait, and three short cards (the breed, what is already done, next step).
- **Fields:** tag `name` · `id`. Chips: Breed `breedFacts.parentage` ("Maltipoo, Maltese × Toy or Mini Poodle"), else `crossLabel ?? breedName`; Colour `color` (IMP `colours[]` joined); Sex `gender` (IMP `sexLine(sex)`); Age from `dob` at build time, else `age`; Area `location` → "Balestier" (IMP: "Arriving {Month YYYY}"). Portrait: `images[0]`. Card 01 "The breed": `breedFacts.temperament`, which is **breed-level copy from the published breed page and never about this puppy**. Card 02 "Already done": AV/PL shop policy sentence (Terms). IMP copy deck: the import checks happen before the flight. Card 03: variant copy plus a WhatsApp CTA.
- **Fallbacks:** each chip hides on null, and the row reflows. No `breedFacts`: card 01 is dropped and the grid shows two cards (named visual compromise C4). No name: "About this puppy".

### §5 Happy Curious Tails families (handover photo marquee) · AV · IMP · PL
- **Job:** About's proof. Real families at the real shop, directly under the puppy's description.
- **Fields:** `src/assets/testimonials/*.webp` (128 files today). No names exist in that data, so none are shown.
- **Fallbacks:** hidden when fewer than 6 photos are on file. Site-wide, no per-puppy data.

### §6 Is a {breed} right for your home? · AV · IMP · PL
- **Job:** breed fit, so the right families enquire and the wrong ones self-select out before a visit.
- **Fields:** `breedFacts[breed]`: `size`, `coat`, `exercise`, `lifespan`, `fitIf[]`, `thinkTwiceIf[]`, `guideAnchors{}`. Guide link to `/puppies/<breed>/` only if that route exists in `ROUTES` (registry).
- **Fallbacks:** **hidden** when the breed has no facts entry. Breed facts are never written for a breed whose own page does not state them. For a cross with `crossLabel`, facts are read under the cross's own key and never the base breed's.

### §7 Final CTA — "Could {name} be the one?" · AV · IMP · PL
- **Job:** the decision point right after the fit question, as the owner ordered in K-124.
- **Fields:** `name`, `id`, `bookHref`, `breedName`, `whatsappLink()`, `HELP_FIND_LINE` (Terms). PL: `SIMILAR_PUPPY_LINE`. IMP: copy deck "Reserve this puppy" / "Ask about the next one" (`status === 'reserved'`).
- **Fallbacks:** no name gives "Could this puppy be the one?", and no `bookHref` gives a WhatsApp booking prefill.

### §8 {name}'s health record · AV (IMP has its own content in this slot)
- **Job:** "is it healthy?" Stamps, the Singapore vaccination schedule, the five-day promise, the clinic that does the remaining core vaccines, and the Pet Ownership Course link.
- **Fields:** AV `VACCINATION_ROWS`, `RECORDS_LINE`, `POC_URL`, `vetsForPetsHtml()` (Terms). The five-day promise uses Terms wording (to be moved there, task T03). The "ready to go home" node date comes from `dob` + 63 days, labelled "about". IMP: the three copy-deck promise cards (five-day promise with vet fees, boarding on arrival, arrival estimate), which are already live in `ImportedPuppyDetail.astro`.
- **Fallbacks:** no `dob`: the home node reads "About week 9 · ready to go home" with no date. A derived ready date already in the past reads "Ready to go home now". There are **never per-puppy vaccination dates**, because no source holds them (§2.5). **PL: hidden.**

### §9 Payment methods · AV
- **Job:** removes the last practical question before a deposit.
- **Fields:** `PAYMENT_LINE`, `SURCHARGE_LINE` (Terms). **Conflict, owner decision D1:** the prototype shows two methods (PayNow, Credit Card; "owner-supplied, two methods only"), but `buying-terms.ts` (K-119) says "PayNow, bank transfer, cash at handover, or credit card". The template must render from one source. Until D1 is answered it renders Terms, which gives 4 methods, not 2 (compromise C3).
- **Fallbacks:** none needed (config). **IMP:** hidden. Payment terms for imports (50% deposit, balance before the flight) sit in §10's imported steps, from `depositPct`, `depositSGD` and `balanceSGD`. **PL:** hidden.

### §10 Bringing {name} home, step by step · AV · IMP · PL
- **Job:** "how does buying work?" Five steps from first message to the training lesson.
- **Fields:** AV `RESERVE_STEPS` + `site.hours` + `KIT_COUNT`. PL: the same steps with "your puppy". IMP: the copy deck's four "How reserving an imported puppy works" steps, filled from `depositPct`, `depositSGD`, `balanceDue`, `arrivalEstimate`.
- **Fallbacks:** none needed (config). No deposit amount is ever shown for a local puppy (none in config).

### §11 Meet {name} in Balestier — visit, licence, map · AV · IMP · PL
- **Job:** "is this a real shop?" Address, hours, directions, owners, AVS licence with registry link, and the map, which ends level with the licence panel (K-124 geometry).
- **Fields:** Site `address.full`, `hours`, `directions`, `ownersLine`, `license.avsNumber`, `license.registryUrl`, `googleMapsEmbed`. Heading: AV `name`; PL "our puppies"; IMP "Visit us in Balestier", because the puppy is not in the shop.
- **Fallbacks:** none (config). CTA row is AV only. A puppy whose `location` is not Balestier cannot reach this page (gate), because "Meet {name} in Balestier" would be false.

### §12 What {breed} families say · AV · IMP · PL
- **Job:** third-party proof, matched to the breed when real reviews allow it.
- **Fields:** `GOOGLE_REVIEWS` (`src/data/reviews.ts`), filtered by a new `reviewsMentioning(breedName | crossLabel)` (verbatim text, reviewer name kept). Score block `site.reviews`.
- **Fallbacks:** with fewer than 2 reviews that name the breed, the heading becomes "What Curious Tails families say" and `reviewsFor(breed, 2)` supplies them. Never "What Maltipoo families say" over reviews that do not mention a Maltipoo. Today's `reviewsFor()` is a hash rotation, not a breed match, so this is a real change (task T07).

### §13 Questions about {name} — FAQ · AV · IMP
- **Job:** objections answered in the buyer's words. The same array emits `FAQPage` JSON-LD, so the visible text and the schema cannot drift.
- **Fields:** `puppyFaq(page)` assembles Q1 availability (`id`), Q2 includes (`price`, Terms), Q3 payment (`SHARED_BUY_FAQ`), Q4 visit (Site, `bookHref`), Q5 HDB (`hdbApproved === true` only, `POC_URL`), Q6 not ready (`BOARDING_LINE`), Q7 vaccinations (`VACCINATION_ROWS`, `VETS_FOR_PETS_LINE`), Q8 sick in 5 days (Terms), Q9 size (`sizeNote` else `breedFacts.size`, labelled as the breed range). IMP: the copy-deck reservation FAQ (already in `ImportedPuppyDetail.astro`).
- **Fallbacks:** a question whose data is missing is dropped from both the list and the schema (Q5 without a tick, Q9 without size data). **PL: hidden.**

### §14 Other puppies available now · AV · IMP · PL (PL: moves to position 2)
- **Job:** the way forward when this puppy is not the one, and the main job of a placed page.
- **Fields:** feed `breeds.*.available[]` minus this `id`, with a photo, same breed first, max 6, rendered by `pupCard()` (existing). IMP: the imported feed for the same breed first, then local.
- **Fallbacks:** hidden when no other puppy has a photo. On PL the section renders in slot 2 (straight after the hero), replacing the prototype's `#others-top-anchor` / `#others-home-anchor` pair. The same component is called with `position="top"`, and there is no DOM move.

### §15 Reserving {name} · AV
- **Job:** the explicit reservation rule (deposit, availability not guaranteed until it is paid) with the reserve CTA at the foot.
- **Fields:** `name`, `id`, `bookHref`, `AVAILABILITY_LINE` (Terms), `whatsappLink()`.
- **Fallbacks:** no name gives "Reserving this puppy". **IMP:** hidden (its reservation rules are §10). **PL:** hidden.

### Sticky action bar · AV · IMP · PL
- Shows once `#hero-ctas` leaves the viewport and hides while `#final` is in view. AV: WhatsApp + Book. PL: "Similar {breed}" + "See puppies". IMP: "Reserve on WhatsApp" + "How reserving works". The BaseLayout WhatsApp float is suppressed on this route (new prop). K-124 flag kept: the bar hides briefly at the mid-page Final CTA.

### Variant matrix

| # | Section | AV | IMP | PL | Data condition |
|---|---|:-:|:-:|:-:|---|
| 1 | Hero | ✓ | ✓ | ✓ | — |
| 2 | What {price} includes | ✓ | ✓ | – | price |
| 3 | Free gifts marquee | ✓ | ✓ | ✓ | kit ≥ 8 items |
| 4 | About (dossier) | ✓ | ✓ | ✓ | — |
| 5 | Families marquee | ✓ | ✓ | ✓ | ≥ 6 photos |
| 6 | Breed fit | ✓ | ✓ | ✓ | `breedFacts[breed]` |
| 7 | Final CTA | ✓ | ✓ | ✓ | — |
| 8 | Health record | ✓ | ✓ (promises) | – | — |
| 9 | Payment methods | ✓ | – | – | — |
| 10 | Next steps | ✓ | ✓ (import steps) | ✓ | — |
| 11 | Visit | ✓ | ✓ | ✓ | — |
| 12 | Reviews | ✓ | ✓ | ✓ | ≥ 1 review |
| 13 | FAQ | ✓ | ✓ | – | ≥ 3 answerable Qs |
| 14 | Other puppies | ✓ | ✓ | ✓ (slot 2) | ≥ 1 other pup |
| 15 | Reserving | ✓ | – | – | — |

Always on, with no condition: §1, §4, §7, §11 (**4**). Conditional: the other **11**. A minimum available puppy (photo, id, breed, price, Balestier, nothing else) renders **15 of 15** if its breed has facts, and **14** if not (§6 drops).

---

## 2. The data contract

`Req` means the page is not published without the field (gate, §5.3). `Opt` means the page renders without it and the "Without it" column says how.

### 2.1 Per-puppy: local feed (`src/data/available-puppies.json` → `breeds.<slug>.available[]`)

| # | Field | Type | Req/Opt | Without it |
|---|---|---|---|---|
| 1 | `id` | number \| string | **Req** | No page. |
| 2 | bucket key `<slug>` (breed) | string (breed slug) | **Req** | No page. Puppies in `other[]` (e.g. Daisy 2937, "Corgipoo") have no breed slug and get no page, as today. They stay on `/available-puppies/`. |
| 3 | `image` | string (file in `src/assets/live/`) | **Req** | No page. |
| 4 | `price` | number (SGD) | **Req** (AV) | No page. The card still lists the pup with "Ask for price" (existing card behaviour). |
| 5 | `location` | string, must normalise to Balestier | **Req** (AV) | No page. The sync's area gate also admits Choa Chu Kang. A CCK puppy would make §11's "Meet {name} in Balestier" false. |
| 6 | `name` | string \| null | Opt | H1 `{Color} {Breed} {Girl\|Boy}`, headings "this puppy". Gate warning. |
| 7 | `gender` | `'Male' \| 'Female'` \| null | Opt | Noun "Puppy", pronouns they/them, Sex chip hidden. |
| 8 | `color` | string \| null | Opt | Dropped from H1, meta and alt. Colour chip hidden. |
| 9 | `dob` **(new, from the sheet's `DOB-`)** | ISO date \| null | Opt | Age falls back to `age`. Ready-date node generic. No DOB in schema. |
| 10 | `age` | string \| null | Opt | Age chip and meta age hidden (4 of 9 live puppies have `age: null` today). |
| 11 | `images[]` **(new, from `Image-`…`Image5-`)** | string[] (≤ 5) | Opt | Single plate + ask-for-video tile (the normal case). |
| 12 | `video` | URL \| null | Opt | "Ask for a video of {name}" slide (9 of 9 are null today). No `VideoObject`. |
| 13 | `bookHref` | URL \| null | Opt | Book a viewing → WhatsApp booking prefill. |
| 14 | `hdbApproved` | `true` \| null | Opt | No HDB chip, FAQ Q5 dropped, no "HDB approved" in meta. Null means unknown, never "no". |
| 15 | `crossLabel` | string \| null | Opt | Breed name used. When set, it replaces the breed noun everywhere (H1, chips, alt, schema). A cross is never called the pure breed. |
| 16 | `sizeNote` | string \| null | Opt | FAQ Q9 uses `breedFacts.size`, labelled "{Breed}s usually…". Both missing: Q9 dropped. |
| 17 | `origin` | string \| null | Opt | Not displayed by the prototype. Kept in data, unused by the template. |
| 18 | `location` display form ("Balestier Area" → "Balestier") | derived from row 5 | — | Not a separate input. Listed so the chip and H2 never print the raw sheet value. |
| 19 | file root `syncedAt` | ISO datetime | Opt | Hero availability line uses the cautious form (H6). |

### 2.2 Per-puppy: placed (`src/data/placed-archive.json` → `pups[]`, via `placedPups()`)

| # | Field | Type | Req/Opt | Without it |
|---|---|---|---|---|
| 20 | `status === 'placed'` + `evidence` | enum + string | **Req** | No page. `withdrawn`/`expired` 301 to the breed page (existing `puppy-redirects.mjs`). |
| 21 | `id`, `breed`, `image` | as 2.1 | **Req** | No page (existing rule: retention + real photo). |
| 22 | `placedAt` (+ `lastListed`) | ISO date | Opt | "Found her family" without a month (`placedWhen()` returns null). |
| 23 | `name`, `color`, `gender`, `hdbApproved`, `crossLabel`, `sizeNote` | as 2.1 | Opt | As 2.1. |
| — | `price`, `bookHref`, `video`, `dob` | not held | — | Not needed: PL shows no price, no booking, no age. |

### 2.3 Per-puppy: imported (`src/data/imported-puppies.json` → `pups[]`, via `importedPups()`)

| # | Field | Type | Req/Opt | Without it |
|---|---|---|---|---|
| 24 | `id` (`imp-<10 hex>`) | string | **Req** | No page (existing route rule). |
| 25 | `status` ∈ `published`, `reserved` | enum | **Req** | No page. Only the pipeline writes it, after the gates and `approve:import`. |
| 26 | `breed` | string (slug) | **Req** | No page. |
| 27 | `photos[]` (≥ 1, file in `src/assets/imported/`) + `photoAlt[]` | string[] | **Req** | No page. |
| 28 | `priceSGD` | number | **Req** | No page. |
| 29 | `arrivalEstimate` (`YYYY-MM`) + `arrivalBasis` | string + enum | **Req** | No page. Month precision only. |
| 30 | `depositPct`, `depositSGD`, `balanceSGD`, `balanceDue` | numbers + enum | **Req** | No page (§10 steps cannot be stated). |
| 31 | `sex` `{male, female}`, `colours[]` | counts + string[] | Opt | Kicker and chips omit them. Zero counts omitted (`sexLine`). |
| 32 | `name`, `ref`, `breedLabel`, `crossLabel`, `dob`, `age`, `hdbApproved`, `perks[]` | various | Opt | As 2.1. `ref` falls back to `id` on the stamp. |

### 2.4 Breed level

| # | Field | Source file | Type | Req/Opt | Without it |
|---|---|---|---|---|---|
| 33 | `breedName(breed)` | `src/data/breed-names.ts` | string | **Req** | Build error (no human breed name), never a slug on the page. |
| 34 | `/puppies/<breed>` route | `src/data/registry.ts` (`ROUTES`) | route | Opt | Breadcrumb skips the breed crumb. §6 "More about" links and the guide link hidden. |
| 35 | `breedFacts[breed].parentage` | **new** `src/data/breed-facts.ts` | string | Opt | Breed chip shows `crossLabel ?? breedName`. |
| 36 | `breedFacts[breed].temperament` | new | string (one sentence) | Opt | Dossier card 01 dropped (C4). |
| 37 | `breedFacts[breed].size` / `.coat` / `.exercise` / `.lifespan` | new | strings | Opt | Each fact tile hides. With all four missing, §6 hides. |
| 38 | `breedFacts[breed].fitIf[]` / `.thinkTwiceIf[]` | new | string[] (2–4 each) | Opt | §6 hides (it needs both columns). |
| 39 | `breedFacts[breed].guideAnchors` | new | `{temperament?, size?, hdb?, grooming?}` | Opt | That "More about" link hides. Each anchor is checked against the built breed page (T04). |
| 40 | reviews naming the breed | `src/data/reviews.ts` `GOOGLE_REVIEWS` | verbatim review[] | Opt | Generic heading + `reviewsFor()` (§12). |

**There is no `breedFacts` today.** Biscuit's facts were copied by hand from `/puppies/maltipoo/`. The new file is filled one breed at a time, and only with sentences already published on that breed's own page (T04). The breeds with stock today are bichon-frise, cavachon, cavapoo, cockapoo, maltese, maltipoo and toy-poodle (7 slugs). Those 7 are the first batch. Any other breed renders without §6 until its entry lands.

### 2.5 Site config and copy deck

| # | Field | Source file | Type | Req/Opt | Without it |
|---|---|---|---|---|---|
| 41 | `site.whatsapp`, `whatsappLink()` | `src/data/site.ts` | string/fn | **Req** | Build error. |
| 42 | `site.address.full`, `site.hours`, `site.directions`, `site.ownersLine` | `site.ts` | strings | **Req** | Build error (§11 cannot render). |
| 43 | `site.license.avsNumber`, `.registryUrl` | `site.ts` | strings | **Req** | Build error. |
| 44 | `site.googleMapsEmbed` | `site.ts` | URL | Opt | Map column shows the "Open in Google Maps" link card only (C6). |
| 45 | `site.reviews.count`, `.rating` | `site.ts` | number | Opt | Trust-line rating and §12 score hidden. |
| 46 | `INCLUSIONS_LINE`, `SURCHARGE_LINE`, `BOARDING_LINE`, `AVAILABILITY_LINE`, `RESERVE_STEPS`, `VACCINATION_ROWS`, `RECORDS_LINE`, `POC_URL`, `vetsForPetsHtml()`, `SIMILAR_PUPPY_LINE`, `HELP_FIND_LINE`, `SHARED_BUY_FAQ` | `src/data/buying-terms.ts` | strings/arrays | **Req** | Build error. One source for every page that states the terms (K-119). |
| 47 | `PAYMENT_LINE` | `buying-terms.ts` | string | **Req** | Build error. **D1** decides its wording. |
| 48 | five-day promise sentence (`FIVE_DAY_LINE`, new) | `buying-terms.ts` | string | **Req** | Build error. Today it is typed in three places. |
| 49 | `KIT_COUNT`, `KIT_TOTAL`, kit items | `src/data/starter-kit-items.json` via `buying-terms.ts` | computed | **Req** | Build error. §3 hides only on < 8 items. |
| 50 | families photos | `src/assets/testimonials/*.webp` | images | Opt | §5 hides (< 6). |
| 51 | local copy deck (headings, prefills, card copy as `(page) => string`) | **new** `src/data/puppy-page-copy.ts` | functions | **Req** | Build error. |
| 52 | imported copy deck | `src/lib/imported-puppies.ts` (from `reports/imported-puppy-copy-deck-2026-11-08.md`) | functions | **Req** (IMP) | Build error. |

**Required-field count: 24 rows** (1–5, 20–21, 24–30, 33, 41–43, 46–49, 51–52). Rows 21 and 46 each group fields that are always required together. **Per-puppy blockers for a thin local puppy: 5** (rows 1–5).

### 2.6 Things a section wants that no source holds

| Wanted by | Field | Decision |
|---|---|---|
| §8 per-puppy vaccination dates | `vaccinations[]` | **Dropped from the template.** The schedule renders as "the schedule every puppy follows". Add it only if the sheet gains real `Vacc1-`… columns, then make it conditional. |
| §1 / §4 microchip | microchip number | **Never displayed** (no source, and it is not buyer-facing). "Microchipped" is a shop-policy chip for local puppies. Imported microchips go in the private reservation confirmation only (copy deck §7). |
| §4 per-puppy personality | `temperamentNote` | **Dropped.** No column holds it. The breed card speaks for the breed, labelled as the breed. |
| §4 parents | `parents{}` | **Dropped.** There is no parent data, and no parent claim is made without it. |
| §6 adult weight for this puppy | `adultWeightEstimate` | **Dropped.** `sizeNote` (feed) is used if present, else the breed range, labelled. |
| §11 owner/shop photo | photo | **Dropped** (the K-002 data gap still stands). There is no AI imagery on this route. |
| §1 "checked {date}" | per-puppy availability check | **Not held.** `syncedAt` is per feed, not per puppy. See H6. |

---

## 3. Honesty rules, restated for a template

A template writes the same sentence onto every puppy, so one bad default becomes a hundred false claims. These rules are enforced in code (the gate and `check:puppy-pages`, T13), not just in review.

- **H1 No invented temperament.** No per-puppy personality, behaviour or "loves cuddles" line, ever. The only temperament text is `breedFacts.temperament`: one sentence copied from the published breed page and shown as breed copy ("Maltipoos are…"), never "{name} is…". The current `PuppyDetail.astro` fallback, `'friendly and family-oriented'`, which every breed outside three hard-coded ones gets, **is deleted** because it is invented.
- **H2 No invented dates.** DOB comes only from the sheet's `DOB-`. Age and the ready date are derived from it at build time and labelled "about". The placed month comes only from `placedAt` via `placedWhen()`. The arrival month comes only from `arrivalEstimate`, at month precision, "subject to import approval". There are no vaccination dates (no source) and no "available until", "last chance" or countdown.
- **H3 No reviews of our own making.** Only verbatim `GOOGLE_REVIEWS` with the reviewer's name. No review or `aggregateRating` on the puppy's `Product`, because business reviews stay on the business node. No review is attributed to a puppy. A breed-specific heading appears only over reviews that name the breed. Families photos carry no names, and none are added.
- **H4 No guarantee.** "Guarantee" never describes something we promise. The two permitted uses are negations: `AVAILABILITY_LINE` ("not guaranteed until the deposit is received") and the breed-fit "teacup size … no honest seller can promise it". The five-day promise is worded exactly as in Terms. Imported arrival is "estimated", never "guaranteed arrival" (copy-deck ban list).
- **H5 No price of our own.** The price is `price` (feed) or `priceSGD` (imported), printed as-is. Never computed, rounded, discounted, "from", or compared. The "$500–$2,000 below" claim stays on `/pricing/` only. No local deposit amount (none in config). The kit value is `KIT_TOTAL`, computed. A `Product`/`Offer` is emitted only when the price is visible.
- **H6 The availability line is not a freshness check.** The prototype writes "Available now · {today's date}" in the browser. With a feed synced on 2026-11-01 and a page viewed on 2026-11-14, that dates a 13-day-old fact as today. Template rule (owner decision **D2**): print today's date only while `syncedAt` is within the `feed:check` freshness window. Otherwise print "Available at our last update · Balestier · WhatsApp to confirm". Either way the date is never called "checked".
- **H7 Never stated from a blank.** `hdbApproved: null` is unknown, so there is no HDB chip and no HDB answer. A cross is never called the pure breed. `location` comes from the feed only. Breed facts come from the breed's own page only. No AI or stock image of a puppy, family or shop.

**Never generated per puppy (named list):** personality/temperament, parent details, adult size or weight (unless `sizeNote`), vaccination dates, microchip number, health conditions or test results, ready date without a DOB, scarcity or "only one left", review text or reviewer, HDB status without a tick, price or deposit, "pedigree", "DNA", "hypoallergenic" as a promise, and any GST statement.

---

## 4. Variant mechanics and what extraction costs the design

**Pattern.** `only-av` / `only-placed` stay as the authoring vocabulary and `only-imp` is added. In the component tree each becomes `<Only on="av|imp|pl">` (a 6-line wrapper that renders its slot or nothing). The CSS hide rules (`body.is-placed .only-av{display:none}`) are not ported. Section order is one array per variant in `src/lib/puppy-page.ts`:

```
AV  = [hero, includes, gifts, about, families, fit, final, health, payment, next, visit, reviews, faq, others, reserve]
IMP = [hero, includes, gifts, about, families, fit, final, health(imp), next(imp), visit, reviews, faq(imp), others]
PL  = [hero, others, gifts, about, families, fit, final, next, visit, reviews]
```

**Named visual compromises.** Each is small, but each is real:

- **C1 Site chrome replaces prototype chrome.** The prototype has its own header, utility bar and placeholder footer. Production uses `BaseLayout`, `Header` and `Footer`. The prototype's CSS tokens (`--cream-100`, `--lilac-900`…) must map onto `global.css`'s `--color-*` tokens. Any token without an exact match is listed in T02 and approved, not silently re-coloured.
- **C2 One H1 in the HTML.** No visual change, but the prototype's hidden duplicate texts disappear from the markup. Screenshots must match. HTML diffs will not.
- **C3 Payment cards.** If D1 keeps Terms' four methods, §9 shows 4 cards or a 2+2 layout, not the prototype's 2. If the owner confirms "two methods only", `PAYMENT_LINE` changes in Terms and the 2-card layout stays.
- **C4 Dossier with two cards.** A breed without `breedFacts.temperament` loses card 01. The grid must hold at 2 cards without a hole (T08 shot at 1440/390).
- **C5 Band rhythm when sections drop.** K-124 already flagged Payment and Next steps as adjacent plain bands. When §6 or §2 drops, two same-tone bands can meet. Band tones are assigned per rendered sequence (`src/lib/section-rhythm.ts`), not hard-coded per section, so a dropped section never leaves two identical bands touching.
- **C6 No map.** If `googleMapsEmbed` is absent, the right column becomes the link card, and the K-124 "map ends level with licence" rule is satisfied by stretching the card.
- **C7 Gallery with 3–5 photos is untested in the prototype** (Biscuit has one photo). The thumbs row with 6 items gets its own shot set before migration.

---

## 5. Migration plan

### 5.1 How current listings move
1. **Data first (T01).** `sync-puppies.mjs` starts writing `dob` (ISO) and `images[]` (all real `Image-`…`Image5-` files, each through the existing overlay check) next to the existing `image`. The fields are additive, so every current reader keeps working.
2. **Build the template beside the old page (T02–T12).** `src/components/puppy-page/` and `src/lib/puppy-page.ts` are added. `[id].astro` gets a switch, `PUPPY_TEMPLATE=v2` (env, default off), that sends the paths through the new tree.
3. **Preview parity (T15).** Preview deploy with v2 on. Every current page renders: the 9 available puppies with photos and every placed puppy inside retention (42 puppy pages in the last `dist/` build). Biscuit's v2 page is screenshot-compared with the prototype at 1440/1280/1024/768/390, with the K-124 map/licence Δ = 0 check re-run. Every other puppy gets the same five shots plus the null-field render audit.
4. **Switch (T16).** `[id].astro` uses the template for all three kinds. `PuppyDetail.astro` and `ImportedPuppyDetail.astro` are deleted in the same commit, after `rg` shows no other importer. URLs, `pupPageSlug`, `puppy-redirects.mjs`, the sitemap exclusion for `imp-*` and `noindex,follow` on imported pages are all unchanged. The route count before and after must be equal (`check:redirects` unchanged).
5. **Production deploy** only after the owner signs off the preview. That is a separate card, not this plan.

### 5.2 What happens to the prototype
`outputs/puppy-page-redesign-biscuit.html` stays as the frozen design reference: noindex, served only on the staging `/outputs/` path. On switch-over, its header comment gets one line: "Superseded by src/components/puppy-page/ (K-128). Reference only. Do not edit." `outputs/build-biscuit-stage.py` and the `_k002_stage` mirror are retired. Future design changes are made in the components, and the prototype is never updated again. Its screenshots at the five widths become the visual baseline the template is tested against.

### 5.3 How a future puppy is published
- **Who writes what:** shop staff fill one row in the puppy Google Sheet (SpreadSimple feed): ID, Breed, Name, Color, Gender, DOB, Price, Image…Image5, Location, HDBApproved, CalLink, Video. Nobody writes a page or copy. `npm run sync:puppies` (in `build:deploy` and the scheduled automation) writes `src/data/available-puppies.json`. Astro builds `/puppies/<breed>/<id>-<colour>-<girl|boy>/` from it. Imported puppies: `sync:imports` writes `imported-puppies.json` only after the import gates and `approve:import` (unchanged). Placed: the sync moves the row to `placed-archive.json`, and the same URL flips to the PL variant.
- **The gate** (`publishable()` in `src/lib/puppy-page.ts`, run in `getStaticPaths` and by `npm run check:puppy-pages`):
  - **Blockers** (no page is built): missing `id`, no breed slug, no real photo, no `price` (AV), `location` not Balestier (AV). Imported: the existing feed rules plus rows 24–30.
  - **Warnings** (the page builds, and the puppy is listed in the gate report): no `name`, no `gender`, no `color`, no `dob` and no `age`, no `breedFacts` for the breed, no `hdbApproved`.
  - **Hard fails** (the build stops): a banned word or a "null"/"undefined"/"a apricot" artefact in any built puppy page. Also any `Product` without a visible price, or `FAQPage` text that differs from the visible FAQ.
- **What happens when it is thin:** a blocked puppy still appears as a card on `/available-puppies/` and its breed page, with "Ask for price" or WhatsApp, exactly as today. It just has no page of its own. `check:puppy-pages` writes the reason to `NEEDS-ATTENTION.md` ("2991 Cocoa: no price in the sheet"), so staff fix the sheet row. The next sync publishes the page with no code change.

---

## 6. Owner decisions needed before migration

| # | Decision | Default if unanswered |
|---|---|---|
| D1 | Payment methods: the prototype's "PayNow or credit card" vs `buying-terms.ts`'s "PayNow, bank transfer, cash at handover, or credit card" | Render `buying-terms.ts` (it is the K-119 single source). Flag the 2→4 card change on the preview. |
| D2 | Availability line: today's date only while the feed is fresh (H6) | Apply H6, with a freshness window equal to `feed:check`'s threshold. |
| D3 | A Choa Chu Kang puppy: no page (gate), or a CCK visit variant | No page. The card still lists it. |
| D4 | `breedFacts` for breeds without enough published facts on their own page | §6 hidden for that breed. Never written from outside sources. |

---

## 7. Acceptance for the implementation (carried into the tasks)

- A puppy that exists only as a test fixture (one photo, ID, breed, price, Balestier; every optional field null) builds a page with no hand edits. That page has one H1, no empty section, no "null"/"undefined", no "a apricot", and no hidden-branch text in the HTML. Its title is ≤ 60 characters and its meta ≤ 155 (T14).
- The same fixture as PL renders with no price, no `Product`, no `FAQPage`, and Others in slot 2. As IMP it renders `noindex,follow` with the arrival month and no local terms.
- Biscuit's v2 page matches the prototype screenshots at 5 widths. The map/licence Δ = 0 at 1440/1280/1024, and there is no overflow at 390.
- `npm run build`, `check:schema`, `check:schema:req`, `check:links`, `check:content`, `check:all-in`, `check:contrast`, `check:design`, `check:health`, `test:imports` and the new `check:puppy-pages` / `test:puppy-page` all pass. The route count equals the live count, and redirects are unchanged.
