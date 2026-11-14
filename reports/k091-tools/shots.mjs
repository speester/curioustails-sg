// K-091 rendered-sample harness: screenshots at 1440 and 390, console errors,
// horizontal overflow, and the T23 chip behaviour. Run against `npm run preview`.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.K091_BASE || 'http://localhost:4331';
const OUT = 'reports/k091-shots';
mkdirSync(OUT, { recursive: true });

const pages = [
  { slug: 'breed-jack-russell', path: '/puppies/jack-russell-terrier/' },
  { slug: 'imported-detail', path: '/puppies/jack-russell-terrier/imp-7f3a2c91de/' },
  { slug: 'available-puppies', path: '/available-puppies/' },
];

const sizes = [
  { w: 1440, h: 900 },
  { w: 390, h: 844 },
];

const browser = await chromium.launch();
const report = { pages: [], chips: null, errors: [] };

for (const p of pages) {
  for (const s of sizes) {
    const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));
    const res = await page.goto(BASE + p.path, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    const metrics = await page.evaluate(() => {
      const de = document.documentElement;
      const vw = window.innerWidth;
      const offenders = [];
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && (r.right > vw + 1 || r.left < -1)) {
          const st = getComputedStyle(el);
          if (st.position === 'fixed' || st.overflow === 'hidden') continue;
          offenders.push({ tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 90), left: Math.round(r.left), right: Math.round(r.right) });
        }
      }
      return {
        viewport: vw,
        scrollWidth: de.scrollWidth,
        clientWidth: de.clientWidth,
        overflow: de.scrollWidth > de.clientWidth + 1,
        offenders: offenders.slice(0, 8),
        title: document.title,
        canonical: document.querySelector('link[rel=canonical]')?.getAttribute('href') || null,
        robots: document.querySelector('meta[name=robots]')?.getAttribute('content') || null,
        preorder: document.body.innerHTML.includes('https://schema.org/PreOrder'),
      };
    });
    await page.screenshot({ path: `${OUT}/${p.slug}-${s.w}.png`, fullPage: true });
    report.pages.push({ path: p.path, width: s.w, status: res?.status(), consoleErrors, ...metrics });
    await ctx.close();
  }
}

// T23 chips: focus, click, aria-pressed, and which groups stay visible.
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/available-puppies/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  const chipData = [];
  for (const value of ['local', 'imported', 'all']) {
    const btn = page.locator(`[data-import-filter="${value}"]`);
    await btn.focus();
    const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-import-filter'));
    await btn.click();
    await page.waitForTimeout(150);
    const state = await page.evaluate(() => ({
      pressed: Array.from(document.querySelectorAll('[data-import-filter]')).map((b) => [b.getAttribute('data-import-filter'), b.getAttribute('aria-pressed')]),
      visibleLocal: Array.from(document.querySelectorAll('[data-listing-group="local"]')).filter((g) => !g.hidden).length,
      hiddenLocal: Array.from(document.querySelectorAll('[data-listing-group="local"]')).filter((g) => g.hidden).length,
      visibleImported: Array.from(document.querySelectorAll('[data-import-section="imported"]')).filter((g) => !g.hidden).length,
    }));
    chipData.push({ value, focused, ...state });
  }
  await page.locator('[data-import-filter="imported"]').click();
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${OUT}/available-puppies-imported-filter-1440.png`, fullPage: true });
  report.chips = chipData;
  await ctx.close();
}

await browser.close();
console.log(JSON.stringify(report, null, 2));
