// Public ids for imported listings (spec §2.2).
// sourceHash = HMAC-SHA256(secret.key, `${supplier}:${listingId}`), so the id
// can't be reversed to a supplier or listing without the private secret.
import { createHmac } from 'node:crypto';

export function sourceHash(secret, supplier, listingId) {
  if (!secret || !secret.length) throw new Error('sourceHash: secret is required');
  return createHmac('sha256', secret).update(`${supplier}:${listingId}`).digest('hex');
}

export const idFromHash = (hex) => 'imp-' + hex.slice(0, 10);
export const refFromHash = (hex) => 'CT-IE-' + hex.slice(0, 6).toUpperCase();

export function publicIds(secret, supplier, listingId) {
  const hash = sourceHash(secret, supplier, listingId);
  return { sourceHash: hash, id: idFromHash(hash), ref: refFromHash(hash) };
}
