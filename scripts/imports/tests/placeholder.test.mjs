// K-129: a placeholder seller identifier ("NULL", "N/A") never enters the store.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanId, isPlaceholder, dropPlaceholderSellerFields } from '../lib/source-record.mjs';

test('isPlaceholder: the words suppliers print for an empty field', () => {
  for (const v of ['NULL', 'null', ' Null ', 'undefined', '$undefined', 'None', 'N/A', 'n/a', 'NA', 'TBC', 'unknown', '-', '---', '...', '0'])
    assert.equal(isPlaceholder(v), true, v);
  for (const v of ['IE123456', 'B-2041', 'Nullarbor Kennels', 'NA12345', '10'])
    assert.equal(isPlaceholder(v), false, v);
  assert.equal(isPlaceholder(null), false);
});

test('cleanId: placeholders and blanks become null, real ids are trimmed', () => {
  assert.equal(cleanId('NULL'), null);
  assert.equal(cleanId('  '), null);
  assert.equal(cleanId(undefined), null);
  assert.equal(cleanId(' IE123456 '), 'IE123456');
});

test('dropPlaceholderSellerFields: removes placeholder regNo/vet/type, keeps the rest', () => {
  const rec = { seller: { name: 'Test Seller', phone: '+353000000000', regNo: 'NULL', vet: 'n/a', type: 'Breeder' } };
  assert.deepEqual(dropPlaceholderSellerFields(rec), ['regNo', 'vet']);
  assert.deepEqual(rec.seller, { name: 'Test Seller', phone: '+353000000000', type: 'Breeder' });
  assert.deepEqual(dropPlaceholderSellerFields({}), []);
});
