# Irish supplier research: four listing sites (K-008)

**Date:** 2026-11-08 · **Method:** Each site's robots.txt and sitemap, its index or list endpoint, and **one sample listing per site**: 17 HTTP requests in total, 2–3 s apart, with an identifying User-Agent (`CuriousTailsResearch/1.0; +https://curioustails.sg`). No headless browser, no proxy, and no retries against blocks.

> This file is **internal research**. It names the suppliers on purpose. None of it may appear in a public artifact.

## TL;DR

| Site as briefed | What it really is | Machine-readable feed | Detail and photos reachable? | Usable for auto-publish |
|---|---|---|---|---|
| **puppies.ie** | A **front end for dogs.ie** (Ireland's largest dog classifieds; about 992 puppy ads). Every card links out to `dogs.ie/sale/...` | Yes: Inertia `data-page` JSON on `/`, plus `GET /api/latest-ads?page=N` (summaries only) | **No.** `dogs.ie` and `images.dogs.ie` both return **HTTP 403 / Cloudflare "Sorry, you have been blocked"**, even for robots.txt | **No.** Summary only, no photo, no DOB, no microchip. Review queue at best. |
| **irishpuppies.ie** | A **front end for dogsy.ie**. Its page JS calls dogsy's public API | Yes: `GET https://dogsy.ie/api/public/listings?page=N` (JSON, 24 per page, **36 live ads**) | Yes. Detail HTML has Product JSON-LD, DOB, and per-puppy microchip, sex and colour | **Yes**, low volume |
| **dogquest.ie** | A standalone Next.js + Supabase marketplace | `sitemap.xml` (only **6 live listings**); the full record is embedded in the page's RSC payload | Yes. Public Supabase image URLs; per-puppy microchips **verified with Animark** | **Yes**, very low volume, best data quality |
| **dogsforsaleireland.ie** | A WordPress classifieds theme | Yoast sitemaps: `ad_post-sitemap2.xml` (558 ads, ~160 updated in Oct-2026) | Yes. JSON-LD price, details block (DOB, sex counts, microchips), `wp-content` images | **Yes**, the highest volume of the three. **Its T&Cs prohibit republishing.** |

**Bottom line:**
- Only **three origins can actually be automated**: dogsy (via irishpuppies), dogquest and dogsforsaleireland.
- **puppies.ie/dogs.ie is blocked to us.** Getting its photos or details would mean circumventing the block, which we must not do.
- Expect roughly **5–15 publishable new puppy ads per week** across the six target breeds plus Dachshund and Golden Retriever, after gates. The estimate is in the volume section below.

---

## 1. puppies.ie → dogs.ie

- **robots.txt:** `User-agent: * / Disallow:` (everything allowed); sitemap at `/sitemap.xml` (36 URLs: home, buy, sell, county pages).
- **Structure:** A Laravel + Inertia SPA. The home page embeds `data-page` JSON with `initialLatestAds` (36). The Ziggy routes expose `latest-ads.load-more → api/latest-ads`, `api/{county}/latest-ads` and `api/northern-ireland/latest-ads`.
- **Fields per ad (summary only):** `title, price, currency_symbol (€ or £), county_name, breed_name, image_count, video_count, male_count, female_count, preview_url (images.dogs.ie), url (dogs.ie/sale/<breed>/<slug>), published_at_for_humans ("3 hours ago")`.
- **Missing:** DOB or age, microchip, colour, seller, full photo set, availability status, absolute timestamps.
- **Blocking:** `https://dogs.ie/robots.txt`, a dogs.ie ad page and `images.dogs.ie/.../preview.jpg` **all returned 403 (Cloudflare block page)**. We recorded this and did not retry.
- **Currency:** mostly € (Republic), with some **£** (Northern Ireland; 2 of 72 in the sample).
- **Volume:** very high, about 30 or more new ads a day. 72 ads covered roughly 1.5 days.
- **Prices in sample (72):** €250 to €3,000, median €700. Jack Russell €300–500 (8 ads), Border Collie €250–950 (3), Chihuahua €850–2,800 (2).
- **Update frequency:** continuous.
- **Terms:** puppies.ie has no T&C link. dogs.ie's terms were unreachable (403).
- **Verdict:** **Not usable for auto-publish.** The image gate can never pass without bypassing dogs.ie's block. Options: (a) drop the source, or (b) ingest summaries into the review queue as "lead only"; the owner contacts the breeder by hand and gets photos with permission. See D4.

## 2. irishpuppies.ie → dogsy.ie

- **irishpuppies.ie robots:** allow all (except `?sort=` and `?search=`). Its listings are client-rendered from `fetch('https://dogsy.ie/api/public/listings?page=N')`.
- **dogsy.ie robots:** disallows `/login/`, `/admin/` and query-string listing pages (`/dogs-for-sale?*`). It blocks AI crawlers (GPTBot, anthropic-ai, etc.). **`/api/public/` is not disallowed.**
- **API fields:** `id, title, breed, county, price (number, EUR), url (/dogs-for-sale/<id>-<slug>.html), image (/storage/ad-media/<epoch>_<rand>.jpg), description (truncated), published_at (relative), dob (ISO), age_weeks (BUG: always negative)`.
- **Pagination:** `{total: 36, per_page: 24, last_page: 2}`.
- **Detail page:** It includes these Schema.org blocks:
  - `Product` with `offers.priceCurrency: EUR`, `price` and `sku` (the ad ID)
  - `additionalProperty`: Breed, Location, Age
  
  The visible details block gives:
  - DOB (DD/MM/YYYY)
  - sex counts and temperament
  - county and town, and country of origin
  - Wormed / Vaccinated / Neutered / Microchipped flags
  - a **microchip table**: chip number, sex, colour and status ("For Sale")
  
  Alpine `x-data` JSON also carries `microchips[]`, `seller_license` and the **seller's phone number (shown on the page)**.
- **Images:** one or more per ad at `dogsy.ie/storage/ad-media/`. These are direct, public files.
- **Data quality:**
  - **Only 9 of 36 listings are puppies 16 weeks or younger.** The rest are older pups, adult rehoming ads (DOBs back to 2022) or evergreen breeder ads ("Chihuahua pups sometimes available").
  - A "/ Negotiable" flag shows next to the price.
  - "No time wasters" boilerplate is common.
- **Prices (36):** €100 to €1,600, median €690. Chihuahua €680–1,000 (5 ads, mostly stale). JRT €350–450 (2).
- **Terms (`/terms`):** a marketplace disclaimer that explains Irish seller-registration law; there's no explicit scraping clause. The footer reads "All content copyright Dogsy.ie © 2026". Photos belong to the sellers who uploaded them.
- **Verdict:** **Usable.** It's a cheap API, but low volume and noisy, so a strict age gate is needed.

## 3. dogquest.ie

- **robots.txt:** a Cloudflare-managed file with **Content-Signal `search=yes, ai-train=no, use=reference`**. `User-agent: *` is allowed; named AI and SEO bots are disallowed. It reserves rights under EU DSM Directive Art. 4. Our use (commercial republication) isn't a Content-Signal category, so the signal neither grants nor restricts it. The T&Cs decide.
- **Structure:** Next.js app router. The sitemap lists `/listing/<slug>-<uuid>`, **6 live listings** (Jack Russell, Dachshund ×3, Golden Retriever, Beagle). The `/listings` index is server-rendered.
- **Fields:** The RSC payload holds `initialListing`, which is the richest record of the four sites:
  - **Listing level:**
    - id (uuid), title, price, min_price and max_price
    - location (county), breed slug and breed_type (pedigree or cross)
    - **date_of_birth**, male_count and female_count
    - description, vet_name and vet_location
    - images[] (Supabase public URLs, .webp; 5 in the sample)
    - seller_id, created_at and updated_at
    - badges (gold_star, green_tick)
  - **puppy_details[], per puppy:**
    - sex, color and price
    - an imageUrl for that puppy
    - **microchipNumber**, microchipVerifiedAt and `microchipVerificationStatus: "animark_verified"`
    - animarkPet {breed, colour, chip_number}
  - The page also carries Product JSON-LD (price in EUR).
- **Prices:** €650 in the sample.
- **Terms (`/terms-and-conditions`):**
  - Users grant DogQuest a licence to use their content (text, photos, video) for DogQuest's marketing.
  - DogQuest's own IP may not be copied without written permission.
  - Sellers must show their DAFM registration number, and the dog must be microchipped before it is advertised.
  
  **We get no rights to the sellers' photos.**
- **Verdict:** **Usable, best quality, tiny volume.**

## 4. dogsforsaleireland.ie (dfsi)

- **robots.txt:** WordPress defaults; everything allowed except `/wp-admin/`. Yoast `sitemap_index.xml`.
- **Listing URL pattern:** `/ad/<slug>/`. Category page `/ad_category/puppies-for-sale-ireland/`. Sitemaps `ad_post-sitemap.xml` and `ad_post-sitemap2.xml` (558 URLs with `<lastmod>`).
- **Volume:** lastmod Oct-2026 = 162, Nov 1–7 = 38. That's about **5 per day** (lastmod includes edits and renewals).
- **Detail fields:**
  - **From JSON-LD:** Product with `offers.price` (EUR) and image.
  - **From the visible details:**
    - price, plus a "(Negotiable)" flag
    - posted date, views
    - Breed (free text, e.g. "Jack russel")
    - **Date of Birth**, plus the site's own computed current age
    - temperament, country of origin
    - number of males and females
    - IKC registered, wormed, vaccinated, neutered
    - **microchip numbers (a list, one per puppy)**
    - "**Registered Seller ID**", which is sometimes just the **seller's email address**
    - seller name and type (Individual or Breeder)
  - **Not given:** colour, except where it's in the free-text description.
- **Images:** `wp-content/uploads/YYYY/MM/<uuid>-..-scaled.jpg`, often with multiple size variants of each photo.
- **Breed coverage (slug match, ads updated in the last 30 days, n=167):** Chihuahua 9, Jack Russell 7, Border Collie or other collie 3, **Westie 3**, **Sheltie 1**, **Samoyed 0**.
- **Terms (`/terms-and-conditions/`): explicit prohibition.** *"You must not: Republish material from DogsForSaleIreland; Sell, rent or sub-license material…; Reproduce, duplicate or copy material…; Redistribute content…"* Access is granted "for your own personal use".
- **Verdict:** **Technically easy, and the highest volume, but contractually the riskiest** of the usable sources. See risk R2 and decision D3.

---

## Cross-site findings

### Fields available (✓ = structured, ~ = free text or partial, ✗ = absent or blocked)

| Field | dogsy | dogquest | dfsi | puppies.ie |
|---|---|---|---|---|
| Breed | ✓ (may be multi: "Chihuahua, Yorkshire Terrier") | ✓ slug, breed_1 and breed_2 | ~ free text | ✓ |
| Sex | ✓ counts and per chip | ✓ counts and per pup | ✓ counts | ✓ counts |
| Colour | ✓ per chip | ✓ per pup | ~ description only | ✗ |
| Age / DOB | ✓ DOB | ✓ DOB | ✓ DOB | ✗ ("x hours ago" only) |
| Price | ✓ number | ✓ number, per-pup price | ✓ number | ✓ number |
| Currency | EUR | EUR | EUR | € or **£** |
| Microchip | ✓ per pup | ✓ per pup, Animark-verified | ✓ list | ✗ |
| Seller | ✓ name and phone | seller_id and vet | name and email/reg ID | ✗ |
| Location | county and town | county | county | county |
| Images | 1+ public | 1–6 public, plus per-pup | several public | **403** |
| Availability | microchip status "For Sale" | implicit | implicit, "sold" sometimes in the slug | ✗ |
| Listing date | relative | ISO created_at | ISO datePublished | relative |

### Prices, EUR and VAT

- Every price in the sample is a **bare number in EUR**, except Northern Ireland ads on dogs.ie, which are in **GBP**.
- The prices are private-sale asking prices. **No VAT is shown or implied.** Small breeders are below the VAT threshold, and a private sale of a pet isn't a VAT-able supply. Treat each number as the full asking price.
- Many prices are flagged **"Negotiable"**.
- **Placeholder prices** appear: €1,234 (dogs.ie), €100 to €250 for adult rehoming ads, and €1 or €0 ads are typical on these platforms.
- **Price ranges for the six target breeds (sample):**
  - Jack Russell €250–650
  - Border Collie €250–950
  - Chihuahua €680–1,000 (€2,800 outlier)
  - Westie, Sheltie, Samoyed: no priced sample observed
- At the owner's rule (number + 4,000), the Curious Tails prices come out at **S$4,250–5,000**, roughly in line with or below the existing local price bands. The current Sheltie page says "from $4,988" and Samoyed "from $5,500".

### Images and rights

- **Typical image counts:** dogs.ie 2–10, dogquest 1–6 plus per-pup shots, dfsi 1–4 photos (each in several sizes), dogsy 1 or more.
- Every photo is the **seller's copyright**. Platforms take a licence from the seller for their own use only. **No platform grants third parties a reuse licence**, and dfsi expressly forbids reproduction.
- **Reverse image search will expose the source.** Anyone who runs a Curious Tails photo through Google Lens will land on the original Irish ad and see the €-price. Hiding the supplier in our HTML doesn't hide the photo's origin. See R3.

### Anti-bot behaviour

| Origin | Behaviour |
|---|---|
| dogs.ie / images.dogs.ie | **Cloudflare block, hard 403**, even for robots.txt. Do not work around it. |
| dogquest | Cloudflare in front; served normally at low rate. Content-Signal headers. |
| dogsy | No challenge seen. A public JSON API. |
| dfsi | No challenge seen. WordPress plus Yoast. |

**Note on the existing AU pipeline:** `scripts/sync-overseas.mjs` fetches 403-blocked Gumtree and Pets4Homes images **through the images.weserv.nl proxy**. That is a hotlink-protection workaround. The new imports pipeline must **not** reuse that technique, and I recommend reviewing the AU feed for the same reason (R10).

### Data-quality issues

1. **Stale and adult listings.** In dogsy, only 9 of 36 ads are 16 weeks or younger. Old DOBs (2022, 2023) mean adult rehoming. Evergreen "pups sometimes available" ads.
2. **Litter ads, not puppy ads.** One ad covers 1–8 puppies with mixed sexes and colours, and sometimes different prices per puppy (dogquest `puppy_details[].price`).
3. **Cross-site duplicates.** Irish breeders commonly cross-post the same litter to dogs.ie, dfsi and dogsy. **Microchip numbers are the reliable join key** (15-digit ISO; 981098… = Animark range).
4. **Breed noise:** misspellings ("Jack russel", "dachund", "boarder doodles"), multi-breed strings, loose terms ("Sheepdog" for collie crosses), and mismatches between the title and the breed field ("Lhasa Apso" ad titled "shih tzu puppies").
5. **Prices:** POA or "contact", Negotiable, GBP, placeholder (€1,234), and stud ads mixed in on dfsi.
6. **Emoji or empty titles** ("chihuahua💗💗💗") and boilerplate text.
7. **dogsy `age_weeks` is always negative.** Compute age from `dob` instead.
8. Relative timestamps ("3 hours ago") on dogsy and puppies.ie. Store `firstSeenAt` ourselves.

### Prohibited and restricted breed risk (Singapore, AVS)

- **Prohibited from import (no pathway):** Pit Bull types (American Pit Bull Terrier, American Staffordshire Terrier, Staffordshire Bull Terrier, American Bulldog), Akita, Neapolitan Mastiff, Tosa, Dogo Argentino, Fila Brasileiro, Boerboel, Perro de Presa Canario, and crosses of these.
- **Irish-market hazards:**
  - "**Pocket / XL / American Bully**" ads (a dfsi stud ad seen on the homepage) are pit-bull-derived and must be **rejected**.
  - Staffie crosses are common in Irish rehoming.
- **Specified (allowed with extra licence conditions):** Bull Terrier, Doberman, Rottweiler, German Shepherd (also Belgian and East European Shepherd), and mastiff types (Bull Mastiff, Cane Corso, Dogue de Bordeaux), plus crosses. **German Shepherd ads are frequent in Ireland** (3 of the 36 dogs.ie latest). Route these to review and don't auto-publish.
- Large guardian breeds that aren't on the list (e.g. Caucasian Shepherd) go to review.
- **HDB:** Westie, Jack Russell, Chihuahua and Shetland Sheepdog are on HDB's approved list of about 62 breeds. **Border Collie and Samoyed are not** (private housing only), and the site already says so.
- Source: AVS "List of specified dogs and additional licensing conditions" (Sep 2024 PDF) and the AVS/NParks approved small-breed list (see Sources). **Task T3 must transcribe the official lists verbatim into `scripts/imports/rules/` and date-stamp them.**

### AVS import requirements that affect arrival promises

- **Ireland (and the UK) are AVS Category A** (rabies-free). **No quarantine** if every veterinary condition is met.
- Key conditions to confirm against the current AVS Schedule I veterinary conditions PDF before go-live:
  1. **The dog must be at least 12 weeks old at export.**
  2. **An ISO microchip**, scanned and verified shortly before export. The chip number must appear on every vaccination record, test result and health certificate.
  3. **An AVS import licence** (per consignment, applied for via the AVS e-services / PALS portal ahead of arrival), plus a **Singapore dog licence**.
  4. **Vaccinations and parasite treatments** within the prescribed windows, and an **official veterinary health certificate** endorsed by Ireland's Department of Agriculture (DAFM) close to the export date.
  5. Arrival into Changi as **manifest air cargo** with an AVS inspection. That needs flight booking with a pet-relocation agent, and airline heat or season embargoes can apply.
- **Effect on arrival dates:**
  - The owner's rule, **DOB + 3 months (about 13 weeks), is the earliest physically possible arrival**: legal export age plus about one week. It is **not** a typical arrival.
  - Paperwork (licence, vet certificate, DAFM endorsement) and flight booking usually add **2–6 weeks**.
  - For a puppy that is already 10 or more weeks old when listed, DOB + 3 months will often be in the past or too close to meet.
  - **Recommendation (D6):** arrival = max(DOB + 3 months, today + 4 weeks), displayed as a month only, with "subject to import approval".
- **Irish-side law that helps data quality:**
  - Puppies may not be sold before 8 weeks.
  - Dogs must be microchipped and registered before sale *and before advertising*.
  - Sellers of 6 or more dogs a year must register with DAFM and show the number in ads.
  - So **a missing microchip is a red flag for an illegal ad**; route it to review.
- **Export from Ireland for a commercial resale** may need DAFM export certification or TRACES and a registered transporter. A pet-relocation agent confirms this (task T20, owner D7).

### Breed coverage for the six missing breeds

| Breed | puppies.ie (72 latest ≈ 1.5 days) | dogsy (36 live) | dogquest (6 live) | dfsi (30 days, n=167) | Fit |
|---|---:|---:|---:|---:|---|
| Jack Russell | 8 | 2 | 1 | 7 | **Strong** |
| Chihuahua | 2 | 5 (mostly stale) | 0 | 9 | **Good** |
| Border Collie | 3 | 0 | 0 | ~3 | **Good** (but not HDB) |
| Westie | 0 | 0 | 0 | 3 | **Weak** |
| Sheltie | 0 | 0 | 0 | 1 | **Very weak** |
| Samoyed | 0 | 0 | 0 | 0 | **None** |
| *Dachshund (bonus)* | 2 | 7 | 3 | many | **Very strong** |
| *Golden Retriever (bonus)* | 4 | 1 | 1 | some | **Strong** |

### Volume estimate (usable sources only)

- **dfsi:** about 35 ads a week, of which perhaps 50–60% are puppy-age with DOB, photos and a microchip. Of those, about 40% map to a Curious Tails breed page and aren't prohibited. **About 6–10 a week.**
- **dogsy:** about 2–4 new ads a week, ~30% pass. **About 1 a week.**
- **dogquest:** fewer than 1 a week.
- **Total auto-publishable: about 7–12 litter ads a week**, of which perhaps 2–4 are in the six target breeds. Duplicates across sites will cut this slightly.

## Sources

- Fetched pages (2026-11-08): the four homepages and robots.txt files; `puppies.ie/sitemap.xml`; `puppies.ie/api/latest-ads?page=2`; `dogsy.ie/api/public/listings?page=1,2`; one dogsy ad; `dogquest.ie/sitemap.xml`, `/listings` and one listing; `dogsforsaleireland.ie/sitemap_index.xml`, `ad_post-sitemap2.xml` and one ad; T&Cs of dogquest, dogsy and dfsi. dogs.ie returned 403 on robots.txt, an ad and an image.
- AVS: [Importing dogs and cats](https://avs.nparks.gov.sg/pets/importing-exporting-a-pet/import/dogs-and-cats/) · [Preparing to bring dogs and cats into Singapore](https://www.nparks.gov.sg/avs/pets/bringing-animals-into-singapore-and-exporting/bringing-in-and-transshipping-dogs-and-cats/preparing-to-bring-dogs-and-cats-into-singapore) · [Category A import flowchart](https://www.nparks.gov.sg/-/media/avs/migrated-content/animals-and-pets/bringing-animals-into-singapore-and-exporting/bringing-dogs-and-cats/category-a-dog-cat-import-flowchart-apr2018.pdf) · [Schedule I veterinary conditions](https://nparks.gov.sg/-/media/avs/migrated-content/animals-and-pets/bringing-animals-into-singapore-and-exporting/bringing-dogs-and-cats/schedule-i-veterinary-conditions.pdf) · [List of specified dogs (Sep 2024)](https://www.nparks.gov.sg/-/media/avs/resources/dog-licensing/list-of-specified-dogs-and-additional-licensing-conditions_sep2024.pdf) · [Approved small breeds (HDB)](https://Www.nparks.gov.sg/-/media/avs/resources/dog-licensing/approved-small-breed.pdf)
- Secondary sources used for orientation (verify against AVS): [PetRelocation: Singapore](https://www.petrelocation.com/resources/international-regulations/singapore) · [ZooVet Travel atlas](https://zoovettravel.com/atlas/singapur-en.html) · [PetRelocation: restricted breeds](https://www.petrelocation.com/blog/post/singapore-restricted-dog-breeds-requirements) · [HDB: types of pets allowed](https://www.hdb.gov.sg/cs/infoweb/community/caring-for-your-neighbours/being-a-good-neighbour/tips-on-neighbourliness/keeping-pets)
