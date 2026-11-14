// K-119 preview smoke test: status, noindex, surcharge, payment line, phone pair.
import { chromium } from 'playwright';
const base = process.argv[2] ?? 'https://preview.curioustails-staging.pages.dev';
const routes = ['/', '/puppies/maltipoo/', '/puppies/cavapoo/', '/puppies/corgi/', '/puppies/cavalier-king-charles-spaniel/', '/learn/puppy-health/'];
const browser = await chromium.launch();
let bad = 0;
for (const width of [1440, 390]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  for (const r of routes) {
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    const resp = await page.goto(base + r, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 800) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 30)); } window.scrollTo(0, 0); });
    await page.waitForTimeout(400);
    const info = await page.evaluate(() => ({
      robots: document.querySelector('meta[name="robots"]')?.content ?? '',
      sw: document.documentElement.scrollWidth,
      vw: document.documentElement.clientWidth,
      text: document.body.innerText,
      all: document.body.textContent ?? '',
    }));
    const isBreed = /^\/puppies\/[a-z-]+\/$/.test(r);
    const gated = r === '/' || isBreed;
    const surcharge = /3% bank surcharge/.test(info.all);
    const pay = /Pay by PayNow, bank transfer, cash or credit card/.test(info.all);
    const phones = /8268 4039/.test(info.all) && /6255 6064/.test(info.all);
    const overflow = info.sw > info.vw + 1;
    let ok = resp.status() === 200 && !overflow && errors.length === 0
      && (!gated || surcharge) && (!isBreed || (pay && phones))
      && (r !== '/' || (/8268 4039/.test(info.all) && /PayNow/.test(info.all)));
    const xr = resp.headers()['x-robots-tag'] ?? '';
    const noindex = /noindex/i.test(xr) || /noindex/i.test(info.robots);
    if (!noindex) ok = false;
    if (!ok) bad++;
    console.log(`${width} ${r} status=${resp.status()} robots="${info.robots.slice(0, 40)}" noindex=${noindex} sw=${info.sw} vw=${info.vw} err=${errors.length} surcharge=${surcharge} pay=${pay} phones=${phones} ${ok ? 'ok' : 'FAIL'}`);
    if (errors.length) console.log('   ' + errors.slice(0, 3).join(' | '));
    await page.close();
  }
  await ctx.close();
}
await browser.close();
console.log(bad ? `FAIL preview smoke: ${bad}` : 'PASS preview smoke');
process.exit(bad ? 1 : 0);
