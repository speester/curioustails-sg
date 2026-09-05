#!/usr/bin/env node
/**
 * dfs-pull.mjs — the ONE DataForSEO helper for Stage 1. Raw payloads land in research/raw/,
 * summaries in research/evidence/. A raw DataForSEO response is never pasted into context.
 *
 *   --loc takes a DataForSEO location_code (2702 = Singapore, 2840 = United States) or a
 *   FULL location_name ("Singapore"). A two-letter country code is NOT accepted by the API
 *   and every call made with one is rejected with "Invalid Field: 'location_name'".
 *   node scripts/dfs-pull.mjs serp "<keyword>" --loc 2702 --lang en --depth 10 --paa 2 --out research/evidence/<slug>.json
 *   node scripts/dfs-pull.mjs overview "<keyword>" [--variants] --loc 2702 --lang en
 *   node scripts/dfs-pull.mjs suggestions --seed "<phrase>" --loc 2702 --lang en
 *   node scripts/dfs-pull.mjs ideas --seed "<phrase>" --assert-relevance 0.6 --niche "token1,token2"
 *   node scripts/dfs-pull.mjs trend "<keyword>" --loc 2702 --lang en
 *   node scripts/dfs-pull.mjs rd <url> [<url> ...]
 *   node scripts/dfs-pull.mjs backlinks <domain>
 *   node scripts/dfs-pull.mjs anchors <domain>
 *
 * Exit 0 = data written. Exit 1 = HTTP/API failure, or an `ideas` response below the
 * relevance floor (which is recorded in research.json.discards and DISCARDED).
 * Node 20+, stdlib only (built-in fetch).
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const BASE = 'https://api.dataforseo.com/v3';
const argv = process.argv.slice(2);
const cmd = argv[0];

// --provenance (RULE 13's gate, W10.6). The rule used to read `research.json.provenance`,
// a key nothing has ever written; the real provenance is the per-row `source_endpoint` +
// `measured_on` every keyword_data and serp row carries. Count them, name the oldest, and
// exit 1 when a research file holds rows that cannot be traced to a tool call.
if (cmd === '--provenance') {
  const fsp = await import('node:fs');
  let j;
  try {
    j = JSON.parse(fsp.readFileSync('research/research.json', 'utf8'));
  } catch (e) {
    console.log(`FAIL research/research.json unreadable: ${e.message}`);
    process.exit(1);
  }
  const rows = [
    ...(j.keyword_data ?? []),
    ...(Array.isArray(j.serp_analysis) ? j.serp_analysis : Object.values(j.serp_analysis ?? {})),
  ].filter((r) => r && typeof r === 'object');
  const traced = rows.filter((r) => r.source_endpoint && (r.measured_on || r.pulled_at));
  const dates = traced.map((r) => String(r.measured_on || r.pulled_at).slice(0, 10)).sort();
  const untraced = rows.length - traced.length;
  console.log(`provenance: ${traced.length} row(s), oldest ${dates[0] || 'n/a'}${untraced ? `, UNTRACED ${untraced}` : ''}`);
  if (!traced.length) console.log('FAIL no research row carries source_endpoint + measured_on');
  if (untraced) console.log(`FAIL ${untraced} research row(s) have no source_endpoint/measured_on - they cannot be traced to a tool call made in THIS project`);
  process.exit(traced.length && !untraced ? 0 : 1);
}
const positional = argv.slice(1).filter(a => !a.startsWith('--') && !isFlagValue(a));
function isFlagValue(a) {
  const i = argv.indexOf(a);
  return i > 0 && argv[i - 1].startsWith('--') && !argv[i - 1].includes('=');
}
function flag(name, dflt = null) {
  const eq = argv.find(a => a.startsWith(`--${name}=`));
  if (eq) return eq.split('=').slice(1).join('=');
  const i = argv.indexOf(`--${name}`);
  if (i >= 0) return argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : 'true';
  return dflt;
}
const ex = p => { try { fs.accessSync(p); return true; } catch { return false; } };
const rd = p => fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
const today = () => new Date().toISOString().slice(0, 10);
const slugify = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

/* ---- credentials: shell env first, then ~/.claude/.env (never printed) ---- */
function creds() {
  let u = process.env.DATAFORSEO_USERNAME, p = process.env.DATAFORSEO_PASSWORD;
  const envFile = path.join(os.homedir(), '.claude', '.env');
  if ((!u || !p) && ex(envFile)) {
    for (const line of rd(envFile).split(/\r?\n/)) {
      const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const v = m[2].replace(/^["']|["']$/g, '');
      if (m[1] === 'DATAFORSEO_USERNAME' && !u) u = v;
      if (m[1] === 'DATAFORSEO_PASSWORD' && !p) p = v;
    }
  }
  if (!u || !p) { console.error('FAIL: DATAFORSEO_USERNAME / DATAFORSEO_PASSWORD not resolvable (shell env or ~/.claude/.env).'); process.exit(1); }
  return 'Basic ' + Buffer.from(`${u}:${p}`).toString('base64');
}
async function post(endpoint, payload) {
  // TRANSPORT NOTE: node's fetch cannot reach the DataForSEO IPv4 pool from this host
  // ("Connect Timeout Error" on every advertised address at undici's 10s connect budget),
  // while curl connects in under a second. Shell out to curl rather than tune undici.
  const { execFileSync } = await import('node:child_process');
  const body = JSON.stringify([payload]);
  let out = null, lastErr = null, cfgFile = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      // SECRET HYGIENE: the credential goes in a 0600 curl config file passed with -K,
      // never in argv — execFileSync copies the whole argv into the Error it throws,
      // and that message gets printed and logged.
      const os = await import('node:os');
      const pathMod = await import('node:path');
      cfgFile = pathMod.join(os.tmpdir(), `dfs-${process.pid}-${Date.now()}.conf`);
      fs.writeFileSync(cfgFile, `header = "Authorization: ${creds()}"
`, { mode: 0o600 });
      out = execFileSync('curl', [
        '-s', '--max-time', '180', '--connect-timeout', '8',
        '--retry', '6', '--retry-delay', '2', '--retry-connrefused', '--retry-all-errors',
        '-K', cfgFile, '-X', 'POST', BASE + endpoint,
        '-H', 'Content-Type: application/json', '--data-binary', '@-'
      ], { input: body, maxBuffer: 256 * 1024 * 1024, encoding: 'utf8' });
      if (out && out.trim()) break;
      lastErr = new Error('empty response');
    } catch (e) {
      // never surface argv/env in an error string: it can carry the credential
      lastErr = new Error(String(e.message || e).replace(/Basic\s+[A-Za-z0-9+/=]+/g, 'Basic <redacted>').split(String.fromCharCode(10))[0].slice(0, 200));
    }
    finally_cleanup: { if (cfgFile) { try { fs.unlinkSync(cfgFile); } catch {} cfgFile = null; } }
    if (attempt < 3) await new Promise(r => setTimeout(r, 2000 * attempt));
  }
  if (!out || !out.trim()) { console.error(`FAIL: ${endpoint} -> ${lastErr && lastErr.message}`); process.exit(1); }
  let parsed = null;
  try { parsed = JSON.parse(out); } catch { console.error(`FAIL: ${endpoint} -> unparseable response`); process.exit(1); }
  if (parsed.status_code >= 40000) {
    console.error(`FAIL: ${endpoint} -> ${parsed.status_code} ${parsed.status_message}`); process.exit(1);
  }
  const task = (parsed.tasks || [])[0];
  if (!task || task.status_code >= 40000) { console.error(`FAIL: ${endpoint} task -> ${task ? task.status_message : 'no task'}`); process.exit(1); }
  return (task.result || [])[0] || {};
}

function saveRaw(kind, seed, data) {
  fs.mkdirSync('research/raw', { recursive: true });
  const p = `research/raw/${kind}-${slugify(seed)}-${today()}.json`;
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
  return p;
}
function loadResearch() {
  if (!ex('research/research.json')) return {};
  try { return JSON.parse(rd('research/research.json')); } catch { return {}; }
}
function saveResearch(obj) {
  fs.mkdirSync('research', { recursive: true });
  fs.writeFileSync('research/research.json', JSON.stringify(obj, null, 2), 'utf8');
}
// A silent default is worse than a missing argument: `--loc` omitted meant every pull
// silently measured the UNITED STATES (2840), and a volume/KD/SERP set for the wrong
// country validates cleanly all the way to a committed blueprint row. There is no
// default; the project's own LOCATION_CODE is read, and its absence is a hard error.
function locationCode() {
  const explicit = flag('loc', '');
  if (explicit) return explicit;
  try {
    const cfg = fs.readFileSync('config/project-config.md', 'utf8');
    const m = cfg.match(/^LOCATION_CODE:\s*(\S+)/m);
    if (m && !/^(n\/a|none|tbd)$/i.test(m[1])) return m[1];
  } catch {}
  console.error('FAIL: pass --loc <location_code> or set LOCATION_CODE in ' +
    'config/project-config.md. There is no default - an unset location silently ' +
    'measured the United States (2840) on every pull.');
  process.exit(1);
}
// The value ACTUALLY SENT, so research.json and the evidence files can record it and
// validate-blueprint can compare the row against the project's own location.
let _locSent = null;
const LANG_SENT = flag('lang', 'en');
function locSent() {
  if (_locSent === null) _locSent = locationCode();
  return _locSent;
}
function loc() {
  const l = locSent();
  return /^\d+$/.test(l) ? { location_code: Number(l) } : { location_name: l };
}
function lang() { return { language_code: LANG_SENT }; }

/* ---- SERP classification ---- */
const FORUM = /(reddit|quora|stackexchange|stackoverflow|forum|discourse|community)\./i;
const MARKET = /(amazon|ebay|etsy|alibaba|walmart|shopee|lazada)\./i;
const VIDEO = /(youtube|vimeo|tiktok)\./i;
const DIRECTORY = /(yelp|yellowpages|clutch|trustpilot|glassdoor|indeed|thumbtack|angi|houzz)\./i;
const GOV = /\.gov(\.|$)|\.gov\.[a-z]{2}$|europa\.eu$/i;
function urlKind(u) {
  let h = '', p = '/';
  try { const x = new URL(u); h = x.hostname; p = x.pathname; } catch { return { domain: u, kind: 'unknown' }; }
  if (FORUM.test(h)) return { domain: h, kind: 'forum' };
  if (MARKET.test(h)) return { domain: h, kind: 'marketplace' };
  if (VIDEO.test(h)) return { domain: h, kind: 'video' };
  if (DIRECTORY.test(h)) return { domain: h, kind: 'directory' };
  if (GOV.test(h)) return { domain: h, kind: 'government' };
  if (p === '/' || p === '') return { domain: h, kind: 'homepage' };
  if (/\/(best|top)[-/]/.test(p)) return { domain: h, kind: 'listicle' };
  if (/(glossary|what-is|definition)/.test(p)) return { domain: h, kind: 'glossary' };
  const depth = p.split('/').filter(Boolean).length;
  return { domain: h, kind: depth <= 1 ? 'hub' : 'dedicated' };
}

async function doSerp() {
  const keyword = positional[0];
  if (!keyword) { console.error('FAIL: usage dfs-pull.mjs serp "<keyword>" --out research/evidence/<slug>.json'); process.exit(1); }
  const depth = Number(flag('depth', '10'));
  const paaDepth = Number(flag('paa', '2'));
  const out = flag('out', `research/evidence/${slugify(keyword)}.json`);
  const result = await post('/serp/google/organic/live/advanced', {
    keyword, ...loc(), ...lang(), depth, people_also_ask_click_depth: paaDepth, calculate_rectangles: false
  });
  const rawPath = saveRaw('serp', keyword, result);
  const items = result.items || [];
  const organic = items.filter(i => i.type === 'organic').slice(0, depth);
  const top10 = organic.map(i => { const k = urlKind(i.url); return { pos: i.rank_absolute, url: i.url, domain: k.domain, type: k.kind }; });
  const features = [];
  const aio = items.find(i => i.type === 'ai_overview');
  let aioCitations = 0;
  if (aio) {
    // `aio.items` are the ANSWER BLOCKS, not the citations; each block carries its
     // own `references[]`. Counting the blocks reported "aio@3" for an overview citing
     // 14 sources, and serp_extract.py already counts it correctly - two instruments,
     // two numbers, for the single most important feature on the modern SERP.
    aioCitations = (aio.references || []).length;
    for (const el of (aio.items || [])) {
      if (el && typeof el === 'object') aioCitations += (el.references || []).length;
    }
    features.push(`aio@${aioCitations}`);
  }
  const packs = items.filter(i => i.type === 'local_pack');
  if (packs.length) {
    const ps = packs.map(i => i.rank_absolute).sort((a, b) => a - b);
    features.push(`local_pack@${ps[0]}-${ps[ps.length - 1]}`);
  }
  const paaBlock = items.find(i => i.type === 'people_also_ask');
  const paa = paaBlock ? (paaBlock.items || []).map((q, n) => ({
    question: q.title, position: n + 1,
    source_url: ((q.expanded_element || [])[0] || {}).url || ''
  })) : [];
  if (paa.length) features.push('paa');
  if (items.some(i => i.type === 'video')) features.push('video');
  if (items.some(i => i.type === 'shopping')) features.push('shopping');
  if (items.some(i => i.type === 'featured_snippet')) features.push('snippet');
  if (items.some(i => i.type === 'carousel')) features.push('carousel');
  const forums = top10.filter(t => t.type === 'forum').length;
  if (forums) features.push(`forum_share@${forums}/${top10.length}`);
  const top3 = top10.slice(0, 3);
  const counts = {};
  for (const t of top3) counts[t.type] = (counts[t.type] || 0) + 1;
  const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const summary = {
    keyword, pulled_at: new Date().toISOString(), measured_on: today(),
    // What was ACTUALLY SENT, not what the caller might have meant: the old line
    // recorded the literal string 'US' whenever --loc was omitted, while the request
    // carried location_code 2840 - so an evidence file could not be checked against
    // the project's own LOCATION_CODE at all.
    location: locSent(), language: LANG_SENT,
    serp_url_format: dominant ? dominant[0] : 'unknown',
    top10, features, aio_citations: aioCitations, paa,
    composition: counts, raw: rawPath
  };
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(summary, null, 2), 'utf8');
  const research = loadResearch();
  research.paa = research.paa || {};
  research.paa[keyword] = paa;
  saveResearch(research);
  console.log(`keyword="${keyword}" evidence=${out} top10=${top10.length} features=${features.join('|') || 'none'} serp_url_format=${summary.serp_url_format} paa=${paa.length}`);
  console.log('SERP_OK');
}

function plurals(kw) {
  const out = new Set([kw]);
  if (/\b(review|guide|service|tool|company|wallet|exchange|course)\b/.test(kw)) out.add(kw.replace(/\b(review|guide|service|tool|company|wallet|exchange|course)\b/, '$1s'));
  if (/s\b/.test(kw)) out.add(kw.replace(/s\b/, ''));
  else out.add(kw + 's');
  return [...out];
}
async function doOverview() {
  const keyword = positional[0];
  if (!keyword) { console.error('FAIL: usage dfs-pull.mjs overview "<keyword>"'); process.exit(1); }
  const list = flag('variants') ? plurals(keyword) : [keyword];
  const result = await post('/dataforseo_labs/google/keyword_overview/live', { keywords: list, ...loc(), ...lang() });
  saveRaw('overview', keyword, result);
  const rows = (result.items || []).map(i => ({
    keyword: i.keyword,
    volume: ((i.keyword_info || {}).search_volume ?? null),
    cpc: ((i.keyword_info || {}).cpc ?? null),
    kd: ((i.keyword_properties || {}).keyword_difficulty ?? null),
    monthly: ((i.keyword_info || {}).monthly_searches || []).map(m => ({ y: m.year, m: m.month, v: m.search_volume }))
  }));
  rows.sort((a, b) => (a.kd ?? 100) - (b.kd ?? 100) || (b.volume ?? 0) - (a.volume ?? 0));
  const research = loadResearch();
  research.keyword_data = research.keyword_data || [];
  for (const r of rows) research.keyword_data.push({ ...r, volume_geo: flag('loc', 'US'), source_endpoint: 'keyword_overview', seed: keyword, pulled_at: today(), measured_on: today() });
  saveResearch(research);
  for (const r of rows) console.log(`${r.keyword}\tvol=${r.volume}\tkd=${r.kd}\tcpc=${r.cpc}`);
  if (rows.length) console.log(`COMMIT="${rows[0].keyword}" (lowest KD; write this exact string into target_keyword)`);
  console.log('OVERVIEW_OK');
}
async function doSuggestions() {
  const seed = flag('seed', positional[0]);
  if (!seed) { console.error('FAIL: usage dfs-pull.mjs suggestions --seed "<phrase>"'); process.exit(1); }
  const result = await post('/dataforseo_labs/google/keyword_suggestions/live', {
    keyword: seed, ...loc(), ...lang(), include_serp_info: false, limit: Number(flag('limit', '300'))
  });
  const p = saveRaw('suggestions', seed, result);
  const items = (result.items || []).map(i => ({
    keyword: i.keyword_data ? i.keyword_data.keyword : i.keyword,
    volume: (((i.keyword_data || {}).keyword_info) || {}).search_volume ?? null,
    cpc: (((i.keyword_data || {}).keyword_info) || {}).cpc ?? null,
    kd: (((i.keyword_data || {}).keyword_properties) || {}).keyword_difficulty ?? null
  }));
  const research = loadResearch();
  research.keyword_data = research.keyword_data || [];
  for (const it of items) research.keyword_data.push({ ...it, volume_geo: flag('loc', 'US'), source_endpoint: 'keyword_suggestions', seed, pulled_at: today(), measured_on: today() });
  saveResearch(research);
  console.log(`seed="${seed}" returned=${items.length} raw=${p}`);
  console.log('SUGGESTIONS_OK');
}
async function doIdeas() {
  const seed = flag('seed', positional[0]);
  const floor = Number(flag('assert-relevance', '0.6'));
  const niche = (flag('niche', '') || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (!seed) { console.error('FAIL: usage dfs-pull.mjs ideas --seed "<phrase>" --assert-relevance 0.6'); process.exit(1); }
  const result = await post('/dataforseo_labs/google/keyword_ideas/live', {
    keywords: [seed], ...loc(), ...lang(), limit: Number(flag('limit', '300'))
  });
  const p = saveRaw('ideas', seed, result);
  const items = (result.items || []).map(i => i.keyword).filter(Boolean);
  const tokens = [...new Set([...seed.toLowerCase().split(/\s+/), ...niche])].filter(t => t.length > 2);
  const hit = items.filter(k => tokens.some(t => k.toLowerCase().includes(t))).length;
  const rel = items.length ? hit / items.length : 0;
  const research = loadResearch();
  research.discards = research.discards || [];
  if (rel < floor) {
    research.discards.push({ endpoint: 'keyword_ideas', seed, discarded: true, reason: `relevance ${rel.toFixed(2)} < ${floor}`, raw: p, date: today() });
    saveResearch(research);
    console.log(`relevance=${rel.toFixed(2)} DISCARDED (floor ${floor}) — fall back to suggestions or hand-written candidates`);
    process.exit(1);
  }
  research.keyword_data = research.keyword_data || [];
  for (const i of (result.items || [])) research.keyword_data.push({
    keyword: i.keyword,
    volume: ((i.keyword_info || {}).search_volume ?? null),
    cpc: ((i.keyword_info || {}).cpc ?? null),
    kd: ((i.keyword_properties || {}).keyword_difficulty ?? null),
    volume_geo: flag('loc', 'US'), source_endpoint: 'keyword_ideas', seed, pulled_at: today(), measured_on: today()
  });
  saveResearch(research);
  console.log(`relevance=${rel.toFixed(2)} PASS returned=${items.length} raw=${p}`);
  console.log('IDEAS_OK');
}
async function doTrend() {
  const keyword = positional[0];
  const result = await post('/dataforseo_labs/google/historical_keyword_data/live', { keywords: [keyword], ...loc(), ...lang() });
  saveRaw('trend', keyword, result);
  const months = [];
  for (const it of (result.items || [])) for (const m of (((it.keyword_info || {}).monthly_searches) || [])) months.push(m);
  months.sort((a, b) => (a.year - b.year) || (a.month - b.month));
  const last12 = months.slice(-12), prev12 = months.slice(-24, -12);
  const sum = a => a.reduce((t, m) => t + (m.search_volume || 0), 0);
  const yoy = prev12.length ? Math.round(100 * (sum(last12) - sum(prev12)) / Math.max(1, sum(prev12))) : 0;
  const peak = last12.length ? last12.slice().sort((a, b) => b.search_volume - a.search_volume).slice(0, 3).map(m => m.month) : [];
  console.log(`keyword="${keyword}" yoy_pct=${yoy > 0 ? '+' + yoy : yoy} peak_months=${peak.join('|')}`);
  console.log('TREND_OK');
}
async function doRd() {
  const targets = positional;
  if (!targets.length) { console.error('FAIL: usage dfs-pull.mjs rd <url> [<url> ...]'); process.exit(1); }
  const result = await post('/backlinks/bulk_referring_domains/live', { targets });
  saveRaw('rd', targets[0], result);
  const items = (result.items || []).map(i => ({ target: i.target, rd: i.referring_domains }));
  const vals = items.map(i => i.rd).filter(n => typeof n === 'number').sort((a, b) => a - b);
  const median = vals.length ? vals[Math.floor(vals.length / 2)] : 0;
  for (const i of items) console.log(`${i.target}\trd=${i.rd}`);
  console.log(`median_top3_rd=${median}`);
  console.log('RD_OK');
}
async function doBacklinks() {
  const target = positional[0];
  const result = await post('/backlinks/summary/live', { target, internal_list_limit: 1, backlinks_status_type: 'live' });
  saveRaw('backlinks', target, result);
  const research = loadResearch();
  research.domain_authority = {
    target, referring_domains: result.referring_domains ?? 0, rank: result.rank ?? 0,
    backlinks: result.backlinks ?? 0, broken_backlinks: result.broken_backlinks ?? 0, pulled_at: today(), measured_on: today()
  };
  saveResearch(research);
  console.log(`target=${target} referring_domains=${research.domain_authority.referring_domains} rank=${research.domain_authority.rank} backlinks=${research.domain_authority.backlinks} broken=${research.domain_authority.broken_backlinks}`);
  console.log('BACKLINKS_OK');
}
async function doAnchors() {
  const target = positional[0];
  const result = await post('/backlinks/anchors/live', { target, limit: 100, backlinks_status_type: 'live' });
  const p = saveRaw('anchors', target, result);
  const items = (result.items || []).slice(0, 20).map(i => `${i.anchor}\t${i.referring_domains}`);
  console.log(items.join('\n'));
  console.log(`raw=${p}`);
  console.log('ANCHORS_OK');
}

const table = { serp: doSerp, overview: doOverview, suggestions: doSuggestions, ideas: doIdeas, trend: doTrend, rd: doRd, backlinks: doBacklinks, anchors: doAnchors };
if (!table[cmd]) { console.error(`FAIL: unknown subcommand "${cmd}". One of: ${Object.keys(table).join(', ')}`); process.exit(1); }
table[cmd]().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
