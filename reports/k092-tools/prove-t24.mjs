// K-092 / T24: build a fixture imported page, capture the REAL dataLayer from
// the built site, and assert every GA4 payload. No deploy, no production write.
//
// The fixture is written through the real pipeline (temp private store outside
// the repo), so the feed and the WebPs have exactly the shape the site ships.
// The real feed and src/assets/imported are backed up and restored afterwards,
// and a final build removes the fixture page from dist.
import { execSync } from 'node:child_process';
import {
  copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync,
} from 'node:fs';
import { mkdtempSync } from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { verify } from '../../scripts/verify-ga4-imports.mjs';
import { openStore } from '../../scripts/imports/lib/store.mjs';
import { publicIds } from '../../scripts/imports/lib/hash.mjs';
import { cleanRecord, seed } from '../../scripts/imports/tests/_pipeline-fixtures.mjs';

const REPO = process.cwd();
const FEED = join(REPO, 'src', 'data', 'imported-puppies.json');
const ASSETS = join(REPO, 'src', 'assets', 'imported');
const STORE_DIR = mkdtempSync(join(tmpdir(), 'k092-t24-store-'));
const BACKUP_DIR = mkdtempSync(join(tmpdir(), 'k092-t24-repo-'));
const steps = [];
const record = (step, value) => { steps.push({ step, ...value }); console.log(step, JSON.stringify(value)); };
const run = (cmd, env = {}) => execSync(cmd, {
  cwd: REPO,
  env: { ...process.env, IMPORTS_PRIVATE_DIR: STORE_DIR, ...env },
  stdio: 'pipe',
  encoding: 'utf8',
  maxBuffer: 50 * 1024 * 1024,
});

let feedBackup = null;
let assetsBackup = join(BACKUP_DIR, 'assets');
let server = null;
let importedPath = null;

try {
  // 1. Back up the real feed and assets.
  feedBackup = existsSync(FEED) ? readFileSync(FEED) : null;
  if (existsSync(ASSETS)) cpSync(ASSETS, assetsBackup, { recursive: true });
  else mkdirSync(assetsBackup, { recursive: true });

  // 2. A clean dogsy JRT through the real pipeline, temp private store only.
  const store = openStore({ dir: STORE_DIR });
  const clean = cleanRecord(store, { listingId: 'k092-t24-jrt' });
  const cleanId = publicIds(store.secret(), clean.supplier, clean.listingId).id;
  const photos = readdirSync(join(REPO, 'src', 'assets', 'jack-russell-terrier'))
    .filter((f) => f.endsWith('.webp'))
    .sort()
    .slice(0, 3);
  if (photos.length < 3) throw new Error('need three real JRT WebPs for the fixture');
  const stage = store.path('images-processed');
  mkdirSync(stage, { recursive: true });
  seed(store, [clean]);
  clean.images.forEach((img, i) => {
    copyFileSync(join(REPO, 'src', 'assets', 'jack-russell-terrier', photos[i]), join(stage, img.filename));
    copyFileSync(join(REPO, 'src', 'assets', 'jack-russell-terrier', photos[i]), join(stage, img.cardFilename));
  });

  run('node scripts/imports/sync-imports.mjs --no-fetch');
  run(`node scripts/imports/approve.mjs approve ${cleanId} --actor owner:k092 --repo .`);
  run('node scripts/imports/sync-imports.mjs --no-fetch');
  const feed = JSON.parse(readFileSync(FEED, 'utf8'));
  const pup = (feed.pups || []).find((p) => p.id === cleanId);
  if (!pup) throw new Error(`fixture did not publish: ${cleanId}`);
  record('fixture-published', { id: cleanId, breed: pup.breed, photos: pup.photos.length });

  // 3. Build, then serve dist with a tiny static server (no preview daemon).
  run('npm run build');
  const imported = `/puppies/${pup.breed}/${pup.id}/`;
  importedPath = imported;
  const dist = join(REPO, 'dist');
  if (!existsSync(join(dist, imported, 'index.html'))) throw new Error(`fixture page not built: ${imported}`);

  const data = JSON.parse(readFileSync(join(REPO, 'src', 'data', 'available-puppies.json'), 'utf8'));
  let local = null;
  for (const [slug, bucket] of Object.entries(data.breeds || {})) {
    if (!(bucket.available || []).length) continue;
    const file = join(dist, 'puppies', slug, 'index.html');
    if (!existsSync(file)) continue;
    if (readFileSync(file, 'utf8').includes('data-wa-source="pup:')) {
      local = `/puppies/${slug}/`;
      break;
    }
  }
  if (!local) throw new Error('no local breed page with a pup: WhatsApp card found');
  record('local-page', { path: local });

  ({ server } = await new Promise((resolve) => {
    const s = http.createServer((req, res) => {
      try {
        const url = new URL(req.url, 'http://127.0.0.1');
        let p = decodeURIComponent(url.pathname);
        if (p.endsWith('/')) p += 'index.html';
        let file = join(dist, p);
        if (!existsSync(file)) {
          if (existsSync(file + '.html')) file += '.html';
          else if (existsSync(join(file, 'index.html'))) file = join(file, 'index.html');
          else { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found'); return; }
        }
        const types = {
          '.html': 'text/html; charset=utf-8',
          '.js': 'text/javascript; charset=utf-8',
          '.css': 'text/css; charset=utf-8',
          '.json': 'application/json',
          '.webp': 'image/webp',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.svg': 'image/svg+xml',
          '.woff2': 'font/woff2',
          '.xml': 'application/xml',
          '.txt': 'text/plain; charset=utf-8',
        };
        res.writeHead(200, { 'content-type': types[extname(file).toLowerCase()] || 'application/octet-stream' });
        res.end(readFileSync(file));
      } catch {
        res.writeHead(500, { 'content-type': 'text/plain' });
        res.end('error');
      }
    });
    s.listen(0, '127.0.0.1', () => resolve({ server: s, port: s.address().port }));
  }));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  record('server', { baseUrl });

  // 4. Capture and assert every event payload.
  const report = await verify({
    baseUrl,
    imported,
    local,
    out: 'reports/k092-ga4-events.json',
  });
  record('ga4', {
    pass: report.pass,
    assertions: report.assertions.filter((a) => !a.pass),
    counts: {
      importedView: report.captured.imported.view?.length || 0,
      importedWhatsapp: report.captured.imported.whatsapp?.length || 0,
      importedPhone: report.captured.imported.phone?.length || 0,
      chips: report.captured.available.chips?.length || 0,
      details: report.captured.available.details?.length || 0,
      localWhatsapp: report.captured.local.whatsapp?.length || 0,
    },
  });
  if (!report.pass) throw new Error('GA4 assertions failed');
} catch (e) {
  record('error', { message: e?.message || String(e) });
  process.exitCode = 1;
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  // Restore the real feed and assets, then rebuild so dist has no fixture page.
  try {
    if (feedBackup) writeFileSync(FEED, feedBackup);
    else if (existsSync(FEED)) rmSync(FEED);
    rmSync(ASSETS, { recursive: true, force: true });
    cpSync(assetsBackup, ASSETS, { recursive: true });
    run('npm run build');
    record('restored', {
      feedPups: JSON.parse(readFileSync(FEED, 'utf8')).pups.length,
      assets: readdirSync(ASSETS).length,
      fixturePageGone: importedPath ? !existsSync(join(REPO, 'dist', importedPath, 'index.html')) : true,
    });
  } catch (e) {
    record('restore-error', { message: e?.message || String(e) });
    process.exitCode = 1;
  }
  mkdirSync('reports', { recursive: true });
  writeFileSync('reports/k092-t24-proof.json', JSON.stringify({ generatedAt: new Date().toISOString(), steps }, null, 2) + '\n');
  rmSync(STORE_DIR, { recursive: true, force: true });
  rmSync(BACKUP_DIR, { recursive: true, force: true });
  console.log('DONE', JSON.stringify({ steps: steps.length, exit: process.exitCode || 0 }));
}
