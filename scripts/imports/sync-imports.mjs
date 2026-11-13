#!/usr/bin/env node
// Imports pipeline entry point (T1; spec §1, §6.1).
//
// At T1 this script owns configuration and the private-store guard only, so
// `npm run sync:imports -- --dry-run` can prove that a store inside the repo
// is refused before anything is fetched or written. The fetch → parse →
// normalise → dedupe → gates → images → liveness → write pipeline is T14 and
// is deliberately not wired here.
//
// It must never print secret.key, seller fields or source records.
import { pathToFileURL } from 'node:url';
import { openStore, StoreError } from './lib/store.mjs';

const KNOWN_ARGS = new Set(['--dry-run', '--no-fetch']);

export function main(argv = process.argv.slice(2)) {
  const unknown = argv.filter((a) => !KNOWN_ARGS.has(a));
  if (unknown.length) {
    console.error(`imports: unknown argument(s): ${unknown.join(' ')} (known: --dry-run, --no-fetch)`);
    return 2;
  }

  try {
    openStore();
  } catch (e) {
    // StoreError messages are written for the operator; anything else is unexpected.
    console.error(`imports: ${e instanceof StoreError ? e.message : `unexpected error: ${e?.message || e}`}`);
    return 1;
  }

  const mode = argv.includes('--dry-run') ? 'dry run' : 'run';
  console.log(`imports: ${mode} — private store ready (raw/, images-src/, runs/, fixtures/).`);
  console.log('imports: no sources are wired yet (T14); nothing was fetched or written.');
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
