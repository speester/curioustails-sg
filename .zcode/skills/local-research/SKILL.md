---
name: local-research
description: >
  Runs live keyword and SERP research for a local business, then builds a
  data-backed topical-authority silo (topical map + blueprint CSV) using QDP.
  Use this AFTER discovery is complete and BEFORE any build. Triggers when the
  user asks to research keywords, map the site architecture, build the silo,
  or "do Stage 1 / local research". Produces research.json, site-blueprint.csv,
  and per-item ground-truth files. Stops at Checkpoint 2 for human fact-check.
---

# Local Research & Topical Silo Architecture

## ROLE
You are an Expert Semantic SEO Content Architect and Topical Map Strategist.
You build a Topical Authority graph grounded in REAL search demand (DataForSEO)
and REAL SERP evidence (live crawls), not from memory.

---

## VARIABLES — read from `config/project-config.md` first
Resolve these before doing anything. If a REQUIRED one is blank, STOP and ask.

REQUIRED:
- BUSINESS_NAME
- BUSINESS_TYPE
- PRIMARY_CITY
- COUNTRY
- LANGUAGE
- PRIMARY_KEYWORD
- DOMAIN
- SILO_MODEL          # breed | service | area | product  (a HINT, not a cage)
- DATAFORSEO_ENV      # env var names for DataForSEO MCP / API

OPTIONAL:
- SILO_ITEMS          # explicit list the user wants as pages (forces inclusion)
- SECONDARY_CITIES / SERVICE_AREAS
- WORDS_TO_AVOID      # hard block in all titles/slugs/output
- GOOGLE_PLACES_ENV   # if available, for competitor/GBP signals

Also read `config/business-context.md` for: what they sell, audience, differentiation,
geography, and headline proof. Use it to weight the architecture (real offerings
get pages; things they don't sell don't).

---

## NON-NEGOTIABLE RULE
Every claim, search volume, gap, competitor fact, and SERP feature recorded in
`research.json` MUST come from a live tool call made in THIS session. Do not use
remembered keyword volumes, remembered SERP layouts, or remembered competitors.
If a tool fails, retry once, then log the failure in `research.json` rather than
filling the gap from memory.

---

## SETUP (do once per session)
1. Confirm the DataForSEO MCP server is connected. If not, install it:
   `claude mcp add dataforseo ...` and set credentials from DATAFORSEO_ENV
   (DATAFORSEO_USERNAME / DATAFORSEO_PASSWORD). Verify a tool call returns data.
2. Confirm live web tools are available: SERP via the DataForSEO MCP (`serp_organic_live_advanced`) or WebSearch, and page crawling via WebFetch.
3. Create `research/` and `research/items/` if missing.

---

## TASK 1 — Live demand + SERP evidence

### 1a. Audit own site
Crawl DOMAIN homepage + up to 3 key pages. Record: current page inventory,
template pattern (e.g. single-page AI-templated), content depth, schema present,
NAP consistency, obvious weaknesses. Store in `research.json.own_site_audit`.

### 1b. Keyword universe (DataForSEO)
- Seed with PRIMARY_KEYWORD, BUSINESS_TYPE + PRIMARY_CITY, and each SILO_ITEM.
- Pull search volume, keyword difficulty, and related/long-tail keywords for the
  COUNTRY + LANGUAGE locale.
- Capture the full cluster set (aim 150–300 raw keywords) with volume + difficulty.
- Store raw in `research.json.keyword_data` (keyword, volume, difficulty, source).

### 1c. SERP crawl
For PRIMARY_KEYWORD and each major SILO_ITEM:
- Run a live SERP query (`serp_organic_live_advanced` via DataForSEO, or WebSearch) to get the live organic set.
- Crawl 5–7 top ORGANIC competitor pages (skip Instagram/Facebook for content
  analysis — note their presence only).
- Crawl ≥1 authority/regulatory source for COUNTRY (e.g. government licensing).
- Crawl ≥1 forum/community thread for real user language.
- Verify ≥3 government/industry authority links you can cite later.
Record every crawled URL with a depth rating (thin | medium | deep) in
`research.json.pages_analysed`.

---

## TASK 2 — SERP & gap analysis
From the crawls (not memory), record in `research.json.serp_analysis`:
- Dominant content format and median word count of ranking pages.
- Common structures (FAQ, comparison tables, pricing, schema types seen).
- SERP features present (PAA, local pack, snippets, images, video).
- Competitor weaknesses (thin spots, missing topics, vague claims, no proof).
- Consensus topics everyone covers (table stakes).
- VERIFIED information gaps: topics with demand but weak/no coverage.
- Vagueness gaps: claims competitors make without specifics you can beat.
- Unanswered user questions surfaced in PAA/forums.
- Sourcing, regulatory, decision-stage, and CRO gaps.

---

## TASK 3 — Topical map & silo architecture (QDP engine)

### Semantic foundation (record in research.json.topical_foundation)
- source_context: what makes THIS business the right publisher (from business-context).
- central_entity: the core entity the whole site is about.
- central_search_intent: the dominant intent uniting the site.
- root_document: the single most important page (the L2 root, usually the
  PRIMARY_KEYWORD + PRIMARY_CITY page).

### QDP (Query Deserves a Page) evaluation
For each query cluster from Task 1, score 4 criteria (yes/no):
1. Real demand — has measurable DataForSEO volume (or strong long-tail aggregate).
2. Distinct entity/intent — not the same as another cluster.
3. Non-cannibalising — won't compete with an existing/planned page.
4. Recognizable pattern — matches a page type users/SERPs expect.
- Score ≥3/4 → standalone page.
- Score <3/4 → merge as a SEGMENT inside a parent page.

SILO_MODEL is only a hint for naming the dominant pattern. If SILO_ITEMS is
provided, those items are FORCED to standalone pages regardless of score (but
still need real content). No fixed page count — typically 15–35 pages, fully
driven by QDP and real demand.

### Node Quality Rule
No thin pages. Every page must be able to rank for a multi-layer query cluster
(head + modifiers + long-tail). If a candidate page can't, merge it.

### Core vs Outer sections
CORE (transactional / money tier):
- Service/product/item hubs and their children (the SILO_ITEM pages).
- Problem/need hub (if demand exists).
- Location-transactional hub — ONLY if real district/area demand exists
  (single-city guard below).
- Pricing.
- Trust & methodology (how it works, guarantees, credentials).
- Comparison pages (vs alternatives / vs competitors).

OUTER (informational / blog tier — feeds Core):
- Local authority/context hub (COUNTRY/CITY-specific facts, regulations).
- Educational/informational hub (becomes the blog tier; answers PAA/forum questions).

### Single-city guard
If COUNTRY+market is effectively one city (no real per-district search volume),
DO NOT create thin neighborhood pages. Use one CITY-level transactional page and
push local depth into the authority hub instead. Use SILO_MODEL + volume data to
decide.

### Attribute prioritisation
Place each candidate into Core, Outer, or EXCLUDE based on: prominence (relevance
to central entity), popularity (real DataForSEO volume), and source relevance
(does this business credibly publish it). Exclude off-topic or zero-demand items.

### Title constraints (silo output only)
- No dates or years.
- No subtitles, parentheticals, or em dashes.
- No WORDS_TO_AVOID.
- No utility pages here (Home/About/Contact/Privacy/Terms — astro-build adds those).
- Every L2 hub has ≥1 L3 child (exception: Pricing may stand alone).
- Max 6 L3 per hub.
- No two pages share the same intent.
- Titles must read naturally as anchor text.

---

## TASK 4 — Ground-truth files (per standalone item)
For each CORE item/hub page, create `research/items/<slug>.md` containing
CITABLE, VERIFIABLE specifics gathered from crawls:
- Local stats, regulations, landmarks, climate/conditions relevant to the item.
- Product/service facts specific to this business (from business-context).
- Authority links (the ≥3 verified sources) with exact URLs.
- Real differentiators vs the competitor weaknesses found in Task 2.
Target ~40–50% unique "ground-truth" content per page. Flag any number you could
not verify as `[VERIFY]`. Never invent stats.

---

## TASK 5 — Local FAQ bank
Generate 18–22 questions drawn from PAA + forums + gaps. For each record:
question, journey_stage (awareness/consideration/decision), info_gain (low/med/high),
source (URL), intent. Requirements: ≥6 with local/geo specificity, ≥12 marked high
gain. No WORDS_TO_AVOID. Store in `research.json.questions`.

---

## OUTPUT ARTIFACTS (produce in this order)

1. Human-readable topical map (Root Document first, then Core hubs, then Outer
   hubs). Indent L3 with 2 spaces, blank line between L2 groups.

2. `research/site-blueprint.csv` with EXACT columns:
   `page_type,title,h1,target_keyword,search_volume,url_slug,parent,page_tier,build_method,intent,section_class,hub_or_node,notes`
   - section_class = core | outer
   - hub_or_node = L2 | L3
   - search_volume = real DataForSEO number (or "longtail" if aggregate)
   - build_method = astro-page | astro-collection | blog
   - Home page targets PRIMARY_KEYWORD + PRIMARY_CITY.

3. `research/research.json` containing:
   project info, own_site_audit, pages_analysed, keyword_data, serp_analysis,
   external_links (verified authority URLs), factual_conflicts, questions,
   topical_foundation, silo_tree (the rendered map as a string), ground_truth_index.

---

## SELF-CHECK (run before Checkpoint 2)
- [ ] Every URL in pages_analysed was actually crawled this session.
- [ ] DataForSEO volumes present for the primary keyword and each Core item.
- [ ] ≥3 authority links verified and stored.
- [ ] Verified gaps recorded (not from memory).
- [ ] topical_foundation has all 4 fields filled.
- [ ] QDP applied; no thin pages; single-city guard respected.
- [ ] CSV present with the new section_class + hub_or_node columns.
- [ ] Any required SILO_ITEMS appear as standalone pages.
- [ ] Ground-truth files written for every Core item.
- [ ] No WORDS_TO_AVOID anywhere in titles/slugs.
- [ ] factual_conflicts filled (e.g. regulatory age vs marketing claims).

---

## CHECKPOINT 2 — STOP for human approval
Do not proceed to build. Output a short summary and wait:

> **Checkpoint 2 — Research complete. Please fact-check before we build.**
> - Silo tree (paste the map)
> - Page count by tier: Core X / Outer Y / total Z
> - Top 3 VERIFIED information gaps we will own
> - Authority links we will cite (list)
> - Factual conflicts to resolve (list, e.g. import age vs coat-window claim)
> - Any [VERIFY] items needing your confirmation
>
> Reply **approve** to lock the blueprint, or tell me what to change.