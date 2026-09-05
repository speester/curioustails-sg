#!/usr/bin/env node
// kit:ga4-events@1.0.0 — the KEY-EVENT SOURCE launch item 18 and CP4's read-back row read.
//
//   node scripts/ga4-events.mjs            declared ∩ emitted, as a markdown table
//   node scripts/ga4-events.mjs --json     the same, as JSON
//   node scripts/ga4-events.mjs --declared print only what the CTA set declares
//
// WHY THIS EXISTS (W8.3). Launch documented `config/forms.json` as the key-event source.
// On a WhatsApp-only site that file does not exist, so the documented step CRASHED; and
// the kit ships `GA4_EVENTS: string[] = []` in src/data/site.ts with nothing to fill it,
// so `src/lib/track.ts` warned on every event name a CTA actually emitted. The result was
// a launch gate row that could be marked PASS with no events configured at all.
//
// DECLARED = the union of:
//   * src/data/site.ts GA4_EVENTS
//   * every `track('<name>'` / `data-ga4-event="<name>"` in src/ — the events the CTAs
//     REALLY emit, which is the set that matters
//   * config/forms.json entries' ga4_event, when that file exists
// EMITTED  = what GA4 has received, read from config/ga4-events-observed.json if the
//   analytics pull has written one (launch's analytics-mcp step). Absent, the emitted
//   column reads `-` and the gate still fails on an EMPTY declared set.
//
// Exit 1 when nothing is declared: a site with no key event has no measurable conversion,
// and "GA4 verified" over an empty event set is the row this file exists to stop.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env.PROJECT_ROOT || process.cwd();
const argv = process.argv.slice(2);
const KNOWN = ['--json', '--declared', '--help', '-h'];
const unknown = argv.filter((a) => !KNOWN.includes(a));
if (unknown.length) {
  console.error(`FAIL unknown flag(s): ${unknown.join(' ')} — known: ${KNOWN.join(' ')}`);
  process.exit(2);
}
if (argv.includes('--help') || argv.includes('-h')) {
  console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n')
    .filter((l) => l.startsWith('//')).join('\n'));
  process.exit(0);
}

const read = (p) => {
  try { return fs.readFileSync(path.join(ROOT, p), 'utf8'); } catch { return ''; }
};

function walk(dir, out = []) {
  let entries = [];
  try { entries = fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) walk(rel, out);
    else if (/\.(astro|ts|tsx|js|mjs)$/.test(e.name)) out.push(rel);
  }
  return out;
}

const declared = new Set();

// 1. the declared list in src/data/site.ts
const site = read('src/data/site.ts');
const m = site.match(/GA4_EVENTS[^=]*=\s*\[([\s\S]*?)\]/);
if (m) for (const q of m[1].matchAll(/['"`]([\w.-]+)['"`]/g)) declared.add(q[1]);

// 2. what the CTAs actually emit
for (const f of walk('src')) {
  const text = read(f);
  for (const q of text.matchAll(/\btrack\(\s*['"`]([\w.-]+)['"`]/g)) declared.add(q[1]);
  for (const q of text.matchAll(/data-ga4-event=["']([\w.-]+)["']/g)) declared.add(q[1]);
}

// 3. the form registry, when there is one
try {
  const forms = JSON.parse(read('config/forms.json') || '{}');
  const rows = Array.isArray(forms) ? forms : (forms.forms ?? forms.routes ?? []);
  for (const r of rows) if (r && r.ga4_event) declared.add(r.ga4_event);
} catch { /* a WhatsApp-only site has no forms.json — that is not an error */ }

let observed = {};
try {
  observed = JSON.parse(read('config/ga4-events-observed.json') || '{}');
} catch { observed = {}; }
const counts = observed.events ?? observed;

const rows = [...declared].sort().map((name) => ({
  event: name,
  count: typeof counts[name] === 'number' ? counts[name] : null,
}));

if (argv.includes('--json')) {
  console.log(JSON.stringify({ declared: [...declared].sort(), rows }, null, 2));
} else {
  console.log('| eventName | eventCount |');
  console.log('|---|---|');
  for (const r of rows) console.log(`| ${r.event} | ${r.count === null ? '-' : r.count} |`);
}

const live = rows.filter((r) => r.count !== null && r.count > 0);
const silent = rows.filter((r) => r.count === 0);
console.log(`ga4-events: declared=${rows.length} observed=${live.length} silent=${silent.length}`);
if (!rows.length) {
  console.log('FAIL no GA4 key event is declared anywhere (src/data/site.ts GA4_EVENTS, a '
    + "track('…') call, a data-ga4-event attribute, or config/forms.json). A site with no "
    + 'key event has no measurable conversion — launch item 18 cannot pass.');
  process.exit(1);
}
for (const r of silent) {
  console.log(`FAIL ${r.event}: declared but GA4 has received 0 — an unproven conversion path`);
}
process.exit(silent.length ? 1 : 0);
