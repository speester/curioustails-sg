# Content Pipeline Fixes & Topical Expansion — Design Spec

Date: 2026-07-15
Status: Approved for implementation planning

## 1. Context

Curious Tails (curioustails.sg) is an Astro-based local SEO site for a Singapore puppy breeder, built page-by-page through a skill-driven pipeline: `local-research` (keyword/SERP research → `research/site-blueprint.csv`) → `page-brief`/`seo-information-gain-brief` (per-page SEO brief → `briefs/<slug>.json`) → `content-writer`/`blog-writer` (writes the `.astro` page).

An audit on 2026-07-15 (two Explore-agent passes over the automation scripts, tracking JSON files, and every tier of skill definition) found the pipeline has been running with a real, demonstrated enforcement gap, plus a research/deployment backlog. This spec covers the fixes.

## 2. Problems being solved

1. **Brief enforcement is soft and has already failed.** `content-writer` has a prompt-level "STOP if briefs/<slug>.json missing" check, but 27 of the 47 built breed pages plus `maltese.astro` (which isn't even in the blueprint) shipped with no brief anyway — via batch commits `a7879ba`, `e2943b7`, `52fb63b` that hand/template-built pages outside the skill entirely. `blog-writer` has no brief check at all. The cron automation (`scripts/blog_creator_daily.mjs`) that was meant to run this nightly is fully disconnected — it only logs a topic to `pending_posts.json`; `scripts/skill-runner.mjs`, the real bridge that could spawn a skill, is dead code, never imported anywhere.
2. **Topical coverage should go much deeper.** Current `research/site-blueprint.csv` has 185 rows (112 blog, 47 breed, 26 hub/authority) from 503 researched keywords. The owner wants materially more pages for topical authority, within the existing quality rules (no thin pages, no fake location pages).
3. **GitHub, Cloudflare, and GSC access now exist and should be used end-to-end** (GA is explicitly excluded — the owner handles that themselves).
4. **Miscellaneous smaller issues** found during the audit (section 6).

## 3. Decisions (confirmed with owner 2026-07-15)

- Skill edits happen on the **global** copies (`~/.claude/skills/...`), the source of truth also used by sibling domain projects (cavapoo.sg, wgpetfarm.com, puppysg.com, ~10 breed `.sg` domains). Because Curious Tails' **project-local** copies (`.claude/skills/...`) shadow the global ones at runtime for this repo, the same enforcement/research changes are also mirrored into the project copies — otherwise Curious Tails itself would not actually pick up the fix. This mirrors the existing pattern where `local-seo-orchestrator` is already kept in lockstep between tiers with only wording genericized/specialized.
- The dead cron automation gets **wired for real** using the existing `skill-runner.mjs` bridge (already has a 10-minute timeout guard), rather than abandoned or left manual-only.
- Research expansion target is **aggressive**: growing well past the current 185 rows, expected ballpark 400-600+, achieved by raising legitimate research inputs (more raw keywords mined, new page categories opened up) — **not** by lowering the existing quality bar. The Node Quality Rule ("no thin pages, every page must be able to rank for a multi-layer query cluster") and the single-city guard (no district/neighbourhood pages) stay intact. The final count is whatever QDP scoring on real demand yields, not a quota to be hit artificially.
- The brief-check gets a **hard, code-level gate**, not just a soft prompt reminder: a script (`scripts/check-briefs.mjs`) plus a **git pre-commit hook** that blocks committing a new breed/blog page with no matching brief. This directly targets the demonstrated failure mode (skill bypassed entirely via batch/hand-authoring).

## 4. Design

### 4.1 Brief enforcement

**Soft gate (parity fix):** Copy content-writer's existing gate text into `blog-writer`'s global and project SKILL.md: "If `briefs/<slug>.json` is missing, STOP — run page-brief first." Currently blog-writer has zero such check; it does its own lighter, self-contained research instead. This makes both writer skills consistent, but is *not* the primary defense — it already failed once for content-writer.

**Hard gate (`scripts/check-briefs.mjs`):** Blueprint-driven, not a blind directory scan. Logic:
1. Read `research/site-blueprint.csv`.
2. For every row where `page_type` is `breed_page` or `blog` (the two tiers the owner's brief-first rule explicitly covers — other tiers like `contact`, hub/authority pages are out of scope for this specific gate), derive the expected `.astro` path from `url_slug` and the expected brief path from the slug basename.
3. Report any row whose `.astro` page exists on disk but has no matching `briefs/<slug>.json` — the "built without a brief" violation.
4. Separately report any `.astro` file under `src/pages/puppies/` or `src/pages/blog/` that has **no corresponding row in site-blueprint.csv at all** — the "built entirely outside the pipeline" violation (the `maltese.astro` case).
5. Exit non-zero if either list is non-empty; print the offending slugs.
6. Support a `--staged` flag (checks only files in `git diff --cached --name-only`) for hook use, and a default full-repo mode for `npm run check:briefs` (manual/CI use, cited as a literal command — not an eyeballed checkbox — in `local-seo-orchestrator`'s per-page Definition-of-Done).

**Pre-commit hook:** Add a versioned `.githooks/pre-commit` shell script that runs `node scripts/check-briefs.mjs --staged` and blocks the commit on failure, plus a one-time local `git config core.hooksPath .githooks` (documented in `RUN-THE-PROJECT.md` so it survives a re-clone — `.git/hooks` itself is never committed, `.githooks` needs that config set to activate).

**Global/project sync:** Edit `~/.claude/skills/blog-writer/SKILL.md`, `~/.claude/skills/local-seo-orchestrator/SKILL.md` first, then apply the same enforcement-logic edits into `D:\Claude Code\Curious Tails\.claude\skills\...` copies, preserving each copy's existing SG-specific/generic wording split.

### 4.2 Retro-brief backlog (27 pages + maltese)

Slugs needing a brief: `cavalier-king-charles-spaniel, cavapoochon, chihuahua, cocker-spaniel, english-bulldog, german-shepherd, goldendoodle, italian-greyhound, jack-russell-terrier, japanese-spitz, labradoodle, maltese, miniature-pinscher, miniature-schnauzer, papillon, pekingese, pomeranian, pug, scottish-terrier, sheltie, shih-tzu, shihpoo, silky-terrier, toy-poodle, westie, whippet, yorkshire-terrier` (27), plus `maltese` needs a `site-blueprint.csv` row added first since it currently has none.

Process: add the missing blueprint row for maltese → dispatch parallel subagents (batches of ~5-6 slugs each) running `seo-information-gain-brief` for real (live SERP/LSI research, the skill's actual methodology, not a template) → once each brief exists, patch (not rewrite) the corresponding page's title/H2s/FAQ/entity coverage against the brief, per the owner's existing "retro-brief and patch, don't necessarily rewrite wholesale" rule.

### 4.3 Automation repair

Wire `scripts/skill-runner.mjs`'s `queueSkillsNonBlocking()` into `scripts/blog_creator_daily.mjs` so the nightly cron job actually produces a real brief + written page (calling `page-brief` then `blog-writer` via the existing `runSkillWithTimeout()`, 10-minute guard already built), instead of only writing a topic to `pending_posts.json`. Correct `DEPLOYMENT_SUMMARY.md`'s current false "LIVE AND OPERATIONAL" claim once this is actually true, and reconcile it with `WINDOWS_TASK_SCHEDULER_SETUP.md` so only one scheduling mechanism is documented as active.

### 4.4 Research depth expansion

Edit `local-research`'s global SKILL.md (mirrored to project copy):
- Raise the raw-keyword aim from "150-300" to "500-900" to support deeper long-tail mining — in line with what real research already achieved organically (503) without an explicit push.
- Add explicit guidance for three new page categories, all slotted as **blog-tier** (already uncapped, proven pattern — not a new hub type): breed-vs-breed comparisons (curated by real search volume, not the full ~1,128-pair combinatorial matrix — QDP-scored like everything else so low-demand pairs get merged/dropped), life-stage guides, condition/health deep-dives.
- Explicitly restate the guardrails that must NOT be relaxed: Node Quality Rule (no thin pages), single-city guard (no district/neighbourhood pages — a rule already on the books that a naive "more pages" push could otherwise violate), WORDS_TO_AVOID hard block.
- Run this as an **additive research wave** appended to the existing `research/site-blueprint.csv` (new rows only) rather than a full silo regeneration, so the 75 existing briefs and 70 existing built pages are undisturbed.

### 4.5 Deployment

- Reconcile the working tree on `feature/breed-expansion-37`: review and commit the legitimate in-progress changes (package.json, scheduler.mjs, publish-daily-post.mjs, reviews_log.json, beagle.astro, favicon swap); decide gitignore status for `automation.log` (local log, shouldn't be committed).
- GSC: use `gscServer` MCP to confirm `sc-domain:curioustails.sg` property status, submit `sitemap-index.xml`, run indexing spot-checks on key pages.
- Cloudflare: verify actual live/build status empirically (the `CLOUDFLARE_PROJECT` field in `config/project-config.md` is blank despite a memory note saying deployment is already wired via CF's GitHub integration — confirm rather than assume).
- Push to `main` is the actual go-live action (confirmed mechanism: CF Pages auto-builds on push via its GitHub integration, no wrangler/CI in this repo by design). This will be confirmed with the owner again at the moment it's about to happen, kept separate from the rest of this plan's execution.

## 5. Testing / verification

- `check-briefs.mjs`: run against current repo state first (should correctly list the known 27+1 violations) before wiring into the hook, as a sanity check the logic is right.
- Pre-commit hook: verify it actually blocks a deliberately-crafted test commit (new `.astro` file, no brief), then verify a correctly-briefed page commits cleanly.
- Retro-briefed pages: spot-check 2-3 patched pages against the PAGE-BUILD BUG CHECKLIST in `RUN-THE-PROJECT.md` (imagePosition/slot, CloudDivider fillClass, vaccination facts 6/8/12, etc.) since patching touches the same page structure that checklist guards.
- Automation repair: dry-run `blog_creator_daily.mjs` manually once (not via cron) and confirm it produces a real brief + page before letting the scheduled job rely on it.
- Deployment: after push, verify curioustails.sg actually serves the new build (not just that CF reports success), and verify GSC sitemap submission returns a valid status via `get_sitemap_details`.

## 6. Misc fixes bundled in

- `scripts/csv_parser.mjs`: `search_volume` is free text ("high"/"medium"), `parseInt()` on it always yields 0 — fix to map text buckets to a comparable value or drop the numeric cast.
- `page-brief` SKILL.md (both global and project copies): literal typo "seo-information-gain-briefSKILL.md" → corrected reference.
- `scripts/blog_automation_log.json`: contains a false "all 90 blogs published" entry — leave the historical log as-is (it's a log, not a live claim) but stop any doc from citing it as current status.
- `config/project-config.md`: `SILO_ITEMS` lists 7 breeds; 48 breed pages are actually live. Update to reflect reality.
- Project's local `launch` skill copy is behind the global copy (manual GSC submission + Cloudflare staging-only vs. the global copy's API-driven CF deploy + `gscServer` MCP flow) — sync project copy to match global, same mirroring approach as section 4.1.

## 7. Rollout order

1. Brief enforcement (4.1) — smallest, unblocks everything else being trustworthy going forward.
2. Retro-brief backlog (4.2) — can start in parallel with 1 once the gate exists to verify against.
3. Misc fixes (6) — bundled opportunistically wherever the same files are already being touched.
4. Automation repair (4.3).
5. Research expansion (4.4).
6. Deployment (4.5) — last, and gated on an explicit go/no-go at push time regardless of how the rest lands.
