// K-145 verification: two channel sections, layout, reduced motion, GA channel_join payloads, weight.
//   node reports/k145-verify.cjs <url> <outDir> [beforeUrl]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const [url, out, beforeUrl] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });

const isCollect = (u) => /google-analytics\.com\/(g\/)?collect|analytics\.google\.com\/g\/collect/.test(u);
const parseHits = (req) => {
  const u = new URL(req.url());
  const base = Object.fromEntries(u.searchParams);
  const body = req.postData();
  // GA4 batches several events as newline-separated query strings in the POST body.
  const lines = body ? body.split('\n').filter(Boolean) : [''];
  return lines.map((l) => ({ ...base, ...Object.fromEntries(new URLSearchParams(l)) }));
};

async function weigh(browser, u) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const reqs = [];
  page.on('requestfinished', (r) => reqs.push(r));
  await page.goto(u, { waitUntil: 'networkidle' });
  const initial = reqs.length;
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(800);
  const rows = [];
  for (const r of reqs) {
    const s = await r.sizes().catch(() => null);
    rows.push({ url: r.url().replace(/\?.*/, ''), type: r.resourceType(), bytes: s ? s.responseBodySize + s.responseHeadersSize : 0 });
  }
  await ctx.close();
  const sum = (a) => a.reduce((n, r) => n + r.bytes, 0);
  const own = rows.filter((r) => !/fonts\.(googleapis|gstatic)\.com/.test(r.url));
  return { requests: rows.length, initialRequests: initial, totalBytes: sum(rows), ownBytes: sum(own), rows };
}

(async () => {
  const browser = await chromium.launch();
  const result = { url, layouts: {}, ga: {} };

  for (const [w, h] of [[1440, 900], [390, 844]]) {
    for (const rm of ['no-preference', 'reduce']) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: rm });
      const page = await ctx.newPage();
      const errors = [];
      const collects = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      page.on('request', (r) => isCollect(r.url()) && collects.push(r.url()));
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(400);
      const m = await page.evaluate(() => {
        const cv = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
        const rgb = (c) => { cv.clearRect(0, 0, 1, 1); cv.fillStyle = '#fff'; cv.fillRect(0, 0, 1, 1); cv.fillStyle = c; cv.fillRect(0, 0, 1, 1); return [...cv.getImageData(0, 0, 1, 1).data].slice(0, 3); };
        const lum = (c) => {
          const v = rgb(c).map((x) => x / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
          return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
        };
        const sections = [...document.querySelectorAll('main > section.cj')].map((s) => {
          const r = s.getBoundingClientRect();
          const a = s.querySelector('a[data-cj-channel]');
          const ar = a.getBoundingClientRect();
          const visHidden = [...s.querySelectorAll('h2, p, a, li, figcaption, img')].filter((e) => {
            if (e.closest('.cj-sr') || e.classList.contains('cj-sr')) return false;
            const cs = getComputedStyle(e);
            const er = e.getBoundingClientRect();
            return cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0 || er.width === 0 || er.height === 0;
          }).map((e) => e.className || e.tagName);
          return {
            id: s.id, ch: s.querySelector('[data-ch]').dataset.ch,
            h2: s.querySelector('h2').textContent.trim(),
            sub: s.querySelector('.cj-sub').textContent.trim(),
            box: [r.left, r.right, r.width].map((n) => Math.round(n)),
            ctaCount: s.querySelectorAll('a[data-cj-channel]').length,
            cta: { href: a.href, channel: a.dataset.cjChannel, section: a.dataset.cjSection, layout: [a.offsetWidth, a.offsetHeight], right: Math.round(ar.right) },
            proof: s.querySelector('.cj-phone') ? 'phone-demo' : s.querySelector('.cj-strip') ? 'post-strip' : 'none',
            stripCards: s.querySelectorAll('.cj-sp').length,
            hiddenContent: visHidden,
          };
        });
        // Contrast of every visible text run against white or the nearest painted background colour.
        const paper = getComputedStyle(document.documentElement).getPropertyValue('--cj-paper').trim();
        const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (!/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor)) return cs.backgroundColor; if (cs.backgroundImage !== 'none') return paper; } return 'rgb(255,255,255)'; };
        const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return +((x + 0.05) / (y + 0.05)).toFixed(2); };
        const contrast = {};
        for (const sel of ['.cj-title', '.cj-sub', '.cj-stk-txt b', '.cj-stk-txt small', '.cj-strip-label', '.cj-strip-note', '.cj-sp-cap b', '.cj-sp-price', '.cj-sp-meta']) {
          const e = document.querySelector(sel);
          if (e) contrast[sel] = { fg: rgb(getComputedStyle(e).color).join(','), bg: rgb(bgOf(e)).join(','), ratio: ratio(getComputedStyle(e).color, bgOf(e)) };
        }
        return {
          scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth,
          sections,
          h2s: [...document.querySelectorAll('h2')].map((e) => e.textContent.trim()),
          segmentedControl: document.querySelectorAll('.cj-seg, [aria-pressed]').length,
          phones: document.querySelectorAll('.cj-phone').length,
          runningAnimations: document.getAnimations().filter((a) => a.playState === 'running').length,
          gaDisabled: Object.keys(window).filter((k) => k.startsWith('ga-disable-')).map((k) => [k, window[k]]),
          gtagScript: !!document.querySelector('script[src*="googletagmanager"]'),
          contrast,
        };
      });
      m.errors = errors;
      m.collectRequestsWithoutOptIn = collects.length;
      const tag = `${w}-${rm === 'reduce' ? 'reduced' : 'motion'}`;
      await page.screenshot({ path: path.join(out, `full-${tag}.png`), fullPage: true });
      result.layouts[tag] = m;
      await ctx.close();
    }
  }

  // GA: with ?ga_test=1, activate each CTA by mouse and by keyboard (Tab focus + Enter) and capture the hits.
  const sep = url.includes('?') ? '&' : '?';
  for (const mode of ['mouse', 'keyboard']) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.route(/(^https?:\/\/t\.me\/|whatsapp\.com\/channel)/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>stub</title>' }));
    const page = await ctx.newPage();
    const hits = [];
    const popups = [];
    ctx.on('request', (r) => { if (isCollect(r.url())) parseHits(r).forEach((h) => hits.push({ transport: r.resourceType(), method: r.method(), ...h })); });
    ctx.on('page', (p) => popups.push(p));
    await page.goto(url + sep + 'ga_test=1', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    for (const key of ['whatsapp', 'telegram']) {
      const sel = `a[data-cj-channel="${key}"]`;
      if (mode === 'mouse') {
        await page.click(sel);
      } else {
        // Real keyboard path: Tab until the link has focus, then Enter.
        await page.evaluate(() => document.activeElement && document.activeElement.blur());
        await page.focus('body');
        for (let i = 0; i < 10; i++) {
          await page.keyboard.press('Tab');
          if (await page.evaluate((s) => document.activeElement === document.querySelector(s), sel)) break;
        }
        await page.keyboard.press('Enter');
      }
      await page.waitForTimeout(2500);
    }
    await page.waitForTimeout(3000);
    result.ga[mode] = {
      popupUrls: popups.map((p) => p.url()),
      channelJoin: hits.filter((h) => h.en === 'channel_join').map((h) => ({
        transport: h.transport, method: h.method, tid: h.tid, en: h.en, _dbg: h._dbg,
        'ep.channel': h['ep.channel'], 'ep.section': h['ep.section'], 'ep.environment': h['ep.environment'],
        'ep.page_location': h['ep.page_location'], dl: h.dl, dh: h.dh,
        other_ep: Object.keys(h).filter((k) => /^e[pu][n]?\./.test(k) && !['ep.channel', 'ep.section', 'ep.environment', 'ep.page_location'].includes(k)),
        raw: Object.entries(h).filter(([k]) => !['transport', 'method'].includes(k)).map(([k, v]) => `${k}=${v}`).join('&'),
      })),
      allEvents: hits.map((h) => h.en),
    };
    await ctx.close();
  }

  // Same-tab path (an in-app browser that ignores target=_blank). CDP does not report a request
  // made by a document that is unloading, so an init script logs GA's own fetch / sendBeacon calls
  // and the page lifecycle to localStorage on the stage origin, read back after the navigation.
  for (const optIn of [true, false]) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const origin = new URL(url).origin;
    await ctx.addInitScript((origin) => {
      if (location.origin !== origin) return;
      const log = (m) => { try { const a = JSON.parse(localStorage.k145 || '[]'); a.push(Math.round(performance.now()) + 'ms ' + m); localStorage.k145 = JSON.stringify(a); } catch (e) {} };
      const ens = (u, b) => [String(u).split('?')[1] || '', ...String(b || '').split('\n')].map((l) => new URLSearchParams(l)).filter((p) => p.get('en')).map((p) => p.get('en') + (p.get('ep.channel') ? '/' + p.get('ep.channel') : ''));
      const f = window.fetch; window.fetch = function (u, o) { if (/collect/.test(String(u))) log('GA fetch keepalive=' + !!(o && o.keepalive) + ' ' + ens(u, o && o.body)); return f.apply(this, arguments); };
      const sb = navigator.sendBeacon.bind(navigator); navigator.sendBeacon = function (u, d) { if (/collect/.test(String(u))) log('GA beacon ' + ens(u, d)); return sb(u, d); };
      addEventListener('click', () => log('click'), true);
      addEventListener('pagehide', () => log('pagehide'));
    }, origin);
    const page = await ctx.newPage();
    await page.goto(url + (optIn ? sep + 'ga_test=1' : ''), { waitUntil: 'networkidle' });
    await page.evaluate(() => { localStorage.k145 = '[]'; document.querySelectorAll('a[data-cj-channel]').forEach((a) => a.removeAttribute('target')); });
    await page.waitForTimeout(1200);
    await page.click('a[data-cj-channel="whatsapp"]');
    await page.waitForURL(/whatsapp\.com\/channel/, { timeout: 15000 }).catch(() => {});
    const finalUrl = page.url();
    await page.waitForTimeout(1000);
    await page.goto(origin + '/robots.txt');
    const log = JSON.parse(await page.evaluate(() => localStorage.k145 || '[]'));
    result.ga['sameTab' + (optIn ? 'OptIn' : 'NoOptIn')] = { log, finalUrl };
    await ctx.close();
  }
  result.weight = { after: await weigh(browser, url) };
  if (beforeUrl) result.weight.before = await weigh(browser, beforeUrl);
  await browser.close();
  fs.writeFileSync(path.join(out, 'measure.json'), JSON.stringify(result, null, 1));
  console.log(JSON.stringify(result, (k, v) => (k === 'rows' ? undefined : v), 1));
})();
