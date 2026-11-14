# Imports first run — 2026-11-13 (K-091 / T26)

**Verdict:** the chain works end to end, but this run published nothing. With `IMPORTS_AUTOPUBLISH` unset, all five gate-passing live items were queued as **auto-ready**, the public feed stayed empty, and `IMPORTS_DFSI_MODE=lead-only` held every dfsi item out of any publishable state. A separate local fixture run then proved the half a dry run cannot reach: an explicitly approved item is written to the public JSON, renders on the site, passes the leak scan, and is removed again by the next build after a takedown.

Nothing was deployed. No production host was touched. `npm run deploy:preview` was **not** run because that needs owner approval; the render was verified against a local `astro build` + `astro preview`.

**Evidence files**

- `reports/k091-t26-live-dry-run.json` — counts, public-only review fields, host counts
- `reports/k091-t26-fixture-e2e.json` — every assertion in the fixture run below

---

## 1. Environment

| Control | Value |
|---|---|
| Command | `node reports/k091-tools/t26-live-dry-run.mjs` → `runPipeline({ args: --dry-run --max-detail 3 })` |
| `IMPORTS_AUTOPUBLISH` | unset |
| `IMPORTS_DFSI_MODE` | `lead-only` |
| Private store | `D:\Claude Code\_private\curious-tails-imports` (outside the repo; guard passed) |
| Repo writes | none: no feed, assets, state, queue, audit or operational log written |
| Network | live sources, one request at a time, 4 s per host, robots honoured |
| Started | 2026-11-13T13:38:47.771Z |

A `--dry-run` deliberately writes no feed. The only pipeline-owned file it persists is `http-last.json`, which the cross-run 4 s politeness rule needs.

## 2. The live dry run

### 2.1 Per source

| Source | Discovered | Parsed records | Errors | Blocked |
|---|---:|---:|---:|---|
| dogsy | 38 | 3 | 0 | no |
| dogquest | 5 | 3 | 0 | no |
| dfsi | 95 | 3 | 0 | no |
| puppies.ie | 67 | 67 | 0 | no |
| **Total** | **205** | **76** | **0** | **0** |

All three of dogsy, dogquest and dfsi returned at least one parsed record. dogsy and dogquest produced the publishable samples below; every dfsi record is lead-only and none reached the feed or a publishable queue entry.

### 2.2 Gates and disposition

| Measure | Count |
|---|---:|
| Gate pass | 5 |
| Gate review | 66 |
| Gate reject | 5 |
| **Queued `auto-ready`** | **5** |
| **Published** | **0** |
| Feed pups written | **0** |

Sample review items, **public fields only** (id, breed, sex, age, price, arrival, photos):

| id | Source | Disposition | Breed | Sex | Age | Price | Arrival | Photos |
|---|---|---|---|---|---|---|---:|
| `imp-1bbbfc9722` | dogsy | auto-ready | Cavachon (Cavachon x Poodle) | 1 boy / 1 girl | 8 weeks | S$4,800 | 2026-12 | 3 |
| `imp-26765996a7` | dogsy | auto-ready | Border Collie | 2 boys / 4 girls | 9 weeks | S$4,350 | 2026-12 | 3 |
| `imp-3f9c3f1d9f` | dogquest | auto-ready | Jack Russell Terrier | 1 boy | 10 weeks | S$4,650 | 2026-11 | 3 |

No seller name, URL, county, microchip, original price or raw description is present in this report or in either JSON.

### 2.3 Lead-only and hard rejects

- **66 puppies.ie summaries** were queued as `review` with `leadOnly: true`. They cannot be approved by the CLI or the UI, and they were absent from the feed.
- **3 dfsi records** were fetched. No dfsi item appears in the feed or in the review queue; the source is lead-only for this run, and no dfsi item can publish.
- **5 gate rejections** were recorded. The fed fixture run separately proves a sold record is rejected and never rendered.

### 2.4 Network

| Host | Requests |
|---|---:|
| `dogsy.ie` | 15 |
| `www.dogquest.ie` | 5 |
| `dogsforsaleireland.ie` | 7 |
| `puppies.ie` | 5 |
| dogquest image CDN (`supabase.co`) | 9 |
| **Total** | **41** |

- **`*.dogs.ie`: 0 requests.** The zero-request rule held.
- No host was blocked, no Cloudflare challenge, no retry and no error.
- Images: 17 downloaded, 0 failed, during the dry run (processed in memory only).

## 3. Public JSON → page render → leak scan → build (local fixture proof)

A live dry run cannot reach a rendered page: with the safety valve on, an item is `auto-ready` until the owner approves it, and no live listing has been approved. To prove the remaining half without publishing anything to production, the real pipeline ran against a **temporary private store outside the repo** with three seeded records:

| Record | Source | Expected |
|---|---|---|
| `imp-38ff0756bf` | dogsy | clean, gate-passing, approvable |
| `imp-e52adc5d86` | dfsi | otherwise clean but lead-only: review, never render |
| `imp-837e94c876` | dogsy | source says sold: hard reject, never render |

The fixture's seller fields, microchips and URLs stayed in the temporary store; the leak scan used that store's denylist.

### 3.1 What happened

| Step | Result |
|---|---|
| First `sync:imports --no-fetch` | feed **0 pups**; clean item `auto-ready`; dfsi item `review` + `leadOnly`; sold item not queued |
| `imports:approve <clean>` | owner decision recorded |
| Second `sync:imports --no-fetch` | feed **1 pup**: `imp-38ff0756bf`, `jack-russell-terrier`, `published`; dfsi and sold absent |
| `npm run build` | detail page rendered with `PreOrder` and `noindex,follow`; breed card rendered; `/available-puppies/` section rendered |
| Rendered output scan | dfsi id absent; dfsi ref absent; sold id absent |
| Sitemap | no `/imp-` URL |
| `check:import-leaks --dist` | **OK** — `feed=1 assets=6 dist=141 denylist values=18 shingles=6` |

The key point: **the rendered output contains exactly the one approved record and nothing else.** The lead-only and sold records existed in the same private store and never appeared in HTML.

### 3.2 Takedown

| Step | Result |
|---|---|
| `imports:unpublish imp-38ff0756bf --reason takedown` | feed **0 pups**; 0 repo WebPs left; `imported-retired.json` = `[{ id, breed }]` |
| Next `npm run build` | detail page **removed**; `/puppies/jack-russell-terrier/imp-38ff0756bf/ /puppies/jack-russell-terrier/ 301` present; **0** imported pages in `dist`; sitemap still clean |

## 4. Leak scan on the clean final build

After the fixture was removed and the feed returned to `pups: []`:

```
check:import-leaks: OK (feed=1 assets=0 dist=140 denylist values=0 shingles=0)
```

The built site in its shipping state contains no imported listing and no imported page: `dist/puppies/**/imp-*` = 0, sitemap `/imp-` = 0.

## 5. What is still not done

- **T17 legal sign-off.** The copy on the page uses the redline-settled payment wording, but the terms are still waiting for counsel. `IMPORTS_AUTOPUBLISH=1` stays off until that lands.
- **T25 scheduler.** Nothing runs this daily yet.
- **T24 GA4 registration** for `import:<id>` and `import_details_click`.
- **The design pass** promised after T21.
- The live feed is empty today because no live listing has been approved. That is the safety valve working, not a pipeline failure.
