// K-119: visible-word counter, same chrome-stripping as scripts/wordcount.mjs.
// Usage: node reports/k119-tools/count-words.mjs [outfile.json]
import fs from 'node:fs';
import path from 'node:path';

export function visibleText(html) {
  let s = html;
  for (const tag of ['header', 'footer', 'nav', 'script', 'style', 'aside', 'form', 'template']) {
    s = s.replace(new RegExp(`<${tag}[\\s\\S]*?</${tag}>`, 'gi'), ' ');
  }
  s = s.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
  return s;
}
export function visibleWords(html) {
  const s = visibleText(html);
  return s ? s.split(' ').length : 0;
}

const FILES = [
  ['home', 'dist/index.html'],
  ...fs.readdirSync('dist/puppies', { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join('dist/puppies', e.name, 'index.html')))
    .map((e) => [e.name, path.join('dist/puppies', e.name, 'index.html')])
    .filter(([slug]) => !['bernedoodle', 'labrador'].includes(slug)),
];

const out = {};
for (const [slug, file] of FILES) out[slug] = visibleWords(fs.readFileSync(file, 'utf8'));
const dest = process.argv[2];
if (dest) fs.writeFileSync(dest, JSON.stringify(out, null, 1));
const breedVals = Object.entries(out).filter(([k]) => k !== 'home').map(([, v]) => v);
const mean = breedVals.reduce((a, b) => a + b, 0) / breedVals.length;
console.log(`home=${out.home} breedMean=${mean.toFixed(1)} breeds=${breedVals.length} min=${Math.min(...breedVals)} max=${Math.max(...breedVals)}`);
