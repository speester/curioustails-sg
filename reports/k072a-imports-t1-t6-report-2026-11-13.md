# K-072a — imports T1–T6: maths and tests

**Date:** 2026-11-13 · **Scope:** T1–T6 only. No T7–T10 adapter work, no `src/`, `outputs/`, live-site or other-project changes.

## Result

All imports tests pass: **50/50 after** (46/46 before). T5 `price.mjs` and T6 `arrival.mjs` already met every
acceptance value, so **neither file was edited** (0-byte diff). The one T1 acceptance item with no executable behind
it was the private-store guard, so the T1 entry point `scripts/imports/sync-imports.mjs` was added (guard + store open
only) and its npm script wired.

## Tests before / after, per file

Command: `node --test --test-reporter=tap scripts/imports/tests/*.test.mjs`

| File | Before (tests/pass/fail) | After (tests/pass/fail) |
|---|---|---|
| `arrival.test.mjs` | 6 / 6 / 0 | 6 / 6 / 0 |
| `breed-map.test.mjs` | 6 / 6 / 0 | 6 / 6 / 0 |
| `hash.test.mjs` | 4 / 4 / 0 | 5 / 5 / 0 |
| `http.test.mjs` | 10 / 10 / 0 | 10 / 10 / 0 |
| `price.test.mjs` | 6 / 6 / 0 | 6 / 6 / 0 |
| `rules.test.mjs` | 11 / 11 / 0 | 11 / 11 / 0 |
| `store.test.mjs` | 3 / 3 / 0 | 6 / 6 / 0 |
| **Total** | **46 / 46 / 0** | **50 / 50 / 0** |

Full-suite tail after: `# tests 50`, `# pass 50`, `# fail 0`, `# todo 0`.

## T5 acceptance evidence (`price.mjs`, unchanged)

| Input | Output |
|---|---|
| `€500` | `priceSGD 4500`, deposit `2250`, balance `2250`, review `[]` |
| `€1,200.00 (Negotiable)` | `priceSGD 5200`, `negotiable:true`, review `[]` |
| `POA` | review `["price-unparsed","currency-unknown"]`, `priceSGD:null` |
| `£450` | review `["currency-gbp"]` |
| `€1234` | review `["price-placeholder"]` |
| `€100` | review `["price-out-of-band"]` |
| `€4500` | review `["price-out-of-band"]` |
| `puppyPrices [650, 700]` | `priceSGD 4650`, `from:true` |
| margin | flat +4000, no FX (tests at 150, 777, 4000) |

## T6 acceptance evidence (`arrival.mjs`, unchanged)

| Input (today `2026-11-13`) | Output |
|---|---|
| DOB `2026-08-28`, listing `2026-11-01` | `date 2026-11-28`, `month 2026-11`, `basis dob`, `past:false` |
| age `8 weeks`, listing `2026-11-01` | `dob 2026-09-06`, `month 2026-12`, `basis age`, `needsReview:false` |
| no DOB, no age, listing `2026-11-01` | `month 2027-02`, `basis listing-date`, `needsReview:true` |
| DOB `2026-06-01` (base past) | `date 2026-09-01`, `past:true`, display `Flies once paperwork and flight are ready · subject to import approval` |
| display | every case contains `subject to import approval`; no day number, no "guarantee"/"confirmed" |

## Code diffs

### `scripts/imports/lib/price.mjs`

None. Owner rule untouched: `priceSGD = listed + 4000`.

### `scripts/imports/lib/arrival.mjs`

None. Owner rule untouched: DOB + about 3 months, no floor.

### New: `scripts/imports/sync-imports.mjs` (T1)

Minimal T1 entry point, 39 lines. It parses only `--dry-run` / `--no-fetch`, calls `openStore()` (which enforces
`IMPORTS_PRIVATE_DIR` outside the repo), prints one status line and exits. It contains **no** adapter, fetch, parse,
gate, image or write code — the pipeline stages stay with T14. It never prints the store path contents, seller fields
or `secret.key`.

### `package.json`

```diff
     "sync:puppies": "node scripts/sync-puppies.mjs",
+    "sync:imports": "node scripts/imports/sync-imports.mjs",
```

The other six T1 npm scripts were not added because their target CLIs do not exist yet (T14–T16); adding dangling
scripts would make `npm run` fail for a different reason and would amount to scaffolding outside this scope.

## Tests added / changed

No new test file. Two existing files were extended:

1. `scripts/imports/tests/store.test.mjs` — three tests:
   - `IMPORTS_PRIVATE_DIR` inside the repo: spawns the real CLI with `--dry-run`, asserts exit `1`, the message
     `Refusing to use IMPORTS_PRIVATE_DIR inside the repo`, no 64-hex secret, and that the refused directory was
     never created.
   - valid external temp dir: asserts exit `0`, all seven private-store artifacts exist, `secret.key` is 32 bytes,
     and neither the key's hex nor base64 appears in stdout/stderr.
   - `package.json` maps `sync:imports` to that guarded entry point, so the documented
     `npm run sync:imports -- --dry-run` is the code path under test.
2. `scripts/imports/tests/hash.test.mjs` — one test pinning a fixed HMAC-SHA256 vector
   (`HMAC('curious-tails-test-secret', 'dogsy:12345')` = `7d36983a…433c`), the exact `imp-`/`CT-IE-` derivation, and
   that changing either the supplier or the listing id changes the hash.

Manual check of the acceptance command:

```
$env:IMPORTS_PRIVATE_DIR = "D:\Claude Code\Curious Tails\scripts\imports\_cli-check"
npm run sync:imports -- --dry-run
→ imports: Refusing to use IMPORTS_PRIVATE_DIR inside the repo (D:\Claude Code\Curious Tails). …
→ exit=1

$env:IMPORTS_PRIVATE_DIR = "$env:TEMP\ct-imports-cli-manual"
npm run sync:imports -- --dry-run
→ imports: dry run — private store ready (raw/, images-src/, runs/, fixtures/).
→ exit=0, all seven artifacts present
```

## What T7–T10 still needs (deliberately left out)

T7–T10 need private fixtures/snapshots under `IMPORTS_PRIVATE_DIR/fixtures` and four per-supplier discovery+detail
parsers (dogsy API/JSON-LD, dogquest sitemap/RSC, dfsi sitemap/JSON-LD, puppies.ie lead-only), plus the snapshot
plumbing that stores raw pages privately — none of which this deterministic-maths-and-tests scope includes.

## Guardrails

- No T7–T10 adapter file was written, stubbed or scaffolded (`scripts/imports/adapters/` remains empty).
- No live request was made; no `src/`, `outputs/`, live-site, `rtp-v3` or other project file was touched.
- No test was skipped, marked todo, loosened, or made to pass by editing a fixture.
