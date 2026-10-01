// One-off-ish sync of the starter-kit item catalogue from the owner's
// SpreadSimple store (starterkit.spread.name) into src/assets/starter-kit/*.webp
// + src/data/starter-kit-items.json. Re-runnable.
import { createHash } from 'node:crypto';
import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'src', 'assets', 'starter-kit');
const DATA = path.join(ROOT, 'src', 'data', 'starter-kit-items.json');
const SHEET = 'tPZFIMR11prKdy0UmNdh6c3nNZ2PUReLqgAjKwCQa4aiPjpM2KBHMi-_qXjg9Tjkgwbg';
const OPTIONS = 'eyJyb3dzTGltaXQiOjUwMDAsImRlYWxUeXBlIjoiYXBwc3VtbyIsImR5bmFtaWNEYXRhIjp7InNoZWV0SGFzaCI6IjI1NzUyMTQ2OSIsIlNDUFRhYmxlTGF0ZXN0VXBkYXRlVGltZXN0YW1wIjoxNzY0MjgzNTYxMzU4fSwic2VhcmNoIjp7ImVuYWJsZWQiOnRydWUsImNvbHVtbnMiOlsiQ2F0ZWdvcnktIiwiVGl0bGUtIiwiUHJpY2UtIiwiRGVzY3JpcHRpb24tIiwiSW1hZ2UtIl19LCJzb3J0aW5nIjp7ImVuYWJsZWQiOnRydWUsInNodWZmbGUiOmZhbHNlfSwidmFyaWFudHMiOnsiZW5hYmxlZCI6dHJ1ZSwiZ3JvdXBDYXJkcyI6dHJ1ZSwiaWQiOiJUaXRsZS0iLCJvcHRpb25zIjp7ImlkcyI6WyJTaXplLSJdLCJzaG93VmFyaWFudHNPcHRpb25zSW5DYXJkcyI6ZmFsc2V9fSwicGFnaW5hdGlvbiI6eyJlbmFibGVkIjpmYWxzZSwiaXRlbXNQZXJQYWdlIjoiMTUifSwiZmlsdGVycyI6eyJlbmFibGVkIjp0cnVlLCJ2YWx1ZXMiOlt7ImlkIjoiQ2F0ZWdvcnktIiwidHlwZSI6Im11bHRpcGxlIn1dfSwibWFwVmlldyI6eyJlbmFibGVkIjpmYWxzZSwiaWQiOm51bGwsIm1hcmtlclR5cGUiOiJwaW4iLCJpbWFnZUNvbElkIjoiIn0sImNhbGVuZGFyVmlldyI6eyJlbmFibGVkIjpmYWxzZSwic3RhcnREYXRlQ29sSWQiOm51bGwsInRpdGxlQ29sSWQiOiJUaXRsZS0ifX0=';
const cell = (row, k) => { const c = row.cells?.[k]; return c && c.value != null ? String(c.value).trim() : ''; };
const num = (row, k) => { const c = row.cells?.[k]; return c && typeof c.value === 'number' ? c.value : (parseFloat(cell(row,k).replace(/[^0-9.]/g,''))||null); };

const q = Buffer.from(JSON.stringify({ paginate:{currentPage:1}, sortBy:{id:'INDEX',direction:'asc'} })).toString('base64');
const url = `https://spread.name/sheet/${SHEET}?query=${encodeURIComponent(q)}&options=${encodeURIComponent(OPTIONS)}`;
const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (curious-tails sync)' } });
if (!res.ok) throw new Error('feed HTTP ' + res.status);
const json = await res.json();
const rows = json.table?.rows ?? [];
console.log('rows', rows.length);

await mkdir(OUT, { recursive: true });
const hash = (u) => createHash('sha1').update(u).digest('hex').slice(0,8);
const items = [];
const referenced = new Set();
for (const r of rows) {
  const title = cell(r,'Title-'); const img = cell(r,'Image-');
  if (!title || !/^https?:\/\//.test(img)) continue;
  const file = `${title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40)}-${hash(img)}.webp`;
  const dest = path.join(OUT, file);
  if (!existsSync(dest)) {
    try {
      const buf = Buffer.from(await (await fetch(img,{headers:{'User-Agent':'Mozilla/5.0'}})).arrayBuffer());
      await sharp(buf,{pages:1}).rotate().resize({width:500,height:500,fit:'inside',withoutEnlargement:true}).webp({quality:78}).toFile(dest);
    } catch(e){ console.log('img err',title,e.message); continue; }
  }
  referenced.add(file);
  items.push({ title, price: num(r,'Price-'), category: cell(r,'Category-')||null, image: file });
}
// prune ONLY files this script generates (slug-<8hex>.webp). Other webp in this
// folder (the hand-made hero images used by starter-kit.astro) are left alone.
const GENERATED = /-[0-9a-f]{8}\.webp$/;
for (const f of await readdir(OUT)) if (GENERATED.test(f) && !referenced.has(f)) await unlink(path.join(OUT,f));
await writeFile(DATA, JSON.stringify({ syncedAt:new Date().toISOString(), items }, null, 2)+'\n');
console.log('wrote', items.length, 'items ->', path.relative(ROOT,DATA));
