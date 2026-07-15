---
name: content-writer
description: >
  Writes the copy for a money/service/item page using a 5-pass pipeline grounded
  in the page brief and the user's real expertise. Authors the finished copy
  directly into the page's hand-built Astro page (src/pages/...), composed from the
  shared components — this project does NOT use src/content collections/MDX. Use
  after page-brief exists for a page, or when the user says "write the [X] page".
---

# Content Writer (money/service/item pages)

## Variables this skill needs (resolve from config/project-config.md)
BUSINESS_NAME, BUSINESS_TYPE, PRIMARY_CITY, COUNTRY, TONE, BRAND_VOICE_WORDS,
PRIMARY_CTA, PHONE, WHATSAPP, PRICE_RANGE, OWNER_NAME, WORDS_TO_AVOID, DOMAIN.
Reads: briefs/<slug>.json (the page brief — authoritative structure, produced
by the seo-information-gain-brief skill via page-brief),
config/expertise-library.md (real stories/numbers/quotes — the E-E-A-T source),
config/business-context.md (voice + the CANONICAL Singapore Regulatory & Health Facts
block — use those figures verbatim; never paraphrase them into an error),
design-system.md (copy house rules).

ARCHITECTURE (READ THIS — the pages are NOT MDX content collections):
This project has no `src/content/` collection. Breed/hub/money pages are
hand-composed `.astro` files under `src/pages/` (e.g. breed pages live at
`src/pages/puppies/<slug>.astro`), each stitching the shared components
(Hero, DefBox, CaptionedBlock, ComparisonSplit, ListingGrid, BannerRibbon,
FAQ, CloudDivider, PawTrail, etc.) by hand. Your copy is authored INTO that
`.astro` page. There is no shared BreedPageLayout, so start a new breed page by
copying the section structure of `src/pages/puppies/cavapoo.astro` as the
template, then swap in this breed's briefed copy.
WRITES: the page's `.astro` file under `src/pages/...` (breed → `src/pages/puppies/<slug>.astro`).

If briefs/<slug>.json is missing, STOP — run page-brief first.

### Using the brief's enriched fields (from seo-information-gain-brief)
- `entity_definitions` → write the Definition Box verbatim/near-verbatim from
  `subject_entity`; this is the Featured Snippet target, don't paraphrase it away.
- `lsi_keyword_weighting.transactional_cluster` / `.informational_cluster` →
  weave naturally per section per the brief's `lsi_instruction`; don't stuff.
- `dual_intent_strategy` (if present) → confirms both keywords must land in
  the first 150 words and the Definition Box sits within the first 30% of the page.
- `outline_cross_check` → if it flags unresolved gaps (section H says <30%
  secondary/both coverage, or A/B show unmapped gaps/questions), treat the
  brief as incomplete and flag it back rather than silently under-covering.
- `questions[]` (the full 18-22 bank) vs `faq[]` (the ≥6 promoted subset) →
  write the page's visible FAQ from `faq[]`; the wider `questions[]` bank is
  reference material for weaving answers into body sections, not all of it
  needs a dedicated FAQ entry.

## House rules (from design-system.md — enforce everywhere)
- No em dashes anywhere (title, body, FAQ, meta, alt, comments). Use commas,
  colons, semicolons, periods, parentheses.
- ≤3 sentences per component; educational sections may go to 5.
- Verb-first CTAs ≤4 words. Match TONE and BRAND_VOICE_WORDS.
- Every factual claim links to a real source (from the brief's external_links).
- Prices match PRICE_RANGE exactly; never show a price below the real low.
- WORDS_TO_AVOID = hard block.
- Respect consent flags in config/expertise-library.md: named testimonials/case studies
  only where consent = yes; otherwise anonymize ("a family in [area]").

## THE 5-PASS PIPELINE
The value is separating drafting from editing, and grounding in REAL experience.
This is not about beating AI detectors (an unreliable, wrong target); it is
about genuinely useful, specific, experience-backed copy that also reads human.

### PASS 1 — Plan (compress, don't write)
Read the brief + config/expertise-library.md + config/business-context.md. Produce a one-page
internal plan: the H1, the searcher's state of mind on arrival, the single
primary CTA, and for EACH H2 in the brief's content_outline: (a) the keyword it
owns, (b) the gap/objection it fills, (c) the EXACT real story/number/quote from
config/expertise-library.md it will use — cite the line. Do not write prose yet.
GATE: flag any H2 with no real proof to draw on as [NEEDS PROOF]. If more than
~2 sections are [NEEDS PROOF], STOP and tell the user exactly what to supply.
Never fabricate experience to fill the gap.

### PASS 2 — Draft section by section (independent generations)
Write each H2 section ONE AT A TIME, handed only its plan row + its LSI
sub-cluster from the brief. Independence creates natural tonal variation.
Each section: lead with the direct answer in the first 1–2 sentences (passage
indexing); use the assigned real detail verbatim or near-verbatim; specific over
general (exact figures, local detail, named things); do not restate other
sections. Educational sections up to 5 sentences/paragraph; transactional/CTA
≤3. For dual-intent pages, honor the brief's section order exactly (Definition
Box right after the showcase block, within first 30%).

### PASS 3 — Assemble + rhythm & vocabulary edit
Stitch the sections, then edit the whole for flow. Vary sentence length (no
three consecutive sentences of similar length). Remove repeated sentence
openings. Delete these AI-tell words/phrases and replace with plain language:
leverage, robust, delve, navigate (figurative), unlock, elevate, seamless,
tapestry, in today's world, when it comes to, it's worth noting, in the realm of.
Add no new claims; preserve every real number and story exactly.

### PASS 4 — Human bookends + CTA weave
Rewrite ONLY the opening and closing sentences to sound like a knowledgeable
local person, referencing a concrete specific (a place, a number, a scenario),
not a generic hook. Ensure PRIMARY_CTA + PHONE/WHATSAPP appear naturally at
least twice in the body, woven in, never as an interruption.

### PASS 5 — QC + fidelity gate (most important)
Verify against the brief: every outline H2 present; answer frontloaded in first
10–30%; both keywords in first 150 words (dual); educational ≥40% of words
(dual); no WORDS_TO_AVOID; FAQ answers match visible content; prices match
PRICE_RANGE; ≥1 first-person practitioner note present where the brief asked.
Trace every factual claim to the brief or config/expertise-library.md. Mark any
untraceable claim [VERIFY] (do not delete — flag it).

**LSI coverage check (measurable, not "weave naturally and hope"):**
1. Take `brief.lsi_keywords.all` (the full list from the page brief).
2. After drafting, count how many of those terms/phrases actually appear in
   the finished body text (case-insensitive substring match is fine for a
   gut-check; don't hand-wave this, actually scan for each one).
3. Target: **40-60% present** for the full list, and **≥80% present** for the
   `transactional_cluster`/`primary` terms specifically (these are the ones
   that must not be missing). 100% is stuffing; under ~25% means the page was
   drafted without real reference to the brief's LSI work.
4. Report the actual percentage in the delivery summary (e.g. "LSI coverage:
   52% overall, 90% of primary cluster"). If it's below target, go back and
   naturally work in the missing high-priority terms — don't ship first and
   check later.
5. This check applies to a page's copy regardless of how it was produced. If
   copy was ever hand-written outside this pipeline, run this same check
   against it before calling the page done.

Then author the page.

## OUTPUT: the page's hand-built `.astro` file under `src/pages/...`
(Breed pages: `src/pages/puppies/<slug>.astro`.) Compose the finished sections in
the brief's canonical order using the real shared components the brief's ux_notes
specify (Hero, DefBox, CaptionedBlock, ComparisonSplit, ListingGrid, BannerRibbon,
FAQ, CloudDivider, PawTrail, etc.). Head/meta (title, h1, target_keyword,
secondary_keyword, description 150–160, author=OWNER_NAME, date, hero image, OG)
are set in the page's frontmatter/head per the cavapoo.astro pattern, NOT a
content-collection zod schema.
End the message with: word count, reading check, sources linked, internal links
placed, the completed BUG CHECKLIST GATE below, and any [VERIFY]/[NEEDS PROOF]
items as a checklist for the user.

## PAGE-BUILD BUG CHECKLIST GATE (MANDATORY — do not call a page done until every box is checked)
These are real bugs fixed by hand on the cavapoo page. The authoritative list with
full rationale is **.claude/docs/RUN-THE-PROJECT.md → "PAGE-BUILD BUG CHECKLIST"** — read it.
Before finishing ANY page, verify each on the page you just built:

1. **No links to pages that don't exist yet.** For every `<a href="/…">`, confirm the
   target route/file exists in `src/pages/`. If it's only planned in
   `research/site-blueprint.csv`, don't link it (leave a `<!-- TODO: link once built -->`)
   or stub it first. A planned page is a 404 today.
2. **Every `CaptionedBlock imagePosition="none"` has a real `<div slot="side">`** (quick-facts
   card / checklist / comparison box in the section's accent colour). Grep the page for
   `imagePosition="none"` — each hit needs an `imageSrc` OR a `side` slot, never neither.
3. **`CloudDivider` `fillClass`/`againstColor` match the ACTUAL rendered backgrounds** it sits
   between (check each neighbouring section's own bg/variant, not source-order proximity). The
   seam-proofing itself is baked into `CloudDivider.astro` — don't re-implement it; just feed it
   the right colours. Place `PawTrail`/dividers at genuine section boundaries, not as filler.
4. **Singapore health/licensing facts are exact** — vaccinations weeks 6/8/12 (not 6/9/12),
   deworming with each vaccination visit, puppy home ~week 9, ANNUAL rabies/core booster, AVS
   Pet Ownership Course linked where first-time ownership is mentioned. Source: the CANONICAL
   block in config/business-context.md. This is where the page can silently ship wrong facts.
5. **Two stacked `BannerRibbon` CTAs at page end use distinct variants** (e.g. first =
   `variant="dark"`, second = `variant="tint"`) so they read as two steps, not one blob. Don't
   repeat the same "browse our breeds" message in both a card body and a floating paragraph.
6. **The `#available` section has a visual `ListingGrid` showcase**, framed as "recently placed"
   (representative photos), NOT a fabricated fixed-inventory listing with names/prices — and not
   just a paragraph + WhatsApp link.
7. **Sibling cross-check (no shared layout).** Since every breed page hand-duplicates the
   structure, when you fix or change one, check the sibling breed page(s) (`cavapoo.astro`,
   `maltipoo.astro`, …) for the same pattern before calling it done.

## Honest note
This pipeline makes good content better and more consistent. It cannot
manufacture E-E-A-T that isn't in config/expertise-library.md — that's why Pass 1 gates
on real proof and Pass 5 flags unverifiable claims rather than smoothing them
over. The quality ceiling is set by what was captured in Stage 0.
