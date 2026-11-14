// K-130: viewport-sized shots at given scroll offsets (selectors). node viewport.cjs <url> <width> <sel>...
const { chromium } = require('playwright');
const [url, w, ...sels] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: Number(w), height: Number(w) < 500 ? 844 : 900 } });
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.querySelectorAll('[data-reveal]').forEach((e) => e.classList.add('reveal-in')));
  for (const s of ['top', ...sels]) {
    if (s !== 'top') await p.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'start' }), s);
    await p.waitForTimeout(400);
    const tag = url.split('/').filter(Boolean).pop();
    await p.screenshot({ path: `reports/k130-shots/vp-${tag}-${w}-${s.replace(/[^a-z]/gi, '')}.png` });
  }
  await b.close();
})();
