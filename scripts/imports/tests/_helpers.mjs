// Shared test helpers for the adapter tests. Not a test file (no .test. in the name).
//
// No test makes a live request: every adapter test drives the real http client
// (robots, spacing, block detection) over an in-memory fetch.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHttp } from '../lib/http.mjs';
import { resolvePrivateDir } from '../lib/store.mjs';

// Fake clock: sleep advances time instantly.
export function fakeClock(start = Date.UTC(2026, 10, 13, 6, 15, 0)) {
  let t = start;
  return { now: () => t, sleep: async (ms) => { t += ms; } };
}

// routes: { 'https://host/path?query': spec | (n) => spec }, matched on the full URL.
// Unknown URLs → 404. Every network call is recorded in fn.calls.
export function mockFetch(routes) {
  const calls = [];
  const fn = async (url) => {
    calls.push(url);
    const r = routes[url] ?? { status: 404, body: 'not found' };
    const spec = typeof r === 'function' ? r(calls.length) : r;
    const body = typeof spec.body === 'string' ? spec.body : JSON.stringify(spec.body ?? '');
    return new Response(body, { status: spec.status ?? 200, headers: spec.headers ?? {} });
  };
  fn.calls = calls;
  return fn;
}

export function testHttp(routes, opts = {}) {
  const clock = fakeClock();
  const fetchImpl = mockFetch(routes);
  const http = createHttp({ fetchImpl, now: clock.now, sleep: clock.sleep, ...opts });
  return { http, fetchImpl, clock };
}

// Real sampled pages live only in IMPORTS_PRIVATE_DIR/fixtures/<supplier>/ (spec §6.1),
// never in the repo. Returns [] when the private store or folder is absent.
export function privateFixtures(supplier, ext = null) {
  let dir;
  try { dir = join(resolvePrivateDir(), 'fixtures', supplier); } catch { return []; }
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => !ext || f.endsWith(ext))
    .sort()
    .map((f) => ({ name: f, path: join(dir, f), body: readFileSync(join(dir, f), 'utf8') }));
}

export const NOW = () => new Date(Date.UTC(2026, 10, 13, 6, 15, 0));
