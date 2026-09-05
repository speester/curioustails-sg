#!/usr/bin/env node
// kit:page-check@1.1.0 — the npm-facing wrapper over THE page instrument.
// Usage: node scripts/page-check.mjs [--all | <slug> ...] [-- <extra verify_page.py args>]
//
// This file is a WRAPPER ONLY. The brief->page contract is measured by
// scripts/verify_page.py (the one page instrument, contracts.md); this exists so
// `npm run check:page` has a target and so the Node-side gates and the Python-side
// gate are invoked the same way. It NEVER writes the ledger `copy_gate` cell —
// that is `python scripts/verify_page.py <slug> --write-ledger`.
//
// It was previously a byte-copy of lib/csv.mjs: a module that exported a parser,
// ran nothing and exited 0, so `npm run check:page` reported success on every
// build without measuring a single page. A wrapper that cannot fail is not a gate.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const SCRIPT = 'scripts/verify_page.py';
if (!fs.existsSync(SCRIPT)) {
  console.error(`FAIL ${SCRIPT} missing — the kit was copied incompletely.`);
  process.exit(1);
}

const argv = process.argv.slice(2);
const args = argv.length ? argv : ['--all'];
const py = process.env.PYTHON || 'python';
const r = spawnSync(py, [SCRIPT, ...args], { stdio: 'inherit' });

if (r.error) {
  console.error(`FAIL could not run ${py} ${SCRIPT}: ${r.error.message}`);
  process.exit(1);
}
process.exit(r.status ?? 1);
