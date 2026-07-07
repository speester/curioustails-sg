# SEO Audit — /pricing ("puppy pricing Singapore")

**Date:** 2026-07-06 · **Page:** `src/pages/pricing.astro` · **Brief:** `briefs/pricing.json`

## Score

- **Baseline:** 84/100 (page was authored from a full info-gain brief, so it started strong)
- **After auto-fixes:** 91/100

## ✅ Auto-fixed (2)

1. **Title tag trimmed 66 → 59 chars.** `Puppy Pricing Singapore | $2,888 to $4,488 | Curious Tails` — keyword-leading, price hook kept, no truncation risk.
2. **Meta description trimmed 165 → 157 chars + CTA.** Now ends "WhatsApp us." and leads with the secondary keyword question ("How much does a puppy cost in Singapore?").

## Verified healthy (no action)

- **H1** semantic, single, contains "Puppy Pricing in Singapore" (keyword variant) — 7 words.
- **Answer capsule** (DefBox) with the secondary-keyword question sits in the first 30% of the page; 40–55 word self-contained answer (AI Overview / snippet target).
- **Dual-intent placement:** both keywords in the first 150 words; educational sections (market picture, price drivers, first-year budget, decision matrix) ≈ 45% of body.
- **Schema:** LocalBusiness (site @id, priceRange, sameAs incl. AVS registry), Person (Nelson & Kim), WebPage (about + datePublished/Modified), AggregateOffer (2888–4488 SGD, 7 breeds), FAQPage (8 self-contained answers). Validate in Rich Results Test before deploy.
- **Images:** 4 WebP, all ≤71KB, descriptive keyword-aware alts; hero via Astro Image (dimensions emitted); OG image 1200×630 at `/assets/pricing/og-pricing.jpg`.
- **Internal links (11):** starter-kit, free-training, delivery, budget-guide, cavapoo, maltipoo, puppies hub, learn/verify-license, learn/smuggled-puppies, about-us, breed-selector — varied, mid-sentence anchors; none duplicated.
- **External authority links (5):** AVS registry, AVS Pet Ownership Course, ACDT trainer list, Straits Times ($7k fine), Income cost guide (nofollow).
- **E-E-A-T:** visible Nelson & Kim note + Person schema; real consented reviews; first-party policy details (5-day nursing, free boarding).
- **House rules:** no em dashes, no WORDS_TO_AVOID, prices match PRICE_RANGE exactly, review count read from `site.reviews.count` (not hardcoded).
- **LSI coverage:** ~52% of full brief list; ~90% of transactional cluster (target 40–60% / ≥80% — met).

## ⚠️ Recommendations

**HIGH**
1. Several internal links target pages not yet built (delivery, free-training, starter-kit, learn/*, first-time-owners/*). They are all in this production run — verify all resolve in the site-wide link check (task #12) before deploy.

**MEDIUM
2. Once GSC has data, test title variant leading with "How Much" question form against CTR.
3. Add 1 customer-question FAQ from real WhatsApp threads at the 90-day refresh (freshness signal).

**LOW**
4. Consider a small "price checklist" downloadable as a micro-conversion later.
5. Wag a Tail's live range ($3,500–$7,800) appears in the market table as "established big-name shops" — refresh the figure quarterly.

## Keyword analysis

- Primary: "puppy pricing Singapore" — H1, title, DefBox bridge, StatStrip, body. Density healthy, not stuffed.
- Secondary: "how much does a puppy cost in Singapore" — meta, DefBox term (exact-match question heading), FAQ #1.
- Supporting: per-breed price terms in the by-breed table; "cheap/bargain" cluster handled via the risk section (captures 'cheap puppies singapore' searchers without competing on that promise).
