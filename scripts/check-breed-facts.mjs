#!/usr/bin/env node
// K-130 D4: npm run check:breed-facts. Every breed fact the puppy pages show must
// be a sentence the breed's own published page states (owner decision D4).
//  - each entry names its source page;
//  - each string is on that page's source (src/pages/puppies/<slug>.astro), either
//    verbatim or read from BREED_FACTS there (the breed page renders the same value);
//  - each guide anchor exists as an id on the BUILT breed page (dist/).
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const DIST = path.join(ROOT, process.argv.includes('--dist') ? process.argv[process.argv.indexOf('--dist') + 1] : 'dist');
const { BREED_FACTS } = await import(pathToFileURL(path.join(ROOT, 'src', 'data', 'breed-facts.ts')).href);
const fails = [];
let checked = 0;
for (const [slug, f] of Object.entries(BREED_FACTS)) {
  if (!f.source) { fails.push(`${slug}: no source page`); continue; }
  const srcFile = path.join(ROOT, 'src', 'pages', 'puppies', `${slug}.astro`);
  if (!existsSync(srcFile)) { fails.push(`${slug}: source ${srcFile} missing`); continue; }
  const src = readFileSync(srcFile, 'utf8').replace(/\'/g, "'");
  const built = path.join(DIST, 'puppies', slug, 'index.html');
  const html = existsSync(built) ? readFileSync(built, 'utf8').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&') : null;
  if (!html) fails.push(`${slug}: ${path.relative(ROOT, built)} not built`);
  const strings = [
    ...['parentage', 'temperament', 'size', 'coat', 'exercise', 'lifespan'].filter((k) => f[k]).map((k) => [k, f[k]]),
    ...(f.match ?? []).flatMap((r, i) => [[`match[${i}].situation`, r.situation], [`match[${i}].take`, r.take]]),
  ];
  for (const [k, v] of strings) {
    checked++;
    // On the built breed page (it renders the value, from this file or verbatim).
    if (html && !html.includes(v)) fails.push(`${slug}.${k}: not on the built breed page: "${v.slice(0, 70)}"`);
    // And wired or typed in the page source.
    const wired = /^(coat|exercise|lifespan)$/.test(k) ? src.includes(`BF.${k}`) : k.startsWith('match') ? src.includes(`matchRows('${slug}')`) : false;
    if (!wired && !src.includes(v)) fails.push(`${slug}.${k}: not in ${path.relative(ROOT, srcFile)}`);
  }
  for (const [k, id] of Object.entries(f.guideAnchors ?? {})) {
    checked++;
    if (html && !new RegExp(`id="${id}"`).test(html)) fails.push(`${slug}.guideAnchors.${k}: #${id} not on the built breed page`);
  }
}
console.log(`check:breed-facts: ${Object.keys(BREED_FACTS).length} breeds, ${checked} facts and anchors checked`);
if (fails.length) {
  console.error(`FAIL: ${fails.length}`);
  for (const f of fails) console.error(`  ${f}`);
  process.exit(1);
}
console.log('PASS: every breed fact is on its published breed page');
