const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = process.env.TARGET_URL || 'http://127.0.0.1:8787/outputs/';
const OUT = process.env.SHOT_DIR || path.join(__dirname, '..', 'k081-shots');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const results = {};
  for (const [name, width, height] of [['1440', 1440, 1000], ['768', 768, 900], ['390', 390, 844]]) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const consoleErrors = [], pageErrors = [], failedReqs = [];
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('pageerror', e => pageErrors.push(String(e)));
    page.on('requestfailed', r => failedReqs.push(r.url() + ' :: ' + (r.failure() && r.failure().errorText)));
    const resp = await page.goto(URL, { waitUntil: 'networkidle' });

    await page.evaluate(async () => {
      const h = document.documentElement.scrollHeight;
      for (let y = 0; y < h; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 15)); }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(300);

    const data = await page.evaluate(() => {
      const q = s => document.querySelector(s);
      const qa = s => [...document.querySelectorAll(s)];
      const cs = s => { const el = q(s); return el ? getComputedStyle(el) : null; };
      const box = s => { const el = q(s); if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), right: Math.round(b.right), bottom: Math.round(b.bottom) }; };
      const text = s => { const el = q(s); return el ? el.innerText.replace(/\s+/g, ' ').trim() : null; };

      const portrait = box('.dossier-portrait');
      const cards = qa('.dossier-card').map(el => {
        const b = el.getBoundingClientRect();
        return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), right: Math.round(b.right), bottom: Math.round(b.bottom), ml: getComputedStyle(el).marginLeft };
      });
      const chipBoxes = qa('.dossier-chips li').map(el => { const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; });
      const chipRows = [...new Set(chipBoxes.map(c => c.y))].length;

      return {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        section: box('#about'),
        sectionBg: cs('#about').backgroundColor,
        sectionBorderTop: cs('#about').borderTopWidth + ' ' + cs('#about').borderTopStyle,
        sectionBorderBottom: cs('#about').borderBottomWidth + ' ' + cs('#about').borderBottomStyle,
        sectionPadTop: cs('#about').paddingTop,
        sectionPadBottom: cs('#about').paddingBottom,
        sectionId: q('#about') ? q('#about').id : null,
        headingText: text('#about-h'),
        headingSize: cs('#about-h').fontSize,
        headingLine: cs('#about-h').lineHeight,
        headingWeight: cs('#about-h').fontWeight,
        eyebrowText: text('.dossier-eyebrow'),
        eyebrowSize: cs('.dossier-eyebrow').fontSize,
        eyebrowTrack: cs('.dossier-eyebrow').letterSpacing,
        tagDisplay: cs('.dossier-tag').display,
        tagText: text('.dossier-tag'),
        tagWriting: cs('.dossier-tag').writingMode,
        tagTransform: cs('.dossier-tag').transform,
        tagSize: cs('.dossier-tag').fontSize,
        tagTrack: cs('.dossier-tag').letterSpacing,
        tagColor: cs('.dossier-tag').color,
        tagFontWeight: cs('.dossier-tag').fontWeight,
        chips: qa('.dossier-chips li').map(li => li.innerText.replace(/\s+/g, ' ').trim()),
        chipCount: qa('.dossier-chips li').length,
        chipCols: cs('.dossier-chips').display === 'grid' ? cs('.dossier-chips').gridTemplateColumns : 'flex',
        chipRows,
        chipFont: cs('.dossier-chips li').fontSize,
        chipRadius: cs('.dossier-chips li').borderRadius,
        chipBorder: cs('.dossier-chips li').borderTopWidth + ' ' + cs('.dossier-chips li').borderTopStyle,
        portrait,
        portraitRadius: cs('.dossier-portrait').borderTopLeftRadius,
        portraitAspect: cs('.dossier-portrait').aspectRatio,
        portraitFit: cs('.dossier-portrait img').objectFit,
        portraitShadow: cs('.dossier-portrait').boxShadow,
        cards,
        cardCount: cards.length,
        cardRadius: cs('.dossier-card').borderTopLeftRadius,
        cardPad: cs('.dossier-card').padding,
        cardBorder: cs('.dossier-card').borderTopWidth + ' ' + cs('.dossier-card').borderTopStyle,
        cardBorderColor: cs('.dossier-card').borderTopColor,
        cardShadow: cs('.dossier-card').boxShadow,
        cardBg: cs('.dossier-card').backgroundColor,
        cardIndexSize: cs('.dc-i').fontSize,
        cardIndexColor: cs('.dc-i').color,
        cardTitleSize: cs('.dossier-card h3').fontSize,
        cardTitleWeight: cs('.dossier-card h3').fontWeight,
        cardBodySize: cs('.dossier-card p').fontSize,
        cardBodyLine: cs('.dossier-card p').lineHeight,
        cardTexts: qa('.dossier-card').map(c => c.innerText.replace(/\s+/g, ' ').trim()),
        cta: (() => { const a = q('.dossier-cta.only-av'); if (!a) return null; const s = getComputedStyle(a); const b = a.getBoundingClientRect(); return { text: a.innerText.trim(), href: a.getAttribute('href'), bg: s.backgroundColor, color: s.color, radius: s.borderTopLeftRadius, padding: s.padding, h: Math.round(b.height) }; })(),
        card1Gap: portrait ? Math.round(cards[0].x - portrait.right) : null,
        overlap2: portrait ? Math.round(portrait.right - cards[1].x) : null,
        overlap3: portrait ? Math.round(portrait.right - cards[2].x) : null,
        stackTopGap: portrait ? Math.round(cards[0].y - portrait.y) : null,
        firstCardUp: portrait ? Math.round(portrait.bottom - cards[0].y) : null,
        deadSelectors: {
          pull: !!q('.pull'),
          glance: !!q('.glance'),
          asideAsk: !!q('.aside-ask'),
          aboutBand: !!q('.band--about'),
          aboutHead: !!q('.about-head'),
          aboutBody: !!q('.about-body'),
          aboutAside: !!q('.about-aside'),
          lead: !!q('#about .lead'),
          callout: !!q('.about-callout'),
        },
        mojibake: /Â|â€|â˜|Ã©|Ã¨|�/.test(document.body.innerText),
        brokenImages: qa('img').filter(i => !i.complete || i.naturalWidth === 0).map(i => i.getAttribute('src')),
        notesVisible: qa('.note').filter(n => getComputedStyle(n).display !== 'none').length,
      };
    });
    data.httpStatus = resp.status();
    data.consoleErrors = consoleErrors;
    data.pageErrors = pageErrors;
    data.failedReqs = failedReqs.filter(u => !u.includes('google.com/maps'));

    await page.mouse.move(0, 0);
    await page.addStyleTag({ content: '.util,.hdr,#sticky{display:none!important}[data-reveal]{opacity:1!important;transform:none!important;transition:none!important}' });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);
    const clip = await page.evaluate(() => {
      const b = document.querySelector('#about').getBoundingClientRect();
      return { x: b.x + window.scrollX, y: b.y + window.scrollY, width: b.width, height: b.height };
    });
    await page.screenshot({ path: path.join(OUT, `about-${name}.png`), fullPage: true, clip });
    await page.screenshot({ path: path.join(OUT, `viewport-${name}.png`) });
    results[name] = data;
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'verify.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
})().catch(e => { console.error(e); process.exit(1); });
