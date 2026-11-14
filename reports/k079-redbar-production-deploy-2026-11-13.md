# K-079 — Red bar copy promoted to production (curioustails.sg)

Date: 2026-11-13
Worker: orca_session_id:d20008b8-b828-4926-bd23-ecf5715c82ce (Dispatch ctx_bb0003fa1c38, task_7c9dea67032f)
Project: `D:\Claude Code\Curious Tails`
Result: **SUCCEEDED — red bar live on production. No rollback needed.**

## Change deployed

`src/layouts/BaseLayout.astro` only — the two `<span>` lines inside the sticky red bar link:

```
-    <span class="sm:hidden">Open daily 11am–6pm · Closed Mon</span>
-    <span class="hidden sm:inline">Visit us daily 11am–6pm (closed Mondays) · See puppies available now →</span>
+    <span class="sm:hidden">Open Daily 11am - 6pm. Closed on Monday.</span>
+    <span class="hidden sm:inline">Open Daily 11am - 6pm. Closed on Monday.</span>
```

`git diff --stat` at build time: `1 file changed, 2 insertions(+), 2 deletions(-)`.

## 1–3. State recorded and tree staged

`git status --porcelain > %TEMP%\ct-before.txt` and `git diff > %TEMP%\ct-before.diff` written
(`C:\Users\admin\AppData\Local\Temp\ct-before.txt`, `.diff`; 30 status lines).

Stashed with an explicit path list (no `--include-untracked`):

```
git stash push -m "pre-redbar-deploy" -- src/components/Hero.astro src/pages/index.astro \
  src/data/build-id.json package.json logs/auto-cbd.log scripts/review_refresh.log reports/
```

Stash created: `stash@{0}: On main: pre-redbar-deploy`. After it, the only tracked modification
was `src/layouts/BaseLayout.astro`; the two pre-existing stashes (`pre-loving-homes: build-id only`,
and the older WIP ones) were untouched.

Note: `git status --porcelain` also still lists the pre-existing **untracked** WIP
(`_board_now.png`, `_doing.png`, `_k002_stage/`, `_k003_stage/`, `src/styles/diecut.css`,
several `reports/*` files, `scripts/imports/`). These were deliberately not stashed (task said
explicit paths, no `--include-untracked`) and cannot ship: `src/pages/index.astro` was reverted to
HEAD, which does not import `diecut.css`, and `git grep -E "diecut|dc-seal|dc-scallop|dc-home|dc-sticker" -- src`
returns nothing at HEAD.

## 4. Build

```
> curious-tails@0.0.1 prebuild
> node scripts/gen-build-id.mjs
gen-build-id: wrote=1 sources=1403
[build] 125 page(s) built in 30.26s
[build] Complete!
```

Exit 0. `npm run build` only (not `build:deploy`, so no puppy sync / feed check ran).
Build id produced: **`aebdc00c70cb`** (`src/data/build-id.json`, stamped into every page).

## 5. Production deploy

```
python ~/.claude/scripts/with_env.py -- bash scripts/deploy-pages.sh
pre-check: LAUNCH_STATUS=LIVE, no blanket noindex in dist/_headers
deploying project=curioustails-sg branch=main build=aebdc00c70cb
✨ Uploaded 130 files (2696 already uploaded) (137.00 sec)
✨ Deployment complete! Take a peek over at https://7f80c93e.curioustails-sg.pages.dev
recorded in BUILD-STATE.md
```

- Deployment id: **`7f80c93e-6b6f-4226-9ce1-a9f70ea78b98`**
- Environment: **Production**, branch `main`, source `d8c105a`
- Deployment URL: `https://7f80c93e.curioustails-sg.pages.dev`
- Live domain: `https://curioustails.sg`
- No staging deploy was performed.

## 6. Live verification

### Bar (`https://curioustails.sg/`, Playwright, real Chromium)

| Viewport | Rendered bar text | Visible spans | Link |
|---|---|---|---|
| 1440×900 | `Open Daily 11am - 6pm. Closed on Monday.` | 1 of 2 (`sm:hidden` display:none, `hidden sm:inline` block, 282×14) | `/available-puppies/` |
| 390×844 | `Open Daily 11am - 6pm. Closed on Monday.` | 1 of 2 (`sm:hidden` block, 242×12, desktop span display:none) | `/available-puppies/` |

Bar boxes: 1440×36 at desktop, 390×28 at mobile. Exact string, hyphen (not en dash), one visible span at a time.

### Pages (cache-busted fetches against `https://curioustails.sg`)

| Path | Status | `<meta name="build-commit">` | die-cut grep (`dc-seal|dc-scallop|dc-home|dc-sticker|diecut`, and `class="…dc-`) |
|---|---|---|---|
| `/` | 200 | `aebdc00c70cb` | 0 / 0 |
| `/available-puppies/` | 200 | `aebdc00c70cb` | 0 / 0 |
| `/about-us/` | 200 | `aebdc00c70cb` | 0 / 0 |
| `/contact/` | 200 | `aebdc00c70cb` | 0 / 0 |

Build-commit match: **PASS** — live meta equals the build id produced by `npm run build` (`aebdc00c70cb`)
on all four pages, and on the deployment URL `https://7f80c93e.curioustails-sg.pages.dev`.

## 7. Stash restore

- Before `git stash pop`, `src/data/build-id.json` was restored to HEAD because the `prebuild` step had
  regenerated it (`aebdc00c70cb` vs the stash's `61545f7011ee`); leaving it would have made the pop
  conflict on a generated file. This is the only tree operation not literally in the task list.
- `git stash pop` → **clean, no conflicts**, `Dropped refs/stash@{0} (3a3b78934951d62abd19fcb32df017eb8bf5cd6c)`.
- `git status --porcelain > %TEMP%\ct-after.txt` (31 lines). Compared with `ct-before.txt`:
  **all 30 pre-existing entries are back**, including `src/data/build-id.json` = `61545f7011ee`,
  `Hero.astro`, `index.astro`, `package.json`, both logs and the five `reports/*` edits.
  The single difference is one extra modified file: ` M BUILD-STATE.md` — appended by
  `deploy-pages.sh` itself (`deployed_build: aebdc00c70cb … 2026-11-13T08:47:12Z … main … curioustails-sg`).
  This is the script's designed deploy record and was left in place.

## 8. K-078 page check

K-078's deliverable is `outputs/puppy-page-redesign-biscuit.html` (`outputs/` is gitignored, and `outputs/`
does not exist inside `dist/`; the wrangler upload contains no `outputs` path). The deploy could not and did
not publish or modify it. Its mtime moved to 16:49:55 (size 120,027 → 120,042 bytes) during the run from a
**separate concurrent process** — our build finished 16:43:40 and the deploy finished 16:47:12, before both
writes — and its SHA-256 was then stable across a 20-second recheck. It was not touched by this build or deploy.

## Deviations / surprises

1. **Propagation lag (~1 min):** immediately after deploy, `/available-puppies/`, `/about-us/` and `/contact/`
   on `curioustails.sg` briefly served the previous build (`993f7192a332`) while `/` already served
   `aebdc00c70cb`; the deployment URL was correct throughout. Re-checks a minute later matched on all pages.
   No rollback, no re-deploy.
2. **`src/data/build-id.json` regenerated by `prebuild`**, restored to HEAD before the stash pop (see §7).
3. **`BUILD-STATE.md`** gained the deploy record line (expected side effect of `deploy-pages.sh`).
4. Task text mentioned rollback via the "`curioustails` project"; the configured/published project is
   `curioustails-sg` (the project bound to `curioustails.sg`). No rollback was needed either way.

## Rollback status

**Not used.** Live bar and all four pages verified correct.
