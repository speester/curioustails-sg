import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFeed, buildPublicPup, findLeaks, loadPublicSchema, validateFeed, PUP_KEYS } from '../lib/public.mjs';
import { computePrice } from '../lib/price.mjs';
import { computeArrival } from '../lib/arrival.mjs';

const NOW = new Date('2026-11-13T06:15:00Z');

function fixturePup(over = {}) {
  const record = {
    title: 'Jack Russell Terrier puppies',
    breedRaw: 'Jack Russell Terrier',
    dob: '2026-09-04',
    ageRaw: '10 weeks',
    maleCount: 2,
    femaleCount: 1,
    puppies: [
      { colour: 'Tan & White', price: 550, microchip: '372112345678901' },
      { colour: 'Tan & White', price: 550, microchip: '372112345678902' },
      { colour: 'Tan & White', price: 550, microchip: '372112345678903' },
    ],
    ...over.record,
  };
  return buildPublicPup({
    record,
    breed: { slug: 'jack-russell-terrier', breedLabel: 'Jack Russell Terrier', crossLabel: null, hdbApproved: true },
    price: computePrice({ priceRaw: '€550', currency: 'EUR' }),
    arrival: computeArrival({ dob: record.dob, listingDate: '2026-11-01T00:00:00Z', today: NOW }),
    images: [{ filename: 'imp-7f3a2c91de-1.webp' }, { filename: 'imp-7f3a2c91de-2.webp' }, { filename: 'imp-7f3a2c91de-3.webp' }],
    identity: { id: 'imp-7f3a2c91de', ref: 'CT-IE-7F3A2C', sourceHash: 'a'.repeat(64) },
    now: NOW,
    status: 'published',
    ...over,
  });
}

test('the public feed validates against scripts/imports/public-schema.json', () => {
  const feed = buildFeed([fixturePup()], NOW.toISOString());
  const r = validateFeed(feed);
  assert.deepEqual(r.errors, []);
  assert.equal(r.valid, true);
  assert.equal(loadPublicSchema().additionalProperties, false);
});

test('the public pup has exactly the whitelisted keys, no private field', () => {
  const pup = fixturePup();
  assert.deepEqual(Object.keys(pup), PUP_KEYS);
  for (const banned of ['supplier', 'listingId', 'sourceUrl', 'county', 'town', 'microchip', 'seller', 'priceRaw', 'currency', 'descriptionRaw', 'title']) {
    assert.equal(banned in pup, false, banned);
  }
  assert.equal(findLeaks(pup).length, 0);
});

test('additionalProperties:false rejects an extra supplier field at any level', () => {
  const feed = buildFeed([{ ...fixturePup(), supplier: 'dogsy' }], NOW.toISOString());
  const r = validateFeed(feed);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => /supplier/.test(e.path) && /additional property/.test(e.message)));

  const nested = fixturePup();
  nested.sex = { ...nested.sex, total: 3 };
  const r2 = validateFeed(buildFeed([nested], NOW.toISOString()));
  assert.equal(r2.valid, false);
  assert.ok(r2.errors.some((e) => /sex\.total/.test(e.path)));
});

test('missing required fields fail validation', () => {
  const pup = fixturePup();
  delete pup.ref;
  const r = validateFeed(buildFeed([pup], NOW.toISOString()));
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => /missing required ref/.test(e.message)));
});

test('findLeaks catches a supplier domain, URL, email and microchip', () => {
  assert.ok(findLeaks({ ...fixturePup(), breedLabel: 'Jack Russell Terrier from dogsy.ie' }).some((l) => l.kind === 'supplier-token'));
  assert.ok(findLeaks({ ...fixturePup(), crossLabel: 'See https://dogsy.ie/listing/1' }).some((l) => l.kind === 'url'));
  assert.ok(findLeaks({ ...fixturePup(), photoAlt: ['mail seller@example.com'] }).some((l) => l.kind === 'email'));
  assert.ok(findLeaks({ ...fixturePup(), age: 'chip 372112345678901' }).some((l) => l.kind === 'microchip'));
});
