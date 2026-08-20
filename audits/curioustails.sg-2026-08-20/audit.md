# Rank Blocker Audit — curioustails.sg
Date: 2026-08-20 · Location: Singapore · Property: `sc-domain:curioustails.sg`
Crawl: 74 pages, uncapped, from local `dist/` + live HTTP. Referring-domain data: DataForSEO.

---

## Verdicts

```
KEYWORD: "puppy for sale singapore"       LOCATION: Singapore
CURRENT:  #36.1 ("puppy for sale"), #36.5 ("singapore puppy for sale")   [GSC 28d]
TARGET URL: /   [SRC keyword-ownership-map, owner decision 2026-07-30]
RANKING URL: /  (correct)   [GSC]
VERDICT:  CONTENDER — Gate 3 (relevance)
BINDING CONSTRAINT: the page type Google rewards for this query is a priced,
  live inventory grid. Organic #1 is onlypaws.sg/puppies/, whose SERP snippet is
  literally a price list ("Maltipoo. $3,288.00 $4,288.00 · Pedigree Toy Poodle...").
  Positions 2-4 are a local pack (Cotton Pups, The Lovely Pets, Dawgs & Co) that
  Curious Tails does not appear in.  [SERP][CRAWL]
  Only 3 organic slots exist above the fold; one of them is puppysingapore.com,
  the owner's own second domain.  [SERP]
CEILING (on-page only): #5-#10 band. Basis: 5 referring domains vs a top-3 organic
  set where the #1 holder needs no authority moat but the local pack does.
  [INFER from GATE-6, GATE-0]
NEXT: Gate 3 fix items 1 and 2, plus the GBP work in item 6 (local pack is 3 of the
  top 4 slots and is not an on-page problem).
```

```
KEYWORD: "cockapoo singapore"              LOCATION: Singapore
CURRENT:  #12.5   [GSC 28d]        TARGET URL: /puppies/cockapoo/   [SRC]
RANKING URL: /puppies/cockapoo/  (correct, page avg #6.6 across its query set)  [GSC]
VERDICT:  CONTENDER — Gate 3 (relevance)
BINDING CONSTRAINT: the page carries zero available Cockapoos. `available: []` in
  src/data/available-puppies.json, feed last synced 2026-07-30 (21 days stale), yet
  the page's Product schema still declares availability = InStock.  [CRAWL][SRC]
  Top-3 are thelovelypets.com/breeds/cockapoo/, woofloof.sg/cockapoo/ and a
  wagatail.sg product page — all lead with live puppies.  [SERP]
CEILING (on-page only): #4-#8. Basis: top-3 referring-domain counts are 168 / 4 / 100
  — woofloof.sg holds #2 on 4 referring domains, so authority is NOT the cap here.
  [INFER from GATE-6]
NEXT: Gate 3 fix items 1, 2, 3.
```

```
KEYWORD: "maltipoo singapore"              LOCATION: Singapore
CURRENT:  #27.5   [GSC 28d]        TARGET URL: /puppies/maltipoo/   [SRC]
RANKING URL: /puppies/maltipoo/  (correct, page avg #18.9)  [GSC]
VERDICT:  CONTENDER — Gate 3 (relevance)
BINDING CONSTRAINT: /puppies/maltipoo/ is the most templated page on the site —
  only 40.7% of its body 8-grams are unique to it; the rest is repeated verbatim
  across the other 47 breed pages.  [CRAWL]
  Organic #1 is a single-puppy product URL (onlypaws.sg/product/maltipoo-11/) with
  10 referring domains, whose snippet reads "AVAILABLE ✓ ... $3288 NETT".  [SERP]
CEILING (on-page only): #4-#8. Basis: the #1 holder has 10 referring domains vs
  Curious Tails' 5 — no meaningful moat.  [INFER from GATE-6]
NEXT: Gate 3 fix items 1, 2, 4.
```

---

## Gate results

| Gate | Status | Evidence |
|---|---|---|
| **0 — Evidence** | PASS | 3 live SERP pulls (Singapore, desktop) captured in `evidence/`. [SERP] |
| **1 — Eligibility** | PASS | robots.txt allows all + names the sitemap index; 74/74 pages carry a canonical; 74/74 render H1, body copy and internal links in raw HTML with no JS. [CRAWL] |
| **2 — Mapping** | PASS | Trailing-slash variants 308 to the canonical form; legacy `/puppies-available/*` and `/puppy-for-sale/*` 301 correctly. GSC still lists slash-less and legacy URLs — those are stale index entries, not live duplicates. Head-term ownership follows the settled map: `/` = puppy for sale singapore, `/puppies/` = dog breeds singapore, `/puppies/{breed}/` = breed terms. No collision found. [CRAWL][GSC][SRC] |
| **3 — Relevance** | **FAIL — binding** | See findings 1-4 below. |
| **4 — Experience** | PASS | Lighthouse on /puppies/maltipoo/: performance 0.95, LCP 1.10s, CLS 0.073, max-potential-FID 23ms, SEO 1.00, best-practices 1.00, accessibility 0.94. [LAB] |
| **5 — Site quality** | RISK | 48 sibling breed pages share ~40-60% of their body text; 34 of them advertise puppies they do not have. Both are site-level quality signals, not page-level. [CRAWL] |
| **6 — Authority** | CAP, not block | curioustails.sg: 5 referring domains (3 nofollow). Competitors: petmaster.com.sg 558, prettypetskennel.com 280, thelovelypets.com 168, wagatail.sg 100, onlypaws.sg 10, woofloof.sg 4. Two pages currently holding top-3 slots do so on 4 and 10 referring domains — authority is a ceiling on the head term, not on the breed terms. [CRAWL] |

---

## Fix queue — ordered by expected rank impact

**1. Inventory feed is 21 days stale and 34 of 48 breed pages show zero available puppies.** `src/data/available-puppies.json` `syncedAt = 2026-07-30`; 27 available puppies across 40 breeds; 34 breeds have `available: []`, and 8 breed pages (beagle, boston-terrier, english-bulldog, japanese-chin, miniature-pinscher, pekingese, scottish-terrier, silky-terrier) are absent from the feed entirely. Every SERP winner examined leads with live, priced, named puppies. [CRAWL][SRC][SERP]
→ Run `npm run sync:puppies`, then gate deploys on feed freshness. *Executes: operations / astro-build.*

**2. Product schema declares `availability: InStock` on all 48 breed pages, including the 34 with no stock.** Verified on bichon-frise, corgi, shiba-inu, maltese — all `https://schema.org/InStock` with an empty `available` array. This is a structured-data claim the page does not support, and it risks rich-result trust. [CRAWL]
→ Derive availability from the feed: `InStock` when `available.length > 0`, otherwise `OutOfStock` (or drop the AggregateOffer and keep the breed as a non-offer Product). *Executes: astro-build.*

**3. `/puppies/cockapoo/` and `/puppies/bichonpoo/` are the two thinnest breed pages** (2,375 and 2,329 words vs a 3,000-3,400 sibling band) while ranking for terms with real demand. [CRAWL][GSC]
→ *Executes: page-brief → content-writer.*

**4. Sibling duplication across the 48 breed pages.** Share of body 8-grams unique to the page: maltipoo 40.7%, maltese 43.9%, bichon-frise 48.2%, goldendoodle 48.5%, labradoodle 48.7%; 28 more sit in the 50-60% band. H2 headings are genuinely breed-specific, so the duplication is in blocks repeated verbatim on all 48: the AVS-licence "buying safely" explainer, free home delivery + setup, the $500+ starter-kit list, "Free Training, Free Boarding and Real Aftercare" (44 pages), "What Curious Tails Owners Say" (42 pages). [CRAWL]
→ Centralise the licence, delivery and starter-kit detail on `/learn/verify-license/`, `/delivery/` and `/starter-kit/`; leave a 1-2 sentence breed-specific summary plus a link on each breed page. Do not auto-rewrite siblings. *Executes: content-writer.*

**5. `{breed} price` queries are under-served.** GSC 28d: "maltipoo price" 27 impressions at #11.1, "bichon frise price" 23 at #17.2, "chihuahua price" 23 at #3.9, "cavapoo price singapore" 10 at #7.8. Every breed SERP's related-searches block leads with "{breed} singapore price". [GSC][SERP]
→ Give each breed page a price answer-capsule in the first fold with the real figure. *Executes: content-writer.*

**6. Not in the local pack for "puppy for sale singapore" — which occupies positions 2, 3 and 4.** Cotton Pups (5.0, 84 reviews), The Lovely Pets (4.5, 237), Dawgs & Co (5.0, 187). Curious Tails has 41 Google reviews at 5.0. [SERP][SRC]
→ Off-page GBP work: category, service areas, photo cadence, review velocity. Not an on-page fix and not something this audit can close.

**Not a fix item:** referring domains. Gate 6 sets a ceiling; it produces no action here.

---

## Honest notes

- Top-3 on **"puppy for sale singapore"** is not realistically winnable on-page alone while three of the four top slots are a local pack. The winnable organic target is #4-#5, and the higher-yield play is the breed and price long-tail where the SERP has no local pack and the incumbents carry 4-10 referring domains.
- `puppysingapore.com` — the owner's own second domain — holds organic #2 for the head term. Any strategy on this term is competing with a portfolio sibling. [SERP]
- No Google core update is named as a cause anywhere in this report; no update data was fetched in this run.

---

## Remediation log — applied 2026-08-20 (post-audit)

| # | Status | What changed |
|---|---|---|
| 1 | **FIXED** | `npm run sync:puppies` re-run. Feed now 28 available pups across 9 breeds (cavapoo 13, maltipoo 6, mini-dachshund 3, bichon-frise / cavachon / cockapoo / french-bulldog / golden-retriever / shih-tzu 1 each), 50 stale photos pruned. |
| 2 | **FIXED** | `src/lib/schema.ts` now derives `Offer.availability` from the live feed via `availabilityFor()`. Verified in `dist/`: 9 breed pages emit `InStock` (exactly the 9 with stock), 39 emit `OutOfStock`; `/puppies/` index matches 9/39. Breed pages absent from the feed resolve to `OutOfStock`, non-breed URLs keep `InStock`. |
| 3 | **FIXED** | Added two breed-specific sections to each thin page — "Is a {Breed} Right for Your Lifestyle?" and "{Breed} Health: What We Check Before You Take One Home" — plus jump links. cockapoo 2,375 → 2,768 words (13 → 15 H2s); bichonpoo 2,329 → 2,755 (12 → 14). Both now in the sibling band. |
| 4 | **PARTIAL** | The AVS-licence block was compressed on all 48 breed pages: the identical 50-word `definition` replaced with a 2-sentence breed-specific version (43 pages had the exact string; 5 carried variants and were left alone), the identical 45-word `bridge` shortened on 25 pages, the shared checklist cut from 3 items to 2 on 44 pages. Depth already lives on `/learn/verify-license/`, which every breed page already links to — no new body links added, so the blueprint link contract is untouched. Shared-run words on `/puppies/maltipoo/` dropped from ~1,500 to 1,377 of 3,068. |
| 5 | **NO CHANGE NEEDED** | Re-checked: all 48/48 breed pages already carry a real price figure in the first fold ("Ours are $3,288 to $5,988…"). The original finding was wrong about the page; the `{breed} price` gap is a ranking gap, not a content hole. |
| 6 | **NOT ACTIONABLE HERE** | Local pack is off-page GBP work. |

### Blocked — needs owner input

**The largest remaining duplication is the review carousel, and it cannot be fixed without more real review text.** The same three Google reviews (YihShy, Michi, Jaden Chua) appear on 42-44 breed pages — ~230 identical words per page, the single biggest shared block left. Only 3 distinct real quotes exist anywhere in the source, against 41 real Google reviews. Transcribing 10-15 more genuine reviews would let each breed page carry a different set and would move the uniqueness ratio more than any other single change. Fabricating or reassigning reviews is not an option, so this stops here.

Uniqueness after the fixes: maltipoo 40.9%, maltese 44.9%, bichon-frise 48.7%, goldendoodle 49.6%, labradoodle 49.8%. Still below the 60% floor — the review block is why.

Full site re-audit after all changes: 74/74 pages one H1, one `<main>`, canonical present, zero missing alt text, zero heading skips, zero glued hyperlinks, zero meta descriptions over 160 chars.
