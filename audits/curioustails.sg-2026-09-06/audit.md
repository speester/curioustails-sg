# Rank blocker audit — curioustails.sg

Reachability: 200 (2026-09-06) · Build: LIVE 29cfab8 · clean tree: NO → live URLs are ground truth,
`[SRC]`-only checks marked UNKNOWN · History: first impression 2026-07-06 (site 62 days old in Google's
index) · Location: Singapore (source: project-config `COUNTRY`) · Prior audits: 2 (evidence reused where
same-scope) · Paid API calls this run: 4 (1 SERP, 1 business listings ×4, 2 backlinks bulk)

Scope note: the owner named three head terms. Project-config `PRIMARY_KEYWORD` is
`puppy for sale Singapore` [SRC]. Both are audited; they resolve to the same target URL (`/`).

---

## VERDICT — all three head terms

```
KEYWORD: "puppies for sale singapore"     LOCATION: Singapore
CURRENT:  not in top 50 organic [SERP]; nearest measured relative is
          "puppies for sale" at #50.2 [GSC 90d]
TARGET URL: /   [SRC blueprint row 1]
RANKING URL: /  (no mismatch)  [GSC — 1,826 impressions, avg #21.3, 28d]
VERDICT:  CAPPED — Gate 6 (authority)
BINDING CONSTRAINT: 5 referring domains, of which 3 are nofollow — approximately 2 followed
  referring domains total. Top-3 median for this SERP is 178. That is a ~36x gap. [BACKLINKS]
CEILING (on-page only): #8–#15 for the head term. Every on-page lever combined does not
  close a 36x off-page gap on a commercial head term. [INFER from GATE-6]
NEXT: no on-page fix changes this. Gate 6 work, or retarget. See fix queue.
```

Same verdict, same constraint, for `dog breeder singapore` and `puppy shop singapore`.

---

## The finding that matters most

**The site is not broken. It is 62 days old and climbing steeply.** [GSC]

| window | clicks/day | impressions/day | avg position |
|---|---|---|---|
| 2026-07-06 → 07-15 | ~3 | ~62 | 30.4 |
| 2026-08-01 → 08-15 | ~18 | ~250 | 15.9 |
| 2026-08-29 → 09-05 | ~50 | ~572 | 9.3 |

Clicks are up ~16x in eight weeks and average position has moved from ~30 to ~8. Nothing in this
data looks like a penalty, a suppression, or a technical block. It looks like a young site being
discovered on schedule.

**Where it already wins** [GSC 28d]: `/puppies/mini-dachshund/` #6.9 (1,365 impressions),
`/puppies/chihuahua/` #6.6, `/puppies/cockapoo/` #5.2, `/puppies/scottish-terrier/` #4.6,
`/puppies/cavapoo/` #6.5. The breed silo is performing. Twenty-nine pages carry impressions.

**Where it does not**: the homepage sits at #21.3 despite the most impressions of any page (1,826).
The head terms are the only thing it is losing, and they are the terms most gated by authority.

---

## Gate results

| Gate | Status | Evidence |
|---|---|---|
| 0 — Evidence | PASS | Live pack + top-15 organic pulled for the head term [SERP] |
| 1 — Eligibility | PASS | apex resolves, HTTPS 200, 29+ URLs indexed and serving impressions [CRAWL][GSC] |
| 2 — Mapping | PASS | `/` is both the intended and the Google-selected page for head terms. No cannibalisation signal — breed pages own their own distinct terms cleanly [GSC][SRC] |
| 3 — Relevance | UNKNOWN | Not assessable as a blocker while Gate 6 is binding; homepage holds #21 on head-adjacent terms, which is above what 2 followed RDs normally buys — on-page is likely already above weight |
| 4 — Experience | UNKNOWN | Not run this pass (no Lighthouse call made) |
| 5 — Site quality | PASS (carried forward) | Near-duplicate concentration resolved 2026-08-27; most-repeated quoted block now 3 pages, was 45 [SRC audits/review-authenticity-2026-08-27.md] |
| 6 — Authority | **FAIL — binding** | See below [BACKLINKS] |

### Gate 6 detail — the whole answer

Referring domains, live pull 2026-09-06 [BACKLINKS]:

| domain | referring domains | nofollow | ~followed | rank |
|---|---|---|---|---|
| **curioustails.sg** | **5** | **3** | **~2** | 79 |
| cottonpups.com (pack #1) | 43 | 14 | ~29 | 3 |
| thelovelypets.com (pack #2) | 178 | 40 | ~138 | 203 |
| prettypetskennel.com (pack #3) | 221 | 172 | ~49 | 141 |
| thepuplife.sg | 55 | 21 | ~34 | 104 |
| pawspals.com.sg | 39 | 11 | ~28 | 52 |
| abpuppies.com (Puppies By Aylabella) | 13 | — | ~13 | 292 |

Top-3 median referring domains: **178**. Curious Tails: **5**. Ratio **~36x**, far past the 5x
threshold at which the cascade returns CAPPED rather than CONTENDER.

Note the last row. Puppies By Aylabella — the profile that prompted this audit — has 13 referring
domains and a rank of 292, against Curious Tails' 5 and 79. Even the "new shop with fewer reviews"
has roughly 2.6x the referring domains and 3.7x the rank score.

---

## GBP audit

Live listing data [SERP/business-listings, 2026-09-06 pull]:

| field | Curious Tails | Cotton Pups | The Lovely Pets | Pretty Pets Kennel |
|---|---|---|---|---|
| primary category | Pet Shop | — | **Dog breeder** | — |
| photos | **14** | — | **171** | — |
| reviews | 5.0 (56 in DFS snapshot; owner reports ~60) | 5.0 (86) | 4.5 (237) | 4.9 (393) |
| services listed | **0** | — | **25** | — |
| attributes | full | — | sparse | — |
| hours / description / license | complete | — | complete | — |

**PASS**: claimed, correct address matching the AVS licence address, three categories, full attribute
set, hours, a description carrying licence number AS24J00046, website linked, phone present, no
duplicate listing within 3km (swept).

**Three real gaps, in order of size:**

1. **Photos: 14 vs 171 and 117.** The single largest completeness gap. Photo volume and recency are
   an activity signal, and 14 is low enough to read as dormant.
2. **Zero services/products listed.** The Lovely Pets lists 25 services across two categories.
   Each is an additional relevance surface for pack queries. This is free and unused.
3. **Primary category is Pet Shop.** The pack #2 holder uses Dog breeder as primary. Worth testing,
   though note it is a test, not a certainty — Cotton Pups holds #1 and its primary is not
   Dog breeder either.

Note one profile field that is not a gap: your phone. GBP shows **9792 1567**; project-config says
**8220 6408** [SRC]. NAP inconsistency across your own records is worth reconciling.

---

## Hypothesis B — review-quality suppression: RULED OUT as fabrication, but with one real finding

The prior audit already settled the fabrication question against the source [SRC
`audits/review-authenticity-2026-08-27.md`]. All 56 reviews were pulled from Google via the
DataForSEO Business Data API and checked. **The reviewers are real people and the text is real.**
No basis to claim fake reviews, and I withdraw the framing I used before that check.

**But the prior audit flagged something that is still open and is directly relevant here.**
Twenty-five sentences appear verbatim under more than one *real* reviewer name on Google itself.
One sentence — "We loved the aftercare support; you can tell they truly care about the pups and the
owners" — was posted by five separate reviewers.

Real people do not independently write the same sentence five times. The pattern that produces this
is customers being handed suggested wording. That is not fake reviews, and it is not the same
offence, but it is the pattern Google's review classifier is built to detect, and text near-duplication
across reviewers is one of its stronger inputs. If those reviews are discounted, you get the exact
symptom in question: 60 real reviews that do not buy the prominence 60 reviews should buy.

I cannot measure from outside whether the discount is being applied — Google does not expose that.
So this stays a **hypothesis with a specific, checkable cause**, not a finding. What settles it is
the owner's answer to one question: were customers given a template, sample text, or suggested
wording when asked for a review?

Either way, the remedy is the same and is not optional: stop supplying wording, and let the next
hundred reviews be in the customers' own words.

---

## Fix queue — ordered by expected rank impact

| # | gate | action | file / surface | skill |
|---|---|---|---|---|
| 1 | 6 | Referring domains 5 → 30+. This is the only work that raises the head-term ceiling. Existing `BACKLINK_PLAN.md` and the guest-post pipeline are the vehicle | off-site | owner + outreach skills |
| 2 | GBP | Photos 14 → 60+, then weekly. Highest-value profile action | GBP | `local-seo-gbp-posts` |
| 3 | GBP | Populate services/products — one entry per breed in SILO_ITEMS plus delivery, starter kit, training | GBP | owner |
| 4 | reviews | Stop supplying suggested wording; ask every buyer, spread over time, push for text + photos | process | owner |
| 5 | 3 | Homepage sits #21.3 on 1,826 impressions — the weakest ratio on the site. Worth a brief-led rewrite *after* Gate 6 moves, not before | `src/pages/index.astro` | `page-brief` → `content-writer` |
| 6 | GBP | Reconcile phone: GBP 9792 1567 vs config 8220 6408 | GBP + `config/project-config.md` | owner |
| 7 | 4 | Run Lighthouse — not measured this pass, currently UNKNOWN | — | `seo-audit-and-fix` |

Gate 6 produces no on-page fix item by design. It is a ceiling, not an action.

## What NOT to do

- **Do not chase "puppies for sale singapore" on-page.** At a 36x referring-domain gap it is not
  winnable on-page, at any content quality. The blueprint row for `/` should carry
  `retarget:` guidance rather than more homepage rewrites.
- **Do not seed 4-star reviews.** Manufacturing a distribution is the same class of manipulation as
  the wording templates, and does not address provenance signals.
- **Do not treat the breed silo as underperforming.** It is the part that works.
