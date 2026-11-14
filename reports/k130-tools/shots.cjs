// K-130: screenshots + layout facts for puppy pages. Usage: node shots.cjs <baseUrl> <path>... 
const { chromium } = require('playwright');
const base = process.argv[2];
const paths = process.argv.slice(3);
const widths = (process.env.WIDTHS || '1440,390').split(',').map(Number);
(async () => {
  const browser = await chromium.launch();
  const out = [];
  for (const path of paths) {
    for (const w of widths) {
      const page = await browser.newPage({ viewport: { width: w, height: w < 500 ? 844 : 900 } });
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      await page.goto(base + path, { waitUntil: 'networkidle' });
      const fold = await page.evaluate(() => {
        const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return Math.round(b.bottom + scrollY); };
        return { h1: r('#pup-h1'), price: r('.pricecard'), cta: r('#hero-ctas .btn'), overflow: document.documentElement.scrollWidth > innerWidth,
          map: r('.map'), licence: r('.licence'), sections: document.querySelector('[data-puppy-page]')?.dataset.sections };
      });
      // reveal everything before the full-page shot
      await page.evaluate(async () => { document.querySelectorAll('[data-reveal]').forEach((e) => e.classList.add('reveal-in')); });
      await page.waitForTimeout(500);
      const name = path.replace(/\/$/, '').split('/').slice(-2).join('_') + `-${w}.png`;
      await page.screenshot({ path: `reports/k130-shots/${name}`, fullPage: true });
      out.push({ path, w, ...fold, errors });
      await page.close();
    }
  }
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})();
