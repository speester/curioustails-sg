import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDetail, run, dfsiMode, collapseImageVariants, galleryImages, adSitemapsFromIndex, adsFromSitemap, hasSoldToken, INDEX_URL, ORIGIN,
} from '../adapters/dfsi.mjs';
import { testHttp, privateFixtures, NOW } from './_helpers.mjs';

const U = `${ORIGIN}/wp-content/uploads/2026/10`;
// Fabricated page with dogsforsaleireland.ie markup (no real seller data).
function fakeAd({ title = 'Test Dachshund Puppies', chips = ['900000000000011', '900000000000012'], male = 1, female = 1 } = {}) {
  const field = (label, value) => `<div class="col-sm-4 col-md-4 col-xs-12 no-padding">\n<span><strong>${label}</strong> :</span>\n${value}\n</div>`;
  return `<!doctype html><html><head>
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebPage"},{"@type":"Product","name":"${title}","offers":{"@type":"Offer","priceCurrency":"EUR","price":"600"}}]}</script>
<link rel="icon" href="${ORIGIN}/wp-content/uploads/2021/09/cropped-site-icon-6-32x32.png"></head><body>
<a href="${ORIGIN}/author/x/?type=ads"><img src="${ORIGIN}/wp-content/uploads/2021/09/Avatar-Dogs-for-Sale-Ireland.png"></a>
<div class="details-price"><h2>€600.00<span class="negotiable-single">&nbsp(Negotiable)</span></h2></div>
<div class="details-edition"><h1>${title}</h1></div>
<li><a href="javascript:void(0)"><span>Posted</span>November 7, 2026 </a></li>
<div class="flexslider single-page-slider"><ul class="slides slide-main gallery">
<li><a href="${U}/photo1-scaled.jpg"><img src="${U}/photo1-760x410.jpg"></a></li>
<li><a href="${U}/photo2.jpg"><img src="${U}/photo2-760x410.jpg" srcset="${U}/photo2-313x234.jpg 313w"></a></li>
</ul></div><div class="flexslider" id="carousels"><img src="${U}/photo1-80x80.jpg"><img src="${U}/photo2-80x80.jpg"></div>
${field('Date', 'November 7, 2026')}
${field('Breed', 'Dachshund')}
${field('Date of Birth', 'August 25, 2026<br><span><strong>Current Age:</strong></span> <span>0 years, 2 month, 19 days</span> <a href="#">(More info)</a')}
<div class="modal-body"><p>Minimum age</p></div>
${field('Colour', 'Black')}
${field('Country of Origin', 'Ireland')}
${field('<span style="background-color:#d9edf7;">Number of dogs (Male)</span>', male)}
${field('<span style="background-color:#f2dede;">Number of dogs (Female)</span>', female)}
${field('<span style="color:white;">IKC registered</span>', 'No')}
${field('<span>Wormed</span>', 'Yes')}
${field('Registered Seller ID', 'TEST-0001')}
${field('Microchips', `<br>Click on the microchip number to verify<br>${chips.map((c) => `<a href="https://www.europetnet.com/?SEARCH_STRING_HOME=${c}">${c}</a> <br>`).join(' ')}`)}
${field('Location', 'Testtown')}
<div class="desc-points"><p>Fabricated description for the test fixture.</p>
<div class="addtoany_share_save_container"></div>
<div class="grid-card">Similiar Ads <img src="${U}/other-ad-120x63.jpg"></div>
</body></html>`;
}

function assertDfsiAcceptance(rec) {
  assert.match(rec.dob || '', /^\d{4}-\d{2}-\d{2}$/, 'dob');
  assert.equal(typeof rec.maleCount, 'number', 'male count');
  assert.equal(typeof rec.femaleCount, 'number', 'female count');
  assert.ok(rec.puppies.length >= 1 && rec.puppies.every((p) => /^\d{15}$/.test(p.microchip)), 'microchip list');
}

test('dfsi: fabricated ad yields dob, sex counts and a microchip list', () => {
  const rec = parseDetail(fakeAd(), { url: `${ORIGIN}/ad/test-dachshund-puppies/`, fetchedAt: 't', mode: 'lead-only' });
  assertDfsiAcceptance(rec);
  assert.equal(rec.key, 'dfsi:test-dachshund-puppies');
  assert.deepEqual([rec.dobRaw, rec.dob], ['August 25, 2026', '2026-08-25']);
  assert.deepEqual([rec.maleCount, rec.femaleCount], [1, 1]);
  assert.deepEqual(rec.puppies.map((p) => p.microchip), ['900000000000011', '900000000000012']);
  assert.deepEqual([rec.priceNumber, rec.currency, rec.negotiable], [600, 'EUR', true]);
  assert.equal(rec.breedRaw, 'Dachshund');
  assert.equal(rec.sourcePublishedAt, '2026-11-07');
  assert.deepEqual(rec.flags, { wormed: true, ikc: false });
  assert.equal(rec.seller.regNo, 'TEST-0001');
  assert.equal(rec.descriptionRaw, 'Fabricated description for the test fixture.');
  assert.equal(rec.sourceStatus, 'live');
});

test('dfsi: image size variants collapse to one URL per photo (largest kept)', () => {
  assert.deepEqual(galleryImages(fakeAd()), [`${U}/photo1-scaled.jpg`, `${U}/photo2.jpg`]);
  assert.deepEqual(
    collapseImageVariants([`${U}/a-120x63.jpg`, `${U}/a-760x410.jpg`, `${U}/a-80x80.jpg`, `//dogsforsaleireland.ie/wp-content/uploads/2026/10/b-313x234.jpg`, `${U}/b-760x410.jpg`]),
    [`${U}/a-760x410.jpg`, `${U}/b-760x410.jpg`],
  );
  assert.deepEqual(collapseImageVariants([`${U}/c-760x410.jpg`, `${U}/c-scaled.jpg`, `${U}/c.jpg`]), [`${U}/c-scaled.jpg`]);
});

test("dfsi: default mode is lead-only, and lead-only records are forced to review", () => {
  assert.equal(dfsiMode({}), 'lead-only');
  assert.equal(dfsiMode({ IMPORTS_DFSI_MODE: 'something' }), 'lead-only');
  assert.equal(dfsiMode({ IMPORTS_DFSI_MODE: 'auto' }), 'auto');
  const auto = parseDetail(fakeAd(), { url: `${ORIGIN}/ad/x/`, fetchedAt: 't', mode: 'auto' });
  assert.equal(auto.status, null, 'auto mode leaves the decision to the gates');
});

test("dfsi: a 'sold' token in title or slug marks the record sold", () => {
  assert.equal(hasSoldToken('Puppies SOLD', 'x'), true);
  assert.equal(hasSoldToken('Pups', 'pups-sold-2'), true);
  assert.equal(hasSoldToken('Soldier dog pups', 'soldier-pups'), false);
  assert.equal(parseDetail(fakeAd({ title: 'Lab pups (sold)' }), { url: `${ORIGIN}/ad/lab-pups/`, fetchedAt: 't' }).sourceStatus, 'sold');
});

test('dfsi: only sitemap entries with lastmod in the last 21 days are read', () => {
  const cutoff = NOW().getTime() - 21 * 86400000;
  const index = `<sitemapindex><sitemap><loc>${ORIGIN}/post-sitemap.xml</loc><lastmod>2026-11-12</lastmod></sitemap>
<sitemap><loc>${ORIGIN}/ad_post-sitemap.xml</loc><lastmod>2026-11-12T17:12:38+00:00</lastmod></sitemap>
<sitemap><loc>${ORIGIN}/ad_post-sitemap2.xml</loc><lastmod>2026-11-12T17:12:38+00:00</lastmod></sitemap>
<sitemap><loc>${ORIGIN}/ad_post-sitemap3.xml</loc><lastmod>2025-01-01T00:00:00+00:00</lastmod></sitemap></sitemapindex>`;
  assert.deepEqual(adSitemapsFromIndex(index, cutoff), [`${ORIGIN}/ad_post-sitemap.xml`, `${ORIGIN}/ad_post-sitemap2.xml`]);
  const sm = `<urlset><url><loc>${ORIGIN}/ad/new-pups/</loc><lastmod>2026-11-10T09:00:00+00:00</lastmod></url>
<url><loc>${ORIGIN}/ad/old-pups/</loc><lastmod>2026-10-01T09:00:00+00:00</lastmod></url>
<url><loc>${ORIGIN}/ad/no-date/</loc></url>
<url><loc>${ORIGIN}/ad/cute-pups-%f0%9f%90%be/</loc><lastmod>2026-11-12T09:00:00+00:00</lastmod></url></urlset>`;
  assert.deepEqual(adsFromSitemap(sm, cutoff).map((a) => a.id), ['new-pups', 'cute-pups-🐾']);
});

const real = privateFixtures('dfsi', '.html');
test('dfsi: private real fixture yields dob, sex counts and a microchip list; images collapsed', { skip: real.length ? false : 'no fixtures in IMPORTS_PRIVATE_DIR/fixtures/dfsi' }, () => {
  for (const f of real) {
    const rec = parseDetail(f.body, { url: `${ORIGIN}/ad/real-fixture/`, fetchedAt: 't' });
    assertDfsiAcceptance(rec);
    assert.equal(rec.status, 'review');
    const bases = rec.imageSourceUrls.map((u) => u.replace(/-(?:\d+x\d+|scaled)(\.[a-z]+)$/i, '$1'));
    assert.equal(new Set(bases).size, bases.length, 'one URL per photo');
    assert.ok(rec.imageSourceUrls.every((u) => /\/wp-content\/uploads\/20\d\d\/\d\d\//.test(u) && !/Avatar|site-icon/.test(u)));
  }
});

test('dfsi run (default mode): every record is review / lead-only — none can reach published', async () => {
  const saved = process.env.IMPORTS_DFSI_MODE;
  delete process.env.IMPORTS_DFSI_MODE;
  try {
    const routes = {
      [`${ORIGIN}/robots.txt`]: { body: 'User-agent: *\nDisallow: /wp-admin/\n' },
      [INDEX_URL]: { body: `<sitemapindex><sitemap><loc>${ORIGIN}/ad_post-sitemap2.xml</loc><lastmod>2026-11-12T17:12:38+00:00</lastmod></sitemap></sitemapindex>` },
      [`${ORIGIN}/ad_post-sitemap2.xml`]: { body: `<urlset><url><loc>${ORIGIN}/ad/a-pups/</loc><lastmod>2026-11-12T00:00:00+00:00</lastmod></url><url><loc>${ORIGIN}/ad/b-pups/</loc><lastmod>2026-11-11T00:00:00+00:00</lastmod></url><url><loc>${ORIGIN}/ad/c-pups/</loc><lastmod>2026-11-11T00:00:00+00:00</lastmod></url></urlset>` },
      [`${ORIGIN}/ad/a-pups/`]: { body: fakeAd() },
      [`${ORIGIN}/ad/b-pups/`]: { body: fakeAd({ title: 'B pups' }) },
    };
    const { http, fetchImpl } = testHttp(routes);
    const out = await run({ http, seen: new Set(['c-pups']), now: NOW });
    assert.equal(out.mode, 'lead-only');
    assert.deepEqual(out.records.map((r) => r.listingId), ['a-pups', 'b-pups']);
    assert.ok(out.records.every((r) => r.status === 'review' && r.reviewReasons.includes('lead-only')));
    assert.ok(!out.records.some((r) => r.status === 'published'));
    assert.ok(!fetchImpl.calls.some((u) => u.endsWith('/ad/c-pups/')), 'seen id not refetched');
    for (const l of http.log.filter((x) => x.outcome === 'fetched').slice(1)) assert.ok(l.gapMs >= 4000);
  } finally {
    if (saved === undefined) delete process.env.IMPORTS_DFSI_MODE;
    else process.env.IMPORTS_DFSI_MODE = saved;
  }
});
