// K-129: every built page that shows "all-in", and whether it also states the 3% surcharge.
import fs from 'node:fs';
import path from 'node:path';
const vis = (h) => h.replace(/<head[\s\S]*?<\/head>/i, ' ').replace(/<(script|style|svg|noscript|template)[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ');
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name === 'index.html' ? [path.join(d, e.name)] : []));
const rows = [];
for (const f of walk('dist')) {
  const t = vis(fs.readFileSync(f, 'utf8'));
  const n = (t.match(/all-in/gi) || []).length;
  if (!n) continue;
  const s = (t.match(/3% bank surcharge/gi) || []).length;
  rows.push([f.split(path.sep).join('/').replace(/^dist/, '').replace(/index\.html$/, ''), n, s]);
}
const gated = (r) => r === '/' || (/^\/puppies\/[a-z-]+\/$/.test(r) && !/bernedoodle|labrador/.test(r));
const g = rows.filter((r) => gated(r[0]));
const o = rows.filter((r) => !gated(r[0]));
console.log(`IN GATE (home + 48 breed): pages=${g.length} all-in=${g.reduce((a, r) => a + r[1], 0)} pages-without-surcharge=${g.filter((r) => !r[2]).length}`);
for (const k of ['/', '/puppies/maltipoo/', '/puppies/cavapoo/', '/puppies/corgi/']) { const r = g.find((x) => x[0] === k); console.log(`  ${k} all-in=${r[1]} surcharge=${r[2]}`); }
console.log('OUTSIDE GATE:');
const by = {};
for (const r of o) { const k = /^\/puppies\/[a-z-]+\/\d/.test(r[0]) ? '/puppies/<breed>/<id>/ (PuppyDetail)' : r[0]; by[k] ??= [0, 0, 0]; by[k][0]++; by[k][1] += r[1]; by[k][2] += r[2] ? 1 : 0; }
for (const [k, v] of Object.entries(by)) console.log(`  ${k} pages=${v[0]} all-in=${v[1]} pages-with-surcharge=${v[2]}`);
