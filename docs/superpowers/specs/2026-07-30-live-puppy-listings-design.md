# Live Puppy Listings — Design

**Date:** 2026-07-30 · **Status:** Approved by owner

Replace the fictional "Available Puppies" cards on all 50 breed pages with real
inventory from the owner's SpreadSimple site (availablepuppies.spread.name),
refreshed on demand by a re-runnable sync script.

## Data source

SpreadSimple renders a Google Sheet and exposes it as public JSON:

```
https://spread.name/sheet/<SHEET_TOKEN>?query=<b64 json>&options=<b64 json>
```

- 1,014 rows (full history, newest first by `INDEX asc`), 33 rows/page, 31 pages.
- Server caps unauthenticated custom options at 100 rows — page through with the
  site's own captured `options` string (33/page).
- Columns used: `ID-`, `Breed-`, `Price$-`, `Color-`, `Age-`, `DOB-`, `Gender-`,
  `Size-`, `Location-`, `Origin-`, `Name-`, `Image-` … `Image5-`.
- No sold/available flag. Sold pups sink as new rows are added on top, and their
  Image1 is edited to a darkened "FOUND A LOVING HOME" overlay.

## Decisions (owner-confirmed)

1. **Available = top 33 rows** (page 1 of the spread site), minus any row whose
   Image1 already carries the sold overlay (belt-and-braces).
2. **Recently placed** (breeds with no current stock): newest 3–4 historical
   pups of that breed with a clean photo. Photo priority: **Image2** (Image1 is
   usually the overlay), else Image1 if it passes the overlay check, else skip
   to the next pup in history.
3. **Re-runnable sync**: `npm run sync:puppies` → rewrite data + photos, then
   build/deploy as usual.
4. **Titles**: real sheet name where present ("Max — Cream Boy"), else
   "Cream Boy #2581". WhatsApp prefill always includes the pup ID.

## Overlay detection

The sold overlay multiplies the photo dark and stamps white text mid-frame.
Validated signature (grayscale): `p95 < 140` (histogram crushed — clean photos
measure 222–255) **and** >0.5% of pixels in the 42–58% vertical band are >240
(white text). Implemented with sharp raw pixels in the sync script.

## Sync script — `scripts/sync-puppies.mjs`

1. Fetch all 31 pages (0.4s apart), using the captured known-good `options`.
2. Normalize rows; map feed breed labels → page slugs via an explicit table
   (Poochon→bichonpoo, Dachshund→mini-dachshund, West Highland Terrier→westie,
   Schnauzer→miniature-schnauzer, Pomski→pomsky, Poodle→toy-poodle,
   American Cocker Spaniel→cocker-spaniel, …). Unmapped labels are reported,
   never rendered.
3. Partition: top 33 = available (drop overlaid); then walk history per breed
   for recently-placed candidates until 4 clean-photo pups found.
4. Photos: download chosen image per pup → sharp resize to 800px wide WebP
   (~50 KB) → `src/assets/live/<id>-<imgIndex>.webp`. Cache: skip download if
   file exists. Prune files no longer referenced by the JSON.
5. Age: compute months/weeks from `DOB-` (gviz `Date(y,m,d)`, 0-based month) or
   date-valued `Age-`; else use the sheet's age text verbatim.
6. Write `src/data/available-puppies.json`:
   `{ syncedAt, breeds: { [slug]: { available: Pup[], recentlyPlaced: Pup[] } }, unmapped: string[] }`
   where `Pup = { id, title, name?, color, gender, age, price, image, location, origin, sizeNote? }`.
7. Print summary: available per breed, placed counts, dropped-overlay count,
   unmapped labels.

## Rendering — `src/components/AvailablePuppies.astro`

Wraps the existing `ListingGrid`. Props: `breed` (slug), optional heading
overrides. Reads the JSON + `import.meta.glob('../assets/live/*.webp')` so
photos flow through Astro's native image pipeline (build-time WebP, srcset,
width/height, lazy) — no hotlinking.

Three states:

- **Has stock** — "Available {Breed} Puppies", coral "Available" tag, price
  ("$3,688 all-in"), gender + age chips, WhatsApp button "WhatsApp about
  {name}" prefilled with name/color/gender/ID.
- **No stock, has history** — "Recently Placed {Breed} Puppies", muted lilac
  "Recently placed" tag, same real data, button **"Ask about a similar puppy"**
  prefilled "Hi! The {breed} puppies listed were recently placed — could you
  let me know about similar {breed} puppies coming up?". Subhead keeps
  "{breed} puppies for sale in Singapore" phrasing so the money keyword stays
  on-page (protects the keyword-ownership map).
- **No history** — no cards; short note + single "Ask about a similar puppy"
  CTA. No fictional pups anywhere.

`ListingGrid` gains an optional muted tag variant. Second ListingGrid on each
page (related breeds) is untouched.

## Page swap (50 files)

Codemod replaces the available-section `<ListingGrid …items=[…]/>` with
`<AvailablePuppies breed="{slug}" />`, retitles the jump-link "Available" →
"Puppies" (correct in both states; anchor `#available` unchanged), and removes
image imports that are now unused (imports still used by CaptionedBlock etc.
stay). Verified by `astro build`.

## Out of scope

Home + /puppies index breed-tier cards, pricing table, cron/automation wiring
for the sync (candidate follow-up), non-breed pages.
