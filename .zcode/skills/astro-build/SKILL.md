---
name: astro-build
description: >
  Scaffolds and builds the local-business site with Astro + Tailwind + Cloudflare.
  Translates design-system.md into Tailwind tokens, builds the component library,
  sets up hand-built `.astro` page routing under src/pages/ from the blueprint
  (no content collections/MDX in this project), then builds TWO sample pages
  (one Core/money page, one Outer/blog page) and STOPS at Checkpoint 3 for review
  before building the rest. Triggers when the user asks to "build the site",
  "scaffold Astro", or starts Stage 2. Reads design-system.md, config/business-context.md,
  and site-blueprint.csv.
---

# Astro Build — Scaffold, Tokens, Components, Sample Pages

## ROLE
You are a senior front-end engineer building a fast, schema-complete,
conversion-focused local site. You implement the reconciled design system
faithfully and stop for human review before scaling.

---

## VARIABLES (from `config/project-config.md`)
REQUIRED:
- BUSINESS_NAME, BUSINESS_TYPE, DOMAIN
- PRIMARY_CITY, FULL_ADDRESS, PHONE, WHATSAPP, EMAIL
- BUSINESS_HOURS, GOOGLE_MAPS_EMBED
- CLOUDFLARE_PROJECT
- GA4_MEASUREMENT_ID
- BRAND_VOICE_WORDS
- ALLOW_STICKY_MOBILE_CTA   # default: yes

Files read:
- `.claude/commands/shared/design-system.md`   (the taste rulebook — obey it)
- `config/business-context.md`                       (real facts, voice, proof)
- `research/site-blueprint.csv`               (pages, tiers, hub_or_node, section_class)
- `research/research.json`                    (schema/foundation references)

Writes: the Astro project under `src/`, configs, and components.

---

## LOCKED DECISIONS (do not deviate)
- Stack: Astro + Tailwind + Cloudflare. Static output by default; add the
  Cloudflare adapter for SSR only if a page genuinely needs it.
- No client UI frameworks (no React/Vue/Svelte islands unless unavoidable).
- No WordPress. No single-file HTML generator.
- JS only in tiny inline/`<script>` islands for: mobile menu, tabs, FAQ accordion,
  carousel state, and WhatsApp/CTA click tracking. No inline event handlers.
- Page content: breed/hub/money pages are hand-composed `.astro` files under
  `src/pages/` (the established pattern — see `src/pages/puppies/cavapoo.astro`).
  This project does NOT use `src/content/` collections/MDX; do not introduce them.
  Copy is authored into each page by content-writer against its brief.
- All design tokens come from design-system.md — no ad-hoc colours/shadows/fonts.

---

## STEP 0 — Plan
Read design-system.md and the blueprint. Produce a short internal plan:
- The OKLCH palette, type scale, spacing scale, shadow tiers, motion curves.
- The component list you will build.
- The collections + routes implied by the blueprint (use hub_or_node to decide
  hub vs leaf templates; use section_class to decide Core high-design vs Outer
  lighter treatment).
- The schema types each page tier needs.

---

## STEP 1 — Scaffold
- `npm create astro@latest` (minimal/empty, TypeScript strict).
- Add integrations: Tailwind, @astrojs/sitemap, @astrojs/mdx.
- Tailwind: if v4 is installed use `@tailwindcss/vite`; if v3, use
  `@astrojs/tailwind`. Detect the installed version and configure accordingly —
  do not assume.
- Add @astrojs/cloudflare adapter ONLY if SSR is needed; otherwise static.
- Configure `astro.config.mjs`: set `site` to DOMAIN, register integrations,
  `output: 'static'` (or 'server'/'hybrid' if SSR needed).
- Add Sharp for image processing.

---

## STEP 2 — Design tokens (from design-system.md)
Implement in Tailwind config + a small global CSS layer:
- COLOUR: OKLCH palette (restrained: tinted neutrals + ONE accent), 60-30-10.
  No pure #000/#fff. Tint neutrals toward brand hue (chroma 0.005–0.015).
- TYPOGRAPHY: pick fonts per BRAND_VOICE_WORDS; reject any on the reflex-reject
  list (Inter, DM Sans, Poppins, Montserrat, etc.). Body 65–75ch, ≥16px, modular
  5-size scale (ratio ≥1.25), fluid clamp headings, font-display: swap, preload
  the critical weight, variable fonts when 3+ weights.
- SPACING: 4pt scale; prefer gap over margin.
- SHADOWS: disable Tailwind default shadows; define 3 tinted tiers (sm/md/lg) via
  `color-mix(in oklch, var(--accent), transparent N%)`. No rgba(0,0,0).
- MOTION: animate only transform/opacity, ease-out-quart, entrances 500–800ms,
  stagger ≤500ms, honour prefers-reduced-motion.
- Z-INDEX tokens (base/dropdown/sticky/overlay/toast).
- Double-bezel utility for depth without heavy shadow.

---

## STEP 3 — Component library (`src/components/`)
Build accessible, Tailwind-styled `.astro` components. Each enforces the design
system and the bans (no gradient text, glassmorphism, side-stripe borders,
hero-metric template, modal-first, 100vh, neon shadows, emoji, icon fonts):

- BaseLayout.astro      (head, meta, preloads, skip-link, GA4, global CSS)
- Header.astro          (semantic nav, mobile menu via data-* state)
- Footer.astro          (NAP, hours, links)
- StickyMobileCTA.astro (one unobtrusive call/WhatsApp bar; render only if
                         ALLOW_STICKY_MOBILE_CTA = yes; mobile only)
- Hero.astro            (what/who/benefit/trust/CTA above fold; highest-impact image)
- DefBox.astro          (entity definition box, first 30% of page)
- StatStrip.astro       (verified proof numbers; no fabricated stats)
- FAQ.astro             (accordion, injects FAQPage JSON-LD)
- ListingGrid.astro     (the ONLY sanctioned card grid:
                         repeat(auto-fit, minmax(280px,1fr)); each card a single <a>)
- CaptionedBlock.astro
- ComparisonSplit.astro
- BannerRibbon.astro
- Tabs.astro            (roving tabindex, tiny inline script)
- Carousel.astro        (scroll-snap, reduced-motion safe)
- Breadcrumb.astro      (injects BreadcrumbList JSON-LD)
- Schema.astro          (renders JSON-LD from a typed prop; LocalBusiness, WebPage,
                         Product/Service/ItemList, Person, Speakable, FAQPage,
                         BreadcrumbList)
- Image.astro           (wraps Astro <Image>: WebP, srcset, explicit width/height
                         for CLS, alt required, hero eager+preload, rest lazy)

Accessibility everywhere: visible labels, aria where needed, 44px tap targets,
focus-visible rings, safe-area insets, WCAG AA contrast.

---

## STEP 4 — Routing (`src/pages/`, hand-built `.astro` — NOT content collections)
- Pages are hand-composed `.astro` files under `src/pages/`, one per blueprint row.
  There is no `src/content/` collection and no `[collection]/[slug]` dynamic route in
  this project; do not add them. Each page sets its own head/meta (title, h1,
  target_keyword, secondary_keyword, description, author, date, hero image, OG) in
  frontmatter, following the `src/pages/puppies/cavapoo.astro` pattern.
- Routes from the blueprint:
  - `/` home (PRIMARY_KEYWORD + PRIMARY_CITY)  → `src/pages/index.astro`
  - hub pages (hub_or_node = L2)               → `src/pages/<slug>.astro`
  - breed/leaf pages (hub_or_node = L3)        → `src/pages/puppies/<slug>.astro`
  - blog                                       → `src/pages/blog/<slug>.astro`
  - `/contact`, 404 (noindex)
- Use section_class: Core pages get the full high-design template; Outer pages get
  the lighter article template.
- There is no shared BreedPageLayout: start each new breed page by copying the
  section structure of `cavapoo.astro`, then swap in the briefed copy. Because the
  structure is duplicated by hand, cross-check the sibling breed page(s) whenever you
  change one (see the BUG CHECKLIST reference in the SELF-CHECK below).
- Internal contextual links wired from the blueprint parent/child relationships —
  but only to routes that already exist (see BUG CHECKLIST #1).

---

## STEP 5 — Build TWO sample pages
Pick one Core/money page (e.g. a top SILO_ITEM) and one Outer/blog page.
Fill with realistic placeholder copy drawn from config/business-context.md (clearly
marked as placeholder where real content will come from content-writer). Include:
correct schema, hero, def box, proof, FAQ, internal links, WebP images with alt
+ dimensions. Run `npm run build` — it MUST complete with zero errors. Run both
Slop Tests from design-system.md.

**Placeholder means placeholder.** This step's copy exists to prove the
component/schema/layout work — it is explicitly NOT the page's final content
and must never be presented to the user as a finished page. If a user asks to
see a fully "complete" or "done" page (not just a sample for Checkpoint 3
review), that page's copy must come from content-writer/blog-writer against a
real brief, not from this step. Do not blur this line under time pressure —
see local-seo-orchestrator's Definition of Done checklist before calling any
page finished.

---

## SELF-CHECK
- [ ] Tailwind version detected and configured correctly.
- [ ] Tokens match design-system.md (OKLCH palette, type, spacing, tinted shadows).
- [ ] No reflex-reject fonts; body width 65–75ch.
- [ ] Header/Footer with consistent NAP.
- [ ] Cards used ONLY for genuine listings; no icon-heading-text card spam.
- [ ] Sticky mobile CTA present only if enabled; mobile only.
- [ ] Schema.astro emits valid JSON-LD per page tier.
- [ ] All images WebP with alt + width/height; hero eager+preload, rest lazy.
- [ ] No banned design patterns present.
- [ ] `npm run build` succeeds with zero errors.
- [ ] Sitemap generated; 404 is noindex.
- [ ] Both Slop Tests pass.
- [ ] hub_or_node and section_class from the CSV drive the templates.
- [ ] **Every built page passes the PAGE-BUILD BUG CHECKLIST** in
      .claude/docs/RUN-THE-PROJECT.md (no links to unbuilt routes; every
      `CaptionedBlock imagePosition="none"` has a `slot="side"`; `CloudDivider`
      `fillClass`/`againstColor` match the real neighbouring backgrounds; SG
      vaccination/licensing facts exact per config/business-context.md; stacked
      `BannerRibbon` CTAs use distinct variants; `#available` has a `ListingGrid`
      showcase; sibling breed page cross-checked).

---

## CHECKPOINT 3 — STOP for human review
Do not build the remaining pages. Output:

> **Checkpoint 3 — Scaffold + 2 sample pages built. Please review before I scale.**
> - Local preview command + the two page paths
> - Which Core page and which Outer page I built
> - Confirmation the build passed and Slop Tests passed
> - Anything I flagged as placeholder awaiting content-writer
>
> Reply **approve** to generate the remaining pages, or tell me what to fix.

Only after approval do you replicate the templates across the full blueprint.
