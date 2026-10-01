#!/usr/bin/env node
// WhatsApp button-text A/B report.
//
//   node scripts/wa-ab-report.mjs            # reads reports/wa-ab-input.json
//   node scripts/wa-ab-report.mjs input.json # explicit input
//
// INPUT (reports/wa-ab-input.json) — filled from a GA4 pull (analytics MCP or
// the Data API), one row per variant seen in the window:
//   {
//     "window": "2026-09-28 .. 2026-10-26",
//     "variants": [
//       { "id": "ask",       "label": "Ask about this puppy",              "sessions": 1200, "clicks": 96 },
//       { "id": "available", "label": "Check if this puppy is available",  "sessions": 1180, "clicks": 121 }
//     ]
//   }
// `sessions` = sessions on pages that show the button during THAT variant's
// blocks; `clicks` = whatsapp_click count with wa_variant == id. If wa_variant
// is not yet a registered GA4 dimension, split by date-block instead (each
// 14-day block maps to one variant — see src/data/wa-experiment.ts).
//
// OUTPUT: reports/wa-ab-report.md — variants ranked by conversion rate, lift vs
// the control ("ask"), and a plain-English confidence note (two-proportion
// z-test). Exit 0 always; it reports, it does not gate.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const IN = process.argv[2] || 'reports/wa-ab-input.json';
if (!existsSync(IN)) {
  console.error(`no input at ${IN} — fill it from a GA4 pull (see the header).`);
  process.exit(0);
}
const data = JSON.parse(readFileSync(IN, 'utf8'));
const rows = (data.variants || []).filter((v) => v.sessions > 0);
if (rows.length === 0) { console.error('no variant rows with sessions'); process.exit(0); }

const cvr = (v) => v.clicks / v.sessions;
for (const v of rows) v.cvr = cvr(v);
const control = rows.find((v) => v.id === 'ask') || rows[0];
rows.sort((a, b) => b.cvr - a.cvr);

// Two-proportion z-test vs control → approximate two-sided p-value.
const erf = (x) => {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
};
const pValue = (a, b) => {
  if (a === b) return 1;
  const p = (a.clicks + b.clicks) / (a.sessions + b.sessions);
  const se = Math.sqrt(p * (1 - p) * (1 / a.sessions + 1 / b.sessions));
  if (se === 0) return 1;
  const z = Math.abs(a.cvr - b.cvr) / se;
  return 2 * (1 - 0.5 * (1 + erf(z / Math.SQRT2)));
};

const pct = (x) => (x * 100).toFixed(2) + '%';
const lines = [];
lines.push('# WhatsApp Button A/B Report');
lines.push('');
lines.push(`Window: **${data.window || 'unspecified'}** · generated ${new Date().toISOString().slice(0, 10)}`);
lines.push('');
lines.push('| Rank | Variant | Label | Sessions | Clicks | CVR | Lift vs control | Signal |');
lines.push('|---:|---|---|---:|---:|---:|---:|---|');
rows.forEach((v, i) => {
  const lift = v.id === control.id ? '—' : ((v.cvr / control.cvr - 1) * 100).toFixed(1) + '%';
  let signal = v.id === control.id ? 'control' : '';
  if (v.id !== control.id) {
    const p = pValue(v, control);
    signal = p < 0.05 ? `significant (p=${p.toFixed(3)})`
      : v.clicks < 30 || control.clicks < 30 ? 'too few clicks yet'
      : `not yet significant (p=${p.toFixed(2)})`;
  }
  lines.push(`| ${i + 1} | \`${v.id}\` | ${v.label || ''} | ${v.sessions} | ${v.clicks} | ${pct(v.cvr)} | ${lift} | ${signal} |`);
});
lines.push('');
const winner = rows[0];
const totalClicks = rows.reduce((n, v) => n + v.clicks, 0);
lines.push(`**Leader:** \`${winner.id}\` — "${winner.label || ''}" at ${pct(winner.cvr)}.`);
if (totalClicks < 60) lines.push(`\n> Only ${totalClicks} clicks across all variants — keep running; judge a variant once it has ~30+ clicks of its own.`);
lines.push('');
lines.push('_Method: two-proportion z-test of whatsapp_click / session vs the `ask` control. "Significant" = p < 0.05._');

const OUT = 'reports/wa-ab-report.md';
writeFileSync(OUT, lines.join('\n') + '\n');
console.log(`wrote ${OUT}`);
console.log(lines.join('\n'));
