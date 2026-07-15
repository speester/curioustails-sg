---
name: local-seo-orchestrator
description: >
  Conductor for building a local-business website that ranks and converts, using
  Astro + Tailwind + Cloudflare. Use when starting a new local SEO site project
  end-to-end, or to decide which sub-skill to run next. Sequences the sub-skills
  and enforces the four human checkpoints.
---

# Local SEO Site — Orchestrator

## Variables
ALL variables live in ONE file: `config/project-config.md` at project root. This skill
and every sub-skill reads values from there. Before starting, confirm
`config/project-config.md` exists. If not, run `discovery` first (it helps
populate it), then fill the technical fields by hand.

## Locked principles
- Stack is LOCKED: Astro + Tailwind + Cloudflare. Never WordPress. Never a
  single-file HTML build. Pages are hand-built `.astro` files under `src/pages/`
  (breed pages at `src/pages/puppies/<slug>.astro`) composed from the shared
  components — this project does NOT use `src/content/` collections/MDX.
- One source of VALUES: config/project-config.md. One source of LOOK: design-system.md
  (design wins on visual matters; conversion wins when design conflicts with the
  two-second clarity rule).
- State passes between skills via files on disk, not memory.
- Research is LIVE: every factual claim must trace to a real tool call this
  session. Never fabricate experience or stats — flag [VERIFY]/[NEEDS PROOF].
- The FOUR CHECKPOINTS are mandatory. Do not run end-to-end autonomously.
- **NEVER hand-author final page copy directly in a page/component file.**
  astro-build may only write clearly-labeled PLACEHOLDER copy for its 2 sample
  pages. Real, shippable copy for ANY page comes from content-writer or
  blog-writer, full stop — even if the user asks to "just finish this one page
  end to end" or similar. Wiring a brief's structured output into hand-built
  Astro components (Hero, ListingGrid, etc.) is fine; writing the sentences
  yourself, skipping content-writer, is not. If pressure to move fast tempts a
  shortcut here, stop and run content-writer instead — this exact shortcut
  previously shipped a page with ~1% of its brief's target keyword phrases
  actually present, because skipping the pipeline skips its only QC gate.

## DEFINITION OF DONE (per page — check ALL before calling a page complete)
- [ ] `briefs/<slug>.json` exists (page-brief ran).
- [ ] The page's `.astro` file exists under `src/pages/` (breed →
      `src/pages/puppies/<slug>.astro`) and its copy came from content-writer /
      blog-writer's pipeline (not sentences hand-written outside the QC gate).
- [ ] LSI coverage check run (see content-writer Pass 5): the brief's primary
      keyword cluster is verifiably present in the rendered HTML at a
      meaningful rate (not 100%, not near-zero). Do not just assert this —
      grep the built output against `brief.lsi_keywords` and report the %.
- [ ] **PAGE-BUILD BUG CHECKLIST passed** (.claude/docs/RUN-THE-PROJECT.md): no links to
      unbuilt routes; every `imagePosition="none"` block has a `slot="side"`;
      `CloudDivider` colours match the real neighbouring backgrounds; SG
      vaccination/licensing facts exact (config/business-context.md canonical block);
      stacked `BannerRibbon` CTAs use distinct variants; `#available` has a
      `ListingGrid`; sibling breed page cross-checked.
- [ ] `seo-audit-and-fix` run on the page (audit report exists; auto-fixes applied).
- [ ] Internal linking pass done: up to 5 contextual inbound links from related
      existing pages, and the page's own outbound links match its brief.
- [ ] `npm run build` succeeds.
- [ ] Visual QA done (desktop + mobile, no console errors).
Report this checklist explicitly when telling the user a page is "done" —
don't just say "done," show which boxes are checked.

## The sequence (run in order; stop at each ◆)

STAGE 0 — CONTEXT (once per project)
  1. discovery  → config/business-context.md AND config/expertise-library.md (+ helps fill config)
  ◆ CHECKPOINT 1: user reviews both files; hardens proof; marks testimonial consent.

STAGE 1 — RESEARCH & STRATEGY
  2. local-research      → research.json + site-blueprint.csv + research/items/*.md
                           (live SERP + DataForSEO + QDP topical-map architecture)
  ◆ CHECKPOINT 2: user fact-checks research and APPROVES the page list before any build.

STAGE 2 — BUILD
  3. astro-build         → scaffold + design tokens + components + 2 SAMPLE pages, STOP
  ◆ CHECKPOINT 3: user reviews the 2 samples (Slop Tests, 2-sec rule, responsive).
     On approval, astro-build replicates the rest of the blueprint.

STAGE 3 — CONTENT, IMAGES, LAUNCH (per page, then site-wide)
  **Per-Page 8-Step Workflow** (follow in order for EACH page):
  1. page-brief          → briefs/<page>.json  (LSI, internal links, schema plan)
  2. content-writer      → money/Core page .astro  (5-pass, reads expertise)
     blog-writer         → informational/Outer tier .astro
  3. image-gen           → kie.ai images (count & scenes from page brief)
  4. Schema + OG Meta    → Add WebPage + specialized schemas, social meta
     (Guide: .claude/docs/SCHEMA.md)
  5. seo-audit-and-fix   → Auto-fix + get recommendations (Step 5 gate)
     (produces [slug]-seo-audit.md; typical +30 SEO score)
  6. Internal Linking    → Add up to 5 contextual links FROM related pages
     (+ verify new page links OUT per brief)
  7. Verification        → astro dev, mobile test (320/768/1440), preview_screenshot
     (no broken links, images, responsive, trust-proof above fold)
  8. Deploy              → Create PR (include seo-audit.md), merge to main
     (triggers Cloudflare auto-deploy)
  
  **Site-Wide Launch** (after all Core pages complete):
  9. launch              → 20-point gate (crawl, schema, perf, GSC setup, llms.txt)
  ◆ CHECKPOINT 4: the launch gate. Nothing ships until it passes.

**REQUIRED:** For every step, see the detailed walkthrough in .claude/docs/RUN-THE-PROJECT.md
→ "STAGE 3 — Per-Page: Content, Images, & SEO (The Production Line)".

## File-passing map
  discovery            → config/business-context.md + config/expertise-library.md + helps populate config/project-config.md
  local-research       reads config/project-config.md, config/business-context.md; writes research/research.json,
                       research/site-blueprint.csv, research/items/*.md
  page-brief           reads research/research.json, research/items/*, config/project-config.md, config/expertise-library.md;
                       writes briefs/<slug>.json
  astro-build          reads config/project-config.md, .claude/commands/shared/design-system.md, research/site-blueprint.csv,
                       config/business-context.md; writes the Astro project
  content-writer       reads briefs/<slug>.json, config/expertise-library.md,
                       config/business-context.md, design-system.md; writes the page's
                       .astro file (breed → src/pages/puppies/<slug>.astro)
  blog-writer          reads config/expertise-library.md, config/business-context.md,
                       research/site-blueprint.csv; writes src/pages/blog/<slug>.astro
  image-gen            reads briefs/<slug>.json, config/project-config.md; writes src/assets/<page>/*.webp
  launch               reads config/project-config.md; verifies the whole site against 20-point gate

## If asked "what's next?"
Check which output files exist on disk; report the next unrun step and its
checkpoint. Never skip a checkpoint to save time.
