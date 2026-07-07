---
name: launch
description: >
  Deploys the Astro site to Cloudflare staging, verifies performance, analytics,
  schema, indexability, and runs the 20-point launch gate. Use when the site is
  built and content-filled, or "deploy / launch the site".
---

# Launch & 20-Point Gate

## Variables this skill needs (resolve from project-config.md)
DOMAIN, CLOUDFLARE_PROJECT, GA4_MEASUREMENT_ID, BUSINESS_NAME, GBP_URL,
PHONE, FULL_ADDRESS, SERVICE_AREAS/SILO_ITEMS.

## Steps
1. Build: npm run build (zero errors). Confirm sitemap generated, 404 noindexed.
2. Stage on Cloudflare: wrangler login; deploy ./dist
   (npx wrangler pages deploy ./dist --project-name $CLOUDFLARE_PROJECT),
   or wrangler deploy if SSR.
3. Performance: run PageSpeed Insights API + GTmetrix on key pages. Target
   fully loaded < 2.5s, LCP < 2.5s, CLS < 0.1, INP < 200ms. Fix before launch.
4. Convert any remaining PNG/JPEG to WebP. Verify alt tags present + descriptive.
5. Analytics: install GA4 ($GA4_MEASUREMENT_ID) via deferred gtag; track click +
   form-submit + whatsapp_click. Verify firing with Tag Assistant.
6. Schema: validate all JSON-LD (Rich Results test). Confirm values are real,
   no WORDS_TO_AVOID, prices match the page, geo present.
7. Indexability: confirm no important page has noindex; AI crawlers not blocked
   in Cloudflare/robots; robots.txt references the sitemap.
8. Submit every URL manually to Google Search Console + Bing Webmaster Tools.
9. GBP sync: services/items + areas on the site match the Google Business
   Profile exactly. NAP identical site-wide and matches GBP.
10. Mobile review (320/768/1440): CTAs, sticky bar, images render; no h-overflow.

## ◆ CHECKPOINT 4 — 20-POINT GATE (all must pass; nothing ships otherwise)
1. One page per silo item (no collapsing)        11. WebP only; descriptive alt
2. Hubs link to children; children link up       12. Fully loaded < 2.5s (both tools)
3. Item/area pages 40–50% unique ground truth    13. Human meta titles + descriptions w/ CTA
4. H1 = keyword + trust + city; CTA in 2 sec     14. No accidental noindex (GSC)
5. Trust signals above the fold                  15. AI crawlers not blocked
6. Contextual internal links (not footer dump)   16. llms.txt at root (optional)
7. Claims backed (numbers + external link)       17. Lighthouse agentic check (optional)
8. Author bio on pages + in schema               18. GA4 verified via Tag Assistant
9. Valid JSON-LD: LocalBusiness/Person/FAQ/      19. URLs submitted to GSC + Bing
   Breadcrumb/Service or Product                 20. Site items/areas == GBP exactly
10. Answer capsule: question -> direct answer
    in first 10–30%
Plus: both Slop Tests pass. No em dashes. No [VERIFY]/[NEEDS PROOF] left unresolved.
