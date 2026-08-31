# Cross-Domain Linking Plan — Curious Tails Portfolio

> ## CORRECTIONS, 2026-08-31 — read before executing any part of this plan
>
> The plan below was written 2026-08-10 and is sound in structure. Four factual premises have
> since been checked against live data and three of them are wrong. Evidence:
> `audits/portfolio-spoke-audit-2026-08-31.md`.
>
> **1. cavapoo.sg is NOT in this portfolio.** It belongs to Furgive You Pte Ltd, is hosted on
> Netlify, and is absent from the owner's 33 Cloudflare zones. The owned cavapoo domain is
> **cavapoopuppy.sg**. Any consolidation that redirects an owned domain into cavapoo.sg would
> hand a competitor the traffic. The table below already names cavapoopuppy.sg correctly —
> keep it that way, and treat cavapoo.sg as a competitor everywhere it appears.
>
> **2. §4a is already shipped.** Eleven spokes each already carry exactly one link to
> curioustails.sg. The "zero cross-domain links exist" reading came from grepping the Curious
> Tails repo, which cannot see links that live in the spokes' own codebases. What remains is the
> hub → spoke direction (§4b) and the entity schema (§3a).
>
> **3. The hub URLs in §2 are stale.** Curious Tails breed pages live at `/puppies/<breed>/`,
> not `/corgi-puppies-singapore/`. Anything executed against the old paths lands on a redirect
> at best.
>
> **4. Two named domains cannot currently hold the roles assigned to them.**
> `pomeranian.sg` serves a registrar expired-parking DNS template (A 127.0.0.1, MX localhost,
> TXT "expired") with no Pages project and a one-commit scaffold repo — it is an unbuilt site.
> `wgpetfarm.com` is a 207-word shell whose H1 is a person's name; it is listed as a T1 sister
> retail brand and is not currently a site that can carry that role. `puppysg.com` is 343 words
> with no H1.
>
> **One thing the plan gets right and should not be softened:** §2's rule that keyword territory
> is settled before any link is placed. Today's SERP shows why — on "cavapoo singapore",
> puppysingapore.com (#9), curioustails.sg (#13) and cavapoopuppy.sg (#28) are all below a single
> competitor page at #1.
>
> **One sentence in §2b to retire:** puppysingapore.com must stay transactional. It holds #5 on
> "puppy for sale singapore" (1,000/mo) and carries roughly 84% of portfolio clicks
> (2,743/mo of 3,255). Demoting it to an "informational / price-index" role is the most dangerous
> stale instruction in this document.


**Date:** 2026-08-10
**Scope:** 13 domains
**Model:** Hub-and-spoke with a disclosed entity layer. No mesh, no footer blocks.
**Total cross-domain links at full rollout:** 29 (hard cap 32)

---

## 1. Roles

Every domain gets exactly one role. Role determines what it links to and what may link to it.

| Tier | Domain | Role | Links out (cross-domain) | Links in (cross-domain) |
|---|---|---|---|---|
| **Hub** | curioustails.sg | Entity hub. Brand, AVS licence AS24J00046, physical shop, live inventory. | 12 | 12 |
| **T1** | wgpetfarm.com | Sister retail brand (second shop). | 1 | 1 |
| **T1** | puppysingapore.com | Legacy WP property, in recovery. Informational / price-index. | 1 | 1 |
| **T2** | corgi.sg | Breed spoke — Corgi | 1 + 2 whitelisted | 1 |
| **T2** | cavapoopuppy.sg | Breed spoke — Cavapoo | 1 + 1 whitelisted | 1 |
| **T2** | maltipoo.sg | Breed spoke — Maltipoo | 1 + 2 whitelisted | 1 |
| **T2** | maltese.sg | Breed spoke — Maltese | 1 | 2 |
| **T2** | poodle.sg | Breed spoke — Poodle | 1 | 3 |
| **T2** | dachshund.sg | Breed spoke — Dachshund | 1 | 2 |
| **T2** | bichon.sg | Breed spoke — Bichon Frise | 1 | 1 |
| **T2** | shihtzu.sg | Breed spoke — Shih Tzu | 1 | 1 |
| **T2** | chihuahua.sg | Breed spoke — Chihuahua | 1 | 1 |
| **T2** | pomeranian.sg | Breed spoke — Pomeranian | 1 | 2 |

**Not in this plan but in the same GSC account** — shibainu.sg, puppysg.com. They inherit the T2 spoke rules verbatim when they go live. Counting them takes the network to 15 domains; the cap rises to 36.

**Hard rule:** spokes link to the hub only. A spoke never links to wgpetfarm.com or puppysingapore.com. Those two are hub-adjacent, not part of the breed network.

---

## 2. Prerequisite: settle keyword territory first

**Do not place a single cross-domain link until section 2 is resolved.** Linking two pages that compete for the same query makes the cannibalisation worse, not better.

### 2a. Hub breed pages vs. breed spokes — the real conflict

`curioustails.sg/corgi-puppies-singapore/` currently targets **"corgi puppy for sale singapore"** (per the breed-page keyword standard). `corgi.sg` wants the same family of terms. Same for all ten.

**Default split (recommended):**

| Query shape | Owner | Rationale |
|---|---|---|
| `{breed}`, `{breed} singapore`, `{breed} puppy`, `{breed} price singapore`, `{breed} hdb approved`, `{breed} temperament / grooming / lifespan` | **Breed spoke** | Exact-match .sg domain + full-site topical focus wins bare and informational head terms over an inner page. |
| `{breed} puppy for sale singapore`, `buy {breed} puppy singapore`, `{breed} puppy price singapore`, `{breed} breeder singapore` | **Hub** | Transactional intent needs live inventory, licence, address, reviews — all of which sit on the hub. |
| `puppy shop singapore`, `pet shop balestier`, brand terms, all non-breed commercial | **Hub** | Uncontested. |

**Override rule:** for each breed, pull last-90-day GSC data for both URLs on the contested query. Whichever already ranks better keeps it; the loser de-optimises (drop it from title/H1, keep it as body prose only). Do not force the default split against live data.

### 2b. puppysingapore.com vs. curioustails.sg — decide before Phase 3

Generic domain vs. brand domain both chasing "puppy for sale singapore" is the largest overlap in the portfolio and it predates this plan.

**Recommendation:** puppysingapore.com becomes the **informational + price-index** property (breed guides, "how much does a {breed} cost in Singapore", HDB rules, first-time owner content). curioustails.sg keeps every transactional and shop term. This also fits the recovery diagnosis — its problem is thin/broken content, not links.

Until that call is made and implemented, puppysingapore.com gets **no** cross-domain links in either direction. A depressed site should not be wired into the network.

### 2c. Comparison pages — one owner per matchup, never reciprocal

Two of your own comparison pages targeting the same SERP is the worst pattern in the portfolio (see §7). Assign each matchup to exactly one domain. The other domain does not build that page at all.

| Matchup | Owner | Loser must not build |
|---|---|---|
| Maltese vs Shih Tzu | maltese.sg | shihtzu.sg |
| Shih Tzu vs Poodle | shihtzu.sg | poodle.sg |
| Cavapoo vs Maltipoo | cavapoopuppy.sg | maltipoo.sg |
| Poodle vs Maltipoo | maltipoo.sg | poodle.sg |
| Bichon vs Maltese | bichon.sg | maltese.sg |
| Pomeranian vs Chihuahua | pomeranian.sg | chihuahua.sg |
| Chihuahua vs Min Pin | chihuahua.sg | — |
| Corgi vs Shiba Inu | corgi.sg | shibainu.sg |
| Dachshund vs Corgi | dachshund.sg | corgi.sg |

The owning page **does not** link to the other breed's domain. Linking your comparison page to the competitor it is beating is self-sabotage.

---

## 3. The entity layer (do this first — zero link risk, highest payoff)

Google already fuses these domains via shared registrant, Cloudflare account, NS records, Pages infra, design system, NAP, AVS licence and GSC account. The goal is not concealment — it is making the relationship legible as one real disclosed business.

Ship all of this **before** any link:

**3a. Schema on every spoke** (`Organization` / `PetStore`):
```json
{
  "@type": "PetStore",
  "@id": "https://corgi.sg/#organization",
  "name": "Corgi.sg",
  "parentOrganization": { "@id": "https://curioustails.sg/#organization" },
  "identifier": { "@type": "PropertyValue", "propertyID": "AVS Pet Shop Licence", "value": "AS24J00046" },
  "address": { "...identical NAP to hub..." },
  "telephone": "+65 8220 6408",
  "sameAs": ["https://curioustails.sg/", "https://www.instagram.com/curioustails.pups/"]
}
```

**3b. Schema on the hub** — add `subOrganization` (or `brand`) array listing all ten spoke `@id`s, plus wgpetfarm.com and puppysingapore.com once §2b resolves.

**3c. Off-site corroboration** (strongest entity signal, no link-scheme exposure at all):
- Same Google Business Profile referenced across all sites; GBP website field stays on curioustails.sg.
- Instagram / Facebook bio and "website" field → curioustails.sg only.
- AVS licensee directory listing name matches the hub's `legalName` exactly.
- ACRA business name consistent everywhere it appears.

**3d. NAP consistency audit** — phone must read **8220 6408** on all 13 domains. Grep for the transposed `8220 6480` before shipping; it has appeared before.

---

## 4. Link inventory — exact placements

### 4a. Spoke → Hub (10 links)

One link per spoke. Not sitewide, not in nav, not repeated inline.

| Source domain | Source page | Anchor text | Placement |
|---|---|---|---|
| corgi.sg | `/about/` | Curious Tails | Body paragraph, "who runs this site" |
| cavapoopuppy.sg | `/about/` | our shop in Balestier | Body paragraph |
| maltipoo.sg | `/about/` | Curious Tails | Body paragraph |
| maltese.sg | `/about/` | the Curious Tails team | Body paragraph |
| poodle.sg | `/visit-us/` | Curious Tails, 2 Balestier Road | Visit-info block |
| dachshund.sg | `/about/` | Curious Tails | Body paragraph |
| bichon.sg | `/about/` | our licensed pet shop, Curious Tails | Body paragraph |
| shihtzu.sg | footer | A Curious Tails brand | Footer disclosure line (link the existing plain text) |
| chihuahua.sg | footer | A Curious Tails brand | Footer disclosure line (link the existing plain text) |
| pomeranian.sg | `/about/` | Curious Tails | Body paragraph |

All target `https://curioustails.sg/` (homepage, trailing slash). All `rel` empty — **follow, no nofollow**. These are honest ownership disclosures; nofollowing them signals you believe they are dirty.

**Anchor distribution:** ~50% bare brand ("Curious Tails"), ~50% descriptive/location variants. **Zero** commercial-keyword anchors. Never "corgi puppies Singapore", never "puppy for sale singapore".

**Surrounding copy must be unique per domain.** Do not deploy one shared component that renders identical HTML on ten sites — that is the fingerprint, and unique copy is better for readers anyway. Example (corgi.sg/about/):

> Corgi.sg is run by Curious Tails, a licensed pet shop at 2 Balestier Road (AVS licence AS24J00046). Every Corgi listed here is a puppy we have physically in our shop — you can come and meet them on weekdays from 12pm.

### 4b. Hub → Spokes (10 links)

Single source page: **`curioustails.sg/our-breed-sites/`** — a real, written page, not a link list.

Requirements for that page:
- 150+ words of genuine intro explaining why each breed has a dedicated site (depth of breed-specific guidance the main shop pages can't carry).
- 40–60 words of unique descriptive copy per spoke, not boilerplate.
- Anchor text = the site/brand name: "Corgi.sg", "Cavapoo Puppy SG", "Maltipoo.sg" etc. **Not** the money keyword.
- Linked from the hub's footer as a single "Our breed sites" entry (one nav link to one page — that is not a footer block).

**Do not** link hub breed money pages → spokes in the initial rollout. `curioustails.sg/corgi-puppies-singapore/` passing a link to corgi.sg pushes topical signal toward the site competing with it. Revisit only after §2a territory is verified in GSC, and then only with a branded anchor inside a "more about the breed" aside.

### 4c. Tier-1 links (4 links, gated on §2b)

| From | Page | To | Anchor |
|---|---|---|---|
| curioustails.sg | `/our-breed-sites/` (separate "Sister brands" section) | wgpetfarm.com | WG Pet Farm |
| wgpetfarm.com | `/about/` | curioustails.sg | Curious Tails |
| curioustails.sg | `/our-breed-sites/` | puppysingapore.com | Puppy Singapore |
| puppysingapore.com | `/about/` | curioustails.sg | Curious Tails |

**Open question — flag before shipping the wgpetfarm pair:** does WG Pet Farm hold its own AVS licence / separate ACRA entity? If yes, the disclosure copy must say "affiliated" or "sister business", **not** imply shared ownership under AS24J00046. A false ownership disclosure is worse than no link. If it is the same entity, treat it as a second location and say so plainly.

### 4d. Spoke → Spoke whitelist (5 links, absolute maximum)

Each requires a full paragraph of genuine editorial reason around it. If you cannot write that paragraph honestly, the link does not go in.

| # | From | Page | To | Editorial reason |
|---|---|---|---|---|
| 1 | corgi.sg | `/can-you-keep-a-corgi-in-hdb/` | dachshund.sg | Pembroke Welsh Corgi is not on the HDB approved list; Miniature Dachshund is. Reader in an HDB flat needs the alternative. |
| 2 | corgi.sg | same page | pomeranian.sg | Second HDB-approved alternative for the same reader. |
| 3 | maltipoo.sg | `/what-is-a-maltipoo/` | maltese.sg | Parent breed — coat and temperament inheritance. |
| 4 | maltipoo.sg | same page | poodle.sg | Second parent breed — same reason. |
| 5 | cavapoopuppy.sg | `/cavapoo-coat-and-grooming/` | poodle.sg | Poodle-side coat genetics determine grooming schedule. |

Anchor text: descriptive breed-info phrasing, e.g. "Miniature Dachshunds, which are HDB approved" or "the Poodle side of the cross". Never "{breed} puppy for sale".

**No further spoke→spoke links.** Network-wide count stays at 5. Do not build a breed-to-breed matrix.

---

## 5. Rollout schedule

| Phase | Weeks | Work | Gate to proceed |
|---|---|---|---|
| **0** | 0–2 | §2 territory decisions + §3 entity layer. Zero links. | GSC data pulled for all 10 contested breed queries; schema live and validating; NAP audit clean. |
| **1** | 2–6 | §4a spoke→hub. 2–3 domains per week. | Hub brand-query impressions stable or up; no spoke ranking loss. |
| **2** | 5–7 | §4b hub `/our-breed-sites/` page + 10 links, shipped as one page. | Page indexed; spokes show referral traffic in GA4. |
| **3** | 8–12 | §4c tier-1 pair for wgpetfarm (once licence question answered). puppysingapore pair only if §2b resolved and its recovery is underway. §4d whitelist links as the host pages get written. | — |
| **4** | Quarterly | Audit: recount links, re-check anchors, confirm no drift. | — |

Phasing is for measurement, not concealment — a staggered rollout is the only way to attribute a ranking change to a specific link set.

---

## 6. Measurement

Baseline these **before Phase 1**, review monthly:

- **GSC per domain:** average position + impressions for the domain's committed head terms (from §2a).
- **GSC hub:** impressions for brand queries ("curious tails", "curious tails balestier", "curious tails singapore").
- **GA4:** referral sessions from each spoke → hub, and hub → each spoke. Near-zero referral traffic on a link means it is not user-useful, which is itself a signal to remove it.
- **Index status:** all 13 domains, watch for coverage drops.

**Kill switch:** if hub brand impressions or aggregate spoke positions fall >20% for two consecutive months after Phase 1, pause the rollout, remove the most recent phase's links, and reassess before continuing.

---

## 7. Never do these

| Anti-pattern | Why |
|---|---|
| Sitewide footer block listing all 13 domains | ~500 pages × 13 sites of non-editorial repeated links. Textbook link network. Highest chance of the whole cluster being devalued. |
| Reciprocal links between competing comparison pages | Two of your own pages fighting one SERP, each boosting the other. Pick one owner per matchup (§2c). |
| Exact-match commercial anchors ("corgi puppies singapore") | Turns a disclosure into a ranking manipulation signal. Brand and descriptive anchors only. |
| `rel="nofollow"` on these links | Signals you consider your own ownership disclosure untrustworthy. Follow links throughout. |
| One shared link component rendering identical HTML across domains | Machine-identical blocks are the footprint. Hand-place with unique surrounding copy. |
| A breed-to-breed link matrix | Even with "good reasons", volume converts editorial into scheme. Cap at 5 (§4d). |
| More than one link per spoke to the hub | Nav + footer + inline to the same target on the same site is over-optimisation. One link. |
| Pointing spokes at puppysingapore.com | Wiring a traffic-depressed site into the network spreads its problem. Fix content first. |
| Adding a new domain to the network before it has real content | An empty spoke linking to the hub is a pure link placement with no editorial cover. |

---

## 8. Immediate next actions

1. **Answer:** does WG Pet Farm hold a separate AVS licence / ACRA entity? (blocks §4c)
2. **Answer:** informational-vs-transactional split between puppysingapore.com and curioustails.sg. (blocks §2b, §4c)
3. **Pull GSC data** for the 10 contested `{breed} puppy for sale singapore` queries across hub breed pages vs. breed spokes, to confirm or override the §2a default split.
4. **Ship the entity layer** (§3) — schema, NAP audit, GBP/social consolidation. No links needed, no risk, starts working immediately.
5. **Then** begin Phase 1.
