// Fails loudly when src/data/available-puppies.json has gone stale.
// The breed pages' Product schema derives availability from that file, so a
// stale feed means the site is making an availability claim it cannot support.
// Audited 2026-08-20: the feed was 21 days old and 34 of 48 breed pages were
// advertising InStock with an empty available[] array.
import { readFile } from 'node:fs/promises';

const MAX_AGE_DAYS = Number(process.env.FEED_MAX_AGE_DAYS ?? 4);
const FEED = new URL('../src/data/available-puppies.json', import.meta.url);

const { syncedAt, breeds } = JSON.parse(await readFile(FEED, 'utf8'));
const ageDays = (Date.now() - Date.parse(syncedAt)) / 86_400_000;
const inStock = Object.values(breeds).filter((b) => b.available.length > 0).length;

console.log(
  `feed synced ${ageDays.toFixed(1)} days ago · ${inStock}/${Object.keys(breeds).length} breeds in stock`,
);

if (ageDays > MAX_AGE_DAYS) {
  console.error(
    `\nSTALE FEED: ${ageDays.toFixed(1)} days old (limit ${MAX_AGE_DAYS}).\n` +
      `Run \`npm run sync:puppies\` before deploying, or the availability schema will lie.\n`,
  );
  process.exit(1);
}
