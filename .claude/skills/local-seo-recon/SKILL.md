---
name: local-seo-recon
description: A public-data-only first look at any local business — no client logins needed. Crawls the site, pulls Google Business Profile + ranked keywords + competitor authority (DataForSEO) + Lighthouse, then produces a client-facing HTML "health check", an internal brief, and a tailored set of onboarding discovery questions. Use before a sales call, for cold prospecting, or to prep a discovery session.
version: 0.1.0
requires:
  - DataForSEO credentials (DATAFORSEO_USERNAME / DATAFORSEO_PASSWORD env vars)
  - Python 3.10+ (pip install -r requirements.txt)
  - Chrome (claude-in-chrome) for first-fold screenshots — optional
  - NO Google Search Console or GA4 access. That is the whole point.
---

> New here? Read **README.md** for the idea and **SETUP.md** for the one credential you need.

# Local SEO Recon

The **pre-access** counterpart to the full audit. Everything here runs on public data, so you
can run it on a prospect you've never spoken to, or to prep a discovery call before the client
has granted any access. It is built to **not** error on missing Google access.

Produces, in `prospects/<slug>/` (or `--client clients/<name>` for a warm lead):
1. `recon.html` — **client-facing** "Local Search Health Check" (the door-opener / Loom companion).
2. `recon_brief.md` — **internal** brief: top opportunities, the hook line, build-vs-optimize verdict.
3. `questions.html` + `discovery_questions.md` — the **onboarding-call agenda**, generated from the findings.

## What it can and can't see
- **Can (public):** on-page SEO, site structure, location/service coverage, schema, NAP, page speed,
  Google Business Profile (categories, claim status, reviews count, photos, hours), the keywords the
  domain ranks for + position (DataForSEO estimate), competitor authority (referring domains, backlinks).
- **Can't (needs the paid audit):** real Search Console clicks/queries, long-tail terms tools miss,
  GA4 traffic + conversions, index coverage. The recon names these as the reason to buy the full audit.

## Workflow

1. **Crawl the site** (public HTML; find the sitemap via robots.txt)
   ```bash
   python scripts/crawl.py --urls <urls.json> --out recon/pages.json
   ```
2. **Analyze** structure, coverage, thin/duplicate, local checks, NAP
   ```bash
   python scripts/analyze.py --pages recon/pages.json --out recon/findings.json
   python scripts/schema_check.py --pages recon/pages.json --out recon/schema.json
   ```
3. **Google Business Profile** (DataForSEO — no GMB access needed)
   ```bash
   python scripts/gbp.py --name "<Business>" --location <code> --out recon/gbp.json
   ```
4. **Keywords + competitor authority** (DataForSEO). Emits the actual ranked-keyword list
   (`ranked_keywords`: total, page buckets, keywords[]) plus footprint, authority, competitors.
   ```bash
   python scripts/dfs_intel.py --domain <domain> --location <code> \
       --keywords "<intent kw 1>" "<intent kw 2>" --out recon/dfs.json
   ```
5. **Lighthouse** (mobile + desktop) on home + top service page
   ```bash
   python scripts/lighthouse.py --urls <home> <service> --out recon/lighthouse.json
   ```
6. **Coverage verdict** — build-vs-optimize. Runs public-only; without GSC it simply omits the
   demand-weighted suburb gaps (service cross-ref + NAP + verdict still work).
   ```bash
   python scripts/coverage.py --client <prospects/slug>
   ```
7. **First-fold (optional, vision):** claude-in-chrome screenshots of home + a service page at
   desktop 1280 and mobile 390; judge offer clarity, CTA, click-to-call.

8. **Synthesize (Claude).** Read the JSON in `recon/` and produce the four deliverables below.

## Deliverable A — `recon.html` (client-facing)
Fill `templates/recon.html.template`. Keep its `<style>` verbatim. Pick the **lead story from the
verdict**: 🟢/🟡 well-built → lead with the authority/reviews gap; 🔴 missing pages → lead with that.
Fill the vital chips, authority bar chart (one row per competitor), keyword distribution + table
(from `ranked_keywords`), and the findings cards (reviews / mobile gauges / GBP ring).
**Restraint rule: show the problem, never the fix plan.** Close with what the full audit adds. No booking button.

## Deliverable B — `recon_brief.md` (internal)
Top 3–5 opportunities, each tied to its data point. The build-vs-optimize verdict. One **hook line**
to open the call. A short "what I deliberately can't see yet" note. This is your prep, not the client's.

## Deliverable C — `questions.html` + `discovery_questions.md` (the onboarding agenda)
This is the recon → onboarding handoff. Generate questions in two buckets:

- **Gap-driven (Part 1):** one question group per finding that needs a *why*. Examples of the mapping:
  | Finding | Question |
  |---|---|
  | 0 reviews on a claimed profile | Are you asking for reviews? Any privacy reason clients don't? |
  | GBP category with no matching page | Active service you want to grow, or legacy? |
  | Ranks only on page 2+ | Which services actually make you the most money? |
  | Few referring domains / no booking link | Any directories/partners for links? How do you take bookings? |
- **Invisible-to-public (Part 2):** economics (what a client is worth, capacity), lead flow (where
  clients come from, is it tracked), goals & constraints (brand/compliance/tone rules), assets & people.
- **Access (Part 3):** GSC, GA4, GBP — collected *after* the call.

**The discipline that makes this work: never ask what the recon already found** (services, suburbs,
NAP, current rankings, GBP status, speed). Only ask the gaps. Fill `templates/questions.html.template`
(style verbatim); set each Part-1 `.trigger` chip to the finding that generated it.

## Handoff to onboarding
When the prospect becomes a client, move `prospects/<slug>/` → `clients/<name>/` and run the
`local-seo-onboarding` skill. It reads this recon's JSON to pre-fill `client.md`, then the Fathom call
answers the `discovery_questions.md` above. The full `local-seo-audit` runs once access is granted.

## Notes
- `dfs_intel.py` ranked keywords are a public third-party estimate, not Search Console truth. Say so
  in the report; it's what justifies the paid audit.
- Keep review counts honest: show the client's real number; never invent competitor review counts.
- Competitor domains: shown by name in the worked example. Anonymize to "Competitor A/B" if you'd
  rather not name them to a prospect.
