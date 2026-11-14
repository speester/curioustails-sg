# K-134 — Reviewable sample of an imported puppy page

**Date:** 2026-11-14 · **Scope:** a demo preview with labelled sample data. No real imported record, no production deploy.

## Preview URLs (project `curioustails-staging`, branch `k134-imported-sample`, deployment `35eb2db6`)

- `/available-puppies/`: https://k134-imported-sample.curioustails-staging.pages.dev/available-puppies/#arriving-soon
- Detail page (main sample): https://k134-imported-sample.curioustails-staging.pages.dev/puppies/jack-russell-terrier/imp-5a3d1e0001/
- The other three detail pages: `/puppies/chihuahua/imp-5a3d1e0002/`, `/puppies/beagle/imp-5a3d1e0003/`, `/puppies/jack-russell-terrier/imp-5a3d1e0004/`

Every URL returns 200 with `x-robots-tag: noindex, nofollow`, which is the preview header and is still in place. Production (`curioustails-sg`, curioustails.sg) was not deployed: `curioustails.sg/puppies/jack-russell-terrier/imp-5a3d1e0001/` returns 404, and its `/available-puppies/` has no sample text. `config/project-config.md` names `curioustails-sg` as `CLOUDFLARE_PROJECT`, so `scripts/deploy-pages.sh` would have targeted the production project. I ran its pre-checks by hand (`check:import-leaks --dist` OK, `_headers` noindex present), then ran `wrangler pages deploy --project-name curioustails-staging` directly.

## Where the data came from

`scripts/imports/make-sample-feed.mjs` (new) runs the pipeline's own fixture builder, `cleanRecord()` in `scripts/imports/tests/_pipeline-fixtures.mjs`, through the real `evaluateGates`, price, arrival and `buildPublicPup` code. It uses the same overrides as:

| Sample | Fixture source | Pipeline verdict on the fixture | Rendered |
|---|---|---|---|
| SAMPLE-1 `imp-5a3d1e0001` | K-091 e2e snapshot record 1, clean dogsy JRT (`reports/k091-tools/t26-fixture-e2e.mjs`) | pass | Jack Russell Terrier, 2 boys / 1 girl, Tan & White, DOB 2026-09-04, 10 weeks, S$4,550 (deposit S$2,275 / balance S$2,275), arrival December 2026, HDB-approved |
| SAMPLE-2 `imp-5a3d1e0002` | K-091 e2e record 2, Chihuahua | review (G14 lead-only; would never publish for real) | Chihuahua, same fixture defaults, S$4,550, HDB-approved |
| SAMPLE-3 `imp-5a3d1e0003` | K-091 e2e record 3, Beagle | pass (sold in K-091; shown here as if live) | Beagle, S$4,550, "Private housing only" |
| SAMPLE-4 `imp-5a3d1e0004` | `sync-imports.test.mjs` dedupe fixture (dogquest, one White girl at €560) | pass | Jack Russell Terrier, White, S$4,560 (S$2,280 / S$2,280) |

Arrival is DOB + 3 months (`lib/arrival.mjs`), which gives December 2026. In the schema, `availabilityStarts` is `2026-12-01`.

**Photos:** re-encoded copies of existing breed-library images (`src/assets/<breed>/` #1, 2, 7 · chihuahua #13, 10, 14 · beagle #7, 9, 2 · JRT #10, 12). The alt text says "Sample photo from our breed library: …", with "available in Singapore" removed. They are re-encoded, not copied byte for byte. With identical bytes, Vite had emitted the breed pages' own images under the sample file names.

**Fixture fields that do not hold up, left exactly as the pipeline produced them:**
- Chihuahua and Beagle show S$4,550, not €500/€600 + S$4,000. The fixture's per-puppy price is €550, and the pipeline prefers per-puppy prices over the listing price.
- Chihuahua and Beagle are "Tan & White" and every sample is "2 boys / 1 girl". These are the `cleanRecord()` defaults. On SAMPLE-4 they also contradict its one listed puppy, which is a girl.
- The fixtures have no puppy name, so no name is shown. Seller, county, microchip and source price are never public by construction.

## Sample label: wording and placement

The wording is **"Sample listing — demo data, not a real puppy"**, followed by: "Built from pipeline test fixtures to preview the layout. This puppy does not exist and cannot be reserved; the photos are from our breed library."

- **Card:** a dashed coral box is the first element in every card, 15 px from the card top, above the photo. It sits in the viewport at 1440 and 390 (`data-sample-label`).
- **`/available-puppies/` section:** the same notice sits under the "Arriving soon · Imported" intro.
- **Detail page:** a full-width dashed banner is the first thing under the site header. It is at 116–190 px at 1440 and 84–202 px at 390, so you see it without scrolling.
- **Also marked:** the page title ("Sample Listing (Demo Data) · Jack Russell Terrier | Curious Tails"), the meta description, the schema Product name, and the ID stamp ("Ref SAMPLE-1").
- **WhatsApp prefill:** "[SAMPLE LISTING PREVIEW - demo data, not a real puppy] Puppy id imp-5a3d1e0001, ref SAMPLE-1: …". Every sample `wa.me` link has `?text=` containing the puppy id, and every link carries `data-wa-source="import:imp-…"`.

## Detail page: schema types and content

- **JSON-LD:** `Product` (offer `Offer` with `availability: https://schema.org/PreOrder`, `price 4550`, `priceCurrency SGD`, `availabilityStarts 2026-12-01`, seller `Organization`, `Brand`), `FAQPage` (8 Question/Answer), `BreadcrumbList`. There is no LocalBusiness block and no AggregateRating.
- **Validators:** `check-schema-required` and `check-schema-rich` PASS. The only rich-result warning is "no priceValidUntil".
- **Robots:** `<meta name="robots" content="noindex, follow">`, and no `/imp-` URL is in the sitemap.
- **Sections:** hero (reservation framing, all-in price, "Reserve with 50%" and "Balance, due before your puppy flies"), what's included, gifts, about, final CTA, health and arrival (5-day promise, boarding on arrival, the arrival-estimate explainer, and the **Vets For Pets block**: Jurong 6569 1627; Lengkok Bahru WhatsApp/mobile 8268 4039 and landline 6255 6064, as 3 `tel:` links and 1 `wa.me`), how reserving works, visit, FAQ, other puppies.
- **Deposit terms:** steps 2 and 3 now use redline clauses A2, 4.1 and 4.2 word for word (in `impSteps`, with a comment pointing at the redline).
- **Removed on samples:** the Google reviews and "Happy families" sections, so no testimonial sits next to demo data. There is no UEN, no "guarantee" and no price other than the listed one. The AVS licence number in the hero trust line is the real licence.

## No leak into non-sample pages

I built the stage twice, once with `IMPORT_SAMPLES=1` and once without, and diffed the output. The only differences are `available-puppies/index.html` and the 4 new sample pages. Every other HTML file is byte-identical. `PreOrder` and the sample prices appear only on the 4 sample pages. Breed pages never show samples, because `importedForBreed` excludes them. `check:import-leaks --dist` is OK.

## Verification (`reports/k134-tools/verify-k134.mjs`, results in `reports/k134-shots/{local,preview}/verify-k134.json`)

| Check | 1440 | 390 |
|---|---|---|
| Status / horizontal overflow / console errors, `/available-puppies/` | 200 / none (1440=1440) / 0 | 200 / none (390=390) / 0 |
| Same, detail page | 200 / none / 0 | 200 / none / 0 |
| Card label in viewport, 4 of 4 cards labelled | yes | yes |
| Card price / arrival font | 20 px coral / 14 px | 20 px / 14 px |
| Detail banner without scrolling | yes | yes |
| Chips: "Arriving soon" shows imported only; "In the shop now" shows local only (7 groups) | pass | pass |
| Card "See photos & details" reaches the detail page, banner present | pass | pass |
| WhatsApp `?text=` contains the puppy id | pass | pass |

**Other gates (run in the stage copy):** `npm run build` PASS (`check:surcharge`, `check:puppy-pages`). `test:imports` 184/184. `test:puppy-page` PASS. `page-health --keyboard` PASS on both routes.

## How it is built, and what changed in the repo

**Two locks keep samples out of real builds:**
- The build must run with `IMPORT_SAMPLES=1`.
- `src/data/imported-puppies.sample.json` and `src/assets/imported-samples/` must exist. The generator refuses to write them into the repo, and they exist only in the stage copy `D:\Claude Code\_k134_stage`.

**Changed (uncommitted, like the rest of the shared tree):**
- `src/lib/imported-puppies.ts`
- `src/components/ImportedPuppyCard.astro`, `ImportedPuppies.astro`
- `src/lib/puppy-page.ts`, `src/data/puppy-page-copy.ts`, `src/data/buying-terms.ts`
- `src/components/puppy-page/HealthRecord.astro`, `PuppyPage.astro`, `puppy-page.css`

**New:** `scripts/imports/make-sample-feed.mjs`, `reports/k134-tools/verify-k134.mjs`.

**What the preview build contains:** it is built from a copy of the whole shared working tree, so it also shows other in-flight uncommitted cards (K-119, K-130 and others), the same caveat K-119 flagged.

## Flags for the owner

1. **The redline wording and the Vets For Pets block apply to every imported page, not just samples.** The steps text (redline A2/4.1/4.2) and the Vets For Pets block will show on real imported pages once one is approved. The redline is still with counsel.
2. **K-130's template shows reviews and families on real imported pages.** It includes the Google reviews and "Happy families" sections for the imported variant, while the older imported page and the copy deck had no reviews. I removed them only on samples. Decide which applies to real listings.
3. **The filter chip is labelled "Arriving soon",** not "Imported" (`data-import-filter="imported"`, copy deck §2). I left it unchanged.

## What a real listing would show differently

A real approved listing would show:
- a `CT-IE-XXXXXX` ref and its own processed supplier photos;
- the approved record's actual sex, colour, DOB and price;
- no sample banner, and the copy-deck WhatsApp prefill (with the ref, not the id);
- under the current K-130 template, the Google reviews and families sections that samples suppress.
