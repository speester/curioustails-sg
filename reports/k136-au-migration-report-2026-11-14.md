# K-136 — Australian reservations onto the imports instrument, and imported pages exempt from the Balestier rule

**Date:** 2026-11-14 · **Preview only. Production untouched** (curioustails.sg still serves the 27 legacy AU cards; `/reservation-terms/` and every `imp-` URL return 404 there). I committed nothing. However, another session's commit `04436bc` ("checkpoint working tree before triage", 16:21, local branch `k119-content-gap`, not pushed) swept the shared tree, including the K-136 files as they stood at that time. Only this report and `src/data/au-reservations.json` (timestamp) changed after it.

**One line:** In the preview, every AU listing that would go live links to the written reservation terms, labelled **"Reservation terms (under legal review)"**. On production, none of the 27 live AU cards is covered yet. **Still not covered:** the terms are a draft with counsel. Nothing records which AU listings already have a paying buyer, so no existing buyer has received or accepted terms. And only 8 of the 40 listings can pass the gates as the data stands.

## 1. Inventory (written before any code change)

`reports/k136-au-inventory-2026-11-14.md` and `.csv` hold all 40 rows (generator: `reports/k136-tools/au-inventory.mjs`, read-only). In summary:

- 40 listings across 14 breed pages. 27 have a price and 13 have none. 27 have a photo and render on the live site today; I checked that all 27 cards are on curioustails.sg. The other 13 are hidden by the 2026-09-30 photo rule.
- **Deposit taken, date and buyer status are `—` on all 40 rows.** The data file and its sync have no such fields: `deposit` is the 50% that is *asked*, not money received. The only date is the sync stamp, 2026-10-02, which is 43 days old. If any deposits were taken, the record of them is outside this repo.
- Listed prices total S$157,150. The 50% deposits asked total S$78,575, and every priced row's deposit is exactly 50%.
- Two listings (98417 and 25655) share one record id, `os-8f1f496d`, because they share one photo.

## 2. Part 1 — the publish rule

`src/lib/puppy-publish.mjs`:
- **Local puppies:** `localGate()` is unchanged. A row outside Balestier, or with no location, is excluded and logged.
- **Imported puppies:** the new `importedGate()` takes a valid `imp-` id, a breed segment and a published or reserved status. It never reads a location. The owner ruling is in the file header.
- **The imported page claims no shop location:**
  - `location` is `null`, so there is no `data-location`. A `data-origin` of IE or AU is added.
  - The **Visit** section (shop address and map) and the **Families** section (handovers at the Balestier shop) are dropped from the imported variant.
  - The FAQ line "…as the puppies in our Balestier shop" now reads "…delivered to your door with the same starter kit… as every Curious Tails puppy".
  - Reviews on an imported page skip any review that names Balestier.
- **Gate:** `check:puppy-pages` now fails the build if an imported page has a `data-location`, or has "Balestier" in its `<main>` or JSON-LD. On its first stage build it caught 5 real leaks, all a customer review quoting "Curious Tails in Balestier"; I fixed those as described above. Local and placed pages must still be Balestier.
- **Tests:** `npm run test:puppy-page` is **PASS**, 65 assertions (51 before). The new assertions:
  - a local Choa Chu Kang row is excluded;
  - an imported fixture with **no location field** publishes;
  - imported pages have no "Balestier" in content or schema, and no Visit or Families section;
  - an AU fixture keeps the exact price, deposit and ref and has the terms link;
  - the gate **fails** on an imported page with "Balestier" injected, and on one tagged `data-location="Balestier"`.

**Effect on counts (stage build, real data):**

| | Before | After |
|---|---|---|
| Local pages | 44 built (43 in the sitemap, 1 thin) | Same |
| Local rows excluded by location | 21 | Same 21 (CCK 8, MacPherson 6, Joo Chiat 5, Eng Kong 1, blank 1) |
| Imported pages | 0 (the Irish feed is empty) | 8 AU pages, all noindex and out of the sitemap. The location rule excluded none: it no longer applies to imported rows |

## 3. Part 2 — the AU listings on the imports instrument

| Requirement | How |
|---|---|
| Same record shape | Each row becomes the same public `ImportedPup` record (`public-schema.json`), with origin widened to `IE`/`AU` and ref to `CT-(IE\|AU)-XXXXXX`. The id is `imp-<10 hex>` from the same HMAC secret as Ireland. Price and deposit are the sheet's values exactly. DOB and age are **not** published: the age is 43 days stale, and a DOB worked back from it would be an estimate shown as a fact. |
| Same gates | `scripts/imports/lib/au.mjs` runs G1–G15 in the same order, with the same severities and the same owner-waivable set. Three adaptations: **G10** fails as owner-waivable (origin AU, no microchip recorded), **G12/G13** do not apply to the owner's own sheet, and **G14** flags data older than 14 days (owner-waivable). |
| Same review queue (owner approval first) | `npm run au:reservations -- migrate` puts all 40 rows in the private `review-queue.json` with `origin: "AU"`, alongside the Irish items, one `au-migrated` audit line each. It changes nothing on the site. The owner approves with the same UI (`npm run review:imports`) or `npm run approve:import -- approve <imp-id>`, and blocked items are refused. Only `npm run au:reservations -- sync` writes `src/data/au-reservations.json`, and only for items the owner approved or marked reserved. The daily Irish pipeline now carries AU queue items over instead of dropping them. |
| Same takedown with an audit line | `npm run unpublish:import -- <imp-id> --reason takedown` works on AU ids. It removes the feed entry and the photo, adds the `imported-retired.json` redirect record, suppresses any relist, and writes a `takedown` audit line with the actor and time. `lib/owner.mjs` now finds an id in either feed. |
| Written terms linked from every AU listing | Every imported card and detail page links to **`/reservation-terms/`**, labelled **"Reservation terms (under legal review)"**. The page reproduces the redline's clean text, Parts A and B only, **word for word** (`reports/k136-tools/extract-terms.mjs` → `src/data/reservation-terms.json`). It opens with a "Draft, under legal review" banner, marks each [bracketed] open point, and is noindex and out of the sitemap. Part C, the takedown SOP, is not published. **I chose to label rather than omit:** a labelled draft is better than no written terms, and it is never presented as final. When counsel signs, change one label in `buying-terms.ts`, drop the banner and drop the noindex. |
| Fail-safe until approval | The AU feed has a `cutover` flag, and in the repo it is `false`. Until `sync --cutover` runs, the legacy `OverseasPuppies` cards keep rendering and the AU feed is not shown. A production build from this tree therefore shows the same AU cards as today. |

Tests: `test:imports` passes **196/196**. That includes 7 new AU tests in `scripts/imports/tests/au-reservations.test.mjs`: migrate writes nothing public, prices and deposits are exact, nothing publishes without approval, a blocked item cannot be approved, the reserve path works, takedown writes its audit line and the listing is never relisted, the daily pipeline keeps AU items, and G14 flags stale data.

### Gate verdicts on the 40 rows

Run in a **stage store**, not the owner's real queue. Result: **8 approvable**, **28 need an edit**, **4 hard-rejected**. The 4 rejects are about 19 weeks old today by the sheet's own age (over the 16-week import limit).

Every row also has two owner-waivable flags: G10 (no microchip recorded) and G14 (data 43 days old). The German Shepherds also carry G9 (specified breed, waivable).

| # | Legacy id | Listing | New ref | Breed page | Breed (as listed) | Price | Deposit | Live now | Live after approval | Blocked by |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | os-59701d7d | 76641 | CT-AU-69E38F | beagle | Beagle | — | — | yes | no | missing price |
| 2 | os-8b777ae0 | 74317 | CT-AU-DE51C7 | border-collie | Border Collie x Sausage Dog | S$4,500 | S$2,250 | yes | no | missing dob-or-age |
| 3 | os-6c152beb | 44008 | CT-AU-184937 | border-collie | Border Collie x Kelpie | S$4,300 | S$2,150 | yes | yes (if approved) | — |
| 4 | os-a9451884 | 43524 | CT-AU-C2CF5F | border-collie | Border Collie | — | — | yes | no | missing price,dob-or-age |
| 5 | os-ceb9e485 | 57083 | CT-AU-61298D | cavapoo | Cavoodle x Pomeranian | S$6,300 | S$3,150 | yes | yes (if approved) | — |
| 6 | os-cdfb767b | 12205 | CT-AU-E0DDC4 | cavapoo | Cavoodle | S$5,300 | S$2,650 | yes | no | REJECT: ~19 weeks old today; arrival 2026-10 passed |
| 7 | os-22bf52ad | 63956 | CT-AU-26784E | cavapoo | Cavoodle | S$7,300 | S$3,650 | no | no | missing sex,dob-or-age,photo |
| 8 | os-00fc350d | 77098 | CT-AU-22614C | cavapoo | Cavoodle | S$6,500 | S$3,250 | no | no | missing photo; arrival 2026-10 passed |
| 9 | os-78c80080 | 11573 | CT-AU-54E31B | cavapoo | Cavoodle | S$6,000 | S$3,000 | no | no | missing dob-or-age,photo |
| 10 | os-8b5770d4 | 33155 | CT-AU-A0A317 | chihuahua | Chihuahua | S$6,000 | S$3,000 | yes | yes (if approved) | — |
| 11 | os-18d38967 | 74453 | CT-AU-7207A3 | cockapoo | Spoodle | S$6,500 | S$3,250 | no | no | missing dob-or-age,photo |
| 12 | os-311f0298 | 62341 | CT-AU-EB2C69 | cockapoo | Spoodle | S$6,000 | S$3,000 | no | no | missing photo; REJECT: ~19 weeks old today; arrival 2026-10 passed |
| 13 | os-a21091c4 | 76418 | CT-AU-47163C | cocker-spaniel | Cocker Spaniel | S$6,700 | S$3,350 | no | no | missing dob-or-age,photo |
| 14 | os-ed20d82b | 14073 | CT-AU-F47773 | french-bulldog | French Bulldog | — | — | yes | no | missing price,sex |
| 15 | os-3b282e99 | 88441 | CT-AU-402A2D | french-bulldog | French Bulldog | — | — | yes | no | missing price,dob-or-age |
| 16 | os-7d6afb6d | 56684 | CT-AU-31729D | french-bulldog | French Bulldog | — | — | yes | no | missing price,dob-or-age |
| 17 | os-97719a26 | 16873 | CT-AU-6C1CF6 | french-bulldog | French Bulldog | — | — | yes | no | missing price,dob-or-age |
| 18 | os-836ccbd0 | 26831 | CT-AU-1A6C5C | french-bulldog | French Bulldog | — | — | yes | no | missing price,dob-or-age |
| 19 | os-63de90f3 | 34385 | CT-AU-BFDA7F | french-bulldog | French Bulldog | — | — | yes | no | missing price,dob-or-age |
| 20 | os-7ed60ba3 | 32811 | CT-AU-3F6C75 | french-bulldog | French Bulldog | — | — | no | no | missing price,photo |
| 21 | os-6ca35b65 | 93334 | CT-AU-EB1C69 | german-shepherd | German Shepherd Dog | S$7,000 | S$3,500 | yes | no | missing dob-or-age |
| 22 | os-304e8b61 | 14081 | CT-AU-308E24 | german-shepherd | German Shepherd | S$5,500 | S$2,750 | no | no | missing photo; REJECT: ~19 weeks old today; arrival 2026-10 passed |
| 23 | os-805b9900 | 65590 | CT-AU-C49E46 | golden-retriever | Golden Retriever | S$7,000 | S$3,500 | no | no | missing dob-or-age,photo |
| 24 | os-99af37f5 | 17132 | CT-AU-F153C0 | golden-retriever | Golden Retriever | — | — | yes | no | missing price |
| 25 | os-6a1e7720 | 64832 | CT-AU-5C48E5 | golden-retriever | Golden Retriever | S$6,000 | S$3,000 | no | no | missing photo; REJECT: ~19 weeks old today; arrival 2026-10 passed |
| 26 | os-70a7c43d | 52499 | CT-AU-FCBFAB | golden-retriever | Golden Retriever | S$4,900 | S$2,450 | yes | yes (if approved) | — |
| 27 | os-80fefa9e | 28740 | CT-AU-F88D53 | golden-retriever | Golden Retriever | S$7,000 | S$3,500 | yes | no | missing dob-or-age |
| 28 | os-65859503 | 81421 | CT-AU-B95127 | havanese | Havanese | S$6,500 | S$3,250 | yes | yes (if approved) | — |
| 29 | os-d9eff28e | 30781 | CT-AU-FE767F | maltese | Maltese | S$5,450 | S$2,725 | yes | yes (if approved) | — |
| 30 | os-346dce23 | 57951 | CT-AU-A157F0 | maltese | Maltese x Pomeranian | S$5,800 | S$2,900 | no | no | missing photo |
| 31 | os-bc484c2f | 76847 | CT-AU-9710FE | mini-dachshund | Dachshund | S$5,000 | S$2,500 | yes | yes (if approved) | — |
| 32 | os-e8efdc25 | 43536 | CT-AU-DE764F | mini-dachshund | Dachshund | S$4,700 | S$2,350 | yes | no | missing dob-or-age |
| 33 | os-481df0b8 | 44420 | CT-AU-C8C67A | mini-dachshund | Miniature Dachshund | S$4,500 | S$2,250 | no | no | missing photo |
| 34 | os-8f1f496d | 98417 | CT-AU-E195E2 | mini-dachshund | Miniature Dachshund | — | — | yes | no | missing price; shares photo with 25655 |
| 35 | os-8f1f496d | 25655 | CT-AU-D31715 | mini-dachshund | Miniature Dachshund | — | — | yes | no | missing price; shares photo with 98417 |
| 36 | os-a3562f70 | 43187 | CT-AU-9ECCFD | mini-dachshund | Miniature Dachshund | S$6,300 | S$3,150 | yes | no | arrival 2026-10 passed |
| 37 | os-5b99730e | 58422 | CT-AU-856811 | pomeranian | Pomeranian | S$5,700 | S$2,850 | yes | yes (if approved) | — |
| 38 | os-f47adf9d | 51951 | CT-AU-1E4D34 | toy-poodle | Miniature Poodle | — | — | yes | no | missing price |
| 39 | os-48169451 | 92814 | CT-AU-ED4B65 | toy-poodle | Poodle | S$5,400 | S$2,700 | no | no | missing photo |
| 40 | os-00b8a022 | 74615 | CT-AU-809F0E | toy-poodle | Toy Poodle x Moodle | S$5,000 | S$2,500 | yes | no | missing dob-or-age |

## 4. Preview

Project `curioustails-staging`, branch `k136-au-migration`, deployment `8df7764b`. Every URL returns 200 with `x-robots-tag: noindex, nofollow`.

- Breed page with an AU card: https://k136-au-migration.curioustails-staging.pages.dev/puppies/golden-retriever/
- AU detail page: https://k136-au-migration.curioustails-staging.pages.dev/puppies/golden-retriever/imp-fcbfab545d/ (others: `/puppies/cavapoo/imp-61298df5e7/`, `/puppies/border-collie/imp-18493781d2/`, `/puppies/chihuahua/imp-a0a3175b89/`, `/puppies/havanese/imp-b9512725a3/`, `/puppies/maltese/imp-fe767f8808/`, `/puppies/mini-dachshund/imp-9710fe7c2a/`, `/puppies/pomeranian/imp-85681143a6/`)
- All 8 AU cards together: https://k136-au-migration.curioustails-staging.pages.dev/available-puppies/
- Terms page: https://k136-au-migration.curioustails-staging.pages.dev/reservation-terms/
- A breed page that loses its AU cards: https://k136-au-migration.curioustails-staging.pages.dev/puppies/french-bulldog/

**How the preview was made.** The stage copy is `D:\Claude Code\_k136_stage`, and the stage store is `D:\Claude Code\_k136_stage_store`, which held only a copy of `secret.key` (since deleted) so the ids match what production will get. In that store I recorded approvals for the 8 approvable items as actor **`preview:k136 (not the owner)`**, then ran `sync --cutover` and built. **The owner's real review queue was not touched.**

Stage gates:
- `npm run build` PASS (`check:surcharge`, `check:puppy-pages`)
- `check:import-leaks --dist` OK
- 0 legacy `overseas:` cards in dist, and 8 terms links on `/available-puppies/`

The preview also contains every other uncommitted card in the shared tree (K-119, K-130, K-134 and others).

## 5. What would change on production if approved

1. **27 live AU cards become 8.** The 8 approvable listings re-appear as imported-style cards with a `CT-AU-` ref, the terms link and a detail page each. They sit on 8 breed pages and in the "Arriving soon · Imported" section of `/available-puppies/`. **The other 19 live AU cards come off the site:**
   - 12 have no price (rows 1, 4, 14–19, 24, 34, 35, 38);
   - 5 have a price but no age, so no arrival estimate (rows 2, 21, 27, 32, 40);
   - 2 have an arrival month that has passed (rows 6 and 36), and row 6 is also over 16 weeks.

   Beagle, French Bulldog, German Shepherd and Toy Poodle lose their AU section entirely. **No price, deposit or buyer is changed.**
2. 8 new noindex pages at `/puppies/<breed>/imp-…/`, plus `/reservation-terms/` (noindex, labelled draft).
3. Imported pages, Irish ones included, lose the Visit and Families sections and any Balestier review. They also stop printing raw perk ids ("starter-kit home-delivery-setup…"); that was a K-130 bug, also visible on the K-134 preview, and I fixed it.
4. Approving in the real system takes these steps:
   1. `npm run au:reservations -- migrate --actor owner:<name>` (fills the real queue).
   2. Approve in `npm run review:imports`. If a buyer already holds a listing, use `npm run approve:import -- reserve <imp-id>` instead.
   3. `npm run au:reservations -- sync --cutover`.
   4. Deploy, under a separate production card.

**Recommended before approving:** run `npm run sync:overseas` first. Fresh sheet ages and prices would likely move several of the 28 "needs an edit" rows to approvable. This is the owner's sheet, not a price change made here.

## 6. Open items / flags

1. **Buyers:** nothing in the repo records which AU listings already have a deposit-paying buyer. The owners must list them. Counsel's Q13 asks how to bring those buyers under the terms, for example with a fresh confirmation for them to accept. Until that happens, existing AU buyers are **not** covered by written terms.
2. **Counsel:** these remain open on the terms page:
   - A1 (in-shop terms)
   - A11 (importer of record)
   - A12 (dispute route)
3. **Retired-id redirects:** `imported-retired.json` is consumed by `scripts/lib/puppy-redirects.mjs`. I did not verify the full 301 path end to end for AU ids.
4. `npx astro check` is not installed in this project (`@astrojs/check` is missing), so there was no separate type check. The build and both test suites pass.
5. The stage store's copy of `secret.key` was deleted once the preview was built. To rebuild the preview, copy the key back in. Delete `D:\Claude Code\_k136_stage` and `_k136_stage_store` once the preview is approved or abandoned.

## Files

- **New:**
  - `scripts/imports/lib/au.mjs`, `scripts/imports/au-reservations.mjs`, `scripts/imports/tests/au-reservations.test.mjs`
  - `src/data/au-reservations.json` (empty, `cutover: false`), `src/data/reservation-terms.json`, `src/pages/reservation-terms.astro`
  - `reports/k136-*`, `reports/k136-tools/*`
- **Edited:**
  - `src/lib/puppy-publish.mjs`, `src/lib/puppy-page.ts`, `src/lib/imported-puppies.ts`, `src/lib/sitemap-exclusions.mjs`, `src/data/buying-terms.ts`, `src/data/puppy-page-copy.ts`
  - `src/components/OverseasPuppies.astro`, `ImportedPuppyCard.astro`, `puppy-page/{PuppyPage,PuppyDossier,NextSteps,PriceIncludes}.astro`, `puppy-page/puppy-page.css`
  - `scripts/check-puppy-pages.mjs`, `scripts/test-puppy-page.mjs`, `scripts/fixtures/puppy-page/fixtures.json`
  - `scripts/imports/lib/owner.mjs`, `scripts/imports/lib/pipeline.mjs` (AU queue carry only), `scripts/imports/public-schema.json`, `package.json` (`au:reservations`)
- **Not touched:** `rtp-v3`, any other project, the real private store, production.
