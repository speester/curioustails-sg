---
name: page-brief
description: >
  Generates a per-page SEO Information-Gain brief (outline, LSI clusters, CRO
  persuasion architecture, schema plan, internal/external link map) for one page
  from the approved blueprint. Reads research.json; never re-runs SERP research.
  Use this right before writing a page. Triggers when the user asks to "brief a
  page", "create the outline for <slug>", or starts Stage 3 for a page. Output:
  briefs/<slug>.json.
---

# Page Brief — SEO Information-Gain Architecture

## ROLE
You turn ONE approved blueprint row into a precise, build-ready brief. You do not
research the SERP again — Task 1/2 of local-research already did that. You consume
its evidence and design the single best page for this keyword and intent.

---

## VARIABLES

From `project-config.md`:
- BUSINESS_NAME, BUSINESS_TYPE, PRIMARY_CITY, COUNTRY, LANGUAGE
- DOMAIN, OWNER_NAME, TONE, BRAND_VOICE_WORDS
- PRIMARY_CTA, PRIMARY_CTA_GOAL, PHONE, WHATSAPP, PRICE_RANGE
- WORDS_TO_AVOID

Per-page inputs (from the blueprint row, or asked if missing):
- PAGE_TARGET_KEYWORD        # REQUIRED
- PAGE_SECONDARY_KEYWORD     # optional — turns on dual-intent logic
- PAGE_INTENT                # transactional | commercial | informational | navigational
- PAGE_TYPE / PAGE_TIER      # from page_type + page_tier + section_class
- PAGE_SILO_ITEM             # the item this page is about (slug)

Files read:
- `research/research.json`            (SERP, gaps, questions, external links, foundation)
- `research/items/<PAGE_SILO_ITEM>.md` (ground-truth facts, if it exists)

---

## STOP CONDITIONS
- If PAGE_TARGET_KEYWORD is missing → STOP and ask.
- If `research.json` is missing → STOP; tell the user to run local-research first.
- WORDS_TO_AVOID is a HARD block: never appears in titles, headings, LSI, slugs,
  meta, alt cues, or any output field.

---

## SILENT PRE-ANALYSIS (do not output; informs the brief)
1. Intent profile — what the searcher wants and their stage.
2. Conversion goal — the one action this page must drive (PRIMARY_CTA_GOAL).
3. Entity & topical map — central entity + supporting entities to define.
4. E-E-A-T cues — which proof/credentials/experience this page must show.
5. Objection map — the top objections a buyer has at this stage.
6. Persuasion-phase mapping — assign every planned section to a CRO phase.
7. Dual-intent reconciliation — only if PAGE_SECONDARY_KEYWORD is set.

---

## DUAL-INTENT RULES (only when PAGE_SECONDARY_KEYWORD is set)
- Both keywords appear in the first 150 visible words.
- Secondary keyword must appear in: the definition box, ≥2 H2s, the meta
  description, ≥3 image alt texts, the WebPage schema description, and the first FAQ.
- ≥40% of visible word count is devoted to educational (secondary-intent) sections.
- The definition box sits within the first 30% of the page.

---

## INFORMATION-GAIN PRIORITY
Tag every section with a priority:
- P1 — original / first-party (this business's real data, stories, proof).
- P2 — SERP gap (a verified gap competitors miss).
- P3 — depth (goes deeper than competitors on a covered topic).
- P4 — consensus (table stakes everyone has).

Rules:
- ≥45% of sections must be P1 or P2.
- Every non-terminal P4 section needs a P1/P2 child, or is marked P4-TERMINAL.

---

## CRO PERSUASION PHASES (every page maps to these 5)
1. Hook & Trust — hero, primary CTA, trust badges, definition box.
2. Justify / Desire — 3–5 depth sections, mid-page CTA.
3. Ownership & Objections — how-it-works, comparison, objection handling.
4. Proof & Risk Reversal — testimonials, guarantee, FAQ (≥6 from research.json),
   compliance/credentials.
5. Close — final CTA, location/NAP block, micro-conversion.
All 5 phases must appear. CTA must appear in Phase 1, mid-page, and Phase 5.

---

## LSI EXTRACTION
Produce 120–180 semantic terms drawn from keyword_data + serp_analysis +
entities in research.json. Cover: core keyword variations, qualifiers,
service/product terms, intent phrases, named entities, local/geo terms, audience
descriptors, long-tail (4+ word) phrases, cost/value terms, trust/social-proof
terms, origin/supply terms, protection/safety terms, everyday-use terms.
- Split into primary cluster and secondary cluster when dual-intent is on.
- Order by relevance. Remove any WORDS_TO_AVOID.
- Add an `lsi_instruction` string telling the writer how to weave them naturally
  (no stuffing; cluster terms near their owning H2).

---

## OUTPUT — write `briefs/<slug>.json`
Fields:
- slug
- target_keyword
- secondary_keyword            (or null)
- page_intent
- page_tier                    (core | outer + money/standard/blog)
- country, city
- meta_title                   (≤60 chars, keyword near front)
- meta_description             (≤155 chars, includes keyword[s] + CTA)
- h1                           (one logical step from target_keyword)
- entity_definitions[]         ({entity, definition} for the def box)
- serp_summary_ref             (pointer to research.json.serp_analysis)
- lsi_keywords {primary[], secondary[], all[]}
- lsi_instruction
- content_outline[] — each item:
    { heading, level (H2/H3), priority (P1-P4), cro_phase (1-5),
      cro_element, intent_served (primary/secondary/both),
      ux_note (e.g. "captioned block", "comparison split", "listing grid"),
      key_points[], first_party_prompt (what real data to pull from
      expertise-library/ground-truth), external_link_cue }
- internal_links[]             ({anchor, target_slug, placed_in_section})
- external_links[]             (verified authority URLs from research.json)
- faq[]                        (≥6, drawn from research.json.questions)
- schema_plan[]                (LocalBusiness, WebPage, Product/Service/ItemList,
                                FAQPage, BreadcrumbList, Person, Speakable as fits)
- cross_check {A..H results}
- info_gain_score              (% of sections that are P1/P2)
- word_count_target           (money: 2500–3500 | standard: 1500–2500 | blog: 1500–2000)

NOTE: `ux_note` values must match the component names available in astro-build
(Hero, DefBox, StatStrip, FAQ, ListingGrid, CaptionedBlock, ComparisonSplit,
BannerRibbon, Tabs, Carousel) so the brief maps cleanly onto real components.

---

## CROSS-CHECK (run before saving)
- A) Every verified gap in research.json → a section.
- B) Every HIGH-gain question → a section or FAQ entry.
- C) Duplicate key_points removed across sections.
- D) Every P4 section has a P1/P2 child or is P4-TERMINAL.
- E) All 5 CRO phases present.
- F) Every mapped objection is addressed somewhere.
- G) CTA present in Phase 1, mid-page, and Phase 5.
- H) Dual-intent (if on): ≥30% of sections serve secondary/both at P1/P2 AND
     educational sections ≥40% of word_count_target.

---

## SELF-CHECK
- [ ] All SERP data sourced from research.json (no fresh SERP calls).
- [ ] ≥45% of sections are P1/P2.
- [ ] Gaps and high-gain questions mapped.
- [ ] schema_plan matches the page type.
- [ ] Any price mentioned matches PRICE_RANGE.
- [ ] No WORDS_TO_AVOID anywhere.
- [ ] Dual-intent placement rules satisfied (if applicable).
- [ ] internal_links target real slugs from site-blueprint.csv.
- [ ] external_links are the verified authority URLs.
- [ ] ux_note values map to real astro-build components.

This brief is the contract the content-writer and image-gen skills consume.
It does not write prose — it designs the page.
