// One-off seed for src/data/placed-archive.json, read from git history.
//
// The daily sync used to regenerate available-puppies.json from scratch, so a
// puppy that sold simply vanished: its data, its photo and its /puppies/<breed>/<id>/
// page all went with it. Every one of those daily snapshots is still in git,
// though, so the date each puppy left the available list (and the clean photo it
// was listed with) can be recovered exactly rather than guessed.
//
// This script walks every committed version of available-puppies.json, oldest
// first, records the first snapshot in which each puppy is no longer listed, and
// restores its photo from the last commit that still carried it. It writes
// entries WITHOUT a status: whether a departure was a sale (placed) or a
// withdrawal is decided by `npm run sync:puppies`, against the live sheet's own
// sold evidence, never here.
//
// Usage: node scripts/backfill-placed-archive.mjs [--dry-run]
// Safe to re-run: puppies already in the archive are left as they are.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sgtDate } from './lib/placed-archive.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FEED_REL = 'src/data/available-puppies.json';
const ARCHIVE_FILE = path.join(ROOT, 'src', 'data', 'placed-archive.json');
const ASSET_DIR = path.join(ROOT, 'src', 'assets', 'live');
const dryRun = process.argv.includes('--dry-run');

const git = (args, encoding = 'utf8') =>
  execFileSync('git', args, { cwd: ROOT, encoding, maxBuffer: 256 * 1024 * 1024 });

const commits = git(['log', '--reverse', '--format=%H %cI', '--', FEED_REL])
  .trim()
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    const [sha, date] = line.split(' ');
    return { sha, date };
  });
if (commits.length === 0) throw new Error(`no git history for ${FEED_REL}`);

const seen = new Map(); // id -> { breed, pup, sha, date }
const left = new Map(); // id -> { leftAt }
let parsed = 0;

for (const { sha, date } of commits) {
  let feed;
  try {
    feed = JSON.parse(git(['show', `${sha}:${FEED_REL}`]));
  } catch (e) {
    console.warn(`skip ${sha.slice(0, 7)}: ${e.message.split('\n')[0]}`);
    continue;
  }
  parsed++;
  const listed = new Set();
  for (const [breed, bucket] of Object.entries(feed.breeds ?? {})) {
    for (const pup of bucket.available ?? []) {
      const id = String(pup.id);
      listed.add(id);
      seen.set(id, { breed, pup, sha, date });
      left.delete(id); // listed again, so it never really left
    }
  }
  for (const id of seen.keys()) {
    if (!listed.has(id) && !left.has(id)) left.set(id, { leftAt: sgtDate(date) });
  }
}

const archive = existsSync(ARCHIVE_FILE)
  ? JSON.parse(await readFile(ARCHIVE_FILE, 'utf8'))
  : { pups: [] };
const known = new Set(archive.pups.map((p) => String(p.id)));

let added = 0;
let restored = 0;
const missingPhoto = [];
for (const [id, { leftAt }] of left) {
  if (known.has(id)) continue;
  const { breed, pup, sha, date } = seen.get(id);
  let image = pup.image ?? null;
  if (image && !existsSync(path.join(ASSET_DIR, image))) {
    try {
      const buf = git(['show', `${sha}:src/assets/live/${image}`], 'buffer');
      if (!dryRun) await writeFile(path.join(ASSET_DIR, image), buf);
      restored++;
    } catch {
      missingPhoto.push(id);
      image = null;
    }
  }
  archive.pups.push({
    id: pup.id,
    breed,
    status: null,
    // First snapshot that no longer listed it, and the last one that did. The
    // snapshots are daily from late August but three weeks apart before that, so
    // the pair bounds the real date and the page only prints a month it can stand
    // behind (see placedMonth in src/lib/loving-homes.ts).
    placedAt: leftAt,
    lastListed: sgtDate(date),
    source: 'git-history',
    name: pup.name ?? null,
    color: pup.color ?? null,
    gender: pup.gender ?? null,
    age: pup.age ?? null,
    image,
    origin: pup.origin ?? null,
    sizeNote: pup.sizeNote ?? null,
    crossLabel: pup.crossLabel ?? null,
    hdbApproved: pup.hdbApproved ?? null,
  });
  added++;
}

archive.pups.sort((a, b) => b.placedAt.localeCompare(a.placedAt) || Number(b.id) - Number(a.id));

console.log(`commits read: ${parsed}/${commits.length} (${sgtDate(commits[0].date)} -> ${sgtDate(commits.at(-1).date)})`);
console.log(`puppies ever listed: ${seen.size}, no longer listed: ${left.size}, newly archived: ${added}`);
console.log(`photos restored from git: ${restored}${missingPhoto.length ? `, unrecoverable: ${missingPhoto.join(', ')}` : ''}`);
const byMonth = {};
for (const p of archive.pups) byMonth[p.placedAt.slice(0, 7)] = (byMonth[p.placedAt.slice(0, 7)] ?? 0) + 1;
console.log(`by month left: ${Object.entries(byMonth).map(([m, n]) => `${m}=${n}`).join(' ')}`);

if (dryRun) {
  console.log('dry run: nothing written');
} else {
  await writeFile(ARCHIVE_FILE, JSON.stringify(archive, null, 2) + '\n');
  console.log(`wrote ${path.relative(ROOT, ARCHIVE_FILE)} - now run \`npm run sync:puppies\` to verify each departure against the sheet`);
}
