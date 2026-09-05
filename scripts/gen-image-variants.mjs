#!/usr/bin/env node
// gen-image-variants.mjs — responsive raster variants + the registry Image.astro reads.
//
// A single `src` ships ONE file to every device, so a phone on a slow connection
// downloads the full desktop raster. Image.astro accepted a `sizes` prop long before
// anything emitted `srcset`, which made `sizes` inert, and astro-build's component
// table claimed this component "wraps Astro <Image>: WebP, srcset" — it never did.
//
// Writes <name>-<w>w.webp beside each source and src/data/image-variants.json
// ({ "/images/a.webp": [480, 768, 1200] }). Image.astro emits srcset ONLY for files
// present in that registry, so a variant that was never built is never referenced.
//
// Usage:
//   node scripts/gen-image-variants.mjs --write   # generate + write the registry
//   node scripts/gen-image-variants.mjs --check   # registry matches what is on disk
// Exit 0 clean, 1 on drift/failure.
import { readdirSync, statSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, relative, extname, basename } from 'node:path';

const ROOT = process.env.PROJECT_ROOT || process.cwd();
// A project may keep its rasters somewhere other than public/images. config/project-config.md
// says where, once, as `IMAGE_ROOT:`; hardcoding the path made this instrument HALT against a
// tree that had 91 images in it, and a HALT is not a pass.
const IMAGE_ROOT = (() => {
  try {
    const m = readFileSync('config/project-config.md', 'utf8').match(/^IMAGE_ROOT:(.*)$/m);
    if (m) {
      const v = m[1].split('#')[0].trim();
      if (v) return v;
    }
  } catch { /* no config: the default below */ }
  return 'public/images';
})();
const IMAGES = join(ROOT, ...IMAGE_ROOT.split('/'));
const OUT = join(ROOT, 'src', 'data', 'image-variants.json');
const WIDTHS = [480, 768, 1200];       // phone · tablet · desktop-1x
const MIN_SOURCE = 900;                // below this a variant set saves nothing
const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const WRITE = args.includes('--write');

if (!CHECK && !WRITE) {
  console.log('usage: node scripts/gen-image-variants.mjs --write | --check');
  process.exit(2);
}
if (!existsSync(IMAGES)) {
  console.log(`HALT: ${IMAGES} missing - run from PROJECT_ROOT after images exist`);
  process.exit(1);
}

const VARIANT_RX = /-(\d+)w\.(webp|jpe?g|png|avif)$/i;
function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    statSync(p).isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
}
const sources = walk(IMAGES)
  .filter((f) => /\.(webp|jpe?g|png)$/i.test(f) && !VARIANT_RX.test(f));

let sharp;
try {
  ({ default: sharp } = await import('sharp'));
} catch {
  console.log('HALT: sharp not installed - it ships with Astro; run `npm i` first');
  process.exit(1);
}

const registry = {};
let made = 0, skipped = 0, missing = 0;

for (const src of sources) {
  const key = '/' + relative(join(ROOT, 'public'), src).split(/[\\/]/).join('/');
  let meta;
  try {
    meta = await sharp(src).metadata();
  } catch (e) {
    console.log(`FAIL unreadable ${key}: ${e.message}`);
    process.exit(1);
  }
  if (!meta.width || meta.width < MIN_SOURCE) { skipped++; continue; }
  const widths = WIDTHS.filter((w) => w < meta.width);
  if (!widths.length) { skipped++; continue; }

  const ext = extname(src);
  const built = [];
  for (const w of widths) {
    const out = join(dirname(src), `${basename(src, ext)}-${w}w${ext}`);
    if (existsSync(out)) { built.push(w); continue; }
    if (CHECK) { missing++; console.log(`FAIL missing variant ${w}w for ${key}`); continue; }
    mkdirSync(dirname(out), { recursive: true });
    await sharp(src).resize({ width: w }).webp({ quality: 76 }).toFile(out);
    built.push(w); made++;
  }
  if (built.length) registry[key] = built;
}

if (CHECK) {
  const onDisk = JSON.stringify(registry, null, 2) + '\n';
  const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  const drift = current !== onDisk;
  console.log(`variants: ${Object.keys(registry).length} sources, skipped=${skipped}, missing=${missing}, registry_drift=${drift}`);
  process.exit(missing || drift ? 1 : 0);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(registry, null, 2) + '\n', 'utf8');
console.log(`variants: ${Object.keys(registry).length} sources, generated=${made}, skipped(too small)=${skipped} -> ${relative(ROOT, OUT)}`);
// contracts section-1b, generator form: a generator that wrote NOTHING has
// silently done nothing, and the build then fails somewhere else entirely.
console.log(`gen-image-variants: wrote=${made} sources=${Object.keys(registry).length}`);
process.exit(0);
