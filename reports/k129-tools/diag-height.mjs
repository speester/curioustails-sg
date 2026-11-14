import { chromium } from 'playwright';
const base = 'https://k129-content-gap.curioustails-sg.pages.dev';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
const page = await ctx.newPage();
await page.goto(`${base}/puppies/maltipoo/`, { waitUntil: 'load', timeout: 60000 });
await page.evaluate(async () => {
  for (let y = 0; y < document.body.scrollHeight; y += 800) {
    window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 30));
  }
  window.scrollTo(0, 0);
});
await page.waitForTimeout(500);
const info = await page.evaluate(() => {
  const tall = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.height > 1200) tall.push({ tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 70), h: Math.round(r.height), top: Math.round(r.top + window.scrollY), bottom: Math.round(r.bottom + window.scrollY) });
  }
  return { scrollHeight: document.body.scrollHeight, docHeight: document.documentElement.scrollHeight, tall: tall.sort((a, b) => b.h - a.h).slice(0, 12) };
});
console.log(JSON.stringify(info, null, 1));
await browser.close();
