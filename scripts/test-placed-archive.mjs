// Unit tests for the placed-archive rules (scripts/lib/placed-archive.mjs).
// Usage: npm run test:archive   (no network, no files written)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  RETENTION_DAYS,
  archiveFile,
  archivePhotos,
  classify,
  isExpired,
  needsOverlayCheck,
  recordDepartures,
} from './lib/placed-archive.mjs';
import { pupPageSlug } from '../src/lib/pup-slug.mjs';

const pup = (id, extra = {}) => ({
  id,
  name: null,
  color: 'Apricot',
  gender: 'Female',
  age: '3 months',
  price: 3888,
  image: `${id}-1-abcd1234.webp`,
  location: 'Balestier Area',
  bookHref: `https://cal.com/x?puppyid=${id}`,
  ...extra,
});
const feed = (syncedAt, breeds) => ({
  syncedAt,
  breeds: Object.fromEntries(Object.entries(breeds).map(([b, ids]) => [b, { available: ids.map((id) => pup(id)), recentlyPlaced: [] }])),
});
const TODAY = '2026-10-14';

test('a puppy the last feed listed and this run does not is recorded once, without price or booking link', () => {
  const prevFeed = feed('2026-10-13T06:30:00Z', { maltipoo: [2939, 2940] });
  const { archived, departures } = recordDepartures({ archive: null, prevFeed, listedNow: new Set(['2940']), today: TODAY });
  assert.deepEqual(departures, ['2939']);
  const a = archived.get('2939');
  assert.equal(a.breed, 'maltipoo');
  assert.equal(a.placedAt, TODAY);
  assert.equal(a.lastListed, '2026-10-13'); // 06:30 UTC is 14:30 SGT the same day
  assert.equal(a.status, null);
  assert.equal(a.source, 'sync');
  assert.ok(!('price' in a) && !('bookHref' in a) && !('location' in a));
});

test('a sale hand-edited out of available-puppies.json is still seen leaving, via lastSync.listed', () => {
  const archive = { pups: [], lastSync: { at: '2026-10-12T06:30:00Z', listed: [{ ...pup(2939), breed: 'cavapoo' }] } };
  const prevFeed = feed('2026-10-12T06:30:00Z', { cavapoo: [] }); // 2939 removed by hand
  const { archived, departures } = recordDepartures({ archive, prevFeed, listedNow: new Set(), today: TODAY });
  assert.deepEqual(departures, ['2939']);
  assert.equal(archived.get('2939').breed, 'cavapoo');
  assert.equal(archived.get('2939').lastListed, '2026-10-12');
});

test('re-running the same day changes nothing, and the first date sticks', () => {
  const prevFeed = feed('2026-10-13T06:30:00Z', { maltipoo: [2939] });
  const first = recordDepartures({ archive: null, prevFeed, listedNow: new Set(), today: TODAY });
  const archive = archiveFile({ archived: first.archived, breeds: {}, now: '2026-10-14T06:30:00Z' });
  const second = recordDepartures({ archive, prevFeed, listedNow: new Set(), today: '2026-10-15' });
  assert.deepEqual(second.departures, []);
  assert.equal(second.archived.size, 1);
  assert.equal(second.archived.get('2939').placedAt, TODAY);
});

test('a puppy listed again leaves the archive', () => {
  const archive = { pups: [{ id: 2939, breed: 'maltipoo', status: 'placed', placedAt: '2026-10-10' }] };
  const { archived } = recordDepartures({ archive, prevFeed: null, listedNow: new Set(['2939']), today: TODAY });
  assert.equal(archived.size, 0);
});

test(`retention: expired after ${RETENTION_DAYS} days, not on the day itself`, () => {
  assert.equal(isExpired({ placedAt: '2026-06-16', status: 'placed' }, TODAY), false); // exactly 120
  assert.equal(isExpired({ placedAt: '2026-06-15', status: 'placed' }, TODAY), true); // 121
  assert.equal(isExpired({ placedAt: '2026-10-01', status: 'expired' }, TODAY), true); // stays expired
});

test('classify: only an owner override or the sheet overlay counts as sold', () => {
  const manualSold = new Set([2939]);
  const balestier = (r) => r.location === 'Balestier Area';
  const row = (extra = {}) => ({ id: 1, location: 'Balestier Area', images: ['https://img/1.jpg'], ...extra });
  const c = (id, r, overlaid, previous) => classify({ id, row: r, manualSold, locationAllowed: balestier, overlaid, previous });

  assert.deepEqual(c('2939', undefined, undefined), { evidence: 'sold-override', status: 'placed' });
  assert.deepEqual(c('1', undefined, undefined), { evidence: 'not-in-sheet', status: 'withdrawn' });
  assert.deepEqual(c('1', row({ location: 'Choa Chu Kang' }), true), { evidence: 'out-of-area', status: 'withdrawn' });
  assert.deepEqual(c('1', row({ images: [] }), undefined), { evidence: 'no-photo', status: 'withdrawn' });
  assert.deepEqual(c('1', row(), true), { evidence: 'sold-overlay', status: 'placed' });
  assert.deepEqual(c('1', row(), false), { evidence: 'no-overlay', status: 'withdrawn' });
  // A failed overlay check keeps the last verdict, and proves nothing on its own.
  assert.deepEqual(c('1', row(), undefined, 'sold-overlay'), { evidence: 'sold-overlay', status: 'placed' });
  assert.deepEqual(c('1', row(), undefined), { evidence: 'check-failed', status: 'withdrawn' });

  assert.equal(needsOverlayCheck({ id: '2939', row: row(), manualSold, locationAllowed: balestier }), false);
  assert.equal(needsOverlayCheck({ id: '1', row: row(), manualSold, locationAllowed: balestier }), true);
  assert.equal(needsOverlayCheck({ id: '1', row: row({ location: 'Choa Chu Kang' }), manualSold, locationAllowed: balestier }), false);
});

test('the archive file is newest first and its listing snapshot carries no price', () => {
  const archived = new Map([
    ['1', { id: 1, placedAt: '2026-09-01', status: 'placed', image: 'a.webp' }],
    ['3', { id: 3, placedAt: '2026-10-01', status: 'withdrawn', image: 'b.webp' }],
    ['2', { id: 2, placedAt: '2026-10-01', status: 'expired', image: null }],
  ]);
  const out = archiveFile({ archived, breeds: { maltese: { available: [pup(2940)] } }, now: '2026-10-14T06:30:00Z' });
  assert.deepEqual(out.pups.map((p) => p.id), [3, 2, 1]);
  assert.equal(out.lastSync.listed[0].breed, 'maltese');
  assert.ok(!('price' in out.lastSync.listed[0]));
  assert.deepEqual(archivePhotos(out.pups), ['b.webp', 'a.webp']); // expired needs no photo
});

test('the page slug is the one the site has always served', () => {
  assert.equal(pupPageSlug({ id: 2939, color: 'Apricot', gender: 'Female' }), '2939-apricot-girl');
  assert.equal(pupPageSlug({ id: 2918, color: 'Premium Chocolate Liver', gender: 'Male' }), '2918-premium-chocolate-liver-boy');
  assert.equal(pupPageSlug({ id: 7, color: null, gender: null }), '7-puppy');
});
