import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicIds, idFromHash, refFromHash } from '../lib/hash.mjs';

const secretA = Buffer.alloc(32, 1);
const secretB = Buffer.alloc(32, 2);

test('same input gives the same id', () => {
  assert.deepEqual(publicIds(secretA, 'dogsy', '12345'), publicIds(secretA, 'dogsy', '12345'));
});

test('the HMAC construction is pinned to a known vector', () => {
  // Independently computed: HMAC-SHA256('curious-tails-test-secret', 'dogsy:12345').
  const secret = Buffer.from('curious-tails-test-secret');
  const hash = '7d36983afd00652a8db94e44a92bb533606936aae070d40ac5eb32716386433c';
  assert.deepEqual(publicIds(secret, 'dogsy', '12345'), {
    sourceHash: hash,
    id: 'imp-7d36983afd',
    ref: 'CT-IE-7D3698',
  });
  assert.equal(idFromHash(hash), 'imp-7d36983afd');
  assert.equal(refFromHash(hash), 'CT-IE-7D3698');
  // Both halves of `${supplier}:${listingId}` change the hash.
  assert.notEqual(publicIds(secret, 'dogsy', '12346').sourceHash, hash);
  assert.notEqual(publicIds(secret, 'dogquest', '12345').sourceHash, hash);
});

test('a different secret gives a different id', () => {
  assert.notEqual(publicIds(secretA, 'dogsy', '12345').id, publicIds(secretB, 'dogsy', '12345').id);
});

test('id and ref have the public shape and contain no supplier text', () => {
  for (const supplier of ['dogsy', 'dogquest', 'dfsi', 'dogsie']) {
    const { id, ref, sourceHash } = publicIds(secretA, supplier, 'jack-russell-pups-kildare');
    assert.match(id, /^imp-[0-9a-f]{10}$/);
    assert.match(ref, /^CT-IE-[0-9A-F]{6}$/);
    assert.match(sourceHash, /^[0-9a-f]{64}$/);
    for (const s of [id, ref]) {
      assert.ok(!s.toLowerCase().includes(supplier), `${s} leaks ${supplier}`);
      assert.ok(!/jack|russell|kildare/i.test(s));
    }
  }
});

test('a missing secret is refused', () => {
  assert.throws(() => publicIds(Buffer.alloc(0), 'dogsy', '1'));
});
