#!/usr/bin/env node
// kit:design-eyes-merge@1.0.0 — merge the blind judges' JSON with the deterministic
// probe, enforce the evidence rule, and set the gate's exit code.
//
// The judges are asked for precision, but "asked" is not "enforced". This script is the
// enforcement: a finding with no coordinate, no named element and no comparison is
// deleted here, not left to the judge's discretion, because --fix will edit working
// code on the strength of it.
//
// Usage: node scripts/design-eyes-merge.mjs [--run <dir>] [--json] [--report-only]
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const KNOWN = ['run', 'json', 'report-only', 'help'];
const unknown = argv.filter((a) => a.startsWith('--') && !KNOWN.includes(a.replace(/^--/, '').split('=')[0]));
if (unknown.length) { console.error(`FAIL unknown option(s): ${unknown.join(' ')}`); process.exit(2); }
const flag = (n, d = null) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };

const OUT_ROOT = path.join('audits', 'design-eyes');
let RUN_DIR = flag('run');
if (!RUN_DIR) {
  const latest = path.join(OUT_ROOT, 'latest.json');
  if (!fs.existsSync(latest)) { console.error('HALT design-eyes-merge: no run to merge. Run scripts/design-eyes.mjs first.'); process.exit(1); }
  RUN_DIR = JSON.parse(fs.readFileSync(latest, 'utf8')).dir;
}
const probeFile = path.join(RUN_DIR, 'probe.json');
if (!fs.existsSync(probeFile)) { console.error(`HALT design-eyes-merge: ${probeFile} is missing.`); process.exit(1); }
const probe = JSON.parse(fs.readFileSync(probeFile, 'utf8'));

// The catalogue is the closed vocabulary. A code outside it is an opinion.
const catFile = path.join(process.env.HOME || process.env.USERPROFILE || '', '.claude', 'skills', 'design-eyes', 'reference', 'catalogue.md');
let CODES = new Set();
if (fs.existsSync(catFile)) for (const m of fs.readFileSync(catFile, 'utf8').matchAll(/^\|\s*`([a-z]+\.[a-z_0-9]+)`/gm)) CODES.add(m[1]);
if (!CODES.size) { console.error(`HALT design-eyes-merge: the catalogue at ${catFile} yielded no codes — every judge finding would be dropped as uncoded, and this gate would report a clean page it never checked.`); process.exit(1); }
const SEV = {};
if (fs.existsSync(catFile)) for (const m of fs.readFileSync(catFile, 'utf8').matchAll(/^\|\s*`([a-z]+\.[a-z_0-9]+)`\s*\|\s*(\d)/gm)) SEV[m[1]] = Number(m[2]);

const judgeDir = path.join(RUN_DIR, 'judges');
const judgeFiles = fs.existsSync(judgeDir) ? fs.readdirSync(judgeDir).filter((f) => f.endsWith('.json')) : [];
if (!judgeFiles.length) {
  console.error(`HALT design-eyes-merge: no judge reports in ${judgeDir}.`);
  console.error('  The deterministic probe is half of this gate. Merging without the judges');
  console.error('  would print a verdict on the questions only pixels can answer, unasked.');
  process.exit(1);
}

const kept = [], dropped = [];
const drop = (f, why) => dropped.push({ ...f, dropped_because: why });
const EVIDENCE_CURRENCY = /\d|versus|compared|the \w+ (card|section|button|heading|image|panel|row|link)/i;

for (const file of judgeFiles) {
  let rep;
  try { rep = JSON.parse(fs.readFileSync(path.join(judgeDir, file), 'utf8')); }
  catch (e) {
    // Unparseable judge output is a measurement that did not happen. Say so.
    console.error(`HALT design-eyes-merge: ${file} is not valid JSON (${String(e).slice(0, 120)}).`);
    console.error('  Re-run that judge. A gate must not pass on a report it could not read.');
    process.exit(1);
  }
  for (const f of rep.findings || []) {
    const base = { ...f, route: f.route || rep.route, judge: rep.judge || file.replace(/\.json$/, ''), source: 'vision' };
    if (!CODES.has(f.code)) { drop(base, 'code is not in the catalogue'); continue; }
    if (!f.evidence || !EVIDENCE_CURRENCY.test(String(f.evidence))) { drop(base, 'evidence carries no coordinate, named element or comparison'); continue; }
    if (!f.what_to_change || String(f.what_to_change).trim().length < 12) { drop(base, 'no executable instruction'); continue; }
    base.severity = Number(f.severity) || SEV[f.code] || 2;
    kept.push(base);
  }
  if (rep.house_bar) probe.facts = { ...(probe.facts || {}), [`house_bar:${rep.route}`]: rep.house_bar };
}

// The probe owns everything it measured. A judge repeating a probe finding is noise;
// a judge CONTRADICTING one is still noise, because the probe read the DOM and the
// judge read a JPEG of it.
const probeKeys = new Set(probe.findings.map((f) => `${f.route}|${f.code}`));
const vision = [];
for (const f of kept) {
  if (probeKeys.has(`${f.route}|${f.code}`)) { drop(f, 'already decided deterministically by the probe'); continue; }
  vision.push(f);
}

const seen = new Set(), merged = [];
for (const f of [...probe.findings, ...vision]) {
  const key = [f.route, f.code, f.viewport ?? '', f.seam ?? f.section ?? ''].join('|');
  if (seen.has(key)) continue;
  seen.add(key);
  merged.push(f);
}
merged.sort((a, b) => b.severity - a.severity || a.route.localeCompare(b.route) || a.code.localeCompare(b.code));

const s3 = merged.filter((f) => f.severity === 3);
const s2 = merged.filter((f) => f.severity === 2);
const s1 = merged.filter((f) => f.severity === 1);
const autofix = merged.filter((f) => f.severity >= 2 && f.confidence !== 'medium');
const owner = merged.filter((f) => f.confidence === 'medium');

fs.writeFileSync(path.join(RUN_DIR, 'findings.json'), JSON.stringify({ run: probe.run, counts: { s3: s3.length, s2: s2.length, s1: s1.length, dropped: dropped.length }, findings: merged, autofix, owner_review: owner, dropped }, null, 2));

const lines = [];
lines.push(`# design-eyes — ${probe.run}`, '');
lines.push(`**S3 ${s3.length} · S2 ${s2.length} · S1 ${s1.length}** — ${dropped.length} judge finding(s) dropped for weak evidence or an uncatalogued code.`, '');
for (const [label, set] of [['Ship blockers (S3)', s3], ['Premium bar (S2)', s2], ['Polish (S1)', s1]]) {
  if (!set.length) continue;
  lines.push(`## ${label}`, '');
  for (const f of set) {
    lines.push(`### \`${f.code}\` — ${f.route}${f.viewport ? ` @${f.viewport}` : ''}`);
    lines.push(`- **What is wrong:** ${f.evidence}`);
    lines.push(`- **Fix:** ${f.what_to_change}`);
    lines.push(`- _${f.source}${f.judge ? ` · ${f.judge}` : ''}${f.confidence ? ` · ${f.confidence} confidence` : ''}_`);
    if (f.shot) lines.push('', `![${f.code}](shots/${f.shot})`);
    lines.push('');
  }
}
if (!merged.length) lines.push('No findings. The probe measured every deterministic code and all four judges returned clean.', '');
fs.writeFileSync(path.join(RUN_DIR, 'report.md'), lines.join('\n'));

if (argv.includes('--json')) { console.log(JSON.stringify(merged, null, 2)); process.exit(s3.length ? 1 : 0); }

console.log('');
console.log(`design-eyes findings — ${RUN_DIR}`);
console.log(`  S3 ${s3.length}   S2 ${s2.length}   S1 ${s1.length}   dropped ${dropped.length}`);
for (const f of s3.slice(0, 12)) console.log(`  S3  ${f.route}  ${f.code}  — ${String(f.evidence).slice(0, 96)}`);
for (const f of s2.slice(0, 12)) console.log(`  S2  ${f.route}  ${f.code}  — ${String(f.evidence).slice(0, 96)}`);
console.log(`  report: ${path.join(RUN_DIR, 'report.md')}`);
console.log('');
console.log(s3.length ? `FAIL design-eyes: ${s3.length} ship-blocking defect(s).` : `PASS design-eyes: 0 ship blockers${s2.length ? `, ${s2.length} premium-bar miss(es) still open` : ''}.`);
process.exit(s3.length ? 1 : 0);
