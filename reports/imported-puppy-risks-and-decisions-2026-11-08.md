# Imported puppies: risk register and outstanding owner decisions (K-008)

**Date:** 2026-11-08 · **Updated:** 2026-11-13 (K-068: the owners' answers to the eleven T17 open points are recorded below and applied to the legal redline, copy deck and spec)

## Risk register

L = likelihood and I = impact, each rated H, M or L.

| # | Risk | L | I | Mitigation in spec | Residual / owner action |
|---|---|---|---|---|---|
| R1 | **Unit economics: the flat S$4,000 markup may not cover landed cost.** €X costs about S$1.5X (FX at roughly 1.5, to be verified). On top of that come the pet-agent flight from Dublin (likely S$2,000–4,500), vet and DAFM export certification, the AVS import licence and dog licence, the crate, home delivery and the starter kit ($500+). On a €1,000 puppy the margin over cost may be near zero or negative. | H | H | Price-band gate (sends anything over €4,000 to review). Pricing rule isolated in `price.mjs` | **Get two pet-relocation quotes for IE→SIN before go-live (T20).** Re-confirm the markup (D2b). |
| R2 | **Contract and copyright.** dfsi's T&Cs explicitly ban republishing or reproducing its material. Seller photos are copyrighted on every platform. Irish copyright law covers them, and so does Singapore's Copyright Act 2021 where we publish. | H | M | Facts only, no copied text (8-word phrase check). Images self-hosted, EXIF stripped. A permission request in the breeder-contact template. A 24-hour takedown path with `imports:unpublish --purge-images`, plus an audit trail | Owner has accepted the photo risk; it remains accepted. **Owner decision 2026-11-13 (Q9): publish now behind the takedown policy (redline Part C); the breeder-permission request stays in the contact template.** D3 is unchanged: **decide whether to include dfsi at all.** |
| R3 | **Supplier exposed through the photos.** A Google Lens or reverse-image search of any photo finds the Irish ad and its €-price. Hiding the supplier in our HTML doesn't stop this. Price-transparency and trust risk. | H | M | None technical (deliberately: altering photos to defeat detection would worsen R2). The copy says "all-in, delivered, with import handled", which justifies the gap | **Longer term:** ask the breeder for fresh, exclusive photos or video at the confirmation step |
| R4 | **Consumer protection (CPFTA): advertising puppies we don't own.** A listing can sell elsewhere hours after we publish it. That risks "representing goods as available when they are not". | H | H | Daily liveness check plus auto-unpublish. "Available for reservation" wording. **Availability confirmed with the breeder before any deposit is taken.** Written refund terms | **Legal review of the copy and terms (T17)** |
| R5 | **Arrival-date disputes.** DOB + 3 months is the earliest *possible* date (12-week export minimum plus paperwork), not a typical one | M | M | Month-only display on the website. "Estimated" plus "subject to import approval". Age-based estimate, DOB + about 3 months, given as a date in the reservation confirmation (D6, decided 2026-11-13; no minimum lead time). A 45-day late-cancellation right and a 90-day long-stop | Decided. With no minimum lead time, a puppy reserved close to 12 weeks old gets an estimate the paperwork may not meet; the buyer is covered by the 45-day and 90-day rights. B1 wording for a puppy already about 3 months old when reserved: kept as drafted, no maximum-wait promise (owner, 2026-11-13) |
| R6 | **Prohibited or restricted breeds slip through.** Irish ads include bully, XL, pocket-bully and Staffie crosses, and frequent German Shepherds (an AVS Specified breed) | M | H | G8 hard reject with an alias list. G9 sends Specified breeds to review. Rules transcribed from the AVS PDFs and dated | Re-check the AVS list quarterly (T3 adds a date check) |
| R7 | **Parser drift or a source change** (Next.js RSC shape, WordPress theme, API fields) | M | M | Per-adapter fixtures and tests. A "zero new items for 7 days" alert. Unparsed fields fail G1 and go to review | Watch the alerts |
| R8 | **Source blocking.** dogs.ie already blocks us. Others may add Cloudflare rules | M | M | Detect the block and stop. No bypass. Alert | Volume may drop; that's accepted |
| R9 | **Data-protection exposure (PDPA, GDPR) from storing Irish sellers' phones and emails** | M | M | Fields minimised, never logged, purged 90 days after unpublish, and kept outside the repo | — |
| R10 | **The existing AU feed uses the images.weserv.nl proxy to get past 403 hotlink blocks** (Gumtree, Pets4Homes) | — | M | The new pipeline forbids proxy fallbacks | **Review the AU feed under the same rules (T19).** |
| R11 | **AVS pet-shop licence conditions may require disclosing the source or breeder to the buyer** at sale | M | M | Disclosure belongs in the sale paperwork, not the website. **Owner decision 2026-11-13 (Q6): the breeder's identity is given in the reservation confirmation** | **Verify with AVS (T18)** that confirmation-stage disclosure is enough |
| R12 | **Volume mismatch.** Ireland barely supplies Westie, Sheltie and Samoyed, three of the six target breeds | H | M | The demand report flags it. The breed CTA stays on those pages | D9: a UK (Category A) or AU route for those breeds |
| R13 | **Thin or ephemeral pages in the index** | M | L | Detail pages `noindex`, excluded from the sitemap, 301 to the breed page on retire (D11) | — |
| R14 | **Leaks through build artifacts** (JSON, image filenames, EXIF, the JS bundle) | L | H | `check:import-leaks` on data, assets and `dist/` is a hard gate. Seeded-leak test | — |

## Owner decisions still outstanding

Each item shows a default. The build can go ahead on the defaults; only **D2b, D3 and D7 block go-live**.

| # | Decision | Options | Default in spec |
|---|---|---|---|
| **D1** | Show the origin country ("Imported from Ireland") publicly? | Yes (country only) / No (just "Imported") | **Yes (recommended)**: rabies-free means no quarantine, an honest origin builds trust, and the country isn't the supplier. The copy works either way. |
| **D2** | GBP listings (Northern Ireland on dogs.ie): "number as-is + 4,000" too, or review? | Treat £ like € / review / exclude | **Review** |
| **D2b** | **Confirm S$4,000 still works after landed-cost quotes (R1)** | Keep / raise / tiered by source price | Keep, pending quotes. **Blocks go-live.** |
| **D3** | **Include dogsforsaleireland.ie despite its explicit no-republish T&Cs?** | Include / exclude / lead-only (review queue, no auto-publish) | **Lead-only until the owner confirms.** It's the highest-volume source. **Blocks go-live for that source.** |
| D4 | puppies.ie (dogs.ie blocked): drop it, or keep as lead-only summaries in the review queue? | Drop / lead-only | **Lead-only** (no images; the owner sources photos with the breeder's permission) |
| D5 | First-run safety valve: everything goes through review for 14 days or the first 20 items per source | Keep / skip | **Keep** |
| D6 | Arrival lead time | — | **Decided 2026-11-13: age-based, no floor.** A puppy flies at about 3 months of age, so the estimate is calculated from its date of birth and given as an estimated date in the confirmation. The earlier 4-week floor is withdrawn. |
| **D7** | **Pet-relocation partner and SOP for IE→SIN** (agent, airline, who handles the vet and DAFM certificates) | — | None. **Blocks go-live** (no reservations can be fulfilled without it). |
| D8 | Admin fee if the buyer cancels before the breeder is paid | — | **Closed 2026-11-13: a fixed S$250** (redline A5.2). Counsel asked whether S$250 is defensible as a genuine pre-estimate. |
| D9 | Westie, Sheltie, Samoyed: add a UK source (also AVS Category A) or rely on the AU feed? | UK / AU / none | Out of K-008 scope; recommend a follow-up task |
| D10 | Alert channel for pipeline failures and review backlog | Email hello@ / WhatsApp / both | Email plus `logs/imports/ALERTS.md` |
| D11 | Index imported detail pages? | noindex / index | **noindex, follow** |
| D12 | One card per litter ad (with boy/girl counts) or one card per puppy? | Litter / per-puppy | **Litter** (simpler, matches the sources; the buyer picks the sex on WhatsApp) |
| D13 | Approve the 5-day promise wording for imports ("starts on the day your puppy arrives home") | — | As drafted in the copy deck, **extended 2026-11-13: nursing plus vet fees at our appointed vet** |
| D14 | Migrate the AU overseas feed onto the new imports system and its gates? | Yes / later | Later (T19, optional) |

## Owner decisions on the T17 open points (2026-11-13)

The owners answered all eleven open points from the legal redline on 2026-11-13, and two further points (12, 13) the same day. The decision column gives the owners' answers as relayed in task K-068. All are applied in `reports/imported-puppy-legal-redline-2026-11-11.md` (and its Word file), the copy deck and the spec. The terms still wait for counsel's sign-off (T17).

| # | Point | Owners' decision (2026-11-13) | Applied in |
|---|---|---|---|
| 1 | Registered company name | **Curious Tails Pte Ltd**: use in the header, A1 and everywhere the placeholder appeared | Redline cover and A1 |
| 2 | A5.3 cancellation | **Actual, receipted, unrecoverable costs only**, capped at what the buyer paid, with anything later recovered passed back | A5.3 (unchanged), copy deck §4 and §7 |
| 3 | D8 admin fee (A5.2) | **Fixed S$250** | A5.2, copy deck §4 and §7. D8 closed |
| 4 | Q9 breeder photos | **Publish now behind the takedown policy**; the breeder-permission request stays in the contact template | Q9, copy deck §6, R2. Photo risk remains accepted |
| 5 | Q6 source disclosure | **In the reservation confirmation**: the buyer learns the breeder's identity at that point, not before payment and not never | A2, copy deck §3 and §7, R11 |
| 6 | Q13 Australian reservations | **These terms cover them too**: adapt one clause rather than draft a second document | A1 scope (B2 made country-neutral to fit) |
| 7 | D6 lead time | **Age-based, not a fixed number of weeks**: a puppy flies at about 3 months of age, so the arrival estimate is calculated from its date of birth. Replace the flat "4 weeks" with that rule and an estimated date in the confirmation | B1, copy deck §3, §4 and §7, spec §4, R5. D6 decided |
| 8 | A7.2 5-day promise | **Nursing plus vet fees at our appointed vet** | A7.2, copy deck §3 and §7, D13 |
| 9 | A3 first dog licence | **Included** in the all-in price | A3, copy deck §3, §4 and §7 |
| 10 | B5 long-stop | **90 days** | B5 |
| 11 | Q14 GST | **Not registered**: no GST statement; do not add one | A3 note; Q14 closed; copy deck banned list |
| 12 | A10 boarding | **Free for 14 days, then charge.** Do not invent a rate: free boarding, with lodging and food covered, for the first 14 days after arrival; after that a daily boarding rate applies, and the buyer is told the rate in writing before reserving | A10 (bracket removed), new counsel question Q15, copy deck §3 |
| 13 | B1 older puppy | **Keep the drafted sentence as it stands.** No maximum-wait promise | B1 (unchanged), copy deck §4, spec §4, task T6 |

Still open: D2b, D3 and D7 (all block go-live), T18, and the terms line on the live Australian page (separate website task).
