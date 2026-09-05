# Design system — Curious Tails (curioustails.sg)

Authored 2026-09-05 during the RTP Fix pass. This file documents the design the site
ALREADY ships — it is a reconciliation of `src/styles/global.css`, `src/styles/fonts.ts`
and the component library, not a new direction. Where the built site disagrees with the
current pipeline contract, the disagreement is named here rather than silently changed
in code.

## Direction

Claymorphism: a cute, toy-like pet-shop surface. Soft 3D chunky cards, thick borders,
double shadows (an inner highlight plus an outer pop), bubbly rounded corners, a pastel
cream base with a warm coral-orange accent. The mood reference is a cheerful
pet-adoption app illustration — cream, peach, mint and lilac surfaces, everything
looking squeezable.

- **Hero archetype:** `split-panel` — copy and the primary call to action on one side,
  a photographic puppy plate on the other, with a cursor-tracking tilt panel on the
  photo side. Declared on the hero as `data-hero-archetype="split-panel"`.
- **Reading temperature:** warm, plain-spoken, parent-to-parent. Never clinical.
- **The accent is coral and it is scarce.** It marks the one action a section wants.

## Brand words

honest · licensed · warm · unhurried · practical

## Color tokens

Source of truth: `src/styles/global.css`. Ramps are OKLCH so the tints stay even.

| Role | Token | Notes |
|---|---|---|
| page ground | `--color-surface` (`--color-cream-50`) | the default page |
| mid band | `--color-surface-mid` (`--color-peach-100`) | alternating section ground |
| card | `--color-surface-card` | raised clay card |
| deep band | `--color-surface-dark` (`--color-lilac-900`) | inverted band, footer |
| body text | `--color-text` (`--color-cream-900`) | |
| muted text | `--color-text-muted` (`--color-cream-600`) | |
| text on deep | `--color-text-on-dark` (`--color-cream-50`) | |
| border | `--color-border` (`--color-cream-300`) | thick clay borders |
| accent | `--color-accent` (`--color-coral-500`) | the one action |
| accent hover | `--color-accent-hover` (`--color-coral-600`) | |
| secondary | `--color-secondary` (`--color-mint-300`) | supportive chips |
| tertiary | `--color-tertiary` (`--color-lilac-500`) | quiet emphasis |

## Typography

| Role | Family | Weights | File |
|---|---|---|---|
| display / headings | Fredoka | 400–700 | `/fonts/fredoka-400-700.woff2` (preloaded) |
| body | Nunito | 400–700 | `/fonts/nunito-400-700.woff2` |

Both faces are SELF-HOSTED with `font-display: swap`. No third-party font stylesheet is
on the critical path; `npm run check:fonts` measures this and CLS.

## Shape & elevation

- Radii are large and bubbly: pills for controls, `1.5rem`–`2rem` for cards.
- Two-part shadow: an inner highlight plus an outer pop — `--shadow-sm/md/lg`.
- Borders are thick and coloured, never hairline grey.

## Spacing & layout

- One content column, generous vertical rhythm, alternating section grounds
  (surface → surface-mid → surface).
- Sticky header, height `--header-height: 4.5rem`. Every `[id]` carries
  `scroll-margin-top: calc(var(--header-height) + 1rem)` so in-page jumps clear it.

## Motion kit

- Easing: `--ease-out-quart` for arrivals, `--ease-clay-pop` for anything that should
  feel squeezable.
- Reveal on intersection via `[data-reveal]`, **gated on `html.js`** so a reader with
  JavaScript off sees the whole page. `prefers-reduced-motion: reduce` disables it.
- Transform and opacity only. Nothing animates layout.

## Nav

| Slot | Items |
|---|---|
| header | Available Puppies · Our Puppies · Pricing · Starter Kit · Blog · Contact |
| footer | hubs + utility rows from `src/data/registry.ts` |

**Named divergence:** the header carries six links; the current contract caps a local
header at four. The site's architecture is carried by contextual body links, so the
extra two are navigation convenience rather than architecture. Trimming a live header is
an owner decision, so it is recorded in `PLAN-curious-tails-rtp-fix.md` and NOT changed
here. (RTP Fix, 2026-09-05)

## Section-pattern shortlist

Axis tuple order: skeleton / container / rhythm / edge / emphasis / motion / texture / evidence.

| id | slug | axes | evidence | tier | used for | provenance | origin |
|---|---|---|---|---|---|---|---|
| PAT-1 | split-hero | split/none/two-column/bleed/oversized-heading/tilt/photo/owner-photo | owner-photo | A | every page hero | Hero.astro | seed |
| PAT-2 | clay-cards | grid/card/3-up/thick-border/accent-top/hover-lift/tint/comparison | comparison | A | breed and offer card grids | ListingGrid.astro | restyled |
| PAT-3 | stat-strip | band/chip/equal-cells/rounded/numeral/none/tint/sourced-figure | sourced-figure | A | licence, price and litter facts | StatStrip.astro | invented |
| PAT-4 | stepper | track/node/node-sequence/track-line/oversized-numeral/reveal/flat/process | process | A | the take-home process | StepperFlow.astro | seed |
| PAT-5 | quote-band | band/tint-band/single-quote/band-edge/credential/none/tint/expert-quote | expert-quote | A | the AVS-licensed operator's own words | ExpertQuote.astro | restyled |
| PAT-6 | compare-split | split/framed-column/two-column/framed-both/symmetry/none/paper/breed-vs-breed | breed-vs-breed | B | breed comparisons | ComparisonSplit.astro | invented |
| PAT-7 | prose | column/prose-column/pull-out-400w/none/pull-out/none/paper/sourced-figure | sourced-figure | B | long-form guidance | ProseSection.astro | seed |
| PAT-8 | faq-stack | stack/hairline-row/vertical/hairline/colour-chip/disclosure/paper/answer-capsule | answer-capsule | A | the FAQ bank on every money page | FAQ.astro | seed |
| PAT-9 | cta-band | band/none/single/bleed/accent-fill/none/flat/conversion | conversion | A | the closing call to action | FinalCta.astro | restyled |
| PAT-10 | image-rail | rail/plate/horizontal-sequence/overlap-seam/caption-overlay/scroll-x/photo/owner-photo | owner-photo | B | puppy plates | ImageRail.astro | seed |

## Contrast matrix

_Generated by scripts/contrast-check.mjs — do not hand-edit._

| theme | text token | surface | ratio | result |
|---|---|---|---|---|
| light | ink | page | 17.17:1 | PASS |
| light | ink | muted | 15.94:1 | PASS |
| light | ink | tint | 14.95:1 | PASS |
| light | ink | card | 17.78:1 | PASS |
| light | ink | warn-panel | 14.95:1 | PASS |
| light | ink-soft | page | 6.79:1 | PASS |
| light | ink-soft | muted | 6.30:1 | PASS |
| light | ink-soft | tint | 5.91:1 | PASS |
| light | ink-soft | card | 7.03:1 | PASS |
| light | ink-soft | warn-panel | 5.91:1 | PASS |
| light | kicker | page | 6.20:1 | PASS |
| light | kicker | muted | 5.75:1 | PASS |
| light | kicker | tint | 5.40:1 | PASS |
| light | kicker | card | 6.42:1 | PASS |
| light | kicker | warn-panel | 5.40:1 | PASS |
| light | link | page | 6.20:1 | PASS |
| light | link | muted | 5.75:1 | PASS |
| light | link | tint | 5.40:1 | PASS |
| light | link | card | 6.42:1 | PASS |
| light | link | warn-panel | 5.40:1 | PASS |
| light | on-deep | deep | 14.94:1 | PASS |
| light | on-tint | page | 17.17:1 | PASS |
| light | on-tint | muted | 15.94:1 | PASS |
| light | on-tint | tint | 14.95:1 | PASS |
| light | on-tint | card | 17.78:1 | PASS |
| light | on-tint | warn-panel | 14.95:1 | PASS |
| light | warn | page | 8.62:1 | PASS |
| light | warn | muted | 8.00:1 | PASS |
| light | warn | tint | 7.50:1 | PASS |
| light | warn | card | 8.92:1 | PASS |
| light | warn | warn-panel | 7.50:1 | PASS |
| light | badge | page | 17.17:1 | PASS |
| light | badge | muted | 15.94:1 | PASS |
| light | badge | tint | 14.95:1 | PASS |
| light | badge | card | 17.78:1 | PASS |
| light | badge | warn-panel | 14.95:1 | PASS |
| light | figure-label | page | 17.17:1 | PASS |
| light | figure-label | muted | 15.94:1 | PASS |
| light | figure-label | tint | 14.95:1 | PASS |
| light | figure-label | card | 17.78:1 | PASS |
| light | figure-label | warn-panel | 14.95:1 | PASS |
