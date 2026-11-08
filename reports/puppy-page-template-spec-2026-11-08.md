# Individual puppy page: audit + reusable template spec

**Task:** K-002 · **Date:** 2026-11-08 · **Pilot:** Biscuit, Maltipoo, apricot girl, ID 2938, $3,888
**Route:** `src/pages/puppies/[breed]/[id].astro` · **Data:** `src/data/available-puppies.json`, `src/data/placed-archive.json`
**Companion files:** `reports/puppy-page-competitor-research-2026-11-08.md` · `outputs/puppy-page-redesign-biscuit.html` · `reports/puppy-page-pilot-implementation-plan-2026-11-08.md`

**Fact sources used (only these):** `config/business-context.md`, `config/project-config.md`, `src/data/site.ts` (reviews count and rating), and the published Maltipoo breed page `src/pages/puppies/maltipoo.astro` (breed facts already live on the site). Nothing about Biscuit is invented. Each field below names the feed column it comes from.

---

## Part A: Audit of the current page

### A0. Status of the pilot puppy (read first)
Biscuit **is no longer available on the live site**. `https://curioustails.sg/puppies/maltipoo/2938-apricot-girl/` returns 200 with the *placed* variant: H1 "Biscuit the Maltipoo Found a Loving Home", no price, no Product schema. She is in `placed-archive.json` (`lastSync`, 2026-11-01). The local `available-puppies.json` snapshot in this repo still lists her as available because it predates the deploy that placed her.

Consequences:
- The prototype shows Biscuit in the **available** state, as the brief asks, because that is the template under review. A toggle in the prototype also shows the **placed** state, which is what her URL serves today.
- Live **validation** of the available state must use a puppy that is live at implementation time (e.g. Smokey, `maltipoo/2950-red-boy`, at time of writing). Biscuit's URL validates the placed state. See the implementation plan, §7.

### A1. Current section order (available state, as served on Smokey 2950 today)
1. Promo utility bar ("Seen one you love? Reserve it now →") + sticky header
2. **Hero:** breadcrumb, single 4:3 photo in a clay frame | kicker "MALTIPOO · MALE", H1 "Smokey - Red Boy", "Puppy ID #2950 · 2 months", 4 chips (HDB, Vaccinated, Microchipped, Vet health-checked), price + "ALL-IN PRICE", WhatsApp button, "Book a viewing" (cal.com), no-hidden-fees line
3. **About + profile** (peach band): "About Smokey" (2 paragraphs, generic temperament fallback for Maltipoo), "Health & what's included" (6 ticks), profile table (breed, ID, gender, colour, age, origin, HDB, price), WhatsApp button
4. **Why choose Curious Tails** (lilac band): 6 cards in 6 accent colours + licence strip + WhatsApp button
5. **TestimonialWall** ("Happy Curious Tails Families")
6. **StarterKitMarquee** ("The $500+ Starter Kit, Free With Every Puppy")
7. **ReviewSlider** ("What Curious Tails owners say", per breed)
8. **ListingGrid**: other puppies (8)
9. **FinalCta** ("Meet Our Maltipoos at Balestier")
10. Global WhatsApp float bubble (generic prefill)

### A2. Strengths to keep
- **Data-driven and honest by construction.** Only puppies with a real photo get a page, crosses keep their cross label, `hdbApproved` prints only on a real tick, and a placed puppy keeps its URL inside the retention window and then 301s. This plumbing is better than every competitor's.
- **Per-puppy WhatsApp prefill with ID**, plus `data-wa-source="pup:{id}"` GA4 attribution, plus the per-puppy cal.com `bookHref`.
- **Price shown, labelled all-in**, with a no-hidden-fees line under the buttons.
- **Product + Offer schema** with a visible price. Business reviews correctly stay on the LocalBusiness node, never on the puppy.
- **Placed variant** turns a dead end into a cross-sell (puppies available now come right after the news).
- Real Google reviews per breed (ReviewSlider), and real customer photos (TestimonialWall).

### A3. Gaps against competitor patterns
| Gap | Evidence |
|---|---|
| **One photo, no video** | The sheet has `Image-`…`Image5-` and `Video-` columns. `scripts/sync-puppies.mjs` saves only `images[0]`. `video` is null for Biscuit. Lovely Pets, Paw Palace and Tiara all show galleries. |
| **Age frozen at sync time** | `ageLabel()` turns `DOB-` into "2 months" at sync and the date is thrown away. Wag, Tiara and Woof Loof show the DOB. |
| **No breed-fit block** | The Maltipoo has no `TEMPERAMENT` entry, so the page says "friendly and family-oriented". The honest, specific breed facts live only inside `maltipoo.astro`. |
| **No "what happens next"** | Free boarding up to a month after deposit, delivery around your schedule, playpen setup and kit walkthrough: the strongest differentiators are absent from the page. |
| **No FAQ / FAQPage** | Furgive, Maya and Woof Loof have FAQPage schema. Puppy-page objections (HDB, deposit, size, sickness, vaccinations) go unanswered. |
| **Health is a tick list only** | No Singapore vaccination schedule (6/8/12 + optional 16), no going-home timing, no 5-day nurse-back promise next to the price. |
| **Visit block is one sentence** | Address, hours and getting-there exist in config, but the page shows only "2 Balestier Road". No licence registry link near the decision. |
| **No freshness signal** | `syncedAt` exists, but the page never says when availability was last checked. |

### A4. Mobile behaviour and CTA visibility (390×844, measured)
- The utility bar (28 px) and sticky header (56 px) take 84 px. The photo plate fills most of the first screen, and the **price sits at about 700 px and the WhatsApp button at about 775–830 px CSS**, i.e. the button straddles the fold (`outputs/puppy-page-research/screens/curioustails-smokey-live-mobile.jpg`).
- The **global WhatsApp float bubble (fixed 768–824 px) sits on top of the hero WhatsApp button** at first paint. Two green targets overlap.
- After scrolling, the only persistent action is that bubble, and its prefill is generic ("Hi! I'd like to ask about your puppies."). **Puppy ID attribution is lost** for every enquiry made from the bubble. `StickyMobileCTA.astro` exists but is not used.
- No secondary action (Book a viewing) persists after the hero.

### A5. Copy quality and factual risk
- **Grammar bug (live):** the placed meta description reads "Biscuit, **a apricot** Maltipoo girl…". The article logic exists in the body but not in `description`.
- **Redundant meta (available):** "Meet Smokey - Red Boy, a red Maltipoo boy, 2 months." The colour and gender appear twice.
- **Repeated claims:** "vaccinated, microchipped, vet-checked" appears in chips, the about paragraph, the included list, the why-choose card and the footer line. The page says the same thing five times and *what happens next* zero times.
- **Generic temperament fallback** for most breeds ("friendly and family-oriented"). This is honest but useless.
- **Factual risk: low.** All claims trace to `business-context.md`. Watch items: (1) `config/business-context.md` says 39 reviews / 5.0, while `site.ts` (the source of what is live) says 65 / 4.9. The config is stale; owner to confirm. (2) "Pricing typically runs $500 to $2,000 below the big-name shops" is a comparative claim. Keep it off the puppy page (it lives on `/pricing/`).

### A6. SEO
| Item | Current | Issue |
|---|---|---|
| `<title>` | `Smokey - Red Boy: Maltipoo Puppy for Sale Singapore \| Curious Tails` (69 chars) | Over 60 chars, so it truncates. It also repeats the breed-page money phrase on every puppy URL, so 1–5 thin pages compete with `/puppies/maltipoo/` (keyword ownership map: the breed page owns `{breed} singapore` / `for sale`). |
| H1 | `Smokey - Red Boy` | **No breed in the H1.** The puppy's long-tail ("red maltipoo boy") is missing. |
| Meta | see A5 | Bug + redundancy. |
| Schema | Organization, WebSite, Product+Offer, PetStore (aggRating), BreadcrumbList | Good base. Missing: `image[]` (gallery), `additionalProperty` (gender, colour, DOB, HDB), `FAQPage`. The placed variant correctly drops Product. |
| Internal links | breadcrumb (Puppies → Maltipoo), other-puppy cards, header/footer, FinalCta | No contextual link to the breed guide's sections, `/pricing/`, `/starter-kit/`, `/delivery/`, `/first-time-owners/hdb-breeds/`, `/reviews/` or `/contact/` from the decision points. |
| Image alt | `Smokey - Red Boy, Maltipoo puppy available in Singapore` | Fine, but every gallery image will need its own alt. |
| Indexing | 1 page per live puppy, placed pages kept for retention | Good. Keep `noindex` off. These are the only pages that can own "apricot maltipoo girl singapore"-type long-tail. |

### A7. Performance risks
- **134 `<img>` elements** on the Biscuit page and **8 large images** on Smokey's. Most come from TestimonialWall, StarterKitMarquee, ReviewSlider media and the 8-card ListingGrid. Below-the-fold weight is the risk, not the hero.
- Hero: `astro:assets` `<Image>` with widths 480/768/1000 and correct `sizes`. Good. The source photo is only 800×800, so the 1000w variant upscales. Cap it at 800.
- About 259 KB of HTML on the Biscuit page (inline SVG and the repeated review/marquee markup).
- The marquee animates continuously; check that it pauses offscreen and under reduced motion.

### A8. Keep / rewrite / remove
| Keep | Rewrite | Remove / move |
|---|---|---|
| Route, getStaticPaths, placed variant, 301 lifecycle | Hero (gallery, H1 with breed, price card with promise, fold-safe CTAs) | The 6-colour "Why choose" grid (folded into price breakdown + visit block) |
| WhatsApp prefill with ID, `data-wa-source`, `bookHref` | About copy (data-driven, breed-specific) | TestimonialWall *and* StarterKitMarquee *and* ReviewSlider in a row: keep **one** review band (ReviewSlider) + one customer-photo strip inside it |
| Product/Offer only when a price is visible | Title/meta/H1 patterns | The global float bubble on this route (replaced by the puppy sticky bar) |
| ListingGrid cross-sell, FinalCta | Health block → health record with schedule and promise | Repeated "vaccinated, microchipped" lines (say it once, well) |
| ReviewSlider per breed | Profile table → "passport" facts | 1000w hero variant |

---

## Part B: The template

## B1. Art direction: "The Puppy Passport"

**Concept.** Every puppy page reads like that puppy's own welcome passport: a photo plate, an ID stamp, a facts page, health stamps, and the journey home. It grows out of things the site already has (Puppy ID numbers, the clay "card" surface, mint tick chips), so it elevates the brand rather than inventing a new one. It is playful through *stamps and paper* metaphors, not cartoons, and trustworthy because every stamp is a real fact.

**Three bullets (for the report):**
- **A passport, not a poster:** the puppy's real photo in a clay frame with an ID stamp, a facts page, health stamps and a "journey home" route. Every element is a verifiable fact; a missing fact means a missing stamp, never filler.
- **Calm clay, one loud action:** cream paper ground, white clay cards, mint for verified health, lilac for trust and the visit band, coral only for price and kickers. WhatsApp green is the single loud button, repeated only in the hero, the sticky bar and the closing band.
- **Photo-first and honest:** only real shop and customer photos near the puppy (no AI imagery on this route), a gallery when the sheet has more photos, and an "ask for a video of {Name}" tile when it doesn't.

### Palette usage (existing tokens only, `src/styles/global.css`)
| Role on this page | Token | Rule |
|---|---|---|
| Page ground | `--color-cream-50` | Default |
| Alternating band | `--color-peach-100` | Max 2 peach bands per page |
| Cards / passport pages | `--color-surface-card` + `.clay` | One card style for every fact surface |
| Verified / health stamps | `--color-mint-100` fill, `--color-mint-300` ring, `--color-cream-900` text | Only for facts that are true of this puppy |
| Trust / visit / final band | `--color-lilac-900` deep band, `--color-cream-50` text | One deep band, the visit block. FinalCta keeps its own style |
| Price numeral, kickers, links | `--color-coral-600` | Never a filled coral button on this page (green owns the action) |
| Primary action | WhatsApp green `#25D366` / hover `#1ebe57` (existing) | Hero, sticky bar and final band only |
| Secondary action | `.clay-btn-outline` white | "Book a viewing" |
| Dividers | `--color-cream-200`, 2 px dashed for "perforation" between passport sections | Decorative, `aria-hidden` |

### Type scale (Fredoka headings / Nunito body, both self-hosted)
| Role | Size | Weight / notes |
|---|---|---|
| H1 (puppy name line) | `clamp(2rem, 5.2vw, 3.25rem)` / 1.05 | Fredoka 600, `text-wrap: balance` |
| H2 (section) | `clamp(1.6rem, 3.2vw, 2.4rem)` / 1.15 | Fredoka 600 |
| H3 (card) | `1.2rem` / 1.3 | Fredoka 600 |
| Price numeral | `clamp(2.2rem, 6vw, 3rem)`, tabular-nums | Fredoka 600, coral-600 |
| Body | `1.0625rem` / 1.65, max 62ch | Nunito 400 |
| Small / meta | `0.875rem` / 1.5 | Nunito 600, cream-600 |
| Kicker / stamp label | `0.75rem`, uppercase, `letter-spacing: .14em` | Nunito 800 |

### Spacing, surfaces, photo, motion
- **Spacing:** 8 px grid. Section padding 64 px mobile / 96 px desktop. Card padding 20/28 px. Content max-width 1200 px (narrower than today's 1400 px; this is a reading page, not a grid page).
- **Surfaces:** one `.clay` card treatment for everything (3 px cream-300 border, offset pop shadow, inset highlight). Passport "stamps" are pill chips with a 2 px ring and a tiny 4° rotation on desktop only.
- **Photo treatment:** 4:3 main plate (the shop's photos are 800×800 square; use `object-fit: cover` with `object-position: center 40%`), 1.1 rem inner radius inside a clay frame, an ID stamp overlay in the top-left (`#2938`) set in HTML, never burned into the image. Thumbnails 64–72 px squares. No filters; crop only.
- **Motion:** reveal on intersection (fade + 12 px rise, 420 ms `--ease-out-quart`, gated on `html.js`). The health stamps "press" once (scale 1.06 → 1, 260 ms `--ease-clay-pop`). The sticky bar slides up in 220 ms once the hero CTA leaves the viewport. Everything is disabled under `prefers-reduced-motion`. Transform and opacity only.

## B2. Section order (13 sections + sticky bar)

| # | Section | Job | Content | Hides when |
|---|---|---|---|---|
| 1 | **Hero: "Meet {Name}"** | Recognition + price + action, all above the fold on mobile | Breadcrumb; gallery (main plate + thumbs, video tile); kicker `{Breed} · {Girl/Boy} · ID #{id}`; H1 `{Name}, the {Colour} {Breed} {Girl/Boy}`; availability line with sync date; price card (price, "All-in", 1-line inclusions, 5-day promise line); WhatsApp (primary) + Book a viewing (secondary); 4 trust chips | never (a page needs a photo to exist) |
| 2 | **Passport facts** | Scan-able specifics | Breed, gender, colour, born (DOB) / age, origin, HDB status, ID, expected adult size (puppy value or breed range, labelled), ready to go home | each row hides when null |
| 3 | **About {Name}** | Warm, specific, honest intro | 2 short paragraphs built from data + breed facts, with an honest "what we can tell you / ask us for" line | never (falls back to the attribute-only paragraph) |
| 4 | **Health record** | De-risk the health worry | 4 health stamps; Singapore schedule timeline (6/8/12 + optional 16, deworm with each); going-home timing; 5-day nurse-back promise; records handed over; first-timer Pet Ownership Course link | puppy-specific dates only when `vaccinations[]` exists |
| 5 | **What {price} includes** | Make the all-in price feel generous | Itemised list: vaccinations + microchip, AVS licence paperwork done at purchase, starter kit (30 items, $533 itemised), free delivery + playpen setup, first training lesson, free boarding up to 1 month after deposit, ongoing WhatsApp support → link `/starter-kit/`, `/pricing/` | never on available; replaced on placed |
| 6 | **Is a {Breed} right for you?** | Breed-fit so the right families enquire | Size, coat, exercise, company needs, children, HDB, lifespan; "Great fit if / Think twice if"; link to the breed guide | when `breedFacts[breed]` is missing |
| 7 | **What happens next** | Remove "how does buying work" friction | 5 steps: WhatsApp → visit Balestier → reserve with deposit (free boarding ≤1 month) → delivery + setup + walkthrough → first training lesson | never |
| 8 | **Visit us in Balestier** (deep band) | Real-shop proof | Owners (Nelson and Kim), address, hours, MRT/bus, parking, licence AS24J00046 with registry link, map link, Book a viewing | never |
| 9 | **Reviews** | Social proof from real buyers | ReviewSlider (per breed), rating line from `site.reviews`, link `/reviews/` | slider hides itself if empty; rating line stays |
| 10 | **FAQ about {Name}** | Objection handling + FAQPage schema | 6–8 Q&As generated from data (see B5) | a question hides when its data is missing |
| 11 | **Recently found homes** (compact) | Social proof that puppies really go home | 3–4 placed puppies of the same breed (placed archive), small tiles, no prices | when fewer than 2 placed in the breed |
| 12 | **Other puppies available now** | Cross-sell, same breed first | ListingGrid, max 6, same breed first | when none |
| 13 | **Final CTA** | Last chance to act | FinalCta (existing), reserve prefill with ID | never |
| — | **Sticky mobile bar** | Persistent, attributed action | `WhatsApp about {Name}` + `Book a viewing`, ID in the prefill, appears after the hero CTA scrolls out, hides over the FinalCta | desktop (≥1024 px) |

**Placed variant (same URL, retention window):** sections 1 → "{Name} found a loving home" hero (no price, ribbon on the photo, "Ask about a similar puppy"), then **12 moves to position 2**, then 3 (past-tense copy), 6, 7, 8, 9, 13. Hide 2 (keep only breed, gender, colour, "found a home {month}"), 4, 5, 10, 11. No Product schema. The sticky bar becomes "Ask about a similar {Breed}" + "See available puppies".

## B3. Component list

New components go in `src/components/puppy/` so the family stays together. Shared helpers go in `src/lib/puppy-page.ts`.

| Component | Props | Fallbacks | Reuses |
|---|---|---|---|
| `PuppyHero.astro` | `pup`, `breedName`, `breedSlug`, `photos: ImageMetadata[]`, `priceStr`, `waHref`, `bookHref`, `waSource`, `syncedAt`, `placed?: {phrase}` | No price → "Ask for price" with no Offer. No `bookHref` → WhatsApp booking prefill. Placed → ribbon + similar-puppy CTA | `Breadcrumb`, `astro:assets Image` |
| `PuppyGallery.astro` | `photos[]`, `alts[]`, `video?: string`, `askVideoHref` | 1 photo → no thumb rail, "Ask for a video" tile only. No JS → thumbs are anchor links to stacked images | — |
| `PuppyPassport.astro` | `rows: {k, v, note?}[]` | A row with null `v` is dropped; the component throws if 0 rows | replaces the inline `spec` table |
| `PuppyAbout.astro` | `pup`, `breedFacts?`, `pronouns` | No breedFacts → attribute-only paragraph (today's honest fallback) | — |
| `PuppyHealthRecord.astro` | `pup`, `vaccinations?: {dose, date}[]`, `schedule` (from `src/data/health-schedule.ts`) | No puppy dates → generic SG schedule, labelled "The schedule every puppy follows" | `StepFlow` for the timeline (ordered) |
| `PriceIncludes.astro` | `price`, `items` (from `src/data/offers.ts` / `starter-kit-items.json`) | No price → section hides | `ValueBundle` if its markup fits; else new |
| `BreedFit.astro` | `breedFacts`, `breedSlug`, `breedName` | Missing facts → section hides | `ComparisonSplit` styles for fit / think-twice |
| `NextSteps.astro` | `name`, `waHref`, `bookHref` | Placed → steps reworded "for your puppy" | `StepFlow` |
| `VisitShop.astro` | none (reads `site`) | — | `TrustBlock` styles |
| `RecentlyHomed.astro` | `breedSlug`, `exceptId`, `max=4` | <2 → hides | `placedPups()` from `src/lib/loving-homes.ts` |
| `PuppyStickyBar.astro` | `waHref`, `waLabel`, `secondaryHref`, `secondaryLabel`, `waSource` | No secondary → single full-width WhatsApp | generalises `StickyMobileCTA.astro` (existing, unused) |
| (existing) `FAQ.astro`, `ReviewSlider.astro`, `ListingGrid.astro`, `FinalCta.astro`, `Schema.astro` | unchanged | | |

`src/lib/puppy-page.ts` exports: `pronounsFor(gender)`, `article(word)` (fixes "a apricot"), `pupH1()`, `pupTitleTag()`, `pupMeta()`, `waMessages(pup, breed, url)`, `passportRows(pup, breedFacts)`, `puppyFaq(pup, breedFacts)`, `productSchema(pup, photos)`, `faqSchema(items)`.

## B4. Data requirements

Status key: **have** = in `available-puppies.json` today · **feed** = already in the SpreadSimple sheet, needs a sync change · **new** = needs a new sheet column or data file. Every *new* field is optional, and its section or row hides when the field is empty.

| Field | Status | Source | Used in | If missing |
|---|---|---|---|---|
| `id`, `name`, `color`, `gender`, `price`, `image`, `origin`, `hdbApproved`, `crossLabel`, `bookHref`, `location` | have | sheet | everywhere | existing behaviour (name → "{Colour} {Girl/Boy} #{id}") |
| `dob` (ISO date) | **feed** | `DOB-` (parsed today, then discarded) | Passport "Born", FAQ, age computed at **build** | show sync-time `age` |
| `images[]` (up to 5) | **feed** | `Image-`…`Image5-` (sync saves only `[0]`) | Gallery, Product `image[]` | single plate + video tile |
| `video` | have (mostly null) | `Video-` | Gallery video tile, VideoObject | "Ask for a video of {Name}" WhatsApp tile |
| `sizeNote` | have (null for Biscuit) | `Size-` | Passport "Size" | breed range from breedFacts, labelled "Maltipoos usually…" |
| `syncedAt` | have | file root | "Availability checked {date}" | hide the line |
| `readyDate` | **new** (optional) | new `ReadyDate-` column | Passport, hero line, FAQ | generic rule: "Puppies go home about a week after their 2nd vaccination (around 9 weeks). We'll confirm {Name}'s date." |
| `vaccinations[]` `{dose, date}` | **new** (optional) | new `Vacc1-`…`Vacc3-` columns | Health record per-puppy dates | generic SG schedule |
| `adultWeightEstimate` | **new** (optional) | new `AdultWeight-` column | Passport | breed range, labelled as a breed range |
| `parents` `{mum?, dad?, photos?}` | **new** (optional, owner decision) | new columns | "Meet the parents" sub-card in About | hidden. **Never** a parent claim we cannot show |
| `siblings[]` | derivable later | same litter if the sheet gains `Litter-` | "Littermates" row in Other puppies | hidden |
| `temperamentNote` (per puppy) | **new** (optional) | new `Notes-` column, written by staff | About paragraph 2 | breed temperament only |
| `breedFacts[breed]` | **new data file** | extract from each `src/pages/puppies/{breed}.astro` (already-published facts) into `src/data/breed-facts.ts` | About, BreedFit, FAQ, Passport size | BreedFit hides; About uses the attribute fallback |
| `healthSchedule` | **new data file** | `business-context.md` § Singapore Regulatory & Health Facts → `src/data/health-schedule.ts` | Health record, FAQ | n/a (static, canonical) |
| `includes` | have | `src/data/offers.ts`, `starter-kit-items.json`, `business-context.md` | PriceIncludes | n/a |

`breedFacts` shape (one entry per breed with a page; start with the 7 core breeds + any breed with a live puppy):
```ts
{ maltipoo: {
  size: 'Roughly 3 to 6 kg fully grown, depending on the Toy or Miniature Poodle parent',
  coat: 'Soft and low-shedding; no dog is truly allergen-free',
  exercise: 'About 30 minutes a day, plus indoor play and company',
  company: 'Needs company. Not suited to a home that is empty from 8am to 6pm',
  children: 'Gentle with children, sociable and quick to learn',
  hdb: 'HDB approved',            // breed-level; the puppy's own tick still wins
  lifespan: '12 to 15 years',
  fitIf: [...], thinkTwiceIf: [...],
  guideHref: '/puppies/maltipoo/', sectionAnchors: { temperament: '#temperament', size: '#size', hdb: '#hdb', grooming: '#grooming' },
} }
```
Every string must be copied from the published breed page. A new fact needs a source.

## B5. Copy patterns (shown with Biscuit's real data)

**Title tag:** `{Name}, {Colour} {Breed} {Girl|Boy} for Sale | Curious Tails`. Drop " | Curious Tails" if over 60 chars. Unnamed: `{Colour} {Breed} {Girl|Boy} #{id} for Sale | Curious Tails`.
→ `Biscuit, Apricot Maltipoo Girl for Sale | Curious Tails` (55)
*Why:* targets the puppy's own long-tail and leaves `{breed} singapore` to the breed page.

**Meta description (≤155):** `Meet {Name}, {a/an} {colour} {breed} {girl}{, age}. {price} all-in{, HDB approved}. Vaccinated, microchipped, vet-checked. See {her} at our AVS-licensed Balestier shop.`
→ `Meet Biscuit, an apricot Maltipoo girl, 2 months. $3,888 all-in, HDB approved. Vaccinated, microchipped, vet-checked. See her at our AVS-licensed Balestier shop.` (152)

**H1:** `{Name}, the {Colour} {Breed} {Girl|Boy}` → **Biscuit, the Apricot Maltipoo Girl**
Kicker above: `MALTIPOO · GIRL · PUPPY ID #2938`

**Availability line:** `Available now · checked {d MMM} · Balestier` → *Available now · checked 1 Nov · Balestier*

**Price card:** `$3,888` · `All-in price` · "Vaccinations, microchip, licence paperwork, the 30-item starter kit and home delivery with playpen setup are already included." · promise line: "If she falls sick in her first 5 days home, bring her back and we'll nurse her."

**About (Biscuit):**
> Biscuit is an apricot Maltipoo girl, about 2 months old, waiting for her family at our Balestier shop. She is vaccinated, dewormed and microchipped, has passed a vet health check, and is HDB approved, so she can move into a flat with no separate approval.
>
> Maltipoos are companion dogs first: gentle with children, quick to learn, and happiest when someone is usually home. If that sounds like your household, come and meet her. There is no pressure to buy, and we will tell you honestly if another breed suits you better.
>
> *Want to see more of Biscuit? Ask us on WhatsApp for more photos or a short video.*

(Source: data + `maltipoo.astro` temperament + `business-context.md` Differentiation #6.)

**Breed-fit headings:** "Is a Maltipoo right for your home?" · columns "A great fit if…" / "Think twice if…"
- Great fit: someone is usually home; you want a small, low-shedding dog (no dog is truly allergen-free); you live in an HDB flat; you have children who'll be gentle.
- Think twice: the home is empty from 8am to 6pm most days; you want a long-run jogging partner; you can't commit to regular grooming.

**Health heading:** "Biscuit's health record" · intro: "Every puppy follows the same Singapore schedule, and we hand you the records." Schedule: Week 6 · 1st vaccination + deworming → Week 8 · 2nd vaccination + deworming → about Week 9 · ready to go home → Week 12 · 3rd vaccination + deworming → Week 16 · optional 4th if your vet advises → then a yearly booster.

**Trust line (hero chips):** `✓ Vaccinated` `✓ Microchipped` `✓ Vet health-checked` `✓ HDB approved` (only on a tick). Under the buttons: `AVS-licensed pet shop · AS24J00046 · ★ 4.9 from 65 Google reviews` (values from `site.ts`).

**Next steps (5):**
1. **Say hi on WhatsApp.** Ask for more photos or a video of Biscuit, and anything else you want to know.
2. **Meet her in Balestier.** Tuesday to Sunday, 11am–6pm. No pressure to buy.
3. **Reserve with a deposit.** Not ready yet? We board her free for up to a month, food and lodging covered, and keep her vaccinations on schedule at our cost.
4. **We bring her home.** Delivery is timed around you. We set up the playpen and walk you through all 30 starter-kit items.
5. **Your first training lesson** with an AVS-certified trainer is on us.

**FAQ bank (generated, Biscuit values):**
1. *Is Biscuit still available?* Her page updates when our puppy list syncs (last checked 1 Nov). WhatsApp us to confirm right now.
2. *What does the $3,888 include?* (inclusions list)
3. *Can I meet Biscuit before deciding?* Yes, at 2 Balestier Road, Tuesday to Sunday 11am–6pm. Book a viewing or just WhatsApp us.
4. *Can Biscuit live in an HDB flat?* Yes, she is HDB approved. HDB allows one dog of an approved breed per flat, and we complete the dog licence for you at purchase. First-time owners must also complete the AVS Pet Ownership Course (link).
5. *What if I'm not ready to bring her home yet?* Place a deposit and we board her free for up to a month, with vaccinations kept on schedule at our cost.
6. *Which vaccinations will she have had?* The 6/8/12-week schedule, with deworming at each visit. Puppies go home about a week after the 2nd vaccination.
7. *What if she falls sick after going home?* Within her first 5 days, bring her back and we'll nurse her.
8. *How big will Biscuit get?* Most Maltipoos reach roughly 3 to 6 kg; the Poodle parent decides. Ask us about her expected adult size.

**Placed copy:** H1 `{Name} the {Breed} Found a Loving Home` (existing). Fix "a apricot" with `article()`.

**Banned:** pedigree, DNA, Malay (and so "Malaysia"); "hypoallergenic" as a promise; "guarantee" (we promise specific things, worded exactly); invented response times; deposit amounts (not in config); parent claims without parent data.

## B6. Conversion design
- **Primary CTA:** green "WhatsApp about {Name}". Prefill: `Hi! I'm interested in {Name}, the {colour} {gender} {breed} (ID {id}). Is {she} still available? {url}`. `data-wa-source="pup:{id}"` on every instance.
- **Secondary CTA:** "Book a viewing" → `bookHref` (cal.com) or a WhatsApp booking prefill. Opens in a new tab only for cal.com.
- **Tertiary (gallery):** "Ask for a video of {Name}" → WhatsApp prefill (`data-wa-source="pup-video:{id}"`).
- **Fold rule (mobile 390×844):** the kicker, H1, price and primary CTA must all sit above 844 px with the header showing. Achieved by: photo plate ≤ 300 px tall on mobile (4:3 at 343 px wide = 257 px), price card directly under the H1, and chips moved *below* the buttons.
- **Sticky bar:** appears when the hero CTA leaves the viewport (IntersectionObserver), hides when FinalCta is in view, 64 px + safe-area, 2 buttons (WhatsApp 60% / Book 40%), ≥48 px targets. The global WhatsApp float is suppressed on this route (BaseLayout prop `hideWhatsAppFloat`).
- **Trust near price:** 4 chips + licence/rating line + the 5-day promise line inside the price card.
- **Objection handling map:** "Is it healthy?" → Health record + 5-day promise · "Is it a scam?" → licence + registry link + real shop + reviews · "Hidden costs?" → What $X includes · "Will it fit my life?" → Breed fit · "How does buying work?" → Next steps · "Not ready yet" → free boarding · "Will they help after?" → WhatsApp support + training lesson.
- **What happens next** is its own section (B2 §7), and the FAQ repeats it.
- **No urgency theatre:** no visitor counters, no countdowns. The honest urgency is "puppies are reserved quickly; this page shows today's status".
- **GA4:** keep `whatsapp_click` with `wa_source`; add `pup_gallery_view`, `pup_video_ask`, `pup_book_click`, `pup_sticky_click` (the sticky bar's own source suffix, e.g. `pup:2938:sticky`).

## B7. SEO
- **Title / meta / H1:** patterns in B5. `<title>` ≤ 60, meta ≤ 155, one H1.
- **Canonical:** unchanged `/puppies/{breed}/{id-slug}/` with a trailing slash.
- **Product + Offer** (available only):
  ```json
  {"@type":"Product","name":"Biscuit, Apricot Maltipoo Girl","sku":"2938","category":"Maltipoo puppy",
   "image":["…/biscuit-1.jpg","…/biscuit-2.jpg"],"description":"…meta…",
   "additionalProperty":[{"@type":"PropertyValue","name":"Gender","value":"Female"},
     {"@type":"PropertyValue","name":"Colour","value":"Apricot"},
     {"@type":"PropertyValue","name":"Date of birth","value":"YYYY-MM-DD"},
     {"@type":"PropertyValue","name":"HDB approved","value":"Yes"}],
   "offers":{"@type":"Offer","price":3888,"priceCurrency":"SGD","availability":"https://schema.org/InStock",
     "url":"https://curioustails.sg/puppies/maltipoo/2938-apricot-girl/","seller":{"@id":"https://curioustails.sg#business"}}}
  ```
  Rows with null data are omitted. **No** `aggregateRating`/`review` on the Product (business reviews stay on PetStore). **No** return or shipping policy nodes until the owner confirms the terms.
- **FAQPage:** from the same `puppyFaq()` array that renders the visible FAQ (one source, so they can't drift). Google shows FAQ rich results only for authoritative gov/health sites, so treat this as AI-answer and entity markup, not a SERP feature.
- **BreadcrumbList:** Home → Puppies → {Breed} → {Name}, as today. The visible breadcrumb uses the same items.
- **VideoObject:** only when `video` is a hosted file/URL with a thumbnail.
- **Placed:** no Product, no FAQPage. Keep the breadcrumb. Keep `index` within the retention window (existing policy).
- **Internal links (each from a decision point, descriptive anchors):** breed guide (`/puppies/maltipoo/`, anchor "our Maltipoo guide") plus section anchors in BreedFit; `/pricing/` ("how our all-in prices work"); `/starter-kit/` ("the 30-item starter kit"); `/delivery/` ("delivery and playpen setup"); `/free-training/`; `/first-time-owners/hdb-breeds/` ("HDB-approved breeds"); `/reviews/`; `/contact/`; `/available-puppies/`. Follow the anchor contract: never use a transactional "puppies for sale" anchor to `/puppies/`.
- **Image alt rules:** photo 1: `{Name}, {a/an} {colour} {breed} {girl/boy} puppy at Curious Tails, Balestier`; photo n: `{Name} the {breed} puppy, photo {n} of {N}`. Never "image", never keyword lists, and no alt text for decorative stamps.
- **Image files:** keep `astro:assets` output; cap widths at the source (800 px); add `fetchpriority="high"` on photo 1 only.

## B8. Mobile
- **Sticky CTA:** as B6. It never overlaps content: add `padding-bottom: calc(64px + env(safe-area-inset-bottom))` to `<main>` on this route.
- **Gallery:** a horizontal scroll-snap strip (one image per view, 4:3), dot indicators, swipeable, with a "1 / 5" counter. With 1 photo there is no strip and no dots. The video tile is the last slide.
- **Density:** passport facts in a 2-column grid of mini cards (not a long table); health timeline as a vertical stepper; breed-fit columns stack; FAQ collapsed (`<details>`), all else open.
- **Tap targets:** ≥ 48 px high, 8 px apart. The thumbnails are the exception (44 px) and also swipe.
- **Page speed budget (mobile, Lighthouse):** LCP ≤ 2.0 s (the hero photo, preloaded via `fetchpriority`), CLS ≤ 0.05, total images on first load ≤ 6, below-the-fold images `loading="lazy"`, no autoplay video, JS for the page ≤ 8 KB (gallery dots + sticky observer), the review slider lazy-hydrated, the marquee removed from this route.

## B9. Acceptance checks (production is done when all are true)

**Content and facts**
- [ ] Every claim traces to `business-context.md`, `project-config.md`, `site.ts`, the sync data or the published breed page. `npm run check:content` passes.
- [ ] No banned words (pedigree, DNA, Malay) in built HTML for any puppy page (grep `dist/puppies/**/index.html`).
- [ ] A puppy with only the minimum fields (photo, ID, breed, price) renders without empty rows, "null", "undefined", "a apricot"-style errors, or empty sections.
- [ ] Placed variant: no price, no Product, no FAQPage, cross-sell comes second, sticky bar says "similar".

**Conversion**
- [ ] At 390×844 the H1, price and primary WhatsApp CTA are above the fold (Playwright bounding-box assertion).
- [ ] The sticky bar appears after the hero CTA scrolls out, hides at FinalCta, never covers content, and its prefill contains the puppy ID.
- [ ] Every WhatsApp link on the page carries `data-wa-source` starting `pup:{id}` (or `sold:{id}`). The global float is absent on this route.
- [ ] `bookHref` present → Book a viewing goes to cal.com. Absent → WhatsApp booking prefill.

**SEO**
- [ ] `<title>` ≤ 60 chars, meta ≤ 155, exactly one H1 containing name + breed.
- [ ] `npm run check:schema` and `check:schema:req` pass. Product has an Offer only when the price is visible. FAQPage text equals the visible FAQ text.
- [ ] Rich Results Test: Product snippet eligible with no errors (warnings for optional shipping/returns are accepted).
- [ ] Contextual links present: breed guide, `/pricing/`, `/starter-kit/`, `/delivery/`, `/reviews/`. `npm run check:links` passes.
- [ ] Every gallery image has a unique alt.

**Mobile, a11y, performance**
- [ ] Lighthouse mobile ≥ 90 performance, ≥ 95 accessibility, LCP ≤ 2.0 s, CLS ≤ 0.05 on the pilot URL.
- [ ] `npm run check:contrast`, `check:keyboard`, `check:health` and `check:design` pass on the route.
- [ ] The gallery works with JS off (stacked images). `prefers-reduced-motion` disables reveals and stamps.
- [ ] Image count on first load ≤ 6. The built page has ≤ 40 `<img>` in total (from 134).

**Ops**
- [ ] `npm run build` is green. The puppy-page count equals live puppies with photos + placed within retention (no route lost).
- [ ] The redirect map (`check:redirects`) is unchanged for expired puppies.
