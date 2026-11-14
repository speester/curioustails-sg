# K-078 — Biscuit: today's date, passport and About spread

**Date:** 2026-11-13 · **Scope:** `outputs/puppy-page-redesign-biscuit.html`, `outputs/build-biscuit-stage.py` and the staging bundle `_k002_stage/outputs/index.html` only. No Astro source, data file, other page, `rtp-v3` or live site was changed.

## 1. Date

**Before:** the hero read `Available now · Balestier · Listing synced 1 Nov 2026 · may be out of date`; the date and the 7-day warning were rendered by `build-biscuit-stage.py` from `src/data/available-puppies.json → syncedAt`, and a page script only unhid the warning when the date was 7 days old. The FAQ also said the page “updates whenever our puppy list syncs”.

**After:** the line is `Available now · 13 Nov 2026 · Balestier`, with no synced/stale wording anywhere on the page. The visible text is built at runtime from the reader's clock, forced to `Asia/Singapore`:

```html
<p class="avail only-av"><span class="live-dot" aria-hidden="true"></span><span data-avail>Available now · Balestier</span></p>
```

```js
const avail = $('[data-avail]');
if (avail) {
  const now = new Date();
  const label = now.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Singapore' });
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Singapore', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(now).reduce((acc, p) => (acc[p.type] = p.value, acc), {});
  const stamp = document.createElement('time');
  stamp.dateTime = `${parts.year}-${parts.month}-${parts.day}`;
  stamp.textContent = label;
  avail.replaceChildren('Available now · ', stamp, ' · Balestier');
}
```

No date is written into the HTML: the `data-avail` fallback is only `Available now · Balestier` until the script inserts the `<time>`. The build script now only mirrors the page and its assets; all `syncedAt`, `STALE_AFTER`, `data-synced-at` and `data-stale` code was deleted. The FAQ answer no longer mentions a sync and now ends with the existing line “Puppies are reserved quickly, so WhatsApp us to confirm right now.”

**This is a display stamp, not a freshness check** — the date changes with the calendar and makes no claim that the listing was verified.

Timezone checks with the browser set to `America/Los_Angeles`:

| Instant (UTC) | Visible line |
|---|---|
| `2026-11-12T16:30Z` | `Available now · 13 Nov 2026 · Balestier` |
| `2026-11-13T02:00Z` | `Available now · 13 Nov 2026 · Balestier` |
| `2026-11-13T16:30Z` | `Available now · 14 Nov 2026 · Balestier` |

## 2. Biscuit's passport — before / after structure

**Before:** `<article class="passport">` was a 760px bordered box with 24/40px padding. Inside: header (eyebrow, `Biscuit's passport`, descriptor), a 2×2 `<dl class="pp-grid">` of cream rounded tiles (**Sex / Colour / Microchip / Born**), then a 2-up/4-up `<dl class="pp-more">` row (**Breed / Origin / HDB flat / Grown size**). One `--cream-300` 2px border and a soft shadow.

**After:** one commissioned card, 1136px at 1440, in a 12-column grid (5 portrait / 7 content at ≥1024):

```
article.passport                         radius 24 (20 mobile), 1px 8% ink, shadow 0 24px 60px -32px rgba(20,18,14,.35)
├─ div.pp-media                         existing biscuit-2938.webp, cover, 4/3 mobile, full card height desktop
└─ div.pp-body                          44px 48px desktop; 24px mobile
   ├─ header.pp-head                    Puppy ID #2938 · h2 clamp(40px,5.2vw,68px)/650/-0.02em/0.98
   │                                     Apricot Maltipoo girl · about 3 months
   ├─ p.pp-status                       mint pill, 6px dot, Available now
   ├─ dl.pp-grid                        2×2 hairlines: Sex, Colour, Born, Microchip (mono)
   └─ div.pp-actions                    filled WhatsApp (15px 22px, 999px) + Book a viewing text link
```

The four fact values are unchanged. The old secondary row was absorbed where it already lived: **Breed** is in the new At-a-glance list, **HDB approved** remains in the hero chips and FAQ, **Grown size** remains in Breed Fit. **Origin: Local** is the one fact that no longer has a home on the page — flagged below rather than invented into a new row.

## 3. About Biscuit — full editorial spread

**Before:** `.about-grid` was `1.3fr 1fr` with a 56px gap. The lead was Fredoka at `clamp(1.3rem,2.2vw,1.6rem)`, the body was four paragraphs at `58ch`, the pull was “HDB approved — HDB allows one dog of an approved breed per flat” with a 4px coral left border, and the aside was the `.clay.owner-card` containing the “From Nelson and Kim” paraphrase. A developer note (`§3 ABOUT · PuppyAbout…`) sat directly under the section heading.

**After:** a tinted, full-width editorial band that reads as a different room from the peach passport:

```
section.band.band--about                 --lilac-100 full-width band; padding clamp(72px,9vw,120px) top/bottom
└─ div.about-grid                        ≥1024: 7fr text + 4fr rail, 80px column gap, 36px row gap,
   │                                     grid areas "head aside" / "body aside"
   ├─ header.about-head                   eyebrow 11px tracked · h2 clamp(34px,4.6vw,56px)/1.02/-0.02em
   │  └─ p.lead                           21px / 1.6 / 500, --cream-900, max 66ch, 3-line drop cap ≥768
   ├─ aside.about-aside                   white card, 20px radius, 22px padding
   │  ├─ At a glance                      6 hairline rows: Breed, Colour, Sex, Age, Availability, Area
   │  └─ a.aside-ask                      camera icon + “Ask us on WhatsApp for more photos or a short video”
   └─ div.about-body                      first block after the lead, 36px below the header
      ├─ aside.about-callout               --cream-50 card, 3px --coral-500 left border, 16px radius
      │  ├─ span.callout-label             BREED NOTE · 11px tracked coral
      │  └─ p                              “Maltipoos are companion dogs first.” (exact existing sentence)
      ├─ p.pull                            32px / 1.25 / 500, 100px hanging mark at 9% coral, 1px rules
      │                                     “They are gentle with children, quick to learn, and happiest when someone is usually home.”
      └─ p.about-close                      “If that sounds like your household, come and meet her…” · 44px above
```

The lead is the existing first sentence **plus** the existing “She is vaccinated, dewormed and microchipped…” sentence, merged into one standfirst so the 3-line drop cap has three lines to sit beside. No wording was changed and no fact was added. The callout and the pull quote are the two breed sentences that were already in the old body; the closing line is the existing invitation. The developer note is deleted — `PuppyAbout` is gone from the source and no design note renders on the page.

On mobile the DOM order is **header → aside → body**, so the At-a-glance card moves above the body exactly as requested. At 390 the card is 358px wide; at 1440 the rail is 384px beside the 672px text column.

## 4. CSS added — token names only

Tokens used: `--card`, `--cream-50`, `--cream-900`, `--cream-800`, `--cream-600`, `--lilac-100`, `--coral-500`, `--coral-600`, `--mint-100`, `--mint-700`, `--wa`, `--wa-hover`, `--head`, `--body`.

No new palette. The About band uses the existing `--lilac-100` surface; the callout is `--cream-50`; the aside is `--card`; every hairline is `color-mix(in oklch, var(--cream-900) 8–10%, transparent)`. The passport shadow is the specified `0 24px 60px -32px rgba(20,18,14,.35)`; the microchip value uses `ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace`. No gradients.

## 5. Build, deploy, verification

- Rebuilt with `python outputs/build-biscuit-stage.py`; mirrored to `_k002_stage/outputs/index.html`.
- Project `curioustails-staging`, production, branch `main`.
- Final deployment id **`ea7b24bc-28f7-4a78-87b0-1c3373127022`** — https://ea7b24bc.curioustails-staging.pages.dev
- Live: **https://curioustails-staging.pages.dev/outputs/**
- Served page: 120,779 bytes, SHA-256 `049c5e9f2c6167b21698eda46b119e7557142053874419b6a0d5377547c86ec2`, byte-identical to the source and to `_k002_stage/outputs/index.html`, no BOM. 1 file changed, 50 unchanged.
- `/outputs/`, the deployment URL and `/robots.txt`: `200`, `X-Robots-Tag: noindex, nofollow`; `robots.txt` is `User-agent: *` / `Disallow: /`; the page keeps `<meta name="robots" content="noindex">`.
- 1440×1000 and 390×844: 0 console errors, 0 page errors, `scrollWidth === clientWidth`, no mojibake (`U+FFFD` 0; `Â`/`â€`/`â˜…` 0). Visible page text contains no “sync”, “stale” or “out of date”.
- Date line live at both widths: `Available now · 13 Nov 2026 · Balestier`.
- About measured at 1440: `--lilac-100` band, 120/120px padding, 672px + 384px columns with 80px gap, h2 56px/57.12px, lead 21px/33.6px, drop cap 147px/600/8px right margin, callout 21px on `--cream-50` with a 3px coral left border, pull 32px/40px/500 with 100px mark and 1px rules, closing 44px above. At 390: 72/72px padding, one 358px column, height 34px h2, no drop cap, aside y=3660 and body y=4208 (aside above body), callout/pull/closing intact.
- Passport measured at 1440: 472.5px / 661.5px (5/7), 24px radius, 44/48px padding; at 390: 20px radius, 24px padding, 4/3 image, facts 2×2.

## 6. Screenshots

Live, after the final deploy, in `reports/k078-shots/`:

- `passport-1440.png`
- `passport-390.png`
- `about-1440.png`
- `about-390.png`

Extras: `hero-date-1440.png`, `hero-date-390.png` (the date line), `passport-1023.png`, `about-1023.png`, `passport-767.png`, `about-767.png`; measurements in `verify.json`, scripts in `reports/k078-tools/`.

## 7. Left as is / flags

- **Origin: Local** is no longer displayed. The passport is now the specified 2×2 (Sex, Colour, Born, Microchip) and At a glance is capped at the six requested facts. Adding Origin back would mean a seventh fact or an extra row, so it was left out rather than invented into a different wording. Owner can decide whether to restore it.
- The “From Nelson and Kim” paraphrase was removed with the old aside. It was an unapproved paraphrase, not a sourced testimonial; the aside now carries facts only.
- No per-puppy temperament or notes line was added: there is no staff-written note or source for one. The About copy stays at breed-level facts already on the page.
- The “BREED NOTE” label is the only new copy. It is a section label, not a claim; the sentence under it is verbatim.
- The vaccination timeline's week-9 line still reads “6 October 2026 for Biscuit” (existing DOB-derived fact, outside this task).
- The hidden `§9 REVIEWS` design note still mentions `business-context.md`’s older “39 · 5.0” figure and the hidden `§12` note still refers to the 2026-11-01 data pull; both are `display:none` developer notes and do not ship to readers. They were not edited.
- Rebuild/deploy commands: `python outputs/build-biscuit-stage.py`, then `wrangler pages deploy _k002_stage --project-name curioustails-staging --branch main`.
