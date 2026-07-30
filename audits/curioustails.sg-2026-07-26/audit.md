# Rank Blocker Audit — curioustails.sg

**Run date:** 2026-07-26 · **Location:** Singapore · **Language:** en
**Keywords audited:** 12 · **Pages crawled:** 74 (full `dist/`, uncapped; live sitemap = 72)
**Build audited:** `dist/` at 2026-07-25 17:19 · **Last commit:** 2026-07-21 (`6f31f98`) · **Live sitemap last downloaded by Google:** 2026-07-24 20:37
**Data sources live this run:** SERP ✓ · GSC ✓ · Lighthouse ✓ (desktop) · Backlinks ✓ · GA4 —
**Degraded:**
- `puppy delivery singapore` SERP returned an empty result set (`status: Ok`, zero items). That keyword is **UNKNOWN** end to end and is not audited against remembered competitors.
- Lighthouse returned `formFactor: desktop`; the endpoint exposes no mobile switch. **Mobile lab data is UNKNOWN.** Desktop numbers are reported as desktop.
- No field CWV source is wired. Gate 4.2 is UNKNOWN.
- Gate 1.14 (`*.pages.dev` preview leak) is UNKNOWN — `CLOUDFLARE_PROJECT` is unset in `config/project-config.md`, so the preview host name is not known.

**Paid API calls:** 23 (12 SERP, 1 keyword overview, 1 bulk backlinks, 7 content parsing, 2 Lighthouse). GSC calls are unbilled.

---

## 1. Verdicts

```
KEYWORD: "puppy for sale singapore" + "puppies for sale singapore"   LOCATION: Singapore
         (one keyword — see below)                       VOLUME: 1,000/mo  KD 9-15  [SERP]
CURRENT:  #40.2 (home) / #52.1 (home)  [GSC 28d avg]     TARGET URL: /   [SRC blueprint row 1]
RANKING URL: /  and  http://curioustails.sg/puppy-for-sale/ (legacy, 301s to /puppies/)  [GSC]
SERP SHAPE: local pack holds 3 of the top 4 slots; organic #1 is a 99-word inventory
  listing (onlypaws.sg/puppies/). No AI overview. No PAA.  [SERP]
VERDICT:  BLOCKED — Gate 2 (mapping)
BINDING CONSTRAINT: one keyword, two pages. DataForSEO resolves "puppy for sale singapore"
  to core_keyword "puppies for sale singapore" [SERP]; the two SERPs share 6 of 10 organic
  domains and the identical #1 URL. The homepage <title> is "Puppy for Sale Singapore" and
  /puppies/ is "Puppies for Sale Singapore" [CRAWL], and GSC shows both URLs taking
  impressions on both query strings [GSC]. The blueprint assigns /puppies/ to "our breeds
  Singapore"; the shipped title deviates onto the homepage's committed term [SRC].
CEILING (on-page only): UNSTATED as a ratio — own referring domains = 0, so the top-3
  median ratio is undefined. Reported as absolute counts instead: onlypaws.sg holds
  organic #1 on 10 referring domains, 9 of them nofollow. This SERP is not
  authority-gated.  [INFER from GATE-6]
NEXT: 1 fix in Gate 2, then re-audit before touching content.
```

```
KEYWORD: breed head terms — "cavapoo singapore" (320/mo), "maltipoo singapore" (480),
         "shiba inu singapore" (260), "corgi singapore" (210), "mini dachshund singapore"
         (210), "cockapoo singapore" (90), "bichonpoo singapore" (no data)   [SERP]
CURRENT:  cockapoo #16 [SERP]; all others absent from top 20 [SERP].
          GSC 28d: cavapoo #38.5, cockapoo #35.8, corgi #73.7 (homepage),
          maltipoo / shiba inu / bichonpoo = no impressions.  [GSC]
TARGET URL: /puppies/<breed>/   [SRC blueprint]      RANKING URL: same (no mismatch)  [GSC]
SERP SHAPE: winners are live inventory listings whose H2s are individual, named, priced
  puppies — thelovelypets.com/breeds/cavapoo/ ("Toy Cavapoo M (Rare 4 white feet)",
  "Cavapoo F", "Tiny Cavapoo F"), woofloof.sg/cavapoos/ ("Caramel", "Toffee", "Mocha",
  "Ruby-Reserved", "Current & Upcoming Litters"). AI overview present on 6 of 7.  [SERP]
VERDICT:  CONTENDER — Gate 3 (relevance)
BINDING CONSTRAINT: the availability block — the single element every top-3 result leads
  with — is 321 hardcoded placeholder cards across 48 breed pages, carrying no price, no
  puppy name, and no per-pup identity. Every card reads "WhatsApp for photos & price", and
  the colour-descriptor titles repeat across breeds ("Cream girl" on 13 pages, "Cream boy"
  on 11, "Apricot girl" on 10) [CRAWL][SRC]. Competitors publish the price in the listing
  and Google lifts it into their snippet ("Maltipoo $3,288.00 $4,288.00" — onlypaws.sg #1;
  "LOCALLY BRED CAVAPOO Price$4,600.00" — wagatail.sg #3) [SERP].
CEILING (on-page only): not authority-gated. woofloof.sg holds #1 for "mini dachshund
  singapore" on 4 referring domains; pawrenthood.sg ranks top-3 for "corgi singapore" on
  2. Own = 0. Absolute gap is small.  [INFER from GATE-6]
NEXT: 2 fixes in Gate 3, then re-audit.
```

```
KEYWORD: "puppy price singapore"                    VOLUME: 140/mo  commercial  [SERP]
CURRENT:  #39.5  [GSC 28d avg]                      TARGET URL: /pricing/   [SRC blueprint]
RANKING URL: /pricing/ (no mismatch)  [GSC]
SERP SHAPE: mixed commercial + editorial; #1 wagatail.sg category, #2 income.com.sg
  cost-of-ownership guide, #3 puppysingapore.com. AI overview + PAA present.  [SERP]
VERDICT:  CONTENDER — Gate 3 (relevance)
BINDING CONSTRAINT: the page commits to a phrase nobody searches. The <title> is "Puppy
  Pricing Singapore", matching the blueprint's "puppy pricing Singapore" [CRAWL][SRC];
  DataForSEO returns no volume record for that string, while "puppy price singapore"
  returns 140/mo [SERP]. The page's own asset — a per-breed price table — is the thing
  the SERP rewards, and it is titled away from the query.
CEILING (on-page only): unstated — own referring domains = 0.  [INFER from GATE-6]
NEXT: 1 fix in Gate 3.
```

```
KEYWORD: "puppy home delivery singapore" / "puppy delivery singapore"
CURRENT:  /delivery/ = 33 impressions, 0 clicks, 28d  [GSC]
TARGET URL: /delivery/   [SRC blueprint]
SERP SHAPE: UNKNOWN — the live SERP call returned zero items.  [SERP]
VERDICT:  NOT A VIABLE TARGET — no measured demand
BINDING CONSTRAINT: neither "puppy delivery singapore" nor "puppy home delivery singapore"
  returns a volume record from DataForSEO [SERP], and the SERP pull came back empty. This
  is not a ranking problem; the keyword has no measurable search demand. /delivery/ is a
  1,539-word conversion asset pointed at a query that is not being typed.
CEILING: not applicable.
NEXT: no Gate 1-4 fix. Re-point or accept the page as a conversion asset, not a ranking one.
```

```
KEYWORD: "licensed pet shop singapore"              TARGET URL: /about-us/   [SRC blueprint]
CURRENT:  no impressions on this exact string in 28d  [GSC]
SERP SHAPE: organic #1 and #2 are avs.nparks.gov.sg (the public AVS licence registry and
  the licence-application page); #3 is licensing.gobusiness.gov.sg.  [SERP]
VERDICT:  TOP-3 IS NOT THE RIGHT TARGET
BINDING CONSTRAINT: the top of this SERP is the government licence registry answering a
  regulatory lookup, not a shop looking for customers [SERP]. A pet shop cannot displace
  the national registry for its own licence lookup, and would not want the traffic if it
  could. The blueprint's committed string is "licensed pet shop Singapore AVS", which
  returns no volume record at all [SERP][SRC].
CEILING: not winnable at top-3. The winnable adjacent demand is the buyer-intent
  head cluster and the breed terms above, both already targeted.
NEXT: no fix queued. Recorded so the page is not rewritten against an unwinnable SERP.
```

---

## 2. Fix queue

Ordered by expected rank impact.

| # | Gate | Fix | File / element | Evidence | Target value | Executed by |
|---|---|---|---|---|---|---|
| 1 | 2 | Split the head keyword: keep it on one page only. Re-point `/puppies/` off "Puppies for Sale Singapore" | `src/pages/puppies/index.astro` `<title>`, H1 | `[SERP]` shared `core_keyword`; `[GSC]` both URLs take impressions on both strings | one keyword, one page | `content-writer` |
| 2 | 3 | Put real, named, priced puppies in the availability block, or remove the "Available" tag | `src/pages/puppies/*.astro` availability arrays (48 files, 321 cards) | `[CRAWL][SRC]` 0 of 321 cards carry a price; titles repeat on up to 13 pages | named + priced units, as top-3 | owner + `astro-build` |
| 3 | 3 | Align breed `<title>` with the transactional term the H1 already uses | `src/pages/puppies/*.astro` `<title>` | `[CRAWL]` title = "{Breed} Singapore", H1 = "{Breed} Puppies for Sale in Singapore" | title/H1/query agree | `content-writer` |
| 4 | 3 | Retitle `/pricing/` to the searched form | `src/pages/pricing.astro` `<title>` | `[SERP]` "puppy pricing singapore" no volume record; "puppy price singapore" 140/mo | match the query string | `content-writer` |
| 5 | 3 | Cut breed pages toward the top-3 word band | `src/pages/puppies/*.astro` body | `[CRAWL]` 2,360–3,962 words vs `[SERP]` top-3 band 727–1,360 | inside band | `content-writer` |
| 6 | 2 | Fix the broken internal link `/free-boarding/` → 404 | `src/pages/delivery.astro` | `[CRAWL][SRC]` 1 broken internal link; live 404 confirmed | 0 broken links | `astro-build` |
| 7 | 1 | Point `www.curioustails.sg` at the canonical host (currently 522) | Cloudflare DNS/redirect | `[CRAWL]` `https://www.curioustails.sg/` → 522 | 301 to apex | `launch` |
| 8 | 3 | Add the Pembroke/Cardigan Welsh Corgi entity distinction | `src/pages/puppies/corgi.astro` | `[CRAWL]` absent; present in both top-3 corgi results | entity covered | `content-writer` |
| 9 | 5 | Deploy the built-but-unpublished blog post | `/blog/pet-ownership-course-singapore/` | `[CRAWL]` in `dist/` sitemap, absent from live sitemap | live + in sitemap | `launch` |
| 10 | 3 | Trim meta descriptions over 165 chars (44 pages) | `src/pages/**` | `[CRAWL]` 44 pages 166–223 chars | 140–160 | `seo-audit-and-fix` |
| 11 | 2 | Resolve 4 blueprint keywords assigned to 2 rows each | `research/site-blueprint.csv` | `[SRC]` mini dachshund / toy poodle / golden retriever / french bulldog singapore | one keyword, one row | `local-research` |

### 1 — Head keyword split (Gate 2, veto)

**Measured now:** the homepage `<title>` is `Puppy for Sale Singapore | AVS Licensed | Curious Tails` and `/puppies/` is `Puppies for Sale Singapore | 40+ Breeds | Curious Tails` `[CRAWL]`. DataForSEO returns `core_keyword: "puppies for sale singapore"` for the string "puppy for sale singapore" — they are one keyword, 1,000/mo `[SERP]`. The two SERPs share 6 of 10 organic domains and the identical #1 URL (`onlypaws.sg/puppies/`). GSC confirms the split is live: on "puppy for sale singapore" the homepage takes 5 impressions at #40.2 and the legacy `http://curioustails.sg/puppy-for-sale/` takes 2 at #67.5; on "puppies for sale singapore" it is 7 impressions at #52.1 and 3 at #79.7 `[GSC]`.

**What the top-3 do instead:** each competitor points exactly one URL at this term — `onlypaws.sg/puppies/`, `thelovelypets.com/puppies/`, `wagatail.sg/`.

**Done looks like:** the head term appears in exactly one `<title>` and one H1 across `dist/`. The blueprint already assigns `/puppies/` to "our breeds Singapore" — the shipped page deviated from that. Restoring the blueprint's own mapping resolves it.

### 2 — Real inventory in the availability block (Gate 3, the headline)

**Measured now:** 48 breed pages carry 321 cards tagged `Available`, 6 or 9 per page, hardcoded in the `.astro` sources `[SRC]`. Every one reads `meta: 'WhatsApp for photos & price'` — zero cards carry a price `[CRAWL]`. Titles are colour descriptors, not identities, and they repeat across breeds: "Cream girl" on 13 pages, "Cream boy" on 11, "Apricot girl" on 10, "Apricot boy" on 6 `[SRC]`.

**What the top-3 do instead:** `thelovelypets.com/breeds/cavapoo/` (#1, "cavapoo singapore") uses H2s per real unit — "Toy Cavapoo M (Rare 4 white feet)", "Cavapoo F", "Tiny Cavapoo F". `woofloof.sg/cavapoos/` (#3) names each puppy — "Caramel", "Toffee", "Mocha" — and marks state: "Ruby-Reserved", "Recently Reserved", "Current & Upcoming Litters". `onlypaws.sg` (#1, both head terms) publishes the price inline, and Google pulls it straight into the snippet: "Maltipoo $3,288.00 $4,288.00" `[SERP]`.

**Done looks like:** each `Available` card names a real puppy, shows its price, and changes when the puppy is sold. If the cards do not correspond to real, currently-available puppies, the `Available` tag and the `AggregateOffer` `availability: InStock` claim should both come off — see Section 5.

### 3 — Breed title/H1 alignment (Gate 3.4)

**Measured now:** every breed page has a `<title>` of the form "{Breed} Singapore | Price & Puppies | Curious Tails" and an H1 of "{Breed} Puppies for Sale in Singapore" `[CRAWL]`. Those are two different queries. The target phrase from the title appears in **no** H1 and in **no** page's first 150 words, sitewide `[CRAWL]`.

**What the data says:** "corgi singapore" (210/mo) classifies **informational** with foreign intents navigational/commercial; "maltipoo singapore" (480/mo) and "mini dachshund singapore" (210/mo) also **informational**; "cavapoo singapore" (320/mo), "shiba inu singapore" (260/mo) and "cockapoo singapore" (90/mo) classify **navigational** `[SERP]`. None is transactional. The transactional demand sits on the longer form — "corgi puppy for sale singapore" is 140/mo, **transactional** `[SERP]` — which is what the H1 already says.

**Done looks like:** the title, H1 and capsule name the same query. The SERP evidence favours the H1's phrasing for a page that sells; the bare "{Breed} Singapore" term is served by the guide content further down.

### 4 — `/pricing/` retitle (Gate 3.1)

**Measured now:** `<title>` is "Puppy Pricing Singapore | From $3,288 All-In | Curious Tails" `[CRAWL]`, tracking the blueprint's "puppy pricing Singapore" `[SRC]`. DataForSEO holds no volume record for that string; "puppy price singapore" returns 140/mo, commercial intent `[SERP]`. The page sits at #39.5 `[GSC]`.

**What the top-3 do instead:** #2 is `income.com.sg/blog/cost-of-dog-ownership-in-singapore` — an editorial cost breakdown. `/pricing/` already carries 4 tables and a per-breed price guide across 3,786 words; the asset matches the SERP, the title does not.

**Done looks like:** the searched string in the title, H1 and capsule.

### 5 — Word-count band (Gate 3.13)

**Measured now:** breed pages run 2,360–3,962 words of unique body copy `[CRAWL]`. The top-3 band for the breed terms is 727–1,360 `[SERP]`; for the head terms it is **99–435** `[SERP]`. `/puppies/` is 2,229 words against a 99-word #1.

This is the reverse of the usual finding and should not be read as "the content is bad". It means length is not the differentiator in this SERP, and that the pages carry 2–5x the winning band in material that is not earning the position. Trim toward the band by moving guide-depth sections to the `/learn/` and `/first-time-owners/` tiers, which already exist and are the correct home for informational depth.

**Items 6–11** — one line each, see the table above.

---

## 3. Gate results

### Gate 0 — Evidence

| Keyword | Volume | KD | Intent `[SERP]` | Dominant top-3 type | Features | Own pos |
|---|---|---|---|---|---|---|
| puppy for sale singapore | 1,000 | 15 | transactional | inventory listing | local_pack (3 of top 4), related | absent top-20; #40.2 `[GSC]` |
| puppies for sale singapore | 1,000 | 9 | transactional | inventory listing | local_pack (top 3), related | absent top-20; #52.1 `[GSC]` |
| cavapoo singapore | 320 | — | navigational | inventory listing | ai_overview, related | absent; #38.5 `[GSC]` |
| maltipoo singapore | 480 | — | informational | inventory + guide | ai_overview, video, related | absent; no impressions |
| shiba inu singapore | 260 | — | navigational | listing + community | ai_overview, related | absent; no impressions |
| corgi singapore | 210 | — | informational | community + guide | ai_overview, images, PAA, video | absent; #73.7 (home) |
| mini dachshund singapore | 210 | — | informational | inventory + guide | ai_overview, related | absent; #3.0 (1 impression) |
| cockapoo singapore | 90 | — | navigational | inventory listing | ai_overview, images, PAA | **#16** `[SERP]`; #35.8 `[GSC]` |
| bichonpoo singapore | no record | — | — | inventory listing | local_pack, PAA, related | absent; no impressions |
| puppy price singapore | 140 | — | commercial | mixed commercial/editorial | ai_overview, PAA | absent; #39.5 `[GSC]` |
| puppy delivery singapore | no record | — | UNKNOWN | UNKNOWN — empty SERP | UNKNOWN | UNKNOWN |
| licensed pet shop singapore | no record | — | regulatory lookup | government registry | local_pack, related | absent |

**Top-3 anatomy** `[SERP]` + `[CRAWL]`

| URL | Position / term | Words | Heading shape |
|---|---|---|---|
| onlypaws.sg/puppies/ | #1 both head terms | **99** | H2 = one per puppy ("Maltipoo", "Pedigree Toy Poodle"), price inline |
| thelovelypets.com/puppies/ | #2 "puppies for sale sg" | 314 | H1 "Available Puppies"; H2 = one per puppy |
| wagatail.sg/ | #3 "puppy for sale sg" | 435 | "OUR PUPPIES", TESTIMONIALS, MEDIA FEATURES |
| thelovelypets.com/breeds/cavapoo/ | #1 "cavapoo singapore" | 727 | H2 = available Cavapoos + "Breed Characteristics" |
| woofloof.sg/cavapoos/ | #3 "cavapoo singapore" | 1,277 | named puppies, "Reserved" states, "150+ 5 Star Google Reviews", FAQ |
| thelovelypets.com/breeds/corgi/ | #2 "corgi singapore" | 1,360 | "Breed Characteristics", "How To Buy From Us", available Corgis |
| pawrenthood.sg (corgi guide) | #3 "corgi singapore" | 1,190 | editorial: HDB rules, cost reality, Pembroke vs Cardigan, scams |

**Verbatim PAA** `[SERP]` — "corgi singapore": How much does a Corgi cost in Singapore? · Are Corgis allowed in Singapore? · Is Corgi a HDB approved dog? · How much do Corgis normally cost? · Is a Corgi a good pet? · Why is a Corgi so expensive?
"cockapoo singapore": Is getting a cockapoo a good idea? · Is a cockapoo a low maintenance dog? · Why are Cockapoos so expensive? · Do vets recommend Cockapoos? · What are the negatives of a Cockapoo? · Do Cockapoos bark a lot?
"puppy price singapore": What is the price of a normal puppy? · What is the cheapest price for a puppy? · What is the cheapest pet in Singapore? · How much is a normal dog puppy? · Which dog is best under 5000? · Is it expensive to get a puppy?
"bichonpoo singapore": How much does a Bichon Frise cost in Singapore? · What is the personality of a Bichonpoo? · How much does a poodle cost in Singapore? · How big does a bichonpoo get? · Why are bichons so expensive? · Do Bichon Frises bark a lot?
No PAA block on either head term.

**Cluster reality (0.11):** "puppy for sale singapore" and "puppies for sale singapore" share 6 of 10 organic domains and the identical #1 URL, and DataForSEO assigns them one `core_keyword`. **They are one page's job.** `[SERP]`

### Gate 1 — Eligibility

| # | Check | Status | Tag | Measured |
|---|---|---|---|---|
| 1.1 | Live 200 | PASS | CRAWL | all money pages 200 |
| 1.2 | Redirect chain ≤1 hop, host consolidation | **RISK** | CRAWL | apex + http OK (1 hop); **`https://www.curioustails.sg/` → 522**; legacy `http://` URLs take 2 hops |
| 1.3 | Trailing-slash canonical | PASS | CRAWL | `/x` 301s to `/x/` on all 8 sampled; one canonical form served |
| 1.4 | robots.txt | PASS | CRAWL | `Allow: /`, sitemap declared, no asset blocks |
| 1.5 | noindex | PASS | CRAWL | only `/404.html` carries `noindex, nofollow` |
| 1.6 | Canonical self-referential | PASS | CRAWL | 73 of 74 exact; `/404.html` points to `/404/` (noindexed, immaterial) |
| 1.7 | Google-selected canonical == declared | PASS | GSC | `/puppies/` and `/puppies/corgi/` both match |
| 1.8 | Coverage state | PASS | GSC | "Submitted and indexed", both inspected |
| 1.9 | Last crawl after last deploy | PASS | GSC | crawled 2026-07-18 / 07-20; sitemap downloaded 07-24 |
| 1.10 | In sitemap, submitted, readable | PASS | GSC | 72 URLs, 0 errors, 0 warnings |
| 1.11 | Sitemap contains only indexable 200s | PASS | CRAWL | no redirects or 404s in the live sitemap |
| 1.12 | Render dependency | PASS | CRAWL | Googlebot-UA fetch returns 179,218 bytes of server-rendered HTML; H1, canonical and internal links all present in raw source |
| 1.13 | Bot challenge | PASS | CRAWL | Googlebot UA served real HTML |
| 1.14 | `*.pages.dev` leak | **UNKNOWN** | — | `CLOUDFLARE_PROJECT` unset in config; host name unknown |
| 1.15 | 404 returns 404 | PASS | CRAWL | random path → 404 |
| 1.16 | Near-empty 200s | PASS | CRAWL | only `/404.html` under 300 words |
| 1.17 | hreflang | PASS | CRAWL | absent, correct for single-locale |
| 1.18 | Sitewide coverage issues | PASS | GSC | 0 errors, 0 warnings on the submitted sitemap |
| 1.19 | IndexNow key | PASS | SRC | key file present in `public/` |

**No Gate 1 veto fails.** Eligibility is not the blocker.

### Gate 2 — Mapping

| # | Check | Status | Tag | Measured |
|---|---|---|---|---|
| 2.1 | Ranking URL == blueprint URL | PASS | GSC/SRC | head term → `/` (blueprint row 1 = `/`); breed terms → own breed pages |
| 2.2 | Page type matches dominant top-3 type | **RISK** | SERP/SRC | breed pages do carry an availability block, but it is placeholder — see Gate 3 |
| 2.3 | Query intent == page intent | **FAIL** | SERP/SRC | 3 breed terms classify informational, 3 navigational; all 7 breed pages are commercial `[SRC blueprint intent=commercial]` |
| 2.4 | Cannibalisation, GSC | **FAIL** | GSC | 26 queries take impressions on >1 own URL; on the head term, `/` and legacy `/puppy-for-sale/` both rank |
| 2.5 | Cannibalisation, HTML | **FAIL** | CRAWL | each literal string sits in exactly one title, but the two strings are **one keyword** — so the head term occupies two titles |
| 2.6 | One keyword, one blueprint row | **FAIL** | SRC | 4 keywords assigned to 2 rows each: mini dachshund / toy poodle / golden retriever / french bulldog singapore |
| 2.7 | Internal links into target | PASS | CRAWL | `/puppies/` 331 inbound, `/` 215, `/pricing/` 211, `/puppies/cavapoo/` 17 |
| 2.8 | Links are crawlable `<a href>` | PASS | CRAWL | all internal links are real anchors in raw HTML |
| 2.9 | Click depth ≤3 | PASS | CRAWL | max depth 2 across all 73 linked pages |
| 2.10 | Orphans | PASS | CRAWL | only `/404.html` (correct) |
| 2.11 | Anchor cap | PASS | SRC | `config/anchor-registry.json`: 147 anchors, cap 3, **0 over cap** |
| 2.12 | Body link contract | PASS | SRC | link_root/seed/node values intact per blueprint |
| 2.13 | Breadcrumbs | PASS | CRAWL | `BreadcrumbList` on all 72 non-home pages |
| 2.14 | Hub links to every node | PASS | CRAWL | `/puppies/` links all 48 breed pages; receives 331 inbound |
| 2.15 | Slug quality | PASS | CRAWL | short, keyword-bearing, no dates or params |
| 2.16 | Money page in nav without JS | PASS | CRAWL | `/puppies/`, `/pricing/` in server-rendered header |
| 2.17 | Local pack presence | **FAIL** | SERP | local pack fires on both head terms and on "licensed pet shop singapore"; Curious Tails appears in none. Pack winners: The Lovely Pets (4.5, 236 reviews), Wag A Tail (4.7, 578), Wellfond (4.5, 239), Pretty Pets Kennel (4.9, 368) |
| 2.18 | Missing page type | PASS | SERP | no top-3 page type absent from the site |

### Gate 3 — Relevance

| # | Check | Status | Tag | Own | Top-3 |
|---|---|---|---|---|---|
| 3.1 | Title, front-loaded, ≤60, unique | PASS | CRAWL | 74/74 unique; 45–74 chars; 2 over 60 | — |
| 3.2 | Meta description 140–160 | **RISK** | CRAWL | 44 pages 166–223 chars | winners lead with price figures |
| 3.3 | One H1 with target phrase | **FAIL** | CRAWL | 74/74 have exactly one H1, but the title's target phrase appears in **0** H1s | phrase in H1 |
| 3.4 | Title / H1 / capsule agree | **FAIL** | CRAWL | title "{Breed} Singapore" vs H1 "{Breed} Puppies for Sale in Singapore" | agree |
| 3.5/3.6 | H2s cover top-3 subtopics + PAA | PASS | CRAWL | corgi page covers HDB, price, temperament, shedding; PAA questions answered | — |
| 3.8 | Answer capsule in first 30% | PASS | CRAWL | present with figures ("from $3,288 all-in", "41 five-star reviews") | — |
| 3.11 | Format matches winners | **FAIL** | CRAWL/SERP | availability cards without prices | priced, named units |
| 3.12 | Term/entity delta | **RISK** | CRAWL/SERP | see table below — small, and mostly inventory vocabulary | — |
| 3.13 | Word count vs band | **FAIL** | CRAWL/SERP | breed 2,360–3,962; `/puppies/` 2,229 | breed 727–1,360; head **99–435** |
| 3.14 | Information gain | PASS | SRC | AVS licence AS24J00046, Balestier address, per-breed prices, named owners, real reviews — all traceable to `config/business-context.md` and `config/expertise-library.md` | — |
| 3.15 | Query-phrase placement | **FAIL** | CRAWL | title only; absent from H1, capsule, first 150 words | all five slots |
| 3.20/3.21 | Sibling duplication | **FAIL** | CRAWL | 44 of 74 pages below 0.60 unique; worst `/puppies/maltipoo/` 0.307, `/puppies/maltese/` 0.365. Pairwise: maltese↔maltipoo 0.593, goldendoodle↔labradoodle 0.560 | — |
| 3.22 | Keyword absent from siblings | PASS | CRAWL | no breed's target phrase appears in a sibling's title/H1/first-150 |
| 3.23 | Named author with bio | PASS | CRAWL/SRC | Nelson and Kim named as owners, `/about-us/` present |
| 3.25 | Real business identity on-page | PASS | CRAWL | AVS AS24J00046, 2 Balestier Road, phone 8220 6408 |
| 3.26 | Original photography | **OWNER VERIFY** | CRAWL | 19 images on the Cavapoo page, all with alt text; provenance not determinable from source |
| 3.27 | Testimonial provenance | PASS | SRC | Andrew Mak review recorded in `config/expertise-library.md` with `Consent: yes — Google review, published by name` |
| 3.28/3.29 | Freshness | PASS | CRAWL | "(July 2026)" in breed titles/descriptions; competitor pages mostly undated |
| 3.30–3.33 | Schema | PASS | CRAWL/GSC | GSC rich results verdict PASS, 0 issues, detecting Product snippets, Merchant listings, Breadcrumbs, Review snippets. JSON-LD parses on all 74. The `Offer price: "0"` is the genuinely free delivery Service — correct, not a defect |
| 3.34–3.36 | Media | PASS | CRAWL | 0 missing alt attributes sitewide; hero images not lazy-loaded |
| 3.37 | Prose runs | PASS | CRAWL | sections carry varied treatments |
| 3.39 | `WORDS_TO_AVOID` | PASS | CRAWL | 0 true hits. "pedigree" 0, "DNA" 0. One substring match on "Malay" inside "Malaysia" (`/learn/smuggled-puppies/`, describing the smuggling route) — legitimate, not a violation |
| 3.40 | AI-scaffold signatures | PASS | CRAWL | 0 `<!-- Section -->` comments in shipped HTML |

**Term/entity delta — terms in ≥2 of the top-3 and absent from the target page** `[SERP][CRAWL]`

| Group | Missing unigrams | Missing bigrams |
|---|---|---|
| head term → `/puppies/` | available, breeders, breeding, parents, dogs, open, opening, welcome, australia, cat, tail, special, showing, results, natural, produce, happy, contact | **puppies available**, showing results |
| cavapoo → `/puppies/cavapoo/` | bred, breeding, ethical, friendly, fur, popular, regular, seniors, tiny, white, people, many, different, close, due, found, looks, needed, possible, completely | **available puppies**, children pets, children seniors, dog owners, first-time dog, friendly temperament, regular grooming |
| corgi → `/puppies/corgi/` | **pembrokes**, **welsh**, **docking**, breeder, breeders, adoption, reserved, license, groomer, indoor, walking, weekly, treats, prevention, lifestyle, companion, famous, favourite, bigger, active | **pembroke welsh**, **cardigan welsh**, weekly brushing, daily walks, make sure, get free |

The delta is small — which is itself the finding. The pages are not under-covered; they are missing **inventory vocabulary** ("available puppies", "reserved", "breeder") and, on the Corgi page, the **Pembroke / Cardigan Welsh Corgi** entity distinction that both top-3 results carry.

### Gate 4 — Experience

Desktop lab only. Mobile is UNKNOWN.

| # | Check | Status | Tag | Own | Competitor #1 |
|---|---|---|---|---|---|
| 4.1 | Performance / LCP / CLS | PASS | LAB | perf **0.97**, LCP **974ms**, CLS **0.073**, TBT-proxy 28ms | onlypaws.sg: perf **0.82**, LCP **2,091ms**, CLS 0.001 |
| 4.2 | Field CWV | UNKNOWN | — | no field source wired | — |
| 4.3 | LCP element not lazy | PASS | CRAWL | first image on every money page is not lazy-loaded | — |
| 4.7 | Page weight | PASS | LAB | 593 KB | onlypaws.sg 1,956 KB |
| 4.11 | HTTPS, no mixed content | PASS | CRAWL | valid, `x-content-type-options: nosniff` | — |
| 4.12 | TTFB / cache | PASS | LAB | server-response 137ms, `cf-cache-status: DYNAMIC` | onlypaws.sg 352ms |
| 4.13 | Accessibility | PASS | LAB | 0.94; SEO 1.00; best-practices 1.00 | onlypaws.sg a11y 0.93, SEO 0.92 |
| 4.14 | Hyperlink spacing | PASS | CRAWL | **0** glued-anchor defects across 74 pages |
| 4.15 | Broken internal links | **FAIL** | CRAWL | **1**: `/delivery/` → `/free-boarding/` (live 404) |

Curious Tails beats the organic #1 on every measured technical dimension and is still absent from the top 20. Gate 4 is not the constraint.

### Gate 5 — Site quality

| # | Check | Status | Tag | Measured |
|---|---|---|---|---|
| 5.1 | Cluster coverage gap | **RISK** | SERP | competitors rank on "{breed} price singapore" and "{breed} puppies for sale singapore" variants; 113 outer-tier blueprint rows targeting exactly those are unbuilt |
| 5.2 | Blueprint rows never built | **FAIL** | SRC/CRAWL | **116 of 187 rows have no live page** — 113 outer, 3 core (`/visit-balestier/`, `/free-boarding/`, `/faq/`). `/free-boarding/` is also linked from `/delivery/` and 404s |
| 5.3 | Thin pages | PASS | CRAWL | none under 300 words except `/404.html` |
| 5.4 | Near-duplicate clusters | **FAIL** | CRAWL | 417 sibling pairs at ≥0.35 shingle overlap; top pair maltese↔maltipoo 0.593 |
| 5.5 | Index bloat | PASS | GSC | 72 submitted, 0 errors; legacy URLs all 301 correctly |
| 5.6 | Template sameness | **FAIL** | CRAWL | 44 of 74 pages below 0.60 uniqueness — all breed pages |
| 5.7 | Link graph health | PASS | CRAWL | max depth 2, 1 orphan (404), equity concentrated on `/puppies/` (331) and `/` (215) |
| 5.8 | Trust scaffolding | PASS | CRAWL | About with named owners, Contact with NAP + map, Privacy, licence displayed |
| 5.9 | Entity consistency | PASS | CRAWL/SRC | `Organization`/`PetStore` schema, NAP consistent, phone 8220 6408 correct throughout |
| 5.10 | Brand demand | PASS | GSC | "curious tails" 116 impressions, 26 clicks, #1.8 — real brand demand exists |
| 5.11 | Helpful-content risk | **RISK** | CRAWL | 48 breed pages share a template shell and 321 non-specific inventory cards |
| 5.12 | Trajectory | UNKNOWN | — | not pulled this run |
| 5.13 | GA4 engagement | UNKNOWN | — | not pulled this run |
| 5.14 | GBP vs pack | **FAIL** | SERP | local pack fires on the head terms; Curious Tails absent. Pack holders carry 236–578 reviews; Curious Tails shows 41 on-site |

### Gate 6 — Authority ceiling

**This gate is off-page, produces no fix items, and exists only to make the ceiling honest.**

| Target | Referring domains `[SERP]` |
|---|---|
| **curioustails.sg** | **0** (no record returned) |
| pawrenthood.sg | 2 |
| woofloof.sg | 4 |
| onlypaws.sg | 10 (9 nofollow) |
| thepuplife.sg | 42 |
| tiarapetssg.com | 57 |
| wagatail.sg | 98 |
| petmeplease.sg | 145 |
| thelovelypets.com | 175 |
| puppysingapore.com | 394 |

Page-level referring-domain records returned empty for every URL queried, own and competitor alike, so the per-URL comparison is UNKNOWN.

**No ceiling band is stated as a ratio.** Own referring domains = 0, which makes the top-3 median ratio undefined — the band table cannot be applied honestly. What the absolute numbers do support:

- The **head-term** SERP is not authority-gated at the top: `onlypaws.sg` holds organic #1 for both 1,000/mo head terms on **10 referring domains, 9 of them nofollow** — effectively one followed link.
- The **breed** SERPs are less gated still: `woofloof.sg` is #1 for "mini dachshund singapore" on 4 referring domains; `pawrenthood.sg` is top-3 for "corgi singapore" on 2.
- Two competitors (thelovelypets 175, puppysingapore 394) do hold substantial authority, and those are the ones occupying #1 on the breed terms and #2 on the head term.

So off-page weakness is real but is **not** what is keeping this site out of the top 20 — a domain with 2–10 referring domains is currently winning these SERPs. On-page work is the controllable lever here, and unusually, it is also the decisive one.

---

## 4. Site-wide findings

- **Thin pages:** none. Only `/404.html` (100 words, correctly noindexed).
- **Near-duplicate clusters:** 417 sibling pairs at ≥0.35 overlap. Worst: `/puppies/maltese/`↔`/puppies/maltipoo/` 0.593; `/puppies/goldendoodle/`↔`/puppies/labradoodle/` 0.560; `/puppies/bichon-frise/`↔`/puppies/maltese/` 0.504.
- **Template sameness:** 44 of 74 pages under 0.60 unique body text — every one a breed page.
- **Orphans:** 1 (`/404.html`, correct).
- **Broken links:** 1 — `/delivery/` → `/free-boarding/`, live 404. The blueprint has `/free-boarding/` as an unbuilt core row, so the link was written against a page that was never shipped.
- **Index bloat:** none. Legacy WordPress URLs (`/puppy-for-sale/`, `/puppies-available/medium-breeds/`, `/book-viewing/`, `/about/`, `/locations/`, `/delivery-pickup/`) all 301 correctly to current equivalents. GSC still attributes impressions to some of them, which is normal consolidation lag, not a fault. `http://` legacy URLs take 2 hops.
- **Unbuilt blueprint:** 116 of 187 rows have no live page — 113 outer-tier, 3 core.
- **Undeployed build:** `/blog/pet-ownership-course-singapore/` exists in `dist/` and is absent from the live sitemap. 22 source files are modified but uncommitted, so `dist/` is ahead of production.
- **`www` host:** `https://www.curioustails.sg/` returns 522.
- **Local pack:** fires on both head terms; the business is absent from all of them. This is a separate channel gap from organic and is not addressable by on-page work.

---

## 5. Unknowns and owner verification

**UNKNOWN checks**

| Check | Reason | To resolve |
|---|---|---|
| Gate 0, "puppy delivery singapore" | live SERP returned `status: Ok` with zero items | re-pull; if it repeats, the query has no result set |
| 1.14 preview-host leak | `CLOUDFLARE_PROJECT` unset in `config/project-config.md` | fill the project name, then `curl -sI https://<project>.pages.dev/` |
| 4.1–4.7 mobile lab | Lighthouse endpoint returned `formFactor: desktop` with no mobile switch | run PageSpeed Insights mobile directly |
| 4.2 field CWV | no field-data source wired in this stack | connect CrUX or a RUM source |
| 5.12 domain trajectory | not pulled this run | `dataforseo_labs_google_historical_rank_overview` |
| 5.13 GA4 engagement | not pulled this run | `analytics-mcp run_report`, property 530833097 |
| Gate 6 page-level RD | endpoint returned empty for all URLs, own and competitor | retry `backlinks_bulk_referring_domains` with page targets |

**Facts needing owner verification**

1. **The 321 "Available" puppy cards.** These are hardcoded in 48 `.astro` files, carry no price, use colour descriptors rather than names, and repeat across breeds — "Cream girl" appears on 13 different breed pages. **Do these correspond to real, currently-available puppies?** If they do not, the visible `Available` tag and the `AggregateOffer` `availability: https://schema.org/InStock` claim in the Product schema are both asserting inventory that does not exist. That is a trust and structured-data accuracy problem before it is an SEO one, and it is the single item on this list that should be answered first. GSC currently reports Merchant listings and Product snippets as valid on these pages, so the claim is being read by Google.
2. **Image provenance.** 19 images on the Cavapoo page, 49 on `/puppies/`, all with alt text and none traceable to `config/business-context.md`. Gate 3.26 expects original photography where the topic demands proof. Confirm these are photographs of real Curious Tails puppies rather than generated or stock imagery.
3. **"41 five-star reviews / 5.0 on Google"** appears sitewide and in `AggregateRating`. `config/expertise-library.md` records one review verbatim with consent. Confirm the count and average match the live Google Business Profile at the time of publishing, since `AggregateRating` is being rendered as a review snippet.
4. **"Ask Andrew Mak"** is an H2 on the homepage. Andrew Mak is recorded in `config/expertise-library.md` as a *customer* who left a Google review, not as an expert. Confirm the section is not framing a customer as an advisory voice.

---

## 6. What this audit did not cover

- **Off-page acquisition.** Gate 6 measured the ceiling and deliberately produced no fix items. No link prospecting, outreach, or digital-PR planning is included.
- **Google Business Profile management.** The local pack fires on the head terms and Curious Tails is absent. That is a GBP/proximity/review-volume problem, not an on-page one, and it is likely worth more traffic than several items in the fix queue. It needs `local-seo-gbp-posts` or direct GBP work.
- **Paid search.**
- **AI-surface visibility.** An AI overview fires on 6 of the 12 audited SERPs. Whether Curious Tails is cited in them was not measured.
- **Mobile lab and field performance** — see Unknowns.
- **Conversion-rate work.** WhatsApp CTA behaviour, form completion and enquiry quality were not assessed.
- **The other 8 domains** in the portfolio. `puppysingapore.com` appears as a direct competitor in these SERPs (organic #2 on the head term, #6 on "corgi singapore", 394 referring domains); the strategic question of two owned sites competing for one keyword set is out of scope here.
