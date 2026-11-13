import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computePrice } from '../lib/price.mjs';

test('€500 gives 4500 / 2250 / 2250', () => {
  const p = computePrice({ priceRaw: '€500' });
  assert.deepEqual([p.priceSGD, p.depositSGD, p.balanceSGD], [4500, 2250, 2250]);
  assert.deepEqual(p.review, []);
});

test("'€1,200.00 (Negotiable)' gives 5200 with negotiable:true", () => {
  const p = computePrice({ priceRaw: '€1,200.00 (Negotiable)' });
  assert.equal(p.priceSGD, 5200);
  assert.equal(p.negotiable, true);
  assert.deepEqual(p.review, []);
});

test("'POA', '£450', '€1234', '€100' and '€4500' each return a review reason", () => {
  const expect = { 'POA': 'price-unparsed', '£450': 'currency-gbp', '€1234': 'price-placeholder', '€100': 'price-out-of-band', '€4500': 'price-out-of-band' };
  for (const [raw, reason] of Object.entries(expect)) {
    const p = computePrice({ priceRaw: raw });
    assert.ok(p.review.includes(reason), `${raw}: ${p.review}`);
  }
  assert.equal(computePrice({ priceRaw: 'POA' }).priceSGD, null);
});

test('per-puppy prices [650, 700] give 4650 with from:true', () => {
  const p = computePrice({ priceRaw: '€650', puppyPrices: [650, 700] });
  assert.equal(p.priceSGD, 4650);
  assert.equal(p.from, true);
  assert.equal(computePrice({ priceRaw: '€650', puppyPrices: [650, 650] }).from, false);
});

test('numeric price with a currency hint; "/ Negotiable" and "offers" wording', () => {
  assert.equal(computePrice({ priceRaw: 690, currency: 'EUR' }).priceSGD, 4690);
  assert.equal(computePrice({ priceRaw: '€450 / Negotiable' }).negotiable, true);
  assert.ok(computePrice({ priceRaw: '€500 or nearest offers' }).review.includes('price-unparsed'));
  assert.ok(computePrice({ priceRaw: '500' }).review.includes('currency-unknown'));
});

test('margin is flat S$4,000 (D2b), no FX', () => {
  for (const n of [150, 777, 4000]) assert.equal(computePrice({ priceRaw: n, currency: 'EUR' }).priceSGD, n + 4000);
});
