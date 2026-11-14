// K-129: screenshot the three breed samples against the live preview.
import { chromium } from 'playwright';
const base = process.argv[2] ?? 'https://k129-content-gap.curioustails-sg.pages.dev';
const routes = ['/puppies/maltipoo/', '/puppies/cavapoo/', '/puppies/corgi/'];
const browser = await chromium.launch();
for (const width of [1440, 390]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  for (const r of routes) {
    const page = await ctx.newPage();
    await page.goto(base + r, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 900) {
        window.scrollTo(0, y);
        await new Promise((res) => setTimeout(res, 30));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(400);
    const slug = r.split('/').filter(Boolean).pop();
    await page.screenshot({ path: `reports/k129-shots/${slug}-${width}.png`, fullPage: true });
    console.log(`${width} ${r} saved`);
    await page.close();
  }
  await ctx.close();
}
await browser.close();
