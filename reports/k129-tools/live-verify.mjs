// K-129: verify the live preview's 48 breed pages and home.
const base = process.argv[2] ?? 'https://k129-content-gap.curioustails-sg.pages.dev';
const breeds = (await import('node:fs')).readdirSync('src/pages/puppies')
  .filter((f) => f.endsWith('.astro') && !['index.astro', 'bernedoodle.astro', 'labrador.astro'].includes(f))
  .map((f) => f.replace('.astro', ''))
  .sort();
const need = [
  'Toa Payoh MRT', 'Nelson and Kim', 'No pressure to buy', 'help you find',
  'Availability is not guaranteed until the deposit is received',
  'Week 6', 'Week 9', 'Week 16', 'Vets For Pets', 'pet ownership course',
  'How do I pay?', '3% bank surcharge', 'PayNow', 'up to a month',
  '8268 4039', '6255 6064',
];
const forbidden = ["until you're ready", 'until you are ready', 'until your home is ready', 'No add-ons quietly billed later'];
let failures = 0;
const check = async (route, html) => {
  for (const n of need) if (!html.includes(n)) { console.log(`FAIL ${route} missing: ${n}`); failures++; }
  for (const n of forbidden) if (html.includes(n)) { console.log(`FAIL ${route} forbidden: ${n}`); failures++; }
};
const home = await (await fetch(base + '/')).text();
await check('/', home);
let batch = [];
for (const b of breeds) {
  batch.push((async () => {
    const html = await (await fetch(`${base}/puppies/${b}/`)).text();
    await check(`/puppies/${b}/`, html);
  })());
  if (batch.length === 6) { await Promise.all(batch); batch = []; }
}
await Promise.all(batch);
console.log(`breeds=${breeds.length} failures=${failures}`);
