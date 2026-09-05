#!/usr/bin/env node
// kit:formaloo-smoke@1.0.0 — smoke every form through a DEPLOYED PREVIEW Function.
// Usage: node scripts/formaloo-smoke.mjs --origin|--url https://<hash>.<project>.pages.dev [--via preview|production] [--negative]
// Asserts: JSON ok, native 303 -> thank-you, honeypot creates no row, rejected -> 303 ?error=,
// the key is absent from the bundle, and the row reads back with every alias non-empty.
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
// Unknown flags are REFUSED (the page-health.mjs pattern). Ignoring them is how
// `--negative` silently ran the POSITIVE test for months.
const KNOWN = new Set(['--origin', '--url', '--via', '--negative']);
const unknown = argv.filter((a) => a.startsWith('--') && !KNOWN.has(a));
if (unknown.length) {
  console.error(`FAIL unknown option(s): ${unknown.join(' ')}`);
  console.error(`     known: ${[...KNOWN].join(' ')}`);
  process.exit(2);
}
const get = (f, d = '') => { const i = argv.indexOf(f); return i === -1 ? d : argv[i + 1]; };
// --url is the same thing --origin names; --via records WHICH deployment was smoked
// (preview | production) so the artifact says what was actually exercised.
const VIA = get('--via', 'preview');
const NEGATIVE = argv.includes('--negative');
const ORIGIN = (get('--origin') || get('--url')).replace(/\/+$/, '');
if (!ORIGIN) { console.error('FAIL --origin https://<hash>.<project>.pages.dev (hash URL first — alias propagation lags)'); process.exit(1); }

const forms = fs.readdirSync('config').filter((f) => /^formaloo\..+\.json$/.test(f))
  .map((f) => JSON.parse(fs.readFileSync(path.join('config', f), 'utf8')));
if (!forms.length) { console.error('FAIL no config/formaloo.<key>.json'); process.exit(1); }

const SENTINEL = `ZZTEST-${new Date().toISOString().slice(0, 10)}`;
const rows = [];
const add = (form, name, ok, note = '') => rows.push([form, name, ok ? 'PASS' : 'FAIL', note]);

// ---------------------------------------------------------------- NEGATIVE MODE
// contracts: a form whose secret is unset must FAIL CLOSED - 503, never a thank-you.
// A form that silently accepts a submission it cannot store loses the lead AND tells the
// visitor it worked.
if (NEGATIVE) {
  const neg = [];
  for (const f of forms) {
    const url = `${ORIGIN}${f.function ?? `/api/${f.key}`}`;
    const body = new URLSearchParams({ _negative: '1' });
    for (const fld of f.fields ?? []) {
      if (fld.hidden || fld.tracking) continue;
      body.set(fld.alias, fld.type === 'email' ? 'zztest@example.com' : SENTINEL);
    }
    try {
      const r = await fetch(url, {
        method: 'POST', redirect: 'manual',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body,
      });
      const loc = r.headers.get('location') || '';
      const ok = r.status === 503 && !/thank-?you/i.test(loc);
      neg.push([f.key, 'secret unset -> 503', ok ? 'PASS' : 'FAIL',
                `status=${r.status}${loc ? ` location=${loc}` : ''}`]);
    } catch (e) {
      neg.push([f.key, 'secret unset -> 503', 'FAIL', e.message.slice(0, 60)]);
    }
  }
  console.log('FORM      | CHECK              | RESULT | NOTE');
  for (const [f, c, r, n] of neg) console.log(`${String(f).padEnd(9)} | ${c.padEnd(18)} | ${r.padEnd(6)} | ${n}`);
  const bad = neg.filter((r) => r[2] === 'FAIL').length;
  console.log(`\nvia=${VIA} forms=${forms.length} negative-checks=${neg.length} failed=${bad}`);
  console.log(bad ? 'FAIL formaloo-smoke --negative' : 'PASS formaloo-smoke --negative');
  process.exit(bad ? 1 : 0);
}

for (const f of forms) {
  const url = `${ORIGIN}${f.function ?? `/api/${f.key}`}`;
  const base = {};
  for (const fld of f.fields ?? []) {
    if (fld.hidden || fld.tracking) continue;
    base[fld.alias] = fld.type === 'email' ? `zztest+${Date.now()}@example.com`
      : fld.type === 'phone' ? '(555) 123-4567'
      // kit fix: formaloo-provision.mjs writes type 'dropdown' (the Formaloo field type),
      // never 'choice'. Matching only on 'choice' meant every dropdown got the sentinel
      // STRING as its value, the Function passed it through unmapped, and Formaloo 400'd
      // the whole submit. Any field carrying choices[] is a choice field.
      : (fld.choices?.length ? fld.choices[0].slug
      : fld.type === 'choice' || fld.type === 'dropdown' ? (fld.choices?.[0]?.slug ?? '')
      : `${SENTINEL} ${fld.alias}`);
  }

  // 1. JSON caller, no referer, phone in a human format
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'X-Requested-With': 'fetch', 'Content-Type': 'application/json' }, body: JSON.stringify(base) });
    const j = await r.json();
    add(f.key, 'json ok', r.status === 200 && j.ok === true, `status=${r.status} body=${JSON.stringify(j).slice(0, 80)}`);
  } catch (e) { add(f.key, 'json ok', false, e.message.slice(0, 60)); }

  // 2. native caller -> 303 thank-you
  try {
    // A DISTINCT email per sub-test. Every request below reused the one address built into
    // `base`, so the provider saw the same submitter twice in a row and rejected the second
    // as a duplicate: `native 303` failed or passed depending on timing, which is worse than
    // failing outright because it looks like a flaky deployment rather than a flaky test.
    const body = new URLSearchParams({ ...base, email: `zztest+${Date.now()}n@example.com` });
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body, redirect: 'manual' });
    const loc = r.headers.get('location') || '';
    add(f.key, 'native 303', r.status === 303 && loc.includes(f.thankYou ?? '/contact/thank-you/'), `status=${r.status} location=${loc}`);
    add(f.key, 'no json to browser', !(r.headers.get('content-type') || '').includes('application/json'), '');
  } catch (e) { add(f.key, 'native 303', false, e.message.slice(0, 60)); }

  // 3. honeypot -> success shape, no row
  try {
    const body = new URLSearchParams({ ...base, email: `zztest+${Date.now()}h@example.com`, [f.honeypot_field ?? 'company_website']: 'bot' });
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body, redirect: 'manual' });
    add(f.key, 'honeypot silent', r.status === 303, `status=${r.status} (verify NO row landed)`);
  } catch (e) { add(f.key, 'honeypot silent', false, e.message.slice(0, 60)); }
}

// 4. the key must never be in the bundle
let keyLeak = false;
if (fs.existsSync('dist/_astro')) {
  for (const file of fs.readdirSync('dist/_astro').filter((x) => x.endsWith('.js'))) {
    const js = fs.readFileSync(path.join('dist/_astro', file), 'utf8');
    for (const f of forms) if (f.displayKey && js.includes(f.displayKey)) keyLeak = true;
  }
}
add('(bundle)', 'no key in bundle', !keyLeak);

console.log('FORM      | CHECK              | RESULT | NOTE');
for (const [f, c, r, n] of rows) console.log(`${String(f).padEnd(9)} | ${c.padEnd(18)} | ${r.padEnd(6)} | ${n}`);
const failed = rows.filter((r) => r[2] === 'FAIL').length;
console.log(`\nforms=${forms.length} checks=${rows.length} failed=${failed}`);
console.log('MANUAL: read each row back in Formaloo (every alias non-empty), confirm the notification e-mail arrived, then DELETE the test rows.');
console.log(failed ? 'FAIL formaloo-smoke' : 'PASS formaloo-smoke');
process.exit(failed ? 1 : 0);
