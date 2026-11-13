#!/usr/bin/env node
// Take a live imported puppy down (T16).
//
//   npm run unpublish:import -- <imp-id> --reason takedown [--actor owner:me] [--repo dir]
//
// Removes the feed entry and the repo WebPs, adds the {id, breed} redirect
// record, suppresses any relist, and writes an audit line with the actor and
// timestamp. `takedown` always purges the private processed copies; any other
// reason purges them only with --purge-images.
import { pathToFileURL } from 'node:url';
import { openStore, REPO_ROOT } from './lib/store.mjs';
import { unpublishItem, writeOwnerLog, OwnerActionError } from './lib/owner.mjs';

const USAGE = 'usage: unpublish.mjs <imp-id> [--reason takedown|owner|sold] [--purge-images] [--repo dir] [--actor name]';

export function parseArgs(argv) {
  const args = { id: null, repo: REPO_ROOT, actor: 'owner:cli', reason: 'owner', purgeImages: false };
  const rest = [...argv];
  for (let i = 0; i < rest.length; i++) {
    const k = rest[i];
    if (k === '--reason') args.reason = rest[++i];
    else if (k === '--repo') args.repo = rest[++i];
    else if (k === '--actor') args.actor = rest[++i];
    else if (k === '--purge-images') args.purgeImages = true;
    else if (k === '--help' || k === '-h') args.help = true;
    else if (!k.startsWith('--') && !args.id) args.id = k;
    else throw new Error(`unknown argument: ${k}`);
  }
  return args;
}

export function main(argv = process.argv.slice(2)) {
  let a;
  try { a = parseArgs(argv); } catch (e) { console.error(`unpublish: ${e.message}`); return 2; }
  if (a.help || !a.id || !a.repo) {
    console.error(USAGE);
    return a.help ? 0 : 2;
  }
  try {
    const store = openStore();
    const out = unpublishItem({
      store,
      repoRoot: a.repo,
      id: a.id,
      reason: a.reason,
      purgeImages: a.purgeImages,
      actor: a.actor,
    });
    writeOwnerLog(a.repo, `owner unpublish id=${a.id} reason=${a.reason}`);
    console.log(`owner unpublish ${a.id} reason=${a.reason}${out.purged ? ` purged=${out.purged}` : ''}`);
    return 0;
  } catch (e) {
    const msg = e instanceof OwnerActionError ? e.message : (e?.message || String(e));
    console.error(`unpublish: ${msg}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
