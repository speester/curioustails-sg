#!/usr/bin/env node
/**
 * formaloo-list.mjs — list the rows of one provisioned form (alias -> value), so a human can
 * see exactly what the provider stored.
 *
 *   node scripts/formaloo-list.mjs --form contact [--limit 20]
 */
import { readRows, loadJson } from './formaloo-api.mjs';
const argv = process.argv.slice(2);
const id = argv.includes('--form') ? argv[argv.indexOf('--form') + 1] : 'contact';
const limit = Number(argv.includes('--limit') ? argv[argv.indexOf('--limit') + 1] : 20);
const cfg = loadJson('config/formaloo.json');
if (!cfg || !cfg.live || !cfg.live[id]) { console.error(`FAIL: config/formaloo.json has no live form "${id}".`); process.exit(1); }
const rows = await readRows(cfg.live[id].slug, (loadJson('config/forms.json') || {}).workspace, { retries: 1, waitMs: 0 });
console.log('row'.padEnd(26) + 'aliases with a value');
console.log('-'.repeat(70));
for (const r of rows.slice(0, limit)) {
  const filled = Object.entries(r.data).filter(([, v]) => String(v).trim() !== '').map(([k]) => k);
  console.log(String(r.slug).padEnd(26) + filled.join(', '));
}
console.log(`\nrows=${rows.length}`);
process.exit(0);
