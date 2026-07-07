# Design System & Taste Rulebook

This file governs HOW the site looks and feels. Every build and content skill
reads it before generating. Where this file disagrees with any other instruction
on a VISUAL matter, THIS FILE WINS.

## GOVERNING OVERRIDE (read first)
This is a local-service CONVERSION site, not a design portfolio. When design
ambition conflicts with the TWO-SECOND RULE — a visitor must instantly grasp
(1) what the business offers and (2) how to act (call / message / book / visit)
— CONVERSION WINS. Apply craft (colour, type, motion, anti-slop) in service of
clarity, never expression for its own sake. For most local businesses TRUST is
the primary conversion lever, so trust signals (licence, credentials, reviews,
real proof) must be visually prominent, not buried or decorative.

## COLOUR
- Use OKLCH. Define brand colours in the Tailwind theme as OKLCH values; reduce
  chroma as lightness approaches 0 or 100.
- Never pure #000 or #fff. Tint every neutral toward the brand hue
  (chroma 0.005–0.015). Warm and human, not clinical, unless the brief demands it.
- Use color-mix(in oklch, ...) for overlays, hover states, border tints, and
  shadow colour. Prefer explicit colours over heavy alpha transparency.
- Pick a strategy before picking colours (default RESTRAINED for trust brands):
  - Restrained: tinted neutrals + ONE accent ≤10% of surface  ← default
  - Committed: one saturated colour carries 30–60% of surface
  - Full palette: 3–4 named roles, each used deliberately
  - Drenched: the surface IS the colour
- 60-30-10: ~60% neutral surface, ~30% secondary, ~10% accent (CTAs).
- Name a real aesthetic reference before committing to a palette. If someone
  could guess the palette from the business category alone, it is the
  training-data reflex — rework.

## THEME (light vs dark is never a default)
Write one sentence of physical scene: who uses this, where, under what ambient
light, in what mood. If that sentence does not force light-or-dark, add detail
until it does. Dark sections allowed sparingly; if used, invert to light tokens,
verify 4.5:1 contrast on all text, and use outlined/light-fill CTA variants.
For dark surfaces, get depth from surface lightness (e.g. 12–18%, never pure
black), not from heavy shadows.

## TYPOGRAPHY
Font-selection procedure (never skip):
1. Write 3 concrete brand-voice words (physical-object words, from
   BRAND_VOICE_WORDS — e.g. "warm, sturdy, honest", not "modern, elegant").
2. List 3 reflex fonts; reject any on the reflex-reject list below.
3. Choose fonts as physical objects matching the 3 words; reject the first thing
   that merely "looks designy". If the pick matches your original reflex, restart.
Reflex-reject list (do NOT use): Inter, DM Sans, DM Serif Display/Text,
Poppins, Montserrat, Outfit, Plus Jakarta Sans, Instrument Sans/Serif, Space
Grotesk, Space Mono, Fraunces, Newsreader, Lora, Crimson/Crimson Pro/Text,
Playfair Display, Cormorant/Cormorant Garamond, Syne, IBM Plex Sans/Serif/Mono.
Rules: body 65–75ch; ≥16px; rem units (never px for body). Modular 5-size scale,
ratio ≥1.25 between steps (avoid flat scales). Hierarchy via scale + weight.
Fluid clamp() headings (max ≤ ~2.5× min). font-display: swap; preload critical
weight; variable fonts for 3+ weights. text-wrap: balance on headings, pretty on
paragraphs; font-optical-sizing auto. ALL-CAPS only with 5–12% letter-spacing
(never all-caps body). You often need only one font; if pairing, contrast on
multiple axes — never pair similar-but-not-identical fonts. No monospace as lazy
shorthand for "technical".

## LAYOUT
- Content containers max-width ~1400px, centred default for service/location
  pages. Full-bleed sections may break out; content within stays contained.
- Asymmetric compositions WITHIN sections; consistency BETWEEN sections.
- Do not centre everything. NO centred hero text over a dark image — use
  split-screen, left-aligned, or asymmetric whitespace.
- Vary spacing for rhythm (same padding everywhere is monotony). 4pt scale;
  prefer gap over margins in flex/grid.
- Every section needs visible design treatment AND background alternation
  between consecutive sections (classes like default / mid / card / dark /
  accent). No plain unstyled text blocks.
- Squint test: when blurred, primary, secondary, and groupings must still read.

## CARDS (conflict resolved)
- Cards are allowed ONLY for genuine LISTINGS (product/breed/service grids):
  repeat(auto-fit, minmax(280px, 1fr)). Each listing card = a single <a>,
  no nested anchors.
- Everywhere else, cards are the lazy answer — discouraged. Replace repeated
  icon+heading+text card grids (the classic AI-slop tell) with varied section
  layouts, captioned blocks, and split compositions.
- Nested cards: NEVER.

## SHADOWS (conflict resolved)
- Ban Tailwind default box-shadows and any rgba(0,0,0) shadow. No neon/glow.
- Define a 3-tier tinted system in the Tailwind theme: sm (subtle lift),
  md (card elevation), lg (overlay), each via
  color-mix(in oklch, var(--accent), transparent N%).
- Multi-layer: a tight close layer + a wide diffuse layer.

## DOUBLE-BEZEL
For depth without heavy shadow: outer bezel (background tint, large radius,
padding) → inner bezel (surface colour, smaller radius, content). Define once
as a reusable utility in the global CSS layer.

## ICONS (conflict resolved)
- Inline SVG preferred, with a globally standardized stroke-width.
- A single icon library (e.g. Lucide via astro-icon) is acceptable IF
  stroke-width is standardized. No mixing libraries. No icon font kits.
- No emoji as icons (and no emoji anywhere — see bans). No large rounded-corner
  icon badge above every heading (current-template tell).

## STICKY CTA (conflict resolved — conversion wins)
- ALLOWED iff ALLOW_STICKY_MOBILE_CTA = yes (default yes): ONE tasteful sticky
  mobile call/WhatsApp bar. For a high-intent local buyer on a phone this is a
  top conversion element. Keep it single and unobtrusive; desktop omits it.
- No stacks of floating widgets, no fixed contact strips beyond that one bar.

## MOTION
- Animate ONLY transform and opacity (never width/height/top/left/margin/padding).
- Ease-out exponential curves (ease-out-quart default); no bounce, no elastic.
  Entrances ~500–800ms; exits ~75% of entrance.
- Stagger: animation-delay calc(var(--i,0) * 50ms), cap 500ms total.
- One orchestrated page-load reveal beats scattered micro-interactions.
- will-change only on actively animating elements; isolate ambient motion on its
  own layer. Scroll reveal via IntersectionObserver or animation-timeline:view()
  — never window scroll listeners.
- @media (prefers-reduced-motion: reduce) REQUIRED (preserve function, drop
  spatial movement). <noscript> failsafe: [data-reveal]{opacity:1;transform:none}.
- CSS-only, no external animation libraries.

## COPY (house rules; content skills enforce too)
- No em dashes anywhere (title, body, FAQ, meta, alt, schema, comments). Use
  commas, colons, semicolons, periods, or parentheses.
- ≤3 sentences per component (educational sections may go to 5). One idea per
  short paragraph. Every word earns its place; no restated headings.
- CTAs verb-first, ≤4 words ("WhatsApp us", not "Click here to contact us").
- Errors: what happened + why + how to fix. Pick one term per concept, keep it.

## ABSOLUTE BANS
Gradient text (background-clip:text), glassmorphism-by-default, side-stripe
accent borders (border-left/right >1px as accent), the hero-metric template
(big number + small label + gradient), identical card grids (except listings),
modal-as-first-thought, height:100vh (use min-height:100dvh), default/neon
shadows, emoji anywhere (markup, text, alt, comments), icon font kits, inline
onclick / inline event handlers (except onerror on <img>), element.style for
state or continuous animation, alert()/confirm()/prompt(), all-caps body,
timid palettes + average layouts, zero imagery on briefs that imply imagery,
defaulting to editorial-magazine aesthetics on non-editorial briefs.

## ENGINEERING REFERENCE
- z-index tokens only: base 0, sticky 100, overlay 200, modal 300, toast 400.
- :focus-visible rings (2px solid accent, 2px offset). 44px min tap targets.
  scroll-margin on focusable elements. Never disable zoom.
- env(safe-area-inset-*); @media (pointer:coarse) and (hover:hover); @media print.
- State via data-* attributes + CSS class toggling; no global state libs.
- Buttons: generous padding, intentional radius from the scale, subtle active
  transform (scale .98). Never naked text links for primary actions.
- Loading: skeletons matching real layout, not generic spinners.
- contain: layout on grid containers; content-visibility on long offscreen
  sections (skip the first two after the hero).
- Performance targets (every choice serves these): LCP <2.5s, CLS <0.1, INP <200ms.
- Images: WebP only; Astro <Image> with srcset/sizes; hero eager + preload +
  fetchpriority high; the rest lazy + async; explicit dimensions to prevent CLS;
  descriptive keyword-natural alt; broken-image onerror fallback.

## IMAGERY
When the brief implies imagery, ship imagery — zero images is a bug. One
decisive photo beats five mediocre ones. (Image generation handled by image-gen
via kie.ai; this section governs how imagery is USED and placed.)
- Greenfield fallback: before image-gen has produced real photography for a
  page, use real Unsplash photography (properly licensed, no attribution
  required) instead of a placeholder box. A tasteful stock photo beats a grey
  "image pending" rectangle every time — the latter reads as broken, not
  in-progress. Swap for the generated WebP once image-gen runs; don't ship
  placeholder rectangles to a live/reviewed page.

## MOTION DURATION AND EASING (reference)
- 100–150ms: micro feedback (button press, toggle). 200–300ms: state changes
  (accordion, tab switch). 300–500ms: layout shifts (panel open). 500–800ms:
  entrances. Exit ≈75% of its matching entrance.
- Named curves beyond the ease-out-quart default, use where the motion calls
  for it: `cubic-bezier(0.16,1,0.3,1)` entering, `cubic-bezier(0.7,0,0.84,0)`
  leaving, `cubic-bezier(0.65,0,0.35,1)` toggles.
- Register `@property` for any custom property that needs to animate but can't
  transition natively (gradient angles/stops, complex multi-part values).

## TYPOGRAPHIC POLISH (additions)
- OpenType features where they earn their keep: `font-variant-numeric:
  tabular-nums` on data/price tables, `diagonal-fractions` for fractions,
  `all-small-caps` for abbreviations/acronyms in running text, `font-variant-
  ligatures: none` for any code/monospace content.
- Token hierarchy: define primitive tokens (`--sand-500`, `--amber-600`) then
  semantic tokens that reference them (`--color-accent: var(--amber-500)`).
  Dark-mode or theme variants redefine only the semantic layer, never the
  primitive scale.

## OPTIONAL TEXTURE
A single grain/noise overlay is permitted, never required: one `position:
fixed` element, `pointer-events: none`, a tiny repeating SVG data-URI or PNG,
applied once at the page root. Never duplicated per section — that reads as
a template default, not a considered choice.

## ENGINEERING HYGIENE (addition)
Every `addEventListener` either has matching cleanup (for anything that can
be torn down/re-rendered) or is scoped to an element that persists for the
page's lifetime (header, document-level listeners set up once in a page-load
script). Don't accumulate duplicate listeners across client-side navigations.

## ACCESSIBILITY
WCAG AA: body 4.5:1, large text 3:1, UI/placeholder per spec. Visible labels on
all form fields; validate on blur; errors below fields with aria-describedby.
Skip link first focusable. aria-expanded on toggles; aria-current on active nav;
aria-hidden on decorative SVG. Carousel aria-live as a sibling of the track.
Eight interaction states accounted for (default/hover/focus/active/disabled/
loading/error/success). Roving tabindex for component groups. Dangerous combos
to avoid: light gray on white, gray on colour, red on green, blue on red.

## THE TWO SLOP TESTS (run before any page ships)
1. Could someone say "AI made that" with confidence? If yes, rework.
2. Could someone guess the palette/layout from the business category name
   alone? If yes, it is the training-data reflex — rework.
A visitor should ask "how was this made?", not "which AI made this?" Restraint
without intent reads as mediocre — brand surfaces need a point of view, but
(per the Governing Override) never at the cost of two-second clarity.
