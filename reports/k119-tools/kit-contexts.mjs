import fs from 'node:fs';
const a = JSON.parse(fs.readFileSync('reports/k119-tools/analysis.json', 'utf8'));
const set = new Map();
for (const r of a) {
  for (const k of r.kit) {
    const key = k.replace(/\s+/g, ' ');
    set.set(key, (set.get(key) || 0) + 1);
  }
}
for (const [k, n] of [...set.entries()].sort((x, y) => y[1] - x[1])) console.log(String(n).padStart(2), '|', k);
