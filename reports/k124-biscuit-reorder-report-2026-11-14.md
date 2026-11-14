# K-124 — Biscuit page: passport removed, four sections reordered, map aligned

**Date:** 2026-11-14 · **Scope:** `outputs/puppy-page-redesign-biscuit.html` and its mirror `_k002_stage/outputs/index.html` (via `outputs/build-biscuit-stage.py`). No other page touched.

## New section order (desktop, available variant)

1. Hero — Biscuit, the Apricot Maltipoo Girl
2. What Biscuit's $3,888 includes
3. **Thirty free gifts, already in the price** (moved up, directly below Includes; internal marquee order unchanged)
4. About Biscuit
5. **Happy Curious Tails families** (moved up, directly below About)
6. Is a Maltipoo right for your home?
7. **Could Biscuit be the one?** (moved up, directly below Breed fit)
8. Biscuit's health record
9. Payment methods
10. Bringing Biscuit home, step by step
11. Meet Biscuit in Balestier
12. What Maltipoo families say
13. Questions about Biscuit
14. Other puppies available now
15. Reserving Biscuit

Everything else keeps its relative order. The placed-variant anchors (`#others-top-anchor`, `#others-home-anchor`) are unchanged.

## Passport removal and anchor cleanup

- Deleted the `§2 PASSPORT` section (it had no `id`; its heading was `#pp-h`) and the whole `/* PASSPORT */` CSS block: `.passport`, `.pp-media`, `.pp-body`, its `@media(min-width:1024px)` block, `.pp-head`, `.pp-id`, `.pp-desc`, `.pp-status`, `.pp-pill`, `.pp-grid*`, `.pp-actions*`.
- No nav or in-page link pointed at it. In-page links now: `#inc-h` ×1, `#others` ×2 — all resolve (0 dead of 3 at every width).
- No empty wrapper or divider remains; "passport" is absent from the rendered text.
- The header order comment and revision notes are updated.

## Families reads as About's proof

The families band moved off its own lilac band onto the dossier's `--cream-100` paper: `.dossier--joined` drops the dossier's bottom hairline and trims its bottom padding; `.band--story` (cream, no top padding, closing hairline) carries the families section. At ≥1024 its heading is indented 50px to sit on the dossier's text column. Markup inside the families section is unchanged.

## Map vs licence panel

`.map-wrap` is now a flex column that the grid row stretches (default `align-items: stretch`). At ≥1024 `.map` is `flex: 1` with a 360px floor, so it always fills the column. "Open in Google Maps" is overlaid at the map's bottom-left, so it no longer adds height under the map. Below 1024 the map is full width at a fixed 4/3 ratio. No pixel heights are hard-coded.

| Viewport | Map bottom | Licence bottom | Δ | Map size |
|---|---|---|---|---|
| 1440 | 8326.6 | 8326.6 | **0** | 522 × 433 |
| 1280 | 8310.6 | 8310.6 | **0** | 522 × 433 |
| 1024 | 8477.6 | 8477.6 | **0** | 438 × 457 |
| 768 (stacked) | — | — | n/a | 736 × 552 (4/3) |
| 390 (stacked) | — | — | n/a | 358 × 269 (4/3) |

## Checks

- **Build:** `python outputs/build-biscuit-stage.py` passes; the stage copy is byte-identical (SHA-256 `3634d452…`, 118,906 bytes).
- **390:** `scrollWidth 390 = clientWidth 390`, 0 console errors, 0 page errors, 0 failed requests on the preview. No overflow at any of the 5 widths.
- **copy_lint** (`rtp-v3/scripts/copy_lint.py`, page fixtured as `dist/outputs/index.html`): 36 fails **before and after, the same list. K-124 adds 0.** The failures were already there: C3 straight quotes (mostly in hidden `.note` spec text and review quotes), C10 uncited review blockquotes, C1 `AS24J00046★★★★★` span joins, and C9 because the date is written at runtime. Not fixed, since that would be copy changes outside this brief.
- **design_check** (`rtp-v3/scripts/design_check.py`): 7 fails before and the same 7 after; K-124 adds 0. They are DU13 em dash and kickers, DU2 `.mq-price` contrast, DU3 iframe focus and small targets, DU4 and BAR1/2 (no `[data-cta]` / `[data-actionbar]` contract in the prototype), and DU11 (a local fixture 404 because assets were not copied). The kicker count went from 15/16 to 15/15 sections only because the passport is gone.
- Headless Chromium leaves the Google Maps embed blank, as it always did. The map box geometry is unaffected.

## Deploy

- **Preview:** https://k124-biscuit-reorder.curioustails-staging.pages.dev/outputs/ (deployment `f4e33d58`, https://f4e33d58.curioustails-staging.pages.dev). Branch `k124-biscuit-reorder`, preview environment.
- Production `curioustails-staging.pages.dev/outputs/` was not touched. It still serves the K-081 build (SHA `5894f2ea…`).

## Flags

- The sticky mobile bar hides while `#final` is in view. Because the Final CTA now sits mid-page, the bar hides briefly there and shows again after it.
- With families moved out, Payment methods and Next steps (both plain `.band`) are now adjacent with no band colour change between them.
- Scripts: `reports/k124-tools/verify-k124.cjs`. Shots and JSON: `reports/k124-shots/`.
