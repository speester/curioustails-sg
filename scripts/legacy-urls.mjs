#!/usr/bin/env node
/**
 * legacy-urls.mjs — expired/migrated domain recon: Wayback CDX + DataForSEO backlinks ->
 * research/legacy-urls.md, research/redirect-map.csv, public/_redirects,
 * research/disavow.txt, research/backlink-baseline.json.
 *
 *   node scripts/legacy-urls.mjs --domain example.com [--limit 500] [--spam-threshold 20]
 *   node scripts/legacy-urls.mjs --check
 *
 * --check exits 1 on: a /* catch-all, a two-hop redirect, a target that is not a blueprint row,
 * a disavow line that is not `domain:`, a missing artifact, or any linked legacy URL with no
 * target. Node 20+, stdlib only.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const argv = process.argv.slice(2);
const flag = (n, d = null) => {
  const eq = argv.find(a => a.startsWith(`--${n}=`)); if (eq) return eq.split('=').slice(1).join('=');
  const i = argv.indexOf(`--${n}`); return i >= 0 ? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : 'true') : d;
};
const ex = p => { try { fs.accessSync(p); return true; } catch { return false; } };
const rd = p => fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
const today = new Date().toISOString().slice(0, 10);
const SPAM = Number(flag('spam-threshold', '20'));

/* ---------- blueprint rows (redirect targets must be real) ---------- */
function blueprintSlugs() {
  const CSV = 'research/site-blueprint.csv';
  if (!ex(CSV)) return [];
  // lib/csv.mjs is THE RFC-4180 row parser. A hand-rolled splitter here yields a phantom
  // route from any quoted field, and the contract blueprint quotes notes/serp_features.
  const rowsRaw = parseCsv(rd(CSV)).map((r) => r.cells);
  const head = rowsRaw[0].map((s) => s.trim());
  const i = head.indexOf('url_slug');
  return rowsRaw.slice(1).map(cells => {
    return cells[i];
  }).filter(Boolean);
}
const tokens = s => (String(s).toLowerCase().match(/[a-z0-9]+/g) || []).filter(t => t.length > 2 && !/^(html|php|index|www|com|net|org)$/.test(t));
function bestTarget(legacyPath, slugs) {
  const a = new Set(tokens(legacyPath));
  let best = null, bestScore = 0;
  for (const s of slugs) {
    const b = new Set(tokens(s));
    const inter = [...a].filter(t => b.has(t)).length;
    const uni = new Set([...a, ...b]).size || 1;
    const score = inter / uni;
    if (score > bestScore) { bestScore = score; best = s; }
  }
  return bestScore >= 0.34 ? best : '';
}

/* ---------- CHECK MODE ---------- */
if (flag('check') === 'true') {
  const rows = [];
  const need = ['research/legacy-urls.md', 'research/redirect-map.csv', 'public/_redirects', 'research/disavow.txt', 'research/backlink-baseline.json'];
  let fails = 0;
  for (const f of need) { const ok = ex(f) && fs.statSync(f).size > 0; if (!ok) fails++; rows.push([`artifact ${f}`, ok ? 'present' : 'MISSING', ok ? 'PASS' : 'FAIL']); }
  let legacy = 0, rules = 0, catchAll = 0, twoHop = 0, badTarget = 0, needsTarget = 0;
  if (ex('public/_redirects')) {
    // lib/csv.mjs is THE RFC-4180 row parser. A hand-rolled splitter here yields a phantom
    // route from any quoted field, and the contract blueprint quotes notes/serp_features.
    const rowsRaw = parseCsv(rd('public/_redirects')).map((r) => r.cells);
    rules = lines.length;
    const sources = new Set(lines.map(l => l.split(/\s+/)[0]));
    const slugs = new Set(blueprintSlugs());
    for (const l of lines) {
      const [from, to] = l.split(/\s+/);
      if (from === '/*') catchAll++;
      if (to && sources.has(to)) twoHop++;
      if (to && to.startsWith('/') && slugs.size && !slugs.has(to)) badTarget++;
    }
  }
  if (ex('research/redirect-map.csv')) {
    // lib/csv.mjs is THE RFC-4180 row parser. A hand-rolled splitter here yields a phantom
    // route from any quoted field, and the contract blueprint quotes notes/serp_features.
    const rowsRaw = parseCsv(rd('research/redirect-map.csv')).map((r) => r.cells);
    legacy = lines.length;
    needsTarget = lines.filter(l => { const c = l.split(','); return Number(c[1] || 0) > 0 && (!c[4] || c[4] === 'TARGET-TBD'); }).length;
  }
  let badDisavow = 0;
  if (ex('research/disavow.txt')) badDisavow = rd('research/disavow.txt').split(/\r?\n/).filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('domain:')).length;
  rows.push(['catch-all rules (/*)', catchAll, catchAll ? 'FAIL' : 'PASS']);
  rows.push(['two-hop redirects', twoHop, twoHop ? 'FAIL' : 'PASS']);
  rows.push(['targets that are blueprint rows', `${rules - badTarget}/${rules}`, badTarget ? 'FAIL' : 'PASS']);
  rows.push(['linked legacy URLs with a target', `${legacy - needsTarget}/${legacy}`, needsTarget ? 'FAIL' : 'PASS']);
  rows.push(['disavow lines in domain: format', badDisavow ? `${badDisavow} bad` : 'all', badDisavow ? 'FAIL' : 'PASS']);
  console.log('check'.padEnd(44) + 'value'.padEnd(16) + 'result');
  console.log('-'.repeat(72));
  for (const [n, v, r] of rows) { console.log(String(n).padEnd(44) + String(v).padEnd(16) + r); if (r === 'FAIL') fails++; }
  console.log(`\nlegacy_urls=${legacy} redirect_rules=${rules} catch_all=${catchAll} two_hop=${twoHop} needs_target=${needsTarget}`);
  console.log(fails ? 'LEGACY_FAIL' : 'LEGACY_OK');
  process.exit(fails ? 1 : 0);
}

/* ---------- BUILD MODE ---------- */
const domain = (flag('domain') || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
if (!domain) { console.error('FAIL: --domain <example.com> is required (or use --check).'); process.exit(1); }
const limit = Number(flag('limit', '500'));

function dfsAuth() {
  let u = process.env.DATAFORSEO_USERNAME, p = process.env.DATAFORSEO_PASSWORD;
  const envFile = path.join(os.homedir(), '.claude', '.env');
  if ((!u || !p) && ex(envFile)) for (const line of rd(envFile).split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue;
    const v = m[2].replace(/^["']|["']$/g, '');
    if (m[1] === 'DATAFORSEO_USERNAME' && !u) u = v;
    if (m[1] === 'DATAFORSEO_PASSWORD' && !p) p = v;
  }
  return (u && p) ? 'Basic ' + Buffer.from(`${u}:${p}`).toString('base64') : null;
}
async function dfs(endpoint, payload) {
  const auth = dfsAuth();
  if (!auth) return { unknown: 'DATAFORSEO credentials not resolvable' };
  const res = await fetch('https://api.dataforseo.com/v3' + endpoint, {
    method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/json' }, body: JSON.stringify([payload])
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body) return { unknown: `HTTP ${res.status}` };
  const t = (body.tasks || [])[0];
  if (!t || t.status_code >= 40000) return { unknown: t ? t.status_message : 'no task' };
  return (t.result || [])[0] || {};
}
async function wayback() {
  const u = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(domain)}/*&output=json&collapse=urlkey&fl=original,timestamp,statuscode&filter=statuscode:200&limit=${limit}`;
  try {
    const res = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; site-build/1.0)' } });
    if (!res.ok) return { rows: [], unknown: `HTTP ${res.status}` };
    const j = await res.json();
    return { rows: j.slice(1).map(r => r[0]) };
  } catch (e) { return { rows: [], unknown: e.message }; }
}

const unknowns = [];
const wb = await wayback(); if (wb.unknown) unknowns.push(`wayback: ${wb.unknown}`);
const pagesRes = await dfs('/backlinks/domain_pages/live', { target: domain, limit, backlinks_status_type: 'live' });
if (pagesRes.unknown) unknowns.push(`backlinks_domain_pages: ${pagesRes.unknown}`);
const summary = await dfs('/backlinks/summary/live', { target: domain, internal_list_limit: 1, backlinks_status_type: 'live' });
if (summary.unknown) unknowns.push(`backlinks_summary: ${summary.unknown}`);
const backlinksRes = await dfs('/backlinks/backlinks/live', { target: domain, limit, backlinks_status_type: 'live' });
if (backlinksRes.unknown) unknowns.push(`backlinks: ${backlinksRes.unknown}`);

const pathOf = u => { try { const x = new URL(u.startsWith('http') ? u : 'https://' + u); return x.pathname.endsWith('/') ? x.pathname : x.pathname + '/'; } catch { return null; } };
const map = new Map();
for (const u of (wb.rows || [])) { const p = pathOf(u); if (p) map.set(p, { path: p, rd: 0, backlinks: 0, spam: 0, dofollow: 0, anchor: '', source: 'wayback' }); }
for (const it of (pagesRes.items || [])) {
  const p = pathOf(it.page_address || it.url || '');
  if (!p) continue;
  const cur = map.get(p) || { path: p, rd: 0, backlinks: 0, spam: 0, dofollow: 0, anchor: '', source: 'dfs' };
  cur.rd = it.referring_domains ?? cur.rd; cur.backlinks = it.backlinks ?? cur.backlinks;
  cur.spam = (it.backlinks_spam_score ?? cur.spam); cur.source = 'wayback+dfs';
  map.set(p, cur);
}
const spamDomains = new Map();
for (const b of (backlinksRes.items || [])) {
  const p = pathOf(b.url_to || ''); const dom = (b.domain_from || '').replace(/^www\./, '');
  const score = b.backlink_spam_score ?? 0;
  if (dom && score > SPAM) spamDomains.set(dom, Math.max(spamDomains.get(dom) || 0, score));
  if (p && map.has(p)) {
    const cur = map.get(p);
    cur.anchor = cur.anchor || (b.anchor || '');
    cur.dofollow += b.dofollow ? 1 : 0;
    cur.spam = Math.max(cur.spam, score);
  }
}
const slugs = blueprintSlugs();
const rows = [...map.values()].sort((a, b) => (b.rd - a.rd) || (b.backlinks - a.backlinks));
for (const r of rows) {
  r.classification = r.spam > SPAM ? 'disavow-candidate' : (r.rd > 0 || r.backlinks > 0 ? 'redirect' : 'archive-only');
  r.target = r.classification === 'redirect' ? (bestTarget(r.path, slugs) || 'TARGET-TBD') : '';
  r.rationale = r.classification === 'disavow-candidate'
    ? `spam_score ${r.spam} > ${SPAM} — disavow candidate, NOT a 301`
    : (r.target && r.target !== 'TARGET-TBD' ? `most on-topic new page by token overlap` : (r.classification === 'redirect' ? 'needs a human target decision' : 'no links, archive only'));
}
fs.mkdirSync('research', { recursive: true }); fs.mkdirSync('public', { recursive: true });

let md = `# Legacy URLs — ${domain} (${today})\n\n`;
if (unknowns.length) md += `> UNKNOWN (recorded, never degraded to a pass): ${unknowns.join('; ')}\n\n`;
md += '| legacy URL | rd | backlinks | spam | dofollow | anchor | classification | target | rationale |\n|---|---|---|---|---|---|---|---|---|\n';
for (const r of rows) md += `| ${r.path} | ${r.rd} | ${r.backlinks} | ${r.spam} | ${r.dofollow} | ${(r.anchor || '').slice(0, 40)} | ${r.classification} | ${r.target} | ${r.rationale} |\n`;
fs.writeFileSync('research/legacy-urls.md', md, 'utf8');

let csv = 'old_url,rd,backlinks,spam,target,priority\n';
rows.forEach((r, i) => { csv += `"${r.path}",${r.rd},${r.backlinks},${r.spam},"${r.target}",${i + 1}\n`; });
fs.writeFileSync('research/redirect-map.csv', csv, 'utf8');

let red = ex('public/_redirects') ? rd('public/_redirects') : '';
if (red && !red.endsWith('\n')) red += '\n';
red += `\n# --- legacy reclaim (${domain}, generated ${today}; specific rules first, NO /* catch-all) ---\n`;
for (const r of rows) {
  if (r.classification !== 'redirect' || !r.target || r.target === 'TARGET-TBD') continue;
  const noSlash = r.path.replace(/\/$/, '');
  red += `${r.path}  ${r.target}  301\n`;
  if (noSlash && noSlash !== r.path) red += `${noSlash}  ${r.target}  301\n`;
}
fs.writeFileSync('public/_redirects', red, 'utf8');

if (ex('research/disavow.txt')) fs.copyFileSync('research/disavow.txt', `research/disavow.${today}.bak.txt`);
let dis = `# disavow for ${domain} — generated ${today}; spam_score > ${SPAM} only\n`;
for (const [d, s] of [...spamDomains.entries()].sort((a, b) => b[1] - a[1])) dis += `domain:${d}\n`;
if (spamDomains.size === 0) { console.log('NOTE: no domain exceeded the spam threshold — disavow.txt written with a header only, never over-disavow.'); }
fs.writeFileSync('research/disavow.txt', dis, 'utf8');

fs.writeFileSync('research/backlink-baseline.json', JSON.stringify({
  domain, date: today,
  referring_domains: summary.referring_domains ?? 'UNKNOWN',
  rank: summary.rank ?? 'UNKNOWN',
  backlinks: summary.backlinks ?? 'UNKNOWN',
  broken_backlinks: summary.broken_backlinks ?? 'UNKNOWN',
  unknowns
}, null, 2), 'utf8');

let watch = `# Spam watchlist — ${domain} (first seen ${today}; disavow threshold ${SPAM})\n\n| domain | spam_score | first_seen |\n|---|---|---|\n`;
for (const [d, s] of spamDomains) watch += `| ${d} | ${s} | ${today} |\n`;
fs.writeFileSync('research/spam-watchlist.md', watch, 'utf8');

const needsTarget = rows.filter(r => r.target === 'TARGET-TBD').length;
console.log('artifact'.padEnd(38) + 'value'.padEnd(14) + 'result');
console.log('-'.repeat(64));
console.log('research/legacy-urls.md'.padEnd(38) + String(rows.length).padEnd(14) + 'PASS');
console.log('public/_redirects rules'.padEnd(38) + String(rd('public/_redirects').split(/\r?\n/).filter(l => l && !l.startsWith('#')).length).padEnd(14) + 'PASS');
console.log('disavow domains'.padEnd(38) + String(spamDomains.size).padEnd(14) + 'PASS');
console.log('legacy URLs needing a target'.padEnd(38) + String(needsTarget).padEnd(14) + (needsTarget ? 'FAIL' : 'PASS'));
console.log(`\nlegacy_urls=${rows.length} needs_target=${needsTarget} spam_domains=${spamDomains.size} unknown=${unknowns.length}`);
console.log(needsTarget ? 'LEGACY_FAIL (assign a target for every linked legacy URL, then re-run)' : 'LEGACY_OK');
process.exit(needsTarget ? 1 : 0);
