import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDetail, parseSitemap, findInitialListing, run, SITEMAP_URL } from '../adapters/dogquest.mjs';
import { nextFlightChunks } from '../lib/html.mjs';
import { testHttp, privateFixtures, NOW } from './_helpers.mjs';

const ID = '00000000-1111-4222-8333-444444444444';
const LISTING = {
  id: ID, title: 'Test JRT pup', price: 650, min_price: 650, max_price: 650, location: 'kildare', breed: 'jackrussellterrier',
  breed_type: 'pedigree', breed_1: 'jackrussellterrier', breed_2: '$undefined', date_of_birth: '2026-08-31', male_count: 1, female_count: 0,
  description: 'Fabricated fixture', images: ['https://example.supabase.co/storage/v1/object/public/a.webp'],
  puppy_details: [
    { id: 'p1', sex: 'male', color: 'Brown and white', price: '650', imageUrl: 'https://example.supabase.co/storage/v1/object/public/p1.webp', microchipNumber: '900000000000009', microchipVerificationStatus: 'animark_verified' },
    { id: 'p2', sex: 'female', color: 'White', price: '650', imageUrl: '', microchipNumber: '', microchipVerificationStatus: 'pending' },
  ],
  created_at: '2026-11-01T21:35:39.269856+00:00',
};

// Flight chunks the way Next.js streams them; the listing sits inside one RSC row.
function chunks(listing = LISTING) {
  return [
    '1:"$Sreact.fragment"\n2:I[1234,["app/layout"],"default"]\n',
    `7:["$","div",null,{"children":["$","$L9",null,{"initialListing":${JSON.stringify(listing)},"user":null}]}]\n`,
    '0:{"P":null,"b":"build","p":"","c":["","listing","x"]}\n',
    '8:["$","meta","0",{"name":"robots","content":"index, follow"}]\n',
  ];
}
const page = (cs, ld = '{"@context":"https://schema.org","@type":"Product","name":"Test JRT pup","offers":{"@type":"Offer","price":650,"priceCurrency":"EUR"}}') =>
  `<!doctype html><html><head><script type="application/ld+json">${ld}</script></head><body>` +
  cs.map((c) => `<script>self.__next_f.push([1,${JSON.stringify(c)}])</script>`).join('') +
  '</body></html>';

function assertDogquestAcceptance(rec) {
  assert.match(rec.dob || '', /^\d{4}-\d{2}-\d{2}$/, 'date_of_birth parsed');
  assert.ok(rec.imageSourceUrls.length >= 1, '≥1 image URL');
  const p0 = rec.puppies[0];
  assert.ok(p0, 'puppies[0] exists');
  if (p0.chipVerification === 'animark_verified') assert.equal(p0.chipVerified, true);
}

test('dogquest: fabricated listing → dob, images, chipVerified from animark_verified', () => {
  const rec = parseDetail(page(chunks()), { url: `https://www.dogquest.ie/listing/test-${ID}`, fetchedAt: '2026-11-13T06:15:00.000Z' });
  assertDogquestAcceptance(rec);
  assert.equal(rec.key, `dogquest:${ID}`);
  assert.equal(rec.dobRaw, '2026-08-31');
  assert.equal(rec.puppies[0].chipVerified, true);
  assert.equal(rec.puppies[0].microchip, '900000000000009');
  assert.equal(rec.puppies[0].sex, 'M');
  assert.equal(rec.puppies[1].chipVerified, false, 'pending is not verified');
  assert.equal(rec.puppies[1].microchip, null);
  assert.deepEqual([rec.priceNumber, rec.currency, rec.priceRaw], [650, 'EUR', '€650']);
  assert.deepEqual([rec.maleCount, rec.femaleCount, rec.county], [1, 0, 'kildare']);
  assert.equal(rec.breed2, undefined, '$undefined becomes absent');
  assert.deepEqual(rec.imageSourceUrls, ['https://example.supabase.co/storage/v1/object/public/a.webp', 'https://example.supabase.co/storage/v1/object/public/p1.webp']);
});

test('dogquest: a changed RSC chunk order parses to the same record', () => {
  const base = parseDetail(page(chunks()), { url: 'u', fetchedAt: 't' });
  for (const order of [[3, 2, 1, 0], [1, 0, 3, 2], [2, 3, 0, 1]]) {
    const cs = chunks();
    const rec = parseDetail(page(order.map((i) => cs[i])), { url: 'u', fetchedAt: 't' });
    assert.deepEqual(rec, base, `order ${order}`);
  }
});

test('dogquest: price falls back to Product JSON-LD', () => {
  const rec = parseDetail(page(chunks({ ...LISTING, price: '$undefined', min_price: null, max_price: null })), { url: 'u', fetchedAt: 't' });
  assert.equal(rec.priceNumber, 650);
});

test('dogquest: missing initialListing is a parse error, not a crash', () => {
  const rec = parseDetail(page(['0:{}\n']), { url: `https://www.dogquest.ie/listing/x-${ID}`, fetchedAt: 't' });
  assert.equal(rec.sourceStatus, 'error');
  assert.equal(findInitialListing('<html></html>'), null);
});

const real = privateFixtures('dogquest', '.html');
test('dogquest: private real fixture yields date_of_birth, ≥1 image, chipVerified for animark_verified — in any chunk order', { skip: real.length ? false : 'no fixtures in IMPORTS_PRIVATE_DIR/fixtures/dogquest' }, () => {
  for (const f of real) {
    const rec = parseDetail(f.body, { url: 'https://www.dogquest.ie/listing/x', fetchedAt: 't' });
    assertDogquestAcceptance(rec);
    assert.ok(rec.puppies.some((p) => p.chipVerification === 'animark_verified' && p.chipVerified === true));
    // Rebuild the page with its flight chunks reversed; the record must not change.
    const cs = nextFlightChunks(f.body);
    assert.ok(cs.length > 1);
    const reversed = page([...cs].reverse(), JSON.stringify({ '@type': 'Product' }));
    const rec2 = parseDetail(reversed, { url: 'https://www.dogquest.ie/listing/x', fetchedAt: 't' });
    assert.deepEqual(
      { dob: rec2.dob, imgs: rec2.imageSourceUrls, pups: rec2.puppies, price: rec2.priceNumber },
      { dob: rec.dob, imgs: rec.imageSourceUrls, pups: rec.puppies, price: rec.priceNumber },
    );
  }
});

test('dogquest: sitemap keeps only /listing/<slug>-<uuid> on dogquest hosts', () => {
  const xml = `<urlset><url><loc>https://www.dogquest.ie/breeds/x</loc></url>
<url><loc>https://www.dogquest.ie/listing/test-pup-${ID}</loc><lastmod>2026-11-10</lastmod></url>
<url><loc>https://dogquest.ie/listing/other-${ID.replace('0000', '9999')}</loc></url>
<url><loc>https://evil.example/listing/x-${ID}</loc></url></urlset>`;
  const items = parseSitemap(xml);
  assert.deepEqual(items.map((i) => i.url), [`https://www.dogquest.ie/listing/test-pup-${ID}`, `https://www.dogquest.ie/listing/other-${ID.replace('0000', '9999')}`]);
});

test('dogquest run: details only for new ids; robots obeyed; ≥ 4 s spacing', async () => {
  const id2 = ID.replace('4444', '5555');
  const routes = {
    'https://www.dogquest.ie/robots.txt': { body: 'User-agent: *\nDisallow: /listing/private-\n' },
    [SITEMAP_URL]: { body: `<urlset><url><loc>https://www.dogquest.ie/listing/a-${ID}</loc></url><url><loc>https://www.dogquest.ie/listing/b-${id2}</loc></url><url><loc>https://www.dogquest.ie/listing/private-${ID.replace('1111', '7777')}</loc></url></urlset>` },
    [`https://www.dogquest.ie/listing/a-${ID}`]: { body: page(chunks()) },
    [`https://www.dogquest.ie/listing/b-${id2}`]: { body: page(chunks({ ...LISTING, id: id2 })) },
  };
  const { http, fetchImpl } = testHttp(routes);
  const out = await run({ http, seen: new Set([ID]), now: NOW });
  assert.deepEqual(out.records.map((r) => r.listingId), [id2]);
  assert.ok(!fetchImpl.calls.some((u) => u.includes('/listing/private-')), 'robots-disallowed listing never requested');
  assert.ok(http.log.some((l) => l.outcome === 'robots-skip'));
  const fetched = http.log.filter((l) => l.outcome === 'fetched');
  for (const l of fetched.slice(1)) assert.ok(l.gapMs >= 4000);
});
