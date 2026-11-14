#!/usr/bin/env node
// T24 acceptance: read the REAL GA4 dataLayer from a built site, not the source.
//
//   node scripts/verify-ga4-imports.mjs \
//     --base-url http://127.0.0.1:4331 \
//     --imported /puppies/jack-russell-terrier/imp-7f3a2c91de/ \
//     --local /puppies/cavapoo/ \
//     --out reports/k092-ga4-events.json
//
// It blocks the remote gtag.js and outbound navigation, so the run is offline
// and repeatable. The inline GA4 wiring still runs (gtag() pushes to dataLayer
// even on a host the site disables for production GA), which is exactly what we
// need to assert payloads. Exit 1 if any expected event or property is missing.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

function parseArgs(argv) {
  const out = { baseUrl: null, imported: null, local: null, out: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--base-url') out.baseUrl = argv[++i];
    else if (k === '--imported') out.imported = argv[++i];
    else if (k === '--local') out.local = argv[++i];
    else if (k === '--out') out.out = argv[++i];
    else if (k === '--help' || k === '-h') out.help = true;
    else throw new Error(`unknown argument: ${k}`);
  }
  return out;
}

const USAGE = 'usage: node scripts/verify-ga4-imports.mjs --base-url URL --imported PATH [--local PATH] [--out FILE]';

function eventsOf(dataLayer) {
  return dataLayer
    .map((entry) => {
      const a = Array.from(entry || []);
      return { kind: a[0], name: typeof a[1] === 'string' ? a[1] : String(a[1] ?? ''), params: a[2] || null };
    })
    .filter((e) => e.kind === 'event');
}

async function readEvents(page) {
  const raw = await page.evaluate(() => (window.dataLayer || []).map((a) => Array.from(a || [])));
  return eventsOf(raw);
}

async function clearEvents(page) {
  await page.evaluate(() => { if (Array.isArray(window.dataLayer)) window.dataLayer.length = 0; });
}

/** Prevent the default navigation but let the document-level GA listener run. */
async function clickWithoutNavigating(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    el.addEventListener('click', (e) => e.preventDefault(), { once: true });
    el.click();
    return true;
  }, selector);
}

function check(assertions, name, pass, detail = '') {
  assertions.push({ name, pass: !!pass, detail });
}

function pick(events, name) {
  return events.filter((e) => e.name === name);
}

export async function verify({ baseUrl, imported, local = null, out = null, browser = null } = {}) {
  if (!baseUrl || !imported) throw new Error('--base-url and --imported are required');
  const ownBrowser = !browser;
  const b = browser || await chromium.launch();
  const context = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const assertions = [];
  const captured = { imported: {}, available: {}, local: {} };

  // Offline: the payload assertions are about the site's own code, not Google.
  await context.route('**/googletagmanager.com/**', (route) => route.abort());
  await context.route('**/google-analytics.com/**', (route) => route.abort());
  await context.route('**/wa.me/**', (route) => route.abort());
  await context.route('**/api.whatsapp.com/**', (route) => route.abort());

  try {
    // --- imported detail page ------------------------------------------------
    const res = await page.goto(baseUrl + imported, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);
    const loaded = await page.evaluate(() => typeof window.gtag === 'function' && Array.isArray(window.dataLayer));
    check(assertions, 'imported page: gtag + dataLayer exist', loaded, `HTTP ${res?.status()}`);
    const importId = (imported.match(/imp-[a-z0-9]+/i) || [])[0] || '';
    const breed = (imported.match(/\/puppies\/([^/]+)\//) || [])[1] || '';
    const viewEvents = pick(await readEvents(page), 'import_view');
    captured.imported.view = viewEvents;
    check(assertions, 'imported page: import_view fires once', viewEvents.length === 1, `count=${viewEvents.length}`);
    const view = viewEvents[0]?.params || {};
    check(assertions, 'import_view: listing_type=imported', view.listing_type === 'imported', JSON.stringify(view));
    check(assertions, 'import_view: import_id matches the URL', view.import_id === importId, `${view.import_id} vs ${importId}`);
    check(assertions, 'import_view: breed matches the URL', view.breed === breed, `${view.breed} vs ${breed}`);
    check(assertions, 'import_view: page_path matches the URL', view.page_path === imported, `${view.page_path} vs ${imported}`);

    await clearEvents(page);
    const waClicked = await clickWithoutNavigating(page, 'a[data-wa-source^="import:"][href*="wa.me"]');
    await page.waitForTimeout(200);
    const waEvents = pick(await readEvents(page), 'whatsapp_click');
    captured.imported.whatsapp = waEvents;
    check(assertions, 'imported page: WhatsApp link found', waClicked, 'a[data-wa-source^="import:"][href*="wa.me"]');
    check(assertions, 'imported page: whatsapp_click fires once', waEvents.length === 1, `count=${waEvents.length}`);
    const wa = waEvents[0]?.params || {};
    check(assertions, 'whatsapp_click (imported): listing_type=imported', wa.listing_type === 'imported', JSON.stringify(wa));
    check(assertions, 'whatsapp_click (imported): wa_source carries import:<id>', String(wa.wa_source || '').includes(`import:${importId}`), String(wa.wa_source || ''));
    check(assertions, 'whatsapp_click (imported): wa_source carries the page path', String(wa.wa_source || '').includes(imported), String(wa.wa_source || ''));

    await clearEvents(page);
    const phoneClicked = await clickWithoutNavigating(page, 'a[href^="tel:"]');
    await page.waitForTimeout(200);
    const phoneEvents = pick(await readEvents(page), 'phone_click');
    captured.imported.phone = phoneEvents;
    check(assertions, 'imported page: phone link found', phoneClicked, 'a[href^="tel:"]');
    check(assertions, 'imported page: phone_click fires once', phoneEvents.length === 1, `count=${phoneEvents.length}`);
    const phone = phoneEvents[0]?.params || {};
    check(assertions, 'phone_click (imported): listing_type=imported', phone.listing_type === 'imported', JSON.stringify(phone));

    // --- /available-puppies/ filter chips -----------------------------------
    await page.goto(baseUrl + '/available-puppies/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);
    const chips = await page.$$eval('[data-import-filter]', (els) => els.map((e) => e.getAttribute('data-import-filter')));
    check(assertions, 'available-puppies: chip bar present', chips.length === 3, JSON.stringify(chips));
    captured.available.chips = [];
    for (const value of ['all', 'local', 'imported']) {
      await clearEvents(page);
      const clicked = await page.evaluate((v) => {
        const el = document.querySelector(`[data-import-filter="${v}"]`);
        if (!el) return false;
        el.click();
        return true;
      }, value);
      await page.waitForTimeout(150);
      const ev = pick(await readEvents(page), 'import_filter_click');
      captured.available.chips.push({ value, events: ev });
      check(assertions, `filter chip "${value}": chip exists`, clicked, '');
      check(assertions, `filter chip "${value}": import_filter_click fires once`, ev.length === 1, `count=${ev.length}`);
      const p = ev[0]?.params || {};
      check(assertions, `filter chip "${value}": filter_value=${value}`, p.filter_value === value, JSON.stringify(p));
      check(assertions, `filter chip "${value}": listing_type=imported`, p.listing_type === 'imported', JSON.stringify(p));
      check(assertions, `filter chip "${value}": filter_label present`, typeof p.filter_label === 'string' && p.filter_label.length > 0, JSON.stringify(p));
      check(assertions, `filter chip "${value}": page_path`, p.page_path === '/available-puppies/', JSON.stringify(p));
    }

    await clearEvents(page);
    const detailsClicked = await clickWithoutNavigating(page, 'a[data-card-action="import_details"]');
    await page.waitForTimeout(200);
    const detailsEvents = pick(await readEvents(page), 'import_details_click');
    captured.available.details = detailsEvents;
    check(assertions, 'available-puppies: imported details link found', detailsClicked, 'a[data-card-action="import_details"]');
    check(assertions, 'import_details_click fires once', detailsEvents.length === 1, `count=${detailsEvents.length}`);
    const details = detailsEvents[0]?.params || {};
    check(assertions, 'import_details_click: listing_type=imported', details.listing_type === 'imported', JSON.stringify(details));
    check(assertions, 'import_details_click: wa_source carries import:<id>', /import:imp-[a-z0-9]+/i.test(String(details.wa_source || '')), String(details.wa_source || ''));

    // --- local inventory: the same WhatsApp event, listing_type=local --------
    if (local) {
      await page.goto(baseUrl + local, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(400);
      await clearEvents(page);
      const localClicked = await clickWithoutNavigating(page, 'a[data-wa-source^="pup:"][href*="wa.me"]');
      await page.waitForTimeout(200);
      const localEvents = pick(await readEvents(page), 'whatsapp_click');
      captured.local.whatsapp = localEvents;
      check(assertions, 'local page: pup WhatsApp link found', localClicked, 'a[data-wa-source^="pup:"][href*="wa.me"]');
      check(assertions, 'local page: whatsapp_click fires once', localEvents.length === 1, `count=${localEvents.length}`);
      const lp = localEvents[0]?.params || {};
      check(assertions, 'whatsapp_click (local): listing_type=local', lp.listing_type === 'local', JSON.stringify(lp));
      check(assertions, 'whatsapp_click (local): wa_source carries pup:<id>', /pup:\d+/.test(String(lp.wa_source || '')), String(lp.wa_source || ''));
    }

    // No private fixture values may appear in any payload.
    const all = JSON.stringify(captured);
    check(assertions, 'no seller name in captured payloads', !/Siobhan Kearney/i.test(all), '');
    check(assertions, 'no microchip in captured payloads', !/\b\d{15}\b/.test(all), '');

    const pass = assertions.every((a) => a.pass);
    const report = { baseUrl, imported, local, pass, assertions, captured };
    if (out) {
      fs.mkdirSync(out.replace(/[\\/][^\\/]+$/, ''), { recursive: true });
      fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
    }
    return report;
  } finally {
    await context.close();
    if (ownBrowser) await b.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(`verify-ga4: ${e.message}`);
    console.error(USAGE);
    process.exitCode = 2;
  }
  if (args && (args.help || !args.baseUrl || !args.imported)) {
    console.log(USAGE);
    process.exitCode = args && args.help ? 0 : 2;
  } else if (args) {
    verify(args).then((r) => {
      for (const a of r.assertions) console.log(`${a.pass ? 'PASS' : 'FAIL'} ${a.name}${a.detail ? ` — ${a.detail}` : ''}`);
      console.log(`verify-ga4: ${r.assertions.filter((a) => a.pass).length}/${r.assertions.length} assertions pass`);
      process.exitCode = r.pass ? 0 : 1;
    }, (e) => {
      console.error(`verify-ga4: ${e?.message || e}`);
      process.exitCode = 1;
    });
  }
}
