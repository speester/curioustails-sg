# Imported puppies: search demand vs inventory (K-008)

**Date:** 2026-11-08 · **Site:** curioustails.sg · **GSC property:** `sc-domain:curioustails.sg` · **GA4:** property 530833097 (`G-S1WGGDQKQ4`)
**Raw aggregates:** `outputs/imported-puppies/demand-summary-2026-11-08.json`

## Data window: what "12 months" actually means here

- I asked for 12 months (2025-11-06 → 2026-11-06). **GSC's first day of data for this property is 2026-07-06, and GA4's is 2026-07-07.** The site has about four months of history, so every figure below covers **2026-07-06 → 2026-11-06**, the maximum available.
- Roughly 95% of the six breeds' impressions fall in the **last 90 days**, so this is current demand, not a historical tail.
- Site totals for the window: **86,346 impressions · 6,795 clicks · 7.9% CTR · avg position 7.8**.
- Method: GSC `query × page` (7,276 rows, dataState `all`), matched to each breed and its close variants with a regex (for example `westie|west highland|westy`, `sheltie|shetland`, `jack rus|jrt`). GA4 events are by `pagePath`, and sessions and key events are by `landingPage`. I pulled the data with `growth_lib` (the same auth and helpers that `weekly_pull.py` uses). I didn't run `weekly_pull.py` itself, because it only reads 7- and 28-day windows and writes into `research/warroom/`, which is outside this task's write scope.

## Headline

1. **The six missing breeds already bring in 6,749 impressions and 701 clicks: 7.8% of site impressions and 10.3% of site clicks.** None of them has a single local puppy in stock.
2. **These no-stock pages still convert.** They had 1,493 organic landing sessions and **129 key events (8.6%)**, and 137 `whatsapp_click`s, which is **13.6% of all WhatsApp clicks on the site**. People message even when there's nothing to buy, so a reservable listing should lift this further.
3. **Every one of these queries is answered by the right breed page.** No cannibalisation fixes are needed; what the pages lack is inventory.
4. **The biggest stock gap isn't one of the six.** Mini Dachshund (3,768 impressions, 267 clicks, **0 local stock**) and Golden Retriever (2,757 impressions, 0 local stock) outrank most of the six. Irish supply is strongest in exactly these breeds (see the supplier report).

## The six breeds

| Breed | Queries | Impr. | Clicks | CTR | Avg pos | Landing sessions | Key events (WA) | Local stock | AU overseas cards (with photo) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Border Collie | 98 | 2,003 | 185 | 9.2% | 5.0 | 346 | 26 | 0 | 3 (feed last synced 2026-10-02) |
| Chihuahua | 167 | 1,606 | 188 | 11.7% | 7.3 | 406 | 30 | 0 | 1 (stale feed) |
| Westie | 112 | 1,151 | 140 | 12.2% | 7.3 | 279 | 30 | 0 | 0 |
| Jack Russell Terrier | 69 | 699 | 83 | 11.9% | 5.8 | 164 | 17 | 0 | 0 |
| Samoyed | 69 | 664 | 51 | 7.7% | 4.8 | 125 | 8 | 0 | 0 |
| Sheltie | 76 | 626 | 54 | 8.6% | 6.6 | 173 | 18 | 0 | 0 |
| **Total** | 591 | **6,749** | **701** | 10.4% | — | **1,493** | **129** | **0** | 4 |

Local stock comes from `src/data/available-puppies.json` (synced 2026-11-01). Overseas counts come from `src/data/overseas-puppies.json`, which was **last synced 2026-10-02**, so those cards may be stale.

### Top queries and landing pages

Format: query — impressions / clicks / CTR / position → landing page.

**Westie** → `/puppies/westie/` (1,101 of 1,151 impressions; the homepage picks up 38)
- west highland terrier singapore — 135 / 22 / 16.3% / 6.5
- westie singapore — 96 / 12 / 12.5% / 6.8
- west highland white terrier singapore price — 86 / 11 / 12.8% / 6.0
- westie — 86 / 2 / 2.3% / 8.1 (informational head term)
- west highland white terrier for sale — 69 / 14 / 20.3% / 4.1
- westie for sale singapore — 42 / 12 / 28.6% / 6.3

**Border Collie** → `/puppies/border-collie/` (1,775 impressions); HDB questions go to `/first-time-owners/hdb-breeds/` (212)
- border collie — 572 / 5 / 0.9% / 6.6 (head term, mostly informational)
- border collie singapore — 380 / 76 / 20.0% / 3.5
- border collie puppy — 226 / 10 / 4.4% / 4.8
- border collie hdb approved / border collie hdb / are border collies hdb approved — 173 combined / 1 click → hdb-breeds page. The answer is **no**, so this demand is partly informational and can't be turned into flat-dweller sales.
- border collie puppy for sale singapore — 39 / 14 / 35.9% / 3.2

**Chihuahua** → `/puppies/chihuahua/` (1,511 impressions)
- chihuahua singapore — 473 / 92 / 19.5% / 6.5
- chihuahua — 262 / 1 / 0.4% / 10.5
- chihuahua for sale — 164 / 20 / 12.2% / 6.7
- chihuahua for sale singapore — 156 / 27 / 17.3% / 9.5 (a commercial term at position 9.5: worth lifting)
- chihuahua price — 87 / 3 / 3.4% / 3.3

**Sheltie** → `/puppies/sheltie/` (617 impressions)
- sheltie — 129 / 1 / 0.8% / 8.8
- shetland sheepdog singapore — 82 / 11 / 13.4% / 9.9
- sheltie puppy — 81 / 5 / 6.2% / 3.0
- shetland sheepdog for sale — 42 / 6 / 14.3% / 4.6
- shetland sheepdog hdb approved — 37 / 0 (the answer is **yes**: Sheltie is on the HDB list)

**Jack Russell Terrier** → `/puppies/jack-russell-terrier/` (675 impressions)
- jack russell singapore — 140 / 31 / 22.1% / 7.5
- jack russell puppy — 138 / 5 / 3.6% / 4.2
- jack russell — 123 / 1 / 0.8% / 6.0
- jack russell terrier singapore — 70 / 15 / 21.4% / 7.8
- jack russell terrier for sale — 51 / 12 / 23.5% / 3.1

**Samoyed** → `/puppies/samoyed/` (651 impressions)
- samoyed puppy — 170 / 8 / 4.7% / 3.6
- samoyed dog price — 100 / 4 / 4.0% / 3.1
- samoyed singapore — 67 / 8 / 11.9% / 8.6
- samoyed puppy for sale singapore — 26 / 11 / 42.3% / 3.6
- samoyed hdb approved — 25 / 0 (the answer is **no**)

Full top-15 lists per breed are in the JSON file.

## Other out-of-stock breeds with meaningful impressions

Same regex method, breed pages only. All figures are for the window above.

| Breed page | Impr. | Clicks | Avg pos | Local stock | AU cards | Irish supply observed (see supplier report) |
|---|---:|---:|---:|---:|---:|---|
| **Mini Dachshund** | 3,768 | 267 | 6.5 | **0** | 5 | **Very high**: the most common breed in the dogsy and dogquest samples |
| **Golden Retriever** | 2,757 | 86 | 9.3 | **0** | 3 | High |
| Pug | 1,782 | 43 | 7.7 | 0 | 0 | Low |
| Corgi | 1,770 | 66 | 12.2 | 0 | 0 | Low |
| Pomsky | 1,199 | 101 | 5.6 | 0 | 0 | Occasional |
| Siberian Husky | 937 | 42 | 5.6 | 0 | 0 | Occasional, often adults or rehoming |
| Shiba Inu | 642 | 38 | 9.9 | 0 | 0 | Occasional |
| Papillon | 543 | 15 | 9.3 | 0 | 0 | Occasional |
| Chow Chow | 539 | 35 | 6.9 | 0 | 0 | Rare |
| Bichonpoo | 503 | 29 | 3.7 | 0 | 0 | Occasional ("Poochon") |
| French Bulldog | 437 | 21 | 6.5 | 0 | 6 | Common |
| Shih Tzu | 365 | 27 | 8.1 | 0 | 0 | Common |
| Italian Greyhound | 344 | 55 | 7.7 | 0 | 0 | Occasional |
| Pekingese | 291 | 55 | 4.6 | 0 | 0 | Occasional (€3,000 seen) |
| German Shepherd | 236 | 13 | 5.1 | 0 | 1 | Common, but it is an **AVS Specified breed** (extra licence conditions) |

In-stock breeds, for contrast: Toy Poodle (3,791 impressions, 2 local), Cavapoo (2,287, 1 local), Maltipoo (1,773, 1 local), Bichon Frise (1,092, 2 local).

## Conversion events (GA4, 2026-07-07 → 2026-11-06)

| Event | Site total | Six-breed pages |
|---|---:|---:|
| `whatsapp_click` (the primary key event) | 1,004 | 137 (Westie 32, Chihuahua 32, Border Collie 28, JRT 19, Sheltie 18, Samoyed 8) |
| `phone_click` | 3 | 0 |
| `mailto_click` | 13 | — |
| `book_click` | 2 | 0 |
| `details_click` | 36 | 0 (these pages have no puppy cards) |
| form submit | n/a | n/a. There is no form by design (`LEAD_CAPTURE: whatsapp`) |

Page views on the six breed pages: Chihuahua 598, Border Collie 406, Westie 355, Sheltie 258, JRT 227, Samoyed 155. For comparison, the in-stock Cavapoo page had 867 views and 75 WhatsApp clicks.

## Demand vs inventory gap

| Breed | Demand (clicks/4 mo) | WA leads/4 mo | Local stock | Reservable supply today | Irish supply fit |
|---|---:|---:|---:|---|---|
| Chihuahua | 188 | 32 | 0 | 1 stale AU card | **Good** (about 9 new dfsi ads in 30 days, plus dogsy) |
| Border Collie | 185 | 28 | 0 | 3 AU cards (crosses) | **Good** (Irish farm/working supply is plentiful). Not HDB-approved. |
| Westie | 140 | 32 | 0 | none | **Weak** (about 3 ads in 30 days, dfsi only) |
| Jack Russell | 83 | 19 | 0 | none | **Very good** (8 of the latest 72 dogs.ie ads; dfsi 7 in 30 days; dogsy; dogquest) |
| Sheltie | 54 | 18 | 0 | none | **Very weak** (1 ad in 30 days) |
| Samoyed | 51 | 8 | 0 | none | **None observed** in the last 30 days |

**What this means:**
- Ireland can fill **Jack Russell, Chihuahua and Border Collie** reliably.
- It **won't fix Westie, Sheltie or Samoyed**: the breeds exist in Ireland, but too few litters are advertised. Keep the "Contact us for the next litter" CTA on those pages, and treat the existing AU feed (or a UK source; the UK is also an AVS Category A country) as the route for them. See owner decision D9.
- **The best demand-to-supply match from Ireland is Mini Dachshund**, plus Golden Retriever. Both pages have high demand, zero local stock, and the Irish feeds carry these breeds in volume.

## Caveats

- Breed regexes are approximate. "collie" also catches Rough Collie. "poodle" catches Toy, Miniature and Standard.
- Four months of data from a young site. Impressions are still climbing, so treat these as floor figures.
- AU overseas data is a month old. `npm run sync:overseas` runs inside `build:deploy`, so the live site may differ.
