// K-129: the slug-id precision rule in the leak scanner. A dfsi listing id made only
// of breed and puppy words is not word-matched; everything else stays denylisted.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDenylist, scanText, isGenericSlugId } from '../lib/leaks.mjs';

const dfsi = (listingId, extra = {}) => ({
  key: `dfsi:${listingId}`, supplier: 'dfsi', listingId,
  sourceUrl: `https://www.dogsforsaleireland.ie/ad/${listingId}/`, seller: {}, ...extra,
});
const kinds = (html, records) => scanText(html, buildDenylist({ records }), { label: 't' }).map((h) => h.kind);

test('dfsi:labradoodles passes: the shop may write "labradoodles" on its labradoodle page', () => {
  assert.equal(isGenericSlugId('dfsi', 'labradoodles'), true);
  assert.ok(!kinds('<p>Are labradoodles hypoallergenic?</p>', [dfsi('labradoodles')]).includes('listing-id'));
});

test('dfsi:male-pug passes: the shop\'s own pug photo filename is not a leak', () => {
  assert.equal(isGenericSlugId('dfsi', 'male-pug'), true);
  assert.ok(!kinds('/_astro/7-fawn-male-pug-puppy-available-in-singapore.BmOUE4C6.webp', [dfsi('male-pug')]).includes('listing-id'));
});

test('dfsi:antoinette-moore still fails: a slug with a name is a leak', () => {
  assert.equal(isGenericSlugId('dfsi', 'antoinette-moore'), false);
  assert.ok(kinds('<p>antoinette-moore</p>', [dfsi('antoinette-moore')]).includes('listing-id'));
});

test('dfsi:labradoodle-moore still fails: a breed word mixed with a name is a leak', () => {
  assert.equal(isGenericSlugId('dfsi', 'labradoodle-moore'), false);
  assert.ok(kinds('<p>see labradoodle-moore</p>', [dfsi('labradoodle-moore')]).includes('listing-id'));
});

test('the full source URL of a vocabulary-shaped slug is still denylisted', () => {
  const hits = kinds('<a href="https://www.dogsforsaleireland.ie/ad/labradoodles/">x</a>', [dfsi('labradoodles')]);
  assert.ok(hits.includes('source-url') || hits.includes('supplier-token'), hits.join(','));
  const deny = buildDenylist({ records: [dfsi('labradoodles')] });
  assert.ok([...deny.urls.keys()].some((u) => u.includes('/ad/labradoodles')));
});

test('a vocabulary-shaped seller NAME is still caught (the exception is listing-id only)', () => {
  const rec = dfsi('male-pug', { seller: { name: 'Pug Male' } });
  assert.ok(kinds('<p>Bred by Pug Male</p>', [rec]).includes('seller-name'));
});

test('the exception is limited to slug suppliers and digit-free ids', () => {
  assert.equal(isGenericSlugId('dogsy', 'labradoodles'), false);
  assert.equal(isGenericSlugId('dfsi', 'labradoodles-2'), false);
  assert.equal(isGenericSlugId('dfsi', ''), false);
  const dogsyRec = { key: 'dogsy:labradoodles', supplier: 'dogsy', listingId: 'labradoodles', seller: {} };
  assert.ok(kinds('<p>labradoodles</p>', [dogsyRec]).includes('listing-id'));
});
