import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run, homeAds, toRecord, listingIdOf, HOME_URL, apiUrl, ORIGIN, REVIEW_REASON } from '../adapters/puppiesie.mjs';
import { fromRelative } from '../lib/source-record.mjs';
import { testHttp, privateFixtures, NOW } from './_helpers.mjs';

// Fabricated ads in the puppies.ie summary shape (no real listings).
const ad = (n, extra = {}) => ({
  title: `Test pups ${n} in Galway`, price: 1000 + n, county_name: 'Galway', currency_symbol: '€', breed_name: 'Pomeranian',
  image_count: 5, video_count: 0, male_count: 1, female_count: 2,
  preview_url: `https://images.dogs.ie/${n}/conversions/x-preview.jpg`, url: `https://dogs.ie/sale/pomeranian/test-pups-${n}`,
  published_at_for_humans: '3 days ago', ...extra,
});
const homeHtml = (ads) => {
  const page = { component: 'home/index', props: { initialLatestAds: ads, initialCanLoadMore: true }, url: '/' };
  return `<!doctype html><html><body><div id="app" data-page="${JSON.stringify(page).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"></div></body></html>`;
};

function routes() {
  return {
    [`${ORIGIN}/robots.txt`]: { body: 'User-agent: *\nDisallow: /admin\n' },
    [HOME_URL]: { body: homeHtml([ad(1), ad(2, { currency_symbol: '£', price: 450, title: 'NI pups' })]) },
    [apiUrl(1)]: { body: { ads: [ad(2, { currency_symbol: '£', price: 450 }), ad(3)], canLoadMore: true } },
    [apiUrl(2)]: { body: { ads: [ad(4)], canLoadMore: false } },
    [apiUrl(3)]: { body: { ads: [ad(99)], canLoadMore: false } },
    // Any dogs.ie hit would be a bug; answer like the real Cloudflare block.
    'https://dogs.ie/robots.txt': { status: 403, body: 'Attention Required! | Cloudflare' },
  };
}

test('puppies.ie run: zero requests to any *.dogs.ie host', async () => {
  const { http, fetchImpl } = testHttp(routes());
  const out = await run({ http, now: NOW });
  assert.equal(out.records.length, 4);
  assert.ok(fetchImpl.calls.every((u) => new URL(u).hostname === 'puppies.ie'), fetchImpl.calls.join('\n'));
  assert.equal(http.log.filter((l) => /(^|\.)dogs\.ie$/i.test(l.host)).length, 0, 'run log shows zero *.dogs.ie entries');
  assert.ok(!fetchImpl.calls.includes(apiUrl(3)), 'stops when canLoadMore is false');
});

test("puppies.ie: every record is status review ('no-photos-source-blocked'); '£' maps to GBP", async () => {
  const { http } = testHttp(routes());
  const { records } = await run({ http, now: NOW });
  for (const r of records) {
    assert.equal(r.status, 'review');
    assert.ok(r.reviewReasons.includes(REVIEW_REASON));
    assert.equal(r.supplier, 'dogsie');
    assert.equal(r.viaSite, 'puppies.ie');
    assert.deepEqual(r.imageSourceUrls, []);
    assert.ok(!JSON.stringify(r).includes('images.dogs.ie'), 'no image URL from the blocked host is kept');
  }
  const ni = records.find((r) => r.listingId === 'pomeranian/test-pups-2');
  assert.deepEqual([ni.currency, ni.priceNumber, ni.priceRaw], ['GBP', 450, '£450']);
  assert.equal(records.find((r) => r.listingId === 'pomeranian/test-pups-1').currency, 'EUR');
});

test('puppies.ie: summary fields only, seen ids skipped, relative date resolved', async () => {
  const { http } = testHttp(routes());
  const { records, discovered } = await run({ http, seen: new Set(['pomeranian/test-pups-1']), now: NOW });
  assert.equal(discovered.length, 4);
  assert.deepEqual(records.map((r) => r.listingId), ['pomeranian/test-pups-2', 'pomeranian/test-pups-3', 'pomeranian/test-pups-4']);
  const r = records[1];
  assert.deepEqual(
    { title: r.title, breed: r.breedRaw, county: r.county, m: r.maleCount, f: r.femaleCount, imgs: r.imageCount, pub: r.publishedText },
    { title: 'Test pups 3 in Galway', breed: 'Pomeranian', county: 'Galway', m: 1, f: 2, imgs: 5, pub: '3 days ago' },
  );
  assert.equal(r.sourcePublishedAt, '2026-11-10T06:15:00.000Z');
  assert.equal(r.sourceUrl, 'https://dogs.ie/sale/pomeranian/test-pups-3', 'kept for the owner, never fetched');
});

test('puppies.ie: a blocked home page stops the run without touching the API', async () => {
  const rs = routes();
  rs[HOME_URL] = { status: 403, body: 'Sorry, you have been blocked' };
  const { http, fetchImpl } = testHttp(rs);
  const out = await run({ http, now: NOW });
  assert.equal(out.records.length, 0);
  assert.ok(http.isBlocked('puppies.ie'));
  assert.deepEqual(fetchImpl.calls, [`${ORIGIN}/robots.txt`, HOME_URL]);
});

test('puppies.ie helpers', () => {
  assert.equal(listingIdOf('https://dogs.ie/sale/boxer/boxer-pups-wexford'), 'boxer/boxer-pups-wexford');
  assert.equal(toRecord({ url: 'not a url' }, { fetchedAt: '2026-11-13T00:00:00Z' }), null);
  assert.equal(fromRelative('5 minutes ago', new Date('2026-11-13T06:15:00Z')), '2026-11-13T06:10:00.000Z');
  assert.equal(fromRelative('an hour ago', new Date('2026-11-13T06:15:00Z')), '2026-11-13T05:15:00.000Z');
  assert.equal(fromRelative('last spring'), null);
});

const realHome = privateFixtures('puppiesie', '.html');
const realApi = privateFixtures('puppiesie', '.json');
test('puppies.ie: private real fixtures → review records, £ → GBP, no dogs.ie image kept', { skip: realHome.length || realApi.length ? false : 'no fixtures in IMPORTS_PRIVATE_DIR/fixtures/puppiesie' }, () => {
  const ads = [...realHome.flatMap((f) => homeAds(f.body)), ...realApi.flatMap((f) => JSON.parse(f.body).ads || [])];
  assert.ok(ads.length > 0);
  const recs = ads.map((a) => toRecord(a, { fetchedAt: '2026-11-13T00:00:00.000Z' })).filter(Boolean);
  assert.ok(recs.length > 0);
  for (const r of recs) {
    assert.equal(r.status, 'review');
    assert.ok(['EUR', 'GBP'].includes(r.currency) || r.currency === null);
    if (r.priceRaw.startsWith('£')) assert.equal(r.currency, 'GBP');
    assert.deepEqual(r.imageSourceUrls, []);
  }
});
