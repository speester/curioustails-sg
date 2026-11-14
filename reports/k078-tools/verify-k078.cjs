const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = process.env.TARGET_URL || 'http://127.0.0.1:8787/outputs/';
const OUT = process.env.SHOT_DIR || path.join(__dirname, '..', 'k078-shots');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const results = {};
  for (const [name, width, height] of [['1440', 1440, 1000], ['390', 390, 844], ['1023', 1023, 900], ['767', 767, 900]]) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const consoleErrors = [], pageErrors = [], failedReqs = [];
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('pageerror', e => pageErrors.push(String(e)));
    page.on('requestfailed', r => failedReqs.push(r.url() + ' :: ' + (r.failure() && r.failure().errorText)));
    const resp = await page.goto(URL, { waitUntil: 'networkidle' });

    await page.evaluate(async () => {
      const h = document.documentElement.scrollHeight;
      for (let y = 0; y < h; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 20)); }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(300);

    const data = await page.evaluate(() => {
      const q = s => document.querySelector(s);
      const qa = s => [...document.querySelectorAll(s)];
      const text = s => { const el = q(s); return el ? el.innerText.replace(/\s+/g, ' ').trim() : null; };
      const cols = s => { const el = q(s); return el ? getComputedStyle(el).gridTemplateColumns : null; };
      const cs = s => { const el = q(s); return el ? getComputedStyle(el) : null; };
      const box = s => { const el = q(s); if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
      const ppBody = cs('.pp-body');
      const media = box('.pp-media');
      const passport = box('.passport');
      return {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        availText: text('.avail.only-av'),
        availHtml: q('.avail.only-av') ? q('.avail.only-av').innerHTML : null,
        passMedia: media,
        passBody: box('.pp-body'),
        passCard: passport,
        passCols: cols('.passport'),
        passRadius: cs('.passport').borderTopLeftRadius,
        passBorder: cs('.passport').borderTopWidth + ' ' + cs('.passport').borderTopStyle,
        passShadow: cs('.passport').boxShadow,
        ppBodyPad: [ppBody.paddingTop, ppBody.paddingRight, ppBody.paddingBottom, ppBody.paddingLeft].join(' '),
        h2Size: cs('.pp-head h2').fontSize,
        h2Weight: cs('.pp-head h2').fontWeight,
        h2Track: cs('.pp-head h2').letterSpacing,
        h2Line: cs('.pp-head h2').lineHeight,
        descText: text('.pp-desc'),
        pillBg: cs('.pp-pill').backgroundColor,
        pillColor: cs('.pp-pill').color,
        pillDot: getComputedStyle(q('.pp-pill'), '::before').width + ' x ' + getComputedStyle(q('.pp-pill'), '::before').height,
        factCols: cols('.pp-grid'),
        factLabels: qa('.pp-grid dt').map(d => d.innerText.trim()),
        factValues: qa('.pp-grid dd').map(d => d.innerText.trim()),
        factLabelSize: cs('.pp-grid dt').fontSize,
        factValueSize: cs('.pp-grid dd').fontSize,
        factValueWeight: cs('.pp-grid dd').fontWeight,
        monoFont: cs('.pp-grid dd.mono').fontFamily,
        actions: qa('.pp-actions a').map(a => ({ label: a.innerText.trim(), href: a.getAttribute('href'), h: Math.round(a.getBoundingClientRect().height), radius: getComputedStyle(a).borderTopLeftRadius, bg: getComputedStyle(a).backgroundColor, padding: getComputedStyle(a).padding })),
        aboutBg: cs('.band--about').backgroundColor,
        aboutCols: cols('.about-grid'),
        aboutAreas: cs('.about-grid').gridTemplateAreas,
        aboutGap: cs('.about-grid').gap,
        aboutPadTop: cs('.band--about').paddingTop,
        aboutPadBottom: cs('.band--about').paddingBottom,
        headBox: box('.about-head'),
        asideBox: box('.about-aside'),
        bodyBox: box('.about-body:not(.only-placed)'),
        calloutBox: box('.about-callout'),
        h2Size: cs('.about-head h2').fontSize,
        h2Line: cs('.about-head h2').lineHeight,
        h2Track: cs('.about-head h2').letterSpacing,
        leadSize: cs('.about-head .lead').fontSize,
        leadLine: cs('.about-head .lead').lineHeight,
        leadColor: cs('.about-head .lead').color,
        bodyColor: cs('.about-body p').color,
        bodyMax: cs('.about-body p').maxWidth,
        bodyGap: cs('.about-body > * + *').marginTop,
        dropCap: (() => {
          const s = getComputedStyle(q('.about-head .lead'), '::first-letter');
          return { float: s.float, size: s.fontSize, lineHeight: s.lineHeight, weight: s.fontWeight, color: s.color, marginRight: s.marginRight };
        })(),
        calloutLabel: text('.callout-label'),
        calloutText: text('.about-callout p'),
        calloutBg: cs('.about-callout').backgroundColor,
        calloutBorderLeft: cs('.about-callout').borderLeftWidth + ' ' + cs('.about-callout').borderLeftStyle + ' ' + cs('.about-callout').borderLeftColor,
        pullSize: cs('.about-body .pull').fontSize,
        pullLine: cs('.about-body .pull').lineHeight,
        pullWeight: cs('.about-body .pull').fontWeight,
        pullText: text('.about-body .pull'),
        pullBorders: cs('.about-body .pull').borderTopWidth + '/' + cs('.about-body .pull').borderBottomWidth,
        pullQuoteSize: getComputedStyle(q('.about-body .pull'), '::before').fontSize,
        pullQuoteColor: getComputedStyle(q('.about-body .pull'), '::before').color,
        glanceBox: box('.about-aside'),
        glanceItems: qa('.glance > div').map(d => d.innerText.replace(/\s+/g, ' ').trim()),
        glanceLabels: qa('.glance dt').map(d => d.innerText.trim()),
        asideAsk: text('.aside-ask'),
        asideAskHref: q('.aside-ask') ? q('.aside-ask').getAttribute('href') : null,
        asideAskIcon: !!q('.aside-ask svg'),
        closeMargin: cs('.about-close').marginTop,
        closeColor: cs('.about-close').color,
        devNote: document.body.innerHTML.includes('PuppyAbout'),
        ownerCard: !!q('.owner-card'),
        mojibake: /Â|â€|â˜|Ã©|Ã¨|�/.test(document.body.innerText),
        notesVisible: qa('.note').filter(n => getComputedStyle(n).display !== 'none').length,
        consoleText: null,
      };
    });
    data.httpStatus = resp.status();
    data.httpXRobots = resp.headers()['x-robots-tag'] || null;
    data.consoleErrors = consoleErrors;
    data.pageErrors = pageErrors;
    data.failedReqs = failedReqs.filter(u => !u.includes('google.com/maps'));

    // clean shots: hide fixed site chrome, capture exact page regions
    await page.mouse.move(0, 0);
    await page.addStyleTag({ content: '.util,.hdr,#sticky{display:none!important}[data-reveal]{opacity:1!important;transform:none!important;transition:none!important}' });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);

    const clipOf = sel => page.evaluate(s => {
      const el = document.querySelector(s);
      const b = el.getBoundingClientRect();
      return { x: b.x + window.scrollX, y: b.y + window.scrollY, width: b.width, height: b.height };
    }, sel);

    await page.screenshot({ path: path.join(OUT, `passport-${name}.png`), fullPage: true, clip: await clipOf('.passport') });
    await page.screenshot({ path: path.join(OUT, `about-${name}.png`), fullPage: true, clip: await clipOf('.band--about') });

    results[name] = data;
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'verify.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
})().catch(e => { console.error(e); process.exit(1); });
