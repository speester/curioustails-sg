# K-119: the 28-point content plan, applied to home and the 48 breed pages

**Date:** 14 November 2026 · **Card:** K-119 · **Branch:** `k119-content-gap` (working tree)
**Plan:** `reports/content-gap-plan-2026-11-14.md` + `reports/content-gap-plan-tasks.json`
**Preview:** https://preview.curioustails-staging.pages.dev (deployment https://b034e7f6.curioustails-staging.pages.dev,
project `curioustails-staging`, branch `preview`, build `9bb2d604929f`, `x-robots-tag: noindex, nofollow`)

> This report is the K-119 close-out. A resumed session (`reports/k129-content-gap-resume-report-2026-11-14.md`)
> finished the same plan after a worker restart; its corrections are part of the tree described here.

---

## 1. The owner's answers

| Question | Answer used | Effect |
|---|---|---|
| Q1 PayNow fee | **No fee** | The copy says "The only extra is the 3% bank surcharge if you pay by credit card." PayNow, bank transfer and cash carry no fee. |
| Q2 Lengkok Bahru | **8268 4039 is the mobile (WhatsApp or calls); 6255 6064 is the landline (calls only)** | Both numbers print, labelled, with `wa.me` + `tel:` on the mobile and `tel:` on the landline. The earlier K-118 note that the two numbers disagreed was **wrong**; they are two lines of the same clinic. The fix is to label them, not pick one. |
| Q3 Week 16 | **Core fourth vaccine** | Week 16 reads "Fourth core vaccination, completing the core puppy course"; the home sentence names weeks 6, 8, 12 and 16. |
| D1 payment methods | Four (later owner answer, K-130) | `PAYMENT_METHODS` in `buying-terms.ts` is the one source: PayNow, bank transfer, cash, credit card; surcharge attached to the card only. |

The puppy page (`outputs/puppy-page-redesign-biscuit.html:1274`) and its staging mirror (`_k002_stage/outputs/index.html`)
carry the same labelled pair. The five per-animal records (date of birth, ready date, passport dossier, named intro,
named FAQ) were not touched.

---

## 2. Per task: what changed and where

| Task | Changed | Where |
|---|---|---|
| **T01** | One source for every shop-wide term: surcharge, payment methods and payment line, inclusions, boarding cap, availability rule, no-pressure and help-find lines, next-litter and similar-puppy lines, records, Vets For Pets sentence + HTML variant with `tel:`/`wa.me`, POC line/URL, five reserve steps, vaccination rows, shared "How do I pay?" FAQ. `KIT_TOTAL`/`KIT_COUNT` are computed from the kit JSON (533 / 30), never typed. Added `site.directions` and `site.ownersLine` (with the check date in a comment). | `src/data/buying-terms.ts` (new), `src/data/site.ts` |
| **T02** | New gate: strips head/script/style/svg, ignores attributes, splits each page into disclosure blocks (nearest ancestor with an `id`, else the nearest `<section>`), and fails if a block with visible "all-in" has no "3% bank surcharge". Also fails on "No add-ons quietly billed later" and "Nothing is added later". | `scripts/check-all-in-surcharge.mjs` (new), `package.json` (`check:surcharge`, `check:all-in`) |
| **T03** | Hero renders the surcharge line under any `priceAnchor` containing "all-in". The retired promise was deleted from 44 price anchors (the phrase count was 44; all 48 anchors carry "all-in"). | `src/components/Hero.astro`, 44 × `src/pages/puppies/*.astro` |
| **T04** | Home price copy: ValueBundle subhead is the six-inclusion sentence + surcharge; the "How much does a puppy typically cost" answer carries the surcharge; the shared "How do I pay?" FAQ is appended to `faqItems` so it lands in both the visible FAQ and the FAQPage JSON-LD; the "Breeds We Carry" and pricing subheads carry the surcharge. The "Puppies for Sale" block is covered by the grid footnote (one disclosure per block, not two). | `src/pages/index.astro` |
| **T05** | One footnote per grid: "All-in prices. …". The decorative "all-in" was removed from the pup card and the loving-homes subhead. | `ListingGrid.astro`, `ImportedPuppies.astro`, `OverseasPuppies.astro`, `PupCard.astro`, `LovingHomesSection.astro` |
| **T06** | All 48 breed files: imports; the `#price` footnote is prepended with inclusions + payment + surcharge; `allFaqItems = [...faqItems, ...SHARED_BUY_FAQ]` feeds both `faqPageSchema()` and `<FAQ>`; StatStrip labels lose ", all-in". An AnswerCapsule whose slot says "all-in" now renders the surcharge inside the capsule. | 48 × `src/pages/puppies/*.astro`, `AnswerCapsule.astro` |
| **T07** | `npm run build` now runs `astro build && node scripts/check-all-in-surcharge.mjs`. The gate went from 522 failures before T03–T06 to 0. | `package.json` |
| **T08** | New `VaccinationTimeline`: the eight rows, then "For puppies at our shop: …" with the Vets For Pets sentence and the records line, then the AVS licensing + POC links. It replaced the six hand-typed tables (cavapoo, bichonpoo, cockapoo, corgi, mini-dachshund, shiba-inu) and was inserted after `#health` on the other 42. It is never rendered inside Imported/Overseas blocks. | `src/components/VaccinationTimeline.astro` (new), 48 × breed files |
| **T09** | Home health paragraph now gives the weeks 6/8/12/16 schedule, deworming at every visit, going home about a week after the second vaccination, the Vets For Pets payment and the records, with a "the full schedule" link. The HDB paragraph gets the Pet Ownership Course sentence and link. | `src/pages/index.astro` |
| **T10** | Boarding capped at a month: home paragraph; on breed pages the side-list item, the aftercare paragraph, the reserve FAQ answer and the comparison items on the 4 pages without an aftercare block. | `index.astro`, 48 × breed files |
| **T11** | `ReserveSteps` extracted from the home `<ol>` and reading `RESERVE_STEPS`. Home renders the component unchanged in layout; all 48 breed pages render `<ReserveSteps heading="What Happens After You Reserve a {Breed}" />` before `#trust`, and the aftercare block's first paragraph was removed on the 44 pages that have it (the steps now say it). | `src/components/ReserveSteps.astro` (new), `index.astro`, 48 × breed files |
| **T12** | `FinalCta` adds directions, the owners line + "No pressure to buy.", the help-find sentence in the default body, and the availability rule under the buttons. Custom `body` props still get the directions and owners lines. | `src/components/FinalCta.astro` |
| **T13** | Home visit block gets directions, owners + no pressure, and a "Book a viewing" WhatsApp button; the reserve ribbon uses the availability rule; the duplicate "Not Ready to Reserve Yet?" ribbon was removed. | `src/pages/index.astro` |
| **T14** | Home gets the sold-puppy route with a WhatsApp link under the live grid; the matching sentence was removed from FAQ 13. `AvailablePuppies` prints the next-litter line after the grid and in the empty state. | `index.astro`, `AvailablePuppies.astro` |
| **T15** | `StarterKitMarquee` prints the computed `$533` / 30 items. The home kit table was rebuilt from the six categories in `starter-kit-items.json` (sum asserted at build time, 6 rows + total). Visible `$500+`/`30+` prose on home and the 48 breed pages now reads `$533` / 30 items from data; titles and meta descriptions are unchanged. | `StarterKitMarquee.astro`, `index.astro`, 48 × breed files |
| **T16** | Owner answers applied in the data file only (surcharge wording, four rails, both labelled clinic numbers with links, core week 16). The puppy page and its mirror got the labelled number pair. | `src/data/buying-terms.ts`, `outputs/puppy-page-redesign-biscuit.html`, `_k002_stage/outputs/index.html` |

Two small fixes outside the plan, both to remove pre-existing defects met on the way: the breed price footnote now
carries a trailing space (Astro's HTML compression was joining it to the next sentence on all 48 pages), and the
CSP-blocked Google Fonts `<link>` was removed from `PuppyMatchSwiper.astro` (the site self-hosts Fredoka; the link was
the only console error on the home preview and the pre-existing `font-cdn` failure in `check-content`).

### Plan rows that did not match the tree (reported, not improvised)

- **§1 "44 of the 48 breed pages say all-in"**: all **48** hero anchors say all-in; 44 also carried "No add-ons quietly
  billed later". The action (delete the phrase wherever it appears) was unchanged.
- **T04 "append the surcharge to the 'Puppies for Sale' subhead"**: not done, because T05 puts one footnote directly under
  that same grid, in the same disclosure block. Two copies in one block would be noise; the gate passes on the footnote.
- **T11 "insert after the aftercare block"**: 4 pages (bichonpoo, cockapoo, corgi, shiba-inu) have no aftercare block.
  The steps are inserted before `#trust`, which is the same position on the other 44.
- **T15 "no visible $500+ outside title/meta"**: six breed pages still show `$500+` **inside customer review quotes**
  ("The $500+ starter pack was such a generous surprise"). Reviews are not ours to rewrite; all shop-authored visible
  copy is clean. See §5.

---

## 3. Growth against the plan

Visible words, chrome-stripped, measured against the 13 Nov captures (`reports/k119-tools/count-words.mjs`,
`words-before.json` → `words-now.json`):

| Page set | Before | After | Change | Plan |
|---|---|---|---|---|
| Home | 4,895 | 5,168 | **+5.6%** | ≈ +5% |
| All 48 breed pages (mean) | 4,361 | 4,838 | **+10.9%** | ≈ +9% |
| The six that already had the table | 4,094 | 4,488 | +9.6% | ≈ +6% |
| The other 42 | 4,400 | 4,889 | +11.1% | — |
| maltipoo / cavapoo / corgi | 4,204 / 4,717 / 3,941 | 4,700 / 5,212 / 4,325 | +11.8% / +10.5% / +9.7% | — |

Breed pages came in about 1.9 points above the plan. The extra is the listing footnotes: the plan counted `+12` words
once per page, but the disclosure lands once on each grid that prints a price (available, imported, overseas, placed),
and the owner's four-rail payment line is longer than the two-rail wording the plan estimated. Home is on target.
Nothing is doubled.

---

## 4. Verification

| Check | Result |
|---|---|
| `npm run build` (includes `check:surcharge`) | **PASS** — 127 pages, `check-all-in-surcharge: pages=49 all-in-blocks=286 checked=286 failed=0` (`reports/k119-build.log`) |
| `reports/k119-tools/verify-dist.mjs` — every T01–T16 acceptance string on home + 48 | **0 failed checks** |
| `node scripts/check-links.mjs` | **PASS** — `pages=127 routes=127 failed=0` |
| `node scripts/check-content.mjs` | **3 failed** vs 4 at baseline: `price-literals` (679), `duplicate-blocks` (72), `dead-layout-props` (3); `font-cdn` now **PASS**. The third dead prop (`hideWhatsAppFloat`) was added in the same tree after the K-119 baseline; this plan did not add it. |
| `node scripts/check-kit.mjs` | 5 unresolved classes, all pre-existing (`js-video-close/frame/open/wrap`, `title`). None introduced here. |
| `design-audit.mjs --rhythm` delta | `/` 4→4, `/puppies/maltipoo/` 4→4, `/puppies/cavapoo/` 4→4: **delta 0**. The site-wide audit still reports its pre-existing 1,345 failures (no `data-tone` rhythm, sticky header), which this card did not create. |
| copy_lint (`rtp-v3/scripts/copy_lint.py`) | **Not clean before and not clean after**: 59,068 fails over 124 pages → 61,312 over 126. C1 428→428, C2 66→32, C3 496→676, C4 62→80, C6 285→338, C6b 47,244→49,377, C10 941→695, C11 9,540→9,680, C15 2→3. C6/C6b grow because the plan deliberately renders the same terms on 49 pages; the shared-copy rule and this plan pull in opposite directions. |
| 1440 / 390, Playwright (local `astro preview` and the deployed preview) | **0 console errors, 0 horizontal overflow on all 12 page × width pairs**; `scrollWidth == viewport` everywhere (`viewport-check.mjs`, `preview-smoke.mjs`) |
| Preview smoke (12/12) | status 200, `x-robots-tag: noindex`, surcharge + payment + both phone numbers on every gated page |
| T07 negative proof | Deleting the surcharge sentence from one block of `dist/puppies/maltipoo/index.html` makes `check:surcharge` fail **4 blocks**; restoring it returns 0. The gate is wired, not decorative. |

### The surcharge grep

`reports/k119-tools/allin-sitewide.mjs` reads the **visible text** of every built page (head/script/style/svg stripped):

```
IN GATE (home + 48 breed): pages=49 all-in=286 pages-without-surcharge=0
  /                     all-in=10  surcharge=7
  /puppies/maltipoo/    all-in=4   surcharge=5
  /puppies/cavapoo/     all-in=8   surcharge=5
  /puppies/corgi/       all-in=6   surcharge=5
```

`node scripts/check-all-in-surcharge.mjs` is the per-block version (a page-level count can hide a block that lacks the
line): **286 blocks checked, 0 failed**. Example matches on maltipoo: the hero anchor "From $3,288 all-in." sits above
"The only extra is the 3% bank surcharge if you pay by credit card."; the `#price` block's "all-in - starter kit,
delivery and first training lesson included" sits above the price footnote's inclusions + "Pay by PayNow, bank
transfer, cash or credit card. The only extra is the 3% bank surcharge if you pay by credit card."

### Three breed samples

maltipoo (HDB-approved), cavapoo (most prose changed), corgi (non-HDB, different price): the shared additions are
**byte-identical** after normalising `data-astro-cid` hashes —

| Shared block | Identical across the three? |
|---|---|
| Vaccination table | yes |
| Timeline note ("For puppies at our shop…") | yes |
| Five reserve steps | yes |
| Price disclosure sentence | yes |
| FinalCta directions / owners / availability | yes |
| Hero surcharge line | yes |

They differ only where their data differs: H1, breed prose, price ($3,288 / $3,288 / $3,688), HDB status, listings.
Screenshots: `reports/k119-shots/` (`maltipoo-price-1440.png`, `maltipoo-price-390.png`, `home-price-1440.png`,
`home-hero-390.png`, `corgi-price-1440.png`). At 1440 the price block is a two-column split with the footnote below; at
390 the columns stack and the footnote reads in full. No overflow at either width.

---

## 5. Preview and what is in it

- **Branch URL:** https://preview.curioustails-staging.pages.dev
- **Deployment URL:** https://b034e7f6.curioustails-staging.pages.dev
- Project `curioustails-staging`, branch `preview`, build `9bb2d604929f`, `noindex, nofollow`.
- `check:import-leaks`: **OK** before upload (`feed=1 assets=0 dist=143 denylist values=1084 shingles=5076`).
- Production (`curioustails-sg` `main`, curioustails.sg) was **not** deployed. The staging project's `main` branch
  (the Biscuit prototype) was **not** deployed either.

The preview is built from the current working tree, so in addition to K-119 it shows two things that are not this card:
the in-progress die-cut styling (`dc-*`, `diecut.css`) and K-130's puppy-page template. They were left untouched and are
flagged here so the preview is not mistaken for a K-119-only build.

### Still outside the gate (plan §7 follow-up)

`/pricing/` (70 all-in), `/delivery/`, `/starter-kit/`, `/first-time-owners/budget-guide/`, `/about-us/`,
`/free-training/`, `/found-loving-homes/` and several blog posts still call prices all-in without the surcharge line, and
the retired "nothing added later" wording still appears on `/pricing/`, `/learn/cheap-puppies-singapore/` and the
individual puppy pages. That is the plan's stated follow-up card, not this one.

---

## 6. The phone-number caveat (resolved)

The K-118 plan printed a caution that the owner's Lengkok Bahru number (8268 4039) disagreed with the public listing
(6255 6064) and recommended a 30-second call to the clinic. **That caution is withdrawn.** The owner confirmed both are
correct: 8268 4039 is the clinic's mobile (WhatsApp and calls) and 6255 6064 is its landline (calls only). They are two
lines of the same clinic. The fix is to label them, not to choose. Both print on home and all 48 breed pages as
"Lengkok Bahru - WhatsApp or call 8268 4039, landline 6255 6064", with `wa.me` and `tel:` links on the mobile and `tel:`
on the landline; the puppy page and its staging mirror carry the same pair. No call to the clinic is required for this
to go to production, though the owner is always free to confirm the pair is still current.

---

## 7. Files

New: `src/data/buying-terms.ts`, `src/components/VaccinationTimeline.astro`, `src/components/ReserveSteps.astro`,
`scripts/check-all-in-surcharge.mjs`.
Edited: `src/pages/index.astro`, `src/data/site.ts`, `package.json`, 48 × `src/pages/puppies/*.astro`,
`Hero.astro`, `AnswerCapsule.astro`, `ListingGrid.astro`, `ImportedPuppies.astro`, `OverseasPuppies.astro`,
`PupCard.astro`, `LovingHomesSection.astro`, `FinalCta.astro`, `StarterKitMarquee.astro`, `PuppyMatchSwiper.astro`,
`outputs/puppy-page-redesign-biscuit.html` (+ regenerated `_k002_stage/outputs/index.html`).
Evidence: `reports/k119-tools/` (scripts, before/after captures, word counts) and `reports/k119-shots/`.
