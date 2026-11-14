// K-129: section-level screenshots for the three breed samples.
import { chromium } from 'playwright';
const base = process.argv[2] ?? 'https://k129-content-gap.curioustails-sg.pages.dev';
const breeds = ['maltipoo', 'cavapoo', 'corgi'];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
for (const b of breeds) {
  const page = await ctx.newPage();
  await page.goto(`${base}/puppies/${b}/`, { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 900) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 25));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(300);
  const shots = [
    ['hero', page.locator('section.hero').first()],
    ['price', page.locator('#price').first()],
    ['timeline', page.locator('section', { has: page.locator('caption', { hasText: 'Vaccination and Licensing Timeline' }) }).first()],
    ['steps', page.locator('ol').filter({ hasText: 'WhatsApp us to confirm which puppy is available' }).first()],
    ['finalcta', page.locator('section', { hasText: `Meet Our ${b[0].toUpperCase()}${b.slice(1)}s at Balestier` }).first()],
  ];
  for (const [name, loc] of shots) {
    if (await loc.count() === 0) { console.log(`${b} ${name}: MISSING`); continue; }
    await loc.screenshot({ path: `reports/k129-shots/${b}-${name}.png` });
    console.log(`${b} ${name}: ok`);
  }
  await page.close();
}
await browser.close();
