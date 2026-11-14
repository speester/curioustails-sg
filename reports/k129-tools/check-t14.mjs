// K-129 T14 counts: next-litter line once per breed, similar-puppy line once on home.
import fs from 'node:fs';
const breeds = fs.readdirSync('src/pages/puppies')
  .filter((f) => f.endsWith('.astro') && !['index.astro', 'bernedoodle.astro', 'labrador.astro'].includes(f))
  .map((f) => f.replace('.astro', ''));
const counts = {};
const bad = [];
for (const b of breeds) {
  const html = fs.readFileSync(`dist/puppies/${b}/index.html`, 'utf8');
  const n = (html.match(/Tell us the breed and we will let you know when one arrives\./g) ?? []).length;
  counts[n] = (counts[n] ?? 0) + 1;
  if (n !== 1) bad.push(`${b}:${n}`);
}
const home = fs.readFileSync('dist/index.html', 'utf8');
const sim = (home.match(/Gone already\?/g) ?? []).length;
console.log('next-litter counts', JSON.stringify(counts), 'bad=' + bad.length, bad.slice(0, 8).join(','));
console.log('home similar line count=' + sim);
