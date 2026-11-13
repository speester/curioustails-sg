# K-089 — Imports T15 + T16 report (2026-11-13)

**Verdict:** T15 and T16 are complete against the task spec and the on-disk tests. `npm run test:imports` is
**161/161 green** (132 at `21f02b9`; the uncommitted T15/T16 test files add 29). The live bounded run moved a real
dogsy listing `auto-ready → approved → published → taken down`, and a later autopublish run did not bring it back.

## What was already on disk, and what was missing

Reused without redesign:

- `scripts/imports/lib/leaks.mjs` (denylist + feed/asset/dist scanners)
- `scripts/imports/check-leaks.mjs` (CLI gate, fails closed without the private store)
- `scripts/imports/tests/leaks.test.mjs`, `scripts/imports/tests/review.test.mjs`,
  `scripts/imports/tests/_pipeline-fixtures.mjs`
- `package.json` `build:deploy` wiring and `scripts/deploy-pages.sh` scan-before-wrangler

Missing, so written this session:

- `scripts/imports/lib/owner.mjs` — queue projection and the four owner actions
- `scripts/imports/review.mjs` — loopback-only server and page
- `scripts/imports/approve.mjs`, `scripts/imports/unpublish.mjs` — CLI equivalents
- pipeline decision handling (`state.decisions`), queue fields (`gates`, `reviewReasons`, `source.site`, `leadOnly`)
- `scripts/lib/puppy-redirects.mjs` — reads `src/data/imported-retired.json` as well as the placed archive

No half-built file was unusable; nothing was rewritten from scratch.

## T15 — leak gate

| Acceptance item | Result |
|---|---|
| Inject `dogsy.ie` into a test copy of the public JSON → exit 1 | **PASS** — `✔ T15: injecting 'dogsy.ie' ... exits 1`, output names `supplier-token`, not the value |
| Inject a real microchip from the private store → exit 1 | **PASS** — `✔ T15: injecting a real microchip ... exits 1`; scanner prints `microchip`, never the number |
| A clean build exits 0 | **PASS** — `✔ T15: a clean build (feed, assets, dist) exits 0` |
| Scan covers the built `dist` | **PASS** — microchip in `dist` schema output is caught (`✔ ... even split by spaces`), a supplier-named dist file is caught, and the real repo scan covers 140 dist text files |
| `build:deploy` stops before deploy | **PASS** — script order test sees `check:import-leaks --dist` after `astro build`; `deploy-pages.sh` runs it before `wrangler pages deploy` |
| Fails closed without the private store | **PASS** — exit 1, and the scanner does not create the store |

Commands and output:

```
$ node --test --test-name-pattern="T15" scripts/imports/tests/leaks.test.mjs
tests 12 / pass 12 / fail 0

$ npm run check:import-leaks
check:import-leaks: OK (feed=1 assets=0 dist=skipped denylist values=0 shingles=0)   EXIT=0

$ npm run check:import-leaks -- --dist
check:import-leaks: OK (feed=1 assets=0 dist=140 denylist values=0 shingles=0)       EXIT=0
```

Also covered by the same file: seller name / phone / email / listing id / source URL each caught; an 8-word copied
description run caught and 7 words not; platform tokens matched as words (not inside a JS hash); supplier-named
assets and EXIF-bearing WebPs rejected.

## T16 — review queue and owner actions

| Acceptance item | Result |
|---|---|
| Server binds only to `127.0.0.1`; test asserts the bind address | **PASS** — `REVIEW_HOST='127.0.0.1'`, `REVIEW_PORT=4791`; with `HOST` and `IMPORTS_REVIEW_HOST` both `0.0.0.0`, the socket address is `{ address: '127.0.0.1', family: 'IPv4' }` |
| Foreign Host header / missing action token refused | **PASS** — both 403; nothing is decided |
| Queue shows source, breed, sex, age, price, photos, gates, reasons | **PASS** — 15 gates, 3 photos, private source link, `auto-ready` vs `review` dispositions |
| No seller data, microchip, description, county/town or raw price in the queue/page | **PASS** — JSON and HTML checked against the fixture seller name/phone/chips and banned keys |
| Photos served from the private stage, nothing else | **PASS** — only a queued `imp-*.webp`; traversal and unknown ids 404 |
| Approve then sync publishes; approve alone does not | **PASS** — feed 0 after approve, 1 after sync, 3 WebPs copied, `published` audit |
| Reject keeps the item out on later runs | **PASS** — two syncs with `IMPORTS_AUTOPUBLISH=1` and the valve off stay empty, and a cross-supplier relist sharing a chip is rejected too |
| `dfsi` and `puppies.ie` are unapprovable in the UI | **PASS** — 409 with `lead-only`; page says why; state file byte-identical; a forged approve decision still never publishes |
| Missing required field needs an edit; a no-microchip item can be approved | **PASS** — G1 refusal says `needs an edit`; G10-only review item approves and publishes |
| Reserve marks a live pup reserved and survives a source `sold` | **PASS** — feed shows `reserved` at once; later sync keeps it |
| Reserve / unpublish refuse a non-live item | **PASS** — `not live` |
| `unpublish --reason takedown` removes JSON + WebPs, adds redirect, audits actor/time | **PASS** — feed 0, repo and private stage WebPs gone, `imported-retired.json = [{ id, breed }]`, `takedown` line has `actor`, ISO `at` and `detail.reason`, plus `purged` |
| `imported-retired.json` only `{id, breed}`, once per id | **PASS** |
| Retired imported pup 301s to its breed page at build | **PASS** — breed page when built, `/puppies/` otherwise |
| Owner action logs carry no phone, email, URL or microchip | **PASS** — regex check over CLI output and `logs/imports/*` |

Command:

```
$ node --test --test-name-pattern="T16" scripts/imports/tests/review.test.mjs
tests 17 / pass 17 / fail 0
```

Design notes:

- The action token is generated per server process and embedded in the page; the page is never cached.
- `approveItem` refuses anything whose failures are outside the owner-waivable set `{G9, G10, G12, G14}` and refuses
  every lead-only supplier before writing. The pipeline repeats the lead-only check, so a hand-edited state file
  cannot publish one.
- A standing `approve` only gets an item into the feed. Once live, normal liveness/gate rules still take it down.
- Dedupe now declines the fuzzy fallback when both records already carry processed dHash sets and none matched. Two
  distinct photo sets are better evidence than same-breed/age/county/price; without this, the T16 queue fixtures
  (and real different litters from one county) collapse into one card. Records without processed photos still fuzzy
  merge exactly as before.

## Live bounded run

Run with a real dogsy fetch (`--source dogsy --max-detail 5`), a fresh temp private store and a temp repo, so the
real project and site data were untouched. The owner flow used the real review server and CLI.

| Step | Observed |
|---|---|
| Live fetch | discovered 38, records 5, groups 5, gates pass 4 / reject 1 / auto-ready 4, images 15/0 failed, feed 0 |
| Queue after first sync | 4 auto-ready, 0 review, feed 0 |
| Review server | bound `127.0.0.1` IPv4, page 200 with token |
| Approve action | HTTP 200; feed still 0 |
| Sync after approve | `summary.published=1`, feed 1 (`imp-0d2b8993b2`, `published`, 3 photos, 6 asset files) |
| `unpublish --reason takedown` | exit 0; feed 0; repo assets 0; private stage 0; retired `[{ id, breed: 'toy-poodle' }]`; `takedown` audit actor `owner:live-run` at `2026-11-13T13:05:11.092Z`; `purged` audit present |
| Later autopublish sync | removed id absent from feed and queue; 3 other auto-ready items published by the explicit `IMPORTS_AUTOPUBLISH=1` test env, as expected |

The public feed, the retired list, the live logs and the audit all pass the phone/email/URL/microchip regex.

## Constraints

- `IMPORTS_AUTOPUBLISH` remains unset in the project and `~/.claude/.env`; no schedule was created.
- `node --test --test-name-pattern="K-085|4 s spacing" scripts/imports/tests/http.test.mjs` → **3/3 pass**
  (robots on redirect, cross-host hop, persisted spacing).
- No test performs a live fetch; fixtures are temp repos/stores only.
- `git status` was checked before and after the live run: the real repo gained no listing or asset.

## What is left before a daily scheduled run

**T25 is the only remaining hard dependency of the schedule itself** (its `depends_on` is T15 + T16). Nothing else
in the task graph blocks creating `run-daily.bat`, the Task Scheduler entry and alerts.

But T25 alone does not produce a daily run that is useful or complete:

1. **T21, T22, T23** (phase 4) are still open. The feed is written, but no page renders imported pups yet:
   breed-page cards, the imported detail branch with `PreOrder` + `noindex`, and the `/available-puppies/` section.
   Scheduling before those lands gives a queue and a JSON file nobody sees.
2. **T26** is the end-to-end safety-valve dry run and depends on T25 + T22 + T23. It is the acceptance proof for the
   first scheduled runs and should not be skipped.
3. **T16 has no edit path.** The tests (correctly) refuse approval of an item whose non-waivable gate fails, but
   there is no `overrides.json` / edit action to fix a missing price or photo. Such an item can only be rejected
   until the source listing changes. This is the one operational gap inside T16's scope worth scheduling next.
4. **G6 stock-photo/watermark flags are still never set** (noted in K-086). The 20-per-supplier safety valve and the
   explicit approve action contain the risk; it does not block the schedule, but it is not a solved gate.
5. **Detail budget and `raw/` retention** (K-084 §8 item 5) are still undecided. A full dfsi catch-up takes multiple
   runs and `raw/` grows without pruning. T25's alerts do not cover either.

Also by design: with `IMPORTS_AUTOPUBLISH` unset, a daily run only fills the queue. Someone must approve items
after each run; the schedule does not publish unattended.

So: **T25 only to switch the schedule on; T21–T23 and T26 for it to matter, plus the T16 edit path as the next
real gap.**
