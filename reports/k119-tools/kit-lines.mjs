import fs from 'node:fs';
const lines = new Map();
for (const f of fs.readdirSync('src/pages/puppies')) {
  if (!f.endsWith('.astro')) continue;
  const t = fs.readFileSync('src/pages/puppies/' + f, 'utf8').split('\n');
  t.forEach((l, i) => {
    if (!l.includes('$500+') && !l.includes('30+')) return;
    const k = l.trim();
    lines.set(k, (lines.get(k) || 0) + 1);
  });
}
for (const [l, n] of [...lines.entries()].sort((a, b) => b[1] - a[1])) console.log(String(n).padStart(2), '|', l.slice(0, 230));
