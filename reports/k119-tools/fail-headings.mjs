import { execFileSync } from 'node:child_process';
const out = execFileSync('node', ['scripts/check-all-in-surcharge.mjs'], { encoding: 'utf8' });
const fails = out.split('\n').filter((l) => l.includes('FAIL /'));
const map = new Map();
for (const l of fails) {
  const m = l.match(/FAIL (\S+) :: (.*) ::/);
  if (!m) continue;
  const key = m[2];
  map.set(key, (map.get(key) || 0) + 1);
}
console.log('total fails', fails.length);
for (const [k, v] of [...map.entries()].sort((a, b) => b[1] - a[1])) console.log(String(v).padStart(3), k);
