# K-084 — Imports dry run against the real sources (2026-11-13)

**Verdict up front:** the *network behaviour* is safe to run daily — 27/27 requests returned 200, every same-host gap was ≥ 4.2 s, robots was obeyed, no host blocked us, no request went to `*.dogs.ie`, and nothing was published. The *feed* is not ready to be scheduled: `npm run sync:imports` is still the T1 store-guard stub and fetches nothing; the dry run had to use `capture.mjs`, the T7–T10 sample tool. There is no T14 orchestrator, no T13 gates, no review-queue or audit write, no run lock, and the redirect/robots gap is still open. What has to change first is listed in §8.

## 1. Configuration and private store

| Check | Result |
|---|---|
| `IMPORTS_PRIVATE_DIR` | Read from `~/.claude/.env`; resolved to `D:\Claude Code\_private\curious-tails-imports` |
| Outside the repo | Yes — `assertOutsideRepo()` passed against `D:\Claude Code\Curious Tails` |
| `secret.key` | Exists, 32 bytes. Contents were never read or printed. |
| Store layout | `raw/`, `images-src/`, `runs/`, `fixtures/` all exist; `review-queue.json` = `[]`; `audit.jsonl` = 0 lines before the run |
| `IMPORTS_AUTOPUBLISH` | Unset in the shell, the project `.env` and `~/.claude/.env` |
| `IMPORTS_DFSI_MODE` | Unset → the adapter's `lead-only` default |

## 2. What was actually run

### 2.1 The documented dry-run command

```
$ npm run sync:imports -- --dry-run
imports: dry run — private store ready (raw/, images-src/, runs/, fixtures/).
imports: no sources are wired yet (T14); nothing was fetched or written.
EXIT=0
```

This is the command the card names, and it exits 0 — but at `75d402b` it is a 39-line T1 entry point that only opens the private store. **It makes no network request and writes no record.** The fetch → parse → normalise pipeline is deliberately left to T14, which does not exist yet.

### 2.2 The live path that does exist

The only CLI at this commit that runs the T7–T10 adapters is `scripts/imports/capture.mjs`. It writes only to the private store and has no publish path, so it is inherently a dry run with respect to the site.

```
$ node scripts/imports/capture.mjs --supplier all --max-detail 10 --robots-check
capture: dogsy, dogquest, dfsi, puppiesie — 28 log entries, nothing published.
EXIT=0
```

- `--max-detail 10` bounds the sample; the adapter caps are 60 details per host. 83 fresh dfsi listings were therefore left unseen, not rejected.
- `--robots-check` requests a known disallowed dogsy query through the client to prove the skip.
- A temporary fetch shim **outside the repo** recorded the final URL and redirect flag of every request. It changed no request, header, spacing or redirect behaviour.
- Baseline confirmed first: `npm run test:imports` → **79 tests, 79 pass, 0 fail, 0 skipped**.

## 3. Per-source result

| Source | Host | Discovered | Already seen | Fresh | Detail pages fetched | Records | Review | Candidate | Errors | Deferred |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| dogsy | `dogsy.ie` | 38 | 38 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| dogquest | `www.dogquest.ie` | 5 | 2 | 3 | 3 | 3 | 0 | 3 | 0 | 0 |
| dfsi | `dogsforsaleireland.ie` | 95 (21-day window) | 2 | 93 | 10 | 10 | 10 | 0 | 0 | 83 |
| puppies.ie | `puppies.ie` | 68 | 65 still listed¹ | 3 | 0 (summary-only) | 3 | 3 | 0 | 0 | 0 |
| **Total** | — | **206** | **107** | **99** | **13** | **16** | **13** | **3** | **0** | **83** |

¹ `seen/puppiesie.json` held 66 ids; 65 of them are still in the current 68, one has dropped off the site. `seen` only grows, so the count is a retention set, not a liveness list.

- **dogsy:** all 38 current ids were already seen, so no detail page was fetched. Discovery and the seen-skip were exercised; this is the expected second-run behaviour.
- **dogquest:** 3 of 5 were new and all 3 parsed.
- **dfsi:** 93 of the 95 in-window ads were new; the sample fetched 10. The remaining 83 stay unseen for the next run.
- **puppies.ie:** 3 new summaries appeared since the 11:34 sample; all 3 were returned. No detail page exists to fetch.

## 4. Rejections and review reasons

| Bucket | Count | Why |
|---|---:|---|
| Gate rejections | 0 | T13 gates do not exist yet; nothing can be gate-rejected |
| Adapter review — `lead-only` | 10 | dfsi contract (owner D3) |
| Adapter review — `no-photos-source-blocked` + `lead-only` | 3 | puppies.ie contract (owner D4: no images, no dogs.ie) |
| Candidate (not published) | 3 | dogquest; would need T13 gates before any publish decision |
| Fetch or parse errors | 0 | — |
| Sold / withdrawn | 0 | all 16 records are `sourceStatus: live` |
| Already seen (skipped by dedupe) | 107 | ids in `seen/` |
| Deferred by `--max-detail 10` | 83 | dfsi fresh listings, not rejected |

Data-quality notes from the 16 records (counts only):

- All 16 have a valid `https://` source URL. None carries a phone or email field; dfsi stored one `regNo`, and dogquest stored a `vet` field.
- **dfsi 10/10** have DOB, at least one microchip, at least one image and a populated `town`; 9/10 have a price. One ad genuinely has no price label on the page (currency is null too). All 10 are review-only.
- **dogquest 3/3** have DOB, a EUR price, 1–5 microchips and 3–5 images.
- **puppies.ie 3/3** are summary-only by design: no DOB, no individual chips, no images.

## 5. Request log summary

| Host | Network requests | Robots skips | Detail requests | Span |
|---|---:|---:|---:|---|
| `dogsy.ie` | 3 (robots + 2 discovery pages) | 1 | 0 | 10.6 s |
| `www.dogquest.ie` | 5 (robots + sitemap + 3 details) | 0 | 3 | 21.3 s |
| `dogsforsaleireland.ie` | 14 (robots + index + 2 sitemaps + 10 details) | 0 | 10 | 85.6 s |
| `puppies.ie` | 5 (robots + home + 3 API pages) | 0 | 0 | 19.0 s |
| **Total** | **27** | **1** | **13** | **140.7 s wall clock** |

- **Statuses:** 27/27 final status 200. No 4xx, 5xx, network errors or retries.
- **Wall clock:** `11:45:18.082Z` → `11:47:38.818Z` = **140.7 s** (shell measured 140.8 s).
- **Same-host gaps** (start-to-start, 23 in-run pairs): **min 4,245 ms · median 5,916 ms · p90 7,327 ms · max 8,160 ms**. Every gap is above the 4,000 ms floor.
- The first dogsy request had a 465,301 ms gap because it was 7.8 minutes after the earlier sample run. Including that persisted gap, the 24-gap median is 6,033.5 ms. This is the cross-run spacing working as designed, not a slow request.
- **Blocked hosts:** none. **Alerts:** none.
- **Robots skip:** one — `https://dogsy.ie/dogs-for-sale?breed=poodle` was logged as `robots-skip`, `status: null`, and never reached the network (the probe contains 27 rows, not 28).
- **Redirects:** **0 of 27**. For every request, `response.redirected` was false and the final URL equalled the requested URL.
- **`*.dogs.ie`:** 0 requests. The deny list was never needed.

## 6. The two known gaps

### 6.1 Robots on redirect — **not exercised, still open**

There was no redirect in this run, so there is no target to report. The code is unchanged: `http.mjs` calls `fetch(..., { redirect: 'follow' })` and checks robots only for the URL it was asked for, before the request. A redirect to a disallowed path would therefore be followed without a robots check on the target.

The one known bare-host redirect is dodged by calling dogquest on `www.dogquest.ie` directly. That is a workaround, not a fix. This gap must be closed before the feed runs unattended daily: follow redirects by hand, re-check robots for each hop, and only then fetch.

### 6.2 dfsi lead-only — **passes today, but still only an adapter contract**

- **10/10 dfsi records** returned `status: 'review'` with `reviewReasons: ['lead-only']`.
- **0 dfsi records** reached any published state; `IMPORTS_DFSI_MODE` was unset.
- For completeness, **3/3 puppies.ie records** returned `status: 'review'` with `['no-photos-source-blocked', 'lead-only']`.
- The guarantee is still adapter-only. There are no T13 gates and no T14 writer, `capture.mjs` writes only private JSON, and `review-queue.json` stayed `[]`. T13 must treat `status: 'review'` as final.

## 7. What landed in the private store

| Path | This run | Notes |
|---|---:|---|
| `runs/2026-11-13T11-45-18-082Z-capture.json` | 1 file, 7,849 B | request log, per-supplier counts, blocked hosts, alerts |
| `runs/2026-11-13T11-45-18-082Z-records.json` | 1 file, 36,654 B | 16 private SourceRecords |
| `raw/<supplier>/<id>/<timestamp>.html` | +13 files | 10 dfsi + 3 dogquest; cumulative 19 listings / 19 files (dfsi 12, dogquest 5, dogsy 2) |
| `seen/dogsy.json` | 38 ids | +0 |
| `seen/dogquest.json` | 5 ids | +3 |
| `seen/dfsi.json` | 12 ids | +10 |
| `seen/puppiesie.json` | 69 ids | +3 |
| `http-last.json` | 4 hosts | dogsy, dogquest, dfsi, puppies.ie — feeds the 4 s spacing across runs |
| `review-queue.json` | unchanged `[]` (3 B) | **capture.mjs does not enqueue review items** |
| `audit.jsonl` | unchanged, 0 lines | **capture.mjs does not append audit events** |
| `images-src/` | empty | T12 not built |
| `fixtures/` | unchanged | no `--fixture` flag used |

No public feed file exists (`src/data/imported-puppies.json` is absent), no `logs/imports/` directory was created, and nothing under `src/` changed. The run itself changed nothing in the repo: `git status` was byte-identical immediately before and after it; this report is the only new file. HEAD is `75d402b`.

## 8. Is this feed safe to run daily?

**As a network client, yes.** The measured behaviour is exactly what the politeness rules ask for: one request at a time, ≥ 4 s per host (including across process boundaries), robots honoured before the first request, a disallowed query skipped without a network call, no `dogs.ie`, no blocks, no retries, no redirects.

**As a daily feed, no — not yet.** What has to change first, in order:

1. **Build the daily runner (T14).** `npm run sync:imports` currently fetches nothing. It needs to own fetch → normalise → dedupe → gates → images → liveness → write, with `--dry-run`, `--no-fetch` and `--source`, a counts-only log in `logs/imports/`, a full private run file, and audit events. Without it there is nothing to schedule.
2. **Close the redirect/robots gap.** Follow redirects by hand and re-check robots at every hop. The current `redirect: 'follow'` is the only reason today's zero-redirect run looks clean.
3. **Add a single-run lock and atomic state writes.** Two overlapping runs could double-hit a host; a crash between fetches can leave `seen/` and `http-last.json` behind. The 4 s rule only holds if the previous run's last-request times are actually saved.
4. **Wire the review queue and alerts.** `capture.mjs` leaves `review-queue.json` empty and writes no audit line. A daily feed must put the 13 review records somewhere a human will see, and must alert on a blocked host, a parse failure or a zero-record run.
5. **Decide the daily detail budget and raw retention.** dfsi alone had 93 fresh listings; the sample fetched 10 and left 83. The adapter cap is 60 per host, so a full catch-up takes two runs at ~4 s per detail. `raw/` also grows without bound and has no pruning policy.

Until those exist, scheduling `capture.mjs` daily would be harmless to the sources but would not produce a feed: it publishes nothing, queues nothing for review, and only grows the private store.
