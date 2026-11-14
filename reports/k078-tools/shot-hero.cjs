const { chromium } = require('playwright');
const path = require('path');

const URL = 'https://curioustails-staging.pages.dev/outputs/';
const OUT = path.join(__dirname, '..', 'k078-shots');

(async () => {
  const browser = await chromium.launch();
  for (const [name, width, height] of [['1440', 1440, 1000], ['390', 390, 844]]) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.addStyleTag({ content: '.util,.hdr,#sticky{display:none!important}[data-reveal]{opacity:1!important;transform:none!important;transition:none!important}' });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(250);
    const el = page.locator('.hero .buy');
    await el.screenshot({ path: path.join(OUT, `hero-date-${name}.png`) });
    await ctx.close();
  }
  await browser.close();
})();
