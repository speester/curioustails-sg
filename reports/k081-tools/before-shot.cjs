const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = process.env.TARGET_URL || 'https://curioustails-staging.pages.dev/outputs/';
const OUT = process.env.SHOT_DIR || path.join(__dirname, '..', 'k081-shots');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  for (const [name, width, height] of [['1440', 1440, 1000], ['390', 390, 844]]) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const resp = await page.goto(URL, { waitUntil: 'networkidle' });
    console.log(name, 'status', resp.status());
    await page.evaluate(async () => {
      const h = document.documentElement.scrollHeight;
      for (let y = 0; y < h; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 15)); }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(300);
    await page.addStyleTag({ content: '.util,.hdr,#sticky{display:none!important}[data-reveal]{opacity:1!important;transform:none!important;transition:none!important}' });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);
    const clip = await page.evaluate(sel => {
      const el = document.querySelector(sel);
      const b = el.getBoundingClientRect();
      return { x: b.x + window.scrollX, y: b.y + window.scrollY, width: b.width, height: b.height };
    }, '.band--about');
    await page.screenshot({ path: path.join(OUT, `before-about-${name}.png`), fullPage: true, clip });
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
