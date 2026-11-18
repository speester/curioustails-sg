// Push the public imported-puppy feed to GitHub `main`, which is what deploys
// curioustails.sg (Cloudflare Pages builds every push to main).
//
// Owner decision 2026-11-18 (PLAN-puppy-sales-recovery D2): the daily run
// auto-publishes and ships. Only the two public paths below are ever committed:
// the leak-checked JSON and its WebPs. Logs, the private store and the review
// queue never leave the machine.
//
// It works in a dedicated worktree pinned to origin/main, so the owner's
// checkout (whatever branch, whatever uncommitted state) is never touched, and
// the daily GitHub listings commit can never conflict with it: every attempt
// starts from a fresh origin/main.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const FEED_PATH = 'src/data/imported-puppies.json';
export const ASSET_PATH = 'src/assets/imported';

function git(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (r.status !== 0) {
    const last = (r.stderr || r.stdout || '').trim().split('\n').pop();
    throw new Error(`git ${args[0]} failed: ${last}`);
  }
  return (r.stdout || '').trim();
}

/** Make dst hold exactly src's files (flat directory of WebPs). */
export function mirrorFiles(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  const want = new Set(
    fs.existsSync(src) ? fs.readdirSync(src).filter((f) => fs.statSync(path.join(src, f)).isFile()) : [],
  );
  for (const f of fs.readdirSync(dst)) {
    if (!want.has(f)) fs.rmSync(path.join(dst, f), { recursive: true, force: true });
  }
  for (const f of want) fs.copyFileSync(path.join(src, f), path.join(dst, f));
}

export function publishFeed({
  repoRoot,
  worktree = path.join(repoRoot, '..', '_ct-imports-publish'),
  remote = 'origin',
  branch = 'main',
  attempts = 3,
} = {}) {
  if (!fs.existsSync(path.join(repoRoot, FEED_PATH))) {
    return { pushed: false, reason: 'no-feed' };
  }
  if (!fs.existsSync(path.join(worktree, '.git'))) {
    git(repoRoot, ['fetch', '-q', remote, branch]);
    git(repoRoot, ['worktree', 'add', '-q', '--detach', worktree, `${remote}/${branch}`]);
  }
  for (let attempt = 1; attempt <= attempts; attempt++) {
    git(worktree, ['fetch', '-q', remote, branch]);
    git(worktree, ['reset', '-q', '--hard', `${remote}/${branch}`]);
    git(worktree, ['clean', '-fdq', '--', ASSET_PATH]);
    fs.mkdirSync(path.dirname(path.join(worktree, FEED_PATH)), { recursive: true });
    fs.copyFileSync(path.join(repoRoot, FEED_PATH), path.join(worktree, FEED_PATH));
    mirrorFiles(path.join(repoRoot, ASSET_PATH), path.join(worktree, ASSET_PATH));
    git(worktree, ['add', '-A', '--', FEED_PATH, ASSET_PATH]);
    const changed = spawnSync('git', ['diff', '--cached', '--quiet'], { cwd: worktree }).status !== 0;
    if (!changed) return { pushed: false, reason: 'unchanged' };
    git(worktree, ['commit', '-q', '-m', 'chore(imports): sync imported puppy feed']);
    const push = spawnSync('git', ['push', '-q', remote, `HEAD:${branch}`], { cwd: worktree, encoding: 'utf8' });
    if (push.status === 0) {
      return { pushed: true, commit: git(worktree, ['rev-parse', '--short', 'HEAD']), attempt };
    }
    if (attempt === attempts) {
      throw new Error(`push to ${branch} failed: ${(push.stderr || '').trim().split('\n').pop()}`);
    }
  }
  return { pushed: false, reason: 'exhausted' };
}
