// K-129 T10 completion: cap the boarding promise on the 48 breed pages.
// The "Free Training..." block was capped by K-119, but the same promise is
// repeated in the price-block paragraph with three phrasings. One identical
// replacement per phrasing, matching BOARDING_LINE's facts (up to a month,
// vaccinations kept on schedule at our cost).
import fs from 'node:fs';
import path from 'node:path';

const dir = 'src/pages/puppies';
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.astro')
  && !['index.astro', 'bernedoodle.astro', 'labrador.astro'].includes(f));

const rules = [
  {
    re: /we board your puppy for free, food and lodging covered, until your home is ready/g,
    to: 'we board your puppy for free for up to a month, food and lodging covered, with vaccinations kept on schedule at our cost',
  },
  {
    re: /we board your puppy free, food and lodging covered, until your home is ready/g,
    to: 'we board your puppy free for up to a month, food and lodging covered, with vaccinations kept on schedule at our cost',
  },
  {
    re: /we board your puppy for free until your home is ready/g,
    to: 'we board your puppy for free for up to a month, with vaccinations kept on schedule at our cost',
  },
];

let changed = 0;
const unmatched = [];
for (const f of files) {
  const p = path.join(dir, f);
  const before = fs.readFileSync(p, 'utf8');
  let after = before;
  for (const r of rules) after = after.replace(r.re, r.to);
  if (after !== before) {
    fs.writeFileSync(p, after);
    changed++;
  }
  if (/until (you(?:'|’)re|you are|your home is) ready/i.test(after)) unmatched.push(f);
}
console.log(`changed=${changed} files=${files.length}`);
console.log(`still-with-phrase=${unmatched.length}${unmatched.length ? ' ' + unmatched.join(',') : ''}`);
