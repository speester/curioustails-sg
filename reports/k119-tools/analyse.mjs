// K-119 analysis: inspect the 48 breed pages for the exact structures the codemod must touch.
import fs from 'node:fs';
import path from 'node:path';

const EXCL = new Set(['index', 'bernedoodle', 'labrador']);
const files = fs.readdirSync('src/pages/puppies')
  .filter((f) => f.endsWith('.astro'))
  .map((f) => f.replace(/\.astro$/, ''))
  .filter((s) => !EXCL.has(s))
  .sort();

const report = [];
for (const slug of files) {
  const text = fs.readFileSync(path.join('src/pages/puppies', slug + '.astro'), 'utf8');
  const row = { slug };

  // 1. #price div and its footnote paragraph
  const priceStart = text.indexOf('id="price"');
  row.price = priceStart >= 0;
  if (priceStart >= 0) {
    const slice = text.slice(priceStart, priceStart + 6000);
    const splitEnd = slice.indexOf('/>');
    const tail = slice.slice(splitEnd, splitEnd + 1200);
    row.priceFootnoteP = /<p class="text-sm leading-relaxed text-\[var\(--color-cream-600\)\]">/.test(tail);
    row.priceFootnotePreview = tail.replace(/\s+/g, ' ').slice(0, 140);
  }

  // 2. aftercare block
  const acStart = text.indexOf('Free Training, Free Boarding and Real Aftercare');
  row.aftercare = acStart >= 0;
  if (acStart >= 0) {
    const bodyStart = text.indexOf('>', acStart) + 1;
    const firstP = text.indexOf('<p>', bodyStart);
    const firstPEnd = text.indexOf('</p>', firstP);
    row.firstAftercareP = firstP >= 0 && firstP - bodyStart < 600 ? text.slice(firstP, firstPEnd + 4).replace(/\s+/g, ' ') : '(none close)';
    const listStart = text.indexOf('Included, no add-on', acStart);
    row.sideList = listStart >= 0 ? text.slice(listStart, listStart + 400).replace(/\s+/g, ' ') : '(no side list)';
  }

  // 3. StatStrip all-in label
  const stat = text.match(/\{[^}]*value:[^}]*label:\s*'([^']*all-in[^']*)'/g);
  row.statLabels = stat ?? [];

  // 4. all-in occurrences with 60 chars of context
  row.allIn = [...text.matchAll(/all-in/g)].map((m) => text.slice(Math.max(0, m.index - 55), m.index + 20).replace(/\s+/g, ' '));

  // 5. AnswerCapsule content
  row.capsule = [...text.matchAll(/<AnswerCapsule>([\s\S]*?)<\/AnswerCapsule>/g)].map((m) => m[1].replace(/\s+/g, ' ').slice(0, 220));

  // 6. $500+ / 30+ occurrences
  row.kit = [...text.matchAll(/(\$500\+|worth \$500|30\+ items|30\+ starter)/g)].map((m) => text.slice(Math.max(0, m.index - 45), m.index + 45).replace(/\s+/g, ' '));

  // 7. vaccination table (the 6)
  row.vacc = text.includes('Vaccination and Licensing Timeline');

  // 8. FinalCta breed attr
  row.finalCtaBreed = (text.match(/<FinalCta[^>]*breed="([^"]+)"/) || [])[1] ?? null;

  // 9. until you're ready occurrences
  row.untilReady = [...text.matchAll(/until you(?:'|\\'|’)re ready|until your home is ready/gi)].map((m) => text.slice(Math.max(0, m.index - 70), m.index + 40).replace(/\s+/g, ' '));

  // 10. import line shape
  row.importsFinalCta = /import FinalCta from '\.\.\/\.\.\/components\/FinalCta\.astro';/.test(text);
  report.push(row);
}

fs.writeFileSync('reports/k119-tools/analysis.json', JSON.stringify(report, null, 1));
console.log('wrote reports/k119-tools/analysis.json', report.length);

const missingPrice = report.filter((r) => !r.priceFootnoteP).map((r) => r.slug + ' :: ' + r.priceFootnotePreview);
console.log('\nNO price footnote p (' + missingPrice.length + '):');
console.log(missingPrice.join('\n'));

const noAftercare = report.filter((r) => !r.aftercare).map((r) => r.slug);
console.log('\nNO aftercare block (' + noAftercare.length + '):', noAftercare.join(', '));

const noSide = report.filter((r) => r.aftercare && r.sideList === '(no side list)').map((r) => r.slug);
console.log('\nNO side list (' + noSide.length + '):', noSide.join(', '));

console.log('\nStat labels:');
report.forEach((r) => r.statLabels.length && console.log(' ', r.slug, JSON.stringify(r.statLabels)));

console.log('\nAftercare first p (sample):');
report.slice(0, 3).forEach((r) => console.log(' ', r.slug, '=>', r.firstAftercareP));

console.log('\nFinalCta breed missing:', report.filter((r) => !r.finalCtaBreed).map((r) => r.slug).join(', ') || 'none');
console.log('import missing:', report.filter((r) => !r.importsFinalCta).map((r) => r.slug).join(', ') || 'none');
console.log('untilReady total files:', report.filter((r) => r.untilReady.length).length);
