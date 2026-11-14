# K-118: plan to fold the 28 puppy-page points into home and breed pages

**Date:** 14 November 2026 · **Card:** K-118 · **Type:** plan only. No site file was edited.
**Source of truth:** https://ct-content-gap.pages.dev/ and `D:\Claude Code\Curious Tails Review\k080-content-gap\build.py`
(66 points: 15 puppy-only, 13 partial, 38 already on both. This plan does not re-run the analysis.)
**Implementation list:** `reports/content-gap-plan-tasks.json` (16 tasks, for the DeepSeek worker)

---

## 1. Result in one screen

| Destination | Count | Points |
|---|---|---|
| Both home and breed | 17 | A7, B1, B2, B3, D1, D2, D3, D5, D7, G3, I3, A2, A3, A6, B5, D8, G4 |
| Home only | 2 | F5, J3 |
| Breed only | 4 | I2, C4, F7, C2 (C2 is already in the breed source, so it needs no task, see §4) |
| Keep puppy-only | 5 | D4, F0, F1, F8, F9 |
| **Total** | **28** | 15 puppy-only + 13 partial |

**The five integrations worth the most**

1. **A7 + B1/B2/B3: name the 3% card surcharge wherever the price is called all-in.** Home and 44 of the 48 breed pages
   say "all-in" and "No add-ons quietly billed later", but a card payment adds 3%. The owner confirmed this surcharge
   (owner addendum, 8 Nov). It is the only point here with legal weight and the only one where the site's current copy
   is wrong, not just thin.
2. **D1 + D2 + D3: one vaccination timeline on every breed page.** Six breed pages already have the table typed out by
   hand and 42 have nothing. Moving it into one data-fed component fixes the gap on 42 pages and stops the six copies
   from drifting apart.
3. **D5: say that Vets For Pets gives the remaining core vaccines and Curious Tails pays.** This is the claim a buyer
   can check most easily (a named clinic and a shop that pays). We publish the clinic names now. The phone numbers wait
   for the owner, because one of them does not match the public listing (§5, Q2).
4. **G3 + G4 + I3: directions, owners who deliver, and "no pressure to buy" in the visit block.** Both pages ask people
   to visit a shop that is not on an MRT line and never say how to get there. A single `FinalCta` edit covers all 48
   breed pages.
5. **A6: change "until you're ready" to "up to a month, with vaccinations kept on schedule at our cost".** Home and
   48 breed pages currently make an open-ended promise. The capped version is one the shop can keep, and our own blog
   already prints it (`/blog/pet-ownership-course-singapore/`).

**The three that must stay puppy-only:** D4 (ready-to-go-home date), F1 (exact date of birth) and F9 (the passport
dossier). All three are records of one animal. On a home or breed page they would either need a live feed or go stale
within days. F0 (the named introduction) and F8 (the FAQ written around the puppy's name) also stay, for the same
reason. Their two universal answers, how to pay and what happens if you are not ready, are carried over through B1 and
A6.

**Growth (visible words, measured against the 13 Nov captures):** home grows from 4,901 to about 5,150 (**+5%**).
Breed pages grow from about 4,250 to about 4,620 (**+9%**), or about +6% on the six that already have the vaccination
table. Breed pages grow the most, and most of that growth is the vaccination table and the visit card. §6 lists what
gets cut to make room.

**Tasks for the implementation worker: 16** (T01 to T16). Each one leaves the site building.

---

## 2. Structural decision: how anything reaches 48 breed pages

The breed pages are 48 hand-written `.astro` files in `src/pages/puppies/`. Two others, `bernedoodle` and `labrador`,
are short pages and are excluded. All 48 share one component skeleton (Hero, AvailablePuppies, StarterKitMarquee,
ComparisonSplit, FAQ, FinalCta). Their prose, however, is typed separately in each file, and that is where the drift
already shows. For example, 21 files hard-code their hero price instead of reading `breedPricing`, and only 6 files
have the vaccination table.

So the plan has **one rule for the implementation worker**: no new sentence is typed into a breed file. Each new fact
goes in once, in one of two places:

- **`src/data/buying-terms.ts`** (new). This file holds the shop-wide facts that the puppy page already states: payment,
  surcharge, inclusions, boarding cap, availability rule, the reserve steps, the vaccination rows, the Vets For Pets
  sentence, the records sentence and the Pet Ownership Course link. It also holds `KIT_TOTAL` and `KIT_COUNT`, which
  are computed from `starter-kit-items.json`. The kit total is not typed in.
- **`site.ts`**: one new field, `directions`, plus `ownersLine`.

These reach the pages through a **shared component that all 48 files already render**: Hero, FinalCta,
AvailablePuppies, StarterKitMarquee or FAQ. Only two things need a new component: `VaccinationTimeline` and
`ReserveSteps`. Those are inserted at a fixed anchor by a codemod, and the codemod adds an identical line to every file.

**Scope guard:** the facts about the health schedule, boarding and going home about a week after the second vaccination
apply to **puppies in our Balestier shop**. Imported and overseas listings also appear on breed pages, and they run on
different terms: a 50% deposit and the balance before the flight (`ImportedPuppies.astro:32`). Every new sentence below
says "puppies at our shop" or sits in a block that is only about shop puppies.

---

## 3. The plan, one row per point

Copy approach key: **verbatim** = the puppy page's sentence unchanged; **generalised** = the puppy page's sentence with
the name and pronoun removed; **data** = rendered from an existing data field; **merged** = no new sentence, carried by
another row.

### 3a. The 15 puppy-only points

| # | Point | Destination | Where it goes | Copy approach | Evidence |
|---|---|---|---|---|---|
| A7 | 3% card surcharge named next to the all-in price | **Both** | (1) Hero: one line rendered by `Hero.astro` under `priceAnchor` whenever that string contains "all-in". This reaches home and all 48 breed pages. (2) Home ValueBundle subhead, replacing "No add-ons quietly billed later". (3) Breed price block: footnote under the price ComparisonSplit. (4) A short footnote in each listing component that prints "$X all-in" (AvailablePuppies, ListingGrid, ImportedPuppies, OverseasPuppies). (5) The "How do I pay?" FAQ (B1). The sentence "No add-ons quietly billed later." is deleted from 44 hero anchors. | Generalised, using wording that is true whatever the answer to Q1: "Credit card payments carry a 3% bank surcharge." It upgrades to "The only extra is…" after the owner answers Q1. | Puppy page hero and includes intro; owner addendum §3 (`reports/puppy-page-owner-feedback-addendum-2026-11-08.md:37-44`) |
| B1 | Two payment methods: PayNow or credit card | **Both** | Merged with A7, B2 and B3 into **one sentence** in the price block (breed footnote, home ValueBundle subhead) and **one shared FAQ**, "How do I pay?". The FAQ is appended to the FAQ list on home and on all 48 breed pages, so it lands in both the visible FAQ and the FAQPage JSON-LD. | Verbatim: "PayNow, or credit card. Credit card payments carry a 3% bank surcharge." | Puppy page "Ways to pay" and FAQ; owner addendum §3 |
| B2 | What the 3% is and when it applies | **Both** (merged) | Inside the B1 FAQ answer. | Verbatim: "The 3% is a bank surcharge and applies to credit card payments." | Owner addendum §3 (owner-approved support line) |
| B3 | PayNow: ask for the account details when you reserve | **Both** (merged) | Inside the B1 FAQ answer. | Verbatim: "Ask us for the account details when you reserve." | Puppy page PayNow card |
| D1 | Vaccination schedule by week: 6, 8, 12, 16, then yearly | **Both** | **Breed:** a new `VaccinationTimeline` component directly after the `#health` CaptionedBlock. It replaces the 6 hand-typed tables (cavapoo, bichonpoo, cockapoo, corgi, mini-dachshund, shiba-inu) and is inserted on the other 42. **Home:** one sentence added to "How Every Puppy Is Checked Before You Take It Home", with a link to `/learn/puppy-health/`. Home gets no table. | Data. The rows come from the existing breed-page table (`cavapoo.astro:453-462`). **Week 16 keeps the site's current wording**, "optional fourth vaccination, if advised by your vet", until the owner answers Q3. | `cavapoo.astro:453-462`; `learn/puppy-health.astro:32,104`; puppy page health record |
| D2 | Deworming at every vaccination visit | **Both** (merged) | Carried by the D1 rows ("vaccination and deworming") and the home sentence ("with deworming at every visit"). | Merged | Same as D1 |
| D3 | Goes home about a week after the 2nd vaccination | **Both** (merged) | The Week 9 row of the D1 table, plus the home health sentence. | Generalised: "Puppies at our shop go home about a week after the second vaccination, around week 9." | `cavapoo.astro:456`; `learn/puppy-health.astro:104`; puppy page |
| D4 | This puppy's ready-to-go-home date | **Keep puppy-only** | n/a | n/a | Per-animal record. It goes stale as soon as the puppy changes. D3 is the version that works on other pages. |
| D5 | Vets For Pets: remaining core vaccines, and Curious Tails pays | **Both** | **Breed:** one note line directly under the VaccinationTimeline. **Home:** the second half of the new health sentence. **Clinic names only. No phone numbers** until the owner answers Q2. | Generalised from the owner's verbatim template ("For {Name}'s remaining puppy core vaccines…"): "Your puppy's remaining core vaccines are given at Vets For Pets (Jurong or Lengkok Bahru), and Curious Tails pays for them. Tell the clinic we're covering it." | Owner addendum §4 (owner verbatim, a template for every puppy); `lib/schema.ts:193` "Partner vet: Vets For Pets"; `about-us.astro:223` |
| D7 | AVS Pet Ownership Course required for first-time owners | **Both** | **Breed:** the last row of VaccinationTimeline ("Before licensing (first-time owners)"), already on 6 pages. **Home:** one sentence added to "Bringing a Puppy Home to an HDB Flat", linking to `/blog/pet-ownership-course-singapore/`. | Data, from the existing row. Home sentence generalised from the puppy page. | AVS Pet Ownership Course page (linked from `cavapoo.astro:466`); `blog/pet-ownership-course-singapore.astro:147,158`, which says it has been compulsory since 1 September 2024 |
| F0 | Named introduction paragraph | **Keep puppy-only** | n/a | n/a | On any other page it becomes a template with the name left blank (K-080 keep list). |
| F1 | Exact date of birth | **Keep puppy-only** | n/a | n/a | Per-animal record that needs a live feed (K-080 keep list). |
| F8 | FAQ written around this puppy's name and price | **Keep puppy-only** | n/a. Its two universal answers move through B1 and A6. | n/a | "Is Biscuit still available?" cannot exist on a breed page. |
| G3 | Getting here: MRT, buses, parking | **Both** | New field `site.directions`. **Breed:** rendered in `FinalCta` under the opening hours. **Home:** rendered in "Visit Our Licensed Puppy Shop in Balestier" under `site.hours`. | Verbatim: "Toa Payoh MRT, then bus 129 for 2 stops, or a 12-minute walk from Novena MRT. Buses 21, 129, 130, 131, 139, 145 and 186 stop a minute away on Balestier Road. Paid HDB parking behind the shop." | Puppy page "Getting here"; template spec §8 (`puppy-page-template-spec-2026-11-08.md:145`). Bus numbers to be re-checked (Q4). |
| I2 | If it's not the right match, we'll help find the one that is | **Breed** | `FinalCta` default `body`, as the sentence after the existing WhatsApp line. | Generalised: "If a puppy isn't the right match, we'll tell you, and help you find the one that is." | Puppy page closing CTA. The home equivalent is carried by F5. |
| I3 | No pressure to buy when you visit | **Both** | **Breed:** `FinalCta`, next to the hours. **Home:** the Visit section, the same line, and step 01 of ReserveSteps. | Verbatim: "No pressure to buy." | Puppy page steps and breed note; production `PuppyDetail.astro:131,296` |

### 3b. The 13 partial points

| # | Point | Destination | Where it goes | Copy approach | Evidence |
|---|---|---|---|---|---|
| A2 | All six inclusions named at the price | **Both** | **Home:** the ValueBundle subhead is rewritten as the six-inclusion sentence plus the A7 line. **Breed:** the price ComparisonSplit `subhead` keeps its own market sentence, and the shared inclusion sentence becomes the first sentence of the footnote under it (the same footnote as A7 and B1). | Generalised: "Vaccinations, microchip, licence paperwork, a free first training lesson with an AVS-certified trainer, the 30-item starter kit and home delivery with playpen setup are already included." | Puppy page hero; home FAQ (`index.astro:243`), which already says vaccinations, microchip and deworming are in the all-in price |
| A3 | Starter kit: 30 items worth $533 | **Both** | (1) `StarterKitMarquee` prints the total it already computes (`StarterKitMarquee.astro:24`) instead of "$500+". This one edit reaches home and 48 breed pages. (2) The home "Starter Kit Itemized Value Breakdown" table is rebuilt from the 6 categories in `starter-kit-items.json` ($139 + $63 + $103 + $78 + $49 + $101 = $533). The current table includes "Microchip insertion and vaccination $100" and items that are not in the kit, so it contradicts the 30-item list. (3) The visible "$500+ starter kit" and "30+ items" in breed prose become `${KIT_TOTAL}` and `${KIT_COUNT}`. Titles and meta descriptions are left alone ("$500+" is still true). | Data | `src/data/starter-kit-items.json` (30 rows, sum 533, checked 14 Nov); `pages/starter-kit.astro:68` already prints $533 |
| A6 | Boarding: up to a month, vaccinations at our cost | **Both** | **Home:** paragraph 1 of "Free Boarding, Then Delivery When You're Ready" and step 03 of ReserveSteps. **Breed:** the "Free Training, Free Boarding and Real Aftercare" side list item ("Free boarding after deposit, until you're ready"), on 48 files by codemod. | Verbatim (generalised pronoun): "After your deposit, we board your puppy free for up to a month, food and lodging covered, with vaccinations kept on schedule at our cost." | Puppy page; live `blog/pet-ownership-course-singapore.astro:48,263` already says this |
| B5 | Availability not guaranteed until the deposit is received | **Both** | **Home:** replaces "Puppies are placed on a first-confirmed basis." in the "Reserve Your Puppy Today" ribbon. **Breed:** a line in `FinalCta` under the WhatsApp button. | Verbatim | Owner addendum §5 (owner's honesty line) |
| C2 | Delivery timed around you, usually mornings or evenings | **Breed: already present, no task** | Already in the breed source: "usually morning or evening" in the first-week block on 47 of 48 files (`maltipoo.astro:481`, and line 483 of `vis-breed.txt`). K-080 read the delivery paragraph only. | n/a | `vis-breed.txt:483` |
| C4 | Reserve-to-home journey as five numbered steps | **Breed** | New `ReserveSteps` component, extracted from the inline `<ol>` on home (`index.astro:577-591`). Home switches to the component with no visible change other than the A6, I3 and B5 wording. Breed: inserted directly after "Free Training, Free Boarding and Real Aftercare", replacing that block's first paragraph, which the steps now say. | Data (`buying-terms.ts` steps). Step copy is home's existing five steps with the A6 and I3 updates. | `index.astro:577-591`; puppy page "Bringing Biscuit home, step by step" |
| D2 | Deworming at every visit | **Both** | See the D2 row in §3a (merged into D1). | Merged | Same as D1 |
| D8 | Records handed to you at handover | **Both** | **Breed:** in the D5 note line under VaccinationTimeline. **Home:** in the health sentence. | Generalised: "You take the vaccination and health records home with you." | Puppy page health record; live `first-time-owners/puppy-care-101.astro:54` ("we hand you the records") |
| F5 | A sold puppy leads to a similar one (home) | **Home** | One line under the "Puppies for Sale in Singapore, Available Right Now" grid, with a WhatsApp prefill. The matching sentence in home FAQ 13 is cut. | Generalised: "Gone already? Tell us the breed and we'll find you a similar puppy, or tell you honestly when the next one is due." | Breed `AvailablePuppies` "Ask about a similar puppy"; puppy page F5/F7 copy |
| F7 | Next-litter honesty (breed) | **Breed** | `AvailablePuppies` (only="available"): one line after the grid, plus the empty state. One component edit covers 48 pages. | Verbatim from home: "Tell us the breed and we will let you know when one arrives." | Home FAQ 13; puppy page "we'll tell you honestly when the next one is due" |
| F9 | Passport dossier as one record | **Keep puppy-only** | n/a | n/a | Per-animal. Cards already carry the subset they need (K-080 keep list). |
| G4 | Owners do the deliveries and set up the playpens themselves | **Both** | New field `site.ownersLine`, rendered next to G3 in `FinalCta` (breed) and in the home Visit section. | Verbatim: "Run by owners Nelson and Kim, who are in the shop, do the deliveries and set up the playpens themselves." | Puppy page; the owner names are already on the site (`registry.ts:238`, about-us). This is not a new founder claim. |
| J3 | A book-a-viewing route on home | **Home** | A "Book a viewing" button next to "Get in touch" in the home Visit section. It links to WhatsApp with the prefill "Hi! I'd like to book a viewing at Balestier." No cal.com link is invented: the only booking links in the data are per puppy (`bookHref`). | Pattern from `PuppyDetail.astro:77` | Production PuppyDetail; puppy page "Book a viewing" |

---

## 4. Points that must not move to home, and why

D4, F1, F9, F0 and F8 are **records of one animal**. Home lists 11 breeds and a live grid that changes daily. On home,
a date of birth, ready date or passport would either be one puppy's facts shown as if they applied to all, or a feed
that goes stale. The listing cards already carry the subset that a grid needs: ID, sex, colour, age and availability.

Two more points **stay off home on purpose**:

- **The full D1 table.** Home gets one sentence and a link. A sixth table on a 4,900-word page is where the reader's
  attention runs out, and `/learn/puppy-health/` is the complete page for it.
- **D5 phone numbers.** These stay on the puppy page until Q2 is answered.

---

## 5. Owner questions (non-blocking; tasks ship with wording that is safe either way)

| Q | Question | Why it matters | Safe default used until answered |
|---|---|---|---|
| Q1 | Does PayNow carry any fee? (open item 1 in the owner addendum) | It decides whether the copy may say "the **only** extra is the 3% card surcharge". | "Credit card payments carry a 3% bank surcharge." The word "only" is not used. T16 upgrades the wording if the answer is no. |
| Q2 | Lengkok Bahru phone number. The owner's copy says **8268 4039**. A web search on 14 Nov returned **6255 6064** for Vets For Pets Lengkok Bahru (57 Lengkok Bahru #01-475), and no listing for 8268 4039, which may be a mobile or WhatsApp line. Jurong **6569 1627** matches. These are search-result listings, not a check against the clinic itself. | Printing a wrong clinic number across 49 pages would undo the "you can call to check" proof. | Clinic names only on home and breed. Numbers stay on the puppy page. |
| Q3 | Is week 16 a **core** dose (the puppy page says "4th core puppy vaccination") or **optional** (site-wide wording on 6 breed pages and `/learn/puppy-health/`)? | The two statements contradict each other today. It also decides how many doses Vets For Pets covers. | The site-wide "optional, if advised by your vet" wording stays on home and breed. The puppy page is flagged as the outlier. |
| Q4 | Re-check the bus list (21, 129, 130, 131, 139, 145, 186) and the 12-minute walk from Novena. | The list will appear on 49 pages. | Ship it as the puppy page has it. The implementation worker records the date it was checked (LTA or Google Maps). |
| Q5 | Should titles and meta descriptions that say "All-In" carry the surcharge? | A search snippet cannot carry a footnote. Legal weight is the owner's call. | Titles and meta descriptions are unchanged. Every *visible* "all-in" on the page carries the surcharge (enforced by the T02 gate). |

---

## 6. Keeping it readable: what gets cut or merged

| Page | Added (≈ words) | Cut or merged (≈ words) | Net |
|---|---|---|---|
| **Home** | Surcharge and six-inclusion subhead +35 · hero line +8 · "How do I pay?" FAQ +40 · health sentence (D1, D2, D3, D5, D8) +70 · Pet Ownership Course sentence +30 · visit block (directions, owners, no pressure, Book a viewing) +70 · sold-puppy line +25 · boarding cap +20 · listing footnotes +12 | "We mention this once, plainly…" line −20 · FAQ 13 "first-confirmed" and "let you know" sentences merged into the F5 line and B5 −25 · "Not Ready to Reserve Yet?" ribbon removed (it repeats the "Still deciding?" quiz ribbon 200 lines above) −25 · kit table rebuilt with 6 rows instead of 10, net 0 | **≈ +250 (+5%)** |
| **Breed (×48)** | Hero line +8 · price footnote (inclusions, payment) +50 · "How do I pay?" FAQ +40 · VaccinationTimeline +110 (0 on the 6 that have it) · D5/D8 note +45 · ReserveSteps +75 · boarding cap +10 · next-litter line +20 · FinalCta (directions, owners, no pressure, help find, availability) +80 · listing footnotes +12 | First paragraph of "Free Training, Free Boarding and Real Aftercare" −45 (the steps now say it) · the decorative word "all-in" removed from secondary labels (StatStrip, DefBox) instead of footnoting them, about −10 · the 6 hand-typed tables and their footnote paragraph replaced by the component, net 0 | **≈ +370 (+9%)**; **≈ +260 (+6%)** on the 6 that already have the table |

Writing rules for the implementation worker:

- Use one sentence wherever the puppy page used one sentence.
- The payment facts (A7, B1, B2, B3) appear as **one sentence** in the price block and **one FAQ answer**, never as a
  list.
- Footnotes on listing components are a single small line. Where a secondary label says "all-in" only for decoration,
  remove the word instead of adding another disclosure. Never remove the price.

---

## 7. What this plan deliberately does not do

- It does not touch reviews, UEN, guarantees or founder biography. K-117 (praise themes) is separate.
- It is not a redesign. Only two new components are added (VaccinationTimeline and ReserveSteps), and both extract
  markup the site already ships (the cavapoo table and the home step strip).
- It does not change `starter-kit.astro`, `pricing.astro` or `/delivery/`. They also say "$500+" and "all-in", so a
  follow-up card should apply the same T02 gate site-wide.
- The puppy page's reverse gaps from K-080 (JSON-LD, origin, footer) belong to the puppy template, not to this card.

## Sources

- Owner addendum: `reports/puppy-page-owner-feedback-addendum-2026-11-08.md` (payment §3, vaccines §4, reserving §5,
  open items 1 to 3)
- Puppy page rendered text, 13 Nov 2026: `Curious Tails Review/k080-content-gap/vis-puppy.txt`
- Clinic number check (web search, 14 Nov 2026; to be confirmed by the owner, Q2). Listings returned:
  https://www.scam.sg/companies/53421628E/vets-for-pets-lengkok-bahru and the AVS list of licensed vet centres,
  https://nparks.gov.sg/-/media/vet/list-of-licensed-vet-centres_avs_31-may-2024.pdf
- AVS Pet Ownership Course: https://avs.nparks.gov.sg/pets/licensing-a-pet/applying-for-dog-and-cat-licences/pet-ownership-course/
