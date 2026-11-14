// K-129 T15: no visible "$500+" or "30+ items" on home + 48 breed pages.
import fs from 'node:fs';
const strip = (h) => h
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<title[\s\S]*?<\/title>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ');
const pages = [
  ['/', 'dist/index.html'],
  ...fs.readdirSync('dist/puppies', { withFileTypes: true })
    .filter((e) => e.isDirectory()
      && fs.existsSync(`dist/puppies/${e.name}/index.html`)
      && !['bernedoodle', 'labrador'].includes(e.name))
    .map((e) => [`/puppies/${e.name}/`, `dist/puppies/${e.name}/index.html`]),
];
const bad = [];
for (const [route, file] of pages) {
  const text = strip(fs.readFileSync(file, 'utf8'));
  if (text.includes('$500+') || text.includes('30+ items')) bad.push(route);
}
console.log(`pages=${pages.length} visible_500plus=${bad.length}${bad.length ? ' ' + bad.join(',') : ''}`);
