import fs from 'node:fs';
const html = fs.readFileSync('dist/puppies/bichonpoo/index.html', 'utf8');
const stripped = html.replace(/<script[\s\S]*?<\/script>/gi, ' ');
for (const m of stripped.matchAll(/\$500\+/g)) {
  console.log('---');
  console.log(stripped.slice(Math.max(0, m.index - 320), m.index + 160).replace(/</g, '\n<'));
}
