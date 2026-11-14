import fs from 'node:fs';
for (const s of ['cavapoo', 'bichonpoo', 'cockapoo', 'corgi', 'mini-dachshund', 'shiba-inu']) {
  const t = fs.readFileSync('src/pages/puppies/' + s + '.astro', 'utf8');
  const i = t.indexOf('Vaccination and Licensing Timeline');
  console.log('\n=== ' + s + ' ===');
  console.log(t.slice(Math.max(0, i - 260), i + 1800).replace(/\t/g, '  '));
}
