const { chromium } = require('playwright');

const URL = process.env.TARGET_URL || 'https://curioustails-staging.pages.dev/outputs/';
const results = [];
const check = (name, pass, detail) => results.push({ name, pass: !!pass, detail });

(async () => {
  const browser = await chromium.launch();
  for (const [w, h] of [[1440, 1000], [768, 900], [390, 844]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    const resp = await page.goto(URL, { waitUntil: 'networkidle' });
    check(`${w}: HTTP 200`, resp.status() === 200, resp.status());
    await page.evaluate(async () => {
      const H = document.documentElement.scrollHeight;
      for (let y = 0; y < H; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 10)); }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(200);

    const d = await page.evaluate(() => {
      const q = s => document.querySelector(s);
      const qa = s => [...document.querySelectorAll(s)];
      const cs = s => getComputedStyle(q(s));
      const box = s => { const r = q(s).getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom }; };
      const cards = qa('.dossier-card').map(el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right }; });
      const p = box('.dossier-portrait');
      const section = cs('#about');
      const chips = qa('.dossier-chips li').map(el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
      return {
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        bg: section.backgroundColor,
        borderTop: section.borderTopWidth + ' ' + section.borderTopStyle,
        borderBottom: section.borderBottomWidth + ' ' + section.borderBottomStyle,
        padTop: parseFloat(section.paddingTop),
        padBottom: parseFloat(section.paddingBottom),
        tagDisplay: cs('.dossier-tag').display,
        tagFont: cs('.dossier-tag').fontSize,
        tagTrack: cs('.dossier-tag').letterSpacing,
        tagColor: cs('.dossier-tag').color,
        tagWriting: cs('.dossier-tag').writingMode,
        h2: parseFloat(cs('#about-h').fontSize),
        eyebrowFont: cs('.dossier-eyebrow').fontSize,
        chipCount: chips.length,
        chipRows: [...new Set(chips.map(c => Math.round(c.y)))].length,
        chipFont: cs('.dossier-chips li').fontSize,
        chipRadius: cs('.dossier-chips li').borderRadius,
        chipBorder: cs('.dossier-chips li').borderTopWidth,
        chipWrap: cs('.dossier-chips').gridTemplateColumns,
        portrait: { ...p, radius: cs('.dossier-portrait').borderTopLeftRadius, aspect: cs('.dossier-portrait').aspectRatio, fit: cs('.dossier-portrait img').objectFit },
        cardCount: cards.length,
        cardPad: cs('.dossier-card').padding,
        cardRadius: cs('.dossier-card').borderTopLeftRadius,
        cardBorder: cs('.dossier-card').borderTopWidth,
        cardBorderColor: cs('.dossier-card').borderTopColor,
        cardShadow: cs('.dossier-card').boxShadow,
        cardBg: cs('.dossier-card').backgroundColor,
        cardGap: cs('.dossier-cards').gap,
        indexFont: cs('.dc-i').fontSize,
        titleFont: cs('.dossier-card h3').fontSize,
        titleWeight: cs('.dossier-card h3').fontWeight,
        bodyFont: cs('.dossier-card p').fontSize,
        bodyLine: parseFloat(cs('.dossier-card p').lineHeight) / parseFloat(cs('.dossier-card p').fontSize),
        cards,
        portraitFirstGap: cards[0].x - p.right,
        overlap2: p.right - cards[1].x,
        overlap3: p.right - cards[2].x,
        firstUp: p.bottom - cards[0].y,
        cta: q('.dossier-cta.only-av') ? { bg: getComputedStyle(q('.dossier-cta.only-av')).backgroundColor, radius: getComputedStyle(q('.dossier-cta.only-av')).borderRadius, h: q('.dossier-cta.only-av').getBoundingClientRect().height } : null,
        dead: ['.pull', '.glance', '.aside-ask', '.band--about', '.about-head', '.about-body', '.about-aside', '.about-callout'].filter(s => !!q(s)),
        id: q('#about') ? q('#about').id : null,
        h2id: q('#about-h') ? q('#about-h').id : null,
      };
    });

    check(`${w}: no horizontal overflow`, d.overflow === 0, d.overflow);
    check(`${w}: paper cream token, not lilac`, d.bg === 'oklch(0.955 0.022 78)', d.bg);
    check(`${w}: 1px rules top and bottom`, d.borderTop === '1px solid' && d.borderBottom === '1px solid', `${d.borderTop} / ${d.borderBottom}`);
    check(`${w}: section padding 64-104`, d.padTop === d.padBottom && d.padTop >= 64 && d.padTop <= 104, d.padTop);
    check(`${w}: section id + heading id`, d.id === 'about' && d.h2id === 'about-h', `${d.id}/${d.h2id}`);
    check(`${w}: h2 40-48px`, d.h2 >= 40 && d.h2 <= 48, d.h2);
    check(`${w}: eyebrow 11px`, d.eyebrowFont === '11px', d.eyebrowFont);
    check(`${w}: 5 chips`, d.chipCount === 5, d.chipCount);
    check(`${w}: chips 13px / pill / 1px`, d.chipFont === '13px' && d.chipRadius === '999px' && d.chipBorder === '1px', `${d.chipFont}/${d.chipRadius}/${d.chipBorder}`);
    check(`${w}: 3 cards / 20px radius / 1px 8% border`, d.cardCount === 3 && d.cardRadius === '20px' && d.cardBorder === '1px' && /\/ 0\.08\)/.test(d.cardBorderColor), `${d.cardCount}/${d.cardRadius}/${d.cardBorder}/${d.cardBorderColor}`);
    check(`${w}: white cards + 20px gap`, d.cardBg === 'rgb(255, 255, 255)' && d.cardGap === '20px', `${d.cardBg}/${d.cardGap}`);
    check(`${w}: 0 18px 40px -28px shadow`, /0px 18px 40px -28px/.test(d.cardShadow), d.cardShadow);
    check(`${w}: index 11 / title 18–600 / body 15.5 @1.6`, d.indexFont === '11px' && d.titleFont === '18px' && d.titleWeight === '600' && d.bodyFont === '15.5px' && Math.abs(d.bodyLine - 1.6) < 0.01, `${d.indexFont}/${d.titleFont}/${d.titleWeight}/${d.bodyFont}/${d.bodyLine.toFixed(2)}`);
    check(`${w}: no dead selectors`, d.dead.length === 0, d.dead.join(',') || 'none');
    check(`${w}: CTA filled pill`, d.cta && d.cta.bg === 'rgb(37, 211, 102)' && d.cta.radius === '999px' && d.cta.h >= 40, JSON.stringify(d.cta));

    if (w === 1440) {
      check('1440: vertical label visible 11px .38em', d.tagDisplay === 'block' && d.tagFont === '11px' && d.tagTrack === '4.18px' && d.tagWriting === 'vertical-rl', `${d.tagDisplay}/${d.tagFont}/${d.tagTrack}/${d.tagWriting}`);
      check('1440: portrait 4/5 radius 28 cover', d.portrait.aspect === '4 / 5' && d.portrait.radius === '28px' && d.portrait.fit === 'cover', `${d.portrait.aspect}/${d.portrait.radius}/${d.portrait.fit}`);
      check('1440: cards 2/3 overlap by 48px', d.overlap2 === 48 && d.overlap3 === 48, `${d.overlap2}/${d.overlap3}`);
      check('1440: card 01 sits 8px off the photo', d.portraitFirstGap === 8, d.portraitFirstGap);
      check('1440: 5 chips on one row', d.chipRows === 1, d.chipRows);
      check('1440: card padding 28px', d.cardPad === '28px', d.cardPad);
    }
    if (w === 768) {
      check('768: vertical label hidden', d.tagDisplay === 'none', d.tagDisplay);
      check('768: portrait 3/2', d.portrait.aspect === '3 / 2', d.portrait.aspect);
      check('768: first card overlaps 24px upward', d.firstUp === 24, d.firstUp);
      check('768: cards 2/3 start below the photo', d.cards[1].y >= d.portrait.bottom && d.cards[2].y >= d.portrait.bottom, `${d.cards[1].y}/${d.cards[2].y} vs ${d.portrait.bottom}`);
      check('768: cards full width', Math.round(d.cards[0].w) === Math.round(d.portrait.w), `${d.cards[0].w}/${d.portrait.w}`);
      check('768: 24px page gutters', Math.round(d.portrait.x) === 24 && Math.round(1440 - 1440) === 0 && Math.round(768 - d.portrait.right) === 24, `${d.portrait.x}/${768 - d.portrait.right}`);
    }
    if (w === 390) {
      check('390: vertical label hidden', d.tagDisplay === 'none', d.tagDisplay);
      check('390: portrait 3/2', d.portrait.aspect === '3 / 2', d.portrait.aspect);
      check('390: first card overlaps 24px upward', d.firstUp === 24, d.firstUp);
      check('390: chips two per row (2-col grid)', d.chipWrap === '167px 167px', d.chipWrap);
      check('390: 24px page gutters', Math.round(d.portrait.x) === 24 && Math.round(390 - d.portrait.right) === 24, `${d.portrait.x}/${390 - d.portrait.right}`);
    }
    check(`${w}: 0 console errors`, consoleErrors.length === 0, consoleErrors.join(' | '));
    await ctx.close();
  }
  await browser.close();
  let failed = 0;
  for (const r of results) {
    if (!r.pass) failed++;
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}  -> ${r.detail}`);
  }
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
