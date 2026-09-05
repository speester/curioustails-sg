// kit:wire@1.0.0 — shared engine for idempotent, route-keyed wiring scripts.
// Every wiring script: reads dist-independent SOURCE pages, resolves a value by ROUTE
// from a registry, inserts it exactly once, and PRINTS WHAT IT COULD NOT PLACE.
import fs from 'node:fs';
import path from 'node:path';

export function canonicalPath(p) {
  if (!p) return '/';
  let s = String(p).trim().split('#')[0].split('?')[0];
  if (!s.startsWith('/')) s = '/' + s;
  s = s.replace(/\/{2,}/g, '/');
  const last = s.split('/').filter(Boolean).pop() ?? '';
  if (last.includes('.')) return s;
  return s.endsWith('/') ? s : s + '/';
}

export function slashTolerant(map, p) {
  const c = canonicalPath(p);
  return map[c] ?? map[c.replace(/\/$/, '')] ?? map[c.replace(/\/$/, '') + '/'];
}

/** All page files under src/pages, with their route path. */
export function pageFiles(root = path.join('src', 'pages')) {
  const out = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!e.name.endsWith('.astro')) continue;
      let rel = path.relative(root, p).replace(/\\/g, '/').replace(/\.astro$/, '');
      rel = rel.replace(/\/index$/, '').replace(/^index$/, '');
      out.push({ file: p, route: canonicalPath('/' + rel) });
    }
  };
  walk(root);
  return out;
}

export function readJson(file, fallback = {}) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
}

/**
 * Run a wiring pass.
 *  opts.name       label for the table
 *  opts.registry   route -> value (already loaded)
 *  opts.marker     substring that proves the value is already wired into a page
 *  opts.render     (value, ctx) => string to insert
 *  opts.anchor     RegExp; insertion happens BEFORE the first match in the page body
 *  opts.write      boolean
 */
export function runWire(opts) {
  const { name, registry, marker, render, anchor, write } = opts;
  const rows = [];
  const unplaced = [];
  let changed = 0;

  for (const { file, route } of pageFiles()) {
    const value = slashTolerant(registry, route);
    if (value === undefined) { rows.push([route, 'NO-DATA']); unplaced.push(route); continue; }
    const src = fs.readFileSync(file, 'utf8');
    if (src.includes(marker)) { rows.push([route, 'ALREADY']); continue; }
    const m = anchor.exec(src);
    anchor.lastIndex = 0;
    if (!m) { rows.push([route, 'NO-ANCHOR']); unplaced.push(route); continue; }
    const insert = render(value, { route, file });
    const next = src.slice(0, m.index) + insert + '\n' + src.slice(m.index);
    if (write) fs.writeFileSync(file, next, 'utf8');
    changed++;
    rows.push([route, write ? 'WROTE' : 'WOULD-WRITE']);
  }

  console.log(`ROUTE${' '.repeat(45)}| STATUS`);
  for (const [r, s] of rows) console.log(`${r.padEnd(50)}| ${s}`);
  console.log(`\n${name}: pages=${rows.length} changed=${changed} mode=${write ? 'WRITE' : 'DRY'}`);
  console.log(`could not place: ${unplaced.length}`);
  for (const u of unplaced) console.log(`  ${u}`);
  console.log(unplaced.length === 0 ? `PASS ${name}` : `FAIL ${name} (unplaced routes above)`);
  return unplaced.length === 0 ? 0 : 1;
}
