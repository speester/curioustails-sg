#!/usr/bin/env node
// kit:wire-images@1.0.0 — place in-body images from public/images/asset-map.json by ROUTE.
import { runWire, readJson } from './lib/wire.mjs';
const write = process.argv.includes('--write');
const map = readJson('public/images/asset-map.json', {});
// W10.4 - `inbody` IS WRITTEN BY NOTHING. kie_batch.py writes `{feature?, images:[{file,
// alt_text, outline_section}]}` and RouteImage.astro reads `.images`; this file read
// `v.inbody[].src/.alt`, so on a 27-route site every route reported NO-DATA and
// `wire-images` FAILED while the images sat on disk. Read `images`, and accept both the
// `file`/`alt_text` names kie_batch writes and the `src`/`alt` names a hand-authored entry
// might use.
const imagesOf = (v) => {
  const list = Array.isArray(v) ? v : (v?.images ?? []);
  return list
    .filter((x) => x && typeof x === 'object')
    .map((x) => ({ src: x.src || x.file || '', alt: x.alt || x.alt_text || '' }))
    .filter((x) => x.src);
};
const registry = Object.fromEntries(Object.entries(map).filter(([, v]) => imagesOf(v).length));
process.exit(runWire({
  name: 'wire-images',
  registry,
  marker: 'data-wired="inbody-image"',
  anchor: /<!--\s*WIRE:inbody-image\s*-->/,
  render: (v) => imagesOf(v).map((img) =>
    `<Image data-wired="inbody-image" src="${img.src}" alt="${(img.alt || '').replace(/"/g, '&quot;')}" />`).join('\n'),
  write,
}));
