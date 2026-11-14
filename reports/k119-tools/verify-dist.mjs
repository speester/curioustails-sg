// K-119 verification against dist/: home + 48 breed pages.
import fs from 'node:fs';
import path from 'node:path';

const EXCL = new Set(['index', 'bernedoodle', 'labrador']);
const breeds = fs.readdirSync('dist/puppies', { withFileTypes: true })
  .filter((e) => e.isDirectory() && fs.existsSync(path.join('dist/puppies', e.name, 'index.html')))
  .map((e) => e.name)
  .filter((s) => !EXCL.has(s))
  .sort();

const visible = (html) => html
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<blockquote[\s\S]*?<\/blockquote>/gi, ' ')
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&[a-z#0-9]+;/gi, ' ')
  .replace(/\s+/g, ' ');

const fails = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); };

const home = fs.readFileSync('dist/index.html', 'utf8');
const homeText = visible(home);
ok(/The only extra is the 3% bank surcharge if you pay by credit card/.test(homeText), 'home: surcharge line');
ok(/How do I pay\?/.test(home), 'home: FAQ JSON-LD has How do I pay');
ok(/Pay by PayNow, bank transfer, cash or credit card./.test(homeText), 'home: payment line');
ok(!/first-confirmed/i.test(homeText), 'home: first-confirmed gone');
ok(!/Not Ready to Reserve Yet/.test(homeText), 'home: duplicate ribbon gone');
ok(/Book a viewing/.test(homeText), 'home: Book a viewing');
ok(/Toa Payoh MRT/.test(homeText), 'home: directions');
ok(/Nelson and Kim, who are in the shop/.test(homeText), 'home: owners line');
ok(/No pressure to buy/.test(homeText), 'home: no pressure');
ok(/Availability is not guaranteed until the deposit is received/.test(homeText), 'home: availability line');
ok(/Vets For Pets/.test(homeText), 'home: Vets For Pets');
ok(/Pet Ownership Course/.test(homeText), 'home: POC');
ok(!/We mention this once, plainly/.test(homeText), 'home: old health line gone');
ok(/the full schedule/.test(homeText), 'home: full schedule link');
ok(/\$533/.test(homeText), 'home: $533 kit');
ok(!/\$500\+/.test(homeText), 'home: no visible $500+');
ok(/Gone already\?/.test(homeText), 'home: sold-puppy line');
ok(!/tell us the breed and we will let you know when one arrives/i.test(homeText), 'home: FAQ 13 sentence removed');
ok(/8268 4039/.test(homeText) && /6255 6064/.test(homeText), 'home: both clinic numbers');

let sample = null;
let totalTL = 0;
for (const slug of breeds) {
  const html = fs.readFileSync(`dist/puppies/${slug}/index.html`, 'utf8');
  const t = visible(html);
  const tag = `/puppies/${slug}/`;
  const want = [
    [/The only extra is the 3% bank surcharge if you pay by credit card/, 'surcharge'],
    [/Pay by PayNow, bank transfer, cash or credit card./, 'payment'],
    [/Vaccinations, microchip, licence paperwork/, 'inclusions'],
    [/How do I pay\?/, 'FAQ'],
    [/Vaccination and Licensing Timeline/, 'timeline'],
    [/Week 6/, 'week 6'],
    [/Week 9/, 'week 9'],
    [/Fourth core vaccination/, 'week 16 core'],
    [/Vets For Pets/, 'vets'],
    [/8268 4039/, 'mobile'],
    [/6255 6064/, 'landline'],
    [/You take the vaccination and health records home with you/, 'records'],
    [/Pet Ownership Course|pet ownership course/, 'POC'],
    [/What Happens After You Reserve/, 'steps heading'],
    [/Toa Payoh MRT/, 'directions'],
    [/Nelson and Kim, who are in the shop/, 'owners'],
    [/No pressure to buy/, 'no pressure'],
    [/help you find the one that is/, 'help find'],
    [/Availability is not guaranteed until the deposit is received/, 'availability'],
    [/Tell us the breed and we will let you know when one arrives/, 'next litter'],
    [/up to a month/, 'boarding cap'],
    [/\$533/, 'kit total'],
  ];
  for (const [rx, label] of want) ok(rx.test(t), `${tag} missing ${label}`);
  ok(!/No add-ons quietly billed later/.test(t), `${tag} retired promise`);
  ok(!/until you(?:'|’)re ready/i.test(t), `${tag} until you're ready`);
  ok(!/\$500\+/.test(t), `${tag} visible $500+`);
  const faqLd = html.match(/"@type":"FAQPage"[\s\S]*?<\/script>/);
  ok(faqLd && /"How do I pay\?"/.test(faqLd[0]), `${tag} FAQ JSON-LD missing How do I pay`);
  // The timeline must not sit inside an imported/overseas block.
  const impIdx = html.indexOf('data-import-section');
  const ovIdx = html.indexOf('Reserve a ' + slug + ' from Australia');
  const tlIdx = html.indexOf('Vaccination and Licensing Timeline');
  if (impIdx >= 0) ok(!(tlIdx > impIdx && tlIdx < html.indexOf('</section>', impIdx)), `${tag} timeline inside imported block`);
  if (ovIdx >= 0) ok(!(tlIdx > ovIdx && tlIdx < html.indexOf('</section>', ovIdx)), `${tag} timeline inside overseas block`);
  totalTL++;
  if (slug === 'maltipoo') sample = { slug, html, t };
}

// Three samples: identical boilerplate, different data.
const samples = ['maltipoo', 'cavapoo', 'corgi'].map((slug) => ({
  slug,
  html: fs.readFileSync(`dist/puppies/${slug}/index.html`, 'utf8'),
}));
const norm = (h) => h
  .replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/data-astro-cid-[a-z0-9]+/g, '')
  .replace(/(Maltipoo|Cavapoo|Corgi)/g, 'BREED')
  .replace(/\$\d[\d,]*/g, '$PRICE');
const a = norm(samples[0].html);
const b = norm(samples[1].html);
const c = norm(samples[2].html);
const sameAB = a === b;
const sameAC = a === c;

console.log(`breed pages checked=${totalTL}`);
console.log(`sample diff (normalised): maltipoo==cavapoo ${sameAB}, maltipoo==corgi ${sameAC}`);
console.log(`sample lengths raw: ${samples.map((s) => s.slug + '=' + s.html.length).join(' ')}`);
console.log(`failed checks=${fails.length}`);
for (const f of fails.slice(0, 60)) console.log('  FAIL ' + f);
process.exit(fails.length ? 1 : 0);
