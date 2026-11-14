# K-130: the puppy page template (Biscuit's structure for every puppy)

**Date:** 2026-11-14 · **Preview only. Production untouched** (`curioustails.sg` still serves the old page; nothing was deployed to `main`).
**Preview:** https://k130-puppy-template.curioustails-sg.pages.dev (deployment https://78b7bb38.curioustails-sg.pages.dev, branch `k130-puppy-template`, preview hosts are `noindex` via `_headers`).
**Plan:** `reports/puppy-page-template-plan-2026-11-14.md` + `reports/puppy-page-template-tasks.json`. Owner decisions D1–D4 and the Balestier-only ruling were applied, and they override the plan where the two differ.

## 1. Side by side

| | URL | State |
|---|---|---|
| Complete page (av) | https://k130-puppy-template.curioustails-sg.pages.dev/puppies/maltipoo/2950-red-boy/ | Smokey. All 15 sections, indexable, in the sitemap, `Product`/`Offer` $3,888 |
| Thin page (live data) | https://k130-puppy-template.curioustails-sg.pages.dev/puppies/other/2937-tri-color-girl/ | Daisy, a Corgipoo whose sheet breed has no breed page. `noindex, follow`, not in the sitemap, no `Product`/`Offer`, no Breed fit section |
| Placed (pl) | https://k130-puppy-template.curioustails-sg.pages.dev/puppies/maltipoo/2938-apricot-girl/ | **Biscuit.** Today's sync found the sold overlay, so the reference puppy now renders the placed variant, with Others in slot 2 |
| Thin page, no photo and no price | fixture only (no live row is missing both today). Screenshot: `reports/k130-shots/vp-99004-cream-boy-1440-top.png` and `-390-top.png` | "Photos coming" and "Ask for price" placeholders. No invented photo or figure |

Other screenshots are in `reports/k130-shots/`; the tools that made them are in `reports/k130-tools/`.

## 2. What was built (the 16 plan tasks)

| Task | Status |
|---|---|
| T01 sync writes `dob`, `images[]` | **Built.** Both fields are additive. Every extra photo goes through the sold-overlay check, and the prune step keeps `images[]`. I ran `sync:puppies`: 10 Balestier puppies are live (Biscuit is now sold) |
| T02 scaffold, token map | **Built.** The CSS is scoped under `.pp`; the token map is in `reports/k130-token-map.md`. **One token needs your approval:** `--mint-700` has no `global.css` token, so it is kept at the prototype value. The `<Only>` wrapper was dropped because Astro evaluates the expressions inside a slot even when it does not render it. Variants are resolved with inline conditions instead, and a hidden branch still never reaches `dist/` |
| T03 terms + copy deck | **Built.** `FIVE_DAY_LINE` and `PAYMENT_METHODS` are in `buying-terms.ts`. `src/data/puppy-page-copy.ts` contains no Biscuit, 2938 or $3,888 string |
| T04 breed facts | **Built** (D4, §4 below) |
| T05 adapter + gate | **Built.** `src/lib/puppy-page.ts` holds `fromLocal`, `fromPlaced`, `fromImported` and `SECTION_ORDER`. The publish rule is `src/lib/puppy-publish.mjs`, shared by the route, the sitemap filter and the gate |
| T06–T10 sections | **Built.** 15 sections plus the sticky bar in `src/components/puppy-page/`. 4 are always on (Hero, About, Final CTA, Visit) and 11 depend on the variant or the data. Band tones follow the sections that actually render (C5) |
| T11 imported variant | **Built.** `noindex,follow`, no business schema, copy-deck content, no local terms. 0 imported puppies exist today, so it is proved by a fixture |
| T12 SEO block | **Built.** Title ≤ 60 and meta 140–158 on all 44 live pages. One H1. `Product` only when the price is visible. `FAQPage` comes from the same array as the visible FAQ. `BreadcrumbList` is included |
| T13 `check:puppy-pages` | **Built** (§5 below). It runs inside `npm run build` |
| T14 proof test | **Built.** `npm run test:puppy-page`: 51/51 assertions pass |
| T15 preview parity | **Partial.** The preview is deployed and I took screenshots at 1440/390 of Smokey, Biscuit (pl), Daisy (thin) and the fixture thin page. Map bottom equals licence bottom (Δ 0) at 1440. No overflow at 390. **Not done:** the 5-width prototype comparison and Lighthouse. Owner sign-off is still open |
| T16 switch-over | **Built, except deleting the old components.** The route renders the template for all three variants. `PuppyDetail.astro` and `ImportedPuppyDetail.astro` have no importers left, but they are **untracked** files from earlier cards, so I did not delete them (that cannot be undone). The prototype is frozen with the "Superseded…" line. The gates are in `npm run verify` |

Named visual compromises: C1 (site chrome; `--mint-700`), C3 (four payment cards), C4 (two-card dossier when a breed has no facts, e.g. Daisy and the Rowan/Ellis/Marley Maltese crosses), C5 (band tones re-assigned when a section drops). The prototype's paraphrased Maltipoo fit lines are replaced by the breed page's own wording (D4).

## 3. Payment-method correction (D1)

`buying-terms.ts` is the single source. It now holds `PAYMENT_METHODS` (PayNow, bank transfer, cash, credit card) and `PAYMENT_LINE` = "Pay by PayNow, bank transfer, cash or credit card." Before this card it said "Pay by PayNow or credit card." The 3% surcharge applies to cards only.

The puppy page's §9 shows 4 cards in a 2×2 grid, or 4 across at ≥ 1100px. The FAQ answer and every breed page that prints `PAYMENT_LINE` (48 of them) follow automatically.

No other file in `src/` contained a payment-method string.

## 4. Breed facts extraction (D4)

`src/data/breed-facts.ts` covers the 7 stocked breeds. Every string in it is **verbatim** from that breed's published page:
- parentage, temperament and grown size come from the at-a-glance list and the temperament block;
- coat, exercise and lifespan come from the size table;
- the fit and think-twice rows come from the "Your situation / Our honest take" table.

It is one shared source. The 7 breed pages now **read** their coat, lifespan and exercise rows and their lifestyle table from this file (`BF.coat`, `matchRows('<slug>')`), and they render the same text as before. A cross shown under a base breed (for example "Maltese x Shih Tzu") gets no facts. `npm run check:breed-facts` checks 131 facts and anchors: each one must be on the built breed page and in the page source, and every anchor must exist. **It passes.**

## 5. Thin-page rule, the Balestier-only rule, and how the index flip is tested

**Rule** (`src/lib/puppy-publish.mjs`):
- `id` and `location` decide whether a row is in scope at all. A row outside Balestier, or with no location, gets no page and no card, and is logged.
- If an in-scope puppy is missing its breed page, photo or price, it gets a **thin** page: built and reachable, with honest placeholders, `noindex, follow`, out of the sitemap (`sitemap-exclusions.mjs` uses the same function), and no `Product`/`Offer`.
- Noindex pages also carry no business schema.

**Rows excluded by location today:** 21 rows on page 1 of the sheet:

| Location | Rows |
|---|---|
| Choa Chu Kang | 8 |
| MacPherson | 6 |
| Joo Chiat | 5 |
| Eng Kong | 1 |
| blank (the "Import Services" row) | 1 |

Across the whole sheet, including sold history, 1,057 of 1,211 rows are outside Balestier. The `excludedByLocation` field in `available-puppies.json` breaks this down by location.

The gate found a real breach on its first run. **2700 Comet** is owner-marked sold, but the sheet now places it in Choa Chu Kang, and it still had a placed page plus cards on `/found-loving-homes/` and `/puppies/cockapoo/`. I fixed `scripts/lib/placed-archive.mjs` so that location now beats a sold override, and added a test for it. After a re-sync, 2700 and 2694 are withdrawn and their pages 301.

**How the flip is tested** (`npm run test:puppy-page`):
1. **Build 1:** fixture 99004 "Bean" has no photo and no price. The test asserts the page exists, `data-thin="true"`, `noindex, follow`, the page is absent from the sitemap, there is no `Product`/`Offer`, and "Photos coming" / "Ask for price" are shown.
2. **Build 2:** the same row with a photo and price filled in, and no code change. The test asserts the same URL is now `data-thin="false"`, has no robots noindex, is in the sitemap, and its `Offer` price is 3488.
3. **CCK fixture 99005:** no page is built.
4. **The gate is tampered twice:** once with an injected "pedigree", once with a page whose `data-location` is outside Balestier. It **fails** both times (exit 1).

All builds go to `node_modules/.cache/`; `dist/` and the real feeds are never touched.

**The proof that matters most:** fixture **av-min** has only `id`, breed, one photo, price and Balestier, with every other field null. It renders at `/puppies/maltipoo/99001-puppy/` with 15 sections in K-124 order, one H1, no null/undefined, an indexable `Product` at $3,888, title 46 characters, meta 140–155, and no hand editing. **av-min-nofacts** (Pomeranian) renders 14 sections with a two-card dossier.

## 6. Gate output (`npm run build` → `check:puppy-pages`, real data)

```
built puppy pages: 44 (in sitemap: 43)
thin (built, noindex, out of the sitemap): 1
  2937 Daisy /puppies/other/2937-tri-color-girl/: no breed page for this breed label
excluded, not in Balestier (no page, no card): 21 {"(blank)":1,"Choa Chu Kang":8,"MacPherson":6,"Joo Chiat":5,"Eng Kong":1}
warnings: 6  (no DOB or age: 2980 Waffles, 2979 Aspen, 3010 Rowan, 3011 Ellis, 3012 Marley, 2977 Cocoa)
wrote NEEDS-ATTENTION.md (1 thin, 21 excluded)
PASS: puppy pages
```

## 7. Build and lint results (after the final build)

**Pass:** `build` (including `check:all-in` and `check:puppy-pages`), `check:schema` (126/126), `check:schema:req`, `check:links`, `check:contrast`, `check:redirects`, `check:tokens`, `check:breed-facts`, `test:imports`, `test:archive` (8/8), `test:puppy-page` (51/51), `check:import-leaks --dist`.

**Fail, but none of the failures are on a puppy page I changed:**
- `check:health`: 10 failures, all on home, `/found-loving-homes/`, bernedoodle, labrador, mini-dachshund and miniature-pinscher. Puppy pages are clean; they started at 262 failures and I fixed reveal, hero archetype, iframe focus, meta length, scroll-margin, and thin-page schema.
- `check:content`: price-literals, duplicate-blocks, dead-layout-props, font-cdn. These are site-wide.
- `check:kit`: 5 failures.

**Fail, partly on puppy pages:** `check:design` fails site-wide (1,131 failures on 126 pages). On puppy pages the remaining items are the prototype's own small chip/label type and text measure, the site header not being sticky, and the hidden-until-scroll sticky bar. I did not restyle the owner-approved design to satisfy them.

## 8. Open items

1. Approve `--mint-700`: add it to `global.css`, or map it to `--color-lilac-700`.
2. Owner sign-off on the preview, then a separate card for the production deploy.
3. Imported pages are tagged `data-location="Balestier"` (they are delivered through the Balestier shop). Please confirm that the Balestier-only rule allows them.
4. Not done: the 5-width prototype comparison and Lighthouse (T15).
5. Delete `src/components/PuppyDetail.astro` and `ImportedPuppyDetail.astro` once whoever owns them agrees (they are untracked and nothing imports them).
6. **Pre-existing bug I did not touch:** in `scripts/sync-puppies.mjs`, the HDB regex `/✔|✓|\byes\b/` contains literal backspace characters in HEAD. Only the ✔/✓ ticks count, and a typed "yes" is ignored.
7. Nothing is committed. The working tree is shared with other cards and has their uncommitted work in it.

**Files:**
- New: `src/components/puppy-page/*` (17 files), `src/lib/puppy-page.ts`, `src/lib/puppy-publish.mjs`, `src/data/puppy-page-copy.ts`, `src/data/breed-facts.ts`, `scripts/check-puppy-pages.mjs`, `scripts/check-breed-facts.mjs`, `scripts/test-puppy-page.mjs`, `scripts/fixtures/puppy-page/fixtures.json`, `reports/k130-*`.
- Edited: `src/pages/puppies/[breed]/[id].astro`, `src/data/buying-terms.ts`, 7 breed pages, `src/lib/sitemap-exclusions.mjs`, `src/layouts/BaseLayout.astro` (`hideWhatsAppFloat`), `scripts/sync-puppies.mjs`, `scripts/lib/placed-archive.mjs`, `scripts/test-placed-archive.mjs`, `astro.config.mjs` (`PUPPY_OUTDIR`), `package.json`, `outputs/puppy-page-redesign-biscuit.html` (header line), `BUILD-STATE.md`.
- Regenerated by the sync: `src/data/available-puppies.json`, `src/data/placed-archive.json`, `src/assets/live/`. `NEEDS-ATTENTION.md` is rewritten by the gate.
