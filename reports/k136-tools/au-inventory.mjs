#!/usr/bin/env node
// K-136 step 1: inventory of the Australian reservation listings, read-only.
//
//   node reports/k136-tools/au-inventory.mjs
//
// Reads src/data/overseas-puppies.json (the current data file) and the photo
// folder, and writes reports/k136-au-inventory-2026-11-14.{md,csv}. Changes
// nothing else. Fields the data file does not hold are printed as "—" and
// flagged; nothing is inferred.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const feed = JSON.parse(readFileSync(path.join(ROOT, 'src', 'data', 'overseas-puppies.json'), 'utf8'));
const photo = (f) => !!f && existsSync(path.join(ROOT, 'src', 'assets', 'overseas', f));
const money = (n) => (typeof n === 'number' ? `S$${n.toLocaleString('en-SG')}` : '—');
const DASH = '—';

const rows = [];
for (const [breed, list] of Object.entries(feed.breeds ?? {})) {
  for (const r of list) rows.push({ breed, ...r });
}
const idCount = rows.reduce((m, r) => m.set(r.id, (m.get(r.id) ?? 0) + 1), new Map());

const out = rows.map((r, i) => {
  const flags = [];
  if (r.price == null) flags.push('no price recorded');
  if (r.deposit == null) flags.push('no deposit amount recorded');
  if (r.price != null && r.deposit != null && r.deposit * 2 !== r.price) flags.push(`deposit is not 50% of price`);
  if (!photo(r.image)) flags.push('no photo (hidden on the live site)');
  if (idCount.get(r.id) > 1) flags.push(`record id ${r.id} shared by ${idCount.get(r.id)} listings`);
  if (!r.age) flags.push('no age');
  if (!r.gender) flags.push('no sex');
  return {
    n: i + 1,
    id: r.id,
    listingId: r.listingId ?? DASH,
    breedPage: r.breed,
    breedLabel: r.crossLabel ?? r.breedLabel,
    sex: r.gender ?? DASH,
    ageAsListed: r.age ?? DASH,
    price: money(r.price),
    depositAsked: money(r.deposit),
    depositTaken: DASH,
    date: DASH,
    buyerStatus: DASH,
    photo: photo(r.image) ? 'yes' : 'no',
    liveCard: photo(r.image) ? 'yes' : 'no',
    flags,
  };
});

const cols = ['n', 'id', 'listingId', 'breedPage', 'breedLabel', 'sex', 'ageAsListed', 'price', 'depositAsked', 'depositTaken', 'date', 'buyerStatus', 'photo', 'liveCard'];
const head = ['#', 'Record id', 'Listing ID', 'Breed page', 'Breed (as listed)', 'Sex', 'Age as listed', 'Price (all-in)', '50% deposit asked', 'Deposit taken', 'Date', 'Buyer status', 'Photo', 'Live card now', 'Flags'];
const csvCell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const csv = [head.join(','), ...out.map((o) => [...cols.map((c) => o[c]), o.flags.join('; ')].map(csvCell).join(','))].join('\n') + '\n';

const priced = out.filter((o) => o.price !== DASH).length;
const withPhoto = out.filter((o) => o.photo === 'yes').length;
const sumPrice = rows.reduce((s, r) => s + (r.price ?? 0), 0);
const sumDeposit = rows.reduce((s, r) => s + (r.deposit ?? 0), 0);
const md = `# K-136 — Inventory of the 40 Australian reservation listings

**Date:** 2026-11-14 · **Source:** \`src/data/overseas-puppies.json\` (the current data file, \`syncedAt\` ${feed.syncedAt}), read-only. Written before any code change. Generator: \`reports/k136-tools/au-inventory.mjs\`. CSV: \`reports/k136-au-inventory-2026-11-14.csv\`.

## What the data file does and does not record

- It records, per listing: breed, sex, age (as of the ${feed.syncedAt.slice(0, 10)} sync), the all-in SGD price (\`MarkUpPrice-\`), the 50% deposit amount **asked** (\`50%Price-\`), the source listing ID and a photo filename.
- It does **not** record whether a deposit was **taken**, when, by whom, or any buyer. Those three columns are \`—\` on every row below. They are not in the sync script's input either (\`scripts/sync-overseas.mjs\` reads Breed, Age, DOB, Gender, Price, ImageURL, ListingURL, Website, MarkUpPrice, 50%Price, Notes, and writes none of DOB, Notes or any buyer field). If deposits have been taken on any of these listings, the record of them is outside this repo (WhatsApp, bank, an owner sheet). **Flag:** the owners must supply that list; the migration cannot invent it.
- The only date in the file is the feed's sync stamp (${feed.syncedAt.slice(0, 10)}), **43 days old** today. It is not a listing date or a reservation date, so the Date column is \`—\`. Ages are as of that sync and are now about six weeks stale.

## Totals

| | Count |
|---|---|
| Listings in the file | ${out.length} |
| With a price | ${priced} (no price: ${out.length - priced}) |
| With a photo, so shown on the live site today | ${withPhoto} (verified on curioustails.sg: ${withPhoto} cards across 12 breed pages; cockapoo and cocker-spaniel show none) |
| Without a photo, hidden since the 2026-09-30 owner rule | ${out.length - withPhoto} |
| Deposit taken / date / buyer recorded | 0 / 0 / 0 |
| Sum of listed prices | S$${sumPrice.toLocaleString('en-SG')} |
| Sum of 50% deposits asked | S$${sumDeposit.toLocaleString('en-SG')} (every priced row's deposit is exactly 50%) |
| Labels the sync could not map to a breed page (dropped, not in the 40) | ${(feed.unmapped ?? []).length}: ${(feed.unmapped ?? []).join(', ')} |

## The 40 rows

| ${head.join(' | ')} |
|${head.map(() => '---').join('|')}|
${out.map((o) => `| ${[...cols.map((c) => o[c]), o.flags.join('; ') || DASH].join(' | ')} |`).join('\n')}

## Flags

1. **No deposit, date or buyer is recorded for any of the 40.** Printed \`—\` and flagged. The owners need to say which of these listings already have a paying buyer.
2. **${out.length - priced} live-or-hidden listings have no price** (and so no deposit amount). ${out.filter((o) => o.price === DASH && o.photo === 'yes').length} of them are shown on the live site today with no price and no deposit line.
3. **Two listings share one record id** (\`os-8f1f496d\`, listing IDs 98417 and 25655, Miniature Dachshund girl and boy). The sync derives the id from the photo URL, and both rows point at the same photo. Both cards render on the live mini-dachshund page with the same \`data-wa-source\`, so GA4 cannot tell them apart.
4. **The data is 43 days old.** \`npm run sync:overseas\` has not run since ${feed.syncedAt.slice(0, 10)}. Some of these puppies may be sold at source; the file cannot say which.
`;

writeFileSync(path.join(ROOT, 'reports', 'k136-au-inventory-2026-11-14.md'), md);
writeFileSync(path.join(ROOT, 'reports', 'k136-au-inventory-2026-11-14.csv'), csv);
console.log(`rows ${out.length}, priced ${priced}, photo ${withPhoto}, price sum ${sumPrice}, deposit sum ${sumDeposit}`);
