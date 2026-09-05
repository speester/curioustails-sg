#!/usr/bin/env node
/**
 * formaloo-delete-test-rows.mjs — delete every row whose values contain the marker, then
 * re-read and assert ZERO remain.
 *
 *   node scripts/formaloo-delete-test-rows.mjs "LIVE TEST DELETE ME" [--form contact]
 */
import { readRows, deleteRows, loadJson } from './formaloo-api.mjs';
const argv = process.argv.slice(2);
const marker = argv.find(a => !a.startsWith('--')) || 'FORMALOO SMOKE TEST — DELETE ME';
const only = argv.includes('--form') ? argv[argv.indexOf('--form') + 1] : null;
const cfg = loadJson('config/formaloo.json');
const workspace = (loadJson('config/forms.json') || {}).workspace;
if (!cfg || !cfg.live) { console.error('FAIL: config/formaloo.json missing.'); process.exit(1); }
let failed = 0;
console.log('form'.padEnd(18) + 'deleted'.padEnd(10) + 'remaining'.padEnd(12) + 'result');
console.log('-'.repeat(56));
for (const [id, f] of Object.entries(cfg.live)) {
  if (only && id !== only) continue;
  const rows = await readRows(f.slug, workspace, { retries: 1, waitMs: 0 });
  const hits = rows.filter(r => Object.values(r.data).some(v => String(v).includes(marker)));
  const del = await deleteRows(f.slug, hits.map(r => r.slug), workspace);
  const after = await readRows(f.slug, workspace, { retries: 2, waitMs: 1500 });
  const remaining = after.filter(r => Object.values(r.data).some(v => String(v).includes(marker))).length;
  if (remaining) failed++;
  console.log(String(id).padEnd(18) + String(del.deleted).padEnd(10) + String(remaining).padEnd(12) + (remaining ? 'FAIL' : 'PASS'));
  if (remaining && del.manual) console.log(`  delete by hand: ${del.manual}`);
}
console.log(failed ? 'DELETE_FAIL (record the manual step in the launch report)' : 'DELETE_OK');
process.exit(failed ? 1 : 0);
