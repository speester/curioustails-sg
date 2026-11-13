import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHttp, parseRobots, robotsAllows, USER_AGENT } from '../lib/http.mjs';

// Fake clock: sleep advances time instantly, so spacing is asserted without waiting.
function fakeClock(start = Date.UTC(2026, 10, 13, 0, 0, 0)) {
  let t = start;
  return { now: () => t, sleep: async (ms) => { t += ms; }, advance: (ms) => { t += ms; } };
}

// In-memory fetch that records every network call.
function mockFetch(routes) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, ua: init?.headers?.['User-Agent'] });
    const u = new URL(url);
    const r = routes[u.pathname + u.search] ?? routes[u.pathname] ?? { status: 404, body: 'not found' };
    const spec = typeof r === 'function' ? r(calls.length) : r;
    return new Response(spec.body ?? '', { status: spec.status ?? 200, headers: spec.headers ?? {} });
  };
  fn.calls = calls;
  return fn;
}

function listen(handler) {
  return new Promise((resolve) => {
    const server = createServer(handler);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

test('mock server: a robots-disallowed path is never requested', async () => {
  const hits = [];
  const server = await listen((req, res) => {
    hits.push(req.url);
    if (req.url === '/robots.txt') return res.end('User-agent: *\nDisallow: /dogs-for-sale?*\nDisallow: /admin/\n');
    res.end('ok');
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const clock = fakeClock();
  const http = createHttp({ now: clock.now, sleep: clock.sleep });
  try {
    const a = await http.get(`${base}/dogs-for-sale?page=2`, { kind: 'discover' });
    const b = await http.get(`${base}/admin/x`);
    const c = await http.get(`${base}/dogs-for-sale/123-jrt.html`, { kind: 'detail' });
    assert.equal(a.robotsDisallowed, true);
    assert.equal(b.robotsDisallowed, true);
    assert.equal(c.ok, true);
    assert.deepEqual(hits, ['/robots.txt', '/dogs-for-sale/123-jrt.html']);
    assert.ok(http.log.some((e) => e.outcome === 'robots-skip' && e.path === '/dogs-for-sale?page=2'));
  } finally {
    server.close();
  }
});

test('two requests to the same host are at least 4 s apart (fake timers)', async () => {
  const clock = fakeClock();
  const f = mockFetch({ '/robots.txt': { body: '' }, '/a': { body: 'a' }, '/b': { body: 'b' }, '/c': { body: 'c' } });
  const stamps = [];
  const http = createHttp({ fetchImpl: async (u, i) => { stamps.push({ host: new URL(u).host, t: clock.now() }); return f(u, i); }, now: clock.now, sleep: clock.sleep });
  await http.get('https://one.example/a');
  await http.get('https://one.example/b');
  await http.get('https://two.example/a');
  await http.get('https://one.example/c');
  const one = stamps.filter((s) => s.host === 'one.example').map((s) => s.t);
  assert.equal(one.length, 4); // robots + a + b + c
  for (let i = 1; i < one.length; i++) assert.ok(one[i] - one[i - 1] >= 4000, `gap ${one[i] - one[i - 1]}`);
  assert.ok(f.calls.every((c) => c.ua === USER_AGENT));
});

test('a 403 Cloudflare body marks the host blocked; later calls make no network call', async () => {
  const clock = fakeClock();
  const cf = '<html><title>Attention Required! | Cloudflare</title>Sorry, you have been blocked</html>';
  const f = mockFetch({ '/robots.txt': { body: '' }, '/ad/1': { status: 403, body: cf } });
  const alerts = [];
  const http = createHttp({ fetchImpl: f, now: clock.now, sleep: clock.sleep, onEvent: (e) => e.type === 'alert' && alerts.push(e) });
  const first = await http.get('https://blocky.example/ad/1');
  assert.equal(first.blocked, true);
  const before = f.calls.length;
  const second = await http.get('https://blocky.example/ad/2');
  const third = await http.get('https://blocky.example/robots.txt');
  assert.deepEqual([second.blocked, third.blocked], [true, true]);
  assert.equal(f.calls.length, before, 'no network call after block');
  assert.equal(alerts.length, 1);
  assert.ok(http.isBlocked('blocky.example'));
});

test('a blocked robots.txt blocks the host before any page request', async () => {
  const clock = fakeClock();
  const f = mockFetch({ '/robots.txt': { status: 403, body: 'Sorry, you have been blocked' } });
  const http = createHttp({ fetchImpl: f, now: clock.now, sleep: clock.sleep });
  const r = await http.get('https://cf.example/page');
  assert.equal(r.blocked, true);
  assert.deepEqual(f.calls.map((c) => new URL(c.url).pathname), ['/robots.txt']);
});

test('*.dogs.ie is deny-listed: zero network calls', async () => {
  const clock = fakeClock();
  const f = mockFetch({});
  const http = createHttp({ fetchImpl: f, now: clock.now, sleep: clock.sleep });
  for (const u of ['https://dogs.ie/robots.txt', 'https://www.dogs.ie/sale/x', 'https://images.dogs.ie/a/preview.jpg']) {
    const r = await http.get(u);
    assert.equal(r.denied, true);
  }
  assert.equal(f.calls.length, 0);
});

test('429 backs off 8 s then 30 s and stops at 3 attempts; Retry-After honoured', async () => {
  const clock = fakeClock();
  const times = [];
  const f = mockFetch({ '/robots.txt': { body: '' }, '/busy': () => ({ status: 429 }), '/ra': () => ({ status: 503, headers: { 'retry-after': '20' } }) });
  const http = createHttp({ fetchImpl: async (u, i) => { times.push([new URL(u).pathname, clock.now()]); return f(u, i); }, now: clock.now, sleep: clock.sleep });
  const r = await http.get('https://busy.example/busy');
  assert.equal(r.ok, false);
  const busy = times.filter(([p]) => p === '/busy').map(([, t]) => t);
  assert.equal(busy.length, 3);
  assert.deepEqual([busy[1] - busy[0], busy[2] - busy[1]], [8000, 30000]);
  times.length = 0;
  await http.get('https://busy.example/ra');
  const ra = times.map(([, t]) => t);
  assert.equal(ra[1] - ra[0], 20000);
});

test('caps: the 61st detail page on one host is skipped without a request', async () => {
  const clock = fakeClock();
  const calls = [];
  const f = async (u) => { calls.push(u); return new Response(u.endsWith('/robots.txt') ? '' : 'x'); };
  f.calls = calls;
  const http = createHttp({ fetchImpl: f, now: clock.now, sleep: clock.sleep });
  let skipped = 0;
  for (let i = 0; i < 61; i++) if ((await http.get(`https://cap.example/d/${i}`, { kind: 'detail' })).capped) skipped++;
  assert.equal(skipped, 1);
  assert.equal(f.calls.length, 61); // robots + 60 details
});

test('ETag is sent back and a 304 is reported as not modified', async () => {
  const clock = fakeClock();
  const cache = {};
  let n = 0;
  const f = async (url, init) => {
    if (url.endsWith('/robots.txt')) return new Response('');
    n++;
    if (n === 1) return new Response('body', { headers: { etag: '"v1"' } });
    assert.equal(init.headers['If-None-Match'], '"v1"');
    return new Response(null, { status: 304 });
  };
  const http = createHttp({ fetchImpl: f, now: clock.now, sleep: clock.sleep, cache });
  await http.get('https://etag.example/x');
  const r = await http.get('https://etag.example/x');
  assert.equal(r.notModified, true);
});

test('robots parser: own agent group beats *, longest match wins, $ anchors', () => {
  const r = parseRobots('User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nDisallow: /wp-admin/\nAllow: /wp-admin/admin-ajax.php\nDisallow: /*.pdf$\n');
  assert.equal(robotsAllows(r, '/ad/jrt/'), true);
  assert.equal(robotsAllows(r, '/wp-admin/x'), false);
  assert.equal(robotsAllows(r, '/wp-admin/admin-ajax.php'), true);
  assert.equal(robotsAllows(r, '/a.pdf'), false);
  assert.equal(robotsAllows(r, '/a.pdf?x=1'), true);
  const own = parseRobots('User-agent: *\nDisallow:\n\nUser-agent: CuriousTailsImports\nDisallow: /private/\n');
  assert.equal(robotsAllows(own, '/private/a'), false);
});

test("grep: no 'weserv' or proxy usage anywhere in scripts/imports", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const self = fileURLToPath(import.meta.url);
  const files = [];
  const walk = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); statSync(p).isDirectory() ? walk(p) : /\.(mjs|js|json)$/.test(n) && files.push(p); } };
  walk(root);
  const bad = /weserv|https?_proxy|proxy-agent|HttpsProxyAgent|ProxyAgent|puppeteer|playwright|scraperapi|zenrows|brightdata|cloudscraper/i;
  const hits = files.filter((p) => p !== self && bad.test(readFileSync(p, 'utf8')));
  assert.deepEqual(hits, []);
});
