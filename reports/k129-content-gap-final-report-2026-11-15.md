# K-129 final pass — K-119 28-point content plan

**Date:** 14–15 November 2026 · **Card:** K-129 (resumes K-119) · **Branch:** `k119-content-gap` (uncommitted)
**Plan:** `reports/content-gap-plan-2026-11-14.md` + `reports/content-gap-plan-tasks.json`

This is the final pass. It did not restart the card: every change already on disk was kept, checked against
`dist/`, and only the gaps found in verification were closed.

## 1. The 16 tasks

| Task | What | State found | This pass |
|---|---|---|---|
| T01 | `buying-terms.ts` single source, `site.directions`, `site.ownersLine` | done | verified (`KIT_TOTAL=533`, `KIT_COUNT=30`, both clinic numbers, week-16 core) |
| T02 | `check-all-in-surcharge.mjs` gate (report mode) | done | verified |
| T03 | Hero surcharge line; "No add-ons quietly billed later" retired | done | verified on 49 pages |
| T04 | Home inclusions, surcharge, "How do I pay?" FAQ + FAQPage JSON-LD | done | verified |
| T05 | One surcharge footnote per listing grid | done | verified |
| T06 | Breed price footnote + shared FAQ on 48 files | done | verified |
| T07 | Gate wired into `npm run build` | done | verified |
| T08 | `VaccinationTimeline` on 48 breed pages | done | verified (week 16 = fourth core) |
| T09 | Home health sentence + Pet Ownership Course sentence | done | verified |
| T10 | Boarding capped at one month (home + 48) | **partly done** — the aftercare block was capped, but 46 breed price paragraphs still said "until your home is ready", and home had two more open-ended promises | **finished** (see §2) |
| T11 | `ReserveSteps` on home + 48 | done | verified (5 steps) |
| T12 | `FinalCta`: directions, owners, no pressure, help-find, availability | done | verified |
| T13 | Home visit block, Book a viewing, ribbon cut | done | verified |
| T14 | Similar-puppy line on home, next-litter line on breed | done inline | switched home to the `SIMILAR_PUPPY_LINE` constant (one source); verified once per page |
| T15 | Starter kit `$533` / 30 items from data | done | verified; the only visible "$500+" left is inside 6 verbatim customer reviews (out of scope, see §5) |
| T16 | Owner answers (Q1, Q2, Q3) | done | verified: PayNow no fee / "the only extra", both clinic numbers labelled, week 16 core |

## 2. What this pass changed

1. **T10 completion — 46 breed pages.** The price-block paragraph repeated the old open-ended boarding promise with three
   phrasings. One identical codemod line replaced all of them with the plan's facts: free boarding for **up to a month**,
   food and lodging covered, **vaccinations kept on schedule at our cost**. `reports/k129-tools/fix-boarding.mjs`;
   result `changed=46 files=48 still-with-phrase=0`.
2. **T10 completion — home.** The "What happens after I reserve a puppy?" FAQ answer and the "Free boarding after deposit"
   comparison row now say "up to a month" instead of "until you're ready".
3. **T14 — one source.** The home sold-puppy line now renders `SIMILAR_PUPPY_LINE` rather than a second typed copy.

No reviews, prices, guarantees or founder biography were touched. No fact was invented.

## 3. Verification

| Check | Result |
|---|---|
| `npm run build` (includes `check:surcharge`, `check-kit-seal`, `check:puppy-pages`) | **PASS**, exit 0, 128 pages (`reports/k129-build-final2.log`) |
| Surcharge gate | `pages=49 all-in-blocks=286 checked=286 failed=0` — **PASS** (`reports/k129-surcharge-gate.txt`) |
| `reports/k119-tools/verify-dist.mjs` (every T01–T16 acceptance string, home + 48) | **0 failed checks** |
| T14 counts | next-litter line exactly once on all 48; similar-puppy line once on home |
| T15 visible `$500+` / `30+ items` | 0 outside `<blockquote>`; 6 customer-review quotes retain "$500+" verbatim (see §5) |
| Three breed samples (`sample-compare.mjs`) | all 8 shared blocks present and byte-identical across maltipoo/cavapoo/corgi; pages differ only in breed name, price and own prose |
| 1440 / 390 (live preview, Playwright) | 12/12 route-widths: **0 console errors, scrollWidth = viewport** (`PASS viewport-check`) |
| Design rhythm on `/`, maltipoo, cavapoo, corgi | **0 failures** each; full `check:design` still reports the site's pre-existing rule set (not introduced here) |
| copy_lint (rtp-v3 script) | **Not clean before and not clean now.** Same rule classes as the K-119 baseline: C1 428 (unchanged), C3 368 in the home+48 scope (unchanged), C2/C10 unchanged. Rises are C6/C6b (the plan deliberately renders shared terms on 49 pages) and C11 (new figures: 3%, $533). Later K-130/K-136 routes account for the C3/C4 route-level increases. |

### Word growth (visible words, same counter as K-119)

| Scope | Before | After | Growth | Plan |
|---|---|---|---|---|
| Home | 4,895 | 5,173 | **+5.7%** | +5% |
| Breed mean (48) | 4,361.3 | 4,846.1 | **+11.1%** | +9% |
| Six that already had the table | 4,093.7 | 4,493.5 | **+9.8%** | +6% |
| maltipoo / cavapoo / corgi | 4,204 / 4,717 / 3,941 | 4,708 / 5,220 / 4,325 | +12.0% / +10.7% / +9.7% | — |

Breed pages grew slightly more than planned because the boarding cap adds the "vaccinations kept on schedule at our
cost" clause to 46 pages; the plan's own §6 estimated +9%.

### Surcharge grep — where "all-in" appears

`check-all-in-surcharge` splits each page into its visible blocks and requires `/3% bank surcharge/` in every block
whose text matches `/all-in/i`. It ignores `<title>`, meta and JSON-LD. Result: **286 blocks checked, 0 failed** on home +
48 breed pages. Per-page block counts from the run:

```
/                                  all-in blocks=10 banned=no
/puppies/maltipoo/                 all-in blocks= 4 banned=no
/puppies/cavapoo/                  all-in blocks= 7 banned=no
/puppies/corgi/                    all-in blocks= 6 banned=no
... 45 more breed pages ...
check-all-in-surcharge: pages=49 all-in-blocks=286 checked=286 failed=0
```

Visible-text counts: home 11 "all-in" / 7 surcharge lines, maltipoo 5/5, cavapoo 9/5, corgi 7/5 (one surcharge line
can cover more than one "all-in" in the same block; the gate is the authority).

### Breed samples

`reports/k129-shots/` — full pages at 1440 and 390 for maltipoo, cavapoo and corgi, plus section shots
(`hero`, `price`, `timeline`, `steps`, `finalcta`) for each. All shared blocks are identical; the hero, price and
breed prose differ only by data. Sample compare: `ALL SHARED IDENTICAL: true`.

## 4. Preview (preview branch only)

**https://k129-content-gap.curioustails-sg.pages.dev**
Deployment: https://582f9e72.curioustails-sg.pages.dev · build `6b37699bba16` · `x-robots-tag: noindex, nofollow`.

This preview is a **scoped K-129 build**: the working tree copied to a temp directory, with the later K-130 puppy
template rolled back to the committed `HEAD` `[id].astro` (the `src/components/puppy-page/` directory removed in the
copy only). Nothing in the real working tree was rolled back or deleted. The live preview was re-checked after deploy:
home has 0 "until you", 5 "up to a month", 9 "3% bank surcharge", 1 sold-puppy line.

**The preview also contains an unrelated in-progress die-cut redesign that is not part of K-129:** the `dc-seal`,
`dc-sticker`, `dc-home` and `dc-scallop` classes in `Hero.astro` / `index.astro`, the `diecut.css` import, and the
`30+ ITEMS INCLUDED` seal. In this build the seal renders unstyled/overlapping (e.g. "INCLUDED" under the maltipoo
photo and a clipped seal behind the 4.9 chip on corgi). **That is the die-cut work, not the content plan.** It was left
exactly as found and must not be reviewed as part of K-129.

The preview's puppy detail pages use the committed `HEAD` template, so they do not show K-130's new puppy page. The
T16 clinic-number update is verified in the real tree's build (`/puppies/maltipoo/2950-red-boy/` contains both
8268 4039 and 6255 6064), not in this scoped preview.

## 5. One deliberate exception

Six breed pages carry a verbatim customer review containing "The $500+ starter pack was such a generous surprise"
(bichonpoo, cavalier-king-charles-spaniel, coton-de-tulear, havanese, pomeranian, whippet). T15's literal acceptance
("no visible $500+") would require editing those reviews. The card's ground rules forbid touching reviews (K-117 is
separate) and forbid changing what a customer said. They were left verbatim. The `verify-dist.mjs` check excludes
`<blockquote>` for exactly this reason.

## 6. Files changed by this pass

- `src/pages/puppies/*.astro` (46 files, one identical boarding sentence)
- `src/pages/index.astro` (home boarding FAQ + comparison row, `SIMILAR_PUPPY_LINE` import/use)
- `reports/k129-tools/` (fix + verification scripts)
- `reports/k129-shots/` (screenshots)
- this report

The rest of the working tree (die-cut, K-130, K-136 and the older dirty reports) is other work, left in place.
