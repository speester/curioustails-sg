// K-129: console errors + horizontal overflow at 1440 and 390 on the touched pages.
// Usage: node reports/k119-tools/viewport-check.mjs <baseUrl>
import { chromium } from 'playwright';
const base = process.argv[2] ?? 'http://127.0.0.1:4329';
const routes = ['/', '/puppies/maltipoo/', '/puppies/cavapoo/', '/puppies/corgi/', '/puppies/cavalier-king-charles-spaniel/', '/learn/puppy-health/'];
const widths = [1440, 390];
const browser = await chromium.launch();
let bad = 0;
for (const w of widths) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
  for (const r of routes) {
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    await page.goto(base + r, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 800) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } window.scrollTo(0, 0); });
    await page.waitForTimeout(500);
    const ov = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const sw = document.documentElement.scrollWidth;
      const offenders = [];
      for (const el of document.querySelectorAll('body *')) {
        const b = el.getBoundingClientRect();
        if (b.width && b.right > vw + 1) {
          let p = el, clipped = false;
          while ((p = p.parentElement)) { const s = getComputedStyle(p); if (/(hidden|clip|auto|scroll)/.test(s.overflowX)) { clipped = true; break; } }
          if (!clipped) offenders.push(el.tagName.toLowerCase() + '.' + String(el.className).slice(0, 50));
        }
      }
      return { vw, sw, offenders: offenders.slice(0, 5) };
    });
    const slug = r === '/' ? 'home' : r.split('/').filter(Boolean).pop();
    if (slug === 'home' || slug === 'maltipoo') await page.screenshot({ path: `reports/k129-shots/${slug}-${w}.png`, fullPage: true });
    const fail = errors.length || ov.sw > ov.vw;
    if (fail) bad++;
    console.log(`${String(w).padEnd(5)} ${r.padEnd(42)} scrollW=${ov.sw} vw=${ov.vw} consoleErr=${errors.length} ${fail ? 'FAIL' : 'ok'}`);
    for (const e of errors.slice(0, 3)) console.log('   err ' + e.slice(0, 200));
    if (ov.sw > ov.vw) console.log('   overflow ' + ov.offenders.join(' | '));
    await page.close();
  }
  await ctx.close();
}
await browser.close();
console.log(bad ? `FAIL ${bad}` : 'PASS viewport-check');
process.exit(bad ? 1 : 0);
