#!/usr/bin/env node
// gen-build-id.mjs — write a build identifier for the <meta name="build-commit"> tag.
//
// This project has no git remote (the build order forbids introducing one), so there is no
// commit sha to stamp. The identifier is therefore a hash of the SOURCE that produced the
// build: every file under src/ plus the generated data the pages read. Two builds of identical
// source produce the same id, and any content change produces a new one, which is the property
// the audit actually needs — it is checking that the deployed HTML can be traced to a known
// input, not that a VCS was used.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

// THE OUTPUT IS NOT AN INPUT. walk('src') used to hash src/data/build-id.json, which this
// script had just written, so three runs on one unchanged tree produced three different
// ids (298631f4, 8ccf609d, 57b73071) and `regate1.mjs`'s meta-vs-build-id comparison
// could never be stable.
const OUT = path.join('src', 'data', 'build-id.json');
const check = process.argv.includes('--check');

const files = [];
function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else if (path.relative(OUT, p) !== '') files.push(p);
  }
}
walk('src');
for (const extra of ['research/site-blueprint.csv', 'config/forms.json']) {
  try { statSync(extra); files.push(extra); } catch {}
}

files.sort();
const h = createHash('sha256');
for (const f of files) {
  h.update(f.replace(/\\/g, '/'));
  h.update(readFileSync(f));
}
const id = h.digest('hex').slice(0, 12);

// --check is an AUDIT: it compares and exits, it never writes. It used to be parsed
// into `check` and then ignored, so `gen-build-id.mjs --check` mutated the tree - and
// src/data/build-id.json is inside checkpoint.py's provenance walk, so an audit-only
// command silently invalidated every recorded exit-gate letter.
if (check) {
  let current = null;
  try { current = JSON.parse(readFileSync(OUT, 'utf8')).id; } catch {}
  const same = current === id;
  console.log(`build id ${id} (${files.length} source files); on disk ${current ?? '<none>'}`);
  if (!same) console.error('HALT build id is stale: run `node scripts/gen-build-id.mjs` and rebuild');
  process.exit(same ? 0 : 1);
}

// `generated` is deliberately NOT written: a date stamp made the file - and therefore
// the provenance hash that reads it - change on a date rollover with no source change.
writeFileSync(OUT, JSON.stringify({ id }, null, 2) + '\n');
console.log(`build id ${id} (${files.length} source files)`);
// contracts section-1b, generator form: a generator that wrote NOTHING has
// silently done nothing, and the build then fails somewhere else entirely.
console.log(`gen-build-id: wrote=1 sources=${files.length}`);
