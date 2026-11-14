import fs from 'node:fs';
for (const slug of ['bichonpoo', 'havanese']) {
  const html = fs.readFileSync(`dist/puppies/${slug}/index.html`, 'utf8').replace(/<script[\s\S]*?<\/script>/gi, ' ');
  for (const m of html.matchAll(/\$500\+/g)) {
    const before = html.slice(Math.max(0, m.index - 2000), m.index);
    const tags = [...before.matchAll(/<(\w+)[^>]*class="([^"]*)"/g)].slice(-2);
    console.log(slug, '|', tags.map((t) => t[1] + '.' + t[2]).join(' <- '));
    console.log('   ', before.slice(-160).replace(/\s+/g, ' '));
  }
}
