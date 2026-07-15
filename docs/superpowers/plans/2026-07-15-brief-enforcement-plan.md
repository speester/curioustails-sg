# Brief Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make it structurally impossible to ship a new breed or blog page without a real `briefs/<slug>.json`, closing the gap that let 27 breed pages + `maltese.astro` ship without one.

**Architecture:** Two layers. A soft prompt-level gate in `blog-writer` (parity with `content-writer`, which already has one but was still bypassed). A hard, code-level gate — `scripts/check-briefs.mjs`, built on a pure/testable core module — wired into a git pre-commit hook that blocks committing a new `breed_page`/`blog` page with no matching blueprint row or brief file.

**Tech Stack:** Node.js (>=22.12.0, ESM), built-in `node:test`/`node:assert` for unit tests (no new dependency), POSIX shell git hook (Git for Windows' bundled `sh.exe`).

## Global Constraints

- Node >=22.12.0, ESM only (`"type": "module"` in package.json) — new files use `.mjs` and `import`/`export`.
- No new npm dependency for testing — use Node's built-in `node:test` (YAGNI; nothing in `devDependencies` today needs to change).
- `.claude/`, `config/`, `research/`, `briefs/` are gitignored (confidential, local-only per existing `.gitignore`). Edits to project-copy skill files (`.claude/skills/...`) and `.claude/docs/RUN-THE-PROJECT.md` are local-only and will not appear in `git status` — do not expect or attempt to commit them.
- Global skill copies live outside this repo, at `C:\Users\admin\.claude\skills\<name>\SKILL.md` — edited directly on disk; not part of this repo's git history.
- The pre-commit hook only gates **newly added** `breed_page`/`blog` pages (`git diff --cached --diff-filter=A`). It intentionally does not block commits touching already-existing unbriefed pages — that backlog is a separate plan (retro-brief backlog).

---

### Task 1: Blog-writer brief gate (parity fix)

**Files:**
- Modify: `C:\Users\admin\.claude\skills\blog-writer\SKILL.md`
- Modify: `D:\Claude Code\Curious Tails\.claude\skills\blog-writer\SKILL.md`

**Interfaces:** None (markdown prose only, no code).

Both files are currently byte-identical, so the same edit applies to both verbatim.

- [ ] **Step 1: Confirm current text (both files)**

Both files currently read, right before `## STEP 1 — Setup`:

```
WRITES: src/pages/blog/<slug>.astro (hand-built, following the site's page
pattern) + FAQPage schema. There is no `src/content/` collection.

## STEP 1 — Setup
```

- [ ] **Step 2: Insert the STOP gate in both files**

Replace that block in **both** files with:

```
WRITES: src/pages/blog/<slug>.astro (hand-built, following the site's page
pattern) + FAQPage schema. There is no `src/content/` collection.

If briefs/<slug>.json is missing, STOP — run page-brief first.

## STEP 1 — Setup
```

This is the exact wording `content-writer` already uses (`If briefs/<slug>.json is missing, STOP — run page-brief first.`), placed in the same relative spot (right after the WRITES line, before the step-by-step body).

- [ ] **Step 3: Verify the edit landed in both files**

Run:
```bash
grep -c "If briefs/<slug>.json is missing, STOP" "C:\Users\admin\.claude\skills\blog-writer\SKILL.md" "D:\Claude Code\Curious Tails\.claude\skills\blog-writer\SKILL.md"
```
Expected: `1` for each file.

- [ ] **Step 4: Commit (project copy is gitignored — nothing to commit there)**

The global copy (`C:\Users\admin\.claude\skills\...`) is outside this repo; if it's under its own git repo, commit it there separately. Nothing to commit in the Curious Tails repo for this task (`.claude/` is gitignored).

---

### Task 2: page-brief typo fix

**Files:**
- Modify: `C:\Users\admin\.claude\skills\page-brief\SKILL.md`
- Modify: `D:\Claude Code\Curious Tails\.claude\skills\page-brief\SKILL.md`

**Interfaces:** None (markdown prose only).

Both files are currently byte-identical.

- [ ] **Step 1: Confirm current text (both files)**

```
its own. Every time this skill runs, it means: read and execute
`seo-information-gain-briefSKILL.md` in full, for the one page being briefed.
```

- [ ] **Step 2: Fix the concatenation typo in both files**

Replace with:

```
its own. Every time this skill runs, it means: read and execute the
`seo-information-gain-brief` skill's SKILL.md in full, for the one page being briefed.
```

- [ ] **Step 3: Verify**

```bash
grep -c "seo-information-gain-briefSKILL" "C:\Users\admin\.claude\skills\page-brief\SKILL.md" "D:\Claude Code\Curious Tails\.claude\skills\page-brief\SKILL.md"
```
Expected: `0` for each file (the broken string no longer exists).

---

### Task 3: `check-briefs` — pure core + unit tests + CLI

**Files:**
- Create: `D:\Claude Code\Curious Tails\scripts\lib\check-briefs-core.mjs`
- Create: `D:\Claude Code\Curious Tails\scripts\lib\check-briefs-core.test.mjs`
- Create: `D:\Claude Code\Curious Tails\scripts\check-briefs.mjs`
- Modify: `D:\Claude Code\Curious Tails\package.json`

**Interfaces:**
- Produces (consumed by Task 4's hook and by anyone running `npm run check:briefs`):
  - `classifyPage(relPath: string): { relPath: string, slug: string, pageType: 'breed_page' | 'blog' } | null`
  - `findViolations({ pages: ReturnType<classifyPage>[], blueprintSlugs: Set<string>, briefSlugs: Set<string> }): { missingBlueprint: Array, missingBrief: Array }`
  - CLI: `node scripts/check-briefs.mjs` (full repo scan) or `node scripts/check-briefs.mjs --staged` (git-staged added files only); exit code `0` = clean, `1` = violations found.
- Consumes: `parseCSV(filePath: string): Array<Record<string,string>>` already exported by `scripts/csv_parser.mjs` (quote-aware CSV parser, paths resolved relative to repo root).

- [ ] **Step 1: Write the failing unit tests**

Create `D:\Claude Code\Curious Tails\scripts\lib\check-briefs-core.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyPage, findViolations } from './check-briefs-core.mjs';

test('classifyPage: breed page under src/pages/puppies', () => {
  const result = classifyPage('src/pages/puppies/pug.astro');
  assert.deepEqual(result, { relPath: 'src/pages/puppies/pug.astro', slug: 'pug', pageType: 'breed_page' });
});

test('classifyPage: blog page under src/pages/blog', () => {
  const result = classifyPage('src/pages/blog/puppy-teething.astro');
  assert.deepEqual(result, { relPath: 'src/pages/blog/puppy-teething.astro', slug: 'puppy-teething', pageType: 'blog' });
});

test('classifyPage: index.astro is excluded', () => {
  assert.equal(classifyPage('src/pages/puppies/index.astro'), null);
});

test('classifyPage: pages outside gated dirs are excluded', () => {
  assert.equal(classifyPage('src/pages/about-us.astro'), null);
});

test('classifyPage: normalizes Windows backslash paths', () => {
  const result = classifyPage('src\\pages\\puppies\\corgi.astro');
  assert.equal(result.slug, 'corgi');
  assert.equal(result.pageType, 'breed_page');
});

test('findViolations: page missing from blueprint entirely', () => {
  const pages = [{ relPath: 'src/pages/puppies/maltese.astro', slug: 'maltese', pageType: 'breed_page' }];
  const { missingBlueprint, missingBrief } = findViolations({
    pages,
    blueprintSlugs: new Set(),
    briefSlugs: new Set(),
  });
  assert.equal(missingBlueprint.length, 1);
  assert.equal(missingBlueprint[0].slug, 'maltese');
  assert.equal(missingBrief.length, 0);
});

test('findViolations: page in blueprint but no brief file', () => {
  const pages = [{ relPath: 'src/pages/puppies/pug.astro', slug: 'pug', pageType: 'breed_page' }];
  const { missingBlueprint, missingBrief } = findViolations({
    pages,
    blueprintSlugs: new Set(['pug']),
    briefSlugs: new Set(),
  });
  assert.equal(missingBlueprint.length, 0);
  assert.equal(missingBrief.length, 1);
  assert.equal(missingBrief[0].slug, 'pug');
});

test('findViolations: page with both blueprint row and brief passes clean', () => {
  const pages = [{ relPath: 'src/pages/puppies/cavapoo.astro', slug: 'cavapoo', pageType: 'breed_page' }];
  const { missingBlueprint, missingBrief } = findViolations({
    pages,
    blueprintSlugs: new Set(['cavapoo']),
    briefSlugs: new Set(['cavapoo']),
  });
  assert.equal(missingBlueprint.length, 0);
  assert.equal(missingBrief.length, 0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/lib/check-briefs-core.test.mjs`
Expected: FAIL — `Cannot find module './check-briefs-core.mjs'` (module doesn't exist yet).

- [ ] **Step 3: Implement the pure core module**

Create `D:\Claude Code\Curious Tails\scripts\lib\check-briefs-core.mjs`:

```javascript
const GATED_DIRS = {
  'src/pages/puppies/': 'breed_page',
  'src/pages/blog/': 'blog',
};

export function classifyPage(rawPath) {
  const relPath = rawPath.replace(/\\/g, '/');
  const base = relPath.split('/').pop().replace(/\.astro$/, '');
  if (base === 'index') return null;

  for (const [dir, pageType] of Object.entries(GATED_DIRS)) {
    if (relPath.includes(dir)) {
      return { relPath, slug: base, pageType };
    }
  }
  return null;
}

export function findViolations({ pages, blueprintSlugs, briefSlugs }) {
  const missingBlueprint = [];
  const missingBrief = [];

  for (const page of pages) {
    if (!blueprintSlugs.has(page.slug)) {
      missingBlueprint.push(page);
      continue;
    }
    if (!briefSlugs.has(page.slug)) {
      missingBrief.push(page);
    }
  }

  return { missingBlueprint, missingBrief };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/lib/check-briefs-core.test.mjs`
Expected: PASS — 8 tests, 0 failures.

- [ ] **Step 5: Add the `test` npm script**

In `D:\Claude Code\Curious Tails\package.json`, add to `"scripts"`:

```json
    "test": "node --test scripts/lib/*.test.mjs",
```

Insert it after the `"astro": "astro"` line (before `"blog:create"`).

- [ ] **Step 6: Run via npm to confirm the script works**

Run: `npm test`
Expected: same PASS output as Step 4, via the npm script.

- [ ] **Step 7: Write the CLI wrapper**

Create `D:\Claude Code\Curious Tails\scripts\check-briefs.mjs`:

```javascript
#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { parseCSV } from './csv_parser.mjs';
import { classifyPage, findViolations } from './lib/check-briefs-core.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const GATED_TYPES = new Set(['breed_page', 'blog']);

function getStagedAddedAstroFiles() {
  const output = execSync('git diff --cached --name-only --diff-filter=A', {
    cwd: projectRoot,
    encoding: 'utf-8',
  });
  return output.split('\n').map((l) => l.trim()).filter(Boolean);
}

function getAllBuiltAstroFiles() {
  const dirs = ['src/pages/puppies', 'src/pages/blog'];
  const files = [];
  for (const dir of dirs) {
    const fullDir = path.join(projectRoot, dir);
    if (!fs.existsSync(fullDir)) continue;
    for (const f of fs.readdirSync(fullDir)) {
      if (f.endsWith('.astro')) files.push(`${dir}/${f}`);
    }
  }
  return files;
}

function main() {
  const staged = process.argv.includes('--staged');
  const rawPaths = staged ? getStagedAddedAstroFiles() : getAllBuiltAstroFiles();
  const pages = rawPaths.map(classifyPage).filter(Boolean);

  if (pages.length === 0) {
    console.log('check-briefs: no gated pages to check');
    process.exit(0);
  }

  const rows = parseCSV('research/site-blueprint.csv').filter((r) => GATED_TYPES.has(r.page_type));
  const blueprintSlugs = new Set(rows.map((r) => r.url_slug.split('/').filter(Boolean).pop()));

  const briefsDir = path.join(projectRoot, 'briefs');
  const briefSlugs = new Set(
    fs.existsSync(briefsDir)
      ? fs.readdirSync(briefsDir).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''))
      : []
  );

  const { missingBlueprint, missingBrief } = findViolations({ pages, blueprintSlugs, briefSlugs });

  if (missingBlueprint.length === 0 && missingBrief.length === 0) {
    console.log(`check-briefs: OK (${pages.length} page(s) checked)`);
    process.exit(0);
  }

  if (missingBlueprint.length > 0) {
    console.error('\nBuilt outside the pipeline (no research/site-blueprint.csv row):');
    for (const p of missingBlueprint) console.error(`  - ${p.relPath}`);
  }
  if (missingBrief.length > 0) {
    console.error('\nMissing briefs/<slug>.json (page built without page-brief):');
    for (const p of missingBrief) console.error(`  - ${p.slug}  (${p.relPath})  -> run: /page-brief ${p.slug}`);
  }
  console.error(`\ncheck-briefs: FAILED - ${missingBlueprint.length + missingBrief.length} violation(s)`);
  process.exit(1);
}

main();
```

- [ ] **Step 8: Add the `check:briefs` npm script**

In `package.json`, add to `"scripts"` (after the `"test"` line added in Step 5):

```json
    "check:briefs": "node scripts/check-briefs.mjs",
```

- [ ] **Step 9: Run against the real repo and confirm it matches the known audit findings**

Run: `npm run check:briefs`
Expected: exit code `1`, and the "Missing briefs" list contains exactly these 27 slugs (from the 2026-07-15 audit) plus `maltese` reported under "Built outside the pipeline" (it has no blueprint row at all yet, so it can't also appear as "missing brief" until Task 2 of the retro-brief plan adds its blueprint row):

```
cavalier-king-charles-spaniel, cavapoochon, chihuahua, cocker-spaniel,
english-bulldog, german-shepherd, goldendoodle, italian-greyhound,
jack-russell-terrier, japanese-spitz, labradoodle, miniature-pinscher,
miniature-schnauzer, papillon, pekingese, pomeranian, pug,
scottish-terrier, sheltie, shih-tzu, shihpoo, silky-terrier,
toy-poodle, westie, whippet, yorkshire-terrier
```

(26 in "missing brief" — `maltese` is the 27th slug but surfaces as "missing blueprint" instead, since it has neither. If the actual output differs from this list, the repo has changed since the audit — trust the live output, update this plan's expectation, and proceed.)

- [ ] **Step 10: Commit**

```bash
git add scripts/lib/check-briefs-core.mjs scripts/lib/check-briefs-core.test.mjs scripts/check-briefs.mjs package.json
git commit -m "feat: add check-briefs script to detect pages built without a brief"
```

---

### Task 4: Pre-commit hook wiring

**Files:**
- Create: `D:\Claude Code\Curious Tails\.githooks\pre-commit`
- Modify: `D:\Claude Code\Curious Tails\.claude\docs\RUN-THE-PROJECT.md`

**Interfaces:**
- Consumes: `node scripts/check-briefs.mjs --staged` (Task 3's CLI, exit code contract).

- [ ] **Step 1: Create the hook script**

Create `D:\Claude Code\Curious Tails\.githooks\pre-commit`:

```sh
#!/bin/sh
node scripts/check-briefs.mjs --staged
exit $?
```

- [ ] **Step 2: Make it executable and point git at the hooks directory**

```bash
chmod +x .githooks/pre-commit
git config core.hooksPath .githooks
```

`core.hooksPath` is a per-clone local setting (lives in `.git/config`, not versioned) — this is why Step 4 documents it in the setup doc.

- [ ] **Step 3: Verify it BLOCKS a new unbriefed page**

```bash
echo "---" > src/pages/puppies/__hooktest__.astro
git add src/pages/puppies/__hooktest__.astro
git commit -m "test: should be blocked"
```
Expected: commit is rejected; output includes `__hooktest__` under "Built outside the pipeline" and the process exits non-zero (no new commit created — confirm with `git log -1 --oneline` still showing the prior commit).

Clean up:
```bash
git reset src/pages/puppies/__hooktest__.astro
rm src/pages/puppies/__hooktest__.astro
```

- [ ] **Step 4: Verify it ALLOWS a page that already has a blueprint row and a brief**

`stop-puppy-biting` already has both a `blog` row in `research/site-blueprint.csv` (line 52) and `briefs/stop-puppy-biting.json`, but no built page yet — use it as a real fixture:

```bash
echo "---" > src/pages/blog/stop-puppy-biting.astro
git add src/pages/blog/stop-puppy-biting.astro
git commit -m "test: should be allowed"
```
Expected: commit succeeds (hook prints `check-briefs: OK...`).

Clean up immediately — this was a mechanics check, not a real page:
```bash
git reset --soft HEAD~1
git reset src/pages/blog/stop-puppy-biting.astro
rm src/pages/blog/stop-puppy-biting.astro
```

- [ ] **Step 5: Document the one-time setup step**

In `D:\Claude Code\Curious Tails\.claude\docs\RUN-THE-PROJECT.md`, the `## ONE-TIME SETUP` section currently ends with item 3 ("Review supporting docs") followed by a `---`. Insert a new item 4 before that `---`:

```markdown
4. **Enable the brief-check pre-commit hook** (once per clone)
   - `chmod +x .githooks/pre-commit`
   - `git config core.hooksPath .githooks`
   - Blocks committing a new breed/blog page under `src/pages/puppies/` or
     `src/pages/blog/` that has no matching `research/site-blueprint.csv` row
     or `briefs/<slug>.json`. Run `npm run check:briefs` any time to check
     the whole repo, not just staged files.
```

- [ ] **Step 6: Commit the hook (RUN-THE-PROJECT.md is gitignored, nothing to commit there)**

```bash
git add .githooks/pre-commit
git commit -m "feat: add git pre-commit hook enforcing brief-before-page"
```

---

### Task 5: Cite the literal command in Definition of Done

**Files:**
- Modify: `C:\Users\admin\.claude\skills\local-seo-orchestrator\SKILL.md`
- Modify: `D:\Claude Code\Curious Tails\.claude\skills\local-seo-orchestrator\SKILL.md`

**Interfaces:** None (markdown prose only).

Both files currently have identical text at this line.

- [ ] **Step 1: Confirm current text (both files, line 42)**

```
- [ ] `briefs/<slug>.json` exists (page-brief ran).
```

- [ ] **Step 2: Replace in both files**

```
- [ ] `briefs/<slug>.json` exists (page-brief ran) — verify with `npm run check:briefs`, don't just eyeball it.
```

- [ ] **Step 3: Verify**

```bash
grep -c "verify with .npm run check:briefs" "C:\Users\admin\.claude\skills\local-seo-orchestrator\SKILL.md" "D:\Claude Code\Curious Tails\.claude\skills\local-seo-orchestrator\SKILL.md"
```
Expected: `1` for each file.
