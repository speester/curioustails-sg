# Owner feedback applied — puppy page prototype addendum

**Date:** 2026-11-08 (revision 1) · 2026-11-09 (revision 2) · **Task:** K-002 revision · **Scope:** prototype only
**Prototype:** `outputs/puppy-page-redesign-biscuit.html` (Biscuit, Maltipoo, ID 2938)
**Template spec:** `reports/puppy-page-template-spec-2026-11-08.md`
**Production source:** unchanged (`src/`, `config/`, `scripts/` untouched; nothing deployed)

---

## Revision 2 (2026-11-09)

1. **Removed** the “Maltipoos who recently found homes” section (§11) from the prototype. The invisible `#others-home-anchor` stays, so the Available / Found-a-home toggle still restores “Other puppies” to its original place. The `.homed` CSS and the section-order comment were removed with it.
2. **Fixed the Balestier map.** The placeholder tile is now a keyless Google Maps iframe for Curious Tails, 2 Balestier Road #01-701, Singapore 320002. No API key is used or exposed. A visible **“Open in Google Maps”** link sits directly below the map as the fallback, pointing at `https://www.google.com/maps/search/?api=1&query=…`.
3. **Removed the “•” separators** in both moving gift rows and the happy-families row. They were the default `<ul>` list markers, not typed characters. The tracks now use `list-style:none` with zero inline padding and the existing 12–18px card margin, so cards are separated by space only.
4. **Shortened the deposit copy** to `A deposit is required to reserve.` Removed “first come, first served” from the next-steps deposit step as well, so no FCFS deposit wording remains in the prototype.

Revision 2 verification: the map iframe rendered Google tiles and the Curious Tails pin at 1440 and 390; the fallback link resolves; the removed section is absent; no marquee list markers remain; the deposit sentence appears exactly once and the long form zero times; no horizontal overflow at 360, 390, 768, 1024, 1280 or 1440; zero console, page or network errors. The prototype now declares an inline blank favicon, which also removes the old `/favicon.ico` 404.

---

## Owner feedback applied

### 1. Two moving rows of free gifts
- Added two marquee rows inside a new **“Thirty free gifts, already in the price”** section (`#gifts`).
- Every card is built from `src/data/starter-kit-items.json`: 30 real items, real names and real prices. The 30 prices sum to **$533**, computed from the data rather than typed.
- Row 1 = Cozy Corner + Toilet Training + Other Essentials (14 items). Row 2 = Grooming + Outdoor + Oral Health (16 items).
- Row 1 scrolls left, row 2 scrolls right. Both pause on hover/focus and stop under `prefers-reduced-motion`, where the row becomes a normal horizontal scroller.
- Photos are the existing `src/assets/starter-kit/*.webp` product shots, copied into `outputs/puppy-page-redesign-assets/kit/`.
- No invented item and no invented price.

### 2. Moving row of happy Curious Tails families
- Added a **“Happy Curious Tails families”** photo row (`#families`) after the gift rows.
- Uses 12 different real handover photos from `src/assets/testimonials/`, copied into `outputs/puppy-page-redesign-assets/families/`.
- These are the same real customer photos used by the existing `TestimonialWall`; no stock photos and no invented customers.
- The testimonial photo data carries no customer names, so no names are printed. Named Google review photos were deliberately not mixed in, because a name must stay attached to its own photo.
- The row pauses on hover/focus and stops under `prefers-reduced-motion`.

### 3. Payment Methods
- Added a **Payment methods** block (`#payment`) with two typographic cards:
  - **PayNow**
  - **Credit Card** + **“3% bank surcharge applies”**
- No fake payment logos: the words are set in the shop's Fredoka/Nunito type and clay card style.
- The copy never suggests the surcharge is waivable. The support line reads: “The 3% is a bank surcharge and applies to credit card payments.”
- Because the page previously said “Nothing is added later”, that line was amended in the hero price card, the “What $3,888 includes” intro and the price FAQ to name the card surcharge as the only extra.

### 4. Puppy Vaccinations
- Added a **Puppy vaccinations** card inside the health section, next to the existing health record, with the owner's operational copy verbatim:

  > For [Puppy]'s remaining puppy core vaccines, please contact Vets For Pets Jurong (6569 1627) / Vets For Pets Lengkok Bahru (8268 4039) to arrange an appointment. Curious Tails will cover these vaccinations when done at Vets For Pets. Please mention to the clinic that Curious Tails will be covering.

- Uses **Lengkok Bahru** (the owner's “Barhu” corrected).
- Phone numbers are `tel:` links. The exact sentence is reproduced unchanged in the visible copy.
- The vaccination FAQ now points to the clinic card instead of implying Curious Tails performs every remaining dose.

### 5. Reserving [Puppy]
- Added a **Reserving [Puppy]** block immediately before the final CTA (`#reserve`), with the owner's copy:

  > Send us a WhatsApp message to check availability and book an appointment to meet [Puppy]. A deposit is required to reserve.

- Added the honesty line: **“Availability is not guaranteed until the deposit is received.”**
- The primary CTA opens WhatsApp with the puppy name and ID prefilled:
  `Hi! I'd like to check if Biscuit (ID 2938) is available and book an appointment to meet her.`
- The final CTA was reworded from “Reserve Biscuit” to **“Check availability on WhatsApp”**. Revision 2 removed the “first come, first served” wording from the “Next steps” deposit step.

---

## Puppy-name variable

In production the name comes from the puppy record (`pup.name`, `pup.id`); the copy patterns are:

- Vaccinations: `For {Name}'s remaining puppy core vaccines, please contact …`
- Reserving: `Send us a WhatsApp message to check availability and book an appointment to meet {Name}. A deposit is required to reserve.`
- CTA prefill: `Hi! I'd like to check if {Name} (ID {id}) is available and book an appointment to meet her.`

In this prototype, `PUP = { name: 'Biscuit', id: '2938' }` sits at the top of the script. Every `[data-pup-name]` span and the reservation WhatsApp href are written from that object. The rest of the page still carries Biscuit's static copy, so Poppy's page must use the production data layer rather than editing the prototype by hand.

---

## Prototype section order

Hero → What's included → Passport → About → Breed fit → Health + vaccinations → Payment methods → Free-gift marquees → Happy families marquee → Next steps → Visit → Reviews → FAQ → Other puppies → Reserving → Final CTA.

This keeps the owner's key sequence (price → about/breed → vaccinations → payment → gifts → families) and keeps the reservation next to the final CTA. Passport, next steps, visit, reviews and FAQ were already in the prototype flow and were left in place; revision 2 removed recently homed.

---

## Verification

Revision 1 checks (still passing):

- All three marquee tracks move in normal motion (computed transform changes over time).
- Under `prefers-reduced-motion: reduce`, all three tracks report `animation-name: none` and each marquee becomes horizontally scrollable.
- Exact-copy checks pass for the vaccination paragraph in rendered text.
- The reservation CTA href contains `Biscuit` and `2938`.
- The Available / Found-a-home prototype toggle still restores `#others` to its original place before the reservation block.
- All referenced prototype images exist; 46 unique assets, 0 missing.

Revision 2 checks (2026-11-09):

- **Recently-homed section:** absent from the DOM; the phrase “Maltipoos who recently found homes” is not in the rendered text, and no `.homed` rule remains in the stylesheet.
- **Map:** the iframe loads `https://www.google.com/maps/embed?...` for “Curious Tails, 2 Balestier Road #01-701, Singapore 320002”; on both 1440 and 390 it painted Google tiles, the Curious Tails pin, the address card and the “Map data ©2026 Google” attribution (40 and 39 images respectively, 9 and 7 tile requests). The fallback link text is “Open in Google Maps” and its href is `https://www.google.com/maps/search/?api=1&query=Curious+Tails%2C+2+Balestier+Road+%2301-701%2C+Singapore+320002`, opening in a new tab.
- **Marquees:** all three `.mq-track` elements compute `list-style-type: none` and `padding-left: 0px`; screenshots show no “•” between cards, only the 12–18px card margin.
- **Deposit copy:** rendered text contains `A deposit is required to reserve.` exactly once and contains neither the long sentence nor “first come, first served”.
- **Layout:** no horizontal overflow at 360, 390, 768, 1024, 1280 or 1440 px (`scrollWidth === clientWidth` at every width).
- **Console:** zero console errors, page errors or failed requests at 390 and 1440, including while the Google Maps iframe loads. The inline `data:` favicon removes the previous `/favicon.ico` 404.

## Files changed

Revision 2 changed the prototype, this addendum and the six `prototype-biscuit-r2-*` screenshots. No other prototype assets were touched.

- `outputs/puppy-page-redesign-biscuit.html` — prototype updated.
- `outputs/puppy-page-redesign-assets/kit/*.webp` — 30 starter-kit photos copied from `src/assets/starter-kit/`.
- `outputs/puppy-page-redesign-assets/families/*.webp` — 12 handover photos copied from `src/assets/testimonials/`.
- `reports/puppy-page-owner-feedback-addendum-2026-11-08.md` — this file.
- Revision 1 screenshots:
  - `outputs/puppy-page-research/screens/prototype-biscuit-v2-desktop.jpg`
  - `outputs/puppy-page-research/screens/prototype-biscuit-v2-mobile.jpg`
  - `outputs/puppy-page-research/screens/prototype-biscuit-v2-payment-desktop.jpg`
  - `outputs/puppy-page-research/screens/prototype-biscuit-v2-gifts-desktop.jpg`
  - `outputs/puppy-page-research/screens/prototype-biscuit-v2-families-desktop.jpg`
  - `outputs/puppy-page-research/screens/prototype-biscuit-v2-reserve-desktop.jpg`
  - `outputs/puppy-page-research/screens/prototype-biscuit-v2-payment-mobile.jpg`
  - `outputs/puppy-page-research/screens/prototype-biscuit-v2-reserve-mobile.jpg`
- Revision 2 screenshots:
  - `outputs/puppy-page-research/screens/prototype-biscuit-r2-desktop.jpg` — full page, 1440 (the cross-origin map iframe does not paint in a stitched full-page capture; the map shot below is the render proof)
  - `outputs/puppy-page-research/screens/prototype-biscuit-r2-mobile.jpg` — full page, 390 (same iframe capture caveat; see the map shot)
  - `outputs/puppy-page-research/screens/prototype-biscuit-r2-map-desktop.jpg` — rendered Balestier map + fallback link
  - `outputs/puppy-page-research/screens/prototype-biscuit-r2-map-mobile.jpg` — rendered Balestier map + fallback link
  - `outputs/puppy-page-research/screens/prototype-biscuit-r2-gifts-desktop.jpg` — gift rows with no bullet separators
  - `outputs/puppy-page-research/screens/prototype-biscuit-r2-families-desktop.jpg` — families row with no bullet separators

## Open items for the owner before production

1. **Confirm the payment wording.** The block states only the 3% credit-card bank surcharge. It does not say whether PayNow carries any fee; if PayNow also has a charge, the copy needs that line before launch.
2. **Confirm the two clinic details.** Trading name “Vets For Pets”, the Jurong and Lengkok Bahru branches, and both phone numbers should be checked against the clinic listings.
3. **Health record nuance.** The page says a puppy is “vaccinated” and also lists remaining core vaccines. Production should mark which doses are complete and which remain at Vets For Pets, so the two statements cannot read as a contradiction.
4. **FAQ schema.** The new “How do I pay?” question must be added to `puppyFaq()` so the visible FAQ and the FAQPage JSON-LD stay one source.
5. **Starter-kit photo labels.** A few product photos carry on-image labels that differ slightly from the sheet names (e.g. “Pee Trainer” vs “Pee Training”, “Paw Cleaning Foam” vs “Paw Cleaner”, “800g Kibble” vs “Kibbles”). The card uses the sheet's name and price; production should reconcile the photo labels or recrop before launch.
6. **Prototype image loading.** Every image in this prototype is eager-loaded so the marquee rows never show blank cards during review. Production should restore lazy loading and responsive `astro:assets` sizes, especially for the 30 kit photos and the 12 family photos.
7. **Map in production.** The prototype uses a keyless Google Maps iframe. Decide before production whether to keep that iframe (third-party request on load, no API key) or ship a static map image with the same “Open in Google Maps” link. Either way, keep the link as the fallback.
8. **Recently-homed removal.** The prototype no longer shows “Maltipoos who recently found homes”. Update the template spec and the production route plan so `RecentlyHomed` is not reintroduced on this page.
