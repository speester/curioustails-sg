import fs from 'node:fs';
const s = process.argv[2];
const t = fs.readFileSync('src/pages/puppies/' + s + '.astro', 'utf8');
const idxs = [...t.matchAll(/id="health"/g)].map((m) => m.index);
console.log('count', idxs.length);
for (const i of idxs) console.log('\n----\n' + t.slice(i - 200, i + 900));
