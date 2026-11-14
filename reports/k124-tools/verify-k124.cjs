// K-124 verification: section order, passport gone, anchors resolve, map vs licence bottom edge,
// 390 overflow and console errors. TARGET_URL defaults to a local static server on _k002_stage.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = process.env.TARGET_URL || 'http://127.0.0.1:8791/outputs/';
const OUT = process.env.SHOT_DIR || path.join(__dirname, '..', 'k124-shots');
const TAG = process.env.TAG || 'local';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const results = { url: URL };
  for (const [width, height] of [[1440, 1000], [1280, 900], [1024, 900], [768, 900], [390, 844]]) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const consoleErrors = [], pageErrors = [], failed = [];
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('pageerror', e => pageErrors.push(String(e)));
    page.on('requestfailed', r => failed.push(r.url() + ' :: ' + (r.failure() && r.failure().errorText)));
    const resp = await page.goto(URL, { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
      const h = document.documentElement.scrollHeight;
      for (let y = 0; y < h; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 15)); }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(400);
    const data = await page.evaluate(() => {
      const q = s => document.querySelector(s);
      const r = el => { const b = el.getBoundingClientRect(); return { top: +(b.top + scrollY).toFixed(1), bottom: +(b.bottom + scrollY).toFixed(1), h: +b.height.toFixed(1), w: +b.width.toFixed(1) }; };
      const order = [...document.querySelectorAll('main > section')]
        .filter(s => getComputedStyle(s).display !== 'none')
        .map(s => { const h = s.querySelector('h1,h2'); const vis = h && [...h.querySelectorAll('span')].find(x => getComputedStyle(x).display !== 'none'); return (vis || h).innerText.trim(); });
      const anchors = [...document.querySelectorAll('a[href^="#"]')].map(a => ({ href: a.getAttribute('href'), ok: !!document.getElementById(a.getAttribute('href').slice(1)) }));
      const licence = q('.licence'), map = q('.map'), wrap = q('.map-wrap'), btn = q('.map-open');
      return {
        order,
        passport: { node: !!q('.passport, #pp-h, [aria-labelledby="pp-h"]'), text: /passport/i.test(document.body.innerText) },
        anchors,
        licence: r(licence), map: r(map), mapWrap: r(wrap), mapOpen: r(btn),
        mapAspect: +(map.getBoundingClientRect().width / map.getBoundingClientRect().height).toFixed(3),
        btnInsideMap: map.contains(btn),
        overflow: { scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth },
        fffd: (document.body.innerText.match(/�/g) || []).length,
      };
    });
    data.status = resp.status();
    data.levelDelta = +(data.map.bottom - data.licence.bottom).toFixed(1);
    data.consoleErrors = consoleErrors; data.pageErrors = pageErrors; data.failed = failed;
    await page.locator('.visit').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.locator('.visit').screenshot({ path: path.join(OUT, `${TAG}-visit-${width}.png`) });
    if (width === 1440 || width === 390) await page.screenshot({ path: path.join(OUT, `${TAG}-full-${width}.png`), fullPage: true });
    if (width === 1440) {
      await page.locator('#about').scrollIntoViewIfNeeded();
      await page.locator('#families').screenshot({ path: path.join(OUT, `${TAG}-families-${width}.png`) });
    }
    results[width] = data;
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, `${TAG}-verify.json`), JSON.stringify(results, null, 2));
  for (const w of [1440, 1280, 1024, 768, 390]) {
    const d = results[w];
    console.log(`${w}: status ${d.status} | map bottom ${d.map.bottom} licence bottom ${d.licence.bottom} delta ${d.levelDelta} | map ${d.map.w}x${d.map.h} aspect ${d.mapAspect} | btnInsideMap ${d.btnInsideMap} | scroll ${d.overflow.scrollWidth}/${d.overflow.clientWidth} | console ${d.consoleErrors.length} pageerr ${d.pageErrors.length} failed ${d.failed.length} | passport ${JSON.stringify(d.passport)} | bad anchors ${d.anchors.filter(a => !a.ok).length}/${d.anchors.length}`);
  }
  console.log('ORDER(1440):\n  ' + results[1440].order.join('\n  '));
  console.log('ERRORS(390):', JSON.stringify(results[390].consoleErrors), JSON.stringify(results[390].failed));
})();
