# Curious Tails SEO Action Plan
**curioustails.sg** | Synthesized from 01-keyword-map, 02-technical-audit, 03-performance-snapshot
**Date:** 2026-07-11

---

## Where we stand (one paragraph)

The site is technically excellent (SEO 100/100, performance 93–98, full schema coverage) but organically invisible: 39 ranked keywords vs 300–431 for competitors, $25.63/month ETV vs $2,661–$8,144, zero top-10 positions, and <5 backlinks. The constraint is **content depth + authority**, not the platform. Head-term volume is shrinking 12–35% YoY while long-tail/niche queries are stable — so the roadmap prioritizes long-tail and striking-distance keywords first, head terms last.

## The one strategic correction

Report 01 recommends leading with Cavapoo/Maltipoo. Report 03 shows the site's *actual* rankings cluster around **Golden Retriever (pos 20–31)** and **Corgi (pos 43–44)** keywords, plus "puppy for sale" at #20. Keywords at positions 11–30 are the cheapest wins in SEO — they need content deepening and internal links, not new authority. So Phase 1 attacks striking-distance keywords *in parallel with* the KD<15 quick wins, and Cavapoo/Maltipoo become the Phase 2 authority play.

---

## Phase 0 — Foundations (this week, ~1 day total)

Blocking items that make everything else measurable and slightly faster.

| # | Action | Source | Effort |
|---|--------|--------|--------|
| 0.1 | **Configure GA4 conversion events** — WhatsApp clicks, tel: clicks, contact form submits. Without this, no phase can prove ROI. | 03 §7 | 1–2 h |
| 0.2 | **Tier-1 technical fixes:** WebP + srcset + lazy-load on flagged images; defer gtag.js; trim unused BaseLayout.astro JS; Cloudflare cache rule for email-decode script. | 02 Tier 1 | 3–5 h |
| 0.3 | **Fix Cavapoo page CLS (0.135 → <0.1)** — reserve space for dynamically sized elements. | 02 §2 | 1–2 h |
| 0.4 | **Set up rank tracking baseline** for ~50 target keywords (DataForSEO), so Phase 1/2 movement is visible. | 01 §12 | 1 h |
| 0.5 | Optional: run the remaining seo-team waves (04-geo-audit, then 05/06/07, then client report) to complete the pipeline. | Team charter | — |

## Phase 1 — Striking distance + quick wins (Months 1–3)

**Goal:** 5–10 keywords in top 10, 200–500 organic visits/month, 5–10 leads/month.

**Track A — Striking-distance pushes (existing pages, fastest ROI):**
1. **Golden Retriever page** — deepen content (price, temperament, HDB-alternative framing), add internal links from homepage/pricing/blog. Targets 5 keywords already at pos 20–43.
2. **Corgi page** — same treatment; the uncommitted `corgi-hdb-rules.astro` blog post supports this cluster — publish it and interlink.
3. **Homepage/pricing internal linking audit** — "puppy for sale" sits at #20; strengthen internal anchors pointing at the pages that rank.

**Track B — New KD<15 pages** (each goes through `page-brief` first, per the brief-first pipeline):
4. Free Puppy Training Singapore (KD 10, 880/mo, 70% ranking probability)
5. HDB Approved Dog Breeds hub (differentiator competitors don't own)
6. Free Puppy Delivery Singapore (KD <8, 80% probability)
7. First-Time Puppy Owner guide (KD 8–10, 75% probability)

**Track C — Long-tail FAQ sprint:** 20–30 pages/posts at 300–500 words each targeting the §8 underserved keywords (AVS licensed breeder, puppy starter kit, microchip, health guarantee, free boarding…). **Feed these into the existing daily blog automation queue** (`scripts/blogs_queue.json`) so publishing is hands-off — but each still gets a brief.

**Track D — Backlink outreach starts now** (longest lead time): Singapore dog blogs, HDB/first-time-owner communities, local pet directories. Target 20–30 links by Month 3.

## Phase 2 — Breed authority (Months 4–8)

**Goal:** top 5 for Cavapoo/Maltipoo/Cockapoo/Bichon Frise; 1,500–3,000 visits/month; 20–30 leads/month.

1. Upgrade Cavapoo + Maltipoo pages into full pillar hubs (guide + price + HDB + temperament + breeder credentials), each targeting 3–5 long-tail variants.
2. Build Cockapoo and Bichon Frise as lower-competition breed hubs.
3. "Puppy Pricing Singapore: Complete Cost Breakdown" — leverages the per-breed pricing table already shipped.
4. Continue backlinks: 20+ referring domains from Singapore publications.

## Phase 3 — Head terms (Months 9–12)

Only after DA has grown: differentiated "Puppy for Sale Singapore" hub (AVS + free training + all-in pricing angle), comparison guides (Cavapoo vs Maltipoo, small HDB breeds), testimonial/case-study content for E-E-A-T. Target: top 20 for "puppy for sale singapore", 3,000–5,000 visits/month, 50–100 leads/month.

---

## Success checkpoints

| When | Check | Target |
|------|-------|--------|
| Week 2 | Lighthouse re-run | Perf 99/100, image delivery 85+, unused JS 90+ |
| Month 1 | GA4 events firing | Conversion data flowing |
| Month 3 | Rank tracker | 5+ keywords top 10 (KD<15 set); GR/Corgi keywords moved 10+ positions |
| Month 6 | DataForSEO domain snapshot | 150+ keywords ranked, $500+ ETV (report 03's stated goal) |
| Month 8 | Breed keywords | Cavapoo/Maltipoo top 5–10 |

## Standing rules for all content work

- Every page/post runs through `page-brief` before writing (owner rule, 2026-07-09).
- Breed page titles: "{Breed} Puppy for Sale Singapore | Curious Tails".
- Pricing copy: per-breed via `src/data/pricing.ts`; site-wide says "From $3,288, all-in".
- Nothing publishes without human approval (team charter rule 2).
