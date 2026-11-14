import fs from 'node:fs';
const h = fs.readFileSync('dist/puppies/yorkshire-terrier/index.html', 'utf8');
for (const m of h.matchAll(/all-in/gi)) {
  console.log('---');
  console.log(h.slice(Math.max(0, m.index - 220), m.index + 120).replace(/</g, '\n<').slice(-420));
}
