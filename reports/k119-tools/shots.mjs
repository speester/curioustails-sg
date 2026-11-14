// K-119: screenshots of the price blocks and hero at 1440 and 390.
import fs from 'node:fs';
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:4329';
const out = 'reports/k119-shots';
fs.mkdirSync(out, { recursive: true });
const targets = [
  ['home-hero', '/', 'section.hero'],
  ['home-price', '/', '#pricing'],
  ['maltipoo-hero', '/puppies/maltipoo/', 'section.hero'],
  ['maltipoo-price', '/puppies/maltipoo/', '#price'],
  ['corgi-price', '/puppies/corgi/', '#price'],
];

const browser = await chromium.launch();
for (const width of [1440, 390]) {
  const ctx = await browser.newContext({ viewport: { width, height: 1000 }, deviceScaleFactor: 1 });
  for (const [name, route, sel] of targets) {
    const page = await ctx.newPage();
    await page.goto(base + route, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 25)); }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(400);
    const el = page.locator(sel).first();
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    await el.screenshot({ path: `${out}/${name}-${width}.png` });
    const box = await el.boundingBox();
    console.log(`${name}-${width}.png  ${Math.round(box.width)}x${Math.round(box.height)}`);
    await page.close();
  }
  await ctx.close();
}
await browser.close();
