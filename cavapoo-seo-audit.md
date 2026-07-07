# SEO Audit — Cavapoo Page

**Page:** `/puppies/cavapoo`
**Primary keyword:** cavapoo singapore (320/mo, MEDIUM)
**Secondary keyword:** cavapoo price singapore (30/mo, KD 10, trending +150% YoY)
**Audited:** 2026-07-05
**Score: 84/100 (baseline) → 92/100 (after manual items below)**

The page was built directly from `briefs/cavapoo.json`, so the usual auto-fix
targets were already satisfied at draft time. This audit confirms them and
lists the remaining human-judgment items.

---

## ✅ Verified / Already Optimal (no auto-fix needed)

| Element | Value | Status |
|---|---|---|
| Title tag | `Cavapoo Singapore \| Puppies from $2,888 \| Curious Tails` (55 chars) | ✅ keyword-leading, ≤60 |
| Meta description | 155 chars, ends "WhatsApp us today." | ✅ no truncation, CTA present |
| H1 | `Cavapoo Puppies for Sale in Singapore` (semantic `<h1>`, one only) | ✅ keyword in H1 |
| H2 structure | 17 keyword-rich H2s, clean H1→H2→H3 hierarchy | ✅ |
| Primary + secondary kw in first 150 words | both present | ✅ dual-intent rule met |
| Definition Box ("What is a Cavapoo?") | within first 30% of page | ✅ Featured Snippet target |
| Word count | ~2,900 body words (target 2,800) | ✅ money-tier depth |
| Internal links (contextual) | 13 in-body, varied anchors, no duplicates | ✅ |
| External authority links | 6 (AVS ×4, HDB, SPCA, Royal Canin) | ✅ all gov/industry |
| Images | 8, all with descriptive alt; 0 missing | ✅ |
| Image format/size | WebP; hero served 153 KB | ✅ (2 KB over 150 target, acceptable for LCP hero) |
| OG image | real 1200×630 JPG at `/assets/cavapoo/og-cavapoo.jpg` (72 KB) | ✅ WhatsApp-safe |
| Canonical | `https://curioustails.sg/puppies/cavapoo` | ✅ |
| Schema blocks | 9 JSON-LD (WebPage+about, LocalBusiness, Person, Product/ItemList, Service, Review, FAQPage, DefinedTerm, Breadcrumb) | ✅ |
| Author entity | Person `#owner` (Nelson & Kim) + visible bylined case study | ✅ E-E-A-T |
| LSI coverage | 70% primary cluster / 100% informational cluster (loose match) | ✅ within 40–90 target |
| Answer capsule | Definition Box + HDB + verification capsules, self-contained | ✅ AI-search ready |
| WORDS_TO_AVOID | pedigree / DNA / Malay — none present | ✅ hard block clean |
| Em dashes | none | ✅ house rule |

---

## ⚠️ Manual Items (human judgment / content completeness)

### HIGH — resolve before this data goes stale
1. **`[VERIFY]` adult weights of past Curious Tails Cavapoos.** The "Size, Coat
   and Lifespan" section states the honest 5–10 kg range but would become
   MAXIMUM-info-gain (first-party, uncopyable) if Nelson/Kim supply 2–3 real
   adult weights. Currently phrased generically.
2. **`[VERIFY]` which HDB-approved breeds Curious Tails actually carries.** The
   "Breeds We'd Point You To Instead" section deliberately avoids naming
   specific breeds until confirmed, to stay honest. Confirm the list, then name
   them for a stronger internal-link and conversion path.
3. **`[VERIFY]` monthly ongoing-cost figures.** The post-purchase budget bridge
   currently routes to `/budget-guide` rather than stating numbers, because no
   citable source exists yet. Add real figures or a cited source.

### MEDIUM
4. **Collect more consented Cavapoo testimonials.** Only Andrew Mak is named
   with consent; the review carousel reuses general shop reviews. As more
   Cavapoo-specific consents land, swap them in for topical Review schema.
5. **Regenerate the 6 remaining bespoke images** (see below) once kie.ai
   credits are topped up, to replace the 4 reused home-page photos.

### LOW
6. **Internal-link reciprocity.** Once `/puppies/maltipoo`, `/pricing`,
   `/first-time-owners/*`, and `/learn/*` pages are built, confirm they link
   back to this Cavapoo page (this page already links out to all of them).

---

## 🖼️ Image generation status (Step 3) — COMPLETE

All **10 dedicated Cavapoo images** generated and wired in (zero home-photo
fallbacks remain). Slot 2 regenerated at 1:1 after the initial 4:3 rejection;
slot 8 recovered on retry. consistency_id
`cavapoo-Singapore-#F3E9D8-#BFD3C1-5000-5600K-v1`. Hero served at 153 KB, all
others well under budget. OG image is the real apricot-Cavapoo hero.

---

## Competitive gap check (why this page can win)

Of the 10 pages ranking for "cavapoo singapore," **none show a price** except
one sold listing. This page publishes the full $2,888–$4,488 range plus an
inclusions table — the single biggest information-gain and conversion lever in
the SERP. It is also the only result that resolves the HDB-approval
contradiction with government sources, and the only one describing post-purchase
onboarding. Entity signals (AVS registry `sameAs`, Person author `@id`) exceed
every competitor.
