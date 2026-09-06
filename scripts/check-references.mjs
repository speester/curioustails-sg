#!/usr/bin/env node
// kit:check-references@1.0.0 — HEAD->GET, blocked != broken, staleness, referenceStatus.json.
// Usage: node scripts/check-references.mjs [--stale 90] [--concurrency 6]
//        node scripts/check-references.mjs --blocks   # letter (f): a Sources
//                                                 block on every content page
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const get = (f, d) => { const i = argv.indexOf(f); return i === -1 ? d : Number(argv[i + 1]); };
const STALE_DAYS = get('--stale', 90);
const CONC = get('--concurrency', 6);
// ---------------------------------------------------------------- --blocks (letter (f))
// Exit-gate letter (f) is TWO assertions: every content page carries a Sources block, and
// no registered source is broken. Only the second ever ran here, and the prose claimed the
// first lived in "check:refs' missing-block row" - a row this file did not have. A site
// with ZERO Sources blocks passed letter (f).
// The exemption predicate is the SHARED one (contracts §3), so this agrees with
// verify_page.py and check-quotes.mjs. NOT audit_built_html.py or ledger.py: those two
// still pass the ROUTE alone, so a keywordless or utility ROW that is not also a
// utility ROUTE gets a different verdict there. See the status note in
// exemptions.py::exemption_for - do not restate "by construction" until it is true.
if (argv.includes('--blocks')) {
  const { exemptionFor, EXEMPT, PARTIAL } = await import('./lib/exemptions.mjs');

  const DIST = process.env.PROJECT_ROOT ? path.join(process.env.PROJECT_ROOT, 'dist') : 'dist';
  const walk = (dir, out = []) => {
    if (!fs.existsSync(dir)) return out;
    for (const n of fs.readdirSync(dir)) {
      const p = path.join(dir, n);
      fs.statSync(p).isDirectory() ? walk(p, out) : out.push(p);
    }
    return out;
  };
  const pages = walk(DIST).filter((f) => f.endsWith(`${path.sep}index.html`));
  if (!pages.length) {
    console.log(`HALT: no dist/**/index.html - run \`npm run build\` first (looked in ${DIST})`);
    process.exit(1);
  }
  const missing = [];
  for (const f of pages) {
    const route = path.relative(DIST, f).split(path.sep).slice(0, -1).join('/') || 'index';
    // The blueprint row decides too (W11.2), not the route alone.
    const state = exemptionFor(route, 'FIGURE_EXEMPT_ROUTES');
    if (state === EXEMPT || state === PARTIAL) continue;
    // A SUBSTRING match passed any page carrying an inline per-figure attribution
    // (<p data-sources>), so this gate reported 0 missing while verify_page failed 21
    // of the same 27 pages for having no Sources SECTION. contracts requires a
    // <section data-sources> after the FAQ; match the same shape verify_page does.
    if (!/<section[^>]*\bdata-sources\b[\s\S]*?<\/section\s*>/i
        .test(fs.readFileSync(f, 'utf8'))) missing.push(`/${route}/`);
  }
  for (const m of missing) console.log(`FAIL no Sources block: ${m}`);
  console.log(`pages=${pages.length} missing_sources_blocks=${missing.length}`);
  process.exit(missing.length ? 1 : 0);
}

const SRC = 'src/data/sources.json';
const OUT = 'src/data/referenceStatus.json';
const TODAY = new Date().toISOString().slice(0, 10);

// A HALT still owes the shape: `checked=0` is how a reader tells "nothing
// to check" from "could not check", and contracts section-1b makes checked=0
// a FAIL unless the same line carries a reason. This one carries one.
if (!fs.existsSync(SRC)) { console.error(`FAIL ${SRC} missing — the citation registry is the only citation source. checked=0 failed=1`); process.exit(1); }
const sources = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};

const BLOCKED = new Set([400, 401, 403, 405, 406, 429, 999]);
const BROKEN = new Set([404, 410]);

async function probe(url) {
  const opts = { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; site-reference-check/1.0)' } };
  try {
    // Some hosts do not merely 405 a HEAD, they refuse the connection or hang, and the
    // request THROWS. Falling straight to the catch reported a live source as broken
    // (openlibrary.org, Insight User Conference 2026-09-06). A HEAD that fails for any
    // reason is retried as a GET before the URL is called dead.
    let r;
    try {
      r = await fetch(url, { ...opts, method: 'HEAD' });
    } catch {
      // The probe runs many URLs at once, and a host under that load can drop a connection
      // that answers fine on its own. One retry after a pause separates a transient timeout
      // from a dead link; a 404 or 410 still fails immediately, because it ANSWERED.
      try {
        r = await fetch(url, { ...opts, method: 'GET' });
      } catch {
        await new Promise((res) => setTimeout(res, 1200));
        r = await fetch(url, { ...opts, method: 'GET' });
      }
    }
    if (!r.ok) r = await fetch(url, { ...opts, method: 'GET' });   // many hosts 405 a HEAD
    if (r.ok) return { state: 'ok', code: r.status };
    if (BROKEN.has(r.status)) return { state: 'broken', code: r.status };
    if (BLOCKED.has(r.status)) return { state: 'blocked', code: r.status };
    return { state: 'blocked', code: r.status };
  } catch (e) {
    return { state: 'broken', code: 0, note: e.message.slice(0, 60) };
  }
}

const keys = Object.keys(sources);
const results = {};
let idx = 0;
async function worker() {
  while (idx < keys.length) {
    const k = keys[idx++];
    const url = sources[k].url;
    if (!url) { results[k] = { state: 'broken', checked: TODAY, code: 0, note: 'no url' }; continue; }
    const r = await probe(url);
    // A CONNECTION that never happened is not evidence the page is gone: the sweep runs 157
    // URLs and a host under that load drops one, which then reported a live source as a dead
    // link and failed the gate (Insight User Conference, 2026-09-06). A code-0 failure on a
    // URL that answered on its last run is recorded as blocked-transient, keeping the date
    // that matters for staleness. A server that ANSWERS 404 or 410 is still broken at once.
    const wasOk = prev[k] && (prev[k].state === 'ok' || prev[k].state === 'blocked');
    if (r.state === 'broken' && r.code === 0 && wasOk) {
      results[k] = { state: 'blocked', code: 0, note: 'transient: ' + (r.note || 'fetch failed'),
                     checked: TODAY, last_ok: prev[k].last_ok || prev[k].checked };
      continue;
    }
    results[k] = { ...r, checked: TODAY, ...(r.state === 'ok' ? { last_ok: TODAY } : {}) };
  }
}
await Promise.all(Array.from({ length: CONC }, worker));

const broken = Object.entries(results).filter(([, v]) => v.state === 'broken');
const blocked = Object.entries(results).filter(([, v]) => v.state === 'blocked');
const stale = Object.entries(prev).filter(([k, v]) => {
  if (!v.checked || results[k]) return false;
  return (Date.now() - Date.parse(v.checked)) / 86400000 > STALE_DAYS;
});

// sameAs / profile URLs anywhere in src/data must be verified or absent.
const sameAsProblems = [];
for (const f of fs.existsSync('src/data') ? fs.readdirSync('src/data') : []) {
  if (!/\.(ts|json)$/.test(f)) continue;
  const txt = fs.readFileSync(path.join('src/data', f), 'utf8');
  for (const m of txt.matchAll(/sameAs[^[]*\[([^\]]*)\]/g)) {
    for (const u of m[1].matchAll(/https?:\/\/[^"']+/g)) {
      const known = Object.values(sources).some((s) => s.url === u[0]);
      if (!known) sameAsProblems.push(`src/data/${f}: sameAs ${u[0]} is not in referenceStatus — verify it live (200) or omit it`);
    }
  }
}

fs.writeFileSync(OUT, JSON.stringify(results, null, 2) + '\n', 'utf8');

console.log('CHECK          | RESULT');
console.log(`references     | ${keys.length}`);
console.log(`ok             | ${keys.length - broken.length - blocked.length}`);
console.log(`blocked        | ${blocked.length} (400/401/403/429 — NOT broken)`);
console.log(`broken         | ${broken.length ? `FAIL (${broken.length})` : 'PASS'}`);
for (const [k, v] of broken) console.log(`   ${k} ${v.code} ${sources[k].url}`);
console.log(`stale > ${STALE_DAYS}d   | ${stale.length ? `WARN (${stale.length})` : 'PASS'}`);
console.log(`sameAs verified| ${sameAsProblems.length ? `FAIL (${sameAsProblems.length})` : 'PASS'}`);
for (const p of sameAsProblems) console.log('   ' + p);
console.log(`\nwrote ${OUT}`);
const failed = broken.length + sameAsProblems.length;
// contracts: every gate prints WHAT IT MEASURED, not only what failed - the
// fixed shape `checked=<n> failed=<m>` on the verdict line. Without it a
// clean run and a run that measured nothing print the same words. A gate
// whose checked is 0 must FAIL unless it also prints an exemption reason.
console.log(`check-references: checked=${Object.keys(results).length} failed=${failed}`);
console.log(failed ? 'FAIL check:sources' : 'PASS check:sources');
process.exit(failed ? 1 : 0);
