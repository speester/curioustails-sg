# K-139 — Queue split: publishable vs lead-only

## What changed (code)

- `scripts/imports/lib/alert.mjs`: new `splitQueue()` / `isLeadOnlyItem()`. `review-backlog` now fires on **publishable**
  (auto-ready + review from publishable sources) > 20; `review-backlog-age` reads publishable items only. Lead-only
  records (dfsi, dogsie/puppies.ie, by the item's `leadOnly` flag or, for older items, its supplier) never count.
  NEEDS-ATTENTION "Queue" section lists publishable / auto-ready / review (+ needs an edit) / lead-only.
- `scripts/imports/run-daily.mjs`: `last-run.json` `queue` now carries `autoReady`, `review`, `leadOnly` (non-overlapping)
  plus `publishable` and `needsEdit`.
- No change to publishability: the spec's `puppy-publish.mjs` does not exist in this repo. The rule lives in
  `lib/gates.mjs` (`LEAD_ONLY_SUPPLIERS`, `OWNER_WAIVABLE_GATES`) and `lib/owner.mjs`; both are untouched and only read.
- No lead-only record deleted; they stay in `review-queue.json` and on the sheet.

## last-run.json before / after (same store, same 84 items)

| | before (06:15 SGT live run) | after (`run-daily --dry-run --no-fetch`, 16:06 SGT) |
|---|---|---|
| queue.autoReady | 11 | 11 |
| queue.review | 73 | 3 |
| queue.leadOnly | — | 70 |
| queue.publishable | — | 14 |
| queue.needsEdit | — | 2 |
| status / alerts | attention / `review-backlog` "73 items … (limit 20)" | **ok / none** |

Before record kept at `logs/imports/last-run.pre-k139-2026-11-14.json`. The dry-run wrote no store, queue, feed or audit
(sha256 of every store JSON, `audit.jsonl` and `src/data/imported-puppies.json` unchanged). `counts.gates.review` stays
73: that is the gate outcome tally, not the queue.

The old `NEEDS-ATTENTION.md` files from the 06:15 run are still there by design (the owner deletes them after reading);
the next scheduled run will not recreate them on this queue.

## Fixture boundaries (`scripts/imports/tests/alert.test.mjs`)

- 21 publishable → `review-backlog` fires; 20 → no alert (status ok). 21 auto-ready alone and 21 review alone both fire.
- 200 lead-only → no alert (with `leadOnly` flag and with legacy supplier-only items); 200 lead-only + 20 publishable → no
  alert; 200 lead-only 30 days old → no age alert.
- K-135 shape (11 auto + 1 waivable + 2 edit + 70 lead) → alert none, split 11/3/70, publishable 14, needsEdit 2;
  12 publishable + 70 lead → alert none.
- End to end: `runDaily` on a clean dogsy record + a dogsie record → last-run.json autoReady 1 / review 0 / leadOnly 1,
  alerts [], lead kept in the queue.
- `npm run test:imports`: **189/189 pass** (184 before).

## Sheet (same URL)

- https://k135-review-sheet.curioustails-staging.pages.dev/ (deployment https://0c8c730b.curioustails-staging.pages.dev), noindex.
- Two sections: **Publishable 14** (11 auto-ready · 3 review, 2 need an edit) and **Leads 70**.
- #83 (estimated arrival Oct 2026 already past) and #84 (breed "Irish Terrier" not mappable) carry a red
  **NEEDS AN EDIT** pill with the reason. Row numbers unchanged from K-135.
- Chips: All 84 · Publishable 14 · auto-ready 11 · review 3 · needs an edit 2 · Leads 70 · by source.
- Sheet check against last-run.json: auto-ready 11, review 3, lead-only 70, publishable 14, needs an edit 2 → match.
- 1440 / 390: overflow 0, 14/14 photos, chips verified on the live URL. Screenshots `reports/k139/k139-review-sheet-{1440,390}.png`.

**On a normal day the owner looks at 14 items (12 one-click approvals + 2 edits), not 73; the 70 leads sit in their own
section and never raise the alert.**
