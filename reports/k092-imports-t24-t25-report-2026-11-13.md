# K-092 â€” imports T24 (GA4) + T25 (daily schedule + alerts) report (2026-11-13)

**Scope:** the two remaining steps before a daily run: meaningful GA4 events for
imported listings, and a once-a-day scheduled sync with durable failure alerts.
**Branch:** `main`, worktree `D:\Claude Code\Curious Tails`, **no commit made**.
**Constraints held:** no deploy, no production write, `IMPORTS_AUTOPUBLISH`
unset (and the scheduled runner forces it off), no `rtp-v3`, no other project.
`check:design` and the stale local feed were not touched.

---

## T24 â€” GA4 events for imported listings

All events reuse the existing `BaseLayout.astro` `gtag()` / `dataLayer` wiring.
There is no second analytics library, no tag-manager container and no cookie
banner change.

| Event | Fires on | Payload (real captured values) |
|---|---|---|
| `import_view` | Load of every ` /puppies/<breed>/imp-<10 hex>/ ` page | `{ listing_type: "imported", breed: "jack-russell-terrier", import_id: "imp-43ca0ce8e2", page_path: "/puppies/jack-russell-terrier/imp-43ca0ce8e2/" }` |
| `whatsapp_click` (existing event) | Any WhatsApp link; `listing_type` added | Imported page: `{ link_url: "https://wa.me/â€¦", link_text: "Reserve on WhatsApp", wa_source: "/puppies/jack-russell-terrier/imp-43ca0ce8e2/ import:imp-43ca0ce8e2", listing_type: "imported" }` Â· Local card: `{ â€¦, wa_source: "/puppies/bichon-frise/ pup:2980", listing_type: "local", wa_variant: "fixed-2026-10b" }` |
| `phone_click` (existing event) | Any `tel:` link; `listing_type` added on detail pages | Imported page: `{ link_url: "tel:+6582206408", link_text: "8220 6408", listing_type: "imported" }` |
| `import_filter_click` | A chip on `/available-puppies/` | `{ filter_value: "imported", filter_label: "Arriving soon", listing_type: "imported", page_path: "/available-puppies/" }` Â· also `all` / `local` (`"In the shop now"`) |
| `import_details_click` | "See photos & details" on an imported card | `{ link_url: "/puppies/jack-russell-terrier/imp-43ca0ce8e2/", link_text: "See photos & details", wa_source: "/available-puppies/ import:imp-43ca0ce8e2", listing_type: "imported" }` |

`listing_type` is derived from the `data-wa-source` prefix already stamped by the
cards (`import:` â†’ imported, `pup:` â†’ local), with the detail-page path as the
fallback for chrome CTAs. One enquiry event, one GA4 segment: imported vs local
CVR needs no second event name.

**Verification is a captured dataLayer, not a source read.** `scripts/verify-ga4-imports.mjs`
builds a fixture imported page through the real pipeline, serves `dist`, then
asserts every payload in Playwright's `window.dataLayer` with remote GA and
outbound navigation blocked. Result: **43/43 assertions pass**, 1 `import_view`,
1 imported `whatsapp_click`, 1 `phone_click`, 3 `import_filter_click`, 1
`import_details_click` and 1 local `whatsapp_click`. Full capture:
`reports/k092-ga4-events.json`; build/cleanup proof: `reports/k092-t24-proof.json`.
The proof restores the real feed/assets and rebuilds; `fixturePageGone: true`.

`npm run check:ga4` now reads `GA4_EVENTS` from `src/data/registry.ts` and also
scans literal `gtag('event', â€¦)` calls, so the declared set is complete:

```
| eventName |
| call_click |
| cta_click |
| import_details_click |
| import_filter_click |
| import_view |
| mailto_click |
| outbound_click |
| phone_click |
| whatsapp_click |
ga4-events: declared=9 observed=0 silent=0
```

---

## T25 â€” daily schedule + alerts

### The task

- **Task name:** `Curious Tails Imports Sync`
- **Schedule:** daily at **06:15 machine local time** (Asia/Singapore).
- **Action:**

  ```text
  "C:\Program Files\nodejs\node.exe" ^
    "D:\Claude Code\Curious Tails\scripts\imports\run-daily.mjs" ^
    --dotenv "C:\Users\admin\.claude\.env"
  ```

  Working directory: `D:\Claude Code\Curious Tails`.
- **State:** registered and `Ready` on this machine as a per-user task (this
  shell is not Administrator, so the SYSTEM install could not be used). A
  SYSTEM-task setup script is provided for the unattended install:
  `setup-imports-task.ps1` (run as Administrator). The per-user task runs while
  the user is logged on; the SYSTEM task runs logged out.
- **Manual equivalent:** `npm run sync:imports:daily -- --no-fetch` (zero
  network) or `scripts\imports\run-daily.bat --no-fetch`.
- **Never:** `astro build`, `git commit`, `npm run deploy`, a Cloudflare
  command, or `IMPORTS_AUTOPUBLISH`. `run-daily.mjs` deletes
  `IMPORTS_AUTOPUBLISH` from the environment even if an outer shell sets it;
  a clean item is `auto-ready`, never published.
- **Disable / re-enable / remove** (also in `docs/imports-daily-schedule.md`):

  ```powershell
  Disable-ScheduledTask   -TaskName 'Curious Tails Imports Sync'
  Enable-ScheduledTask    -TaskName 'Curious Tails Imports Sync'
  Unregister-ScheduledTask -TaskName 'Curious Tails Imports Sync' -Confirm:$false
  ```

### Files a run leaves

| File | Meaning |
|---|---|
| `logs/imports/<UTC date>.log` | Counts-only run log. At 06:15 SGT the UTC date is usually the previous day; this is documented. |
| `logs/imports/last-run.json` | Clean-run record: status, exit code, mode, `autopublish:false`, counts, gates, queue counts, alert reasons, board result. |
| `logs/imports/NEEDS-ATTENTION.md` | Durable alert, written on any hard/soft reason. Not auto-deleted by a later success; the owner deletes it after reading. |
| `NEEDS-ATTENTION.md` (repo root) | Pointer the next session sees immediately. |

A Windows toast is not used. If `BOARD_TOKEN` and `BOARD_URL` exist in the task
environment (or in the dotenv file passed with `--dotenv`) the same alert is
POSTed with a bearer token; without a token the file says `no BOARD_TOKEN`.
There is no default board URL, and the local Orca kanban exposes no alert
endpoint, so today the file is the alert.

### Failure classification

| Condition | Exit | Reason |
|---|---|---|
| Source host blocked (403 / Cloudflare / challenge; error-level HTTP alert) | **1** | `source-blocked` |
| Published photo missing from `src/assets/imported` | **1** | `missing-photo` |
| Feed schema/leak validation, busy lock, store error, unexpected exception | **1** | the thrown reason |
| Source/adapter error that is not a block | 0 | `source-error` / `adapter-error` |
| Review queue > 20 items, or oldest > 72 h | 0 | `review-backlog` / `review-backlog-age` |

Hard failures also make `npm run sync:imports` exit non-zero, not just the
scheduled wrapper: `sync-imports.mjs` now classifies the summary before printing
its counts. This is the code fix that stops a blocked source from looking like a
successful run.

### Proof runs

All in temp repos/stores (`reports/k092-t25-proof.json`), plus one real
`--no-fetch` run in this repo.

| Run | Exit | Artefacts |
|---|---|---|
| **Forced blocked host** (fake dogsy adapter returns `blocked:true`) | **1** | `logs/imports/NEEDS-ATTENTION.md`, root `NEEDS-ATTENTION.md`, log, `last-run.json` status `failed`; alert contains `source-blocked`; `board.skipped = no-board-token` |
| **Forced schema violation** (a malformed carried feed entry with `priceSGD: "not-a-number"`) | **1** | same three artefacts; alert contains `feed-validation` and the `priceSGD` path; the malformed feed is left untouched, not silently rewritten |
| **Clean success** (clean record, `--no-fetch`, inherited `IMPORTS_AUTOPUBLISH=1`) | **0** | no alert/pointer; `last-run.json` status `ok`, `autopublish:false`, `autopublishEnvPresent:true`, queue `autoReady:1`, `feedPups:0` |
| **Real repo success** (`node scripts/imports/run-daily.mjs --no-fetch`) | **0** | `logs/imports/last-run.json` status `ok`, `logs/imports/2026-11-13.log`; feed stays empty |
| **Task Scheduler selftest** (temporary task running the same action with `--no-fetch`) | **0** | `Get-ScheduledTaskInfo.LastTaskResult = 0`, `last-run.json` advanced; temporary task removed |

The Task Scheduler selftest proves the scheduler can launch Node with the quoted
action, the repo working directory and the explicit dotenv path. A live fetch was
not added to the proof to avoid hammering sources; the same live path was run in
K-091 (41 requests, 4 s spacing, zero `dogs.ie` requests) and the spacing tests
still pass.

---

## Quality gates

| Gate | Result |
|---|---|
| `npm run test:imports` | **PASS** â€” 174 tests, 174 pass, 0 fail |
| `npm run check:ga4` | **PASS** â€” lists `import_details_click`, `import_view`, `import_filter_click`, `phone_click` |
| `npm run check:import-leaks -- --dist` | **PASS** â€” `OK (feed=1 assets=0 dist=140 denylist values=0 shingles=0)` |
| `npm run check:tokens` | **PASS** â€” `checked=45 failed=0` |
| `npm run build` | **PASS** â€” fixture build, clean build and restore build all completed |
| `npm run check:design` | Not run/fixed â€” pre-existing sitewide failure per the card |
| `npm run feed:check` | Not run/fixed â€” pre-existing stale local shop feed per the card |
| 4 s persisted spacing / robots on redirect | No regression: `http.test.mjs` and the fetch-spacing tests pass; the only pipeline change is the alert classification flag |

---

## Is the imported feed now safe to leave running unattended?

**Yes for the mechanical sync:** it cannot publish, cannot deploy, forces
`IMPORTS_AUTOPUBLISH` off, and a blocked source, missing photo or invalid feed
exits non-zero and leaves `NEEDS-ATTENTION.md` where the next session sees it.
**The next morning a human still needs to:** approve the `auto-ready` queue in
`npm run review:imports` (or `approve:import`) before anything reaches the site,
resolve any `source-blocked` host (the pipeline never retries or bypasses it),
and make the T17 legal decision before `IMPORTS_AUTOPUBLISH` can be turned on.

