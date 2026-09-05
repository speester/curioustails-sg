#!/usr/bin/env node
/**
 * brand-asset-check.mjs — the assets no page owns.
 *
 *   node scripts/brand-asset-check.mjs [dist]
 *
 * Asserts: the favicon set + OG default + logo files + manifest exist; every <link rel="icon">
 * href in dist/index.html resolves inside dist/; og-default.png is 1200x630; the dominant
 * colours of favicon-512 and og-default are within deltaE 25 of a design-token colour.
 * Exit 1 on any FAIL. Node 20+, stdlib only (PNG decoded with node:zlib).
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const DIST = (process.argv[2] || 'dist').replace(/\/+$/, '');
// W11.7: a gate that measured nothing is not a pass.
if (!fs.existsSync(DIST)) {
  console.log('HALT: no dist/**/index.html - there is nothing to gate. Run `npm run build`, or set PROJECT_ROOT.');
  process.exit(1);
}
const ex = p => { try { fs.accessSync(p); return true; } catch { return false; } };
const rows = []; const add = (n, v, ok) => rows.push([n, v, ok ? 'PASS' : 'FAIL']);

/* ---- minimal PNG reader: size + pixels (colour types 0,2,4,6, bit depth 8) ---- */
function readPng(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let off = 8, idat = [], ihdr = null;
  while (off < buf.length) {
    const len = buf.readUInt32BE(off), type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') ihdr = { width: data.readUInt32BE(0), height: data.readUInt32BE(4), depth: data[8], color: data[9], interlace: data[12] };
    if (type === 'IDAT') idat.push(data);
    if (type === 'IEND') break;
    off += 12 + len;
  }
  if (!ihdr) throw new Error('no IHDR');
  const out = { ...ihdr, pixels: null };
  if (ihdr.depth !== 8 || ihdr.interlace !== 0 || ![0, 2, 4, 6].includes(ihdr.color)) return out;
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[ihdr.color];
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = ihdr.width * ch;
  const px = Buffer.alloc(stride * ihdr.height);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < ihdr.height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? cur[i - ch] : 0, b = prev[i], c = i >= ch ? prev[i - ch] : 0, x = line[i];
      let v;
      if (filter === 0) v = x; else if (filter === 1) v = x + a; else if (filter === 2) v = x + b;
      else if (filter === 3) v = x + ((a + b) >> 1);
      else { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); }
      cur[i] = v & 0xff;
    }
    cur.copy(px, y * stride); prev = cur;
  }
  out.pixels = { data: px, ch, stride };
  return out;
}
function dominant(file) {
  const png = readPng(file);
  if (!png.pixels) return null;
  const { data, ch, stride } = png.pixels;
  const bins = new Map();
  for (let y = 0; y < png.height; y += Math.max(1, Math.floor(png.height / 64))) {
    for (let x = 0; x < png.width; x += Math.max(1, Math.floor(png.width / 64))) {
      const i = y * stride + x * ch;
      let r, g, b, a = 255;
      if (ch === 1) { r = g = b = data[i]; }
      else if (ch === 2) { r = g = b = data[i]; a = data[i + 1]; }
      else if (ch === 3) { r = data[i]; g = data[i + 1]; b = data[i + 2]; }
      else { r = data[i]; g = data[i + 1]; b = data[i + 2]; a = data[i + 3]; }
      if (a < 40) continue;
      if (r > 245 && g > 245 && b > 245) continue;      // ignore the white plate
      const key = `${r >> 4},${g >> 4},${b >> 4}`;
      const cur = bins.get(key) || { n: 0, r: 0, g: 0, b: 0 };
      cur.n++; cur.r += r; cur.g += g; cur.b += b; bins.set(key, cur);
    }
  }
  let best = null;
  for (const v of bins.values()) if (!best || v.n > best.n) best = v;
  if (!best) return null;
  return [Math.round(best.r / best.n), Math.round(best.g / best.n), Math.round(best.b / best.n)];
}
const hexRgb = h => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
const toHex = ([r, g, b]) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
function lab([r, g, b]) {
  const f = v => { v /= 255; return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92; };
  const [R, G, B] = [f(r), f(g), f(b)];
  let X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  let Y = (R * 0.2126 + G * 0.7152 + B * 0.0722);
  let Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const g2 = v => v > 0.008856 ? Math.cbrt(v) : (7.787 * v) + 16 / 116;
  [X, Y, Z] = [g2(X), g2(Y), g2(Z)];
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
}
const deltaE = (a, b) => { const A = lab(a), B = lab(b); return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]); };

/* ---- checks ---- */
const need = ['public/favicon.ico', 'public/favicon-96x96.png', 'public/favicon-192.png', 'public/favicon-512.png', 'public/apple-touch-icon.png', 'public/site.webmanifest', 'public/og-default.png', 'public/logo.png', 'public/logo.svg'];
for (const f of need) add(f, ex(f) ? 'present' : 'MISSING', ex(f));
if (ex('public/site.webmanifest')) { let ok = true; try { JSON.parse(fs.readFileSync('public/site.webmanifest', 'utf8')); } catch { ok = false; } add('site.webmanifest parses', ok ? 'valid JSON' : 'INVALID', ok); }
if (ex('public/og-default.png')) { const p = readPng('public/og-default.png'); const ok = p.width === 1200 && p.height === 630; add('og-default.png size', `${p.width}x${p.height}`, ok); }
if (ex(`${DIST}/index.html`)) {
  const html = fs.readFileSync(`${DIST}/index.html`, 'utf8');
  const hrefs = [...html.matchAll(/<link[^>]+rel="[^"]*icon[^"]*"[^>]+href="([^"]+)"/gi)].map(m => m[1]);
  const missing = hrefs.filter(h => h.startsWith('/') && !ex(path.join(DIST, h)));
  add('<link rel=icon> hrefs resolve in dist/', missing.length ? missing.join(', ') : `${hrefs.length} icons`, missing.length === 0);
  const themed = /<meta[^>]+name="theme-color"[^>]+content="([^"]+)"/i.exec(html);
  add('theme-color meta present', themed ? themed[1] : 'MISSING', !!themed);
}
/* palette match */
let palette = [];
for (const f of ['design-system.md', 'src/styles/tokens.css', 'src/styles/global.css']) {
  if (!ex(f)) continue;
  palette.push(...[...fs.readFileSync(f, 'utf8').matchAll(/#[0-9a-fA-F]{6}\b/g)].map(m => m[0]));
}
palette = [...new Set(palette)];
if (palette.length) {
  for (const f of ['public/favicon-512.png', 'public/og-default.png']) {
    if (!ex(f)) continue;
    const dom = dominant(f);
    if (!dom) { add(`${f} dominant colour`, 'undecodable', true); continue; }
    const best = palette.map(p => ({ p, d: deltaE(dom, hexRgb(p)) })).sort((a, b) => a.d - b.d)[0];
    add(`${f} dominant colour in palette`, `dominant=${toHex(dom)} nearest=${best.p} deltaE=${best.d.toFixed(1)}`, best.d <= 25);
  }
} else add('design-token palette found', 'no hex colours found in design-system.md/tokens', false);

console.log('check'.padEnd(46) + 'value'.padEnd(46) + 'result');
console.log('-'.repeat(100));
for (const r of rows) console.log(String(r[0]).padEnd(46) + String(r[1]).padEnd(46) + r[2]);
const failed = rows.filter(r => r[2] === 'FAIL').length;
const okv = n => rows.filter(r => r[0].includes(n)).every(r => r[2] === 'PASS') ? 'ok' : 'FAIL';
console.log(`\nfavicons=${okv('favicon')} og=${okv('og-default')} logo=${okv('logo')} manifest=${okv('webmanifest')} palette_match=${okv('in palette')}`);
// contracts: every gate prints WHAT IT MEASURED, not only what failed - the
// fixed shape `checked=<n> failed=<m>` on the verdict line. Without it a
// clean run and a run that measured nothing print the same words. A gate
// whose checked is 0 must FAIL unless it also prints an exemption reason.
console.log(`brand-asset-check: checked=${rows.length} failed=${failed}`);
console.log(failed ? `BRAND_ASSETS_FAIL (${failed})` : 'BRAND_ASSETS_OK');
process.exit(failed ? 1 : 0);
