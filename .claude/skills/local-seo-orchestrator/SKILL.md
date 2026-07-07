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
ALL variables live in ONE file: `project-config.md` at project root. This skill
and every sub-skill reads values from there. Before starting, confirm
`project-config.md` exists. If not, run `business-discovery` first (it helps
populate it), then fill the technical fields by hand.

## Locked principles
- Stack is LOCKED: Astro + Tailwind + Cloudflare. Never WordPress. Never a
  single-file HTML build. Pages are hand-built `.astro` files under `src/pages/`
  (breed pages at `src/pages/puppies/<slug>.astro`) composed from the shared
  components — this project does NOT use `src/content/` collections/MDX.
- One source of VALUES: project-config.md. One source of LOOK: design-system.md
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
- [ ] **PAGE-BUILD BUG CHECKLIST passed** (RUN-THE-PROJECT.md): no links to
      unbuilt routes; every `imagePosition="none"` block has a `slot="side"`;
      `CloudDivider` colours match the real neighbouring backgrounds; SG
      vaccination/licensing facts exact (business-context.md canonical block);
      stacked `BannerRibbon` CTAs use distinct variants; `#available` has a
      `ListingGrid`; sibling breed page cross-checked.
- [ ] `npm run build` succeeds.
- [ ] Visual QA done (desktop + mobile, no console errors).
Report this checklist explicitly when telling the user a page is "done" —
don't just say "done," show which boxes are checked.

## The sequence (run in order; stop at each ◆)

STAGE 0 — CONTEXT (once per project)
  1. business-discovery  → business-context.md (+ helps fill config)
  2. expertise-library   → expertise-library.md
  ◆ CHECKPOINT 1: user reviews both files; hardens proof; marks testimonial consent.

STAGE 1 — RESEARCH & STRATEGY
  3. local-research      → research.json + site-blueprint.csv + research/items/*.md
                           (live SERP + DataForSEO + QDP topical-map architecture)
  ◆ CHECKPOINT 2: user fact-checks research and APPROVES the page list before any build.

STAGE 2 — BUILD
  4. astro-build         → scaffold + design tokens + components + 2 SAMPLE pages, STOP
  ◆ CHECKPOINT 3: user reviews the 2 samples (Slop Tests, 2-sec rule, responsive).
     On approval, astro-build replicates the rest of the blueprint.

STAGE 3 — CONTENT, IMAGES, LAUNCH (per page, then site-wide)
  5. page-brief          → briefs/<page>.json  (money/Core pages)
  6. content-writer      → money/Core page .astro  (5-pass, reads expertise)
     blog-writer         → informational/Outer tier .astro
  7. image-gen           → kie.ai images, count derived from the page brief
  8. launch              → staging + perf + analytics + schema + indexing
  ◆ CHECKPOINT 4: the 20-point launch gate. Nothing ships until it passes.

## File-passing map
  business-discovery → business-context.md
  expertise-library  → expertise-library.md
  local-research     reads config, business-context.md; writes research.json,
                     site-blueprint.csv, research/items/*.md
  page-brief         reads research.json, research/items/*, config, expertise;
                     writes briefs/<slug>.json
  astro-build        reads config, design-system.md, site-blueprint.csv,
                     business-context.md; writes the Astro project
  content-writer     reads briefs/<slug>.json, expertise-library.md,
                     business-context.md, design-system.md; writes the page's
                     .astro file (breed → src/pages/puppies/<slug>.astro)
  blog-writer        reads expertise-library.md, business-context.md,
                     site-blueprint.csv; writes src/pages/blog/<slug>.astro
  image-gen          reads briefs/<slug>.json, config; writes src/assets/<page>/*.webp
  launch             reads config; verifies the whole site

## If asked "what's next?"
Check which output files exist on disk; report the next unrun step and its
checkpoint. Never skip a checkpoint to save time.
