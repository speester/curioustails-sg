const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  for (const [label, iso] of [
    ['utc-2026-11-13T02:00Z', '2026-11-13T02:00:00Z'],
    ['utc-2026-11-12T16:30Z', '2026-11-12T16:30:00Z'],
    ['utc-2026-11-13T16:30Z', '2026-11-13T16:30:00Z'],
  ]) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'America/Los_Angeles' });
    const page = await ctx.newPage();
    await page.clock.install({ time: new Date(iso) });
    await page.goto('http://127.0.0.1:8813/outputs/', { waitUntil: 'domcontentloaded' });
    const out = await page.evaluate(() => {
      const el = document.querySelector('.avail.only-av');
      const t = el && el.querySelector('time');
      return { text: el ? el.innerText.replace(/\s+/g, ' ').trim() : null, dt: t ? t.dateTime : null };
    });
    console.log(label, '->', out.text, '|', out.dt);
    await ctx.close();
  }
  await browser.close();
})();
