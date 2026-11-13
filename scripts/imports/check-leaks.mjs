#!/usr/bin/env node
// npm run check:import-leaks [-- --dist [dir]] [--repo dir] [--feed file] [--assets dir]
//
// The hard build gate for imported listings (spec §6.7; T15). Scans the public
// feed, the imported asset names and WebP metadata, and with --dist every text
// file and path under dist/. Exit 0 clean, 1 on any leak (or when the private
// store is missing: the denylist cannot be built, so the scan fails closed),
// 2 on bad arguments. Findings name the kind and the file, never the value.
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { openStore, resolvePrivateDir, assertOutsideRepo, REPO_ROOT, StoreError } from './lib/store.mjs';
import { runLeakCheck } from './lib/leaks.mjs';

export function parseLeakArgs(argv) {
  const a = { repo: REPO_ROOT, dist: null, feed: null, assets: null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const next = () => { const v = argv[i + 1]; if (!v || v.startsWith('--')) return null; i++; return v; };
    if (k === '--dist') a.dist = next() || 'dist';
    else if (k === '--repo') { a.repo = next(); if (!a.repo) throw new Error('--repo needs a directory'); }
    else if (k === '--feed') { a.feed = next(); if (!a.feed) throw new Error('--feed needs a file'); }
    else if (k === '--assets') { a.assets = next(); if (!a.assets) throw new Error('--assets needs a directory'); }
    else throw new Error(`unknown argument: ${k}`);
  }
  a.repo = resolve(a.repo);
  if (a.dist) a.dist = resolve(a.repo, a.dist);
  if (a.feed) a.feed = resolve(a.feed);
  if (a.assets) a.assets = resolve(a.assets);
  return a;
}

export function main(argv = process.argv.slice(2)) {
  let a;
  try { a = parseLeakArgs(argv); } catch (e) {
    console.error(`check:import-leaks: ${e.message}`);
    return 2;
  }
  let store;
  try {
    const dir = resolvePrivateDir();
    assertOutsideRepo(dir);
    if (!existsSync(join(dir, 'secret.key'))) throw new StoreError('the private store does not exist yet; the denylist cannot be built');
    store = openStore({ dir });
  } catch (e) {
    console.error(`check:import-leaks: FAIL (closed) - ${e instanceof StoreError ? e.message : e?.message || e}`);
    return 1;
  }
  const { leaks, scanned, counts } = runLeakCheck({ repoRoot: a.repo, feedPath: a.feed, assetDir: a.assets, distDir: a.dist, store });
  const what = `feed=${scanned.feed} assets=${scanned.assets} dist=${a.dist ? scanned.dist : 'skipped'} denylist values=${counts.values} shingles=${counts.shingles}`;
  if (!leaks.length) {
    console.log(`check:import-leaks: OK (${what})`);
    return 0;
  }
  console.error(`check:import-leaks: FAIL - ${leaks.length} leak(s) (${what})`);
  for (const l of leaks.slice(0, 50)) console.error(`  LEAK ${l.kind}: ${l.where}`);
  if (leaks.length > 50) console.error(`  ... and ${leaks.length - 50} more`);
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
