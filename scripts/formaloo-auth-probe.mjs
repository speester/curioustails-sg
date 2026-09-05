#!/usr/bin/env node
/**
 * formaloo-auth-probe.mjs — the ONLY sanctioned second opinion on "are the Formaloo credentials
 * dead?". Needs no project, no provisioned form, no config. Mints a token through the shipped
 * module (variant A then B, browser UA, api.formaloo.me) and reads the account's form list back.
 *
 *   node scripts/formaloo-auth-probe.mjs
 *
 * Exit 0 = the key/secret pair is GOOD; any earlier `invalid_client` / `1010` was the caller's
 * request shape, not the account. Exit 1 = the pair really is rejected — only then may a run
 * fall back to FORM_MODE: embed or defer Stage 1.5.
 */
import { token, creds, FACTS, BASE } from './formaloo-api.mjs';

const { key, secret } = creds();
if (!key || !secret) {
  console.error('FAIL: FORMALOO_API_KEY / FORMALOO_API_SECRET not resolvable (~/.claude/.env).');
  process.exit(1);
}
console.log(`key   ${key.slice(0, 6)}…${key.slice(-4)} (len ${key.length})`);
console.log(`secret …${secret.slice(-4)} (len ${secret.length})`);

let jwt;
try {
  jwt = await token();
} catch (e) {
  console.error(`FAIL: ${e.message}`);
  console.error('Before blaming the account, check the request shape: RAW secret in ' +
                '`Authorization: Basic` (never base64(key:secret)), an `x-api-key` header, a ' +
                'multipart (not JSON) body, host api.formaloo.me, and a browser User-Agent.');
  process.exit(1);
}
console.log(`token OK (variant ${FACTS.auth_variant}, expires ~30s)`);

const r = await fetch(`${BASE}/forms/`, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    'x-api-key': key,
    Authorization: `JWT ${jwt}`,
  },
});
const body = await r.json().catch(() => null);
if (!r.ok) {
  console.error(`FAIL: GET /forms/ HTTP ${r.status}`);
  process.exit(1);
}
console.log(`GET /forms/ 200 — ${body?.data?.count ?? '?'} forms on the account`);
console.log('PASS: credentials are good.');
process.exit(0);
