// K-119 sample check: three breed pages must render the shared additions
// identically, and differ only where their own data differs.
import fs from 'node:fs';

const SAMPLES = ['maltipoo', 'cavapoo', 'corgi'];
const pages = Object.fromEntries(SAMPLES.map((s) => [s, fs.readFileSync(`dist/puppies/${s}/index.html`, 'utf8')]));
const clean = (s) => (s ?? '').replace(/data-astro-cid-[a-z0-9]+/g, '').replace(/\s+/g, ' ');

const slice = (h, startNeedle, endNeedle, from = 0) => {
  const a = h.indexOf(startNeedle, from);
  if (a < 0) return null;
  const b = h.indexOf(endNeedle, a);
  if (b < 0) return null;
  return h.slice(a, b + endNeedle.length);
};

const parts = {
  timelineTable: (h) => {
    const i = h.indexOf('Vaccination and Licensing Timeline');
    if (i < 0) return null;
    const a = h.lastIndexOf('<table', i);
    const b = h.indexOf('</table>', i) + 8;
    return h.slice(a, b);
  },
  timelineNote: (h) => slice(h, 'For puppies at our shop:', 'before licensing.'),
  steps: (h) => slice(h, '<ol class="mx-auto max-w-[1400px] px-5 sm:px-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">', '</ol>'),
  priceDisclosure: (h) => slice(h, 'Vaccinations, microchip', 'credit card.'),
  ctaDirections: (h) => slice(h, '<p class="mt-3 max-w-[48ch] text-sm leading-relaxed text-white/70">', '</p>'),
  ctaOwners: (h) => slice(h, '<p class="mt-2 max-w-[48ch] text-sm leading-relaxed text-white/70">', '</p>'),
  ctaAvailability: (h) => slice(h, '<p class="relative text-xs leading-relaxed text-white/55">', '</p>'),
  heroSurcharge: (h) => slice(h, '<p class="mt-1 text-sm text-[var(--color-cream-500)]">', '</p>'),
};

const verdict = {};
for (const [name, fn] of Object.entries(parts)) {
  const vals = SAMPLES.map((s) => clean(fn(pages[s])));
  const present = vals.every(Boolean);
  const identical = present && new Set(vals).size === 1;
  verdict[name] = identical;
  console.log(`${name}: present=${present} identical=${identical}`);
  if (!identical && present) {
    for (let i = 0; i < vals.length; i++) {
      const j = (i + 1) % vals.length;
      let d = 0;
      while (d < Math.min(vals[i].length, vals[j].length) && vals[i][d] === vals[j][d]) d++;
      console.log(`   ${SAMPLES[i]} vs ${SAMPLES[j]} at ${d}: ${vals[i].slice(d, d + 100)}  !=  ${vals[j].slice(d, d + 100)}`);
    }
  }
}

// Where the pages should differ: their own breed copy and prices.
for (const s of SAMPLES) {
  const h = pages[s];
  console.log(`${s}: price=${(h.match(/\$[\d,]{4,}/) ?? ['?'])[0]} h1=${clean(slice(h, '<h1', '</h1>'))}`);
}

console.log('\nALL SHARED IDENTICAL:', Object.values(verdict).every(Boolean));
process.exit(Object.values(verdict).every(Boolean) ? 0 : 1);
