#!/usr/bin/env node
// kit:screenshots@1.1.0 — the kit's ONE screenshot script. Two modes:
//   (a) Checkpoint 3 / audit evidence PNGs. A MISSING PNG FAILS THE CHECKPOINT.
//   (b) --reviews: product screenshots for review tiers, written with a manifest.
// Usage: node scripts/screenshots.mjs [--routes "/,/services/,/blog/x/"] [--live <origin>]
//        node scripts/screenshots.mjs --reviews --targets "slug=https://example.com,slug2=https://…"
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { chromium } from 'playwright';

const argv = process.argv.slice(2);
const get = (f, d = null) => { const i = argv.indexOf(f); return i === -1 ? d : argv[i + 1]; };
const LIVE = get('--live');
const WIDTHS = [375, 768, 1440];
const THEMES = ['light', 'dark'];
const DATE = new Date().toISOString().slice(0, 10);
const OUT = path.join('.claude', 'docs', 'screenshots', DATE);

function defaultRoutes() {
  const out = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (e.name !== 'index.html') continue;
      let r = '/' + path.relative('dist', p).replace(/\\/g, '/').replace(/index\.html$/, '');
      out.push(r.replace(/\/{2,}/g, '/'));
    }
  };
  walk('dist');
  const home = '/';
  const money = out.find((r) => r !== '/' && r.split('/').filter(Boolean).length === 1) ?? home;
  const article = out.find((r) => r.startsWith('/blog/') && r !== '/blog/') ?? money;
  return [...new Set([home, money, article])];
}

function serveDist(port = 8792) {
  const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
    '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.json': 'application/json' };
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    let file = path.join('dist', p);
    if (p.endsWith('/')) file = path.join(file, 'index.html');
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('404'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' });
    res.end(fs.readFileSync(file));
  });
  return new Promise((r) => server.listen(port, () => r({ server, origin: `http://127.0.0.1:${port}` })));
}

// ---------- MODE (b): --reviews — product screenshots for review tiers, with a manifest.
// Folded in from the former capture-screenshots.mjs: ONE screenshot script per kit, so a
// checkpoint and a review capture can never drift apart.
// Learned the hard way: networkidle never fires on many price pages; consent banners must
// be dismissed; a < 40 KB capture is blank; some hosts fail headless — those are RECORDED,
// never faked and never replaced with a stand-in image.
if (argv.includes('--reviews')) {
  const sharp = (await import('sharp')).default;
  const targets = (get('--targets', '') || '').split(',').filter(Boolean).map((t) => {
    const [slug, ...rest] = t.split('=');
    return { slug: slug.trim(), url: rest.join('=').trim() };
  });
  if (!targets.length) { console.error('FAIL node scripts/screenshots.mjs --reviews --targets "slug=url,slug2=url"'); process.exit(1); }
  const ROUT = path.join('public', 'images', 'reviews');
  const MANIFEST = path.join(ROUT, 'manifest.json');
  fs.mkdirSync(ROUT, { recursive: true });
  const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {};
  const rBrowser = await chromium.launch();
  const rRows = [];
  for (const { slug, url } of targets) {
    const ctx = await rBrowser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    let status = 'OK';
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(3500);
      for (const sel of ['button:has-text("Accept")', 'button:has-text("Reject")', '[aria-label*="consent" i] button']) {
        const el = await page.$(sel);
        if (el) { await el.click().catch(() => {}); await page.waitForTimeout(600); break; }
      }
      const png = await page.screenshot({ fullPage: false });
      if (png.length < 40 * 1024) status = 'BLANK (<40KB) — not written';
      else {
        const file = path.join(ROUT, `${slug}-hero.webp`);
        await sharp(png).resize(1440, 900, { fit: 'cover' }).webp({ quality: 82 }).toFile(file);
        const meta = await sharp(file).metadata();
        manifest[slug] = { src: `/images/reviews/${slug}-hero.webp`, sourceUrl: url,
          capturedOn: new Date().toISOString().slice(0, 10), width: meta.width, height: meta.height };
      }
    } catch (e) {
      status = `FAILED: ${e.message.slice(0, 80)}`;
    }
    rRows.push([slug, status]);
    await ctx.close();
  }
  await rBrowser.close();
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log('SLUG            | RESULT');
  for (const [sl, r] of rRows) console.log(`${sl.padEnd(15)} | ${r}`);
  const bad = rRows.filter((r) => r[1] !== 'OK').length;
  console.log(`\ncaptured=${rRows.length - bad} failed=${bad} manifest=${MANIFEST}`);
  console.log(bad ? 'FAIL screenshots --reviews (record the failures; never ship a blank or a stand-in)' : 'PASS screenshots --reviews');
  process.exit(bad ? 1 : 0);
}

// ---------- MODE (a): checkpoint / audit evidence ----------
const routes = (get('--routes') ? get('--routes').split(',') : defaultRoutes()).map((r) => (r.endsWith('/') ? r : r + '/'));
const local = LIVE ? null : await serveDist();
const ORIGIN = LIVE || local.origin;
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const written = [];
for (const route of routes) {
  for (const width of WIDTHS) {
    for (const theme of THEMES) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme });
      const page = await ctx.newPage();
      await page.goto(ORIGIN + route, { waitUntil: 'load' });
      await page.waitForTimeout(3000);
      const name = `${(route.replace(/^\/|\/$/g, '') || 'home').replace(/\//g, '_')}-${width}-${theme}.png`;
      const file = path.join(OUT, name);
      await page.screenshot({ path: file, fullPage: true });
      written.push(file);
      await ctx.close();
    }
  }
}
await browser.close();
if (local) local.server.close();

console.log('FILE');
for (const w of written) console.log(`  ${w}`);
const expected = routes.length * WIDTHS.length * THEMES.length;
console.log(`\nroutes=${routes.length} widths=${WIDTHS.length} themes=${THEMES.length} expected=${expected} written=${written.length}`);
console.log(written.length === expected ? 'PASS screenshots' : 'FAIL screenshots (a missing PNG fails the checkpoint)');
process.exit(written.length === expected ? 0 : 1);
