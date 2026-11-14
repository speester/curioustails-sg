// K-134 sample-listing verification: 1440 and 390, console errors, overflow,
// sample label above the fold (card and detail), price/arrival legibility, chips,
// card -> detail link, WhatsApp ?text= with the puppy id, robots, schema.
//   K134_BASE=http://localhost:4334 node reports/k134-tools/verify-k134.mjs [outDir]
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = (process.env.K134_BASE || 'http://localhost:4334').replace(/\/$/, '');
const OUT = process.argv[2] || 'reports/k134-shots';
mkdirSync(OUT, { recursive: true });
const DETAIL = '/puppies/jack-russell-terrier/imp-5a3d1e0001/';
const SIZES = [{ w: 1440, h: 900 }, { w: 390, h: 844 }];
const report = { base: BASE, runs: [], failures: [] };
const fail = (where, msg) => report.failures.push(`${where}: ${msg}`);

const browser = await chromium.launch();
for (const s of SIZES) {
  const tag = `${s.w}`;
  const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: 1 });

  // ---------------- /available-puppies/ ----------------
  {
    const page = await ctx.newPage();
    const errs = [];
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
    const res = await page.goto(`${BASE}/available-puppies/`, { waitUntil: 'networkidle' });
    const where = `available-${tag}`;
    const r = { page: where, status: res.status(), xRobots: res.headers()['x-robots-tag'] ?? null };
    r.overflow = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    const sec = page.locator('#arriving-soon');
    await sec.scrollIntoViewIfNeeded();
    await page.evaluate(() => document.querySelector('#arriving-soon').scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/available-imported-${tag}.png` });
    const cards = page.locator('[data-sample="true"]');
    r.sampleCards = await cards.count();
    r.cardLabels = await page.locator('[data-sample="true"] [data-sample-label]').count();
    // Card label: first thing in the card, so it is on screen whenever the card's top is.
    const first = cards.first();
    await first.scrollIntoViewIfNeeded();
    r.firstCard = await first.evaluate((el) => {
      const c = el.getBoundingClientRect();
      const l = el.querySelector('[data-sample-label]').getBoundingClientRect();
      const price = el.querySelector('p.text-xl');
      const arrival = [...el.querySelectorAll('li span')].find((x) => /Estimated arrival/.test(x.textContent));
      const fs = (n) => (n ? parseFloat(getComputedStyle(n).fontSize) : null);
      const col = (n) => (n ? getComputedStyle(n).color : null);
      return {
        labelText: el.querySelector('[data-sample-label]').textContent.trim(),
        labelOffsetFromCardTop: Math.round(l.top - c.top),
        labelInViewport: l.top >= 0 && l.bottom <= innerHeight,
        priceText: price?.textContent.trim(), priceFont: fs(price), priceColor: col(price),
        arrivalText: arrival?.textContent.trim(), arrivalFont: fs(arrival), arrivalColor: col(arrival),
        cardWidth: Math.round(c.width),
      };
    });
    await page.screenshot({ path: `${OUT}/available-card-${tag}.png` });
    // WhatsApp links on sample cards
    r.waLinks = await page.$$eval('a[data-wa-source^="import:imp-5a3d1e"]', (as) =>
      as.filter((a) => a.href.includes('wa.me') || a.href.includes('whatsapp')).map((a) => {
        const u = new URL(a.href);
        const id = a.dataset.waSource.replace('import:', '');
        const text = u.searchParams.get('text') || '';
        return { id, hasText: Boolean(text), textHasId: text.includes(id) };
      }));
    // Chips
    r.chips = {};
    for (const v of ['imported', 'local', 'all']) {
      await page.locator(`[data-import-filter="${v}"]`).click();
      await page.waitForTimeout(200);
      r.chips[v] = await page.evaluate(() => {
        const g = [...document.querySelectorAll('[data-listing-group]')];
        const vis = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
        return { importedVisible: g.filter((x) => x.dataset.listingGroup === 'imported' && vis(x)).length, localVisible: g.filter((x) => x.dataset.listingGroup !== 'imported' && vis(x)).length };
      });
    }
    // Card -> detail link
    const link = page.locator('[data-sample="true"] a[data-card-action="import_details"]').first();
    const href = await link.getAttribute('href');
    await Promise.all([page.waitForURL(`**${href}`), link.click()]);
    r.cardLink = { href, landed: new URL(page.url()).pathname, bannerOnDetail: await page.locator('.sample-banner').count() };
    r.consoleErrors = errs;
    report.runs.push(r);
    if (r.status !== 200) fail(where, `status ${r.status}`);
    if (r.overflow.sw > r.overflow.cw) fail(where, 'horizontal overflow');
    if (errs.length) fail(where, `${errs.length} console errors`);
    if (r.sampleCards < 3 || r.cardLabels !== r.sampleCards) fail(where, 'sample card/label count');
    if (!r.firstCard.labelInViewport || r.firstCard.labelOffsetFromCardTop > 20) fail(where, 'card label not at card top / not visible');
    if (r.waLinks.length === 0 || r.waLinks.some((w) => !w.hasText || !w.textHasId)) fail(where, 'WhatsApp text= missing the puppy id');
    if (r.chips.imported.importedVisible !== 1 || r.chips.imported.localVisible !== 0) fail(where, 'Arriving soon chip');
    if (r.chips.local.importedVisible !== 0 || r.chips.local.localVisible === 0) fail(where, 'In the shop chip');
    if (r.cardLink.landed !== href || r.cardLink.bannerOnDetail !== 1) fail(where, 'card link to detail');
    await page.close();
  }

  // ---------------- detail ----------------
  {
    const page = await ctx.newPage();
    const errs = [];
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
    const res = await page.goto(`${BASE}${DETAIL}`, { waitUntil: 'networkidle' });
    const where = `detail-${tag}`;
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/detail-top-${tag}.png` });
    await page.screenshot({ path: `${OUT}/detail-full-${tag}.png`, fullPage: true });
    const r = await page.evaluate(() => {
      const b = document.querySelector('.sample-banner');
      const br = b?.getBoundingClientRect();
      const lds = [...document.querySelectorAll('script[type="application/ld+json"]')].flatMap((s) => { try { const j = JSON.parse(s.textContent); return Array.isArray(j) ? j : [j]; } catch { return [{ parseError: true }]; } });
      const flat = lds.flatMap((x) => (x['@graph'] ? x['@graph'] : [x]));
      const product = flat.find((x) => x['@type'] === 'Product');
      const price = document.querySelector('.hero .price');
      const avail = document.querySelector('.hero .avail');
      const fs = (n) => (n ? parseFloat(getComputedStyle(n).fontSize) : null);
      const vet = document.querySelector('[data-vets-for-pets]');
      return {
        robots: document.querySelector('meta[name="robots"]')?.content,
        title: document.title,
        banner: b ? { text: b.textContent.trim().replace(/\s+/g, ' '), top: Math.round(br.top), bottom: Math.round(br.bottom), inViewport: br.top >= 0 && br.bottom <= innerHeight } : null,
        schemaTypes: [...new Set(flat.map((x) => x['@type']))],
        schemaParseErrors: flat.filter((x) => x.parseError).length,
        product: product ? { name: product.name, availability: product.offers?.availability, availabilityStarts: product.offers?.availabilityStarts, price: product.offers?.price, priceCurrency: product.offers?.priceCurrency } : null,
        sections: document.querySelector('[data-puppy-page]')?.dataset.sections,
        priceText: price?.textContent.trim(), priceFont: fs(price),
        arrivalText: avail?.textContent.trim(), arrivalFont: fs(avail),
        steps: [...document.querySelectorAll('#next li, #next .step')].map((x) => x.textContent.trim().replace(/\s+/g, ' ')).slice(0, 4),
        vet: vet ? { text: vet.textContent.trim().replace(/\s+/g, ' '), tel: [...vet.querySelectorAll('a[href^="tel:"]')].map((a) => a.getAttribute('href')), wa: [...vet.querySelectorAll('a[href*="wa.me"]')].length } : null,
        wa: [...document.querySelectorAll('a[data-wa-source^="import:imp-5a3d1e0001"]')].filter((a) => /wa\.me|whatsapp/.test(a.href)).map((a) => { const t = new URL(a.href).searchParams.get('text') || ''; return { src: a.dataset.waSource, hasText: !!t, textHasId: t.includes('imp-5a3d1e0001'), text: t }; }),
        overflow: { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth },
        reviewsOrFamilies: document.querySelectorAll('[data-section="reviews"], [data-section="families"]').length,
        uen: /\bUEN\b/i.test(document.body.innerText),
        guarantee: /guarantee/i.test(document.body.innerText),
      };
    });
    r.page = where;
    r.status = res.status();
    r.xRobots = res.headers()['x-robots-tag'] ?? null;
    r.consoleErrors = errs;
    report.runs.push(r);
    if (r.status !== 200) fail(where, `status ${r.status}`);
    if (r.robots !== 'noindex, follow') fail(where, `robots ${r.robots}`);
    if (!r.banner?.inViewport) fail(where, 'sample banner not visible without scrolling');
    if (r.product?.availability !== 'https://schema.org/PreOrder') fail(where, 'no PreOrder');
    if (r.schemaParseErrors) fail(where, 'JSON-LD parse error');
    if (r.overflow.sw > r.overflow.cw) fail(where, 'horizontal overflow');
    if (errs.length) fail(where, `${errs.length} console errors`);
    if (r.reviewsOrFamilies) fail(where, 'reviews/families section on a sample');
    if (!r.vet || r.vet.tel.length !== 3 || r.vet.wa !== 1) fail(where, 'Vets For Pets block');
    if (!r.wa.length || r.wa.some((w) => !w.hasText || !w.textHasId)) fail(where, 'WhatsApp text= missing the puppy id');
    if (r.uen) fail(where, 'UEN on page');
    await page.close();
  }
  await ctx.close();
}
await browser.close();
writeFileSync(`${OUT}/verify-k134.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.failures.length ? 1 : 0;
