const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  for (const width of [320, 360, 390, 414, 768, 1024, 1280, 1440]) {
    const page = await (await browser.newContext({ viewport: { width, height: 900 } })).newPage();
    await page.goto('https://curioustails-staging.pages.dev/outputs/', { waitUntil: 'domcontentloaded' });
    const r = await page.evaluate(() => {
      const el = document.querySelector('.pp-grid');
      const cols = getComputedStyle(el).gridTemplateColumns.split(' ').length;
      const overflowers = [...document.querySelectorAll('body *')].filter(e => {
        const b = e.getBoundingClientRect();
        return b.width > 0 && (b.right > document.documentElement.clientWidth + 1 || b.left < -1);
      }).slice(0, 4).map(e => e.tagName + '.' + (e.className || '').toString().slice(0, 30));
      return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, ppCols: cols, overflowers };
    });
    console.log(width, JSON.stringify(r));
    await page.context().close();
  }
  await browser.close();
})();
