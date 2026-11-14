// K-119: print every visible "all-in" sentence and the nearest surcharge sentence.
import fs from 'node:fs';
const vis = (h) => h.replace(/<head[\s\S]*?<\/head>/i, ' ')
  .replace(/<(script|style|svg|noscript|template)[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
const pages = ['dist/index.html', 'dist/puppies/maltipoo/index.html', 'dist/puppies/corgi/index.html'];
for (const f of pages) {
  const t = vis(fs.readFileSync(f, 'utf8'));
  const sentences = t.split(/(?<=[.!?])\s+/);
  const allin = sentences.filter((s) => /all-in/i.test(s));
  const sur = sentences.filter((s) => /3% bank surcharge/i.test(s));
  console.log(`\n=== ${f} ===`);
  console.log(`all-in sentences: ${allin.length}, surcharge sentences: ${sur.length}`);
  for (const s of allin.slice(0, 6)) console.log('  ALL-IN: ' + s.slice(0, 150));
  for (const s of sur.slice(0, 2)) console.log('  SURCHARGE: ' + s.slice(0, 150));
}
