import fs from 'node:fs';
for (const s of process.argv.slice(2)) {
  const t = fs.readFileSync('src/pages/puppies/' + s + '.astro', 'utf8');
  console.log('=== ' + s + ' ===');
  for (const m of t.matchAll(/(boarding|aftercare|Aftercare|training lesson|Reserve)/g)) {
    const a = Math.max(0, m.index - 90);
    console.log('...' + t.slice(a, m.index + 110).replace(/\s+/g, ' ') + '...');
  }
  console.log();
}
