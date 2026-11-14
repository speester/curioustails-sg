// K-119 fix: the codemod's String.replace with '$${KIT_TOTAL}' treated $$ as an
// escaped dollar, so every kit price lost its leading $. Restore it once.
import fs from 'node:fs';
const DIR = 'src/pages/puppies';
const EXCL = new Set(['index', 'bernedoodle', 'labrador']);
let n = 0;
let files = 0;
for (const f of fs.readdirSync(DIR)) {
  if (!f.endsWith('.astro') || EXCL.has(f.replace('.astro', ''))) continue;
  const p = `${DIR}/${f}`;
  const t = fs.readFileSync(p, 'utf8');
  const next = t.replace(/(?<!\$)\$\{KIT_TOTAL\}/g, () => '$${KIT_TOTAL}');
  if (next !== t) {
    n += (t.match(/(?<!\$)\$\{KIT_TOTAL\}/g) ?? []).length;
    files++;
    fs.writeFileSync(p, next);
  }
}
console.log(`fixed ${n} kit prices in ${files} files`);
