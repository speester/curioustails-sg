const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  for (const [name, width, height] of [['1440', 1440, 1000], ['390', 390, 844]]) {
    const ctx = await browser.newContext({ viewport: { width, height } });
    const page = await ctx.newPage();
    await page.goto('http://127.0.0.1:8791/outputs/', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.body.classList.add('is-placed'));
    await page.waitForTimeout(100);
    const data = await page.evaluate(() => {
      const q = s => document.querySelector(s);
      const visible = el => !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0;
      const card = [...document.querySelectorAll('.dossier-card')][2];
      return {
        eyebrow: q('.dossier-eyebrow').innerText.replace(/\s+/g, ' ').trim(),
        card3: card.innerText.replace(/\s+/g, ' ').trim(),
        avCtaVisible: visible(q('.dossier-cta.only-av')),
        placedCtaVisible: visible(q('.dossier-cta.only-placed')),
        placedCtaDisplay: q('.dossier-cta.only-placed') ? getComputedStyle(q('.dossier-cta.only-placed')).display : null,
        placedTextVisible: visible(card.querySelector('p.only-placed')),
        avTextVisible: visible(card.querySelector('p.only-av')),
      };
    });
    console.log(name, JSON.stringify(data, null, 2));
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
