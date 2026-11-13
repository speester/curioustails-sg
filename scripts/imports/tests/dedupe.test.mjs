import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dedupe, chipsOf, hammingHex, hashesMatch, fuzzyMatch, normaliseSuppressed,
  suppressedReason, selectPrimary, MAX_DOB_DAYS,
} from '../lib/dedupe.mjs';

const CHIP_A = '372112345678901';
const CHIP_B = '372112345678902';
const CHIP_C = '372112345678903';

function rec(over = {}) {
  return {
    key: 'dogsy:1',
    supplier: 'dogsy',
    listingId: '1',
    sourceUrl: 'https://example.invalid/1',
    firstSeenAt: '2026-11-01T00:00:00.000Z',
    lastSeenAt: '2026-11-01T00:00:00.000Z',
    title: 'Jack Russell Terrier puppies',
    descriptionRaw: 'Healthy Jack Russell Terrier puppies, wormed and vaccinated, ready for loving homes.',
    breedRaw: 'Jack Russell Terrier',
    priceRaw: '€500',
    priceNumber: 500,
    currency: 'EUR',
    dob: '2026-09-01',
    maleCount: 1,
    femaleCount: 1,
    county: 'Kildare',
    puppies: [],
    imageSourceUrls: [],
    sourceStatus: 'live',
    ...over,
  };
}

test('two records from different suppliers that share one microchip produce one public pup', () => {
  const a = rec({ key: 'dogsy:1', supplier: 'dogsy', listingId: '1', puppies: [{ microchip: CHIP_A }] });
  const b = rec({
    key: 'dfsi:jrt-pups', supplier: 'dfsi', listingId: 'jrt-pups',
    firstSeenAt: '2026-11-02T00:00:00.000Z', puppies: [{ microchip: CHIP_A }],
  });
  const { groups, rejected } = dedupe([a, b]);
  assert.equal(rejected.length, 0);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].records.length, 2);
  assert.ok(groups[0].matchTypes.includes('microchip'));
  assert.deepEqual(groups[0].chips, [CHIP_A]);
  assert.equal(groups[0].merged, true);
});

test(`records with the same breed, DOB within ${MAX_DOB_DAYS} days, the same county and price within 10% merge`, () => {
  const a = rec({ key: 'dogsy:1', priceNumber: 500 });
  const b = rec({
    key: 'dogquest:uuid-1', supplier: 'dogquest', listingId: 'uuid-1',
    dob: '2026-09-03', priceNumber: 540, firstSeenAt: '2026-11-03T00:00:00.000Z',
  });
  assert.equal(fuzzyMatch(a, b), true);
  const { groups } = dedupe([a, b]);
  assert.equal(groups.length, 1);
  assert.ok(groups[0].matchTypes.includes('fuzzy'));

  // Just outside the 10% price band: no fuzzy match.
  const c = { ...b, key: 'dfsi:x', supplier: 'dfsi', listingId: 'x', priceNumber: 560 };
  assert.equal(fuzzyMatch(a, c), false);
  assert.equal(dedupe([a, c]).groups.length, 2);
});

test('a near-identical image (dHash <= 6) merges, even across different breed labels', () => {
  assert.equal(hammingHex('0000000000000000', '0000000000000003'), 2);
  assert.equal(hammingHex('ffffffffffffffff', '0000000000000000'), 64);
  assert.equal(hashesMatch('0000000000000000', '0000000000000003'), true);
  assert.equal(hashesMatch('0000000000000000', '00000000000000ff'), false);

  const a = rec({ key: 'dogsy:1', images: [{ filename: 'imp-1111111111-1.webp', dhash: '0000000000000000' }] });
  const b = rec({
    key: 'dfsi:other', supplier: 'dfsi', listingId: 'other', breedRaw: 'Chihuahua',
    priceNumber: 900, county: 'Cork', dob: '2025-01-01',
    images: [{ filename: 'imp-2222222222-1.webp', dhash: '0000000000000003' }],
  });
  const { groups } = dedupe([a, b]);
  assert.equal(groups.length, 1);
  assert.ok(groups[0].matchTypes.includes('image'));
});

test('a duplicate of a taken-down item is rejected, not regrouped', () => {
  const registry = normaliseSuppressed([{ key: 'dogsy:1', chips: [CHIP_A], hashes: ['0000000000000000'] }]);
  const byKey = suppressedReason(rec({ key: 'dogsy:1' }), registry);
  assert.equal(byKey, 'duplicate-of-taken-down');

  const live = rec({ key: 'dogsy:2', listingId: '2', puppies: [{ microchip: CHIP_B }] });
  const removed = rec({
    key: 'dfsi:new-listing', supplier: 'dfsi', listingId: 'new-listing',
    puppies: [{ microchip: CHIP_A }],
  });
  const { groups, rejected } = dedupe([live, removed], { suppressed: [{ key: 'dogsy:1', chips: [CHIP_A] }] });
  assert.equal(groups.length, 1, 'the live record still groups');
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].record.key, 'dfsi:new-listing');
  assert.equal(rejected[0].reason, 'duplicate-of-taken-down');
});

test('merge policy: most chips, then most photos, then earliest seen; identity stays earliest', () => {
  const early = rec({
    key: 'dogsy:1', firstSeenAt: '2026-10-01T00:00:00.000Z',
    puppies: [{ microchip: CHIP_A }], imageSourceUrls: ['https://example.invalid/1.jpg'],
  });
  const rich = rec({
    key: 'dfsi:rich', supplier: 'dfsi', listingId: 'rich', firstSeenAt: '2026-11-05T00:00:00.000Z',
    puppies: [{ microchip: CHIP_A }, { microchip: CHIP_B }],
    imageSourceUrls: ['https://example.invalid/a.jpg', 'https://example.invalid/b.jpg'],
  });
  const group = dedupe([rich, early]).groups[0];
  assert.equal(group.records.length, 2);
  assert.equal(group.primary.key, 'dfsi:rich', 'most microchips wins');
  assert.equal(group.identity.key, 'dogsy:1', 'earliest seen is the public identity');
  assert.equal(selectPrimary(group.records).key, 'dfsi:rich');
});

test('chipsOf reads only 15-digit microchip fields', () => {
  assert.deepEqual(chipsOf(rec({ puppies: [{ microchip: CHIP_C }, { microchip: null }] })), [CHIP_C]);
  assert.deepEqual(chipsOf(rec({ puppies: [], title: 'chip 372112345678909' })), []);
});
