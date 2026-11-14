// K-144 verification: sticker tilt geometry, overflow, hover/active/reduced-motion.
const { chromium } = require('playwright');
const url = process.argv[2];
const out = process.argv[3];
(async () => {
  const browser = await chromium.launch();
  const result = {};
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    for (const rm of ['no-preference', 'reduce']) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: rm, hasTouch: false });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(String(e)));
      page.on('console', m => m.type() === 'error' && errors.push(m.text()));
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      const geo = () => page.evaluate(() => {
        const pick = sel => {
          const a = document.querySelector(sel);
          const cs = getComputedStyle(a);
          const r = a.getBoundingClientRect();
          const face = a.querySelector('.cj-stk-face'), sh = a.querySelector('.cj-stk-sh');
          const fr = face.getBoundingClientRect(), sr = sh.getBoundingClientRect();
          return {
            rotate: cs.rotate, transition: cs.transition,
            layout: [a.offsetWidth, a.offsetHeight],
            bbox: [r.left, r.top, r.right, r.bottom].map(n => +n.toFixed(1)),
            faceBox: [fr.left, fr.top, fr.right, fr.bottom].map(n => +n.toFixed(1)),
            shBox: [sr.left, sr.top, sr.right, sr.bottom].map(n => +n.toFixed(1)),
            faceTransform: getComputedStyle(face).transform,
            shTransform: getComputedStyle(sh).transform,
            label: getComputedStyle(face.querySelector('small')).color,
            fill: getComputedStyle(face).backgroundColor,
          };
        };
        // Pill (stadium) of each sticker in page coordinates, from its rotated frame.
        const pill = (a, extra) => {
          const r = a.getBoundingClientRect(); const cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
          const w = a.offsetWidth, h = a.offsetHeight, th = parseFloat(getComputedStyle(a).rotate) * Math.PI / 180;
          const ux = Math.cos(th), uy = Math.sin(th);
          const off = (extra || [0, 0]);
          const ox = off[0] * ux - off[1] * uy, oy = off[0] * uy + off[1] * ux;
          const d = (w - h) / 2;
          return { a: [cx + ox - d * ux, cy + oy - d * uy], b: [cx + ox + d * ux, cy + oy + d * uy], r: h / 2 };
        };
        const segDist = (p, q) => { // min distance between two segments (sampled)
          let m = Infinity;
          for (let i = 0; i <= 200; i++) { const t = i / 200; const x = p.a[0] + (p.b[0] - p.a[0]) * t, y = p.a[1] + (p.b[1] - p.a[1]) * t;
            for (let j = 0; j <= 200; j++) { const s = j / 200; const X = q.a[0] + (q.b[0] - q.a[0]) * s, Y = q.a[1] + (q.b[1] - q.a[1]) * s; m = Math.min(m, Math.hypot(x - X, y - Y)); } }
          return m - p.r - q.r;
        };
        const tg = document.querySelector('.cj-stk.tg'), wa = document.querySelector('.cj-stk.wa');
        const all = [...document.querySelectorAll('*')].filter(e => { const cs = getComputedStyle(e); return /hidden|clip/.test(cs.overflow + cs.overflowX + cs.overflowY) && e.contains(tg); }).map(e => e.className || e.tagName);
        return {
          scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth,
          bodyScrollWidth: document.body.scrollWidth,
          tg: pick('.cj-stk.tg'), wa: pick('.cj-stk.wa'),
          faceGap_tg_wa: +segDist(pill(tg), pill(wa)).toFixed(1),
          tgShadowToWaFace: +segDist(pill(tg, [4, 6]), pill(wa)).toFixed(1),
          clippingAncestors: all,
          stickersBox: (() => { const r = document.querySelector('.cj-stickers').getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom].map(n => +n.toFixed(1)); })(),
          runningAnimations: document.getAnimations().filter(a => a.playState === 'running').length,
        };
      });
      const key = `${w}-${rm}`;
      const rest = await geo();
      const stk = page.locator('.cj-stickers');
      await stk.scrollIntoViewIfNeeded();
      await page.mouse.move(0, 0);
      await page.waitForTimeout(500);
      const pad = 24;
      const box = await stk.boundingBox();
      const clip = { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: Math.min(w, box.width + pad * 2), height: box.height + pad * 2 };
      await page.screenshot({ path: `${out}/stickers-${key}.png`, clip });
      if (rm === 'no-preference') await page.screenshot({ path: `${out}/full-${w}.png`, fullPage: true });
      else await page.screenshot({ path: `${out}/full-${w}-reduced-motion.png`, fullPage: true });
      // Hover (desktop only meaningful: hover media query)
      await page.locator('.cj-stk.tg').hover();
      await page.waitForTimeout(600);
      const hover = await page.evaluate(() => {
        const a = document.querySelector('.cj-stk.tg');
        return { rotate: getComputedStyle(a).rotate, face: getComputedStyle(a.querySelector('.cj-stk-face')).transform, sh: getComputedStyle(a.querySelector('.cj-stk-sh')).transform, faceShadow: getComputedStyle(a.querySelector('.cj-stk-face')).boxShadow };
      });
      await page.screenshot({ path: `${out}/stickers-${key}-hover-tg.png`, clip });
      await page.mouse.down();
      await page.waitForTimeout(300);
      const active = await page.evaluate(() => {
        const a = document.querySelector('.cj-stk.tg');
        return { rotate: getComputedStyle(a).rotate, face: getComputedStyle(a.querySelector('.cj-stk-face')).transform, sh: getComputedStyle(a.querySelector('.cj-stk-sh')).transform };
      });
      await page.screenshot({ path: `${out}/stickers-${key}-active-tg.png`, clip });
      await page.mouse.move(0, 0); await page.mouse.up();
      result[key] = { rest, hover, active, errors };
      await ctx.close();
    }
  }
  await browser.close();
  console.log(JSON.stringify(result, null, 1));
})();
