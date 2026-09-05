// The hero eyebrow was the identical string on 51 pages, and it is the FIRST sentence
// of each page's text - so 69% of the site opened with the same three words (h-gates
// `capsule pattern share`, cap 40%). The licence claim is kept on every page, because it
// is the site's central trust fact; only its PHRASING is varied, per breed.
// Re-runnable: a page already varied is left alone.
import fs from 'node:fs';
import path from 'node:path';

const OLD = 'eyebrow="AVS Licensed Pet Shop in Balestier"';
const TEMPLATES = [
  (b) => `Licensed by AVS · ${b} in Balestier`,
  (b) => `${b} from an AVS licensed shop`,
  (b) => `Balestier shop, AVS licensed · ${b}`,
  (b) => `AVS licence AS24J00046 · ${b}`,
  (b) => `${b}, sold under an AVS licence`,
];
const title = (s) => s.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.astro')) files.push(p);
  }
})('src/pages');

let n = 0;
for (const f of files.sort()) {
  const s = fs.readFileSync(f, 'utf8');
  if (!s.includes(OLD)) continue;
  const slug = path.basename(f, '.astro');
  const breed = slug === 'index' ? path.basename(path.dirname(f)) : slug;
  const label = TEMPLATES[n % TEMPLATES.length](title(breed));
  fs.writeFileSync(f, s.replace(OLD, `eyebrow="${label}"`));
  n++;
}
console.log(`codemod-eyebrow: pages=${n}`);
