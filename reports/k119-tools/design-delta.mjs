// K-119 design-audit delta: swap in the captured pre-change HTML for one route,
// run the audit, restore, and report only that route's failure count.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const cases = [
  ['dist/index.html', 'reports/k119-tools/before-home.html', '/'],
  ['dist/puppies/maltipoo/index.html', 'reports/k119-tools/before-maltipoo.html', '/puppies/maltipoo/'],
  ['dist/puppies/cavapoo/index.html', 'reports/k119-tools/before-cavapoo.html', '/puppies/cavapoo/'],
];

const countFor = (out, route) => {
  const lines = out.split('\n').filter((l) => l.trim().startsWith(route + ':') || l.trim().startsWith(route + ' '));
  return lines.length;
};

for (const [live, before, route] of cases) {
  const cur = fs.readFileSync(live, 'utf8');
  let afterOut = '';
  try {
    afterOut = execFileSync('node', ['scripts/design-audit.mjs', route, '--rhythm'], { encoding: 'utf8' });
  } catch (e) {
    afterOut = (e.stdout ?? '') + (e.stderr ?? '');
  }
  const after = countFor(afterOut, route);

  fs.writeFileSync(live, fs.readFileSync(before, 'utf8'));
  let beforeOut = '';
  try {
    beforeOut = execFileSync('node', ['scripts/design-audit.mjs', route, '--rhythm'], { encoding: 'utf8' });
  } catch (e) {
    beforeOut = (e.stdout ?? '') + (e.stderr ?? '');
  }
  const beforeN = countFor(beforeOut, route);
  fs.writeFileSync(live, cur);

  console.log(`${route}: before=${beforeN} after=${after} delta=${after - beforeN}`);
  const bLines = new Set(beforeOut.split('\n').filter((l) => l.trim().startsWith(route + ':')));
  for (const l of afterOut.split('\n').filter((l) => l.trim().startsWith(route + ':'))) {
    if (!bLines.has(l)) console.log('  NEW  ' + l.trim());
  }
}
