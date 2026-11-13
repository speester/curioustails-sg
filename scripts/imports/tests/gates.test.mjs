import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateGates, GATE_ORDER, ageWeeks, autopublishEnabled } from '../lib/gates.mjs';

const NOW = new Date('2026-11-13T06:15:00Z');
const CHIPS = ['372112345678901', '372112345678902', '372112345678903'];

function clean(over = {}) {
  return {
    key: 'dogsy:clean-1',
    supplier: 'dogsy',
    viaSite: 'irishpuppies.ie',
    listingId: 'clean-1',
    sourceUrl: 'https://example.invalid/clean-1',
    fetchedAt: '2026-11-13T06:00:00.000Z',
    firstSeenAt: '2026-11-01T00:00:00.000Z',
    lastSeenAt: '2026-11-13T06:00:00.000Z',
    sourcePublishedAt: '2026-11-01T00:00:00.000Z',
    title: 'Beautiful Jack Russell Terrier puppies',
    descriptionRaw: 'Healthy Jack Russell Terrier puppies, wormed, vaccinated and microchipped, looking for loving homes.',
    breedRaw: 'Jack Russell Terrier',
    priceRaw: '€550',
    priceNumber: 550,
    currency: 'EUR',
    dob: '2026-09-04',
    ageRaw: '10 weeks',
    maleCount: 2,
    femaleCount: 1,
    puppies: CHIPS.map((microchip) => ({ sex: 'M', colour: 'Tan & White', price: 550, microchip, chipVerified: null, status: 'For Sale' })),
    county: 'Kildare',
    town: 'Naas',
    countryOfOrigin: 'Ireland',
    imageSourceUrls: ['https://example.invalid/a.jpg', 'https://example.invalid/b.jpg', 'https://example.invalid/c.jpg'],
    images: [
      { filename: 'imp-aaaaaaaaaa-1.webp', cardFilename: 'imp-aaaaaaaaaa-1-card.webp', dhash: '0000000000000001' },
      { filename: 'imp-aaaaaaaaaa-2.webp', cardFilename: 'imp-aaaaaaaaaa-2-card.webp', dhash: '1111111111111111' },
      { filename: 'imp-aaaaaaaaaa-3.webp', cardFilename: 'imp-aaaaaaaaaa-3-card.webp', dhash: '2222222222222222' },
    ],
    flags: { wormed: true, vaccinated: true },
    sourceStatus: 'live',
    status: null,
    reviewReasons: [],
    ...over,
  };
}

const byGate = (out, id) => out.gates.find((g) => g.gate === id);

test('all fifteen gates are always reported', () => {
  const out = evaluateGates({ record: clean(), now: NOW, env: {} });
  assert.deepEqual(out.gates.map((g) => g.gate), GATE_ORDER);
  assert.equal(out.gates.length, 15);
});

test('an XL bully title is rejected (G8)', () => {
  const r = clean({ title: 'Gorgeous XL Bully pups', breedRaw: 'XL Bully' });
  const out = evaluateGates({ record: r, now: NOW, env: {} });
  assert.equal(byGate(out, 'G8').pass, false);
  assert.equal(byGate(out, 'G8').severity, 'reject');
  assert.equal(out.decision, 'reject');
  assert.equal(out.disposition, 'reject');
});

test('a German Shepherd goes to review (G9), never auto-publishes', () => {
  const r = clean({ breedRaw: 'German Shepherd', title: 'German Shepherd puppies' });
  const out = evaluateGates({ record: r, now: NOW, env: { IMPORTS_AUTOPUBLISH: '1' } });
  assert.equal(byGate(out, 'G9').pass, false);
  assert.equal(byGate(out, 'G9').severity, 'review');
  assert.equal(out.decision, 'review');
  assert.equal(out.disposition, 'review');
});

test('age 22 weeks is rejected (G4)', () => {
  const r = clean({ dob: '2026-06-12', ageRaw: '22 weeks' });
  assert.equal(Math.floor(ageWeeks(r, NOW)), 22);
  const out = evaluateGates({ record: r, now: NOW, env: {} });
  assert.equal(byGate(out, 'G4').pass, false);
  assert.equal(byGate(out, 'G4').severity, 'reject');
  assert.equal(out.decision, 'reject');
});

test('no microchip goes to review (G10)', () => {
  const r = clean({ puppies: [{ microchip: null, colour: 'Tan & White', status: 'For Sale' }] });
  const out = evaluateGates({ record: r, now: NOW, env: {} });
  assert.equal(byGate(out, 'G10').pass, false);
  assert.equal(byGate(out, 'G10').severity, 'review');
  assert.equal(out.decision, 'review');
});

test('"pups sometimes available" goes to review (G12)', () => {
  const r = clean({ descriptionRaw: 'Healthy Jack Russell Terrier puppies, wormed and vaccinated. Pups sometimes available.' });
  const out = evaluateGates({ record: r, now: NOW, env: {} });
  assert.equal(byGate(out, 'G12').pass, false);
  assert.equal(byGate(out, 'G12').severity, 'review');
  assert.equal(out.decision, 'review');
});

test('"stud" is rejected by G12', () => {
  const r = clean({ title: 'Stud service Jack Russell Terrier' });
  const out = evaluateGates({ record: r, now: NOW, env: {} });
  assert.equal(byGate(out, 'G12').pass, false);
  assert.equal(byGate(out, 'G12').severity, 'reject');
  assert.equal(out.decision, 'reject');
});

test('"£450" goes to review (G3 currency-gbp)', () => {
  const r = clean({ priceRaw: '£450', priceNumber: 450, currency: 'GBP' });
  const out = evaluateGates({ record: r, now: NOW, env: {} });
  assert.equal(byGate(out, 'G3').pass, false);
  assert.equal(byGate(out, 'G3').severity, 'review');
  assert.equal(out.decision, 'review');
});

test('a clean JRT 10 weeks with 3 photos and 3 chips passes', () => {
  const out = evaluateGates({ record: clean(), now: NOW, env: {} });
  assert.equal(out.gates.every((g) => g.pass), true, JSON.stringify(out.gates.filter((g) => !g.pass)));
  assert.equal(out.decision, 'pass');
  assert.equal(out.breed.slug, 'jack-russell-terrier');
  assert.equal(out.hdbApproved, true);
});

test('with IMPORTS_AUTOPUBLISH unset the clean fixture is auto-ready, not published', () => {
  const out = evaluateGates({ record: clean(), now: NOW, env: {} });
  assert.equal(out.disposition, 'auto-ready');
  assert.notEqual(out.status, 'published');
  assert.equal(autopublishEnabled({}), false);
});

test('IMPORTS_AUTOPUBLISH=1 makes a clean item publishable', () => {
  const out = evaluateGates({ record: clean(), now: NOW, env: { IMPORTS_AUTOPUBLISH: '1' } });
  assert.equal(out.disposition, 'publish');
});

test('dfsi and puppies.ie stay lead-only even with autopublish on', () => {
  const dfsi = evaluateGates({
    record: clean({ supplier: 'dfsi', key: 'dfsi:x', listingId: 'x', status: 'review', reviewReasons: ['lead-only'] }),
    now: NOW, env: { IMPORTS_AUTOPUBLISH: '1' },
  });
  assert.equal(dfsi.disposition, 'review');
  assert.equal(byGate(dfsi, 'G14').pass, false);

  const dogsie = evaluateGates({
    record: clean({ supplier: 'dogsie', key: 'dogsie:x', listingId: 'x', title: 'Golden Retriever puppies' }),
    now: NOW, env: { IMPORTS_AUTOPUBLISH: '1' },
  });
  assert.equal(dogsie.disposition, 'review');
  assert.equal(byGate(dogsie, 'G14').pass, false);
});

test('an unmapped breed goes to review (G2)', () => {
  const r = clean({ breedRaw: 'Caucasian Shepherd Dog', title: 'Caucasian Shepherd Dog puppies' });
  const out = evaluateGates({ record: r, now: NOW, env: {} });
  assert.equal(byGate(out, 'G2').pass, false);
  assert.equal(out.decision, 'review');
});

test('G15 rejects a public object carrying a supplier key', () => {
  const publicPup = {
    id: 'imp-0000000000', ref: 'CT-IE-000000', breed: 'jack-russell-terrier', breedLabel: 'Jack Russell Terrier',
    supplier: 'dogsy',
  };
  const out = evaluateGates({ record: clean(), publicPup, now: NOW, env: {} });
  assert.equal(byGate(out, 'G15').pass, false);
  assert.equal(byGate(out, 'G15').severity, 'reject');
  assert.equal(out.decision, 'reject');
});

test('dfsi stays lead-only in code: IMPORTS_DFSI_MODE=auto cannot make it publishable', () => {
  // An auto-mode dfsi record carries no review status from the adapter; the
  // gate itself must still hold it (D3: dfsi T&Cs forbid republishing photos).
  const out = evaluateGates({
    record: clean({ supplier: 'dfsi', key: 'dfsi:auto', listingId: 'auto', status: null, reviewReasons: [] }),
    now: NOW, env: { IMPORTS_AUTOPUBLISH: '1', IMPORTS_DFSI_MODE: 'auto' },
  });
  assert.equal(byGate(out, 'G14').pass, false);
  assert.match(byGate(out, 'G14').detail, /lead-only/);
  assert.equal(out.disposition, 'review');
});
