# Technical Audit: William Goh Pet Farm (2026-07-12)

**Domain:** wgpetfarm.com | **Platform:** WordPress + Divi Builder + Rank Math SEO, fronted by Cloudflare
**Pages crawled:** home, /puppies-for-sale/, /about/, /contact-us/, /faq/, /review/, /hdb-approved-breeds/, and 3 breed pages (Cavapoo, Corgi, Dachshund — the stated specialties), plus sitemap/robots checks and Lighthouse runs on 3 representative URLs.

---

## Health score: 46/100

Metadata and indexability are workable, but the two things that matter most for this
domain's stated hyperlocal strategy — LocalBusiness/NAP signals and structured data — are
close to absent, server response times are severe on every page tested (4.1–8.5s TTFB),
and there's a sitewide schema bug leaking a hosting platform's staging URL into every
page's structured data. None of this is catastrophic on its own, but stacked together it
caps how much the content and keyword work downstream can achieve.

---

## Critical issues

| Issue | Pages affected | Evidence | Fix |
|---|---|---|---|
| **No LocalBusiness schema anywhere on the site** | All pages (home, contact, about, every breed page) | JSON-LD on every crawled page only emits `Organization` (`name` + `url`, no address/phone/geo/hours) plus generic `WebPage`/`Article`/`BlogPosting`/`Person` nodes. No `LocalBusiness`, `PetStore`, or `Store` type exists anywhere. Confirmed by parsing the `rank-math-schema` JSON-LD block on all 10 pages crawled. | Add a `LocalBusiness` (or more specific `Store`/`PetStore`) node to the Organization graph with the confirmed GBP NAP: name "William Goh Pet Farm", address "Block L, 59 Sungei Tengah Rd, #01-19, Singapore 699014", phone "+65 9792 1567", `openingHoursSpecification` (Sun–Sat 10am–6pm), geo coordinates, and `sameAs` linking to the GBP listing. This is the single highest-leverage fix for a domain whose whole strategy is hyperlocal/local-pack. |
| **Sitewide NAP is effectively invisible** — full address + phone appear on exactly one page, nowhere else | Every page except /contact-us/ | Grepped for phone (9792 1567), postal code (699014), and "Sungei Tengah" across all 10 crawled pages: all four strings return **zero matches** everywhere except `/contact-us/`, where each appears exactly once, as plain text (`<h4>59 Sungei Tengah Road Block L #01-19 S699014</h4>`, `<h4>Call (97921567)</h4>`), not marked up in schema. The sitewide footer (`#main-footer` / `#footer-info`) contains only: Privacy Policy \| Terms & Condition \| William Goh Pet Farm © \| License no: AF23009 — no address, no phone, no hours. | Add address + phone (and ideally hours) to the global footer so every page carries NAP, not just Contact. This is standard local-SEO hygiene and currently entirely missing. |
| **No embedded Google Map anywhere, including on Contact** | /contact-us/ and site wide | Searched for `maps.google`, `google.com/maps`, and map iframes across all crawled pages, including Contact: zero matches. | Embed a Google Map (iframe or My Maps embed) on /contact-us/ pointing to the Sungei Tengah premises — standard trust/local signal for a viewing-by-appointment business, and currently absent. |
| **No FAQPage schema on /faq/, despite the content being a perfect match** | /faq/ | The page already has 15+ genuine, cleanly structured Divi accordion Q&As (`<h4 class="et_pb_toggle_title">What to expect in the first 48 hours?</h4>`, "When can I start socializing...", "How to brush puppy teeth?", etc.) but the only JSON-LD on the page is the generic Organization/WebPage/Article graph — no `FAQPage` type, no `Question`/`Answer` nodes. | Wrap the existing toggle content in `FAQPage` schema (Rank Math has a built-in FAQ block that emits this automatically — the content just needs to be moved into that block, or the JSON-LD added manually). This is a near-zero-content-cost win for FAQ rich snippets. |
| **Server response time is severe on every page tested** | Home, /puppies-for-sale/, /cavapoo-puppies-for-sale/ (representative sample) | DataForSEO Lighthouse `server-response-time`: Home 4,134ms · /puppies-for-sale/ 5,439ms · /cavapoo-puppies-for-sale/ 8,524ms. For reference, Google's own guidance is TTFB under ~600ms. These are multi-second **time-to-first-byte** numbers, before any rendering starts. | This is a server/hosting/caching problem, not a front-end one. Needs page caching (object cache + full-page cache) and likely a hosting/PHP review — Divi + many plugins on shared/under-provisioned WordPress hosting is the classic cause. |

---

## Important issues

| Issue | Pages affected | Evidence | Fix |
|---|---|---|---|
| Homepage has two separate `<h1>` elements | Home | `<h1>William Goh</h1>` immediately followed by `<h1>Pet farm</h1>` — a Divi text module splitting the H1 into two tags rather than one heading. | Combine into a single `<h1>William Goh Pet Farm</h1>` (or one clear keyworded H1) and demote the second element or merge the text. |
| /puppies-for-sale/ has a duplicate, empty second `<h1>` | /puppies-for-sale/ | `<h1><span>Find Your Perfect Puppy for Sale in Singapore at the Best Pet Shop</span></h1>` immediately followed by `<h1></h1>` (empty) — a Divi multi-view artifact for responsive breakpoints leaking into the desktop DOM. | Remove the stray empty `<h1></h1>`; keep one populated H1 per page. |
| Homepage and category-page meta descriptions have literal typos | Home, /faq/ | Home: `"Over 40 years of breeding exprience"` (missing "e" in "experience", and only 38 characters — well under the ~150-160 usable). FAQ: `"...e&#039;ve got answers to your puppy questions here"` — missing the leading "W" in "We've", both in the `<meta name="description">` tag and duplicated into the JSON-LD `description` field. | Rewrite both descriptions: fix the typos, extend to 140–155 characters, add a keyword + CTA (e.g. "visit by appointment," "William Goh Pet Farm"). |
| Generic, non-keyworded titles on core trust/conversion pages | Home, About, Contact, FAQ, Review | Titles are `"Home - William Goh Pet Farm"`, `"About - William Goh Pet Farm"`, `"Contact Us - William Goh Pet Farm"`, `"Review - William Goh Pet Farm"` — template defaults with no target keyword, no location term ("Singapore"/"Sungei Tengah"), no differentiator. Breed pages do better (e.g. `"Cute Corgi Puppies For Sale In SG (July 2026 Updated)"`) but use the abbreviation "SG" instead of "Singapore" and bake a rolling month/year into the title rather than the brand name. | Rewrite Home/About/Contact/FAQ titles with intent + location (e.g. "Puppy Breeder in Sungei Tengah, Singapore \| William Goh Pet Farm"). On breed pages, swap "SG" for "Singapore" and consider replacing the auto-updating "(July 2026 Updated)" suffix with the brand name for consistency and to avoid the title changing every month (which also churns the cached SERP snippet unnecessarily). |
| `Person`/author schema leaks a hosting platform's staging domain into every page | All 10 pages crawled | Every page's JSON-LD includes a `Person` node for "admin" with `"sameAs":["https://celestial-sanctuary-p4hasq.flywp.xyz"]` — this is a FlyWP hosting staging/migration URL, not a legitimate author or business profile. It's identical, sitewide. | Remove the stray `sameAs` value (or the generic "admin" author entity entirely) from the Rank Math author schema settings. Low effort, but a real structured-data hygiene issue that could confuse entity association for the business. |
| Breed/puppy pages are typed as `BlogPosting`/`Article`, not commerce-relevant types | Corgi, Cavapoo, Dachshund, HDB-approved-breeds, and (by pattern) all ~29 breed pages | JSON-LD `@type` for these pages is `BlogPosting` with `articleSection` ("Puppy For Sale" / "Guide") — appropriate for a blog post, not for a page whose actual job is to sell a physical puppy from a specific premises. | Consider layering `Product`/`Service`/`OfferCatalog` (with `availability`, `areaServed`, price range if the owner confirms pricing) alongside or instead of BlogPosting on the money pages, distinct from true blog content. |
| `www.wgpetfarm.com` fails outright (Cloudflare SSL error), doesn't redirect | www subdomain | `curl` to `https://www.wgpetfarm.com/` returns HTTP 525 (Cloudflare "SSL handshake failed") with zero redirects, instead of 301-redirecting to the canonical apex domain. `http://wgpetfarm.com/` does correctly redirect to `https://wgpetfarm.com/`. | Configure a redirect (or valid SSL + redirect) from www to the apex in Cloudflare, so any stray www backlinks/bookmarks/typed URLs don't hit a broken-connection error page. |
| Pinch-zoom is disabled on mobile | Sitewide (viewport meta is site-global) | `<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0" />` — `user-scalable=0` and `maximum-scale=1.0` block pinch-to-zoom, a WCAG 1.4.4 (Resize Text) failure and a real mobile usability problem, especially for older visitors researching a puppy purchase. | Remove `maximum-scale=1.0, user-scalable=0` from the viewport tag. |
| No opening-hours content anywhere on the crawled pages | Sitewide, including /contact-us/ | GBP lists "open Sun–Sat 10am–6pm," but no crawled page (including Contact) contains this text, and there's no `openingHoursSpecification` in schema. | Add opening hours as visible text on /contact-us/ (and ideally the footer) plus schema, once the LocalBusiness node is added. |
| "HDB Approved / Small Breeds / Large Breeds / Mixed Breeds" are menu labels only — not real landing pages | Sitewide nav (mega menu) | The main nav's mega-menu has top-level items `<a href="#">HDB Approved</a>`, `<a href="#">Small Breeds</a>`, `<a href="#">Large Breeds</a>`, `<a href="#">Mixed Breeds</a>` — all `href="#"`, non-navigating, existing only as dropdown group headers over individual breed links. There is no dedicated `/small-breed-puppies-for-sale/`-style category page for any of the four groupings named in the client brief (a `/hdb-approved-breeds/` blog post exists separately and is not the same thing as this menu item). | If ranking for "small breed puppies Singapore" / "HDB approved dog Singapore" etc. is a goal, these need to become real indexable category pages, not just menu scaffolding. Flagging here as an architecture gap; full keyword scoping is Keyword Research's call. |

---

## Minor issues

- No `BreadcrumbList` schema and no visible breadcrumb trail on any page checked (corgi, cavapoo, dachshund, hdb-approved-breeds) — a cheap win for both UX and rich-result eligibility on a site this deep.
- Page weight is heavy: total-byte-weight 2.6MB (home), 3.2MB (/puppies-for-sale/), 3.2MB (Cavapoo) per Lighthouse. Sitemap image entries are exclusively `.png`/`.jpg` — no WebP/AVIF anywhere, consistent with Lighthouse's "modern-image-formats" flag.
- Cumulative Layout Shift is poor on /puppies-for-sale/ (CLS 0.379 — "poor" by Core Web Vitals thresholds); Home and Cavapoo are borderline (0.14 / 0.195).
- Lighthouse accessibility scores are middling: Home 0.81, /puppies-for-sale/ 0.76, Cavapoo 0.73 — worth a full accessibility pass separately.
- A handful of broken/placeholder image URLs appear inside the XML sitemap's `<image:image><image:loc>` entries: literal `http://on|100%|100%|100%|100%` strings (a CSS/inline-style value leaking into an image URL field) on /contact-us/ and /cavapoo-puppies-for-sale/. Cosmetic in the sitemap, but worth cleaning at the source (likely a Divi background-image field being read as an image URL by the sitemap generator).
- Several page-sitemap `lastmod` dates are years stale relative to on-page content changes (About: 2021-07-05, Blog index: 2021-06-23) even though the site is actively maintained elsewhere (breed pages show 2025 lastmods) — low priority, but worth a sitemap regeneration check.
- `/pet-listings/` and `/insta/` are in the sitemap and linked from breed-page widgets, but not from primary nav or footer — thin, hard-to-discover pages; confirm they still serve a purpose.

---

## What's already good

- Robots.txt is clean and correctly points to `sitemap_index.xml`; no accidental blocking of crawlable content.
- Meta robots is `index, follow` on every page checked — no stray noindex tags found.
- Canonical tags are self-referencing and correct on every page checked, including breed pages.
- Money pages (all ~29 breed pages, /puppies-for-sale/, About, Contact, FAQ, Blog) are all reachable within a single click from the homepage via the header mega-menu — no orphaned core pages.
- The on-page NAP that *does* exist (address + phone on /contact-us/) is accurate and matches the confirmed GBP exactly — the problem is coverage/visibility, not correctness.
- Lighthouse "Best Practices" scores a clean 1.0 on all three pages tested, and SEO scores are solid (0.85–0.92) — the fundamentals Rank Math handles automatically (canonical, robots, structured metadata skeleton) are in place even where the content of that structured data is thin.

---

## Fix order

1. **Fix server response time** (4.1–8.5s TTFB) — page caching / hosting review. Nothing else matters if pages this slow aren't getting crawled or ranked efficiently; also blocks any Core Web Vitals gains from other fixes.
2. **Add LocalBusiness schema + sitewide NAP in the footer** — the core gap for this domain's hyperlocal strategy; unlocks local pack eligibility.
3. **Add a Google Map embed + opening hours to /contact-us/** — pairs directly with #2, cheap to do at the same time.
4. **Add FAQPage schema to /faq/** — content already exists, this is close to a copy-paste fix via Rank Math's FAQ block.
5. **Fix the two duplicate/empty H1 issues** (Home, /puppies-for-sale/) and the two meta-description typos (Home, FAQ) — quick, high-visibility copy fixes.
6. **Remove the FlyWP staging `sameAs` from the Person schema sitewide** — one Rank Math settings change, fixes every page at once.
7. **Fix the www subdomain SSL/redirect** — low traffic impact but a genuinely broken experience for anyone who hits it.
8. **Rewrite titles/descriptions for Home, About, Contact, FAQ, Review** and swap "SG" → "Singapore" on breed-page titles — feeds directly into the On-Page Copywriter's work, sequence after the structural fixes above so rewrites aren't wasted on pages that still have duplicate-H1 or missing-schema problems.
9. Everything in Minor (breadcrumbs, image formats/WebP, CLS, accessibility pass, sitemap cleanup) — polish once the above is live.

---

**Handoff:** On-Page Copywriter should prioritize title/meta rewrites for Home, About, Contact, and FAQ (generic templated titles, two literal typos in meta descriptions) and standardize breed-page titles to spell out "Singapore" instead of "SG." Client Report Builder should lead with two headline findings: (1) **no LocalBusiness schema and no sitewide NAP** — a direct contradiction of this domain's stated hyperlocal/local-pack strategy, and (2) **server response times of 4–8.5 seconds** on every page tested, which is a hosting-level problem, not a content one.
