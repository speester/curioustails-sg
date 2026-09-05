#!/usr/bin/env node
// kit:gen-redirects@1.0.0
// Builds public/_redirects from research/redirect-map.csv.
// Usage: node scripts/gen-redirects.mjs --check | --write
// CSV columns: old_url,target_slug,spam_score,priority
import fs from 'node:fs';
import path from 'node:path';

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
  const [head, ...rest] = text.trim().split(/\r?\n/);
  const cols = head.split(',').map((c) => c.trim());
  return rest.filter(Boolean).map((line) => {
    const cells = line.split(',');
    const row = {};
    cols.forEach((c, i) => { row[c] = (cells[i] ?? '').trim(); });
    return row;
  });
}

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

const kept = [];
const disavow = [];
for (const r of rows) {
  const score = Number(r.spam_score || 0);
  const from = canonicalPath(r.old_url).replace(/\/$/, '') || '/';
  const to = canonicalPath(r.target_slug);
  if (score > SPAM_CUTOFF) { disavow.push(`# DISAVOW-CANDIDATE ${r.old_url} spam_score=${score} (NOT redirected)`); continue; }
  kept.push({ from, to, prio: Number(r.priority || 0), splat: from.includes('*') });
}
// specific rules before splats; then by priority desc, then longest path first
kept.sort((a, b) => (a.splat - b.splat) || (b.prio - a.prio) || (b.from.length - a.from.length));

const body = [...disavow, ...kept.map((r) => `${r.from} ${r.to} 301`)].join('\n') + (kept.length || disavow.length ? '\n' : '');
const next = header + body;

// Hard failures
const problems = [];
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
console.log(`disavow candidates (spam>${SPAM_CUTOFF})  | ${disavow.length}`);
console.log(`syntax problems               | ${problems.length ? 'FAIL' : 'PASS'}`);
for (const p of problems) console.log('   ' + p);

if (problems.length) process.exit(1);
if (write) { fs.writeFileSync(OUT, next, 'utf8'); console.log('\nPASS wrote ' + OUT); process.exit(0); }
const drift = existing.trim() !== next.trim();
console.log(drift ? '\nFAIL public/_redirects is stale — run with --write' : '\nPASS public/_redirects up to date');
process.exit(drift ? 1 : 0);
