## Workflow & Orchestration

**For the complete project workflow (stages, checkpoints, page creation pipeline):**  
See **[RUN-THE-PROJECT.md](RUN-THE-PROJECT.md)** — this is the master file that orchestrates the entire system.

Key points:
- 4 stages: Context → Research → Build → Per-page production
- 4 quality gates between stages (never skip)
- Per-page 8-step workflow including SEO Audit & Auto-Fix and pre-PR Internal Linking steps
- One source of truth: project-config.md

## Schema Markup

Before creating new pages, review [SCHEMA.md](SCHEMA.md) for comprehensive schema standards. All pages must include:
- WebPage schema with datePublished/dateModified
- BreadcrumbList for navigation
- LocalBusiness or Organization (with @id)
- Specialized schemas (Review, Service, Product, FAQ, DefinedTerm) as relevant
- Validation in Google Rich Results Test before merge

The schema library in `src/lib/schema.ts` provides reusable functions—don't invent schemas from scratch. See SCHEMA.md for examples on breed pages, guides, and informational content.

## SEO Optimization

### Content & Structure Audit
After page content is complete, run the SEO audit skill:

```bash
/seo-audit-and-fix /path/to/page "primary keyword"
```

The skill:
- ✅ Auto-fixes 6+ common issues (title, H1, schema, anchors, etc.)
- ⚠️ Reports 8-15 recommendations by priority
- 📊 Generates detailed audit report
- 🎯 Provides context-aware guidance per page type

**Timing:** Run after images and schema are added, before visual QA.  
**Output:** `[page-slug]-seo-audit.md` + auto-applied fixes  
**Result:** Typical score improvement: 58→88 (30-point gain)

### Performance & Security Audit (SEOmator)
After content passes the above audit, run a site-wide technical SEO check:

```bash
seomator audit https://curioustails.sg
```

SEOmator checks **251 audit rules across 20 categories**:
- Core Web Vitals (LCP, CLS, FCP, TTFB, INP)
- Security headers and HTTPS compliance
- Performance optimization
- Accessibility (ARIA, color contrast, heading hierarchy)
- Multi-page crawl for broken links and redirects
- Structured data validation

**Timing:** After content QA, before release.  
**Output:** Reports in `./seo-audit-reports/` (JSON, HTML, Markdown)  
**Frequency:** Run on major releases and quarterly for maintenance

See **[SEOMATOR-SETUP.md](SEOMATOR-SETUP.md)** for full configuration and integration details.

## Design

Before designing or restyling any page, section, or component, invoke the `premium-design-standard` skill (via the Skill tool) — it captures the concrete design-quality bar, motion/animation checklist, and section-separator patterns this site was built with. Don't rely on remembering it from earlier in a conversation; re-invoke it so the checklist is read fresh, since it gets updated as new lessons come up.

## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
