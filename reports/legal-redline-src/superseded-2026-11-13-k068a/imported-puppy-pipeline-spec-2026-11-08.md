# Imported puppy pipeline: system spec (K-008)

**Date:** 2026-11-08 · **Status:** design only. No production source was edited.
**Companion files:**
- `reports/imported-puppies-demand-2026-11-08.md`
- `reports/irish-supplier-research-2026-11-08.md`
- `reports/imported-puppy-copy-deck-2026-11-08.md`
- `reports/imported-puppy-risks-and-decisions-2026-11-08.md`
- `reports/imported-puppy-tasks-2026-11-08.json`
- `outputs/imported-puppies/sample-normalised-listing.json`

---

## 0. Decisions already made (owner) and how this spec honours them

| # | Owner decision | Where it's implemented |
|---|---|---|
| 1 | `priceSGD = supplier number + 4000`. No FX conversion for the markup. | §3 `price.mjs`. The original number and currency live **only** in the private store. |
| 2 | Scope: all new listings from the four sites | §6 adapters. puppies.ie can't pass the photo gate without bypassing dogs.ie's Cloudflare block, so it runs in **lead-only** mode (review queue). See D4. |
| 3 | Photos: download and self-host; owner accepts the risk | §6.4 image downloader, §8.3 takedown path |
| 4 | Auto-publish everything that passes the gates; failures go to a review queue | §5 gates, §7 review queue, audit log and one-command unpublish |

**What already exists, and why we reuse it:**
- `scripts/sync-overseas.mjs` → `src/data/overseas-puppies.json` → `src/components/OverseasPuppies.astro` already sells **Australian reservation puppies**. It uses the same 50/50 deposit, is on 48 breed pages, and uses the WhatsApp "Reserve this puppy" CTA.
- The Irish pipeline is the **second origin of the same product**. We build it as a general `imports` system with `origin: 'IE'`, so the AU feed can move onto it later (task T19, optional).
- We reuse:
  - the breed label → slug maps from `sync-puppies.mjs` and `sync-overseas.mjs`
  - sharp WebP conversion
  - `src/pages/puppies/[breed]/[id].astro`
  - the `puppy-redirects.mjs` retirement pattern
  - the `data-wa-source` GA4 attribution

---

## 1. Architecture

```
               ┌─────────── PRIVATE (never built, never committed) ───────────┐
 Task Scheduler│  IMPORTS_PRIVATE_DIR = D:\Claude Code\_private\curious-tails-imports\
  06:15 SGT    │   raw/<supplier>/<listingId>/<fetchedAt>.html|json   (snapshots)
      │        │   images-src/<publicId>/<n>.<ext>                   (originals)
      ▼        │   store.sqlite  (or store.json)  — source records, seller, URLs
 npm run       │   review-queue.json   audit.jsonl   runs/<date>.json   secret.key
 sync:imports ─┤
   │           └───────────────────────────────────────────────────────────────┘
   ├─ 1 fetch      scripts/imports/adapters/{dogsy,dogquest,dfsi,puppiesie}.mjs
   ├─ 2 parse      → SourceRecord (private)
   ├─ 3 normalise  → Candidate (breed slug, DOB, price, arrival, sexes…)
   ├─ 4 dedupe     → by listingId, microchip, image pHash, fuzzy key
   ├─ 5 gates      → PASS → publish | FAIL → review-queue | HARD-FAIL → rejected
   ├─ 6 images     → strip EXIF, resize 1200/800 WebP, rename imp-<id>-<n>.webp
   ├─ 7 liveness   → re-check published sources; gone/sold → auto-unpublish
   ├─ 8 write      → src/data/imported-puppies.json  (PUBLIC, normalised only)
   │                 src/assets/imported/imp-<id>-<n>.webp
   ├─ 9 leak scan  → scripts/imports/check-leaks.mjs over data + assets (+ dist/)
   └─10 report     → logs/imports/<date>.log, alert on failure / review backlog
then (existing pattern): build → check:import-leaks on dist/ → deploy
```

- **The private dir sits outside the repo**, so it can't be committed or bundled. Its path comes from the `IMPORTS_PRIVATE_DIR` env var (set in `C:\Users\admin\.claude\.env`, value not printed). The script **refuses to run** if that path resolves inside the repo root.
- **Only two things ship:** `src/data/imported-puppies.json` and `src/assets/imported/*.webp`.

---

## 2. Data model

### 2.1 Private source store (`SourceRecord`), never public

```ts
interface SourceRecord {
  key: string;                 // `${supplier}:${listingId}`
  supplier: 'dogsy' | 'dogquest' | 'dfsi' | 'dogsie';   // origin platform (puppies.ie → dogsie)
  viaSite: 'irishpuppies.ie' | 'dogquest.ie' | 'dogsforsaleireland.ie' | 'puppies.ie';
  listingId: string;           // dogsy id / dogquest uuid / dfsi slug / dogs.ie slug
  sourceUrl: string;
  fetchedAt: string;           // ISO, each fetch
  firstSeenAt: string; lastSeenAt: string;
  sourcePublishedAt: string | null;   // ISO when available; else derived from relative text at firstSeen
  snapshotPath: string;        // raw/<supplier>/<listingId>/<fetchedAt>.html
  title: string; descriptionRaw: string;          // kept for gates only; never published
  breedRaw: string; breed1?: string; breed2?: string;
  priceRaw: string; priceNumber: number | null; currency: 'EUR' | 'GBP' | null; negotiable: boolean;
  dobRaw: string | null; ageRaw: string | null;
  maleCount: number | null; femaleCount: number | null;
  puppies: { sex: 'M'|'F'|null; colour: string|null; price: number|null;
             microchip: string|null; chipVerified: boolean|null; status: string|null }[];
  county: string | null; town: string | null; countryOfOrigin: string | null;
  flags: { wormed?: boolean; vaccinated?: boolean; neutered?: boolean; ikc?: boolean };
  seller: { name?: string; phone?: string; email?: string; regNo?: string; type?: string; vet?: string };  // PII, minimised
  imageSourceUrls: string[];
  sourceStatus: 'live' | 'gone' | 'sold' | 'blocked' | 'error';
  httpLog: { url: string; status: number; at: string }[];
}
```

**PII rules:**
- Store seller name, phone and email only so the owner can contact the breeder.
- **Purge seller fields 90 days after unpublish.**
- Never write seller fields to logs.

### 2.2 Public normalised listing (`ImportedPup`), the only shape that ships

```ts
interface ImportedPup {
  id: string;                  // "imp-" + first 10 hex of sourceHash, e.g. "imp-7f3a2c91de"
  ref: string;                 // human code for WhatsApp, e.g. "CT-IE-7F3A2C" (no supplier info)
  breed: string;               // breed page slug, e.g. "jack-russell-terrier"
  breedLabel: string;          // display, e.g. "Jack Russell Terrier"
  crossLabel: string | null;   // e.g. "Jack Russell x Chihuahua" (never shown as pure breed)
  name: string | null;         // only if the source gives a pet name; else null
  sex: { male: number; female: number };      // available counts for the litter
  colours: string[];           // normalised ("Tan & White")
  dob: string | null;          // ISO date (date only)
  age: string | null;          // display at build time, e.g. "10 weeks"
  priceSGD: number;            // supplier number + 4000
  depositPct: 50;
  depositSGD: number;          // round(priceSGD * 0.5)
  balanceSGD: number;          // priceSGD - depositSGD
  balanceDue: 'before-flight';
  arrivalEstimate: string;     // "2026-12" (month precision only)
  arrivalBasis: 'dob' | 'age' | 'listing-date';
  imported: true;
  origin: 'IE';                // country code only — see D1 for whether it is displayed
  reservation: true;
  perks: string[];             // keys into the standard perks list (starter-kit, delivery, training, support)
  photos: string[];            // ["imp-7f3a2c91de-1.webp", ...] local files in src/assets/imported/
  photoAlt: string[];          // per photo, describes the puppy
  status: 'published' | 'reserved' | 'unpublished';
  publishedAt: string;         // ISO
  updatedAt: string;
  sourceHash: string;          // HMAC-SHA256(secret.key, `${supplier}:${listingId}`) hex — NOT reversible without the secret
  hdbApproved: boolean | null; // true = breed on HDB list; false = not; null = cross/unknown → no claim rendered
  eligibleSG: true;            // only true listings ever ship
  specified: false;            // AVS Specified breeds never auto-publish
}
interface ImportedFeed { syncedAt: string; schema: 1; pups: ImportedPup[] }
```

**Banned from the public shape, enforced by the leak scanner (§6.7):**
- supplier name or domain, URL, listingId, sourceUrl
- seller anything
- county or town (they let you trace the breeder: one JRT litter in Kildare)
- microchip numbers (these can be looked up in Irish databases, which reveals the breeder)
- the raw title or description
- the original price or currency
- source image filenames, EXIF

### 2.3 Review queue and audit

```ts
interface ReviewItem { id: string; key: string; firstFailedAt: string; failures: GateResult[];
  candidate: Candidate; decision?: 'approve'|'reject'|'edit'; decidedBy?: string; decidedAt?: string; note?: string }
interface GateResult { gate: string; pass: boolean; severity: 'review'|'reject'; detail: string }
// audit.jsonl — one line per event, append-only:
{ "at": "...", "event": "fetched|parsed|gate_fail|published|unpublished|approved|rejected|takedown|liveness_gone|purged",
  "id": "imp-…", "key": "dfsi:…", "actor": "pipeline|owner", "detail": {...} }
```

---

## 3. Pricing (`scripts/imports/lib/price.mjs`)

```
priceNumber = parse(priceRaw)            // strip €, £, commas, "/ Negotiable", "(Negotiable)", ".00"
if priceNumber == null or /POA|contact|offers|swap/i  → REVIEW "price-unparsed"
if currency == 'GBP'                     → REVIEW "currency-gbp"   (owner D2; default review)
if priceNumber < 150 or > 4000           → REVIEW "price-out-of-band"   (rehoming/placeholder/outlier)
if priceNumber in {1,12,123,1234,1111,9999} → REVIEW "price-placeholder"
if per-puppy prices differ               → use the LOWEST available pup price; card says "from"
priceSGD   = priceNumber + 4000          // e.g. €500 → S$4,500
depositSGD = Math.round(priceSGD * 0.5)  // S$2,250
balanceSGD = priceSGD - depositSGD
```

- The original `priceRaw`, `priceNumber` and `currency` stay in the private store only.
- **Unit tests:**
  - `€500 → 4500/2250/2250`
  - `"€1,200.00 (Negotiable)" → 5200`
  - `"POA" → review`
  - `"£450" → review`
  - `"€1234" → review`
- **Unit-economics warning:** see R1. €X costs about 1.5 × X in S$, before flights and vet fees. The flat S$4,000 markup has to cover transport, paperwork and the perks.

## 4. Arrival estimate (`scripts/imports/lib/arrival.mjs`)

```
listingDate = sourcePublishedAt ?? firstSeenAt
dob = DOB if present
    else if age present → listingDate − age   (arrivalBasis 'age')
    else null                                (arrivalBasis 'listing-date')
base = dob ? addMonths(dob, 3) : addMonths(listingDate, 3)       // owner rule: puppies fly at about 3 months old
arrival = base  → month precision "YYYY-MM" for the website; the date itself goes in the reservation confirmation
display: "Estimated arrival {Month YYYY} · subject to import approval"
```

- **D6, decided 2026-11-13: age-based, no floor.** The earlier `floor = today + LEAD_WEEKS (default 4)` is withdrawn; there is no minimum lead time. Worked example: a puppy reserved at 8 weeks old arrives in about 4 weeks; at 6 weeks old, in about 6 weeks. The reservation confirmation gives the estimated date (DOB + about 3 months) and its month; the terms (redline B1) freeze that estimate at confirmation.
- **Open (owner):** when `base` is already in the past, i.e. the puppy is about 3 months old or older. The 2026-11-13 answers do not cover this; the redline B1 says the puppy "flies once its paperwork and flight are ready" and the confirmation gives our estimate. No number is set here until the owners decide.

- The arrival is **never** shown as a specific day. Words like "guaranteed" or "confirmed" are never used.
- `arrivalBasis: 'listing-date'` (no DOB and no age) is allowed by the owner's rule, but it is **routed to review** by the age-verification gate. Without an age we can't confirm the puppy is under 16 weeks or will be at least 12 weeks at export.
- The arrival is recomputed on every run. If an estimate passes without a reservation, it rolls forward. Once a puppy is older than 20 weeks, the listing is **auto-unpublished** as stale.

## 5. Deposit and reservation flow

1. **Card or detail CTA:** "Reserve on WhatsApp" opens a prefilled message with `ref` (CT-IE-…), breed, sex wanted and price. The message never includes the supplier. Tracked as `data-wa-source="import:<id>"`.
2. **The owner checks the source record** and contacts the breeder to confirm that the puppy is still available, its microchip, vet status, export willingness, and **permission to use the photos** (template in the copy deck). **No deposit is taken until availability is confirmed (within 48 h).** This is the main safeguard against misrepresentation (R4).
3. **Deposit 1 (50%)** by PayNow or bank transfer, as the shop does today. No new payment gateway is needed. A written reservation confirmation goes out: ref, the breeder's name (owner decision Q6, 2026-11-13), microchip, price, estimated arrival date and month, the reservation terms, and the **5-day health promise (nursing plus vet fees at our appointed vet), which starts on arrival**.
4. Curious Tails buys the puppy and starts the AVS import licence, the vet and DAFM health certificate, and the flight booking.
5. **Balance (50%)** is due **before the puppy flies**, after the flight and health certificate are confirmed.
6. Arrival, AVS clearance at Changi, then home delivery and setup plus the standard perks. **The 5-day promise starts on the day the puppy arrives home.**

**Refund and force-majeure terms** (draft; **task T17: legal review before go-live**). *Superseded 2026-11-13: the full terms are in `reports/imported-puppy-legal-redline-2026-11-11.md` (clauses A5, A6 and Part B), with the owners' T17 decisions applied. The bullets below are the 2026-11-08 base text, updated only where an owner decision changed a figure.*
- **Import can't go ahead for reasons outside the buyer's control:** the breeder sells to someone else, the puppy fails its vet check, AVS refuses or delays the licence, an airline embargo, or a breed-rule change. **Full deposit refund within 7 business days**, or the buyer can choose to move the deposit to another puppy.
- **Arrival slips more than 45 days past the estimated month:** the buyer may cancel for a full refund.
- **Buyer cancels before Curious Tails has paid the breeder:** deposit refunded less a fixed S$250 administration fee (D8, closed 2026-11-13).
- **Buyer cancels after the breeder is paid or the flight is booked:** refund of what was paid less actual, receipted, unrecoverable costs, capped at what the buyer paid, with anything later recovered passed back (owner decision 2026-11-13; redline A5.3).
- **Balance unpaid 7 days after the flight is confirmed:** the reservation lapses. Deposit treatment as per the previous bullet.

## 6. Automation

### 6.1 Files (all new; nothing existing is modified except `package.json` scripts and the components in §9)

```
scripts/imports/
  sync-imports.mjs            # orchestrator (npm run sync:imports)
  adapters/dogsy.mjs          # via irishpuppies.ie → dogsy public API + detail page
  adapters/dogquest.mjs       # sitemap.xml → listing RSC initialListing
  adapters/dfsi.mjs           # ad_post-sitemap*.xml lastmod → ad page JSON-LD + details block
  adapters/puppiesie.mjs      # data-page + /api/latest-ads → LEAD-ONLY records (no images)
  lib/http.mjs                # robots, rate limit, retries, ETag/If-Modified-Since, block detection
  lib/breed-map.mjs           # one map, extracted from sync-puppies + sync-overseas + Irish aliases
  lib/price.mjs  lib/arrival.mjs  lib/dedupe.mjs  lib/gates.mjs  lib/images.mjs
  lib/store.mjs               # private store read/write; refuses paths inside repo
  lib/hash.mjs                # HMAC sourceHash, id/ref derivation
  rules/prohibited.json       # AVS prohibited + crosses (dated, source URL)
  rules/specified.json        # AVS specified (dated)
  rules/hdb-approved.json     # AVS/HDB approved small breeds (dated)
  rules/scam-patterns.json
  check-leaks.mjs             # npm run check:import-leaks
  review.mjs                  # npm run imports:review  (CLI list + local HTML at 127.0.0.1)
  unpublish.mjs               # npm run imports:unpublish -- <id|ref> [--purge-images] [--reason takedown]
  approve.mjs                 # npm run imports:approve -- <id> | imports:reject -- <id>
  tests/*.test.mjs            # node --test fixtures from sampled pages (fixtures stored PRIVATE dir, not repo)
```

### 6.2 Fetch rules (`lib/http.mjs`)

- **Robots:** parse and honour each origin's `robots.txt` at the start of every run. If a path is disallowed, skip it and log it.
- **Identity:** the User-Agent is `CuriousTailsImports/1.0 (+https://curioustails.sg/contact/)`. No UA spoofing, no proxies, no headless browser, no cookie replay.
- **Rate:** 1 request every **4 s per host**, concurrency 1. **Caps per run:** about 60 detail pages and 150 images per host.
- **Retries:** on 429 or 5xx, exponential backoff (8 s, 30 s, 120 s), at most 3 attempts. Honour `Retry-After`.
- **Block detection:** a 403, a Cloudflare challenge or block page, or a CAPTCHA marks the host **blocked** for the run, raises an alert and **stops all requests to that host**. No retry and no workaround. dogs.ie is blocked today.
- **Incremental fetching:** keep a per-host seen-set in the store. Fetch details only for **new** ids and for published ids due a liveness check. Send `If-Modified-Since` and ETag headers.
- **dfsi:** read only sitemap entries with lastmod in the last 21 days.

### 6.3 Adapters: entry points and parse targets

| Adapter | Discover | Detail parse | Images |
|---|---|---|---|
| dogsy | `GET dogsy.ie/api/public/listings?page=1..last_page` | `/dogs-for-sale/<id>-<slug>.html`: Product JSON-LD (price, currency, sku), details block (DOB, sex, location), microchip table, Alpine JSON | `/storage/ad-media/*` |
| dogquest | `sitemap.xml` `/listing/*` | RSC `initialListing` (DOB, counts, puppy_details[] with microchip and verified status, images[]); JSON-LD price | Supabase public URLs |
| dfsi | `ad_post-sitemap2.xml` (+ the highest-numbered sitemap) | JSON-LD Product (price, EUR), details block (Breed, DOB, M/F counts, Microchips list, Seller ID), the "sold" token in title or slug | largest `wp-content/uploads/YYYY/MM/*-scaled.jpg` per photo (dedupe size variants) |
| puppiesie | `/` data-page `initialLatestAds` + `/api/latest-ads?page=1..3` | **No detail fetch** (dogs.ie is blocked) | **None.** Lead-only; always goes to the review queue with gate `no-photos-source-blocked` |

### 6.4 Image handling (`lib/images.mjs`)

- Download **directly from the origin's public URL**, with the same rate limits as everything else. If the origin returns 403, give up on that image; no proxy fallback such as weserv.
- **Process each image:**
  - `sharp().rotate()` (normalises orientation; sharp drops EXIF and GPS by default, and `withMetadata()` must never be called)
  - resize to 1200 px wide for the detail page and 800 px for cards; WebP at quality 78
- **Rename** to `imp-<id>-<n>.webp`. No source filename survives.
- Store a **perceptual hash** (dHash) per image for dedupe, and to detect **stock or reused photos** (the same pHash showing up on unrelated ads means review).
- **Watermark gate:** send to review if the image has an overlaid platform logo or URL. Version 1 is a heuristic (the first 20 published per supplier are reviewed by hand, then a pHash match against known logo crops). Version 2 is optional OCR.
- Originals are kept in the private `images-src/` only for takedown evidence. They are purged together with the record.

### 6.5 Dedupe (`lib/dedupe.mjs`)

Matches are checked in order. The first hit merges the new record into the existing listing.
1. **Exact:** `supplier + listingId`
2. **Microchip:** any shared 15-digit chip, across all suppliers. This is the strongest cross-site join.
3. **Image:** dHash Hamming distance ≤ 6 on any photo
4. **Fuzzy:** same breed slug, DOB within 3 days, same county, price within 15%, and male/female counts within 1

- **Merge policy:** keep the record with the most microchips, then the most photos, then the earliest seen. Group alternates under one `ImportedPup` in the private store.
- A cross-supplier duplicate never creates a second public card.

### 6.6 Liveness (published listings)

- **Each run:** check that each published source still appears in its discover feed (API, sitemap or index).
- **Every third day:** re-fetch the detail page.
- **Unpublish triggers:** the listing is gone (404 or missing from the feed twice), it says "sold" or "reserved", the chip status is no longer "For Sale", the puppy is older than 20 weeks, or the arrival month has passed with no reservation.
- **If a Curious Tails buyer has reserved it** (owner sets `status: 'reserved'` via `imports:reserve -- <id>`), the listing is never auto-unpublished. The card shows "Reserved".

### 6.7 Leak scanner (`check-leaks.mjs`), a hard build gate

- **Scans:**
  - `src/data/imported-puppies.json`
  - `src/assets/imported/` filenames, plus WebP metadata (there must be none)
  - after build, every `dist/**/*.{html,json,xml,txt,js}`
- **Fails on:**
  - Supplier tokens: `dogsy`, `dogquest`, `dogs.ie`, `puppies.ie`, `irishpuppies`, `dogsforsaleireland`, `dfsi`, `supabase.co`, `images.dogs.ie`, `wp-content/uploads/20`, `animark`
  - Private values: every seller name, phone, email and regNo, every microchip number, every `listingId` and `sourceUrl`
  - Phrase matches: any 8-word run copied from a source description
- **Wiring:**
  - Runs at the end of `sync:imports`; if it fails, the run doesn't write the public JSON.
  - Runs again in `build:deploy` after `astro build`; if it fails, the deploy is blocked.

### 6.8 Scheduling

- **New Windows Task Scheduler task** "Curious Tails Imports Sync", daily at **06:15 SGT**. Same pattern as `setup-task-scheduler.ps1`; a new `setup-imports-task.ps1` runs `scripts/imports/run-daily.bat`, which:
  1. `npm run sync:imports`
  2. If `src/data/imported-puppies.json` or `src/assets/imported/` changed: `git add` those paths only and commit `chore(imports): sync imported listings (+N/−M)`
  3. `npm run build:deploy`, extended to include `sync:imports --no-fetch` (re-validate only) and `check:import-leaks`
  4. `npm run deploy`
- **Logs:**
  - `logs/imports/<date>.log` (counts only, no PII)
  - private `runs/<date>.json` (full detail)
- **Alerts** go to the channel in D10 (default: append to `logs/imports/ALERTS.md` and email `hello@curioustails.sg` through the existing Cloudflare email routing). Triggered by:
  - a source blocked or erroring two days running
  - zero new items from a source for 7 days
  - a leak-scan failure
  - review backlog over 20 items or older than 72 h
  - a deploy failure

## 7. Review queue, audit, one-command unpublish

- **`npm run imports:review`** starts a local-only server (`127.0.0.1:4791`) showing each queued item, with:
  - the failing gates
  - the private source link (for the owner only)
  - photos and parsed fields
  - **Approve / Reject / Edit** buttons
  
  Approving with edits writes the overrides to the private `overrides.json` (breed, price, DOB, sex counts). The next run publishes the item if every other gate passes. **This page is never deployed.**
- **`npm run imports:unpublish -- <id|ref> [--reason takedown|sold|owner] [--purge-images]`** does the following:
  - removes the listing from the public JSON
  - deletes its WebPs if `--purge-images` is set (always on takedown)
  - adds the URL to the redirect list (detail page → 301 to the breed page)
  - writes to `audit.jsonl`
  - triggers build and deploy
  
  The review UI has the same action as a button. One command or one click, and it's gone from the live site within one deploy, about 5 minutes.
- **`audit.jsonl`** is append-only and records every gate result, publish, unpublish, approval and takedown, with who did it and when.

## 8. Gates (`lib/gates.mjs`)

Severity `reject` means the item is never shown and is logged only. Severity `review` means it goes to the owner queue. **The listing auto-publishes only if every gate passes.**

| # | Gate | Rule | Fail → |
|---|---|---|---|
| G1 | Required fields | breed, price, ≥1 sex count, (DOB or age), ≥1 photo URL | review |
| G2 | Breed mapped | `breed-map` resolves to an existing `src/pages/puppies/<slug>.astro`. A cross maps to its first parent, with `crossLabel` set | review (`unmapped-breed`) |
| G3 | Price parsed | §3 rules (unparsed, GBP, out-of-band, placeholder) | review |
| G4 | Age verifiable | DOB or age present. Age at fetch between 6 and 16 weeks | <6 wks or no age → review. >16 wks → reject (stale or adult) |
| G5 | Arrival derivable | §4 produces a month that is ≥ today | review |
| G6 | Photo local | ≥1 image downloaded, processed and pHash'd. Not a stock or reused image. No watermark flag | review |
| G7 | Duplicate | §6.5. A duplicate of a live listing merges and doesn't fail; a duplicate of a rejected or taken-down item fails | merge or reject |
| G8 | Prohibited breed | Any breed token, title or description matching `rules/prohibited.json` (incl. bully/XL/pocket bully/staffie/amstaff/pit/akita/tosa/cane corso cross if prohibited…) | **reject** |
| G9 | Specified breed | `rules/specified.json` (GSD, Rottweiler, Doberman, Bull Terrier, mastiff types…) | review (never auto) |
| G10 | Singapore eligibility | Microchip present in the source (Irish law requires it to advertise); country of origin Ireland or NI | no chip → review |
| G11 | HDB status | Breed on the HDB list → `hdbApproved:true`. Not on it → `false` (card says "Private housing only"). Cross or unknown → `null` (no claim) | never fails; sets the field |
| G12 | Scam / placeholder | `rules/scam-patterns.json`: "deposit to secure before viewing", "shipping/delivery worldwide", Western Union, Telegram, crypto, "sometimes available", "taking deposits on upcoming litter", "stud", "wanted", "rehoming", "sold", emoji-only title, description under 40 chars | review (stud/wanted/sold → reject) |
| G13 | Source status | Chip status "For Sale" where given. Not sold or reserved | reject |
| G14 | Source access | The source host wasn't blocked when fetched (puppies.ie items: always review, `lead-only`) | review |
| G15 | Leak-safe | The public object passes the §6.7 field check | reject (bug alert) |

**First-run safety valve:** for the **first 14 days, or the first 20 items per supplier**, everything that passes still lands in the queue marked `auto-ready`. The owner bulk-approves with one click. After that, auto-publish turns on (`IMPORTS_AUTOPUBLISH=1`). This protects against parser bugs on day one. The owner can skip it; see D5.

## 9. UI (changes to source go in the OpenCode tasks)

- **New `src/components/ImportedPuppies.astro`.** This is a generalised `OverseasPuppies`. It reads `imported-puppies.json`, filters by `breed`, and is placed **directly after `<AvailablePuppies>`** on every breed page (the same slot as OverseasPuppies; all 48 pages already import it).
- **Card contents:**
  - **badge:** "Available for reservation · Imported" (lilac pill; the AU card uses the same style)
  - photo 1 from `src/assets/imported/` with puppy-descriptive alt text
  - title `{crossLabel ?? breedLabel} · {n} boys / {n} girls`
  - price `S${priceSGD}` "all-in to your door"
  - "50% deposit S${depositSGD} to reserve"
  - "Estimated arrival {Month YYYY} · subject to import approval"
  - age, and the HDB line (only when not null)
  - the perks line ("Starter kit, free delivery & setup, free training lesson")
  - ref code
  - green CTA "Reserve on WhatsApp"
  - secondary link "Details" → detail page
- **Detail page.** Extend `src/pages/puppies/[breed]/[id].astro` `getStaticPaths` to emit `/puppies/<breed>/<imp-id>/` for imported pups. Branch the layout on `imported === true`:
  - gallery
  - a **4-step import timeline** (Reserve → We import → Pay balance before flight → Arrives home)
  - a deposit box
  - refund summary and FAQ (copy deck)
  - perks marquee, reviews, final CTA
  
  The full copy is in the copy deck.
  - **Indexing (D11):** `noindex,follow`, and excluded from the sitemap by default. These pages live for days to weeks; the breed pages carry the SEO. Retired pages 301 to the breed page via `puppy-redirects.mjs`.
- **`/available-puppies/`.** Add a section **"Arriving soon · Imported"** below the local grid, with filter chips (All · In shop now · Arriving soon). Breed filter chips apply to both. The section is hidden when empty.
- **Schema:** a Product node per imported pup on its detail page, and an ItemList on breed pages (optional):
  ```json
  {"@type":"Product","name":"Jack Russell Terrier puppy (imported, for reservation)",
   "image":["https://curioustails.sg/_astro/imp-7f3a2c91de-1.<hash>.webp"],
   "brand":{"@type":"Brand","name":"Curious Tails"},
   "offers":{"@type":"Offer","price":4650,"priceCurrency":"SGD",
     "availability":"https://schema.org/PreOrder","availabilityStarts":"2026-12-01",
     "seller":{"@type":"Organization","name":"Curious Tails"},
     "url":"https://curioustails.sg/puppies/jack-russell-terrier/imp-7f3a2c91de/"}}
  ```
  - Use `PreOrder`, the schema.org state for an item that can be ordered before it's available.
  - No `sku` or `gtin`, no supplier, no county.
  - Business-level reviews stay on LocalBusiness, never on the Product (same as the existing rule).
- **Alt text pattern:** `"{colour} {breedLabel} puppy, {sex}, {age}"` (e.g. "Tan and white Jack Russell Terrier puppy, male, 10 weeks"). Never "from Ireland/Dogsy/…", never a filename.
- **GA4:** the existing `data-wa-source` click tracking gets the value `import:<id>`. New event `import_details_click`. Add both to `scripts/ga4-events.mjs`.
- **Design system:** use the existing tokens (`clay`, `--color-lilac-900`, `--color-coral-*`) and the `ListingGrid` rhythm. No new palette (memory: "Katong shophouse boutique" system).

## 10. Compliance summary

| Area | Requirement | Pipeline control |
|---|---|---|
| AVS import (Ireland = Category A) | 12 weeks or older at export; ISO microchip on all documents; AVS import licence plus dog licence; vaccinations, parasite treatment and an official DAFM-endorsed health certificate; manifest cargo into Changi; no quarantine if all conditions are met | G4 age window, G10 microchip, age-based arrival estimate (D6), copy "subject to import approval", owner SOP checklist (T20) |
| Prohibited breeds | Pit-bull types, Akita, Neapolitan Mastiff, Tosa, Dogo Argentino, Fila Brasileiro, Boerboel, Presa Canario, and crosses | G8 hard reject |
| Specified breeds | GSD, Rottweiler, Doberman, Bull Terrier, mastiff types, and crosses: extra licence conditions | G9 review only |
| HDB | One dog per flat, from the approved list of about 62 breeds | G11; card shows "HDB-approved breed" or "Private housing only" or nothing |
| AVS pet-shop licence | Licensed pet shop selling imported dogs: confirm whether AVS licence conditions require source or traceability disclosure **to the buyer** at sale. Hiding the supplier on the website doesn't remove that duty. | T18: verify with AVS. If required, add it to the sale paperwork, not the website |
| Copyright (photos) | Seller-owned; dfsi T&Cs prohibit republishing; the owner accepted the risk | §6.4 local copies, takedown path §7 (24 h SLA), permission request in the breeder-contact template, purge on takedown |
| Consumer protection (CPFTA) | No false availability, no misleading price or arrival claims, clear deposit and refund terms | 48 h availability confirmation before deposit, "estimated" and "subject to import approval" copy, liveness auto-unpublish, written terms (T17 legal review) |
| Health promise | **The 5-day promise starts when the puppy arrives home in Singapore**, not at reservation | Copy deck; reservation confirmation template |
| Data protection (PDPA, plus GDPR for Irish sellers) | Collect only what's needed; purpose = contacting the seller | Seller fields minimised, never logged, purged 90 days after unpublish |

## 11. Definition of done (for the OpenCode build)

1. `npm run sync:imports` runs end to end against the three usable sources. Rate limits and robots are honoured. It writes **only** `src/data/imported-puppies.json` and `src/assets/imported/`.
2. Unit tests pass for the price, arrival, dedupe and gates modules (`node --test scripts/imports/tests`).
3. `npm run check:import-leaks` passes on data, assets and `dist/`. A seeded leak (a supplier domain injected into a fixture) makes it fail.
4. Breed pages for jack-russell-terrier, chihuahua, border-collie and mini-dachshund render imported cards when data exists, and render nothing when it doesn't.
5. The detail page renders with `PreOrder` schema, `noindex`, and no supplier tokens.
6. `/available-puppies/` shows the "Arriving soon · Imported" section and the filter chips.
7. Review UI: approve, reject and unpublish work. The audit log records each action.
8. The scheduled task is installed (owner runs the PS1 as Administrator). The first 14 days run in safety-valve mode.
9. Legal review (T17) is signed off before `IMPORTS_AUTOPUBLISH=1`.
