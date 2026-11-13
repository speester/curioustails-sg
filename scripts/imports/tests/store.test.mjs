import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore, StoreError, REPO_ROOT } from '../lib/store.mjs';

const CLI = join(REPO_ROOT, 'scripts', 'imports', 'sync-imports.mjs');
const HEX64 = /\b[0-9a-f]{64}\b/i;

function runCli(privateDir) {
  // --no-fetch keeps the T1 guard test offline. The full dry run is a manual
  // step (K-086 T14), never something a unit test triggers against live hosts.
  return spawnSync(process.execPath, [CLI, '--dry-run', '--no-fetch'], {
    cwd: REPO_ROOT,
    env: { ...process.env, IMPORTS_PRIVATE_DIR: privateDir },
    encoding: 'utf8',
  });
}

test('a path inside the repo is refused', () => {
  assert.throws(() => openStore({ dir: join(REPO_ROOT, 'scripts', 'imports', '_private') }), StoreError);
  assert.throws(() => openStore({ dir: REPO_ROOT }), StoreError);
});

test('IMPORTS_PRIVATE_DIR inside the repo: the CLI exits non-zero with a clear message', () => {
  const inside = join(REPO_ROOT, 'scripts', 'imports', '_guard-inside-repo');
  rmSync(inside, { recursive: true, force: true });
  try {
    const r = runCli(inside);
    assert.equal(r.status, 1, `expected exit 1, got ${r.status}: ${r.stdout}${r.stderr}`);
    assert.match(r.stderr, /Refusing to use IMPORTS_PRIVATE_DIR inside the repo/);
    assert.match(r.stderr, /must live outside the repo/);
    assert.doesNotMatch(`${r.stdout}${r.stderr}`, HEX64);
    assert.equal(existsSync(inside), false, 'the guard refused before creating anything');
  } finally {
    rmSync(inside, { recursive: true, force: true });
  }
});

test('a valid external path: the CLI creates the layout and prints no key material', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ct-imports-cli-'));
  try {
    const r = runCli(dir);
    assert.equal(r.status, 0, `expected exit 0, got ${r.status}: ${r.stdout}${r.stderr}`);
    for (const d of ['raw', 'images-src', 'runs', 'fixtures', 'review-queue.json', 'audit.jsonl', 'secret.key']) {
      assert.ok(existsSync(join(dir, d)), d);
    }
    const key = readFileSync(join(dir, 'secret.key'));
    assert.equal(key.length, 32);
    const out = `${r.stdout}${r.stderr}`;
    assert.ok(!out.includes(key.toString('hex')), 'the key hex was printed');
    assert.ok(!out.includes(key.toString('base64')), 'the key base64 was printed');
    assert.doesNotMatch(out, HEX64);
    assert.doesNotMatch(out, /[A-Za-z0-9+/]{43}=/); // a base64-encoded 32-byte secret
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('npm run sync:imports is wired to the guarded entry point', () => {
  const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['sync:imports'], 'node scripts/imports/sync-imports.mjs');
});

test('an external path gets the private layout and a 32-byte secret made once', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ct-imports-'));
  try {
    const s = openStore({ dir });
    for (const d of ['raw', 'images-src', 'runs', 'fixtures', 'review-queue.json', 'audit.jsonl', 'secret.key']) {
      assert.ok(existsSync(join(dir, d)), d);
    }
    const first = readFileSync(join(dir, 'secret.key'));
    assert.equal(first.length, 32);
    openStore({ dir });
    assert.deepEqual(readFileSync(join(dir, 'secret.key')), first, 'secret.key is not regenerated');
    assert.deepEqual(s.secret(), first);
    assert.ok(statSync(join(dir, 'secret.key')).size === 32);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('IMPORTS_PRIVATE_DIR unset everywhere is a clear error', () => {
  assert.throws(() => openStore({ env: {}, dotenvPath: join(tmpdir(), 'no-such.env') }), /IMPORTS_PRIVATE_DIR is not set/);
});
