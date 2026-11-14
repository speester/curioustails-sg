# K-135 — Imports review sheet (read-only)

- **Preview:** https://k135-review-sheet.curioustails-staging.pages.dev/ (deployment https://94e83966.curioustails-staging.pages.dev)
- Project `curioustails-staging`, branch `k135-review-sheet` (preview). Production untouched; not linked from `src/`.
- noindex three ways: `X-Robots-Tag: noindex, nofollow` (served), `<meta name="robots" content="noindex,nofollow,noarchive">`, `robots.txt Disallow: /`.
- Live HTML is byte-identical to `_k135_stage/index.html` (sha256 7d157a58…feb7).

## Counts (match `logs/imports/last-run.json` queue: autoReady 11, review 73)

| total queued | auto-ready | review | DogQuest | IrishPuppies | DFSI (lead only) | Puppies.ie (lead only) | missing photo | missing price |
|---|---|---|---|---|---|---|---|---|
| 84 | 11 | 73 | 4 | 10 | 4 | 66 | 70 | 0 |

Note: the brief says "73 listings"; 73 is the **review** count. The queue holds 84 (11 auto-ready + 73 review); the sheet shows all 84, auto-ready first.

## Answer

**12 of 84 are one click from publishable** (11 auto-ready + #82, review with only a waivable "short description").
**73 are there because a gate could not decide**: 70 are lead-only (DFSI / Puppies.ie — the approve tool refuses them, so only reject or keep as a lead), 2 need an edit first (#83 arrival month Oct 2026 already past; #84 breed not mappable). Lead-only rows are 70 of the 70 missing a photo.

## Verify

- 1440 and 390: horizontal overflow 0, 14/14 photos decode, 84 rows, chips All 84 · auto-ready 11 · review 73 · DogQuest 4 · IrishPuppies 10 · DFSI 4 · Puppies.ie 66 (checked on the live URL with Playwright).
- Screenshots: `reports/k135/k135-review-sheet-1440.png`, `reports/k135/k135-review-sheet-390.png` (full page) and `-top.png` (first screen).
- Privacy: build fails closed on any seller name/phone/email, source URL, microchip number, URL, email or phone-like digit run. `check:import-leaks --dist _k135_stage` reports only `supplier-token` (the source site names the brief requires); with those masked the same scan is **OK** (1084 denylist values, 5076 description shingles).
- Private store read only: `review-queue.json` (06:36) and `imports-state.json` (13:06) mtimes unchanged.

## Rebuild

    python outputs/build-k135-review-sheet.py
    python ~/.claude/scripts/with_env.py -- npx.cmd wrangler pages deploy _k135_stage --project-name curioustails-staging --branch k135-review-sheet --commit-dirty=true

Row numbers (#1–#84) are fixed for this build; the `imp-…` id under each is what `npm run approve:import -- reject <imp-id>` takes. A rebuild after a new run can renumber.
