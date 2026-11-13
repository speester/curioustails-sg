# K-086 — Imports phase 2 (T11–T14 + K-085) report, 2026-11-13

Resumed after the OpenCode outage. The previous worker's files were usable and nearly complete (121/121 green on
disk), so they were finished, not rewritten. Review against spec §6.4–§6.6 and §8 found six real gaps; each got a
failing test first, then a code fix. No existing assertion was changed or weakened.

**Test counts:** 79/79 at `75d402b` (measured in a clean worktree) → 121/121 as left on disk → **132/132** now
(`npm run test:imports`, foreground, one command).

## Gaps found and fixed (test first, then code)

| # | Gap | Fix |
|---|---|---|
| 1 | `IMPORTS_DFSI_MODE=auto` let dfsi pass G14 and publish (lead-only was a convention set by env) | `LEAD_ONLY_SUPPLIERS = {dfsi, dogsie}` in `gates.mjs`: G14 fails on supplier id, whatever the env or adapter mode. The pipeline also refuses to publish a group with no non-lead-only record. |
| 2 | A merged dogsy + dfsi group took content and photos from dfsi when dfsi had more chips | `contentRecords()`: lead-only records still merge (no second card) but never supply fields or photos, and their photo host is never asked |
| 3 | A **reserved** pup dropped out of the feed once the source said "sold" or it passed 16 weeks (G13/G4 reject) | Reserved is never auto-unpublished (spec §6.6); its published entry is carried via the whitelist with age recomputed and price/arrival/photos frozen |
| 4 | A published pup came down silently at 16 weeks via G4, and gate-driven removals had no `unpublished` audit | For live listings G4-age/G5 are intake gates; liveness owns >20 weeks and arrival-passed. Any other failing gate unpublishes with an `unpublished` audit event (and re-queues if it is review-only). Valve counter now counts new publishes, not every run a pup stays up. |
| 5 | Queued and rejected listings' WebPs were written straight into `src/assets/imported` (and would be committed) | Processed WebPs stage in private `images-processed/`; only feed pups' files are copied to the repo; any other `imp-*.webp` is pruned. Files of published/reserved pups are never pruned. |
| 6 | `capture.mjs --seed-seen` had marked 124 ids seen while `imports-state.json` held 0 records, so a live run would skip them forever. Also no 3-day detail re-fetch, and no private `runs/<date>.json` | `seen` now counts an id only when its record is in state. Published details older than 3 days are re-fetched. Each real run appends full detail to private `runs/<date>.json`. |

## Per task — acceptance command and real output

**T11 Dedupe:** `node --test scripts/imports/tests/dedupe.test.mjs` → 6/6
```
✔ two records from different suppliers that share one microchip produce one public pup
✔ records with the same breed, DOB within 2 days, the same county and price within 10% merge
✔ a near-identical image (dHash <= 6) merges, even across different breed labels
✔ a duplicate of a taken-down item is rejected, not regrouped
```
Also tested in the orchestrator: `✔ two suppliers sharing one microchip produce one public pup in the feed`.
Thresholds follow the card (2 days / 10%), not spec §6.5 (3 days / 15%).

**T12 Images:** `node --test scripts/imports/tests/images.test.mjs` → 5/5
```
✔ an output WebP has no EXIF, XMP or GPS (sharp metadata check)
✔ filenames match /^imp-[0-9a-f]{10}-\d+(-card)?\.webp$/
✔ a 403 on an image returns null with no proxy attempt
✔ a downloaded image is written only after processing, as a clean WebP
```

**T13 Gates:** `node --test scripts/imports/tests/gates.test.mjs` → 15/15
```
✔ an XL bully title is rejected (G8)
✔ a German Shepherd goes to review (G9), never auto-publishes
✔ age 22 weeks is rejected (G4)
✔ no microchip goes to review (G10)
✔ "pups sometimes available" goes to review (G12)
✔ "stud" is rejected by G12
✔ "£450" goes to review (G3 currency-gbp)
✔ a clean JRT 10 weeks with 3 photos and 3 chips passes
✔ with IMPORTS_AUTOPUBLISH unset the clean fixture is auto-ready, not published
✔ dfsi stays lead-only in code: IMPORTS_DFSI_MODE=auto cannot make it publishable
```
Note: the K-086 card says "pups sometimes available" is *rejected*. The T13 acceptance array and spec §8 G12 both
say *review*. The code follows the acceptance array and spec. Owner call if the card wording was intended.

**T14 Orchestrator:** `node --test scripts/imports/tests/sync-imports.test.mjs scripts/imports/tests/public.test.mjs` → 20/20 + 5/5
```
✔ the public feed validates against scripts/imports/public-schema.json
✔ additionalProperties:false rejects an extra supplier field at any level
✔ a real run touches only the feed, imported assets and the operational log
✔ logs/imports/<date>.log contains no phone, email, URL or microchip
✔ --no-fetch makes zero network requests and writes a schema-valid feed
✔ --dry-run writes nothing to the repo, state, queue or audit
✔ a fetch run keeps the persisted 4 s per-host spacing and saves http-last.json
```
On the real repo:
- `npm run sync:imports -- --no-fetch`: the git status diff before and after was empty. The run wrote only
  `src/data/imported-puppies.json` and the gitignored `logs/imports/2026-11-13.log`.
- A regex check of that real log (URL, `www.`, email, 15-digit chip, Irish mobile) returned no matches.
- Bounded live dry run `npm run sync:imports -- --dry-run --source dogsy --max-detail 2` gave discovered=38
  records=2 groups=2 pass=2 auto-ready=2 images=6 failed=0 feedPups=0 in 55.7 s. Repo and the private
  state/queue/audit were unchanged (checked by md5); only `http-last.json` advanced.

**K-085 robots on redirect:** `node --test --test-name-pattern="K-085|4 s spacing" scripts/imports/tests/http.test.mjs` → 3/3
```
✔ K-085: a redirect to a disallowed path is a robots skip, not a follow
✔ K-085: a cross-host redirect checks the target host robots before fetching it
✔ lastRequestAt from a previous run keeps the 4 s spacing across processes
```
Redirects are followed manually one hop at a time (max 5). Each hop goes through the per-host spacing and is
checked against its own host's robots and the deny list.

## What still stops a daily scheduled run

The orchestrator is real and safe to run by hand, but it is not schedulable yet. The remaining blockers are:
- **T15:** the `check-leaks.mjs` hard build gate and its `build:deploy` wiring.
- **T16:** the review UI, approve/reserve/unpublish and redirects. Until T16 exists, every `auto-ready` item
  sits in the queue with no way to approve it, so the feed stays empty by design.
- **T25:** `run-daily.bat`, `setup-imports-task.ps1` and the alerts. This step is easy to miss: T15 and T16
  alone do not schedule anything.

Two phase-2 items are partial, but neither blocks a supervised run:
- **G6 stock-photo and watermark detection:** `imageFlags` is never set. Spec v1 relies on the safety valve, which
  sends the first 20 items per supplier to review by hand, and that is in place.
- **`overrides.json` (approve with edits):** this belongs to T16.

`firstRunAt` in the private state is already 2026-11-13, set by no-fetch runs. The per-supplier 20-item valve
still holds even after the 14 days pass.
