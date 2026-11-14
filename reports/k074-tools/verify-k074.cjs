const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = process.env.TARGET_URL || 'https://curioustails-staging.pages.dev/outputs/';
const OUT = process.env.SHOT_DIR || path.join(__dirname, '..', 'reports', 'k074-shots');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const results = {};
  for (const [name, width, height] of [['1440', 1440, 1000], ['390', 390, 844]]) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const consoleErrors = [], pageErrors = [], failedReqs = [];
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('pageerror', e => pageErrors.push(String(e)));
    page.on('requestfailed', r => failedReqs.push(r.url() + ' :: ' + (r.failure() && r.failure().errorText)));
    const resp = await page.goto(URL, { waitUntil: 'networkidle' });

    await page.evaluate(async () => {
      const h = document.documentElement.scrollHeight;
      for (let y = 0; y < h; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 25)); }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(350);

    const data = await page.evaluate(() => {
      const q = s => document.querySelector(s);
      const qa = s => [...document.querySelectorAll(s)];
      const text = s => { const el = q(s); return el ? el.innerText.replace(/\s+/g, ' ').trim() : null; };
      const cols = s => { const el = q(s); return el ? getComputedStyle(el).gridTemplateColumns : null; };
      const cs = s => { const el = q(s); return el ? getComputedStyle(el) : null; };
      return {
        status: null,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        ppText: text('.passport'),
        ppGridLabels: qa('.pp-grid dt').map(d => d.innerText.trim()),
        ppGridValues: qa('.pp-grid dd').map(d => d.innerText.trim()),
        ppRows: qa('.pp-grid > .pp').length,
        ppMoreRows: qa('.pp-more > div').length,
        emptyFactCells: qa('.pp, .pp-more > div').filter(d => !d.innerText.trim()).length,
        ppGridCols: cols('.pp-grid'),
        ppMoreCols: cols('.pp-more'),
        ppBorder: cs('.passport').borderTopWidth + ' ' + cs('.passport').borderTopStyle + ' ' + cs('.passport').borderTopColor,
        ppShadow: cs('.passport').boxShadow,
        aboutLeadSize: cs('.about-body .lead').fontSize,
        aboutBodySize: cs('.about-body p:not(.lead):not(.pull)').fontSize,
        aboutBodyMax: cs('.about-body p:not(.lead):not(.pull)').maxWidth,
        aboutGapPx: (() => {
          const a = q('.band--about').getBoundingClientRect();
          const prev = q('.band--peach').getBoundingClientRect();
          return Math.round(a.top - prev.bottom);
        })(),
        leadText: text('.about-body .lead'),
        pullText: text('.about-body .pull'),
        bodyParas: qa('.about-body p:not(.lead):not(.pull):not(.asknote)').map(p => p.innerText.trim()),
        chipsHeading: text('.more-links h3'),
        chipsCols: cols('.more-links ul'),
        chips: qa('.more-links a').map(a => ({ label: a.innerText.trim(), href: a.getAttribute('href'), h: Math.round(a.getBoundingClientRect().height) })),
        heroAvail: text('.avail.only-av'),
        stale: (() => { const s = q('[data-stale]'); return s ? { hidden: s.hidden, display: getComputedStyle(s).display, text: s.innerText.trim() } : null; })(),
        vaccines: qa('.timeline li').map(li => li.innerText.replace(/\s+/g, ' ').trim()),
        vetCopy: text('.vet-card p'),
        vetLinks: qa('.vet-card a[href^="tel:"]').map(a => a.getAttribute('href') + '|' + a.innerText),
        inclusionsLong: text('.inc-long'),
        inclusionsShort: text('.inc-short'),
        syncFaq: text('.faq details .ans'),
        removedStrings: {
          dobNote: document.body.innerHTML.includes('puppy feed DOB column'),
          ageNote: document.body.innerHTML.includes('computed from her'),
          goingHome: document.body.innerHTML.includes('Going home'),
          passportNote: document.body.innerHTML.includes('PASSPORT FACTS'),
          checked1Nov: document.body.innerHTML.includes('checked 1 Nov'),
          optional4th: document.body.innerHTML.includes('optional 4th'),
        },
        mojibake: /Â|â€|â˜|Ã©|Ã¨|�/.test(document.body.innerText),
        notesVisible: qa('.note').filter(n => getComputedStyle(n).display !== 'none').length,
      };
    });
    data.httpStatus = resp.status();
    data.httpXRobots = resp.headers()['x-robots-tag'] || null;

    // hover probe on first chip
    const chip = page.locator('.more-links a').first();
    await chip.scrollIntoViewIfNeeded();
    await chip.hover();
    await page.waitForTimeout(250);
    data.chipHover = await chip.evaluate(el => {
      const s = getComputedStyle(el);
      return { border: s.borderTopColor, bg: s.backgroundColor, transform: s.transform, chevron: getComputedStyle(el.querySelector('svg')).transform };
    });

    // clean shots: remove sticky site chrome, capture exact page regions
    await page.mouse.move(0, 0);
    await page.addStyleTag({ content: '.util,.hdr,#sticky{display:none!important}' });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(250);

    const clipOf = sel => page.evaluate(s => {
      const el = document.querySelector(s);
      const b = el.getBoundingClientRect();
      return { x: b.x + window.scrollX, y: b.y + window.scrollY, width: b.width, height: b.height };
    }, sel);

    await page.screenshot({ path: path.join(OUT, `passport-${name}.png`), fullPage: true, clip: await clipOf('.passport') });
    await page.screenshot({ path: path.join(OUT, `about-${name}.png`), fullPage: true, clip: await clipOf('.band--about') });
    await page.screenshot({ path: path.join(OUT, `chips-${name}.png`), fullPage: true, clip: await clipOf('.more-links') });

    // focus-visible proof shot
    await chip.focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await page.waitForTimeout(200);
    data.chipFocus = await chip.evaluate(el => { const s = getComputedStyle(el); return { outline: s.outlineWidth + ' ' + s.outlineStyle + ' ' + s.outlineColor, offset: s.outlineOffset }; });
    await page.locator('.more-links').screenshot({ path: path.join(OUT, `chips-focus-${name}.png`) });

    await page.evaluate(() => document.querySelector('.avail.only-av').scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(200);
    await page.locator('.hero .buy').screenshot({ path: path.join(OUT, `hero-${name}.png`) });

    results[name] = { ...data, consoleErrors, pageErrors, failedReqs: failedReqs.filter(u => !u.includes('google.com/maps')) };
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'verify.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
})().catch(e => { console.error(e); process.exit(1); });
