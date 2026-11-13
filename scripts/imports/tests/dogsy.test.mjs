import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDetail, parseListPage, run, listUrl } from '../adapters/dogsy.mjs';
import { testHttp, privateFixtures, NOW } from './_helpers.mjs';

// Fabricated page with the same markup as a dogsy.ie detail page (no real seller data).
function fakeDetail({ id = 9001, chips = ['900000000000001', '900000000000002'] } = {}) {
  const ad = {
    id, title: 'Test cavachon pups', photos: ['ad-media/1_a.jpg', 'ad-media/1_b.jpg'], price: 800, currency: 'EUR',
    price_negotiable: 1, ikc_registered: 0, dob: '2026-09-13', published_at: '2026-11-10T00:34:43.000000Z',
    user: { name: 'Test', surname: 'Seller', phone: '0000' },
  };
  const esc = JSON.stringify(ad).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const tick = '<svg width="16"><path d="M2.44368 7.24575C2.1 7.2"/></svg>';
  const cross = '<svg width="16"><g clip-path="url(#c)"><path d="M13.6666 2.35754"/></g></svg>';
  const rows = chips
    .map((c, i) => `<tr class="odd:bg-gray-2"><td class="py-3.5 px-5 flex"><span><a href="https://www.europetnet.org/?SEARCH_STRING_HOME=${c}" title="${c}">${c}</a></span><div class="ml-2"><svg></svg></div></td>
<td class="py-3.5 px-5">${i % 2 ? 'Male' : 'Female'}</td><td class="py-3.5 px-5 min-w-50">Apricot</td><td class="py-3.5 px-5">
For Sale                 </td></tr>`)
    .join('\n');
  return `<!doctype html><html><head>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Test cavachon pups","image":["https://dogsy.ie/storage/ad-media/1_a.jpg"],"description":"Fabricated fixture","sku":${id},"url":"https://dogsy.ie/dogs-for-sale/${id}-test.html","offers":{"@type":"Offer","priceCurrency":"EUR","price":800}}</script>
</head><body>
<a x-data="favouriteButtonComponent(${esc})" href="#">fav</a>
<a href="tel:+353000000000">+353000000000</a>
<h2 class="text-lg">Details</h2>
<div class="flex gap-1.5"><span class="text-gray-5 text-base/5.5">Breed:</span><span class="text-black-1 text-base/5.5">
<a href="#">Cavachon,</a>
<a href="#">Poodle</a></span></div>
<div class="flex gap-1.5"><span class="text-gray-5 text-base/5.5">Age:</span><span class="text-black-1 text-base/5.5">2 months</span></div>
<div class="flex gap-1.5"><span class="text-gray-5 text-base/5.5">Date of Birth:</span><span class="text-black-1 text-base/5.5">13/09/2026</span></div>
<div class="flex gap-1.5"><span class="text-gray-5 text-base/5.5">Sex:</span><span class="text-black-1 text-base/5.5">1 Female, 1 Male</span></div>
<div class="flex gap-1.5"><span class="text-gray-5 text-base/5.5">Location:</span><span class="text-black-1 text-base/5.5"><span class="flex"><a href="#">Kerry</a><span>, Killarney</span></span></span></div>
<div class="flex gap-1.5"><span class="text-gray-5 text-base/5.5">Country of Origin:</span><span class="text-black-1 text-base/5.5">Ireland</span></div>
<div class="flex items-center gap-2"><span class="text-black-1 text-base/5.5">Wormed</span>${tick}</div>
<div class="flex items-center gap-2"><span class="text-black-1 text-base/5.5">Vaccinated</span>${tick}</div>
<div class="flex items-center gap-2"><span class="text-black-1 text-base/5.5">Neutered</span>${cross}</div>
<div class="flex items-center gap-2"><span class="text-black-1 text-base/5.5">Microchipped (<a href="#microchips-info">view</a>)</span>${tick}</div>
<div class="mb-8" id="microchips-info"><table><thead><tr><th>Chip #</th></tr></thead><tbody>
${rows}
</tbody></table></div></body></html>`;
}

const ROBOTS = 'User-agent: *\nDisallow: /dogs-for-sale?*\nDisallow: /admin/\n';
const item = (id, url = `https://dogsy.ie/dogs-for-sale/${id}-test.html`) => ({ id, title: 't', breed: 'Cavachon', county: 'Kerry', price: 800, url, dob: '2026-09-13', age_weeks: -8, published_at: '3 days ago' });

function siteRoutes({ page1, page2, details = {} }) {
  const routes = {
    'https://dogsy.ie/robots.txt': { body: ROBOTS },
    [listUrl(1)]: { body: { data: page1, total: page1.length + page2.length, per_page: 24, current_page: 1, last_page: 2 } },
    [listUrl(2)]: { body: { data: page2, total: page1.length + page2.length, per_page: 24, current_page: 2, last_page: 2 } },
  };
  for (const [id, html] of Object.entries(details)) routes[`https://dogsy.ie/dogs-for-sale/${id}-test.html`] = { body: html };
  return routes;
}

function assertDogsyRecord(rec) {
  assert.match(rec.dob, /^\d{4}-\d{2}-\d{2}$/, 'dob parsed to ISO');
  assert.equal(typeof rec.priceNumber, 'number');
  assert.equal(rec.currency, 'EUR');
  assert.ok(rec.puppies.length >= 1, 'at least one puppy row');
  assert.ok(rec.puppies.some((p) => /^\d{15}$/.test(p.microchip || '')), '≥1 puppies[].microchip');
}

test('dogsy: fabricated detail page parses to a full SourceRecord', () => {
  const rec = parseDetail(fakeDetail(), { url: 'https://dogsy.ie/dogs-for-sale/9001-test.html', fetchedAt: '2026-11-13T06:15:00.000Z' });
  assertDogsyRecord(rec);
  assert.equal(rec.key, 'dogsy:9001');
  assert.equal(rec.viaSite, 'irishpuppies.ie');
  assert.equal(rec.dobRaw, '13/09/2026');
  assert.equal(rec.dob, '2026-09-13');
  assert.equal(rec.priceNumber, 800);
  assert.equal(rec.negotiable, true);
  assert.equal(rec.breedRaw, 'Cavachon, Poodle');
  assert.deepEqual([rec.breed1, rec.breed2], ['Cavachon', 'Poodle']);
  assert.deepEqual([rec.maleCount, rec.femaleCount], [1, 1]);
  assert.deepEqual([rec.county, rec.town, rec.countryOfOrigin], ['Kerry', 'Killarney', 'Ireland']);
  assert.deepEqual(rec.flags, { wormed: true, vaccinated: true, neutered: false, microchipped: true, ikc: false });
  assert.deepEqual(rec.puppies[0], { sex: 'F', colour: 'Apricot', price: null, microchip: '900000000000001', chipVerified: null, status: 'For Sale' });
  assert.equal(rec.puppies[1].sex, 'M');
  assert.equal(rec.seller.phone, '+353000000000');
  assert.deepEqual(rec.imageSourceUrls, ['https://dogsy.ie/storage/ad-media/1_a.jpg', 'https://dogsy.ie/storage/ad-media/1_b.jpg']);
});

test('dogsy: API age_weeks is ignored', () => {
  const { items, lastPage } = parseListPage({ data: [item(1)], last_page: 3 });
  assert.equal(lastPage, 3);
  assert.equal('age_weeks' in items[0], false);
  assert.equal('ageWeeks' in items[0], false);
});

const realFixtures = privateFixtures('dogsy', '.html');
test('dogsy: private real fixture(s) parse to SourceRecord with dob, price, EUR, ≥1 microchip', { skip: realFixtures.length ? false : 'no fixtures in IMPORTS_PRIVATE_DIR/fixtures/dogsy (run capture.mjs --fixture)' }, () => {
  for (const f of realFixtures) {
    const rec = parseDetail(f.body, { url: `https://dogsy.ie/dogs-for-sale/${f.name.replace(/\.html$/, '')}.html`, fetchedAt: '2026-11-13T00:00:00.000Z' });
    assertDogsyRecord(rec);
  }
});

test('dogsy run: no request to a robots-disallowed /dogs-for-sale?* path', async () => {
  const sneaky = 'https://dogsy.ie/dogs-for-sale?breed=poodle';
  const { http, fetchImpl } = testHttp(siteRoutes({ page1: [item(1), item(2, sneaky)], page2: [], details: { 1: fakeDetail({ id: 1 }) } }));
  const out = await run({ http, now: NOW });
  assert.equal(out.records.length, 1);
  assert.ok(!fetchImpl.calls.some((u) => new URL(u).pathname === '/dogs-for-sale' || u.includes('/dogs-for-sale?')), 'network never saw /dogs-for-sale?*');
  // Also via the client directly: the robots rule is applied, logged and skipped.
  const r = await http.get(sneaky, { kind: 'detail' });
  assert.equal(r.robotsDisallowed, true);
  assert.ok(http.log.some((l) => l.path === '/dogs-for-sale?breed=poodle' && l.outcome === 'robots-skip'));
  assert.ok(!fetchImpl.calls.includes(sneaky));
});

test('dogsy run: second run with no new ids makes ≤ 3 requests in total', async () => {
  const routes = siteRoutes({ page1: [item(11), item(12)], page2: [item(13)], details: { 11: fakeDetail({ id: 11 }), 12: fakeDetail({ id: 12 }), 13: fakeDetail({ id: 13 }) } });

  const first = testHttp(routes);
  const out1 = await run({ http: first.http, now: NOW });
  assert.deepEqual(out1.records.map((r) => r.listingId), ['11', '12', '13']);
  assert.equal(first.fetchImpl.calls.length, 6, 'robots + 2 list pages + 3 details');

  const seen = new Set(out1.records.map((r) => r.listingId));
  const second = testHttp(routes); // a fresh run: robots is re-read once
  const out2 = await run({ http: second.http, seen, now: NOW });
  assert.equal(out2.records.length, 0);
  assert.ok(second.fetchImpl.calls.length <= 3, `made ${second.fetchImpl.calls.length} requests`);
  assert.deepEqual(second.fetchImpl.calls, ['https://dogsy.ie/robots.txt', listUrl(1), listUrl(2)]);
});

test('dogsy run: same-host requests are ≥ 4 s apart', async () => {
  const routes = siteRoutes({ page1: [item(21), item(22)], page2: [], details: { 21: fakeDetail({ id: 21 }), 22: fakeDetail({ id: 22 }) } });
  const { http } = testHttp(routes);
  await run({ http, now: NOW });
  const fetched = http.log.filter((l) => l.outcome === 'fetched');
  assert.equal(fetched.length, 5);
  for (const l of fetched.slice(1)) assert.ok(l.gapMs >= 4000, `gap ${l.gapMs}`);
});

test('dogsy run: maxDetail leaves the rest unseen; a blocked host stops the run', async () => {
  const routes = siteRoutes({ page1: [item(31), item(32)], page2: [], details: { 31: fakeDetail({ id: 31 }) } });
  routes['https://dogsy.ie/dogs-for-sale/32-test.html'] = { status: 403, body: 'Sorry, you have been blocked' };
  const capped = testHttp(routes);
  const outCap = await run({ http: capped.http, maxDetail: 1, now: NOW });
  assert.deepEqual(outCap.records.map((r) => r.listingId), ['31']);

  const blocked = testHttp(routes);
  const out = await run({ http: blocked.http, seen: new Set(['31']), now: NOW });
  assert.equal(out.records.length, 0);
  assert.ok(out.errors.some((e) => e.blocked));
  assert.ok(blocked.http.isBlocked('dogsy.ie'));
});
