const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  for (const width of [1023, 1024, 1100, 1280, 1600]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto('http://127.0.0.1:8791/outputs/', { waitUntil: 'networkidle' });
    const data = await page.evaluate(() => {
      const q = s => document.querySelector(s);
      const b = s => { const el = q(s); const r = el.getBoundingClientRect(); return { x: Math.round(r.x), w: Math.round(r.width), right: Math.round(r.right), h: Math.round(r.height) }; };
      const p = b('.dossier-portrait');
      const cards = [...document.querySelectorAll('.dossier-card')].map(el => b('.dossier-card') && null);
      const cs = [...document.querySelectorAll('.dossier-card')].map(el => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), w: Math.round(r.width), ml: getComputedStyle(el).marginLeft }; });
      return {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        portrait: p,
        cards: cs,
        overlap: [Math.round(p.right - cs[1].x), Math.round(p.right - cs[2].x)],
        firstGap: Math.round(cs[0].x - p.right),
        tag: getComputedStyle(q('.dossier-tag')).display,
        h2: getComputedStyle(q('#about-h')).fontSize,
      };
    }).catch(e => ({ error: String(e) }));
    console.log(width, JSON.stringify(data), 'errors:', errors.length);
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
