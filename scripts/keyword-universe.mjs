#!/usr/bin/env node
/**
 * keyword-universe.mjs — apply the exclusion table to research.json.keyword_data, write
 * research/keyword_universe.md (with the rules PRINTED) and append every drop to
 * research/cancelled-targets.md.
 *
 *   node scripts/keyword-universe.mjs [--acronyms ev,ac,db] [--careers-silo] [--dry-run]
 *
 * Exit 0 = universe written. Exit 1 = no research.json / no keyword_data / zero survivors.
 * Node 20+, stdlib only.
 */
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const flag = (n, d = null) => {
  const eq = argv.find(a => a.startsWith(`--${n}=`)); if (eq) return eq.split('=').slice(1).join('=');
  const i = argv.indexOf(`--${n}`); return i >= 0 ? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : 'true') : d;
};
const ex = p => { try { fs.accessSync(p); return true; } catch { return false; } };
const rd = p => fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
const today = new Date().toISOString().slice(0, 10);

if (!ex('research/research.json')) { console.error('FAIL: research/research.json missing — run dfs-pull first.'); process.exit(1); }
const research = JSON.parse(rd('research/research.json'));
const data = research.keyword_data || [];
if (!data.length) { console.error('FAIL: research.json.keyword_data is empty.'); process.exit(1); }

const cfgText = ex('config/project-config.md') ? rd('config/project-config.md') : '';
const cfg = k => { const m = cfgText.match(new RegExp('^\\s*[-*]?\\s*`?' + k + '`?\\s*[:=]\\s*(.+?)\\s*$', 'mi')); return m ? m[1].replace(/^["'`]|["'`]$/g, '').trim() : ''; };
const ARCHETYPE = cfg('SITE_ARCHETYPE');
const GEO = cfg('GEO') || cfg('COUNTRY');
const careersSilo = flag('careers-silo') === 'true';
const acronyms = (flag('acronyms', '') || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

const RULES = [
  ['brand-navigational', /\b(comcast|verizon|login|log in|sign in|portal|my ?account|dashboard|customer service number)\b/i, 'brand / navigational lookup — excluded from demand totals'],
  ['employment', /\b(jobs?|vacanc(y|ies)|salary|salaries|hiring|apprentice|career|courses?|training|certificate|certification|how to become)\b/i, careersSilo ? 'kept (careers IS a silo here)' : 'jobseeker / student intent, not buyer intent'],
  ['academic', /\b(answer key|worksheet|quizlet|textbook|lecture notes|syllabus|apa|mla|citation)\b/i, 'academic / answer-key intent'],
  ['retail-parts', /\b(spare parts?|replacement parts?|for sale used|used .* for sale|parts diagram)\b/i, 'retail purchase of components, not the service/product this site sells'],
  ['tool-template', /\b(template|generator|calculator|checklist pdf|printable)\b/i, ARCHETYPE === 'national-publisher' ? 'tool/template page an editorial site cannot own' : 'kept (only excluded on editorial sites)'],
  ['near-me-nonlocal', /\bnear me\b/i, ARCHETYPE && ARCHETYPE !== 'local-service' ? 'local pack term this archetype cannot win' : 'kept (local-service archetype)'],
  ['locale-spelling', /\b(colour|realise|organis(e|ation)|tyre)\b/i, GEO && /^(US|us)$/.test(GEO) ? 'other-locale spelling for this GEO' : 'kept (matches this GEO)'],
  // The mirror. Only the en-GB spellings were filtered, so a US keyword set shipped
  // clean and every en-GB/en-SG/en-AU set kept the US spellings it must not rank for.
  ['locale-spelling-us', /\b(color|organiz(e|ation)|tires?|aging|center|behavior|favor)\b/i, GEO && !/^(US|us)$/.test(GEO) ? 'US spelling for this GEO' : 'kept (matches this GEO)']
];
const ACRONYM_SENSES = { ev: /\b(electron ?volt|physics)\b/i, ac: /\b(alternating current|air ?condition)\b/i, db: /\b(decibel|database)\b/i, led: /\b(light emitting diode physics)\b/i, pv: /\b(photovoltaic physics|present value)\b/i };

const kept = [], dropped = [];
const seen = new Set();
for (const row of data) {
  const kw = String(row.keyword || '').trim();
  if (!kw || seen.has(kw.toLowerCase())) continue;
  seen.add(kw.toLowerCase());
  let hit = null;
  for (const [name, re, note] of RULES) {
    if (/^kept/.test(note)) continue;
    if (re.test(kw)) { hit = { rule: name, note }; break; }
  }
  if (!hit) for (const a of acronyms) {
    const sense = ACRONYM_SENSES[a];
    if (sense && new RegExp(`\\b${a}\\b`, 'i').test(kw) && sense.test(kw)) { hit = { rule: 'acronym-collision', note: `"${a}" resolves to the wrong sense` }; break; }
  }
  if (hit) dropped.push({ ...row, keyword: kw, ...hit }); else kept.push({ ...row, keyword: kw });
}

/* ---- keyword_universe.md ---- */
let md = `# Keyword universe (generated ${today})\n\nGEO=${GEO || 'unset'} archetype=${ARCHETYPE || 'unset'} raw=${data.length} kept=${kept.length} dropped=${dropped.length}\n\n`;
md += '## Exclusion rules applied\n\n| rule | regex | effect |\n|---|---|---|\n';
for (const [name, re, note] of RULES) md += `| ${name} | \`${re.source}\` | ${note} |\n`;
for (const a of acronyms) md += `| acronym-collision:${a} | \`\\b${a}\\b\` + wrong-sense test | dropped when the wrong sense appears |\n`;
md += '\n## Kept keywords\n\n| keyword | volume | volume_geo | kd | cpc | source_endpoint | seed |\n|---|---|---|---|---|---|---|\n';
for (const k of kept.sort((a, b) => (b.volume || 0) - (a.volume || 0)))
  md += `| ${k.keyword} | ${k.volume ?? ''} | ${k.volume_geo ?? ''} | ${k.kd ?? ''} | ${k.cpc ?? ''} | ${k.source_endpoint ?? ''} | ${k.seed ?? ''} |\n`;
md += '\n## Dropped keywords (see research/cancelled-targets.md for the log)\n\n| keyword | rule | why |\n|---|---|---|\n';
for (const d of dropped) md += `| ${d.keyword} | ${d.rule} | ${d.note} |\n`;
if (flag('dry-run') !== 'true') {
  fs.mkdirSync('research', { recursive: true });
  fs.writeFileSync('research/keyword_universe.md', md, 'utf8');
}

/* ---- cancelled-targets.md (append-only) ---- */
const HEAD = '| keyword | volume | kd | yoy_pct | serp_intent | serp composition / evidence path | reason | date |\n|---|---|---|---|---|---|---|---|\n';
let log = ex('research/cancelled-targets.md') ? rd('research/cancelled-targets.md') : `# Cancelled targets — every candidate considered and not committed\n\n${HEAD}`;
if (!log.includes('| keyword |')) log += '\n' + HEAD;
const already = new Set([...log.matchAll(/^\|\s*([^|]+?)\s*\|/gm)].map(m => m[1].toLowerCase()));
let appended = 0;
for (const d of dropped) {
  if (already.has(d.keyword.toLowerCase())) continue;
  log += `| ${d.keyword} | ${d.volume ?? ''} | ${d.kd ?? ''} | ${d.yoy_pct ?? ''} | ${d.serp_intent ?? ''} | ${d.evidence ?? ''} | contamination:${d.rule} | ${today} |\n`;
  appended++;
}
for (const dc of (research.discards || [])) {
  const key = `discard:${dc.seed}`;
  if (already.has(key.toLowerCase())) continue;
  log += `| ${key} | | | | | ${dc.raw || ''} | relevance-discard (${dc.reason}) | ${dc.date || today} |\n`;
  appended++;
}
if (flag('dry-run') !== 'true') fs.writeFileSync('research/cancelled-targets.md', log, 'utf8');

/* ---- report ---- */
const rows = [
  ['research.json.keyword_data loaded', data.length, data.length ? 'PASS' : 'FAIL'],
  ['exclusion rules printed', RULES.length + acronyms.length, RULES.length >= 6 ? 'PASS' : 'FAIL'],
  ['keywords kept', kept.length, kept.length ? 'PASS' : 'FAIL'],
  ['keywords dropped + logged', `${dropped.length} (+${appended} new log rows)`, 'PASS'],
  ['raw payloads on disk', ex('research/raw') ? fs.readdirSync('research/raw').length : 0, ex('research/raw') ? 'PASS' : 'FAIL']
];
console.log('check'.padEnd(38) + 'value'.padEnd(24) + 'result');
console.log('-'.repeat(74));
for (const [n, v, r] of rows) console.log(String(n).padEnd(38) + String(v).padEnd(24) + r);
const failed = rows.filter(r => r[2] === 'FAIL').length;
console.log(failed ? 'UNIVERSE_FAIL' : 'UNIVERSE_OK');
process.exit(failed ? 1 : 0);
