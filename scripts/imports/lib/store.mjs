// Private store for the imports pipeline (spec §1, §6.1).
//
// Everything that can identify a supplier, seller or source listing lives in
// IMPORTS_PRIVATE_DIR, which must sit OUTSIDE the repo so it can never be
// committed or bundled. The path comes from the environment or, failing that,
// from the global ~/.claude/.env. Nothing in this module prints secret.key.
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, realpathSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { homedir } from 'node:os';
import { dirname, join, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

export class StoreError extends Error {}

// Read one KEY=value from a dotenv file without loading (or echoing) the rest.
export function readDotenvValue(file, key) {
  if (!existsSync(file)) return null;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (m && m[1] === key) return m[2].replace(/^(['"])(.*)\1$/, '$2').trim() || null;
  }
  return null;
}

export function resolvePrivateDir({ env = process.env, dotenvPath = env.IMPORTS_DOTENV || join(homedir(), '.claude', '.env') } = {}) {
  const raw = env.IMPORTS_PRIVATE_DIR || readDotenvValue(dotenvPath, 'IMPORTS_PRIVATE_DIR');
  if (!raw) {
    throw new StoreError(
      'IMPORTS_PRIVATE_DIR is not set (checked the environment and ~/.claude/.env). ' +
        'Set it to a folder OUTSIDE the repo, e.g. D:\\Claude Code\\_private\\curious-tails-imports',
    );
  }
  return resolve(raw);
}

// Resolve symlinks/junctions on the deepest existing ancestor so a link that
// points back into the repo is caught too.
function realish(p) {
  let cur = p;
  const tail = [];
  while (!existsSync(cur)) {
    const parent = dirname(cur);
    if (parent === cur) break;
    tail.unshift(cur.slice(parent.length).replace(/^[\\/]/, ''));
    cur = parent;
  }
  let base = cur;
  try { base = realpathSync.native(cur); } catch {}
  return join(base, ...tail);
}

export function isInside(child, parent) {
  const norm = (p) => (process.platform === 'win32' ? realish(p).toLowerCase() : realish(p));
  const rel = relative(norm(parent), norm(child));
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

export function assertOutsideRepo(dir, repoRoot = REPO_ROOT) {
  if (isInside(dir, repoRoot)) {
    throw new StoreError(
      `Refusing to use IMPORTS_PRIVATE_DIR inside the repo (${repoRoot}). ` +
        'The private store holds supplier, seller and microchip data and must live outside the repo.',
    );
  }
}

const SUBDIRS = ['raw', 'images-src', 'runs', 'fixtures'];

// Open (and on first use, create) the private store. Returns helpers bound to it.
export function openStore(opts = {}) {
  const dir = opts.dir ? resolve(opts.dir) : resolvePrivateDir(opts);
  assertOutsideRepo(dir, opts.repoRoot ?? REPO_ROOT);
  mkdirSync(dir, { recursive: true });
  for (const d of SUBDIRS) mkdirSync(join(dir, d), { recursive: true });

  const p = (...parts) => join(dir, ...parts);
  if (!existsSync(p('review-queue.json'))) writeFileSync(p('review-queue.json'), '[]\n');
  if (!existsSync(p('audit.jsonl'))) writeFileSync(p('audit.jsonl'), '');
  if (!existsSync(p('secret.key'))) {
    // 'wx' fails if another process created it first, so the key is made once.
    try { writeFileSync(p('secret.key'), randomBytes(32), { flag: 'wx', mode: 0o600 }); } catch (e) { if (e.code !== 'EEXIST') throw e; }
  }

  const readJson = (name, fallback) => {
    const f = p(name);
    return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : fallback;
  };
  const writeJson = (name, value) => {
    mkdirSync(dirname(p(name)), { recursive: true });
    writeFileSync(p(name), JSON.stringify(value, null, 2) + '\n');
  };

  return {
    dir,
    path: p,
    // Buffer only; callers must never log it.
    secret: () => readFileSync(p('secret.key')),
    readJson,
    writeJson,
    audit(event) {
      appendFileSync(p('audit.jsonl'), JSON.stringify({ at: new Date().toISOString(), actor: 'pipeline', ...event }) + '\n');
    },
    snapshot(supplier, listingId, fetchedAt, body, ext = 'html') {
      const safeId = String(listingId).replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120);
      const rel = join('raw', supplier, safeId, `${fetchedAt.replace(/[:.]/g, '-')}.${ext}`);
      mkdirSync(dirname(p(rel)), { recursive: true });
      writeFileSync(p(rel), body);
      return rel;
    },
  };
}
