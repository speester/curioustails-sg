// K-149: demo in view (it now sits in the second section) - running animations, phone box, skin, end state.
const { chromium } = require('playwright');
const url = process.argv[2], out = process.argv[3];
(async () => {
  const b = await chromium.launch(); const res = {};
  for (const [w, h] of [[1440, 900], [390, 844]]) for (const rm of ['no-preference', 'reduce']) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, reducedMotion: rm });
    const p = await ctx.newPage(); await p.goto(url, { waitUntil: 'networkidle' });
    await p.locator('#section_whatsapp .cj-phone').scrollIntoViewIfNeeded(); await p.waitForTimeout(1500);
    const m = await p.evaluate(() => {
      const ph = document.querySelector('.cj-phone'), sec = ph.closest('section'), r = ph.getBoundingClientRect(), s = sec.getBoundingClientRect();
      const vis = (sel) => [...ph.querySelectorAll(sel)].filter((e) => getComputedStyle(e).display !== 'none' && +getComputedStyle(e).opacity > 0).map((e) => e.textContent.trim());
      return { phoneSection: sec.id, phone: [r.left, r.right, r.top, r.bottom].map(Math.round), section: [s.left, s.right, s.top, s.bottom].map(Math.round),
        insideSection: r.left >= s.left && r.right <= s.right && r.top >= s.top && r.bottom <= s.bottom,
        headSkin: getComputedStyle(ph.querySelector('.cj-head')).backgroundColor,
        running: document.getAnimations().filter((a) => a.playState === 'running').length,
        ctaB: vis('.cj-cta-b [data-show]'), toast: vis('.cj-toast'), bellOn: +getComputedStyle(ph.querySelector('.cj-bell-on')).opacity,
        stripSection: document.querySelector('.cj-strip').closest('section').id, stripBg: getComputedStyle(document.querySelector('.cj-strip-row')).backgroundColor,
        scrollWidth: document.documentElement.scrollWidth };
    });
    const tag = `${w}-${rm === 'reduce' ? 'reduced' : 'motion'}`;
    await p.locator('#section_whatsapp').screenshot({ path: `${out}/wa-section-${tag}.png` });
    res[tag] = m; await ctx.close();
  }
  await b.close(); console.log(JSON.stringify(res, null, 1));
})();
