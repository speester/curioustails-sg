# SEOmator Audit — Fix Summary (2026-07-07)

Audited locally (production build served via `astro preview`). Baseline was the dev server; final numbers are the production build after fixes.

## Score

| | Baseline | After fixes |
|---|---|---|
| Health score | 94/100 (A) | **95/100 (A)** |
| Passed | 196 | **205** |
| Warnings | 38 | 37 |
| **Errors** | **17** | **9** (all environment artifacts, see below) |

## Fixed in code

| Issue (audit rule) | Fix | File |
|---|---|---|
| Hero image `loading="lazy"` delaying LCP (perf-lazy-above-fold, perf-lcp-hints) | Hero now renders `loading="eager" fetchpriority="high"`; `PlaceholderImage` accepts loading/fetchpriority props | `src/components/Hero.astro`, `src/components/PlaceholderImage.astro` |
| No responsive images (images-responsive, images-size) | `PlaceholderImage` emits `srcset` (480/768/1024/1400w, capped at source width) + `sizes` | `src/components/PlaceholderImage.astro` |
| Missing `og:image` (social-og-image, social-og-image-size) | Site-wide default og:image (hero) + `og:image:width/height`, `og:site_name`, `og:locale`, `twitter:title/description/image` | `src/layouts/BaseLayout.astro` |
| Review schema missing `itemReviewed` (schema-review, schema-required-fields) | `reviewSchema()` now embeds the PetStore as `itemReviewed` | `src/lib/schema.ts` |
| Product schema missing `image` (schema-product) | Homepage `itemListSchema` passes breed portraits; URLs absolutized | `src/lib/schema.ts`, `src/pages/index.astro` |
| Homepage missing WebSite schema (schema-website-search) | New `websiteSchema()` (`#website` id, referenced by every page's WebPage `isPartOf`) added to homepage | `src/lib/schema.ts`, `src/pages/index.astro` |
| 1-item BreadcrumbList (schema-breadcrumb) | Removed pointless homepage breadcrumb schema | `src/pages/index.astro` |
| Title too long, 63 chars (core-title-length) | Now 56 chars: "Puppy for Sale Singapore \| AVS Licensed \| Curious Tails" (also removed inaccurate "Breeder") | `src/pages/index.astro` |
| Meta description truncation risk (content-description-pixel-width) | Trimmed to ~120 chars | `src/pages/index.astro` |
| Font below 12px (mobile-font-size) | Header mega-menu 11px labels → 12px (`text-xs`) | `src/components/Header.astro`, `src/components/PlaceholderImage.astro` |
| Horizontal scroll risk (mobile-horizontal-scroll) | `overflow-x: clip` on `html`/`body` (clip, not hidden, so sticky still works) | `src/styles/global.css` |
| Table a11y (a11y-table-headers) | `scope="col"` on header cells + `sr-only` `<caption>` per table | `src/components/ComparisonSplit.astro` |
| Touch targets (a11y-touch-targets) | Footer links given tap padding | `src/components/Footer.astro` |
| No privacy policy (eeat-privacy-policy) | New PDPA-oriented `/privacy-policy` page + footer link | `src/pages/privacy-policy.astro`, `src/components/Footer.astro` |
| llms.txt discoverability (geo-llms-txt) | `<link rel="alternate" type="text/plain" href="/llms.txt">` in head | `src/layouts/BaseLayout.astro` |
| E-E-A-T author signal (eeat-author-expertise) | `personSchema()` (Nelson & Kim `#owner` entity) added to homepage | `src/pages/index.astro` |
| Skip-link was inside `<head>` (invalid HTML) | Moved to first element of `<body>` | `src/layouts/BaseLayout.astro` |
| **Bonus bug:** LocalBusiness/Review schema image pointed at `/assets/home/…png` which 404s in production (images are hashed to `/_astro/`) | Schema lib imports the asset and uses its real built URL | `src/lib/schema.ts` |

## Remaining errors — all environment, none fixable in code

- **6 × Security (HTTPS, SSL, HSTS)** + `X-Frame-Options`, `X-Content-Type-Options`, CSP, Referrer-Policy, Permissions-Policy warnings → set at the **hosting layer** when deploying (Netlify `_headers` / Vercel `vercel.json` / Cloudflare rules). Do this at launch.
- **links-localhost (87)** + **core-canonical-http-mismatch** → artifacts of auditing `localhost`; relative links and the (correct) production canonical resolve differently. Will pass on `https://curioustails.sg`.
- **mobile-horizontal-scroll (28 elements)** → heuristic counts decorative blobs that extend past the viewport edge; actual scrolling is prevented by the new `overflow-x: clip`.

## Remaining warnings intentionally left

- Brotli/gzip/caching/HTTP2, Content-Type charset → server config, not static-build concerns.
- Sitemap "not accessible" → robots.txt points at the production URL; `sitemap-index.xml` builds and serves correctly (verified 200 on the preview build).
- WebSite SearchAction → site has no search feature; adding a fake one would be wrong.
- "puppy" keyword density, short headings, share buttons, second social profile, YMYL disclaimer, DOM size → editorial/design decisions.

## At deploy time

1. Add security headers at the host (HSTS, X-Frame-Options/frame-ancestors, nosniff, Referrer-Policy, CSP).
2. Re-run `seomator audit https://curioustails.sg` — the 9 environment errors should clear, putting the score into the high 90s.
