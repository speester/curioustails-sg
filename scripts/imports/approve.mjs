#!/usr/bin/env node
// CLI for the review queue (T16). The UI is the primary path; this is the
// equivalent for a terminal action or a cron-free supervised run.
//
//   npm run approve:import -- approve <imp-id> [--actor owner:me] [--repo dir]
//   npm run approve:import -- reject  <imp-id> [--reason text]
//   npm run approve:import -- reserve <imp-id>
//
// approve only records the owner's ruling; the next sync publishes. Nothing
// prints or logs a seller field, URL, phone or microchip.
import { openStore, REPO_ROOT } from './lib/store.mjs';
import { pathToFileURL } from 'node:url';
import {
  approveItem, rejectItem, reserveItem, writeOwnerLog, OwnerActionError,
} from './lib/owner.mjs';

const USAGE = 'usage: approve.mjs <approve|reject|reserve> <imp-id> [--repo dir] [--actor name] [--reason text]';

export function parseArgs(argv) {
  const args = { cmd: null, id: null, repo: REPO_ROOT, actor: 'owner:cli', reason: null };
  const rest = [...argv];
  args.cmd = rest.shift() || null;
  for (let i = 0; i < rest.length; i++) {
    const k = rest[i];
    if (k === '--repo') args.repo = rest[++i];
    else if (k === '--actor') args.actor = rest[++i];
    else if (k === '--reason') args.reason = rest[++i];
    else if (k === '--help' || k === '-h') args.help = true;
    else if (!k.startsWith('--') && !args.id) args.id = k;
    else throw new Error(`unknown argument: ${k}`);
  }
  return args;
}

export function main(argv = process.argv.slice(2)) {
  let a;
  try { a = parseArgs(argv); } catch (e) { console.error(`approve: ${e.message}`); return 2; }
  if (a.help || !['approve', 'reject', 'reserve'].includes(a.cmd) || !a.id) {
    console.error(USAGE);
    return 2;
  }
  if (!a.repo) { console.error('approve: --repo needs a directory'); return 2; }
  try {
    const store = openStore();
    if (a.cmd === 'approve') approveItem({ store, id: a.id, actor: a.actor });
    else if (a.cmd === 'reject') rejectItem({ store, repoRoot: a.repo, id: a.id, actor: a.actor });
    else reserveItem({ store, repoRoot: a.repo, id: a.id, actor: a.actor });
    writeOwnerLog(a.repo, `owner ${a.cmd} id=${a.id}${a.reason ? ` reason=${a.reason}` : ''}`);
    console.log(`owner ${a.cmd} ${a.id}`);
    return 0;
  } catch (e) {
    const msg = e instanceof OwnerActionError ? e.message : (e?.message || String(e));
    console.error(`approve: ${msg}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
