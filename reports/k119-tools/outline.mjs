// K-119: print the section outline of a breed page.
import fs from 'node:fs';
const slugs = process.argv.slice(2);
for (const s of slugs) {
  const t = fs.readFileSync('src/pages/puppies/' + s + '.astro', 'utf8');
  console.log('=== ' + s + ' ===');
  const out = [];
  for (const m of t.matchAll(/CaptionedBlock\s+heading="([^"]+)"|id="([a-z-]+)"|<BannerRibbon|<FinalCta/g)) {
    if (m[1]) out.push('CB:' + m[1]);
    else if (m[2]) out.push('#' + m[2]);
    else out.push(m[0].slice(0, 12));
  }
  console.log(out.join('\n'));
}
