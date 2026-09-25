#!/usr/bin/env node
// kit:gen-redirects@1.1.0
// Builds public/_redirects from research/redirect-map.csv.
// Usage: node scripts/gen-redirects.mjs --check | --write
// CSV columns: old_url,target_slug,spam_score,priority
//   (aliases accepted: legacy_url|from for old_url, new_target|to for target_slug)
//
// 1.1.0 (rapamycin.store, 2026-09-13): the map on that project used the local-research
// vocabulary (legacy_url,new_target,priority=HIGH). 1.0.0 read r.old_url / r.target_slug,
// got undefined for every row, canonicalPath(undefined) returned '/', and --write emitted
// EIGHT `/ / 301` rules - a redirect loop on the homepage of a live site - while printing
// "syntax problems PASS". Three changes, for the class and not the symptom:
//   1. column aliases, and a HALT when a row resolves neither name (never a silent '/');
//   2. a rule whose source is '/' or whose target is empty is a hard problem, and /x -> /x/
//      (the platform's own trailing-slash redirect, a loop when written) is held, so
//      --write can never ship a loop;
//   3. the ONE RFC-4180 parser (lib/csv.mjs) replaces line.split(','), and a source the
//      hand-written section above the banner already routes is held, not duplicated.
import fs from 'node:fs';
import path from 'node:path';
import { parseCsv as parseRows } from './lib/csv.mjs';

const args = process.argv.slice(2);
const write = args.includes('--write');
const MAP = path.join('research', 'redirect-map.csv');
const OUT = path.join('public', '_redirects');
const HEADER_END = '# Generated rows below this line come from scripts/gen-redirects.mjs.';
const SPAM_CUTOFF = 20;

function canonicalPath(p) {
  if (!p) return '/';
  let s = String(p).trim().split('#')[0].split('?')[0];
  if (/^https?:\/\//i.test(s)) { try { s = new URL(s).pathname; } catch {} }
  if (!s.startsWith('/')) s = '/' + s;
  s = s.replace(/\/{2,}/g, '/');
  const last = s.split('/').filter(Boolean).pop() ?? '';
  if (last.includes('.')) return s;
  return s.endsWith('/') ? s : s + '/';
}

function parseCsv(text) {
  const [head, ...rest] = parseRows(text);
  if (!head) return [];
  const cols = head.cells.map((c) => c.trim());
  return rest.map(({ cells }) => {
    const row = {};
    cols.forEach((c, i) => { row[c] = (cells[i] ?? '').trim(); });
    return row;
  });
}
const pick = (r, names) => { for (const n of names) if (r[n] !== undefined && r[n] !== '') return r[n]; return ''; };
const PRIORITY_WORDS = { high: 3, medium: 2, med: 2, low: 1 };
const priorityOf = (v) => {
  const n = Number(v);
  if (Number.isFinite(n) && String(v).trim() !== '') return n;
  return PRIORITY_WORDS[String(v || '').trim().toLowerCase()] ?? 0;
};

const existing = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
const headerIdx = existing.indexOf(HEADER_END);
// Everything ABOVE the banner is hand-written and preserved. On the FIRST run the banner
// does not exist yet - and this used to discard the whole file, silently deleting the
// hand-written rules (chihuahua.sg lost its www->apex rules to exactly this). Keep what
// is already there and append the banner instead.
const header = headerIdx === -1
  ? (existing.trim()
      ? [existing.trimEnd(), '', HEADER_END, ''].join(String.fromCharCode(10))
      : HEADER_END + String.fromCharCode(10))
  : existing.slice(0, headerIdx + HEADER_END.length + 1);

let rows = [];
if (fs.existsSync(MAP)) rows = parseCsv(fs.readFileSync(MAP, 'utf8'));

// Sources the hand-written section already routes. A generated duplicate is dead weight at
// best and, when the two targets differ, a rule that silently loses to the one above it.
const handSources = new Set(
  header.split(/\r?\n/)
    .filter((l) => l.trim() && !l.trim().startsWith('#'))
    .map((l) => l.trim().split(/\s+/)[0].replace(/\/$/, '') || '/'),
);

const kept = [];
const disavow = [];
const held = [];
const rowProblems = [];
rows.forEach((r, i) => {
  const rawFrom = pick(r, ['old_url', 'legacy_url', 'from']);
  const rawTo = pick(r, ['target_slug', 'new_target', 'to']);
  const label = `redirect-map.csv row ${i + 2}`;
  if (!rawFrom || !rawTo) {
    rowProblems.push(`${label}: no source or no target (columns read: old_url|legacy_url|from, target_slug|new_target|to) - refusing to guess '/'`);
    return;
  }
  const score = Number(r.spam_score || 0);
  const from = canonicalPath(rawFrom).replace(/\/$/, '') || '/';
  const to = canonicalPath(rawTo);
  if (score > SPAM_CUTOFF) { disavow.push(`# DISAVOW-CANDIDATE ${rawFrom} spam_score=${score} (NOT redirected)`); return; }
  if (from === '/') { rowProblems.push(`${label}: source resolves to the homepage - a 301 from / takes the whole site down`); return; }
  // /x -> /x/ is the platform's own trailing-slash redirect (Cloudflare Pages answers it
  // with a 308). Written as a rule it MATCHES /x/ too, because Pages ignores the trailing
  // slash when matching, and that is a loop. Nothing to write; the row is already served.
  if (from === to.replace(/\/$/, '')) { held.push(from); return; }
  if (handSources.has(from)) { held.push(from); return; }
  kept.push({ from, to, prio: priorityOf(r.priority), splat: from.includes('*') });
});
// specific rules before splats; then by priority desc, then longest path first
kept.sort((a, b) => (a.splat - b.splat) || (b.prio - a.prio) || (b.from.length - a.from.length));

const body = [...disavow, ...kept.map((r) => `${r.from} ${r.to} 301`)].join('\n') + (kept.length || disavow.length ? '\n' : '');
const next = header + body;

// Hard failures
const problems = [...rowProblems];
for (const line of body.split('\n')) {
  if (!line || line.startsWith('#')) continue;
  if (line.includes('!')) problems.push(`Netlify-style rule (banned): ${line}`);
  const target = line.split(/\s+/)[1] || '';
  if (target && !target.endsWith('/') && !target.split('/').pop().includes('.')) {
    problems.push(`target not canonical (no trailing slash): ${line}`);
  }
}

console.log('CHECK                         | RESULT');
console.log(`redirect-map.csv present      | ${fs.existsSync(MAP) ? 'PASS' : 'PASS (none — empty template)'}`);
console.log(`rows                          | ${rows.length}`);
console.log(`301s written                  | ${kept.length}`);
console.log(`held by hand-written rules    | ${held.length}`);
console.log(`disavow candidates (spam>${SPAM_CUTOFF})  | ${disavow.length}`);
console.log(`syntax problems               | ${problems.length ? 'FAIL' : 'PASS'}`);
for (const p of problems) console.log('   ' + p);

console.log(`gen-redirects: checked=${rows.length} failed=${problems.length}`);
if (problems.length) process.exit(1);
if (write) { fs.writeFileSync(OUT, next, 'utf8'); console.log('\nPASS wrote ' + OUT); process.exit(0); }
const drift = existing.trim() !== next.trim();
console.log(drift ? '\nFAIL public/_redirects is stale — run with --write' : '\nPASS public/_redirects up to date');
process.exit(drift ? 1 : 0);
