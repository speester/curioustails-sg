# On-Page Fixes: William Goh Pet Farm (2026-07-12)

> **DRAFT for human review.** Nothing here has been published. All copy, schema, and
> metadata below is a proposal for the owner (Nelson) and/or whoever has WordPress/Rank
> Math access to implement. Pages fetched live on 2026-07-13 to confirm current state
> before drafting: home, `/contact-us/`, `/puppies-for-sale/`, `/corgi-puppies-for-sale/`,
> `/cavapoo-puppies-for-sale/`, `/dachshund-puppies-for-sale/`, `/faq/`,
> `/24-hour-vet-clinics/`, `/about/`.

## Required owner decision before publishing (do not resolve myself)

The site currently makes **three different, irreconcilable "years in business" claims**:
homepage tagline says "over 40 years," breed-page titles/metas (per the technical audit)
say "50 years," breed-page body copy says "since the 1960s," and the Google Business
Profile description says "AVS-licensed Singapore breeder since 2020." These cannot all be
true at once, and publishing any one of them risks a credibility hit if a buyer cross-checks
GBP against the site. **I have not picked one.** Every piece of new copy below is written
to avoid stating a specific number — using phrasing like "a family-run pet farm in Sungei
Tengah" instead. Once the owner confirms what the real figure refers to (personal breeding
experience predating this premises? the premises itself? a marketing round-up?), the
first-fold copy below can be tightened to include it.

A second, smaller data note: the keyword map's live SERP pull shows the GBP at 4.6★/65
reviews; client.md's confirmed canonical figure is 4.5★/64 reviews. The gap is one review
old vs. new snapshot, not a conflict. All schema/copy below uses **4.5★, 64 reviews** as
the anchor (the explicitly confirmed figure) — refresh both if the rating moves before
publishing.

---

## Metadata rewrites

| URL | Current title | New title (chars) | Current meta description | New meta description (chars) | Target keyword |
|---|---|---|---|---|---|
| `/` (home) | "Home - William Goh Pet Farm" (generic, audit-confirmed) | **Pet Farm Singapore \| William Goh Pet Farm, Sungei Tengah** (56) | `"Over 40 years of breeding exprience"` — literal typo ("exprience"), only 38 chars | **A family-run, AVS-licensed pet farm in Sungei Tengah, rated 4.5★ (64 reviews). Puppies across 25+ breeds, viewing by appointment — book on WhatsApp.** (148) | pet farm singapore |
| `/about/` | "About - William Goh Pet Farm" (generic) | **AVS-Licensed Dog Breeder in Sungei Tengah \| William Goh Pet Farm** (58) | Not confirmed in crawl — verify current value in Rank Math before overwriting | **William Goh Pet Farm is a family-run, AVS-licensed dog breeder (AF23009) in Sungei Tengah, Singapore, rated 4.5★. Meet the team and book a visit.** (149) | dog breeder singapore |
| `/contact-us/` | "Contact Us - William Goh Pet Farm" (generic) | **Visit Us in Sungei Tengah, Singapore \| William Goh Pet Farm** (59) | Not confirmed in crawl — verify current value in Rank Math | **Come visit William Goh Pet Farm at Block L, 59 Sungei Tengah Rd #01-19, Singapore 699014. Open daily 10am–6pm, viewing by appointment. Call +65 9792 1567.** (154) | sungei tengah |
| `/puppies-for-sale/` | "Best Quality Puppies For Sale In SG (July 2026)" — abbreviation + rolling date | **Puppies for Sale in Singapore \| William Goh Pet Farm** (52) | Not confirmed in crawl | **Browse puppies for sale in Singapore across 25+ breeds at William Goh Pet Farm, Sungei Tengah — AVS-licensed, 4.5★ rated. Book your visit on WhatsApp.** (150) | puppy for sale singapore |
| `/corgi-puppies-for-sale/` | "Cute Corgi Puppies For Sale In SG (July 2026 Updated)" — abbreviation + rolling date | **Corgi Puppies for Sale in Singapore \| William Goh Pet Farm** (58) | Not confirmed in crawl | **Corgi puppies for sale in Singapore at William Goh Pet Farm, Sungei Tengah — HDB-approved, AVS-licensed, 4.5★ rated. See pricing & photos on WhatsApp.** (150) | corgi puppy singapore price / corgi puppies for sale singapore |
| `/cavapoo-puppies-for-sale/` | Same "SG" + rolling-date pattern (unconfirmed exact string) | **Cavapoo Puppies for Sale in Singapore \| William Goh Pet Farm** (60) | Not confirmed in crawl | **Cavapoo puppies for sale in Singapore at William Goh Pet Farm, Sungei Tengah — HDB-approved, hypoallergenic, AVS-licensed. See pricing on WhatsApp.** (149) | cavapoo singapore / cavapoo puppy for sale singapore |
| `/dachshund-puppies-for-sale/` | Same "SG" + rolling-date pattern (unconfirmed exact string) | **Dachshund Puppies for Sale in Singapore \| William Goh Pet Farm** (62 — trim brand if needed) | Not confirmed in crawl | **Dachshund puppies for sale in Singapore at William Goh Pet Farm, Sungei Tengah — mini & standard, AVS-licensed, 4.5★ rated. See pricing on WhatsApp.** (149) | dachshund singapore / mini dachshund singapore |
| `/faq/` | "New Puppy Owner Commonly Asked Questions (Updated 2026)" (fine, keep) | *(keep current title — not broken)* | `"...e've got answers to your puppy questions here"` — missing leading "W" | **We've got answers to your puppy questions — vaccinations, feeding, toilet training and more — from William Goh Pet Farm in Sungei Tengah, Singapore.** (148) | puppy care faq singapore |
| `/24-hour-vet-clinics/` | "Complete List of 24-Hour Vet Clinics in Singapore 2021" — stale year baked into title | **24-Hour Vet Clinics in Singapore — 2026 Updated List** (52) | Not confirmed in crawl | **Need a vet fast? An updated list of 24-hour and emergency vet clinics across Singapore — addresses, phone numbers, and services, from William Goh Pet Farm.** (155) | vet near me / vets near me |

> NEEDS DATA: exact current meta descriptions for every row marked "not confirmed in
> crawl" — WebFetch's markdown conversion strips `<meta>` tags reliably only where the
> audit already logged them verbatim (home, FAQ). Whoever implements should pull the
> live Rank Math field for each page as a final diff check before overwriting.

> Strategic caution on `/24-hour-vet-clinics/`: "vet near me" (9,900/mo) is a Local Pack /
> Maps-intent query — Google typically satisfies it with nearby vet clinic listings, not
> a blog roundup, and William Goh Pet Farm is not itself a vet clinic. Retitling and
> refreshing the stale 2021 date is worth doing (it's actively hurting freshness signals
> for no reason), but don't expect this alone to move a 9,900-vol query from position
> ~70–98 to page 1. The more realistic win here is qualified referral traffic + an
> internal link back to the farm's own vet-partner relationship ("Vets For Pets," per
> GBP) — see Internal links below.

---

## H1 fixes

| URL | Current H1 | New H1 | Intent it matches |
|---|---|---|---|
| `/` (home) | **Bug:** two separate `<h1>` tags — "William Goh" then "Pet farm" | **William Goh Pet Farm — Dog Breeder & Pet Farm in Sungei Tengah, Singapore** | pet farm singapore / dog breeder singapore (both P1, both mapped to home) |
| `/puppies-for-sale/` | **Bug:** populated H1 "Find Your Perfect Puppy for Sale in Singapore at the Best Pet Shop" immediately followed by an empty `<h1></h1>` (Divi responsive-breakpoint artifact) | **Puppies for Sale in Singapore — 25+ Breeds at William Goh Pet Farm** (remove the empty second `<h1>` entirely; drop the vague "Best Pet Shop" superlative) | puppy for sale singapore |
| `/contact-us/` | "Come Visit Us" (not a bug, but not locally optimized) | **Come Visit Us at the Pet Farm in Sungei Tengah** (keeps the exact brand-voice phrase "Come Visit Us At The Pet Farm," adds the location term ranked at pos 44) | sungei tengah / dog breeder near me |
| `/corgi-puppies-for-sale/` | "Corgi Puppies For Sale" (not a bug, not locally optimized) | **Corgi Puppies for Sale in Singapore \| Visit Our Sungei Tengah Farm** | corgi puppies for sale singapore + visit-the-farm differentiator |
| `/cavapoo-puppies-for-sale/` | "Cavapoo Puppies For Sale" | **Cavapoo Puppies for Sale in Singapore \| Visit Our Sungei Tengah Farm** | cavapoo singapore (open competitive gap) |
| `/dachshund-puppies-for-sale/` | "Dachshund Puppies For Sale" | **Dachshund Puppies for Sale in Singapore \| Visit Our Sungei Tengah Farm** | dachshund singapore / mini dachshund singapore |
| `/24-hour-vet-clinics/` | "Complete List of 24-Hour Vet Clinics in Singapore 2021" (stale year baked in) | **24-Hour Vet Clinics in Singapore** | vet near me (evergreen phrasing, no rolling date to go stale again) |
| `/faq/` | "Frequently Asked Questions" | *(no change needed — not broken, adequate for an FAQ page)* | puppy care faq |

---

## Heading outline

### Homepage
```
H1: William Goh Pet Farm — Dog Breeder & Pet Farm in Sungei Tengah, Singapore
  H2: A Family-Run Pet Farm You Can Visit           [pet farm singapore, dog breeder near me]
  H2: Puppies Across 25+ Breeds                     [puppy for sale singapore]
    H3: HDB-Approved Breeds
    H3: Small Breeds
    H3: Large Breeds
    H3: Mixed Breeds
  H2: Our Specialty Breeds                          [corgi / cavapoo / dachshund singapore]
    H3: Corgi Puppies
    H3: Cavapoo Puppies
    H3: Dachshund Puppies
  H2: Why Buy From William Goh Pet Farm             [AVS licensed, 4.5★, starter kit]
  H2: Visit the Farm in Sungei Tengah               [sungei tengah dog farm]
  H2: What Our Customers Say                        [trust/reviews]
```

### `/contact-us/`
```
H1: Come Visit Us at the Pet Farm in Sungei Tengah
  H2: Our Address & Opening Hours                   [sungei tengah, 59 sungei tengah road]
  H2: How to Book a Viewing Appointment              [dog breeder near me]
  H2: What to Expect When You Visit                  [visit-the-farm experience, GEO gap]
  H2: Get in Touch                                    [phone / WhatsApp CTA]
  H2: Find Us on the Map                              [embedded map — currently missing sitewide]
```

### `/puppies-for-sale/`
```
H1: Puppies for Sale in Singapore — 25+ Breeds at William Goh Pet Farm
  H2: HDB-Approved Puppy Breeds                       [hdb approved dog breeds]
  H2: Small Breed Puppies
  H2: Large Breed Puppies
  H2: Mixed Breed Puppies
  H2: Dog or Puppy — Which Is Right for You?          [existing section, keep]
  H2: Visiting William Goh Pet Farm                   [sungei tengah — new, closes GEO gap]
  H2: Frequently Asked Questions                      [existing section, keep — links to /faq/]
```

### `/corgi-puppies-for-sale/` (template — apply same shape to Cavapoo, Dachshund)
```
H1: Corgi Puppies for Sale in Singapore | Visit Our Sungei Tengah Farm
  H2: Introduction                                    [corgi singapore]
  H2: Is a Corgi HDB-Approved?                        [hdb approved — existing implicit content, make explicit]
  H2: Highlights
  H2: Personality & Temperament                       [existing]
  H2: Size & Grooming                                 [existing]
  H2: Health & Upkeep                                 [existing]
  H2: History                                         [existing]
  H2: Exercise & Training                             [existing]
  H2: Nutrition
  H2: Children and Other Pets
  H2: Visit William Goh Pet Farm to Meet Your Corgi Puppy   [NEW — GEO gap]
    H3: Our Sungei Tengah Address
    H3: How to Book a Viewing Appointment
    H3: What to Expect During Your Visit
    H3: Opening Hours
  H2: Corgi Pricing Info                              [existing — corgi price singapore, already rank 2]
  H2: See Why Our Clients Trust Us                     [existing testimonials]
  H2: Available Corgi Puppies                          [existing per-listing cards]
  H2: Corgi Puppies That Found a Loving Home            [existing]
  H2: Frequently Asked Questions
```

### `/faq/`
No structural change to the heading tree — the 15+ accordion Q&As are already well
organized. The fix here is schema (FAQPage, below), not copy.

### `/24-hour-vet-clinics/`
```
H1: 24-Hour Vet Clinics in Singapore
  H2: When You Need a 24-Hour Vet                     [vet near me]
  H2: Full List of 24-Hour & Emergency Clinics         [existing 10-clinic list]
  H2: Our Vet Partner, Vets For Pets                    [NEW — links back to the farm's own vet-partner services per GBP, converts a generic informational page into a soft trust signal for the farm]
```

---

## Money-page copy

### Homepage — first-fold rewrite
**Current:** H1 split across two tags ("William Goh" / "Pet farm"), tagline "Over 40 years
of breeding exprience" (typo, unconfirmed number, and at 38 characters it reads as
truncated/unfinished rather than a real tagline).

**Proposed:**
> ## William Goh Pet Farm
> ### Dog Breeder & Pet Farm in Sungei Tengah, Singapore
> A family-run pet farm in Sungei Tengah — AVS-licensed (AF23009), rated 4.5★ from 64
> reviews. We breed and raise puppies across 25+ breeds, from HDB-approved companions to
> our specialty Corgis, Cavapoos, and Dachshunds. Viewing strictly by appointment.
>
> **[View More Photos & Video on WhatsApp]**  **[Book Your Visit]**

Notes: keeps the verbatim brand CTA "View More Photos & Video on WhatsApp" (per
brand-voice.md), states AVS license + confirmed rating instead of the disputed years
figure, and adds a second CTA specifically for the farm-visit angle the GEO audit flagged
as under-used.

### `/contact-us/` — first-fold rewrite
**Current:** H1 "Come Visit Us," address and phone present only as plain `<h4>` text
lower on the page, no hours, no map, WhatsApp number and main phone both listed without
clear labeling of which is which.

**Proposed:**
> ## Come Visit Us at the Pet Farm in Sungei Tengah
> William Goh Pet Farm is located at **Block L, 59 Sungei Tengah Rd, #01-19, Singapore
> 699014**. We're open daily, **10am – 6pm**. Viewing is strictly by appointment — message
> us on WhatsApp to see more photos and video of available puppies and book your visit.
>
> **Address:** Block L, 59 Sungei Tengah Rd, #01-19, Singapore 699014
> **Phone:** +65 9792 1567
> **WhatsApp (for photos, video & appointments):** +65 8806 6180
> **Hours:** Sun – Sat, 10am – 6pm
>
> [Embedded Google Map here — currently missing sitewide, see technical audit]

Notes: explicitly labels the two numbers (main line vs. WhatsApp) per client.md's
guidance not to treat them as interchangeable; surfaces hours and address as real page
copy instead of only inside sparse `<h4>` tags; flags the map embed slot.

### `/corgi-puppies-for-sale/` — first-fold rewrite
(Chosen per brief default: Corgi is a named specialty with zero current AI citations.)

**Current:** "Corgi Puppies For Sale" H1, intro paragraph describes Corgis as "a fun dog
breed that tends to get along well with everyone," good but thin/generic — no HDB status
called out explicitly in the intro, no visit/location framing, no license/trust anchor.

**Proposed:**
> ## Corgi Puppies for Sale in Singapore
> ### Visit Our Sungei Tengah Farm
> The Corgi is one of our specialty breeds at William Goh Pet Farm — a fun, intelligent,
> and affectionate dog that gets along well with children, other pets, and apartment
> life. Corgis are **HDB-approved** in Singapore, making them one of the most popular
> small-breed choices for flat dwellers.
>
> Every Corgi puppy here is bred at our AVS-licensed (AF23009) premises in Sungei Tengah
> and comes with deworming, microchipping, vaccinations, and a health check. Pricing
> varies by individual puppy — message us on WhatsApp for current availability, photos,
> and video, or book an appointment to meet them in person at the farm.
>
> **[View More Photos & Video on WhatsApp]**  **[Book a Viewing Appointment]**

Notes: this paragraph is written as an answer-capsule (breed + HDB status + what's
included + how to buy) specifically because this page currently holds zero AI citations
for "Corgi" despite being a named specialty — a dense, self-contained factual paragraph
near the top is what GEO/AI-answer engines lift most reliably. Apply the same shape to
Cavapoo and Dachshund once this pattern is approved.

---

## Schema (JSON-LD)

### 1. `LocalBusiness` (home + about) — the priority fix

Layer this into the existing Organization graph Rank Math already emits (don't replace
the whole graph, add this node and `@id`-reference it from Organization). Coordinates are
placeholders — pull the exact lat/long for Block L, 59 Sungei Tengah Rd from Google Maps
("Share" → coordinates) before publishing; do not guess at building-level precision.

```json
{
  "@context": "https://schema.org",
  "@type": "PetStore",
  "@id": "https://wgpetfarm.com/#localbusiness",
  "name": "William Goh Pet Farm",
  "url": "https://wgpetfarm.com/",
  "telephone": "+65 9792 1567",
  "priceRange": "$$",
  "image": "https://wgpetfarm.com/wp-content/uploads/{confirm-hero-image}.jpg",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Block L, 59 Sungei Tengah Rd, #01-19",
    "addressLocality": "Singapore",
    "postalCode": "699014",
    "addressCountry": "SG"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": "CONFIRM: pull exact coordinates from Google Maps listing",
    "longitude": "CONFIRM: pull exact coordinates from Google Maps listing"
  },
  "openingHoursSpecification": {
    "@type": "OpeningHoursSpecification",
    "dayOfWeek": ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    "opens": "10:00",
    "closes": "18:00"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.5",
    "reviewCount": "64"
  },
  "hasMap": "CONFIRM: paste the Google Maps place URL for the GBP listing",
  "sameAs": [
    "CONFIRM: Google Business Profile URL",
    "CONFIRM: Facebook page URL, if one exists",
    "CONFIRM: Instagram URL, if one exists"
  ],
  "areaServed": {
    "@type": "Country",
    "name": "Singapore"
  }
}
```

`PetStore` is a schema.org subtype of `Store` → `LocalBusiness`, which is more specific
than the generic `Organization` node currently on every page — this is the single fix
the technical audit flagged as highest-leverage, since the domain's entire strategy
depends on local-pack eligibility this schema type supports.

### 2. `FAQPage` (`/faq/`) — near-zero-cost win

Only the Q&As with confirmed visible answer text on the live page are schema-eligible
below. Five accordion items on the page currently have a question header but **no
visible answer text** in the crawl ("How to brush puppy teeth?", "How to clean puppy
ears?", "How to trim puppy nails?", "How to toilet train my puppy?", "When & how can I
start training commands to my puppy?") — either the answer lives in an image the crawler
can't read as text, or the copy is genuinely missing. Do not mark these up with schema
until real text answers exist behind them (FAQPage schema requires a real, visible
answer — an empty or image-only "answer" risks a Google structured-data violation).

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What to expect in the first 48 hours?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "With the change in environment, some puppies may be car sick and vomit during transportation on the way back. They may whine when they sleep at night and may have no appetite at first."
      }
    },
    {
      "@type": "Question",
      "name": "My puppy does not eat, what should I do?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "When they first arrive at your house they will feel stress and may lose their appetite. For the next meal, only feed kibbles — if they don't eat, try again after 30 minutes. By the next day, they should be hungry and start eating normally."
      }
    },
    {
      "@type": "Question",
      "name": "What vaccinations are needed?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "A total of 4 vaccinations are needed: 1st at week 6, 2nd at week 8, 3rd at week 12, and 4th at week 16."
      }
    },
    {
      "@type": "Question",
      "name": "When can I start socializing with other dogs / bring for a walk?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "It's advised to only bring your puppy out after the 3rd vaccination."
      }
    },
    {
      "@type": "Question",
      "name": "How many times to feed a day?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Puppy (below 9 months): 2–3 times a day. Adult (9 months or more): 2 times a day."
      }
    },
    {
      "@type": "Question",
      "name": "Can my puppy be left alone?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "No, during the puppy stage they should always be supervised."
      }
    },
    {
      "@type": "Question",
      "name": "When can I sterilise my puppy?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Puppies should be at least 6 months old before sterilisation."
      }
    },
    {
      "@type": "Question",
      "name": "How much do puppies sleep?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Puppies typically sleep 18–20 hours a day."
      }
    }
  ]
}
```

> NEEDS DATA: the remaining ~7 Q&As with real text answers (feeding do's/don'ts,
> essential items list, biting correction, parasite prevention, shower frequency) can be
> added to this array the same way — omitted here to keep this block a manageable,
> reviewable size; extend it to cover all confirmed-answered questions before publishing.

### 3. `BreadcrumbList` (all money pages — currently absent everywhere)

Example for the Corgi page; repeat the pattern for every breed page and for
`/contact-us/`, `/faq/`, `/24-hour-vet-clinics/` (adjust the last item).

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://wgpetfarm.com/" },
    { "@type": "ListItem", "position": 2, "name": "Puppies for Sale", "item": "https://wgpetfarm.com/puppies-for-sale/" },
    { "@type": "ListItem", "position": 3, "name": "Corgi Puppies for Sale", "item": "https://wgpetfarm.com/corgi-puppies-for-sale/" }
  ]
}
```

### 4. `Product` / `Offer` — finding that updates client.md's assumption

client.md flags puppy pricing as "gated behind WhatsApp" and unconfirmed. **That's not
what the live pages show.** Both the Cavapoo page (individual listings from $1,288–$5,988)
and the Dachshund page (individual listings from $3,588–$6,800) display real per-puppy
prices directly on-page, alongside a QR code that pushes to WhatsApp for *more photos and
video*, not for the price itself. This matches the site's existing marketplace-style
listing pattern (ID, gender, color, age, price all shown per puppy).

Given that, `Product`/`Offer` schema is appropriate — but it must be generated
**dynamically per listing** from whatever price is actually live at the time (individual
puppies sell and rotate), not hardcoded into a template. Do not copy the example price
below as a real figure — it's a structural placeholder for whoever wires this into
Rank Math/Divi's dynamic fields:

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Corgi Puppy — {listing ID, pulled dynamically}",
  "brand": { "@type": "Brand", "name": "William Goh Pet Farm" },
  "offers": {
    "@type": "Offer",
    "price": "{pulled dynamically from the live listing}",
    "priceCurrency": "SGD",
    "availability": "https://schema.org/InStock",
    "url": "https://wgpetfarm.com/corgi-puppies-for-sale/",
    "seller": { "@type": "PetStore", "@id": "https://wgpetfarm.com/#localbusiness" }
  }
}
```

### 5. Sitewide bug to flag, not a per-page fix

Every page's `Person` node currently sets `"sameAs":["https://celestial-sanctuary-p4hasq.flywp.xyz"]`
— a FlyWP hosting staging URL leaking into structured data sitewide (confirmed by the
technical audit across all 10 crawled pages). This is a single Rank Math author-schema
setting, not something to patch page by page. Whoever has WP access should remove that
`sameAs` value (or the generic "admin" Person entity entirely) once, globally.

---

## Internal links

| From URL | To URL | Anchor text |
|---|---|---|
| `/` (home) | `/contact-us/` | "Visit our Sungei Tengah farm" |
| `/` (home) | `/corgi-puppies-for-sale/` | "Corgi puppies for sale" |
| `/` (home) | `/cavapoo-puppies-for-sale/` | "Cavapoo puppies for sale" |
| `/` (home) | `/dachshund-puppies-for-sale/` | "Dachshund puppies for sale" |
| `/puppies-for-sale/` | `/faq/` | "New puppy owner FAQs" |
| `/corgi-puppies-for-sale/` | `/contact-us/` | "book a viewing appointment" |
| `/cavapoo-puppies-for-sale/` | `/contact-us/` | "book a viewing appointment" |
| `/dachshund-puppies-for-sale/` | `/contact-us/` | "book a viewing appointment" |
| `/faq/` | `/24-hour-vet-clinics/` | "find a 24-hour vet clinic near you" |
| `/24-hour-vet-clinics/` | `/contact-us/` | "meet our vet-partnered team at the farm" |
| `/contact-us/` | `/puppies-for-sale/` | "browse all 25+ breeds" |

---

## New pages needed

- **`/hdb-approved-dogs/` (or similar) as a real indexable page, not a menu label.**
  The mega-menu item "HDB Approved" currently links to `href="#"` (non-navigating). A
  separate `/hdb-approved-breeds/` blog post exists but isn't the same as a category hub.
  Competitor The Lovely Pets already ranks pos 7–8 for "hdb approved dog breeds" (210
  vol) with a dedicated page; wgpetfarm.com has none. One-line brief: a hub page listing
  every HDB-approved breed the farm sells, each linking to its breed page, with a short
  explainer of HDB pet policy.
- **`/dog-grooming/` service page.** Grooming is an existing on-site service with no
  dedicated landing page. "dog grooming singapore" (590 vol, KD 5–7) is soft competitively
  — both named competitors rank weakly (pos 53–78) for their own grooming pages. One-line
  brief: service page covering dental cleaning, nail trimming, flea spray, pricing (if the
  owner will publish it), and a booking CTA.
- **AVS-licensing / "how to find a reputable breeder" trust page.** Feeds "reputable dog
  breeder singapore" and "licensed dog breeder singapore" (low volume, near-zero
  difficulty) and gives GEO/AI-answer engines a citable trust asset built on the real AVS
  License AF23009 — this is also the strongest available proof point for the domain's
  currently-zero AI citation coverage. One-line brief: what AVS licensing means, how to
  verify a breeder's license on the public registry, and William Goh Pet Farm's own
  license number as a worked example.
- **Not recommended: a separate `/visit-us/` page.** The keyword map flagged the weak
  "sungei tengah" self-ranking (pos 44) as a possible case for a dedicated location page,
  but `/contact-us/` already targets this exact intent and the rewrite above absorbs it —
  a second page competing for the same term would likely cannibalize rather than help.
  Ship the `/contact-us/` fixes first and re-check rankings before considering a split.
- **Deprioritized: Small Breeds / Large Breeds / Mixed Breeds as real category pages.**
  Same architecture gap as HDB Approved (menu items with `href="#"`), but the keyword
  map found no measurable search volume for these exact category names — worth doing
  eventually for UX/crawl-path reasons, not for organic traffic on their own.

---

**Handoff to Client Report Builder:** the two headline fixes here are (1) LocalBusiness/
`PetStore` schema with confirmed NAP, hours, and rating — currently zero anywhere on the
site despite a real, well-reviewed physical premises — and (2) two quick, high-visibility
bugs (duplicate/empty H1s on Home and `/puppies-for-sale/`, typo'd meta descriptions on
Home and FAQ) that are ready to ship today with no dependencies. Flag the "years in
business" conflict as an open owner decision, not a completed fix.
