# Master Project Workflow — Curious Tails

## Overview

This is the **single source of truth** for building and managing Curious Tails. It covers:
- Initial setup (ONE-TIME)
- Full project stages (0-3 + per-page)
- Page creation workflow (NEW: includes SEO optimization)
- Quality gates and checkpoints
- Golden rules

---

## ONE-TIME SETUP

**Before starting any stage:**

1. **Fill project-config.md** (or run `/business-discovery` to populate it)
   - Business identity, keywords, location, pricing
   - One source of values for the entire site

2. **Install all skills** into `.claude/skills/<skill-name>/SKILL.md`
   - Each skill lives in its own folder (e.g. `.claude/skills/content-writer/SKILL.md`)
   - Configure: DataForSEO, kie.ai API keys in environment

3. **Review supporting docs**
   - `CLAUDE.md` — Development standards and patterns
   - `SCHEMA.md` — Schema markup standards for all pages
   - `SEO_ROADMAP.md` — SEO optimization opportunities
   - `.claude/commands/shared/design-system.md` — Visual design tokens and patterns (the taste rulebook)

---

## PROJECT STAGES

### STAGE 0 — Context & Proof (Business Foundation)

**Objective:** Establish credibility, expertise, and real data before building.

**Skills to run:**
```
/business-discovery  →  business-context.md
                        (Owner background, qualifications, unique value)

/expertise-library   →  expertise-library.md
                        (Case studies, testimonials, proof, credentials)
```

**Deliverable:** Two files with hardened proof points and verifiable claims.

**◆ CHECKPOINT 1: Context Review Gate**
- Does business-context.md answer: Who is this? What do they sell? Why them?
- Does expertise-library.md have: Real case studies? Testimonials with consent? Credentials?
- Action: **Mark testimonial consent** (needed for legal + schema markup)
- If gaps found: Return to skills, fill gaps, re-review
- **PASS → Proceed to STAGE 1**

---

### STAGE 1 — Research & Architecture (Topical Map)

**Objective:** Understand search intent, competitive landscape, and page structure.

**Skills to run:**
```
/local-research      →  research/research.json + site-blueprint.csv
                        (Keywords, search volumes, competitive gaps, audience)
```

**Deliverable:** Ground-truth research data and approved page list.

**◆ CHECKPOINT 2: Research Approval Gate**
- Fact-check all keyword volumes (using DataForSEO tool calls)
- Verify competitive analysis (3+ competitors per category)
- Approve the page list: Is the topical map complete? Priorities right?
- Action: **APPROVE page list in site-blueprint.csv**
- If changes needed: Update research, re-run analysis
- **PASS → Proceed to STAGE 2**

---

### STAGE 2 — Build System (Components & Foundation)

**Objective:** Scaffold project, establish design system, verify responsive rendering.

**Before any design work:** invoke the `premium-design-standard` skill (via the Skill tool) — it sets the design-quality bar, motion/animation checklist, and section-separator patterns. Re-invoke it for any later restyle or new component work; never rely on remembering it.

**Skills to run:**
```
/astro-build         →  Full Astro scaffold + component library + 2 sample pages
```

**Deliverable:** Live Astro project with design system, components, and 2 verified sample pages.

**◆ CHECKPOINT 3: Quality Baseline Gate**
- Load 2 sample pages locally (`astro dev`)
- **Slop Tests:** No spelling errors, broken links, or placeholder text
- **2-Second Rule:** Page comprehensible in 2 seconds (hero, value, CTA)
- **Responsive Check:** Test at 320px (mobile), 768px (tablet), 1440px (desktop)
- Action: Screenshot at each breakpoint; document any issues
- If issues found: Fix in components, re-test samples
- **PASS → Approve → astro-build replicates pattern across all pages**

---

### STAGE 3 — Per-Page: Content, Images, & SEO (The Production Line)

This is where pages come to life. Follow this workflow for EACH page.

#### Step 1: Content Brief (Planning)

**Cannibalization check (before briefing):** search site-blueprint.csv and GSC queries for the target keyword. If an existing page already targets it — or already ranks for it — **refresh that page** (SEO Refresh flow) instead of creating a new one. Two pages competing for one keyword rank worse than one strong page.

**Slug standards:** lowercase, hyphens, keyword-first, ≤4 words, no stopwords, no dates/years (so content updates never force a URL change). Example: `/cavapoo` not `/best-cavapoo-puppies-2026`.

```
/page-brief [slug]   →  briefs/[slug].json
                        (Outline, keywords, LSI variants, internal links, schema plan)
```

**Input:** Target keyword, page type, audience need  
**Output:** Complete outline ready for content writing

#### Step 2: Content Creation
```
/content-writer      →  src/pages/puppies/[slug].astro (breed) / src/pages/[slug].astro (hub)
      (money/service/item pages)
      
/blog-writer         →  src/pages/blog/[slug].astro
      (news/blog tier)
```

Both skills author copy into **hand-built `.astro` pages under `src/pages/`** — this project does NOT use `src/content/` collections/MDX. There is no shared BreedPageLayout, so a new breed page starts by copying the section structure of `src/pages/puppies/cavapoo.astro`, then swaps in the briefed copy.

**AI-search requirement (all page types, not just blogs):** at least one answer capsule — a question-phrased heading followed by a 30–60 word self-contained direct answer — within the first 30% of the page. FAQ answers must be self-contained too (AI engines quote them verbatim; an answer that depends on surrounding context can't be cited).

**Critical:** Never hand-write page copy. Use content-writer/blog-writer—they apply LSI keyword gates.

#### Step 3: Visual Assets
```
/image-gen           →  src/assets/[slug]/[1-X]-[keyword]-[section].webp
                        (SEO-optimized naming convention)
```

**Naming rule:** `[sequence]-[main-keyword]-[section]-[LSI].webp`  
Example: `2-starter-kit-items-cavapoo-unboxing.webp`

**Image performance gate (hero images are the usual LCP killer):**
- Hero image ≤150KB (WebP), explicit `width`/`height` attributes
- Hero: `loading="eager"` + `fetchpriority="high"`; all below-fold images: `loading="lazy"`
- Every image has descriptive, keyword-aware alt text

#### Step 4: Schema Markup
**Review:** `SCHEMA.md` for page type (home, breed, guide, service)  
**Add schemas:**
- `webPageSchema()` (required on all)
- `breadcrumbSchema()` (navigation)
- Specialized: `serviceSchema()`, `reviewSchema()`, `productSchema()`, etc.

**Entity signals (required):**
- LocalBusiness/Organization schema carries `sameAs`: GBP URL, Instagram, Facebook, and the **AVS public registry** URL (a government page listing the business is the strongest entity proof available — see SCHEMA.md)
- Every content page has a visible byline (Nelson & Kim) + `Person` schema with credentials and `sameAs`, reusing one site-wide `@id` so Google consolidates the author entity

**Social/OG meta (required — WhatsApp is the primary CTA, shared links must preview richly):**
- `og:title`, `og:description`, `og:image` (1200×630), `og:url`, `og:type`
- `twitter:card` = `summary_large_image`
- Canonical URL tag on every page

**Validate:** Run page through [Google Rich Results Test](https://search.google.com/test/rich-results)

#### Step 5: SEO Optimization ⭐ NEW GATE
```
/seo-audit-and-fix [page-path] "[primary keyword]"
                        → [slug]-seo-audit.md + auto-applied fixes
```

**What it does:**
- ✅ Auto-fixes: Title, meta description, H1, schema image, anchor text (6-8 fixes)
- ⚠️ Reports: Critical/High/Medium/Low recommendations
- 📊 Scores: Current → optimized SEO score

**Timing:** After Step 4 (schema complete), before verification  
**Duration:** 15-30 minutes, 30-point score improvement typical

**Output:** `[slug]-seo-audit.md` with:
- Before/after comparison
- Keyword analysis
- Competitive gaps
- Implementation checklist

#### Step 6: Internal Linking ⭐ (before the PR — link edits ship in the same deploy)

**Inbound (old → new):** Look through the site's existing pages and find up to 5 that are topically related to the new page (same breed, same category/silo, same service, or a natural user-journey next-step). For each (max 5):
1. Open that existing page's content file.
2. Add a contextual internal link pointing to the new page, using descriptive keyword-rich anchor text (not "click here").
3. Place the link naturally within relevant body copy, or in a "Related" section if no natural body placement fits.

**Outbound (new → old):** Verify the new page itself links out per its brief's internal-link plan — at minimum to its silo siblings and up to its parent/money page. If the brief's planned links didn't make it into the copy, add them now.

**Site-wide anchor diversity:** before writing an anchor, check what anchors already point at the target page across the site. Mix exact-match, partial-match, and natural-phrase anchors — if 5 pages all link to `/cavapoo` with the anchor "cavapoo for sale Singapore", that's an over-optimization pattern. Vary it.

**Do not** link from unrelated pages just to hit the count — 5 is a maximum, not a quota. Skip the inbound half for the very first 1-2 pages on the site (nothing relevant yet to link from).

#### Step 7: Verification
```
Local preview        → astro dev --background
                       (Test all links — incl. new internal links — images, interactive elements)

Mobile check         → preview_resize to 320px, 768px, 1440px
                       (Responsive, readable, load time)

Visual QA            → Screenshot at all 3 breakpoints for EVERY page
                       (Don't assume component reuse is perfect — look at it)

Trust-proof check    → On money pages: AVS license, reviews/testimonials,
                       and real proof visible above the fold or one scroll away

Schema validation    → Google Rich Results Test (no errors)
                       (Structured data properly formatted)
```

#### Step 8: Deploy
```
Create PR            → Include link to [slug]-seo-audit.md
                       Includes the internal-link edits from Step 6
                       Document any manual SEO recommendations
                       
Merge to main        → Triggers Cloudflare deploy
                       
Monitor              → Check Google Search Console 24h post-deploy,
                       then via the monthly SEO review loop (see below)
```

---

### STAGE 3 — Site-Wide: Launch & Verification

**After all Core/money pages complete:**

```
/launch              →  Staging validation + performance checks
                        (20-point gate before going live)

◆ CHECKPOINT 4: Launch Gate
  - All core pages: Content ✓ Images ✓ Schema ✓ SEO audit ✓
  - 404 check: No broken internal links
  - Crawlability: sitemap.xml generated (@astrojs/sitemap) + referenced in
    robots.txt; canonical tags on every page; no accidental noindex
  - Link architecture: every page reachable ≤3 clicks from home; ZERO orphan
    pages (every page has ≥1 contextual inbound link, not just nav/footer)
  - AI search: llms.txt at root (REQUIRED, not optional); AI crawlers not
    blocked in Cloudflare or robots.txt
  - Performance: LCP <2.5s, CLS <0.1, FID <100ms
  - Security: No console errors, valid HTTPS
  - Monitor: Google Search Console setup, GSC tags verified
  - PASS → Deploy to production
```

---

### POST-LAUNCH: Recurring Loops

**Monthly SEO review (rankings move over weeks, not 24h):**
```
1. Pull GSC query report → find pages with declining clicks/impressions
   or high-impression/low-CTR queries
2. Pick the 1-2 weakest pages → run the "For SEO Refresh" flow (below)
3. High-impression/low-CTR pages → rewrite title + meta against the query
   GSC actually shows (one variable at a time), wait 3-4 weeks, compare CTR
4. Check for new internal-linking opportunities from recently added pages
5. Orphan/depth check: no page has drifted to zero contextual inbound
   links or >3 clicks from home
```

**Content freshness (every 90 days per money page):**
```
- Genuine refresh: update prices, availability, add 1 new FAQ from real
  customer questions (WhatsApp threads are the source)
- Only bump dateModified when content ACTUALLY changed — fake freshness
  (date bumps without edits) is a recognizable negative pattern
```

**Publishing cadence (topical velocity):**
```
- 2-4 blog posts/month minimum after launch, consistently
- Always fill the next gap in the silo (from site-blueprint.csv) —
  never off-silo topics; consistency beats bursts
```

**GBP posting cadence (keep the profile active):**
```
Every new blog post   → /local-seo-gbp-posts within 48h of publish
                        (repurpose blog → GBP post with "Learn more" button)
Ongoing               → reshare recent Instagram photos to GBP via the same skill
```

---

## QUICK REFERENCE: Page Creation Workflow

```
┌─────────────────────────────────────────────────────────────┐
│ STAGE 3 PER-PAGE WORKFLOW (8 STEPS)                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [1] /page-brief          → briefs/[slug].json             │
│       └─ Content outline, LSI keywords, internal links      │
│                                                              │
│  [2] /content-writer      → src/pages/puppies/[slug].astro │
│       └─ Copy with keyword gates applied                    │
│                                                              │
│  [3] /image-gen           → src/assets/[slug]/*.webp       │
│       └─ SEO naming: [#]-[keyword]-[section]                │
│       └─ Hero ≤150KB, eager+high priority, rest lazy        │
│                                                              │
│  [4] Schema + OG Meta     → SCHEMA.md guide                │
│       └─ WebPage + specialized schemas (Service, Review)    │
│       └─ OG/Twitter tags + canonical (WhatsApp previews)    │
│       └─ Validate in Google Rich Results Test              │
│                                                              │
│  [5] /seo-audit-and-fix ⭐ → [slug]-seo-audit.md           │
│       └─ Auto-fixes (6-8) + recommendations (8-15)         │
│       └─ Score: baseline → optimized (typical: +30 points)  │
│                                                              │
│  [6] Internal Linking ⭐  → up to 5 related pages → new     │
│       └─ Plus verify new page links out per its brief       │
│                                                              │
│  [7] Local Verification   → astro dev + preview_resize     │
│       └─ Links, images, responsive, schema valid            │
│       └─ Screenshots at 320/768/1440 + trust-proof check    │
│                                                              │
│  [8] Deploy               → PR (incl. link edits) → Live    │
│       └─ Monitor GSC 24h + monthly SEO review loop          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Per-page timeline:** 6-10 hours (varies by page complexity)

---

## FOUR QUALITY GATES (Never Skip)

| Gate | Stage | Check | Pass = |
|------|-------|-------|--------|
| **Checkpoint 1** | 0 | Business proof complete | Context → Stage 1 |
| **Checkpoint 2** | 1 | Research verified, pages approved | Topical map → Stage 2 |
| **Checkpoint 3** | 2 | 2 sample pages meet quality bar | Components replicated → Stage 3 |
| **Checkpoint 4** | 3 | All pages complete, 20-point gate | Production live |

These gates ARE the quality system. Skipping one has historically led to:
- Missing LSI keywords (page shipped at 1% of target)
- Broken links in production
- Unvalidated schema causing rich snippet failures
- Pages ranking below competitors

---

## GOLDEN RULES

**Authority Source:**
- ✓ One config: `project-config.md` (values, keywords, location, pricing)
- ✓ One design: `.claude/commands/shared/design-system.md` (colors, typography, tokens)
- ✗ No hardcoded values in page files
- ✗ No one-off component styles

**Stack & Scope:**
- ✓ Locked stack: Astro + Tailwind + Cloudflare
- ✓ Content-first: Real research, real proof, real voice
- ✗ No WordPress, no single-file apps, no fabricated stats

**Content Quality:**
- ✓ Use `/content-writer` or `/blog-writer` for final copy
- ✓ All claims trace to research tools (DataForSEO, business-context)
- ✗ Never hand-write page copy (loses keyword QC gate)
- ✗ Never fabricate stats—flag `[NEEDS PROOF]` instead

**SEO Standards:**
- ✓ Run `/seo-audit-and-fix` on every page (Step 5)
- ✓ Target baseline score 88+/100 before launch
- ✓ Review `SCHEMA.md` for page type before adding schema
- ✓ Validate schema in Google Rich Results Test
- ✓ Slugs: lowercase, keyword-first, ≤4 words, no dates/years
- ✓ One keyword = one page (cannibalization check before every new brief)
- ✗ No pages live without audit
- ✗ Never delete or rename a published URL without a 301 in Cloudflare
  `_redirects` — and check GSC for inbound links first

---

## PAGE-BUILD BUG CHECKLIST (learned from real fixes — check every new page against this)

**1. Internal links to pages that don't exist yet.**
Before writing `<a href="/some/path">`, check whether `src/pages/some/path.astro` (or the
equivalent content-collection entry) actually exists. If it's only listed in
`research/site-blueprint.csv` as planned, it is a 404 today. Options, in order of preference:
a) don't link it yet and add a `<!-- TODO: link to /path once built -->` comment, or
b) build a minimal stub page first if the link is essential, or
c) link it anyway ONLY if you also log it so it gets built before launch (the 20-point
launch gate in Stage 3 Site-Wide must catch any that slipped through — check every internal
href on every page resolves to a real route before Checkpoint 4).

**2. `CaptionedBlock` (or any two-column component) with `imagePosition="none"` and no `side` slot.**
This silently collapses to a single-column block with a large empty gutter on desktop. Every
`CaptionedBlock` that doesn't have a real photo must pass a `<div slot="side">` (a quick-facts
card, checklist, or comparison box in the section's accent color) so the layout never reads
as "half-empty." Grep for `imagePosition="none"` on a page before calling it done — every hit
needs either an `imageSrc` or a `side` slot.

**3. Decorative animation components (`PawTrail`, `CloudDivider`, etc.) dropped in "wherever it fit."**
Place these deliberately at a genuine section boundary that makes sense as a pause beat (e.g.
the end of a natural content group), not just wedged between two unrelated blocks because that's
where the page happened to need visual filler. When adding one, say out loud which section it
closes and which one it opens. For `CloudDivider` specifically, its `fillClass` must match the
**actual rendered background** of the section it borders (check that section's own `bgClass`/
`variant`, don't assume from source-order proximity) — a `ComparisonSplit` next to a tinted
`CaptionedBlock` does NOT itself have that tint, so bracket the divider around whichever one
really has it.

**4. `CloudDivider` white-line seam (the stubborn one — took several passes).** A divider band
between two solid sections shows a 1px hairline of the PAGE background at the seam. Things that
did NOT fully fix it: matching `stroke` to `fill`, baking the flip into path geometry, and even
setting the container `background` to the fill color — because backgrounding only hides the
divider's OWN transparency; it does nothing about a real sub-pixel GAP between the two stacked
block boxes, and that gap exposes the root/page background. The fix now baked into
`CloudDivider.astro` — **don't undo any of the three parts**: (a) container `background` = FILL
color; (b) the light side drawn as an explicit `--color-surface`/`againstColor` path that
OVERSHOOTS every edge; and **(c) the decisive one: `-my-px` on the container so it physically
OVERLAPS both neighbours by ~1px, leaving no gap at all.** Verify by measuring the computed gap
between the divider box and each neighbour — it must be ≤ 0 (overlap), not positive. If a divider
borders a non-surface light section (e.g. a `variant="card"` block), pass `againstColor` so the
light path matches that neighbour's exact color.

**5. Vaccination/licensing timelines: get Singapore's actual schedule right** (canonical facts now
live in `business-context.md` → "Singapore Regulatory & Health Facts"). Core puppy vaccinations run
weeks 6 / 8 / 12 (not 6/9/12), with an **optional 4th at week 16** if the vet advises it; deworming
happens *together with* every vaccination visit; the puppy only goes home about a week after the
2nd vaccination (week 9); and the rabies/core booster is *annual* from Year 1 onward (not a one-time
"Year 2" event). Link the AVS pet ownership course
(https://avs.nparks.gov.sg/pets/licensing-a-pet/applying-for-dog-and-cat-licences/pet-ownership-course/)
wherever the page mentions it's required for first-time owners.

**5b. Licence number: the AVS pet shop licence is `AS24J00046`, which is DIFFERENT from the ACRA
company registration (`202420075D`).** Anywhere a page presents the shop's licence / "AVS licensed"
trust signal, use the AVS number `site.license.avsNumber` (`AS24J00046`) — never the ACRA number.
ACRA is company registration only (`site.license.acraNumber`), not a pet-shop licence. Don't
conflate them in copy, trust badges, FAQs, or schema.

**6. Two `BannerRibbon` CTAs stacked back-to-back at page end.** If both use the default `tint`
variant they look like one blob. Give the first (location/WhatsApp) CTA `variant="dark"` and
keep the second (quiz/secondary) `variant="tint"` so they read as two distinct steps. Don't
duplicate the same message in both the card body AND a floating paragraph underneath it —
pick one place to say "browse all our puppy breeds."

**7. "Available puppies" sections need an actual visual showcase, not just a paragraph + WhatsApp
link.** Every breed page's `#available` section should include a `ListingGrid` (or equivalent)
with a few representative photos, framed as "recently placed" rather than a live-for-sale
listing with fixed name/price — the business intentionally keeps exact availability off-page
because it goes stale, so don't fabricate a fixed inventory; do give visitors something to look
at besides text.

**8. Any repeated page-level fix belongs in the shared component, not just one page.** There is
no shared `BreedPageLayout` — `cavapoo.astro` and `maltipoo.astro` (and any future breed page)
each duplicate the full section order by hand. When you fix a bug on one breed page, check the
sibling breed page(s) for the same pattern before calling the fix done.

---

## SUPPORTING DOCUMENTATION

| File | Purpose | Update Frequency |
|------|---------|------------------|
| `CLAUDE.md` | Dev standards (code patterns, design process) | Per project |
| `SCHEMA.md` | Schema markup standards for each page type | Per new schema pattern |
| `SEO_ROADMAP.md` | SEO optimization opportunities (manual work) | Per page audit |
| `.claude/skills/<name>/SKILL.md` | All automation skills (one folder per skill) | As skills evolve |
| `.claude/commands/shared/design-system.md` | Visual design tokens (colors, fonts, spacing) | Per redesign |
| `project-config.md` | Single source of truth for values | As business changes |

---

## RUNNING THE SYSTEM

### For a New Project
```
1. Fill project-config.md
2. Run STAGE 0 (business-discovery, expertise-library)
3. ◆ Checkpoint 1 approval
4. Run STAGE 1 (local-research)
5. ◆ Checkpoint 2 approval
6. Run STAGE 2 (astro-build)
7. ◆ Checkpoint 3 approval
8. Repeat STAGE 3 for each page (8-step workflow)
9. ◆ Checkpoint 4 approval → Launch
```

### For a New Page (on existing site)
```
1. /page-brief [slug]
2. /content-writer or /blog-writer
3. /image-gen (hero ≤150KB, WebP, lazy below fold)
4. Add schema + OG meta + canonical (use SCHEMA.md)
5. /seo-audit-and-fix [page] "[keyword]"  ⭐
6. Internal linking: up to 5 related pages → new page (+ outbound check)
7. Local verify (screenshots at 3 breakpoints, trust-proof check) + deploy
8. If it's a blog post: /local-seo-gbp-posts within 48h
```

### For SEO Refresh (existing page)
```
1. Review /SEO_ROADMAP.md for that page
2. Apply recommendations from audit report
3. Update content/images as needed
4. Run /seo-audit-and-fix [page] "[keyword]" again
5. Verify improvements in Search Console (2-4 weeks)
```

---

## Summary

**This workflow ensures:**
- ✓ Every claim is researched before building
- ✓ Every page meets design quality bar before shipping
- ✓ Every page is SEO-optimized before deploying
- ✓ Four gates prevent low-quality builds from reaching production
- ✓ One master file orchestrates the entire system

**Key innovation:** SEO Audit & Auto-Fix (Step 5) runs on every page, improving baseline score from ~65→88 in 15-30 minutes per page.

---

*Last Updated: 2026-07-05*  
*Master orchestration file for Curious Tails site system*
