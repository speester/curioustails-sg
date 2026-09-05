#!/usr/bin/env node
// kit:gen-image-dims@1.0.0 — intrinsic sizes for every raster and SVG, so nothing ships unsized.
// Usage: node scripts/gen-image-dims.mjs --check | --write
// Uses sharp for rasters (already a kit dependency) and a viewBox parse for SVG.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const write = process.argv.includes('--write');
const OUT = path.join('src', 'data', 'image-dims.json');
// A project may keep its rasters somewhere other than public/images. config/project-config.md
// says where, once, as `IMAGE_ROOT:`; hardcoding the path made this instrument HALT against a
// tree that had 91 images in it, and a HALT is not a pass.
const IMAGE_ROOT = (() => {
  try {
    const m = fs.readFileSync('config/project-config.md', 'utf8').match(/^IMAGE_ROOT:(.*)$/m);
    if (m) {
      const v = m[1].split('#')[0].trim();
      if (v) return v;
    }
  } catch { /* no config: the default below */ }
  return 'public/images';
})();
const ROOTS = [IMAGE_ROOT, 'public/figures', 'src/assets'];
const RASTER = new Set(['.webp', '.png', '.jpg', '.jpeg', '.avif', '.gif']);

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function publicPath(file) {
  const norm = file.replace(/\\/g, '/');
  if (norm.startsWith('public/')) return norm.slice('public'.length);
  return '/' + norm;                       // src/assets/... keeps its project-relative key
}

const files = ROOTS.flatMap((r) => walk(r));
const dims = {};
const problems = [];

for (const f of files) {
  const ext = path.extname(f).toLowerCase();
  const key = publicPath(f);
  try {
    if (RASTER.has(ext)) {
      const m = await sharp(f).metadata();
      if (!m.width || !m.height) { problems.push(`${f}: no intrinsic size`); continue; }
      dims[key] = { width: m.width, height: m.height, type: ext.slice(1) };
      // A FLAT 4KB FLOOR flags a legitimately small file (2026-09-05: a real 480x268 WebP
      // variant at 3,480 B, full tonal range, downscaled by gen-image-variants). What the
      // check is actually for is a BLANK capture, so scale the floor with the pixel count:
      // roughly 0.005 bytes per pixel is far below any real photographic WebP and still
      // catches an empty or single-colour image at any size.
      const bytes = fs.statSync(f).size;
      const floor = Math.max(1024, Math.round(m.width * m.height * 0.005));
      if (RASTER.has(ext) && bytes < floor) problems.push(`${f}: suspiciously small (${bytes} B for ${m.width}x${m.height}, floor ${floor} B) — possible blank capture`);
    } else if (ext === '.svg') {
      const txt = fs.readFileSync(f, 'utf8');
      const vb = txt.match(/viewBox="([\d.\s-]+)"/);
      const w = txt.match(/\bwidth="([\d.]+)/), h = txt.match(/\bheight="([\d.]+)/);
      let width = w ? Number(w[1]) : null, height = h ? Number(h[1]) : null;
      if ((!width || !height) && vb) {
        const [, , vw, vh] = vb[1].trim().split(/\s+/).map(Number);
        width = width ?? vw; height = height ?? vh;
      }
      if (!width || !height) { problems.push(`${f}: no width/height and no usable viewBox`); continue; }
      dims[key] = { width: Math.round(width), height: Math.round(height), type: 'svg' };
    }
  } catch (e) {
    problems.push(`${f}: ${e.message}`);
  }
}

const body = JSON.stringify(Object.fromEntries(Object.entries(dims).sort(([a], [b]) => a.localeCompare(b))), null, 2) + '\n';
const existing = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
const drift = existing.trim() !== body.trim();

console.log('CHECK                    | RESULT');
console.log(`assets scanned           | ${files.length}`);
console.log(`dims recorded            | ${Object.keys(dims).length}`);
console.log(`problems                 | ${problems.length ? `FAIL (${problems.length})` : 'PASS'}`);
for (const p of problems) console.log('   ' + p);
console.log(`src/data/image-dims.json | ${drift ? 'FAIL (stale)' : 'PASS'}`);

if (write) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, body, 'utf8');
  // Image.astro statically imports the SIBLING registry too, and a static import of a
  // missing JSON file is a hard build failure - so a project that pulls a newer kit
  // without having run gen-image-variants yet would simply not build. Seed it empty
  // here (never overwrite a real one): an empty registry means "no variants", and
  // Image.astro degrades to a plain <img>.
  const VARIANTS = path.join('src', 'data', 'image-variants.json');
  if (!fs.existsSync(VARIANTS)) {
    fs.writeFileSync(VARIANTS, '{}' + String.fromCharCode(10), 'utf8');
    console.log('seeded ' + VARIANTS + ' (empty - run `npm run gen:variants` to fill it)');
  }
  console.log('\nPASS wrote ' + OUT);
  process.exit(problems.length ? 1 : 0);
}
console.log(drift || problems.length ? '\nFAIL gen-image-dims' : '\nPASS gen-image-dims');
process.exit(drift || problems.length ? 1 : 0);
