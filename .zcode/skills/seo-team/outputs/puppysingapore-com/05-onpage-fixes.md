# On-Page Fixes: Puppy Singapore (2026-07-12)

> **DRAFT for human review.** Every rewrite, heading tree, schema block, and link below is a
> recommendation, not a live change. Nothing here has been published. Pages fetched live for
> this pass: homepage, `/all-available-puppies/`, `/corgi/`, `/golden-retriever/`, `/dachshund/`,
> `/toy-poodle/`, `/dog-adoption-singapore/`, `/contact-us/`. All other findings are inherited
> from `02-technical-audit.md` and flagged as such — I did not re-fetch every one of the 30+
> breed pages myself.

## Keyword-to-page map (confirmation pass)

| Keyword cluster (from `01-keyword-map.md`) | Page it targets | Intent | Status |
|---|---|---|---|
| puppy for sale singapore / puppies for sale singapore | Homepage `/` | Transactional | Exists, ranking — optimize in place |
| All-breeds browse / "puppy for sale singapore" (secondary) | `/all-available-puppies/` | Transactional | Exists, ranking — structural fix needed (Pokemon H2s) |
| corgi puppy for sale singapore (140) | `/corgi/` | Transactional | Exists, ranking — optimize in place |
| golden retriever puppy for sale singapore (70) | `/golden-retriever/` | Transactional | Exists, ranking — optimize in place |
| dachshund puppy singapore | `/dachshund/` | Transactional | Exists, ranking — optimize in place |
| toy poodle singapore (210) | `/toy-poodle/` | Transactional | Exists, ranking — title inconsistency found (missing "For Sale") |
| dog adoption singapore / dog for adoption singapore (4,400 each) | `/dog-adoption-singapore/` | Commercial/Transactional | Exists, ranks ~pos 5 — highest-ROI page on the domain, dual-H1 bug confirmed |
| breed-cost/ownership companion terms | **No page exists** | Informational→Commercial | Flagged in "New pages needed" below — Blog Writer's queue |
| dog breeds singapore hub (480) | **No page exists** | Informational | Flagged below |
| types of poodles / poodle mixes | **No page exists** | Informational→Commercial | Flagged below |

---

## Metadata rewrites

Every breed-page row below inherits the site-wide **"Adaptability" meta description bug**
(confirmed live on 13/13 sampled breed pages via `02-technical-audit.md`, and independently
re-confirmed here on `/corgi/`, `/golden-retriever/`, `/dachshund/` during this pass). This is
a **Rank Math dynamic-description template defect** pulling a stray label from the breed
characteristics table. Fixing the template stops the leak on all 30+ breed pages at once;
the per-page descriptions below are what should replace the placeholder once the template
is fixed — they still need to be written/pasted individually, the template fix just stops the
bug from re-appearing on every future breed page.

| URL | Current title | New title | Current meta | New meta | Target keyword |
|---|---|---|---|---|---|
| `/` | "Puppies For Sale - Puppy Singapore" (35 chars) | "Puppy For Sale Singapore \| 40+ Breeds - Puppy Singapore" (55 chars) | "Discover The Largest Selection Of Puppies Available In Singapore" (67 chars, no CTA/offer) | "Browse 40+ purebred & mixed-breed puppies for sale in Singapore, health-certified with vaccinations. Door-to-door delivery. WhatsApp us today." (142 chars) | puppy for sale singapore / puppies for sale singapore |
| `/all-available-puppies/` | > NEEDS DATA: exact current title text not captured live; not flagged as over-length in the technical audit, so likely already reasonable | "All Available Puppies for Sale in Singapore \| Puppy SG" (54 chars) | > NEEDS DATA: not captured live | "See every puppy available in Singapore, small, large, mixed & HDB-approved breeds. Health-certified, vet-checked. WhatsApp us for pricing & viewing." (148 chars) | puppy for sale singapore (secondary), all available puppies |
| `/corgi/` | "Corgi Puppies for Sale - Puppy Singapore" (~41 chars, confirmed live) | "Corgi Puppies For Sale Singapore \| Puppy Singapore" (50 chars) | "Adaptability" (12 chars — confirmed template bug) | "Corgi puppies for sale in Singapore, HDB-approved, vet-checked with health certificates & ancestry records. WhatsApp us for pricing & viewing." (142 chars) | corgi puppy for sale singapore (140/mo) |
| `/golden-retriever/` | "Golden Retriever Puppies for Sale - Puppy Singapore" (confirmed live) | "Golden Retriever Puppies For Sale Singapore \| Puppy SG" (54 chars) | "Adaptability" (confirmed template bug) | "Golden Retriever puppies for sale in Singapore, health-certified, vaccinated, with full ancestry records. WhatsApp us now for pricing & viewing." (144 chars) | golden retriever puppy for sale singapore (70/mo) |
| `/dachshund/` | "Dachshund Puppies for Sale - Puppy Singapore" (confirmed live) | "Dachshund Puppies For Sale Singapore \| Puppy Singapore" (54 chars) | "Adaptability" (confirmed template bug) | "Dachshund puppies for sale in Singapore, HDB-approved, health-certified with vaccinations & full ancestry records. WhatsApp us now for pricing." (143 chars) | dachshund puppy singapore |
| `/toy-poodle/` | "Toy Poodle Puppies - Puppy Singapore" (confirmed live — **inconsistent with the rest of the breed-page template, missing "For Sale"**) | "Toy Poodle Puppies For Sale Singapore \| Puppy Singapore" (55 chars) | > CONFIRM: not directly sampled by the technical audit, but near-certain to carry the same "Adaptability" template bug given it uses the identical breed-characteristics table | "Toy Poodle puppies for sale in Singapore, hypoallergenic, HDB-approved, health-certified with full ancestry records. WhatsApp us for pricing." (141 chars) | toy poodle singapore (210/mo) |
| `/dog-adoption-singapore/` | > CONFIRM: exact text not captured live; technical audit confirms length is **118 characters** (well over the ~60-char display limit) | "Dog Adoption Singapore \| Adopt a Rescue Dog \| Puppy SG" (54 chars) | > NEEDS DATA: not captured live | "Adopt a rescue dog in Singapore: eligibility, process, fees & where to adopt, plus dogs available now. Start your adoption journey with us today." (145 chars) | dog adoption singapore / dog for adoption singapore (4,400/mo each) |
| `/dog-shelters/` (inherited finding, not re-fetched) | > CONFIRM: exact text not captured; audit confirms **90 characters** (over limit) | Recommend trimming to <60 chars, keyword-front-loaded, e.g. "Dog Shelters in Singapore \| Puppy Singapore" | Not sampled this pass | > NEEDS DATA: write once current text is pulled | dog shelters singapore (part of adoption cluster) |
| All other 24+ breed pages (american-cocker-spaniel-2, cavalier-king-charles, french-bulldog, shih-tzu, siberian-husky, pomeranian, labrador, british-bulldog, cavapoo, and the ~15 not yet sampled) | Titles likely fine (pattern: "{Breed} Puppies for Sale - Puppy Singapore") | Apply the same tightened pattern: "{Breed} Puppies For Sale Singapore \| Puppy Singapore" | "Adaptability" (template bug, confirmed on 13/13 sampled — near-certain domain-wide) | Apply the same formula: "{Breed} puppies for sale in Singapore, [1 breed-specific trait], health-certified with vaccinations & ancestry records. WhatsApp us for pricing." | {breed} puppy for sale singapore |

**Canonical tags:** Technical audit found correct self-referencing canonicals on all 28 sampled
pages except the `/american-cocker-spaniel/` vs `/american-cocker-spaniel-2/` pair (both
canonical to `-2`, correctly, but `-1` is an orphaned live duplicate — 301 redirect it per the
audit's fix #5; that's a technical fix, not a metadata rewrite, so no table row needed here).

---

## H1 fixes

| URL | Current H1 | New H1 | Intent it matches |
|---|---|---|---|
| `/` | "Discover The Largest Selection Of Puppies Available In Singapore" (67 chars, no target keyword) | "Puppies For Sale in Singapore — 40+ Breeds, Health-Certified" | Transactional — front-loads `puppies for sale singapore`, keeps the "largest selection" line as a supporting subheadline instead of the H1 |
| `/all-available-puppies/` | "All Available Puppies" (fine, but keyword-thin) | "All Available Puppies for Sale in Singapore" | Transactional — adds the exact-match phrase without losing the existing, already-familiar H1 |
| `/corgi/` | "Corgi Puppies For Sale" | **No change** | Already transactional-intent matched and ranking; keyword map explicitly flags breed-page H1s as optimize-in-place, not rewrite |
| `/golden-retriever/` | "Golden Retriever Puppies For Sale" | **No change** | Same — already correct |
| `/dachshund/` | "Dachshund Puppies For Sale" | **No change** | Same — already correct |
| `/toy-poodle/` | "Toy Poodle Puppies For Sale" | **No change** | Same — already correct |
| `/dog-adoption-singapore/` (template bug — confirmed live, and per audit replicated across all 10 adoption pages) | **Two H1s**: (1) "Discover the Joy of Dog Adoption in Singapore: A Comprehensive Guide to Finding Your New Best Friend", (2) "Find Your Perfect Companion: Singapore Dog Adoption – Give a Rescue a Second Chance at a Loving Home" | Keep **one** H1: "Dog Adoption in Singapore: Find & Adopt Your New Best Friend." Demote the second string to an H2 inside the "Why Adopt" section (its content is fine, it's the tag-level duplication that's the bug) | Commercial/informational — front-loads `dog adoption singapore` (4,400/mo), the single highest-volume term on the whole domain |
| `/dog-adoption-process/`, `/dog-shelters/`, `/dog-adoption-fees/`, `/dog-adoption-challanges/`, `/dog-adoption-laws/`, `/project-adore/`, `/dog-adoption-event/`, `/fostering-dogs/`, `/preparing-for-adopted-dog/` (inherited from audit, not individually re-fetched) | Same dual-H1 template defect on all 9 | Same fix pattern: keep the shorter/keyword-relevant H1, demote the second to H2 | Same template-level fix — one edit to the adoption-post template resolves all 10 pages at once, per the audit's fix-order #3 |

---

## Heading outline

### Homepage (`/`)

```
H1: Puppies For Sale in Singapore — 40+ Breeds, Health-Certified
  H2: Browse Puppies by Breed Category                        [target: small dog breeds singapore, hdb approved dog breeds]
    H3: Small Breed Puppies
    H3: Large Breed Puppies
    H3: Mixed Breed Puppies
    H3: HDB-Approved Puppies
  H2: Why Buy From Puppy Singapore                             [target: ethical breeder singapore, trust]
    H3: Health Certifications & Ancestry Records
    H3: Vet Check-Ups & Vaccinations
    H3: Puppy Training Included (potty, crate, leash, obedience)
  H2: How Much Does a Puppy Cost in Singapore                  [target: puppy price singapore, links to new cost-guide post]
  H2: Door-to-Door Delivery & Air Shipping                     [target: dog delivery singapore]
  H2: See Why Our Clients Trust Us                              [existing testimonials section, keep]
  H2: Frequently Asked Questions                                [target: how to choose a puppy singapore, 3-3-3 rule]
  H2: Thinking About Adoption Instead?                          [internal link to /dog-adoption-singapore/]
```

### `/all-available-puppies/` (structural fix priority — Pokemon H2 bug)

The current page uses ~80+ individual puppy names ("Manectric," "Vulpix," "Arcanine,"
"Zamazenta," "Lycanroc," plus Apple/Pine/Tomy/Emma/etc.) as literal H2 tags, with breed-category
headings mixed in at the same level. Fix: reserve H2 for the ~5 real category headings; render
each puppy's name as a card title (e.g. `<h4>` or a styled `<div>`, not H2/H3) so it's visually
identical but doesn't pollute the heading outline Google reads.

```
H1: All Available Puppies for Sale in Singapore
  H2: Small Breed Puppies
    [puppy cards — name as card title, NOT a heading tag: "Corgi Puppy — Sora", "Shih Tzu Puppy — Apple", etc.]
  H2: Large Breed Puppies
    [puppy cards, same pattern]
  H2: Mixed Breed Puppies
    [puppy cards, same pattern]
  H2: HDB-Approved Puppies
    [puppy cards, same pattern — this can reuse cards already shown above, not a full duplicate section]
  H2: How to Book an Appointment                               [consolidates the 30+ repeated "Contact Us for Pricing & Viewing Location" H3 boilerplate into one component]
  H2: Why Choose Puppy Singapore
  H2: Frequently Asked Questions
```

### `/corgi/` (representative breed-page template — apply the same tree to golden-retriever,
dachshund, toy-poodle, and all other breed pages)

```
H1: Corgi Puppies For Sale Singapore                            [unchanged, already ranking]
  H2: Corgi Characteristics                                     [existing table — keep, just stop it leaking into the meta description]
  H2: Corgi Personality & Temperament                           [target: corgi temperament, corgi behavior]
  H2: Corgi Care (Grooming, Exercise, Health)                   [target: corgi grooming, corgi exercise needs]
  H2: Is a Corgi HDB-Approved?                                  [target: hdb approved dog breeds — Corgi is listed in nav as HDB-approved, make it explicit on-page]
  H2: Corgi Puppies for Sale in Singapore                       [existing — the individual puppy bios, keep as-is]
  H2: What Our Customers Say                                    [existing]
  H2: Frequently Asked Questions About Corgis                   [NEW — see FAQ bank note below]
  H2: Other Popular Breeds                                      [existing internal-link section]
```

FAQ bank suggestions for the new FAQ H2 (drawn from `01-keyword-map.md`'s fan-out/PAA
findings — these are answer-capsule/AI-Overview candidates, not necessarily high direct SG
search volume individually):
- "Are Corgis good for HDB flats in Singapore?"
- "How much exercise does a Corgi need?"
- "Do Corgis shed a lot?"
- "Are Corgis good with children and other pets?"
- "What health certifications come with a Corgi puppy from Puppy Singapore?"

### `/dog-adoption-singapore/`

```
H1: Dog Adoption in Singapore: Find & Adopt Your New Best Friend   [was H1 #1 — kept, trimmed for keyword front-loading]
  H2: Why Adopt a Dog in Singapore
    H3: Find Your Perfect Companion — Give a Rescue a Second Chance   [demoted from H1 #2, content unchanged]
  H2: Singapore Pet Ownership Regulations & HDB Rules                [existing "Understanding Singapore's Pet Ownership Regulations"]
  H2: How to Prepare for Adoption                                    [existing]
  H2: The Dog Adoption Process, Step by Step                         [existing]
  H2: Where to Adopt a Dog in Singapore                               [existing — government orgs, shelters, rescue groups]
  H2: Adoption Fees & Financial Considerations                        [existing]
  H2: Post-Adoption Care, Training & Support                          [existing "Post-Adoption Journey" section]
  H2: Frequently Asked Questions                                      [NEW — page currently has no dedicated FAQ block despite 30+ subheadings; add one, pulls double duty as FAQPage schema source]
```

---

## Money-page copy

### 1. Homepage — first-fold rewrite

**Current:**
> H1: "Discover The Largest Selection Of Puppies Available In Singapore"
> Subhead: "If you are a dog-lover, you would want to come to our pet store and look at our
> dogs...This pet will greatly affect your life and your family's for years to come."

**Rewrite (answer-first, brand voice: warm but not hard-sell, WhatsApp-first CTA):**
> H1: **Puppies For Sale in Singapore — 40+ Breeds, Health-Certified**
> Subhead: "Browse purebred and mixed-breed puppies for sale in Singapore, each vet-checked
> with health certifications and ancestry records. HDB-approved options available. Well-bred
> puppies are not cheap, but they will bring you joy instead of disgust — message us on
> WhatsApp for pricing, availability, and a viewing appointment."
> CTA buttons: "Browse Puppies by Breed" / "WhatsApp Us"

The rewrite keeps the site's own signature line ("Well-bred puppies are not cheap...") verbatim
per `brand-voice.md` — it's the one piece of value-framing language already on-brand and
working. It drops the generic "if you are a dog-lover, you would want to come to our pet
store" opener (vague, doesn't answer the visitor's first question) in favor of stating the
offer immediately.

### 2. `/all-available-puppies/` — first-fold rewrite

**Current:** H1 "All Available Puppies," tagline "Only the Best for Our Best Friends," then
straight into ~80 puppy cards with no framing paragraph.

**Rewrite:**
> H1: **All Available Puppies for Sale in Singapore**
> Intro: "Every puppy below comes from a trusted breeder, vet-checked with health
> certifications, ancestry records, and up-to-date vaccinations. Filter by Small, Large, Mixed,
> or HDB-Approved, then message us on WhatsApp for pricing, availability, and a viewing
> appointment — no walk-in storefront, just a straightforward chat before you meet your puppy
> in person."

This adds the missing answer-first paragraph the page currently lacks entirely (it jumps
straight from tagline to listings), while reinforcing the trust signals (health certs,
ancestry, vaccinations) that `brand-voice.md` identifies as the site's core anxiety-reducers.

### 3. `/corgi/` — first-fold rewrite + breed-info fix

**Current first-fold** (paraphrased from live fetch): a stiff, generic paragraph — "Corgis are
adaptable dogs suitable for country or city living with weather-resistant coats... generally
integrate well with other pets when socialized" — reads as AI-boilerplate per `brand-voice.md`'s
own observation, no specific hook, no CTA.

**Rewrite:**
> H1: Corgi Puppies For Sale Singapore *(unchanged)*
> Intro: "Looking for a Corgi puppy in Singapore? Corgis are HDB-approved and thrive in both
> apartments and landed homes, thanks to a weather-resistant double coat that handles our
> humidity better than you'd expect. They're quick learners, great with kids, and — despite
> their size — surprisingly good watchdogs. Every puppy below is vet-checked, vaccinated, and
> sold with health certifications and ancestry records. Message us on WhatsApp for pricing,
> availability, and a viewing appointment."

**Keep unchanged (genuine strength, per `brand-voice.md`):** the individual puppy bios —
Sora, Pika, Leo, Lea — stay exactly as written. These are the one part of the page that's
distinctive and on-voice; nothing here should touch them.

**Paragraph-level fix to the "Corgi Personality" section:** replace the flat, textbook-register
sentences ("Corgis are known to be happy, intelligent and loving. They are easy to train due to
their intelligence.") with the same practicality-framed style used in the new intro — specific,
owner-relevant claims instead of generic adjectives stacked in a row. Example rewrite:
> "Corgis were bred to herd cattle, so they're naturally alert, food-motivated, and quick to
> pick up commands — most owners have basic obedience down within a few weeks. That same
> herding instinct means they'll sometimes nip at ankles or bark at moving objects if
> under-exercised, so plan on at least one proper walk a day."

**Missing section to add:** "Is a Corgi HDB-Approved?" (short, direct answer-capsule paragraph
confirming HDB approval status, since Corgi already appears in the homepage's HDB-Approved nav
list but the breed page itself never states this explicitly) and a "Frequently Asked Questions"
block (FAQ bank listed in the Heading Outline section above).

**Do not add:** a specific-price "How much does a Corgi cost" section on the breed page itself.
Per `client.md`, pricing is not published on-site (gated behind WhatsApp) and no figure should
be invented. Instead, link out to a future "How Much Does It Cost to Own a Corgi in Singapore"
blog post (Blog Writer's queue, see New Pages Needed) that can discuss cost *ranges/factors*
without Puppy Singapore's own price.

---

## Schema (JSON-LD)

### Homepage — Organization (fixes the audit's combined `["Person","Organization"]` bug)

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Puppy Singapore",
  "alternateName": "Puppy Singapore by William Goh Pet Farm",
  "url": "https://puppysingapore.com/",
  "logo": "https://puppysingapore.com/wp-content/uploads/[CONFIRM: actual logo path]",
  "telephone": "+65 8806 6180",
  "email": "[CONFIRM: exact live email address, not fully visible in current fetch]",
  "sameAs": [
    "https://www.facebook.com/Pup.SG"
  ],
  "areaServed": {
    "@type": "Country",
    "name": "Singapore"
  },
  "description": "Online puppy marketplace offering purebred and mixed-breed puppies across 40+ breeds, with health certifications, ancestry records, and door-to-door delivery in Singapore."
}
```
> CONFIRM: no street address is included by design — per `client.md`, this domain does not
> pursue local-pack ranking and should not reuse wgpetfarm.com's GBP address. If the owner
> wants a general service-area statement instead of silence, add
> `"areaServed": {"@type": "Country", "name": "Singapore"}` only (already included above), not
> a `PostalAddress`.

### Breed pages — Product/Offer schema: **not recommended in current form**

Per `client.md`, pricing is gated behind WhatsApp and not published on-site. Google's structured
data guidelines expect a `price` or `priceSpecification` on any `Offer` for it to be eligible for
rich results — publishing `Product`/`Offer` schema without a real price either fails validation
or risks a manual-action-adjacent inconsistency (schema claiming an offer exists with no visible
price on the rendered page). **Recommendation: hold Product schema until the owner decides
whether to publish an indicative starting price.** If they do, this is the ready-to-paste
pattern (breed example: Corgi):

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Corgi Puppy",
  "description": "Corgi puppies for sale in Singapore, HDB-approved, health-certified with vaccinations and ancestry records.",
  "brand": { "@type": "Organization", "name": "Puppy Singapore" },
  "offers": {
    "@type": "Offer",
    "priceCurrency": "SGD",
    "price": "> CONFIRM: owner must supply a real starting price before this is valid",
    "availability": "https://schema.org/InStock",
    "url": "https://puppysingapore.com/corgi/"
  }
}
```

### `/corgi/` (and every breed page once the FAQ section above is added) — FAQPage

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Are Corgis good for HDB flats in Singapore?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes — Corgis are listed among Puppy Singapore's HDB-approved breeds. Their compact size and moderate exercise needs make them well-suited to apartment living, provided they get at least one proper walk a day."
      }
    },
    {
      "@type": "Question",
      "name": "How much exercise does a Corgi need?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "At least 30 minutes of daily exercise. Corgis were bred as herding dogs and stay happiest with regular walks and playtime."
      }
    },
    {
      "@type": "Question",
      "name": "Do Corgis shed a lot?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Corgis have a weather-resistant double coat and shed moderately year-round, with heavier seasonal shedding. Regular brushing keeps it manageable."
      }
    }
  ]
}
```
> CONFIRM: expand this to the full FAQ set once the owner signs off on the FAQ copy; this
> block shows the pattern, not the final complete answer set.

### `/dog-adoption-singapore/` — FAQPage (content mostly needs to be written, see Heading Outline)

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "How do I adopt a dog in Singapore?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Start by researching shelters and rescue groups, complete an adoption eligibility assessment, submit an application, and undergo a home visit before final approval. See our step-by-step process below."
      }
    },
    {
      "@type": "Question",
      "name": "Is my HDB flat allowed to have a dog?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "HDB flats can only keep approved breeds under HDB's list of allowable dog breeds; check the current list before adopting or buying."
      }
    }
  ]
}
```
> CONFIRM: this page's current content (per the live fetch) does not yet have a dedicated FAQ
> block despite 30+ subheadings — the FAQ copy needs to be written first (see Heading Outline),
> this schema should be added at the same time, not before.

### `/contact-us/` — fix the relative-URL JSON-LD bug (inherited from audit, not re-verified this pass)

The technical audit found `/contact-us/`'s JSON-LD using a relative URL
(`../wp-content/uploads/2016/12/02-1.png`) as a schema `@id`/`url` value, which is invalid. This
WebFetch pass could not re-extract the raw `<script type="application/ld+json">` block (the
markdown conversion strips script tags), so the fix below is written against the audit's
description, not a fresh read of the exact JSON:
> **Fix:** replace the relative path with the fully-qualified URL,
> `https://puppysingapore.com/wp-content/uploads/2016/12/02-1.png`, everywhere it appears as a
> schema `url`/`@id`/`logo` value.

### Breed pages — BreadcrumbList (gap noted in audit, none sampled anywhere)

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://puppysingapore.com/" },
    { "@type": "ListItem", "position": 2, "name": "All Available Puppies", "item": "https://puppysingapore.com/all-available-puppies/" },
    { "@type": "ListItem", "position": 3, "name": "Corgi", "item": "https://puppysingapore.com/corgi/" }
  ]
}
```
Apply the same 3-level pattern (Home > All Available Puppies > {Breed}) to every breed page.

---

## Internal links

| From URL | To URL | Anchor text |
|---|---|---|
| `/` | `/dog-adoption-singapore/` | "adopt a rescue dog in Singapore" |
| `/` | `/all-available-puppies/` | "browse all available puppies" |
| `/corgi/` | `/golden-retriever/` | "Golden Retriever puppies for sale" |
| `/corgi/` | `/dog-adoption-singapore/` | "considering adoption instead? see dogs available for adoption" |
| `/golden-retriever/` | `/toy-poodle/` | "Toy Poodle puppies for sale" |
| `/dachshund/` | `/corgi/` | "Corgi puppies for sale" |
| `/toy-poodle/` | `/cavapoo/` | "Cavapoo puppies for sale" (both are poodle-mix/poodle-adjacent, natural comparison bridge) |
| `/all-available-puppies/` | `/corgi/`, `/golden-retriever/`, `/dachshund/`, `/toy-poodle/` | breed-specific anchors, e.g. "See all Corgi puppies," "See all Golden Retriever puppies" — one per breed card section |
| `/dog-adoption-singapore/` | `/list-of-hdb-approved-dogs-in-singapore/` (existing page, ranks weakly per keyword map) | "HDB-approved dog breeds" |
| Every breed page (corgi, golden-retriever, dachshund, toy-poodle, etc.) | *(future)* breed-specific "How Much Does It Cost to Own a [Breed] in Singapore" post | "[Breed] ownership cost guide" — add once the Blog Writer produces these (see New Pages Needed) |

---

## New pages needed

Clusters from `01-keyword-map.md` with no current page — these belong to the Blog/Content
Writer role, listed here so the on-page work above has somewhere to link once they exist:

- **Breed-cost/ownership companion posts** (Corgi, Golden Retriever, Toy Poodle, Dachshund,
  Labrador, Pug first) — "How Much Does It Cost to Own a [Breed] in Singapore," mirrors
  prettypetskennel.com's format, rides existing breed-page authority.
- **Dog Breeds in Singapore hub** — internal-link spine for every breed page, 480+ vol.
- **Types of Poodles / Poodle Mixes in Singapore guide** — natural fit given the site already
  sells Cavapoo, Toy Poodle, Maltipoo.
- **Dog License Singapore + HDB-Approved Dogs + Pet Insurance Singapore** — strengthen the two
  existing weak-ranking pages (`/project-adore/`, `/list-of-hdb-approved-dogs-in-singapore/`)
  and add the pet-insurance piece as a third leg of the same cluster.
- **Ethical Breeder / How to Avoid a Puppy Mill in Singapore** — strongest E-E-A-T opportunity
  given the AVS license and 2016 operating history; a live Reddit thread on this exact question
  ranks #4 for a closely related SERP.
- **Puppy Price in Singapore aggregate guide** — umbrella page linking to every per-breed cost
  post above; discusses price *ranges/factors* without publishing Puppy Singapore's own figures.
- **3-5 comparison posts** ("X vs Y") — Cavapoo vs Maltipoo, Labrador vs Golden Retriever, Corgi
  vs Golden Retriever — fast to produce, direct internal-link bridges between breed pages.
- **New breed pages** for Yorkshire Terrier, Samoyed, Goldendoodle, Bernese Mountain Dog,
  Japanese Spitz — all rank for a competitor, none exist on this domain yet.
- **Consolidated "Puppy Training in Singapore" guide** covering all seven services from
  `client.md` (car, potty, stairs, noise, crate, obedience, leash) — current
  `/puppy-obedience-training/`-type page ranks pos 72 on the 1,300-vol "dog training" term.

---

## Handoff to Client Report Builder

**5 pages received full on-page rewrites this pass** (homepage, `/all-available-puppies/`,
`/corgi/`, `/golden-retriever/`, `/dachshund/`, `/toy-poodle/`, `/dog-adoption-singapore/` —
7 pages with metadata/H1/heading fixes; 3 with full first-fold copy rewrites), plus template-level
fix instructions that cascade to 30+ breed pages and 10 adoption pages without per-page work.

**Best before/after example:** `/corgi/`'s meta description currently reads, in its entirety,
**"Adaptability"** (a 12-character stray label leaked from the breed-characteristics table) —
replaced with a 142-character description that states the offer, the trust signals (HDB-approved,
health certificates, ancestry records), and a WhatsApp CTA. This single template fix resolves
the same defect across 30+ breed pages at once, making it the highest-leverage change in this
entire file.
