#!/usr/bin/env node
/**
 * check-form-purpose.mjs — a page's form must match its purpose.
 *
 *   node scripts/check-form-purpose.mjs [--dist dist]
 *
 * Fails when: a blueprint page's form_id is not registered; a pitch/advertise page carries the
 * consumer form (or its compliance copy); a consumer money page carries the pitch form; a built
 * <form action> has no entry in config/forms.json.
 */
import fs from 'node:fs';
import path from 'node:path';
const DIST = process.argv.includes('--dist') ? process.argv[process.argv.indexOf('--dist') + 1] : 'dist';
const ex = p => { try { fs.accessSync(p); return true; } catch { return false; } };
const rd = p => fs.readFileSync(p, 'utf8');
const forms = ex('config/forms.json') ? JSON.parse(rd('config/forms.json')) : null;
if (!forms) { console.error('FAIL: config/forms.json missing.'); process.exit(1); }
const byId = Object.fromEntries(forms.forms.map(f => [f.id, f]));

function csvRows(p) {
  if (!ex(p)) return [];
  // lib/csv.mjs is THE RFC-4180 row parser. A hand-rolled splitter here yields a phantom
  // route from any quoted field, and the contract blueprint quotes notes/serp_features.
  const rowsRaw = parseCsv(rd(p)).map((r) => r.cells);
  const head = rowsRaw[0].map((s) => s.trim());
  return rowsRaw.slice(1).map(cells => {
    return Object.fromEntries(head.map((h, i) => [h, (cells[i] || '').trim()]));
  });
}
const rows = csvRows('research/site-blueprint.csv');
const PITCH = /^\/(write-for-us|advertise|partners)(\/|$)/;
const fails = [];
for (const r of rows) {
  if (!r.form_id) continue;
  if (!byId[r.form_id]) { fails.push([r.url_slug, `form_id "${r.form_id}" is not in config/forms.json`]); continue; }
  const type = byId[r.form_id].type;
  if (PITCH.test(r.url_slug) && ['contact', 'embed'].includes(type)) fails.push([r.url_slug, `pitch page carries the ${type} form`]);
  if (!PITCH.test(r.url_slug) && ['pitch', 'advertise'].includes(type) && r.page_tier !== 'monetization') fails.push([r.url_slug, `consumer page carries the ${type} form`]);
}
/* built-output half */
let actions = [];
if (ex(DIST)) {
  (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name === 'index.html') {
    const html = rd(p);
    const route = ('/' + path.relative(DIST, p).replace(/\\/g, '/')).replace(/index\.html$/, '') || '/';
    for (const m of html.matchAll(/<form[^>]+action="([^"]+)"/gi)) actions.push([route, m[1]]);
    if (PITCH.test(route) && /\b(911|TCPA|autodial)/i.test(html)) fails.push([route, 'consumer compliance copy (911/TCPA/autodial) on a pitch page']);
  } } })(DIST);
  const endpoints = new Set(forms.forms.map(f => f.endpoint));
  for (const [route, a] of actions) if (a.startsWith('/api/') && !endpoints.has(a)) fails.push([route, `<form action="${a}"> has no registry entry`]);
}
console.log('page'.padEnd(34) + 'problem');
console.log('-'.repeat(84));
for (const [p, why] of fails) console.log(String(p).padEnd(34) + why);
console.log(`\nrows_with_form=${rows.filter(r => r.form_id).length} built_form_actions=${actions.length} purpose_mismatch=${fails.length}`);
console.log(fails.length ? 'FORM_PURPOSE_FAIL' : 'FORM_PURPOSE_OK');
// contracts section-1b: every gate prints WHAT IT MEASURED, not only what
// failed - the fixed shape `checked=<n> failed=<m>` on the verdict line.
console.log(`check-form-purpose: checked=${Object.keys(forms).length} failed=${fails.length}`);
process.exit(fails.length ? 1 : 0);
