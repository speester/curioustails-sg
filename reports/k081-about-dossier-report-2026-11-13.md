# K-081 — About Biscuit: puppy dossier

**Date:** 2026-11-13 · **Scope:** `outputs/puppy-page-redesign-biscuit.html`, `outputs/build-biscuit-stage.py` and the staging bundle `_k002_stage/outputs/index.html`. No Astro source, data file, other page or live `curioustails.sg` page was touched.

## 1. Before / after structure

**Before — editorial spread on a lilac band**

```
section.band.band--about                  --lilac-100 full-width band, clamp(72px,9vw,120px)
└─ div.wrap > div.about-grid              1 column; ≥1024: 7fr text + 4fr rail,
   │                                      grid-areas "head aside" / "body aside"
   ├─ header.about-head                   kicker · h2 clamp(34px,4.6vw,56px)
   │  └─ p.lead                           21px/1.6, three-line drop cap ≥768
   ├─ aside.about-aside                   white rail: At a glance, 6 hairline rows
   │                                      (Breed, Colour, Sex, Age, Availability, Area)
   │                                      + WhatsApp photos/video text link
   └─ div.about-body                      breed-note callout · 32px pull quote with
                                          100px hanging quote mark · closing line
```

**After — a puppy dossier with a 7 / 5 portrait and card stack**

```
section.dossier#about                     --cream-100 paper, 1px ink hairlines top + bottom,
└─ div.wrap                               padding clamp(64px,7vw,104px)
   └─ div.dossier-in                      26px label rail + main, 24px gap (≥1024)
      ├─ span.dossier-tag                 BISCUIT · 2938, vertical-rl / rotated 180°,
      │                                   11px, .38em, --cream-600, desktop only
      └─ div.dossier-main
         ├─ header.dossier-head           11px .22em eyebrow · h2 40–48px
         ├─ ul.dossier-chips              5 pills: Breed, Colour, Sex, Age, Area
         └─ div.dossier-grid              12 columns, portrait span 7 / cards span 5
            ├─ figure.dossier-portrait    4/5, radius 28px, cover, soft shadow
            └─ div.dossier-cards          3 white cards, 20px apart
               ├─ article 01              margin-left 8px (sits beside the photo)
               ├─ article 02              margin-left -48px → 48px over the photo
               └─ article 03              margin-left -48px → 48px over the photo;
                                          filled WhatsApp pill inside the card
```

Card content is the existing copy, restructured only:

- `01 — The breed`: “Maltipoos are companion dogs first. They are gentle with children, quick to learn, and happiest when someone is usually home.”
- `02 — Already done`: “She is vaccinated, dewormed and microchipped, and has passed a vet health check.”
- `03 — Come and meet her`: “If that sounds like your household, come and meet her. There is no pressure to buy, and we'll tell you honestly if another breed would suit you better.” + `WhatsApp about Biscuit` pill.
- Placed variant: eyebrow `Found a loving home`, card 3 title `Found a loving home`, the existing “If you were hoping for a Maltipoo like her…” line, and the existing `Ask about a similar Maltipoo` CTA. No new claims.

The old lead, drop cap, callout, pull quote, aside rail and closing paragraph are gone. The facts they carried survive as chips, card copy and the passport above. `id="about"` was added to the section (it had no section id before; `about-h` remains on the H2) so the anchor is stable.

## 2. CSS deleted

Removed in full, not orphaned:

- `.band.band--about` (lilac band + old 72–120px padding)
- `.about-grid`, its `@media(min-width:1024px)` block, `.about-head`, `.about-body`, `.about-aside`
- `.about-head .kicker`, `.about-head h2`, `.about-head .lead`, `.about-head .lead::first-letter` (drop cap) and its `@media(min-width:768px)`
- `.about-callout`, `.callout-label`
- `.about-body .pull`, `.about-body .pull::before`, its `@media(min-width:1280px)` rule
- `.about-body .about-close`
- `.glance-h`, `.glance`, `.glance>div`, `.glance>div:first-child`, `.glance dt`, `.glance dd`
- `.aside-ask`, `.aside-ask svg`, `.aside-ask:hover`

Added `.dossier*` rules only. Tokens used: `--cream-100`, `--cream-200`, `--cream-600`, `--cream-800`, `--cream-900`, `--card`, `--coral-600`, `--wa`, `--wa-hover`, `--lilac-500` (focus ring), `--head`, `--body`, `--ease-out`. No new palette, no gradients.

## 3. Layout measurements

| Viewport | Section padding | Portrait | Cards | Overlap |
|---|---|---|---|---|
| 1440 | 100.8px top/bottom | 634×792, 28px radius, 4/5 | 445px (01), 501px (02/03), 28px padding | 02/03 = **48px**; 01 = 8px gap |
| 1024 | 64px | 531×664 | 371 / 427px | 48px |
| 768 | 64px | 720×480, 24px radius, 3/2 | 720px, 24px padding | first card **24px up** |
| 390 | 64px | 342×228, 20px radius, 3/2 | 342px, 24px padding | first card **24px up** |

- Desktop card stack is vertically centred against the 4/5 portrait (638px stack in a 792px row at 1440).
- 390 and 768 content sits inside 24px gutters; chips are a two-column grid at 390 and a flex wrap at 768.
- The 768 check uses the stacked form (same as mobile) with a 24px upward overlap and no horizontal overlap, so the card stack cannot collide with the photo between 768 and 1023.

## 4. Build, deploy, verification

- Rebuilt with `python outputs/build-biscuit-stage.py`; `_k002_stage/outputs/index.html` is byte-identical to the source.
- Project `curioustails-staging`, environment **production**, branch `main`.
- Deployment id **`0ae1b56b-80d5-4d3f-95c7-4972a89ee041`** — https://0ae1b56b.curioustails-staging.pages.dev
- Live: **https://curioustails-staging.pages.dev/outputs/**
- Served page: **122,219 bytes**, SHA-256 `5894f2ea5310c89fbbea88ea22d92dfe84129b39dc9834e95b7e78007f8cffd5`, byte-identical on the live URL, the deployment URL and `_k002_stage/outputs/index.html`; no BOM. 1 file changed, 50 unchanged.
- `/outputs/`, the deployment URL and `/robots.txt` return `200`; `X-Robots-Tag: noindex, nofollow`; `robots.txt` is `User-agent: *` / `Disallow: /`; the page keeps `<meta name="robots" content="noindex">`.
- 1440×1000, 768×900 and 390×844 live: **0 console errors, 0 page errors, 0 failed requests**, no broken images, `scrollWidth === clientWidth`, no mojibake (`U+FFFD` 0).
- Every card sentence was checked against the previous live page before deploying and is present verbatim; the old About band and every deleted selector are absent from the new source.

## 5. Screenshots

Live, after the final deploy, in `reports/k081-shots/`:

- `about-1440.png`
- `about-768.png`
- `about-390.png`

Before the redesign, from the previous live page: `before-about-1440.png`, `before-about-390.png`. Raw measurements: `reports/k081-shots/verify.json`; scripts in `reports/k081-tools/`.

## 6. Flags

- The brief defines ≥1024 and ≤767 but not 768–1023. That range uses the stacked layout with the first card lifted 24px; this is deliberate so the 48px desktop overlap never meets a too-narrow 5-column stack at 768.
- Card 01 is offset 8px from the portrait rather than overlapping it, preserving the specified distinction between card 01 and cards 02/03. Actual overlap for 02/03 is exactly 48px.
- The placed variant still works: card 03 swaps to the existing “If you were hoping…” copy and the existing “Ask about a similar Maltipoo” pill.
- Rebuild/deploy: `python outputs/build-biscuit-stage.py`, then `wrangler pages deploy _k002_stage --project-name curioustails-staging --branch main`.
