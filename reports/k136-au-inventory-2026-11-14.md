# K-136 — Inventory of the 40 Australian reservation listings

**Date:** 2026-11-14 · **Source:** `src/data/overseas-puppies.json` (the current data file, `syncedAt` 2026-10-02T06:55:38.669Z), read-only. Written before any code change. Generator: `reports/k136-tools/au-inventory.mjs`. CSV: `reports/k136-au-inventory-2026-11-14.csv`.

## What the data file does and does not record

- It records, per listing: breed, sex, age (as of the 2026-10-02 sync), the all-in SGD price (`MarkUpPrice-`), the 50% deposit amount **asked** (`50%Price-`), the source listing ID and a photo filename.
- It does **not** record whether a deposit was **taken**, when, by whom, or any buyer. Those three columns are `—` on every row below. They are not in the sync script's input either (`scripts/sync-overseas.mjs` reads Breed, Age, DOB, Gender, Price, ImageURL, ListingURL, Website, MarkUpPrice, 50%Price, Notes, and writes none of DOB, Notes or any buyer field). If deposits have been taken on any of these listings, the record of them is outside this repo (WhatsApp, bank, an owner sheet). **Flag:** the owners must supply that list; the migration cannot invent it.
- The only date in the file is the feed's sync stamp (2026-10-02), **43 days old** today. It is not a listing date or a reservation date, so the Date column is `—`. Ages are as of that sync and are now about six weeks stale.

## Totals

| | Count |
|---|---|
| Listings in the file | 40 |
| With a price | 27 (no price: 13) |
| With a photo, so shown on the live site today | 27 (verified on curioustails.sg: 27 cards across 12 breed pages; cockapoo and cocker-spaniel show none) |
| Without a photo, hidden since the 2026-09-30 owner rule | 13 |
| Deposit taken / date / buyer recorded | 0 / 0 / 0 |
| Sum of listed prices | S$157,150 |
| Sum of 50% deposits asked | S$78,575 (every priced row's deposit is exactly 50%) |
| Labels the sync could not map to a breed page (dropped, not in the 40) | 11: American Bulldog, Australian Cattle Dog, Australian Kelpie x Labrador, Boxer, Cane Corso (Italian Mastiff), English Staffy Mix, Labrador Retriever, Lhasa Apso, Miniature American Shepherd, Schnoodle, Tibetan Mastiff |

## The 40 rows

| # | Record id | Listing ID | Breed page | Breed (as listed) | Sex | Age as listed | Price (all-in) | 50% deposit asked | Deposit taken | Date | Buyer status | Photo | Live card now | Flags |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | os-59701d7d | 76641 | beagle | Beagle | Both | 8 weeks | — | — | — | — | — | yes | yes | no price recorded; no deposit amount recorded |
| 2 | os-8b777ae0 | 74317 | border-collie | Border Collie x Sausage Dog | Both | — | S$4,500 | S$2,250 | — | — | — | yes | yes | no age |
| 3 | os-6c152beb | 44008 | border-collie | Border Collie x Kelpie | Both | 8 weeks | S$4,300 | S$2,150 | — | — | — | yes | yes | — |
| 4 | os-a9451884 | 43524 | border-collie | Border Collie | Both | — | — | — | — | — | — | yes | yes | no price recorded; no deposit amount recorded; no age |
| 5 | os-ceb9e485 | 57083 | cavapoo | Cavoodle x Pomeranian | Both | 7 weeks | S$6,300 | S$3,150 | — | — | — | yes | yes | — |
| 6 | os-cdfb767b | 12205 | cavapoo | Cavoodle | Female | 3 months | S$5,300 | S$2,650 | — | — | — | yes | yes | — |
| 7 | os-22bf52ad | 63956 | cavapoo | Cavoodle | — | — | S$7,300 | S$3,650 | — | — | — | no | no | no photo (hidden on the live site); no age; no sex |
| 8 | os-00fc350d | 77098 | cavapoo | Cavoodle | Both | 9 weeks | S$6,500 | S$3,250 | — | — | — | no | no | no photo (hidden on the live site) |
| 9 | os-78c80080 | 11573 | cavapoo | Cavoodle | Female | — | S$6,000 | S$3,000 | — | — | — | no | no | no photo (hidden on the live site); no age |
| 10 | os-8b5770d4 | 33155 | chihuahua | Chihuahua | Female | 2 months | S$6,000 | S$3,000 | — | — | — | yes | yes | — |
| 11 | os-18d38967 | 74453 | cockapoo | Spoodle | Female | — | S$6,500 | S$3,250 | — | — | — | no | no | no photo (hidden on the live site); no age |
| 12 | os-311f0298 | 62341 | cockapoo | Spoodle | Male | 3 months | S$6,000 | S$3,000 | — | — | — | no | no | no photo (hidden on the live site) |
| 13 | os-a21091c4 | 76418 | cocker-spaniel | Cocker Spaniel | Both | — | S$6,700 | S$3,350 | — | — | — | no | no | no photo (hidden on the live site); no age |
| 14 | os-ed20d82b | 14073 | french-bulldog | French Bulldog | — | 4 weeks | — | — | — | — | — | yes | yes | no price recorded; no deposit amount recorded; no sex |
| 15 | os-3b282e99 | 88441 | french-bulldog | French Bulldog | Both | — | — | — | — | — | — | yes | yes | no price recorded; no deposit amount recorded; no age |
| 16 | os-7d6afb6d | 56684 | french-bulldog | French Bulldog | Male | — | — | — | — | — | — | yes | yes | no price recorded; no deposit amount recorded; no age |
| 17 | os-97719a26 | 16873 | french-bulldog | French Bulldog | Both | — | — | — | — | — | — | yes | yes | no price recorded; no deposit amount recorded; no age |
| 18 | os-836ccbd0 | 26831 | french-bulldog | French Bulldog | Female | — | — | — | — | — | — | yes | yes | no price recorded; no deposit amount recorded; no age |
| 19 | os-63de90f3 | 34385 | french-bulldog | French Bulldog | Male | — | — | — | — | — | — | yes | yes | no price recorded; no deposit amount recorded; no age |
| 20 | os-7ed60ba3 | 32811 | french-bulldog | French Bulldog | Female | 2 months | — | — | — | — | — | no | no | no price recorded; no deposit amount recorded; no photo (hidden on the live site) |
| 21 | os-6ca35b65 | 93334 | german-shepherd | German Shepherd Dog | Both | — | S$7,000 | S$3,500 | — | — | — | yes | yes | no age |
| 22 | os-304e8b61 | 14081 | german-shepherd | German Shepherd | Female | 3 months | S$5,500 | S$2,750 | — | — | — | no | no | no photo (hidden on the live site) |
| 23 | os-805b9900 | 65590 | golden-retriever | Golden Retriever | Both | — | S$7,000 | S$3,500 | — | — | — | no | no | no photo (hidden on the live site); no age |
| 24 | os-99af37f5 | 17132 | golden-retriever | Golden Retriever | Female | 2 months | — | — | — | — | — | yes | yes | no price recorded; no deposit amount recorded |
| 25 | os-6a1e7720 | 64832 | golden-retriever | Golden Retriever | Both | 3 months | S$6,000 | S$3,000 | — | — | — | no | no | no photo (hidden on the live site) |
| 26 | os-70a7c43d | 52499 | golden-retriever | Golden Retriever | Male | 5 weeks | S$4,900 | S$2,450 | — | — | — | yes | yes | — |
| 27 | os-80fefa9e | 28740 | golden-retriever | Golden Retriever | Both | — | S$7,000 | S$3,500 | — | — | — | yes | yes | no age |
| 28 | os-65859503 | 81421 | havanese | Havanese | Both | 7 weeks | S$6,500 | S$3,250 | — | — | — | yes | yes | — |
| 29 | os-d9eff28e | 30781 | maltese | Maltese | Both | 8 weeks | S$5,450 | S$2,725 | — | — | — | yes | yes | — |
| 30 | os-346dce23 | 57951 | maltese | Maltese x Pomeranian | Both | 2 months | S$5,800 | S$2,900 | — | — | — | no | no | no photo (hidden on the live site) |
| 31 | os-bc484c2f | 76847 | mini-dachshund | Dachshund | Both | 2 months | S$5,000 | S$2,500 | — | — | — | yes | yes | — |
| 32 | os-e8efdc25 | 43536 | mini-dachshund | Dachshund | Female | — | S$4,700 | S$2,350 | — | — | — | yes | yes | no age |
| 33 | os-481df0b8 | 44420 | mini-dachshund | Miniature Dachshund | Both | 2 months | S$4,500 | S$2,250 | — | — | — | no | no | no photo (hidden on the live site) |
| 34 | os-8f1f496d | 98417 | mini-dachshund | Miniature Dachshund | Female | 4 weeks | — | — | — | — | — | yes | yes | no price recorded; no deposit amount recorded; record id os-8f1f496d shared by 2 listings |
| 35 | os-8f1f496d | 25655 | mini-dachshund | Miniature Dachshund | Male | 4 weeks | — | — | — | — | — | yes | yes | no price recorded; no deposit amount recorded; record id os-8f1f496d shared by 2 listings |
| 36 | os-a3562f70 | 43187 | mini-dachshund | Miniature Dachshund | Both | 9 weeks | S$6,300 | S$3,150 | — | — | — | yes | yes | — |
| 37 | os-5b99730e | 58422 | pomeranian | Pomeranian | Female | 2 months | S$5,700 | S$2,850 | — | — | — | yes | yes | — |
| 38 | os-f47adf9d | 51951 | toy-poodle | Miniature Poodle | Female | 5 weeks | — | — | — | — | — | yes | yes | no price recorded; no deposit amount recorded |
| 39 | os-48169451 | 92814 | toy-poodle | Poodle | Both | 2 months | S$5,400 | S$2,700 | — | — | — | no | no | no photo (hidden on the live site) |
| 40 | os-00b8a022 | 74615 | toy-poodle | Toy Poodle x Moodle | Both | — | S$5,000 | S$2,500 | — | — | — | yes | yes | no age |

## Flags

1. **No deposit, date or buyer is recorded for any of the 40.** Printed `—` and flagged. The owners need to say which of these listings already have a paying buyer.
2. **13 live-or-hidden listings have no price** (and so no deposit amount). 12 of them are shown on the live site today with no price and no deposit line.
3. **Two listings share one record id** (`os-8f1f496d`, listing IDs 98417 and 25655, Miniature Dachshund girl and boy). The sync derives the id from the photo URL, and both rows point at the same photo. Both cards render on the live mini-dachshund page with the same `data-wa-source`, so GA4 cannot tell them apart.
4. **The data is 43 days old.** `npm run sync:overseas` has not run since 2026-10-02. Some of these puppies may be sold at source; the file cannot say which.
