import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeArrival, addMonths, parseDate } from '../lib/arrival.mjs';

const today = '2026-11-13';

test('DOB 2026-08-28 gives 2026-11-28, month 2026-11, basis dob (no floor)', () => {
  const a = computeArrival({ dob: '2026-08-28', listingDate: '2026-11-01', today });
  assert.equal(a.date, '2026-11-28');
  assert.equal(a.month, '2026-11');
  assert.equal(a.basis, 'dob');
  assert.equal(a.past, false);
});

test("no DOB, age '8 weeks', listing 2026-11-01 gives DOB 2026-09-06 and month 2026-12, basis age", () => {
  const a = computeArrival({ ageRaw: '8 weeks', listingDate: '2026-11-01', today });
  assert.equal(a.dob, '2026-09-06');
  assert.equal(a.month, '2026-12');
  assert.equal(a.basis, 'age');
  assert.equal(a.needsReview, false);
});

test('neither DOB nor age gives basis listing-date and needsReview for the caller', () => {
  const a = computeArrival({ listingDate: '2026-11-01', today });
  assert.equal(a.basis, 'listing-date');
  assert.equal(a.month, '2027-02');
  assert.equal(a.needsReview, true);
});

test("display says 'subject to import approval' and never shows a day number", () => {
  const cases = [
    computeArrival({ dob: '2026-08-28', listingDate: '2026-11-01', today }),
    computeArrival({ ageRaw: '8 weeks', listingDate: '2026-11-01', today }),
    computeArrival({ listingDate: '2026-11-01', today }),
    computeArrival({ dob: '2026-06-01', listingDate: '2026-11-01', today }), // base already past
  ];
  for (const a of cases) {
    assert.match(a.display, /subject to import approval/);
    assert.doesNotMatch(a.display.replace(/\b\d{4}\b/g, ''), /\d/, a.display);
    assert.doesNotMatch(a.display, /guarantee|confirmed/i);
  }
});

test('base already past: no floor, no maximum wait, flies when paperwork is ready', () => {
  const a = computeArrival({ dob: '2026-06-01', listingDate: '2026-11-01', today });
  assert.equal(a.date, '2026-09-01');
  assert.equal(a.past, true);
  assert.match(a.display, /paperwork and flight/);
});

test('date helpers: Irish DD/MM/YYYY, month-end clamp', () => {
  assert.equal(parseDate('06/09/2026').toISOString().slice(0, 10), '2026-09-06');
  assert.equal(parseDate('September 6, 2026').toISOString().slice(0, 10), '2026-09-06');
  assert.equal(addMonths(parseDate('2026-11-30'), 3).toISOString().slice(0, 10), '2027-02-28');
});
