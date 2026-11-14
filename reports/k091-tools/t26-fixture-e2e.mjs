// K-091 / T26 second half: the full chain from stored source records to a
// rendered page, then a takedown, using the REAL pipeline against a TEMPORARY
// private store outside the repo. Nothing here touches production or the real
// private store, and nothing is deployed.
//
// Why a fixture: with IMPORTS_AUTOPUBLISH unset the live dry run can only reach
// 'auto-ready'. Rendering a page therefore needs an explicit owner approval,
// which no live listing has. This proves that path: a gate-passing dogsy record
// is approved, published to the public feed, rendered, leaked-scanned, taken
// down, and removed by the next build. A lead-only dfsi record and a sold dogsy
// record are seeded alongside it and must never appear.
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { openStore } from '../../scripts/imports/lib/store.mjs';
import { publicIds } from '../../scripts/imports/lib/hash.mjs';
import { cleanRecord, seed } from '../../scripts/imports/tests/_pipeline-fixtures.mjs';

const REPO = process.cwd();
const storeDir = mkdtempSync(join(tmpdir(), 'k091-e2e-store-'));
const shots = 'reports/k091-shots';
mkdirSync(shots, { recursive: true });
const env = { ...process.env, IMPORTS_PRIVATE_DIR: storeDir };
delete env.IMPORTS_AUTOPUBLISH;
env.IMPORTS_DFSI_MODE = 'lead-only';

const run = (cmd) => execSync(cmd, { cwd: REPO, env, stdio: 'pipe', encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const steps = [];
const record = (step, value) => { steps.push({ step, ...value }); console.log(step, JSON.stringify(value)); };

const store = openStore({ dir: storeDir });
const stageDir = store.path('images-processed');
mkdirSync(stageDir, { recursive: true });

// 1. A clean dogsy JRT — the only record that may become visible.
const clean = cleanRecord(store, { listingId: 'k091-clean-jrt' });
const cleanId = publicIds(store.secret(), clean.supplier, clean.listingId).id;
const photoSources = [
  'src/assets/jack-russell-terrier/1-white-and-tan-jack-russell-terrier-puppy-sitting-in-a-s.webp',
  'src/assets/jack-russell-terrier/2-white-and-tan-jack-russell-terrier-puppy-portrait-one-o.webp',
  'src/assets/jack-russell-terrier/3-jack-russell-terrier-puppy-sprinting-after-a-ball-at-a.webp',
];


// 2. A lead-only dfsi record that is otherwise clean: review, never a listing.
const lead = cleanRecord(store, {
  supplier: 'dfsi',
  viaSite: 'dogsforsaleireland.ie',
  listingId: 'k091-lead-chihuahua',
  sourceUrl: 'https://dogsforsaleireland.ie/ad/k091-lead-chihuahua/',
  breedRaw: 'Chihuahua',
  priceRaw: '€500',
  priceNumber: 500,
  chips: ['372112345678910'],
  county: 'Cork',
  town: 'Cork City',
  images: [],
  imageSourceUrls: [],
});
const leadId = publicIds(store.secret(), lead.supplier, lead.listingId).id;

// 3. A sold dogsy record: a hard reject that must never be rendered.
const sold = cleanRecord(store, {
  listingId: 'k091-sold-beagle',
  breedRaw: 'Beagle',
  priceRaw: '€600',
  priceNumber: 600,
  chips: ['372112345678920'],
  sourceStatus: 'sold',
  images: [],
  imageSourceUrls: [],
});
const soldId = publicIds(store.secret(), sold.supplier, sold.listingId).id;

seed(store, [clean, lead, sold]);
// seed() writes placeholder bytes for every image; replace the clean pup's three
// stage files with real WebPs so Astro can read their metadata at build time.
clean.images.forEach((img, i) => {
  copyFileSync(photoSources[i], join(stageDir, img.filename));
  copyFileSync(photoSources[i], join(stageDir, img.cardFilename));
});
record('seeded', { cleanId, leadId, soldId, storeOutsideRepo: !storeDir.startsWith(REPO) });

// 4. First sync: safety valve holds the clean item as auto-ready, feed stays empty.
run('node scripts/imports/sync-imports.mjs --no-fetch');
let feed = readJson('src/data/imported-puppies.json');
let queue = readJson(join(storeDir, 'review-queue.json'));
record('sync-1', {
  feedPups: feed.pups.length,
  cleanInFeed: feed.pups.some((p) => p.id === cleanId),
  queueIds: queue.map((q) => q.id),
  cleanDisposition: queue.find((q) => q.id === cleanId)?.disposition,
  leadDisposition: queue.find((q) => q.id === leadId)?.disposition,
  leadLeadOnly: queue.find((q) => q.id === leadId)?.leadOnly,
  soldInQueue: queue.some((q) => q.id === soldId),
});
if (feed.pups.length !== 0) throw new Error('safety valve leaked a feed pup');
if (!queue.some((q) => q.id === cleanId && q.disposition === 'auto-ready')) throw new Error('clean item not auto-ready');
if (!queue.some((q) => q.id === leadId && q.disposition === 'review' && q.leadOnly)) throw new Error('lead-only item not held in review');

// 5. Owner approves the clean item only. The next sync publishes it.
run(`node scripts/imports/approve.mjs approve ${cleanId} --actor owner:k091 --repo .`);
run('node scripts/imports/sync-imports.mjs --no-fetch');
feed = readJson('src/data/imported-puppies.json');
record('sync-2', {
  feedPups: feed.pups.length,
  ids: feed.pups.map((p) => ({ id: p.id, breed: p.breed, status: p.status })),
  leadInFeed: feed.pups.some((p) => p.id === leadId),
  soldInFeed: feed.pups.some((p) => p.id === soldId),
});
if (feed.pups.length !== 1 || feed.pups[0].id !== cleanId) throw new Error('approved item did not publish exactly once');
if (feed.pups.some((p) => p.id === leadId || p.id === soldId)) throw new Error('a non-publishable record reached the feed');

// 6. Build, then prove the rendered output: only the approved record, never lead-only.
run('npm run build');
const detailPath = `dist/puppies/${clean.puppyBreed || 'jack-russell-terrier'}/${cleanId}/index.html`;
const detailFile = existsSync(detailPath) ? detailPath : `dist/puppies/jack-russell-terrier/${cleanId}/index.html`;
const breedFile = 'dist/puppies/jack-russell-terrier/index.html';
const availableFile = 'dist/available-puppies/index.html';
const detailHtml = readFileSync(detailFile, 'utf8');
const breedHtml = readFileSync(breedFile, 'utf8');
const availableHtml = readFileSync(availableFile, 'utf8');
const allHtml = [detailHtml, breedHtml, availableHtml].join('\n');
record('build-1', {
  detailRendered: existsSync(detailFile),
  detailHasCleanRef: detailHtml.includes(cleanRef(cleanId)),
  detailHasPreOrder: detailHtml.includes('https://schema.org/PreOrder'),
  detailHasNoindexFollow: detailHtml.includes('noindex,follow'),
  breedCardRendered: breedHtml.includes(`/puppies/jack-russell-terrier/${cleanId}/`),
  availableSectionRendered: availableHtml.includes('Arriving soon'),
  leadIdInRendered: allHtml.includes(leadId),
  leadRefInRendered: allHtml.includes('CT-IE-' + leadId.slice(4, 10).toUpperCase()),
  soldIdInRendered: allHtml.includes(soldId),
  sitemapHasImported: readFileSync('dist/sitemap-0.xml', 'utf8').includes('/imp-'),
  redirectsBeforeTakedown: readFileSync('dist/_redirects', 'utf8').includes(cleanId),
});
if (!existsSync(detailFile)) throw new Error('imported detail page not built');
if (!detailHtml.includes('https://schema.org/PreOrder') || !detailHtml.includes('noindex,follow')) throw new Error('schema/noindex missing');
if (allHtml.includes(leadId) || allHtml.includes(soldId)) throw new Error('a non-publishable record rendered');
if (readFileSync('dist/sitemap-0.xml', 'utf8').includes('/imp-')) throw new Error('imported page in sitemap');

// Screenshots of the rendered T26 surfaces before takedown.
{
  const browser = await chromium.launch();
  for (const [name, path] of [
    ['t26-detail', `/puppies/jack-russell-terrier/${cleanId}/`],
    ['t26-breed', '/puppies/jack-russell-terrier/'],
    ['t26-available', '/available-puppies/'],
  ]) {
    for (const width of [1440, 390]) {
      const ctx = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 } });
      const page = await ctx.newPage();
      const errors = [];
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      page.on('pageerror', (e) => errors.push(e.message));
      const res = await page.goto(`http://localhost:4331${path}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      await page.screenshot({ path: `${shots}/${name}-${width}.png`, fullPage: true });
      steps.push({ step: `shot-${name}-${width}`, status: res?.status(), consoleErrors: errors.length, overflow });
      await ctx.close();
    }
  }
  await browser.close();
}

// 7. Leak scan on dist, using the temp store's denylist (seller fields, chips, URLs).
const leak = run('node scripts/imports/check-leaks.mjs --dist');
record('leak-scan-dist', { output: leak.trim() });

// 8. Takedown: one command removes the feed entry and the WebPs, adds the redirect.
run(`node scripts/imports/unpublish.mjs ${cleanId} --reason takedown --actor owner:k091 --repo .`);
feed = readJson('src/data/imported-puppies.json');
record('takedown', {
  feedPups: feed.pups.length,
  repoWebPs: readdirSync('src/assets/imported').filter((f) => f.startsWith(cleanId)),
  retired: readJson('src/data/imported-retired.json'),
});

// 9. Next build: the page is gone and the URL 301s to the breed page.
run('npm run build');
const gone = !existsSync(detailFile);
const redirects = readFileSync('dist/_redirects', 'utf8');
const anyImportedPage = readdirSync('dist/puppies', { withFileTypes: true }).filter((e) => e.isDirectory()).reduce((n, e) => n + readdirSync(join('dist/puppies', e.name)).filter((x) => x.startsWith('imp-')).length, 0);
record('build-2', {
  detailRemoved: gone,
  redirectHas301: redirects.includes(`/puppies/jack-russell-terrier/${cleanId}/ /puppies/jack-russell-terrier/ 301`),
  importedPagesRemaining: Number(anyImportedPage),
  sitemapHasImported: readFileSync('dist/sitemap-0.xml', 'utf8').includes('/imp-'),
});
if (!gone) throw new Error('takedown did not remove the rendered page');

writeFileSync('reports/k091-t26-fixture-e2e.json', JSON.stringify({ storeDir, steps }, null, 2) + '\n');
console.log('DONE', JSON.stringify({ cleanId, leadId, soldId }));

function cleanRef(id) {
  return 'CT-IE-' + id.replace(/^imp-/, '').slice(0, 6).toUpperCase();
}
