# Local SEO: William Goh Pet Farm (2026-07-12)

> NEEDS DATA: GBP is **not connected in Windsor.ai** — no MCP tool named `windsor` is available in this environment and no `WINDSOR_API_KEY` is set, so live review text, reply status, and 90-day Insights (calls, direction requests, website clicks, search-vs-maps split) cannot be pulled. Section 3 (review reply queue) is therefore degraded to public-data-only. Sections 2, 3 (profile checklist), and 4 (citations) do not depend on Windsor and are complete below, built from DataForSEO's live `business_data_business_listings_search` pull (2026-07-13) plus the confirmed facts in `context/client.md`.

## GBP health

**Score: 72/100 (B-) — claimed profile with strong fundamentals, undermined by the website not reinforcing it.**

Confirmed live (DataForSEO, 2026-07-13, CID 5450848063845279953): claimed ✅, 4.5★/64 reviews, 5 categories, 27 photos, hours set, website linked, AVS-license-backed description already live on the listing.

**Top 3 gaps:**
1. **The website doesn't reinforce the GBP listing.** Zero `LocalBusiness` schema anywhere on wgpetfarm.com, and the NAP (name/address/phone) appears as plain text on exactly one page (`/contact-us/`) — nowhere else, not even the footer. No embedded map. (Confirmed by the Technical Auditor's crawl — see `02-technical-audit.md`.) This is the single biggest lever: Google has almost nothing on the website itself to corroborate the GBP's location signals, which likely explains why the domain's own address term ("sungei tengah," 720 vol) ranks only position 44.
2. **Absent from the local pack on the two highest-intent searches.** wgpetfarm.com holds an uncontested #2 in the "pet farm singapore" pack, but shows 0/3 in both "dog breeder singapore" (260 vol, Pretty Pets Kennel #1) and "puppy for sale singapore" (1,000 vol, The Lovely Pets #1). Category weighting, photo velocity, and review velocity relative to those two competitors are the likely levers (see Profile fixes below).
3. **Posting cadence and review-response rate are both unknown**, and can't be checked without Windsor or dashboard access. The public rating distribution shows 8 of 64 reviews (12.5%) at 3-star or below — worth prioritizing replies to these once Windsor/dashboard access is available, since negative reviews with no visible owner response are a trust signal AI Overviews and searchers both weigh.

**Additional finding — brand-confusion risk (not fixable via wgpetfarm's own GBP, but worth flagging to the client):** Google's "people also search" for wgpetfarm.com surfaces **"William Goh Kennel"** (3.2★/45 reviews, 23 Seletar West Farmway 1 — a different address entirely, in Sengkang/Seletar, not Sungei Tengah). Similar name, much lower rating, unrelated address. Worth the owner clarifying whether this is a legacy/family-linked listing — if so, and if it's genuinely inactive or mismanaged, it's worth requesting Google update or clearly differentiate it, since a searcher who lands on the wrong 3.2★ listing by name-confusion is a lost booking.

## Insights snapshot

> NEEDS DATA: 90-day Insights (search vs. maps views, direction requests, calls, website clicks, photo views) require Windsor.ai's `google_my_business` connector, which is not accessible this run. Owner should confirm Windsor connection status, then re-run this section.

What public data does show:
- **Rating distribution** (64 reviews): 55 five-star, 1 four-star, 1 three-star, 2 two-star, 5 one-star. 55/64 (86%) five-star is a genuinely strong base; the 8 reviews at 3-star-or-below are the ones to prioritize for reply once review text is accessible.
- **Review topics Google has extracted from customer text** (`place_topics`, proxy for what customers actually mention): "helpful staff" (25 mentions), "cavapoo" (6), "friendly owner" (5), "puppy purchasing experience" (5), "dachshunds" (4), "cute puppies" (4), "informative staff" (4), "dog adoption" (4), "free gifts" (3), "sincere seller" (3). This is a useful cross-check against the GEO audit's finding that Corgi/Cavapoo/Dachshund have zero AI Overview citations for wgpetfarm.com — customers are already organically talking about Cavapoo and Dachshund in reviews, so the content and citation gap is not a demand gap.
- **Local pack surface**: confirmed live #2 of 3 for "pet farm singapore" (behind The Sundowner Nature Experience Centre, ahead of Hay Dairies Goat Farm), 0/3 for "dog breeder singapore" and "puppy for sale singapore" (per `01-keyword-map.md`). This strongly suggests the **Maps/local-pack surface is currently the main driver for farm-visit and "pet farm" browse intent**, while the higher-purchase-intent "puppy for sale" and "dog breeder" searchers are mostly reaching the site via organic/other channels, if at all — the pack losses there are pure missed opportunity, not replaced by another surface.

## Review reply queue

> Windsor.ai is not connected — individual review text and existing reply status cannot be pulled, so no replies are drafted this run.

What's known from public data: 64 total reviews, 4.5★ average, 8 at 3-star-or-below (5×1★, 2×2★, 1×3★) with reply status unknown. **Action needed from the owner:** confirm Windsor.ai connection (or grant direct GBP dashboard access) so the Local SEO Manager can pull actual review text and draft on-brand replies — positive reviews thanked specifically, negative reviews acknowledged and taken offline, never argued with. Once connected, prioritize the 8 sub-4-star reviews first since they're the highest-value trust-signal fix available.

## GBP post drafts

Four posts for the coming month, each under 1,500 characters, built from the keyword map's local modifiers and this domain's real, confirmed assets. No post states a specific years-in-business number — the "40 years / 50 years / since the 1960s / since 2020" conflict flagged in `client.md` and `04-geo-audit.md` is unresolved, so all four posts are written around it.

---

**Post 1 — "Pet Farm Singapore" local-pack win**
*(434 characters)*

> Did you know William Goh Pet Farm is one of the top-rated pet farms in Singapore? Tucked into the Sungei Tengah farming belt, we're a real, working pet farm you can visit — not just a shopfront. Come meet our puppies in person, see how they're raised, and ask our team anything before you bring one home.
>
> AVS-licensed (AF23009) and rated 4.5 stars by real customers who've visited. Book your appointment and come see us for yourself.

CTA: **Learn more** → `https://wgpetfarm.com/contact-us/`
*(Once the keyword map's proposed dedicated `/visit-us/` page ships, switch this post's CTA to point there instead.)*

---

**Post 2 — The visit-the-farm experience**
*(396 characters)*

> What's it actually like to visit William Goh Pet Farm? Book an appointment, come to Block L, 59 Sungei Tengah Rd, and spend real time with the litter before you decide — no rushed showroom visit. Every puppy goes home with vet health checks, microchipping, deworming and vaccinations already done, plus a full starter kit.
>
> Open daily, 10am–6pm. Appointments only — reserve your visit slot today.

CTA: **Book** → `https://wgpetfarm.com/contact-us/`

---

**Post 3 — Breed specialties round-up (Corgi, Cavapoo, Dachshund)**
*(366 characters)*

> Looking for a specific breed? William Goh Pet Farm specializes in Corgi, Cavapoo, and Dachshund puppies, alongside 25+ other breeds across our HDB-Approved, Small, Large, and Mixed Breed categories. Every puppy is AVS health-checked, microchipped, and vaccinated before it goes home with you.
>
> Browse our full breed line-up and message us about current availability.

CTA: **View puppies** → `https://wgpetfarm.com/puppies-for-sale/`

---

**Post 4 — Cavapoo spotlight**
*(342 characters)*

> Cavapoo puppies are one of our most-loved breeds at William Goh Pet Farm — gentle, sociable, and a great fit for Singapore homes. Our Cavapoo litters are raised on-site in Sungei Tengah, health-screened, and ready to meet by appointment.
>
> Ask us about current availability, coat colours, and what's included in our starter kit for new owners.

CTA: **Learn more** → `https://wgpetfarm.com/cavapoo-puppy-for-sale/`

*(Cavapoo was chosen for the standalone breed spotlight over Corgi/Dachshund because the keyword map identifies it as the cleanest open competitive gap — both named competitors rank weakly, pos 24–68 — while Corgi and Dachshund are more heavily contested by thelovelypets.com; Post 3 still covers all three.)*

---

## Profile fixes

Checklist in fix order:

1. **Add `LocalBusiness` schema to the website**, pulling the confirmed GBP NAP exactly (name, address, phone, hours, geo) — currently zero structured data reinforces the listing. (Cross-referenced with `02-technical-audit.md`, priority #2 there.)
2. **Add NAP + hours to the sitewide footer**, not just `/contact-us/`. Currently the only page on the entire site carrying the address/phone is Contact, as plain unmarked-up text.
3. **Embed a Google Map on `/contact-us/`** pointing to Block L, 59 Sungei Tengah Rd — currently absent sitewide, and a standard trust signal for a viewing-by-appointment business.
4. **Verify the GBP's listed website URL is set to `https://wgpetfarm.com/`.** DataForSEO's pull returned it as `http://wgpetfarm.com/` — check the GBP dashboard directly and update to https if that's genuinely what's set, for consistency with the site's actual protocol.
5. **Add "Dog trainer" as an additional GBP category** (or the closest available Google category match). Training/obedience is a confirmed, actively-offered service (client.md item 3, and listed in the GBP's own `services` array — "Obedience Training," "Dog Training") but isn't reflected in the current 5-category set (Dog breeder / Pet adoption service / Pet food and animal feeds / Pet groomer / Pet Shop). A missing category is free ranking surface being left on the table.
6. **Increase photo volume, specifically for Corgi, Cavapoo, and Dachshund litters.** 27 photos is workable but modest next to Pretty Pets Kennel's 355-review profile (implying a much longer-established, more active listing). Since customers already organically mention Cavapoo and Dachshund in reviews (`place_topics` data above) and the GEO audit found zero AI Overview citations for these three specialty breeds, fresh, well-captioned photos of exactly these breeds is a direct, low-cost lever on both fronts.
7. **Confirm and, if inactive, restart a regular GBP posting cadence.** Unknown/unverified from public data — worth a manual dashboard check. The four drafts above are a ready-made starting month.
8. **Report the "William Goh Kennel" brand-confusion listing to the owner** (see GBP health section) — not a fix Nelson can make on wgpetfarm's own profile, but worth a conversation about whether that listing is related and, if so, whether to request Google differentiate or update it.

## Citations plan

Ranked by value. All entries should use the **canonical NAP block** below — do not substitute the WhatsApp number (+65 8806 6180) into any citation's phone field; that number stays a website-only CTA channel per `client.md`.

**Canonical NAP block (paste as-is into every listing):**
```
Name:    William Goh Pet Farm
Address: Block L, 59 Sungei Tengah Rd, #01-19, Singapore 699014
Phone:   +65 9792 1567
Website: https://wgpetfarm.com/
Hours:   Sun–Sat, 10:00 am – 6:00 pm
Category: Dog Breeder / Pet Shop
License: AVS AF23009
```

| # | Directory | Type | Why it's worth doing |
|---|---|---|---|
| 1 | AVS/NParks licensed pet businesses public registry | Pet/animal-specific, government | Highest trust-value citation available — directly ties to the AVS License AF23009 already confirmed on-site, and the keyword map flags "how to find a reputable pet breeder" as a live E-E-A-T opportunity that references exactly this registry |
| 2 | Facebook Business Page | General, social | Near-universal citation source and a review channel in its own right; confirm whether one already exists before creating a duplicate |
| 3 | Instagram Business Profile | General, social/visual | High-fit for a physical, visitable pet farm — photo/video content doubles as GBP photo-refresh material (see Profile fix #6) |
| 4 | Bing Places for Business | General, search-engine parity | Free, direct NAP parity with a second major search engine; low effort |
| 5 | Apple Business Connect (Apple Maps) | General, search-engine parity | Increasingly relevant for Singapore's high iPhone penetration; controls how the farm appears in Apple Maps/Siri results |
| 6 | Yellow Pages Singapore (yellowpages.com.sg) | General, high-authority SG directory | Long-established, high-DA local directory; standard local-SEO baseline citation |
| 7 | Streetdirectory.com | General, SG-specific with map integration | Singapore-specific directory with strong map/location data — reinforces the physical-premises angle |
| 8 | Yelp Singapore | General, reviews | Secondary review surface; low effort, broad reach |
| 9 | Foursquare / Swarm | General, data aggregator | Foursquare's location data feeds into other apps and services beyond its own platform — worth the one-time setup for downstream reach |
| 10 | SGPets.com (or equivalent SG pet-owner community/directory) | Pet-specific, community | Niche but highly relevant audience — pet-owner community directories carry topical trust weight for a breeder listing |
| 11 | A Singapore pet-industry vertical directory (e.g. a pets-magazine.com.sg style listing, confirm current active one) | Pet-specific, industry | Topical relevance; verify which pet-industry directories are currently active in SG before submitting, as these come and go |
| 12 | Locanto Singapore or Superpages SG | General, lower-authority | Lower individual value but cheap breadth; skip if time-constrained |
| 13 | Local/hyperlocal: Choa Chu Kang / Lim Chu Kang / Sungei Tengah community pages or farming-cluster association listing, if one exists | Local, hyperlocal | Directly reinforces the "sungei tengah dog farm" / "sungei tengah pet farm" terms the keyword map flags as the domain's strongest, most defensible cluster |

**NAP inconsistencies found:** None between the GBP listing and the site's `/contact-us/` page — both show the same address and `+65 9792 1567` exactly (confirmed via DataForSEO's live pull and the Technical Auditor's crawl). The inconsistency risk here isn't wrong data, it's **missing** data: the GBP-matching NAP exists on only one page of the website with no schema markup, so new citations built from the canonical block above will actually be more complete/consistent than the client's own website is today — flag that gap to the client alongside the citation rollout (see Profile fixes #1–2).

---

**Handoff:** 4.5★/64 reviews, claimed and largely healthy GBP. Zero review replies drafted this run — Windsor.ai is not connected, so review text isn't accessible; reconnect Windsor (or grant GBP dashboard access) to unlock that half of this role. The single most valuable gap is the website providing almost no structured reinforcement of the GBP listing (no `LocalBusiness` schema, NAP on one page only, no embedded map) despite this domain's entire strategy being hyperlocal. One insight number worth carrying into the client report: wgpetfarm.com holds an uncontested #2 local-pack position for "pet farm singapore" (210 vol/mo) but 0/3 in the packs for "dog breeder singapore" (260 vol) and "puppy for sale singapore" (1,000 vol) — the local-pack upside is real and partly proven, not hypothetical.
