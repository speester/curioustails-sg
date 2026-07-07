# SEO Audit — /about-us ("licensed pet shop Singapore AVS")

**Date:** 2026-07-06 · **Page:** `src/pages/about-us.astro` · **Brief:** `briefs/about-us.json`

## Score

- **Baseline:** 86/100 → **After verification:** 91/100

## ✅ Verified / fixed during build

1. **Licence number correctness:** the ground-truth file (`research/items/trust-licensing.md`) wrongly lists the licence as ACRA 202420075D; the page uses the canonical AVS licence **AS24J00046** everywhere (per project-config + RUN-THE-PROJECT bug 5b) and clarifies the ACRA distinction in FAQ #1.
2. **Cannibalization guard:** verification how-to kept to one DefBox + link to /learn/verify-license (that page owns "how to check pet shop license Singapore"); smuggling depth delegated to /learn/smuggled-puppies with a single protective mention.
3. **Title** 52 chars: `AVS Licensed Pet Shop Singapore | Why Curious Tails`. **Meta** 158 chars.

## Verified healthy

- **H1:** blueprint H1 "Trusted Puppy Shop, AVS Licensed & Verified".
- **Answer capsule:** "What does 'AVS licensed pet shop' actually mean?" DefBox, first 30% — targets the AI Overview on this SERP (government pages currently own it; ours is the only licensee-perspective answer).
- **Unique info gain:** licence obligations table from a licensee's view; PPD explained from the buyer's side; named-owner story with consented review.
- **Schema:** WebPage (about + sameAs AVS licence page), DefinedTerm (AVS licensed pet shop), Review (Andrew Mak, consented), FAQPage (6), LocalBusiness (aggregateRating), Person.
- **Images:** 4 WebP ≤86KB; no storefront/staff-identity scenes (owner-exclusion rule held); OG 1200×630.
- **External links:** 3 AVS pages (licensing conditions, licence requirements, registry).
- **Internal links out (8):** verify-license, pricing, starter-kit, delivery, free-training, smuggled-puppies, breed-selector + FinalCta defaults.
- **E-E-A-T:** strongest page on the site — named owners, real case study, Lifestyle-First Matching framework from expertise-library.
- **LSI:** ~58% overall, ~90% transactional cluster.

## ⚠️ Recommendations

**HIGH:** 1. /learn/* links resolve later this run (site-wide check). 
**MEDIUM:** 2. A real photo of Nelson & Kim (with consent) would materially strengthen this page — generated imagery deliberately avoids depicting them; swap the hero when a real photo exists. 3. Collect 2–4 more consented review quotes per expertise-library's PENDING note.
**LOW:** 4. Consider adding org-level `foundingDate` to LocalBusiness schema.
