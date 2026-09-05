#!/usr/bin/env node
/**
 * serp-overlap.mjs — measure top-10 URL overlap between blueprint rows.
 *
 *   node scripts/serp-overlap.mjs /a/ /b/        one pair
 *   node scripts/serp-overlap.mjs --all          every pair sharing a head noun
 *
 * Writes research/serp-overlap.json. Exit 1 when a pair at or above the threshold still has
 * two live rows (no merged_into). Node 20+, stdlib only.
 */
import fs from 'node:fs';
import { parseCsv } from './lib/csv.mjs';   // the ONE RFC-4180 parser (Task G1.2 Step 2b)

const THRESHOLD = Number((process.argv.find(a => a.startsWith('--threshold=')) || '--threshold=0.40').split('=')[1]);
const ALL = process.argv.includes('--all');
const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const CSV = 'research/site-blueprint.csv';
const ex = p => { try { fs.accessSync(p); return true; } catch { return false; } };
const rd = p => fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
if (!ex(CSV)) { console.error(`FAIL: ${CSV} missing.`); process.exit(1); }

/* RFC-4180: IMPORTED from ./lib/csv.mjs (Task G1.2 Step 2b) — ONE parser, ONE behaviour.
   parseCsv() returns [{cells, quoted}]; this script needs only the cells. Re-declaring a
   second parser here, or splitting on ',', is the CONS2-12 / curio-2.7 defect. */
const table = parseCsv(rd(CSV)).map((r) => r.cells);
const head = table[0];
const rows = table.slice(1).map(cells => Object.fromEntries(head.map((h, i) => [h, (cells[i] || '').trim()])));
const bySlug = new Map(rows.map(r => [r.url_slug, r]));

const canon = u => { try { const x = new URL(u); return (x.hostname.replace(/^www\./, '') + x.pathname.replace(/\/$/, '')).toLowerCase(); } catch { return String(u).toLowerCase(); } };
function top10(row) {
  if (!row || !row.serp_evidence || !ex(row.serp_evidence)) return null;
  try { return new Set((JSON.parse(rd(row.serp_evidence)).top10 || []).map(t => canon(t.url))); } catch { return null; }
}
const headNoun = kw => (String(kw).toLowerCase().match(/[a-z0-9']+/g) || []).slice(-1)[0] || '';

// PAIRING. Matching on the LAST WORD alone missed the cannibalisation this instrument
// exists to find: "hdb renovation cost" vs "bto renovation packages" share no head noun
// and compete for the same ten results. Four widened rules, any of which pairs two rows.
const STOP = new Set(['the','a','an','in','for','of','to','and','or','my','your','best',
                      'near','me','singapore','sg','cost','price']);
const SYNONYMS = [
  ['cost', 'price', 'prices', 'pricing', 'rates', 'fees', 'charges'],
  ['best', 'top', 'leading'],
  ['review', 'reviews', 'vs', 'comparison', 'compare', 'alternatives'],
  ['company', 'companies', 'contractor', 'contractors', 'service', 'services'],
];
const synGroup = (t) => SYNONYMS.findIndex(g => g.includes(t));
const tokens = (kw) => (String(kw).toLowerCase().match(/[a-z0-9']+/g) || []);
const contentTokens = (kw) => tokens(kw).filter(t => !STOP.has(t));
function tokenOverlap(a, b) {
  const A = new Set(contentTokens(a)), B = new Set(contentTokens(b));
  if (!A.size || !B.size) return 0;
  const shared = [...A].filter(t => B.has(t)).length;
  return shared / Math.min(A.size, B.size);
}
function synonymPair(a, b) {
  const ga = tokens(a).map(synGroup).filter(g => g >= 0);
  const gb = tokens(b).map(synGroup).filter(g => g >= 0);
  return ga.some(g => gb.includes(g));
}

let pairs = [];
if (ALL) {
  const live = rows.filter(r => r.target_keyword && !r.merged_into);
  for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
    const a = live[i], b = live[j];
    const share = headNoun(a.target_keyword) && headNoun(a.target_keyword) === headNoun(b.target_keyword);
    const sub = a.title && b.title && (a.title.toLowerCase().includes(b.title.toLowerCase()) || b.title.toLowerCase().includes(a.title.toLowerCase()));
    // (a) same intent AND same silo - two rows written for the same searcher
    const sameIntentSilo = a.serp_intent && a.serp_intent === b.serp_intent &&
                           a.silo && a.silo === b.silo;
    // (b) any shared non-stopword token
    const tokenShare = tokenOverlap(a.target_keyword, b.target_keyword) > 0;
    // (c) synonym families (cost|price|rates, best|top, review|vs|comparison)
    const syn = synonymPair(a.target_keyword, b.target_keyword) &&
                tokenOverlap(a.target_keyword, b.target_keyword) > 0;
    if (share || sub || sameIntentSilo || tokenShare || syn) pairs.push([a, b]);
  }
  // The measurement floor: two rows with the SAME intent and >=50% token overlap are a
  // collision until measured. Reporting them as "not paired" is how a cannibalising
  // pair leaves the run with no entry in serp-overlap.json at all.
  for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
    const a = live[i], b = live[j];
    if (a.serp_intent && a.serp_intent === b.serp_intent &&
        tokenOverlap(a.target_keyword, b.target_keyword) >= 0.5 &&
        !pairs.some(([x, y]) => x === a && y === b)) {
      pairs.push([a, b]);
    }
  }
} else {
  if (args.length !== 2) { console.error('FAIL: usage serp-overlap.mjs <slugA> <slugB> | --all'); process.exit(1); }
  pairs = [[bySlug.get(args[0]), bySlug.get(args[1])]];
  if (!pairs[0][0] || !pairs[0][1]) { console.error('FAIL: one of the slugs is not a blueprint row.'); process.exit(1); }
}

const out = { threshold: THRESHOLD, generated_at: new Date().toISOString(), pairs: [] };
let unmerged = 0, skipped = 0;
console.log('pair'.padEnd(56) + 'overlap'.padEnd(10) + 'result');
console.log('-'.repeat(80));
for (const [a, b] of pairs) {
  const A = top10(a), B = top10(b);
  if (!A || !B) { skipped++; console.log(`${(a.url_slug + ' + ' + b.url_slug).padEnd(56)}${'-'.padEnd(10)}SKIP (missing evidence)`); continue; }
  const shared = [...A].filter(u => B.has(u));
  const overlap = shared.length / Math.max(1, Math.min(A.size, B.size));
  const over = overlap >= THRESHOLD;
  const merged = a.merged_into || b.merged_into;
  if (over && !merged) unmerged++;
  out.pairs.push({ a: a.url_slug, b: b.url_slug, overlap: Number(overlap.toFixed(2)), shared });
  console.log(`${(a.url_slug + ' + ' + b.url_slug).padEnd(56)}${(Math.round(overlap * 100) + '%').padEnd(10)}${over ? (merged ? 'MERGED' : 'FAIL — merge into one page') : 'PASS'}`);
}
fs.mkdirSync('research', { recursive: true });
fs.writeFileSync('research/serp-overlap.json', JSON.stringify(out, null, 2), 'utf8');
console.log(`\npairs_checked=${out.pairs.length} pairs_over_threshold_unmerged=${unmerged} skipped_missing_evidence=${skipped}`);
process.exit(unmerged || skipped ? 1 : 0);
