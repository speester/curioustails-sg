# K-129: resume of K-119, the 28-point content plan

**Date:** 14 November 2026 · **Card:** K-129 (resumes K-119) · **Branch:** `k119-content-gap` (uncommitted, as found)
**Plan:** `reports/content-gap-plan-2026-11-14.md` + `reports/content-gap-plan-tasks.json`

## 1. Status of the 16 tasks

The previous worker had applied all 16 tasks on disk before it died. Nothing was started again. I verified each task
against `dist/`, and then corrected three things it had got wrong (§2).

| Task | What | State found | K-129 action |
|---|---|---|---|
| T01 | `buying-terms.ts`, `site.directions`, `site.ownersLine` | done | `PAYMENT_LINE` corrected (§2) |
| T02 | `check-all-in-surcharge.mjs` gate | done | none |
| T03 | Hero surcharge line, retired "No add-ons quietly billed later" | done | none |
| T04 | Home inclusions, surcharge, "How do I pay?" FAQ | done | none |
| T05 | Listing-grid surcharge footnote | done | none |
| T06 | Breed price footnote + shared FAQ (48 files) | done | none |
| T07 | Gate wired into `npm run build` | done | none |
| T08 | `VaccinationTimeline` on 48 breed pages | done | week-12/16 rows corrected (§2) |
| T09 | Home health + Pet Ownership Course sentences | done | "weeks 6, 8, 12 and 16" (§2) |
| T10 | Boarding capped at a month (home + 48) | done | none |
| T11 | `ReserveSteps` (home + 48) | done | none |
| T12 | `FinalCta`: directions, owners, no pressure, help-find, availability | done | none |
| T13 | Home visit block, Book a viewing, ribbon cut | done | none |
| T14 | Similar-puppy line on home, next-litter line on breed | done | none |
| T15 | Starter kit `$533` / 30 items from data | done | none |
| T16 | Owner answers (Q1, Q2, Q3) | done | completed for Q1 and Q3 (§2) |

## 2. What K-129 changed

1. **Payment line: an invented fact removed.** `PAYMENT_LINE` read "Pay by PayNow, bank transfer, cash at handover, or
   credit card". The plan (B1) and the owner addendum give two methods: PayNow and credit card. Nothing in the repo
   sources "cash at handover". It now reads **"Pay by PayNow or credit card."** The FAQ answer reads "… PayNow carries no
   fee. Ask us for the account details when you reserve." This applies Q1: PayNow has no fee, so "The only extra is the
   3% bank surcharge if you pay by credit card." stays. It also settles conflict D1 in
   `puppy-page-template-plan-2026-11-14.md` §9 in favour of two methods.
2. **Week 16 is now core everywhere, not only in one row.** The owner answered Q3: core. The previous worker changed
   only the week-16 label, so the week-12 row still said "completing the core puppy course" and the home sentence still
   said "weeks 6, 8 and 12". Fixed in `buying-terms.ts` (week 12 "Third vaccination and deworming", week 16 "Fourth core
   vaccination, completing the core puppy course") and in the home health sentence.
3. **The linked health pages agree with the owner's answer.** The home page links "the full schedule" to
   `/learn/puppy-health/`, which still said "optional fourth at week 16". That contradiction is now gone from:
   `learn/puppy-health.astro` (FAQ, DefBox, side list, table, subhead, meta description), `data/posts.ts` (the same
   description), `first-time-owners/puppy-care-101.astro` (table) and `blog/pet-ownership-course-singapore.astro`
   (timeline list). `grep -ri "optional fourth|optional 16" src` now returns nothing.
4. **Vets For Pets, Lengkok Bahru: both numbers, labelled.** This was already applied on disk. Breed and home show "Lengkok Bahru -
   WhatsApp or call 8268 4039, landline 6255 6064" (tel: and wa.me links on breed pages). The puppy page
   (`outputs/puppy-page-redesign-biscuit.html:1274`) also carries both numbers. Its staging mirror
   (`_k002_stage/outputs/index.html`) still shows the mobile only. It was not re-mirrored or deployed, because the
   staging project is outside this preview.

## 3. Verification

| Check | Result |
|---|---|
| `npm run build` (includes `check:surcharge`) | **PASS**. `pages=49 all-in-blocks=285 checked=285 failed=0` (`reports/k129-build-3.log`) |
| `reports/k119-tools/verify-dist.mjs` (every T01-T16 acceptance string, home + 48) | **0 failed checks** |
| copy_lint (`rtp-v3/scripts/copy_lint.py`) vs. K-119 baseline | **Not clean before and not clean now.** It ran 124 pages, the same as before. The typography rules are unchanged: C1 428, C2 66, C3 496, C4 62, C8 2, C9 2, C10 941, C15 2. Three rules grew. Repeated-sentence C6 went from 285 to 307 and C6b from 47,244 to 59,435, because the plan deliberately renders the shared terms on 49 pages. Figures outside `<Fact>` (C11) went from 9,540 to 10,002, from new prices, "3%" and "$533". |
| `design-audit.mjs --rhythm` delta (`reports/k119-tools/design-delta.mjs`) | `/` 4→4, `/puppies/maltipoo/` 4→4, `/puppies/cavapoo/` 4→4. **Delta 0.** The "NEW" lines are the same rules with section counts shifted by the added sections. |
| 1440 and 390, Playwright (`reports/k119-tools/viewport-check.mjs`) | home, maltipoo, cavapoo, corgi, cavalier-king-charles-spaniel, learn/puppy-health: **0 console errors, scrollWidth = viewport on all 12** |
| Word growth (`count-words.mjs`, against the K-119 baseline) | home 4,895 → 5,119 (**+4.6%**, plan +5%). Breed average 4,361 → 4,823 (**+10.6%**, plan +9%). The six with the old table grew **+8.8%** (plan +6%). maltipoo +11.5%, cavapoo +6.9%, corgi +9.5% |

One incident during the session: a design-delta run I had piped through `tail` was cut off mid-swap and left
`dist/index.html` as the pre-change capture. A missing-CSS 404 and a false overflow revealed it. I rebuilt
`dist/` and re-ran every check above on the clean build.

### Surcharge grep (`reports/k119-tools/allin-sitewide.mjs`, visible text of built pages)

- **In the gate (home + 48 breed pages): 49 pages, 285 "all-in" blocks, 0 pages without "3% bank surcharge".**
  For example, home has all-in ×10 and surcharge ×7, maltipoo 4/5, cavapoo 7/5 and corgi 6/5. The gate checks per block, not
  per page.
- **Outside the gate, still to do (plan §7 follow-up, not in this card):** `/pricing/` (70 all-in), `/delivery/`,
  `/starter-kit/`, `/first-time-owners/budget-guide/`, `/about-us/`, `/free-training/`, `/found-loving-homes/` and 7 blog
  posts say all-in, and several have no surcharge line. The retired promise "nothing added later" still appears on
  `/pricing/`, `/learn/cheap-puppies-singapore/` and **all 42 individual puppy pages** (`PuppyDetail.astro:116,246`).
  The puppy-template card owns that file. Recommend a follow-up card to extend the gate site-wide.

### Breed samples (maltipoo, cavapoo, corgi)

All three render the same component sequence. They differ only in data: breed name, price, nearest-breed listings and
the breed's own prose. After the breed name and prices are normalised, the HTML still differs, as expected, because
each file keeps its own hand-written prose. All shared blocks are byte-identical in wording: hero surcharge line, price
footnote, "How do I pay?" FAQ, timeline, ReserveSteps and FinalCta. Screenshots: `reports/k129-shots/`.

## 4. Preview deploy and the import-leak gate

**Preview:** https://k129-content-gap.curioustails-sg.pages.dev (deployment https://34eeb5be.curioustails-sg.pages.dev).
Branch `k129-content-gap` of `curioustails-sg`. The preview sends `x-robots-tag: noindex, nofollow`. The production
branch (`main`, curioustails.sg) was not deployed. Smoke test of the live preview: `/`, `/puppies/maltipoo/`,
`/puppies/cavapoo/`, `/puppies/corgi/` and `/learn/puppy-health/` all return 200. They carry the surcharge line, "Pay by
PayNow or credit card", the core week-16 wording and 6255 6064, and "optional fourth" appears 0 times.

The first deploy attempt was refused by `check:import-leaks` (132 hits). The coordinator chose to fix the data and the
scanner's precision, with no bypass. The gate now reports `check:import-leaks: OK` and ran as part of the deploy.

### 4a. The 126 seller-regno hits: a placeholder in two records (fixed)

- **Value:** the literal string **`"NULL"`** in `seller.regNo` on **`dogsy:1591`** and **`dogsy:1567`**, first seen
  2026-11-13 22:15. The dogsy adapter copied `ad.user.seller_license`, which the site returns as `"NULL"`. `cleanStr`
  only dropped `null` and `$undefined`. The leak scanner then word-matched `null` in ordinary JS on every built page.
- **Records fixed:** `regNo` was removed from both, because the feeder has no real one. Backup:
  `D:\Claude Code\_private\curious-tails-imports\imports-state.pre-k129-2026-11-14.json`.
- **Gate so it cannot enter again:**
  - `source-record.mjs` adds `PLACEHOLDER_RE`, `isPlaceholder`, `cleanId` and `dropPlaceholderSellerFields` (it covers
    regNo, vet and type).
  - The dogsy and dfsi adapters read `regNo` through `cleanId`.
  - `pipeline.mjs` `mergeFetchedRecord` strips placeholder seller ids from the incoming record and from the merged
    record before it reaches `imports-state.json`.
- The denylist was **not** widened for this.

### 4b. The 6 listing-id hits: coincidences, not leaks (scanner precision fix)

| Hit | Matching record | What it actually matched | Evidence it is not from the record |
|---|---|---|---|
| `/puppies/labradoodle/` | `dfsi:labradoodles` (the ad's public URL slug) | The shop's own copy: "labradoodles are not HDB-approved", "Are labradoodles hypoallergenic?" | The page was committed 2026-10-01, before the imports pipeline existed |
| `/puppies/` + the 4 `_astro/7-fawn-male-pug-puppy-available-in-singapore.*.webp` variants | `dfsi:male-pug` (URL slug) | The shop's own photo filename, `src/assets/pug/7-fawn-male-pug-…webp` (the scanner checks paths) | The image was committed in `8794c20` on 2026-07-10 |

**The two dfsi records in review state are unpublished and unreachable from any page.** `dfsi:labradoodles` and
`dfsi:male-pug` both have status `review`, no `published` entry and no decision. Neither key, source URL nor public id
appears in `src/data/imported-puppies.json`, the only route from the store to a page.

**Fix (coordinator option A):** in `leaks.mjs`, a listing id is not word-matched only when all three conditions hold.
Its supplier uses slug ids (`SLUG_ID_SUPPLIERS = {dfsi}`), it has no digit, and every hyphen token is in `SLUG_VOCAB`.
`SLUG_VOCAB` is the breed-map label words plus male, female, puppy, pups, sale and similar words, with plural s/es
allowed. Everything else stays denylisted. The source URL, seller name, regNo, phone, vet and microchip rules are
untouched. The pug photo was not renamed and the records were not deleted.

### 4c. Tests

`npm run test:imports`: **184/184 pass**. That is 174 pre-existing tests, plus 3 placeholder tests
(`tests/placeholder.test.mjs`), plus 7 slug-id tests (`tests/slug-id.test.mjs`). The slug-id tests include the four
required cases:

1. `dfsi:labradoodles` passes ("Are labradoodles hypoallergenic?" is not a hit).
2. `dfsi:male-pug` passes (the shop's pug filename is not a hit).
3. `dfsi:antoinette-moore` still fails.
4. `dfsi:labradoodle-moore` (a breed word mixed with a name) still fails.

The other slug-id tests show the following. The full source URL of a vocabulary-shaped slug is still denylisted. A
vocabulary-shaped seller **name** ("Pug Male") is still caught as seller-name. The exception does not apply to
non-slug suppliers (`dogsy:labradoodles` fails) or to ids with a digit (`labradoodles-2`).

## 5. The die-cut redesign in the same tree

The working tree also carries an **unrelated, in-progress die-cut redesign** that is not part of this plan: the
`dc-seal`, `dc-sticker`, `dc-home` and `dc-scallop` classes in `Hero.astro` and `index.astro`, and the
`src/styles/diecut.css` import. It was left exactly as found. **Any preview built from this tree shows both changes:
the K-119 content and the die-cut styling.**

## 6. Correction: four payment methods (follow-up dispatch, 14 Nov)

**Correction for the record:** §2.1 of this report and the earlier preview said "Pay by PayNow or credit card." **That
was wrong against the owner's answer.** The owner confirmed four methods: PayNow, bank transfer, cash and card. I
cut the list to two from the K-118 plan's wording and the K-124 prototype ("two methods only"). Owner decision D1 is
recorded in `src/data/buying-terms.ts` by K-130 (12:59), as `PAYMENT_METHODS` and `PAYMENT_LINE`.

**Wording now live** (one source, `buying-terms.ts`; the home FAQ, the 48 breed FAQs and the 48 breed price footnotes
all read it): "Pay by PayNow, bank transfer, cash or credit card. The only extra is the 3% bank surcharge if you pay by
credit card. PayNow, bank transfer and cash carry no fee." The surcharge is attached only to the card.

**A K-119 defect fixed on the way:** Astro's HTML compression joined the breed price footnote to the next sentence
("…if you pay by credit card.Why is our price…") on all 48 breed pages. A trailing space inside the footnote template
string (`${SURCHARGE_LINE} `) fixes it. That edit is in the 48 `src/pages/puppies/*.astro` files.

### Preview: content plan only

**https://k129-content-gap.curioustails-sg.pages.dev** (deployment https://9a719bba.curioustails-sg.pages.dev, build
`fc33e1aaad78`, noindex). The preview contains:

- **The content plan only.** K-119/K-129 copy, plus the four-method wording.
- **The die-cut redesign, still present and not part of this.** It is in the working tree: the `dc-*` classes and
  `diecut.css`.
- **The K-130 puppy template, excluded.** It will appear in its own preview when K-130 lands. Puppy detail pages
  (`/puppies/<breed>/<id>/`) render the committed HEAD `[id].astro`. That is not the PuppyDetail version that was in
  the earlier K-129 preview, and not K-130's new template. The live check on `/puppies/maltipoo/2950-red-boy/` found
  0 K-130 markers.

**Scoped build, reproducible** (`<scratch>` =
`C:\Users\admin\AppData\Local\Temp\claude\C--Users-admin\1d66763c-1d45-4b95-b479-e4ed3bf137ce\scratchpad`):

```sh
# 1. copy the working tree without heavy/unrelated dirs, then link node_modules (PowerShell)
robocopy "D:\Claude Code\Curious Tails" "<scratch>\k129-scoped" /E /XD node_modules dist .git _k002_stage outputs reports logs .astro
New-Item -ItemType Junction -Path "<scratch>\k129-scoped\node_modules" -Target "D:\Claude Code\Curious Tails\node_modules"
# 2. roll back the K-130 puppy template in the COPY only (bash)
git -C "D:/Claude Code/Curious Tails" show "HEAD:src/pages/puppies/[breed]/[id].astro" > "<scratch>/k129-scoped/src/pages/puppies/[breed]/[id].astro"
rm -rf "<scratch>/k129-scoped/src/components/puppy-page"
# 3. build, then deploy from the copy with the usual env loader (the deploy script runs check:import-leaks itself)
cd "<scratch>/k129-scoped" && npm run build
bash scripts/deploy-pages.sh --branch k129-content-gap   # run under the global env loader, as in §4
```

The real working tree was not rolled back. K-130's files are untouched. The deploy line was appended to the repo's
`BUILD-STATE.md` by hand, because the script wrote it into the copy.

**Checks on the scoped build:**

- Surcharge gate: **286/286**, 0 failed. That is one more block than before, because a breed listing changed in the
  data.
- `verify-dist.mjs`: **0 failed checks**, home + 48. Its payment regex was updated to the four-method line.
- `check:import-leaks`: **OK**, run by the deploy script.

**Served-page grep** (live preview, visible text):

| Page | PayNow | bank transfer | cash | credit card |
|---|---|---|---|---|
| `/` | "How do I pay? Pay by PayNow, bank transfer, cash or credit card." | same sentence | same sentence | "…the 3% bank surcharge if you pay by credit card." |
| `/puppies/maltipoo/` | price footnote: "…already included. Pay by PayNow, bank transfer, cash or credit card." | same | same | same |
| `/puppies/corgi/` | price footnote: same sentence | same | same | same |

Counts on `/`: PayNow 4, bank transfer 4, cash 4, credit card 11. On `/puppies/maltipoo/`: 5, 5, 5, 9.

`outputs/puppy-page-redesign-biscuit.html` still lists two methods. It was left alone on purpose: it is gitignored,
does not ship, and K-130 supersedes it.
