# K-072 resume — imports phase 1: commit baseline, `test:imports`, T7–T10

**Date:** 2026-11-13 · **Scope:** `scripts/imports/**` and one `package.json` script line. No `src/`, `outputs/`,
live-site, `rtp-v3` or other-project change. Nothing publishes; `IMPORTS_AUTOPUBLISH` unset (checked: `env | grep -c
^IMPORTS_AUTOPUBLISH` → `0`).

## Result

- **79 / 79 tests pass**, 0 skipped (50 at the start of this session).
- One command runs everything, from Git Bash or PowerShell/cmd: `npm run test:imports`
  → `node --test "scripts/imports/tests/*.test.mjs"` (Node 24.13 expands the quoted glob; a bare directory fails).
- T1–T6 are committed as a baseline, then one commit per task.

| Commit | What |
|---|---|
| `b686b36` | T1–T6 baseline (the untracked `scripts/imports/` tree + the existing `sync:imports` line) |
| `55e1b7d` | `test:imports` npm script |
| `129027e` | T7 dogsy adapter + shared `lib/html.mjs`, `lib/source-record.mjs`, `tests/_helpers.mjs` |
| `a7e7553` | T8 dogquest adapter + **T4 fix**: breed map also matches space-less slugs (`jackrussellterrier`) |
| `487a9b3` | T9 dfsi adapter (lead-only by default) |
| `132e9c5` | T10 puppies.ie adapter (lead-only, no dogs.ie) |
| `75d402b` | `capture.mjs` live sample tool + **T2 fix**: 4 s spacing now holds across back-to-back runs |

## Per task: acceptance → command → real output

The private fixtures already existed from the earlier session (`IMPORTS_PRIVATE_DIR/fixtures/<supplier>/`). This
session's live run added two more detail pages per supplier (`live-*.html`). Each "real fixture" test runs over
**every** page in that folder. Each adapter also has fabricated-markup tests in the repo, with no real seller data, so
the parsers stay tested on a machine with no private store.

### T7 dogsy — `node --test scripts/imports/tests/dogsy.test.mjs`

| Acceptance | Test | Output |
|---|---|---|
| The fixture parses to a SourceRecord with dob, priceNumber, currency EUR and ≥1 `puppies[].microchip` | `private real fixture(s) parse …` (3 real pages) + `fabricated detail page …` | ✔ |
| No request goes to `/dogs-for-sale?*` | `run: no request to a robots-disallowed …`: the API returns such a URL, the mock network never sees it, and the log shows `robots-skip` | ✔ |
| A second run with no new ids makes ≤ 3 requests | `run: second run …`: the calls are exactly `robots.txt`, `?page=1`, `?page=2` | ✔ |

`ℹ tests 7 · pass 7 · fail 0 · skipped 0`. The real fixture 1731 parses to: DOB `13/09/2026` → `2026-09-13`, EUR 800,
1 M / 1 F, Kerry/Killarney, Ireland, wormed/vaccinated/microchipped true, neutered false, 2 chips `For Sale`, 8 images,
and seller name + phone stored (values not printed). The API's `age_weeks` (live value `-8`) is dropped.

### T8 dogquest — `node --test scripts/imports/tests/dogquest.test.mjs`

| Acceptance | Test | Output |
|---|---|---|
| The fixture yields date_of_birth, ≥1 image URL and `puppies[0].chipVerified=true` when the status is `animark_verified` | `private real fixture yields …` (3 real pages) + the fabricated test | ✔ |
| A test parses the fixture with a changed RSC chunk order | fabricated: 3 permutations give a `deepEqual` record; real: the page's own flight chunks are reversed and give the same dob, images, puppies and price | ✔ |

`ℹ tests 7 · pass 7 · fail 0 · skipped 0`. Each `self.__next_f` chunk is searched on its own, and the joined payload is
only a fallback. Discovery uses `https://www.dogquest.ie/sitemap.xml` directly (see the robots note below).

### T9 dfsi — `node --test scripts/imports/tests/dfsi.test.mjs`

| Acceptance | Test | Output |
|---|---|---|
| The fixture yields dob, sex counts and a microchip list | `private real fixture yields …` (3 real pages) + the fabricated test | ✔ |
| With the default mode, no dfsi item reaches status published | `run (default mode)`: `IMPORTS_DFSI_MODE` is unset, and every record is `status:'review'` with `reviewReasons:['lead-only']` | ✔ |
| Image size variants collapse to one URL per photo | `image size variants collapse …`: `-scaled` wins, then the original, then the largest WxH. Gallery only, so avatars, site icons and "similar ads" are excluded | ✔ |

`ℹ tests 7 · pass 7 · fail 0 · skipped 0`. Also tested: the 21-day lastmod window on both the index and the ad
sitemaps, and the `sold` token as a whole word in the title or slug (`soldier` is not matched).

### T10 puppies.ie — `node --test scripts/imports/tests/puppiesie.test.mjs`

| Acceptance | Test | Output |
|---|---|---|
| A run log shows zero requests to any `*.dogs.ie` host | `run: zero requests to any *.dogs.ie host`: every mock call is to `puppies.ie`, and the log has 0 `dogs.ie` entries | ✔ |
| Every record has status review, and `£` maps to GBP | the `every record is status review …` test: `£450` → `GBP` | ✔ |

`ℹ tests 6 · pass 6 · fail 0 · skipped 0`. Records keep summaries only. `preview_url` (images.dogs.ie) is never kept,
and `imageSourceUrls` is `[]`.

### Whole suite — `npm run test:imports`

`ℹ tests 79 · pass 79 · fail 0 · skipped 0 · todo 0`

## Live request log (private store `runs/2026-11-13T11-34-29-063Z-capture.json`)

Command: `node scripts/imports/capture.mjs --max-detail 2 --fixture --robots-check`. `gapMs` is the time from the
previous request's start to this one's start, on the same host.

```
at                        host                    gapMs  status outcome     kind      path
2026-11-13T11:34:29.064Z  dogsy.ie                    -    200  fetched     robots    /robots.txt
2026-11-13T11:34:34.498Z  dogsy.ie                 5434    200  fetched     discover  /api/public/listings?page=1
2026-11-13T11:34:39.152Z  dogsy.ie                 4654    200  fetched     discover  /api/public/listings?page=2
2026-11-13T11:34:43.772Z  dogsy.ie                 4620    200  fetched     detail    /dogs-for-sale/1731-cavapoochon-puppies.html
2026-11-13T11:34:49.173Z  dogsy.ie                 5401    200  fetched     detail    /dogs-for-sale/1729-6-border-collie-puppys.html
2026-11-13T11:34:50.266Z  dogsy.ie                    -      -  robots-skip detail    /dogs-for-sale?breed=poodle
2026-11-13T11:34:50.266Z  www.dogquest.ie             -    200  fetched     robots    /robots.txt
2026-11-13T11:34:56.267Z  www.dogquest.ie          6001    200  fetched     discover  /sitemap.xml
2026-11-13T11:35:00.440Z  www.dogquest.ie          4173    200  fetched     detail    /listing/miniature-jack-russell-pup-d9627969-…
2026-11-13T11:35:05.893Z  www.dogquest.ie          5453    200  fetched     detail    /listing/purebred-miniature-dachshunds-73261181-…
2026-11-13T11:35:06.785Z  dogsforsaleireland.ie       -    200  fetched     robots    /robots.txt
2026-11-13T11:35:14.628Z  dogsforsaleireland.ie    7843    200  fetched     discover  /sitemap_index.xml
2026-11-13T11:35:19.555Z  dogsforsaleireland.ie    4927    200  fetched     discover  /ad_post-sitemap.xml
2026-11-13T11:35:24.698Z  dogsforsaleireland.ie    5143    200  fetched     discover  /ad_post-sitemap2.xml
2026-11-13T11:35:30.854Z  dogsforsaleireland.ie    6156    200  fetched     detail    /ad/miniature-dashhund-puppies-2/
2026-11-13T11:35:36.958Z  dogsforsaleireland.ie    6104    200  fetched     detail    /ad/miniature-dachshund-10/
2026-11-13T11:35:39.097Z  puppies.ie                  -    200  fetched     robots    /robots.txt
2026-11-13T11:35:44.326Z  puppies.ie               5229    200  fetched     discover  /
2026-11-13T11:35:49.192Z  puppies.ie               4866    200  fetched     discover  /api/latest-ads?page=1
2026-11-13T11:35:54.049Z  puppies.ie               4857    200  fetched     discover  /api/latest-ads?page=2
2026-11-13T11:35:58.753Z  puppies.ie               4704    200  fetched     discover  /api/latest-ads?page=3
```

- **Spacing:** the smallest same-host gap within a run is **4173 ms**. Counted over all 33 entries in every capture
  file, it is 4011 ms.
- **Robots skip:** `/dogs-for-sale?breed=poodle` was logged as `robots-skip` with no status, so no network call was made.
- **dogs.ie:** 0 entries for any `*.dogs.ie` host across all run files. No host was blocked in any run.
- **Counts:** dogsy 38 discovered / 2 new; dogquest 5 / 2; dfsi 95 in the 21-day window / 2 new (both `review`);
  puppies.ie 66 summaries, all `review`, all EUR (no `£` was live today; the `£` → GBP path is covered by the
  fabricated test).

**Live second run, dogsy** (after `--seed-seen` marked all 38 ids as seen): `capture.mjs --supplier dogsy` gave
**3 log entries**: `robots.txt`, `?page=1`, `?page=2`, and 0 details.

**Spacing gap found and fixed:** the first back-to-back pair of runs at 11:36 broke the 4-second rule. Run 2's
`robots.txt` went out at 11:36:24.959, **0.74 s** after run 1's last dogsy request at 11:36:24.215. Spacing had only
been tracked in memory, within one process.

The fix is in `75d402b`. `createHttp({ lastRequestAt })` now takes the previous run's last request time per host,
`http.lastRequestAt()` returns this run's times, and `capture.mjs` saves them to the private `http-last.json`.

After the fix, the next back-to-back pair shows the first request of run 2 at a **4011 ms** gap. A new test in
`http.test.mjs` covers this.

The T14 orchestrator must load and save this file in the same way.

## Files

New: `scripts/imports/adapters/{dogsy,dogquest,dfsi,puppiesie}.mjs`, `scripts/imports/lib/html.mjs`,
`scripts/imports/lib/source-record.mjs`, `scripts/imports/capture.mjs`,
`scripts/imports/tests/{dogsy,dogquest,dfsi,puppiesie}.test.mjs`, `scripts/imports/tests/_helpers.mjs`.
Changed: `package.json` (`test:imports`), `lib/breed-map.mjs` (compact-slug lookup), `lib/http.mjs`
(`lastRequestAt`), `tests/breed-map.test.mjs` (+1 test), `tests/http.test.mjs` (+1 test).
Private store only (outside the repo): `runs/*-capture.json`, `runs/*-records.json`, `seen/*.json`, `http-last.json`,
`raw/<supplier>/…`, `fixtures/<supplier>/live-*.html`, plus `_probe/` from the structure survey (also through the
polite client).

The repo was checked for real chip numbers and phone numbers (`grep -rnE "972274|0860685|\+3538" scripts/imports`):
none found. `secret.key` was never read or printed.

## Under-specified / for the coordinator

1. **"No dfsi item reaches published"** cannot be proved end to end yet, because the gates (T13) and the orchestrator
   (T14) don't exist. The adapters set a contract instead: `status:'review'` plus `reviewReasons` (`lead-only`, and
   `no-photos-source-blocked` for puppies.ie). T13 G14 must treat `status:'review'` as final.
2. **Fixture policy.** The spec keeps real fixtures private, so the tests read them from `IMPORTS_PRIVATE_DIR` and
   **skip** them when the folder is absent. That happens on CI or any other machine, where the fabricated in-repo
   markup tests still run. Today nothing was skipped.
3. **The SourceRecord fields grew.** `dob` (ISO), `status`, `reviewReasons`, `breedType` (dogquest),
   `puppies[].chipVerification`, and puppies.ie `imageCount`, `publishedText` and `leadOnly` are not in spec §2.1.
4. **Seller data is thin.** dogquest exposes no seller name or phone (only `vet_name`, which is stored as
   `seller.vet`). The sampled dfsi ads show no Registered Seller ID or seller type, so the parser reads them only when
   labelled. The dfsi seller name sits in an HTML-commented block and is not read.
5. **Redirects skip robots for the target host.** `http.mjs` uses `redirect:'follow'`, so a redirect to another host
   isn't checked against that host's robots.txt. dogquest is called on `www.` directly to avoid this. A stricter
   client would follow redirects by hand.
6. **ETag cache is unused** in `capture.mjs`. A 304 on the dogsy API would hide `last_page`; T14 should decide the
   cache for each request kind.
7. **Data note.** Both live dfsi ads list a DOB in 2025, so the puppies would be about a year old. G4 must handle that
   (it is the source's data, not a parser fault).
8. `capture.mjs` is a dev and evidence tool. It has no test of its own; its pieces (adapters, http, store) are tested.
