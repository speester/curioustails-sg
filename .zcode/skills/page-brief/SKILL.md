---
name: page-brief
description: >
  Generates a per-page SEO Information-Gain brief (outline, LSI clusters, CRO
  persuasion architecture, schema plan, internal/external link map, FAQ bank)
  for one page from the approved blueprint. Use this right before writing a
  page. Triggers when the user asks to "brief a page", "create the outline
  for <slug>", or starts Stage 3 for a page. Output: briefs/<slug>.json.
---

# Page Brief — Entry Point

This skill is the trigger name the orchestrator and `run-the-project` call for
Stage 3 ("brief a page"). The actual methodology lives in a dedicated skill —
**`seo-information-gain-brief`** — so it can be kept rigorous and versioned on
its own. Every time this skill runs, it means: read and execute
`seo-information-gain-briefSKILL.md` in full, for the one page being briefed.

## What to do
1. Resolve variables from `config/project-config.md`, the blueprint row for the
   requested slug (target keyword, secondary keyword if any, intent, tier,
   silo item), and confirm `research/research.json` exists.
2. Execute the complete `seo-information-gain-brief` skill: Silent CRO
   Analysis → live research (with the reuse rule against Stage-1 evidence) →
   Task 1 (SERP/semantic landscape) → Task 2 (150-220 LSI terms) → Task 3
   (25-35 section outline with full CRO Persuasion Architecture, P1-P4
   info-gain tagging, outline cross-check A-H) → Task 4 (internal link
   mapping against `site-blueprint.csv` only) → Task 5 (18-22 question FAQ bank).
3. Write the result to `briefs/<slug>.json` exactly as that skill's OUTPUT
   section specifies (flat JSON, compatible with content-writer's read contract).
4. Run that skill's own SELF-CHECK before reporting the brief as done.

## Explicitly out of scope here
Image prompts (camera/lighting/composition planning) are **not** part of this
skill. That work happens separately, in `image-gen`, after Checkpoint 3
(sample-page approval) — it derives image count and scenes from the finished
brief's `content_outline` and `page_tier`. Do not generate image prompts when
running page-brief.

## STOP CONDITIONS
- Requested page/slug not found in `site-blueprint.csv` → stop and ask.
- `research/research.json` missing → stop; tell the user to run local-research first.
- WORDS_TO_AVOID (from config/project-config.md) is a hard block throughout.

## After writing the brief
Tell the user: brief written to `briefs/<slug>.json`, the info-gain score
(% P1/P2), whether it's dual-intent, and that `content-writer` (or
`blog-writer` for outer-tier pages) is the next step.
