---
name: blog-writer
description: >
  Writes informational/blog-tier posts that rank in Google and AI answer
  engines, using the answer-capsule technique. Lighter than content-writer;
  for the supporting topical-authority tier of the silo. Authors the post into a
  hand-built Astro page at src/pages/blog/<slug>.astro (this project does NOT use
  src/content collections/MDX). Use for "write a blog post about [topic]".
---

# Blog Writer (informational tier)

## Variables this skill needs (resolve from project-config.md)
BUSINESS_NAME, DOMAIN, PRIMARY_CITY, TONE, BRAND_VOICE_WORDS, PRIMARY_CTA_GOAL,
WORDS_TO_AVOID.
PER-POST INPUTS: BLOG_TOPIC/keyword, content angle, word target (default
1,500–2,000), CTA goal.
Reads: business-context.md (voice + the CANONICAL Singapore Regulatory & Health
Facts block — any post touching vaccinations, health, licensing, HDB rules, or
first-time ownership must use those figures verbatim, e.g. vaccinations weeks
6/8/12 not 6/9/12), expertise-library.md (real experience),
research/site-blueprint.csv + existing `src/pages/` routes (internal-link pool),
design-system.md (house rules).
WRITES: src/pages/blog/<slug>.astro (hand-built, following the site's page
pattern) + FAQPage schema. There is no `src/content/` collection.

## STEP 1 — Setup
- Voice: read business-context.md (and, if needed, fetch 1–2 live site pages).
  Every sentence must sound like the brand.
- Internal-link pool: read site-blueprint.csv + existing collection entries.
  Pick 4–7 genuinely related pages, plan anchor text (2–5 words) + placement.
  (No need to parse a live sitemap — the blueprint IS the pool.)

## STEP 2 — Research (live, 5–8 searches before outlining)
What people search around this topic; what ranks p1 and their angle; recent
data/studies (last 6–12 months); common questions (PAA); expert perspectives.
Compile 8–15 authoritative sources with the specific data point from each.
Every source must trace to a real fetch — no plausible-sounding stats.

## STEP 3 — Outline, then STOP for approval
Present: search-intent analysis (2–3 sentences) · TL;DR draft (50–80 words) ·
intro hook · 5–7 H2s marking which use the answer-capsule format (~60%) ·
source plan table (source/insight/section) · internal-links plan table ·
where expertise-library.md content fits. Wait for approval before writing.

## STEP 4 — Writing rules
- Answer Capsule (~60% of H2s): H2 phrased as a real-person question; a 30–60
  word self-contained direct answer immediately after (this is what AI engines
  cite); then deeper explanation with examples/data. Remaining ~40% standard
  editorial H2s for variety.
- 8th-grade reading level: short sentences (<20 words avg), common words,
  one idea per 2–4 sentence paragraph, active voice, contractions.
- Source-backed claims: every stat/fact is a contextual inline link with
  descriptive anchor text, spread throughout, paraphrased in brand voice.
- Internal links: 4–7, natural, descriptive anchors.
- Experience: pull real stories/numbers from expertise-library.md as first-
  person ("When we did this for [client], we saw..."), respecting consent.
  Flag [NEEDS PROOF] if a claimed result has no backing.
- No em dashes. WORDS_TO_AVOID hard-blocked.

## OUTPUT
src/pages/blog/<slug>.astro with head/meta (title, description 150–160,
keyword, author, date, faq) and body: TL;DR → intro (keyword in first 50 words)
→ 5–7 H2s → conclusion (2–3 takeaways + CTA matching PRIMARY_CTA_GOAL) → FAQ
(5 Qs, self-contained answers). Plus the FAQPage JSON-LD (the Schema component
can also emit this from frontmatter).
Post-delivery summary: word count, reading level, external sources, internal
links, capsule vs standard section count, any [NEEDS PROOF]. Then offer a meta
title + description.
