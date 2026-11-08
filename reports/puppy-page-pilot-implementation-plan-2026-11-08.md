# Individual puppy page redesign: pilot implementation plan

**Task:** K-002 · **Date:** 2026-11-08 · **Scope:** Curious Tails only (other puppy sites come later)
**Inputs:** `reports/puppy-page-template-spec-2026-11-08.md` (spec + audit) · `reports/puppy-page-competitor-research-2026-11-08.md` · `outputs/puppy-page-redesign-biscuit.html` (owner-review prototype)
**Gate:** the owner approves the prototype before any production work starts. Nothing in this plan has been executed. No file under `src/`, `config/` or `scripts/` was changed by K-002.

---

## 0. Decisions already made
- Full redesign of the individual puppy page (owner).
- WhatsApp-first. The existing per-puppy prefill, `data-wa-source`, cal.com `bookHref`, price/availability logic, placed-archive lifecycle and 301s are kept.
- Facts only from `config/business-context.md`, `config/project-config.md`, `src/data/site.ts`, the sync data and published breed pages. WORDS_TO_AVOID enforced.
- Business reviews stay on the PetStore node, never on the puppy Product.

## 1. Owner decisions needed before build (blocking)
1. **Approve the prototype** (`outputs/puppy-page-redesign-biscuit.html`: open it in a browser and use the toolbar for Available / Found a home / Notes).
2. **Owner quote** in About ("We'll talk you out of the wrong breed…"). Approve the wording, or the line ships as prose.
3. **Review count source of truth:** `site.ts` says 65 · 4.9, while `business-context.md` says 39 · 5.0 (June). Confirm, and update the config.
4. **Sheet columns (optional, can follow later):** add `ReadyDate-`, `AdultWeight-`, `Vacc1-…Vacc3-`, `Notes-`. Each section hides until filled.
5. **A real shop/owner photo** for the Visit block (no AI imagery on this route). Until one exists, the block ships without a photo.
6. **Documents-you-take-home list:** confirm the exact items before a checklist ships. Until then, only "vaccination and health records" (already claimed site-wide).

## 2. File-by-file changes

### 2.1 Sync (data in): `scripts/sync-puppies.mjs`
| Change | Detail |
|---|---|
| Keep `dob` | In `toJson()` add `dob: isoDate(parseGvizDate(cell(row,'DOB-')))` (null-safe). Keep `age` for back-compat. |
| Save up to 5 photos | For **available** pups, loop `p.images` (Image–Image5) → `savePhoto(p.id, n, url)`. Run `checkOverlaid()` on **each** extra image and drop any overlaid ("SOLD") frame. Write `images: string[]` and keep `image` = `images[0]`. Respect the existing verdict cache. |
| Optional new columns | `readyDate` (`ReadyDate-`), `adultWeight` (`AdultWeight-`), `vaccinations` (`Vacc1-`…`Vacc3-` → `{dose, date}[]`), `notes` (`Notes-`). All null when blank. |
| Summary | Add counts for `extraPhotos` and `extraPhotosDroppedOverlaid` to the sync summary line. |

`src/lib/puppy-cards.ts`: extend `Pup` with `dob?`, `images?`, `readyDate?`, `adultWeight?`, `vaccinations?`, `notes?` (all optional, null = not stated). Add `photosFor(p)` → `ImageMetadata[]` (falls back to `[photoFor(p.image)]`).

### 2.2 New data modules
| File | Contents | Source |
|---|---|---|
| `src/data/breed-facts.ts` | `breedFacts: Record<slug, BreedFacts>` (size, coat, exercise, company, children, hdb, lifespan, fitIf[], thinkTwiceIf[], guideHref, anchors). Start with maltipoo, cavapoo, cockapoo, mini-dachshund, corgi, shiba-inu, bichonpoo, plus any breed with a live pup. | Copied from each published `src/pages/puppies/{breed}.astro`. A new fact needs a source line in a comment. |
| `src/data/health-schedule.ts` | `[{week:6,…},{week:8,…},{week:9,home:true},{week:12,…},{week:16,optional:true},{yearly:true}]` + copy strings | `business-context.md` § Singapore Regulatory & Health Facts (verbatim) |
| `src/data/offers.ts` (existing) | Add `puppyIncludes` (6 items) if not already present | `business-context.md` Differentiation #2–#9 |

### 2.3 New helpers: `src/lib/puppy-page.ts`
`pronounsFor`, `article` (fixes the live "a apricot" bug), `pupH1`, `pupTitleTag` (≤60, brand dropped if longer), `pupMeta` (≤155), `waMessages(pup, breed, url)` (hero / sticky / video / book / final / placed), `passportRows`, `puppyFaq(pup, breedFacts, syncedAt)`, `productSchema(pup, photos, url)`, `faqSchema(items)`. All pure functions, so they are unit-testable with `node --test`.

### 2.4 New components: `src/components/puppy/`
`PuppyHero.astro`, `PuppyGallery.astro`, `PuppyPassport.astro`, `PuppyAbout.astro`, `PuppyHealthRecord.astro`, `PriceIncludes.astro`, `BreedFit.astro`, `NextSteps.astro` (wraps `StepFlow`), `VisitShop.astro`, `RecentlyHomed.astro` (uses `placedPups(breed)`), `PuppyStickyBar.astro` (generalises the unused `StickyMobileCTA.astro` with props). Props and fallbacks: spec §B3.

Gallery JS (dots, thumbs, counter) and the sticky observer go in one small inline `<script>` per component (≤ 8 KB total). Both must work without JS: stacked images, and a sticky bar that is always visible.

### 2.5 Layout: `src/layouts/BaseLayout.astro`
- Add an optional prop `hideWhatsAppFloat?: boolean` (default false) and wrap `<WhatsAppFloat />` with it. No other page changes behaviour.
- Add an optional `<slot name="head" />` if one isn't present, for the hero image preload.

### 2.6 Route: `src/pages/puppies/[breed]/[id].astro`
- Keep `getStaticPaths()` as-is (live + placed within retention, real photo required).
- Replace the template body with the 13-section order (spec §B2), composing the new components and the existing `ListingGrid`, `ReviewSlider`, `FAQ`, `FinalCta`, `Schema`.
- **Remove** from this route: the inline 6-card "Why choose" grid, `TestimonialWall`, `StarterKitMarquee` (the components stay; other pages use them).
- Title / meta / H1 from `puppy-page.ts`. `BaseLayout hideWhatsAppFloat`.
- Placed variant: same file, `sold` branch reorders sections (ListingGrid second) and suppresses Product, FAQPage, Passport rows except breed/gender/colour, Health, PriceIncludes, FAQ, RecentlyHomed.
- `others`: same breed first (today that ordering applies only when sold), max 6.
- Cap hero widths at the source width (`widths={[480, 800]}`); `fetchpriority="high"` + `loading="eager"` on photo 1 only.

### 2.7 Schema changes
| Node | Change |
|---|---|
| Product (available only) | `name` = H1 text; `image` = array of all gallery URLs; `additionalProperty` for Gender, Colour, Date of birth (when `dob`), HDB approved (when `true`); Offer unchanged (price, SGD, InStock, url, seller @id). No rating/review. |
| FAQPage (available only) | From `puppyFaq()`, the same array the visible FAQ renders |
| BreadcrumbList | Unchanged (Home → Puppies → {Breed} → {Name}) |
| VideoObject | Only when `video` is a real URL with a thumbnail |
| Placed | PetStore + Breadcrumb only (as today) |

Run `check:schema` / `check:schema:req` and fix any rule that rejects FAQPage on product pages (the rules may need an allowlist entry for `/puppies/*/*/`).

## 3. Build order (small commits, each one shippable)
1. `puppy-page.ts` + unit tests (title ≤60, meta ≤155, `article()`, FAQ hides on null). **No visual change.**
2. `breed-facts.ts` + `health-schedule.ts` (data only).
3. Sync changes (`dob`, `images[]`, optional columns) → run `npm run sync:puppies` → diff `available-puppies.json` (new fields only; nothing removed).
4. Components, one at a time, in a scratch route `src/pages/_lab/puppy-[id].astro` with `noindex` (delete before merge). Check against the prototype.
5. Swap the route body. `BaseLayout hideWhatsAppFloat`. Remove the three bands from this route.
6. Schema additions.
7. QA (§4), then a preview deploy, then production.

## 4. QA commands
```bash
npm run sync:puppies            # fresh feed; confirm a live pilot puppy exists
npm run build                   # must be green
npm run check:content           # banned words, claims
npm run check:schema            # rich-result rules on dist
npm run check:schema:req        # required props
npm run check:links             # internal links incl. new contextual links
npm run check:contrast          # tokens + pages
npm run check:keyboard          # tab order, focus, details/summary
npm run check:health            # page-health rules
npm run check:design            # design audit
npm run check:ga4               # whatsapp_click + wa_source still wired
npm run check:redirects         # expired-pup 301s unchanged
npm run check:loving-homes      # placed archive integrity
node scripts/design-eyes.mjs --probe-only --live <preview-url>/puppies/<breed>/<id>/
```
Plus:
- `grep -rliE "pedigree|\bDNA\b|malay" dist/puppies/` → no hits.
- Page count: `find dist/puppies -mindepth 3 -name index.html | wc -l` equals the count before the change.
- Playwright fold check at 390×844: H1, `.price` and the hero WhatsApp button `bottom ≤ 844`. Sticky bar visible after scrolling 1,200 px and hidden over FinalCta.
- `<img>` count on the pilot page ≤ 40 (today 134 on Biscuit, 8 large on Smokey).
- Lighthouse mobile on the preview: Perf ≥ 90, A11y ≥ 95, LCP ≤ 2.0 s, CLS ≤ 0.05.
- Google Rich Results Test on the preview URL: Product eligible, no errors.

## 5. Deploy and rollback
**Deploy** (project-config `DEPLOY_CMD`):
```bash
npm run build:deploy                       # sync + overseas + feed check + build
npm run deploy:preview                     # bash scripts/deploy-pages.sh --preview → check the preview URL
npx wrangler pages deploy dist --project-name=curioustails-sg --branch=main
```
After deploy: `curl -sIL https://curioustails.sg/puppies/<breed>/<id>/` → 200. Submit the pilot URL with `npm run indexnow`. Then GSC: inspect the URL with `inspect_url_enhanced` and hand the owner the **Request Indexing** link.

**Rollback** (any of these, fastest first):
1. Cloudflare Pages → Deployments → *Rollback to previous production deployment* (instant, no rebuild).
2. `git revert <merge-commit>` → `npm run build:deploy` → redeploy.
3. The work lands as one feature branch merged with `--no-ff`, so a single revert restores the old template. The sync changes are additive (new fields only), so the old template ignores them and needs no data rollback.

## 6. Data gaps (none block the pilot; each section hides cleanly)
| Gap | Effect until filled | Owner |
|---|---|---|
| Only `images[0]` synced | Single-photo gallery + "Ask for a video" slide | dev (sync change §2.1) |
| `video` empty for most pups | "Ask for a video" WhatsApp slide | shop (sheet `Video-`) |
| `dob` discarded | "About 2 months, as listed {date}" instead of the birth date | dev (§2.1) |
| No ready date / adult weight / vaccination dates / staff notes | Generic going-home rule, breed size range, generic schedule, breed-level About | shop (new columns, optional) |
| No parents/siblings data | Section never renders. No parent claims anywhere | owner decision |
| Breed facts only inside breed pages | BreedFit hides for breeds not yet extracted | dev (§2.2) |
| Deposit amount not in config | Not mentioned anywhere | owner (if wanted) |
| No real shop/owner photo | Visit block without a photo | owner |
| Source photos are 800 px and soft | Hero capped at 800w; looks soft on retina | shop (upload larger originals to the sheet) |

## 7. What must be validated on the pilot before rollout
Biscuit (2938) **was placed in November 2026**, so her URL now validates only the **placed** variant. Pick the live Maltipoo at implementation time (Smokey, `maltipoo/2950-red-boy`, at time of writing) as the **available** pilot. Validate both:

- [ ] Prototype approved by the owner (§1.1). Production matches it at 390, 768 and 1440 px.
- [ ] **Available pilot:** all acceptance checks in spec §B9 pass. Fold rule met. The sticky bar works and carries the ID.
- [ ] **Placed (Biscuit):** no price, no Product/FAQPage, cross-sell second, "a apricot" fixed in the meta description, similar-puppy prefill.
- [ ] **Minimal-data pup:** a pup with no name, no age and one photo renders with no empty rows and no "null" (check one in `dist/`).
- [ ] **Cross-label pup** (e.g. a Malshi on the maltese route): H1/title use the cross label, never the pure breed. BreedFit uses the base breed facts with the cross named in the copy, or hides if the owner prefers.
- [ ] **GA4:** `whatsapp_click` events arrive with `wa_source = pup:{id}`, `pup:{id}:sticky`, `pup-video:{id}`. Check after 48 h in property 530833097.
- [ ] **Measure for 2–4 weeks before rolling out** to every breed or sister site: WhatsApp clicks per puppy-page session (GA4), the sticky-bar share of clicks, and GSC impressions/clicks for individual puppy URLs (long-tail such as "apricot maltipoo"). Baseline = the 4 weeks before deploy.
- [ ] Owner sign-off, then rollout. Every live puppy page uses this template from the same deploy (it is one route). The later phase ports the components to the sister puppy sites.

## 8. Definition of done
The route renders the 13-section template for every live and placed puppy. Every check in spec §B9 and §4 here passes. The preview has been reviewed by the owner. Production is deployed, the pilot URL is submitted (IndexNow + GSC link handed over), and `.claude/state/hq.json` `blocked_on` lists only the owner items still open from §1.
