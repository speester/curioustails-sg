#!/usr/bin/env node
// check-quotes.mjs - expert quotes rendered in dist/: presence, duplicates,
// verify:true leaks, registry resolution.
// Usage: node scripts/check-quotes.mjs [--dupes] [--sources]
//
// --sources: FETCH every rendered quote's source_url (HEAD, then GET on 405/501) and
// require the credential string to appear verbatim in the bank row, whose
// `last verified` date must be set. content-writer's SOURCES RULE promised this for
// months; what ran was a presence check on the bank file. An expert quote whose source
// 404s is an E-E-A-T signal that inverts the moment anyone clicks it, and OMIT is
// always a valid outcome for a quote that cannot be verified.
// Exit 0 clean, 1 on any failure. Node 20 built-ins only.
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.env.PROJECT_ROOT || process.cwd();
const DIST = join(ROOT, 'dist');
const BANK_DIR = join(ROOT, 'config', 'sme', 'quotes');
// contracts §3: ONE predicate, shared with verify_page.py / audit_built_html.py /
// ledger.py. This file used to carry its own five-name route regex, which is why
// /about/ and /contact/ failed here and passed there.
import { exemptionFor, EXEMPT, PARTIAL } from './lib/exemptions.mjs';
const quoteExempt = (route) => {
  // exemptionFor reads the BLUEPRINT ROW (page_tier / brief_depth / target_keyword) too;
  // the route-only call graded utility rows that letters (h)/(n) treat as exempt.
  const state = exemptionFor(route, 'QUOTE_EXEMPT_ROUTES');
  // PARTIAL (/contact/) owes a figure, never a quote.
  return state === EXEMPT || state === PARTIAL;
};
// Never fold the experts index into its own input.
const EXCLUDE = /(^|[\\/])experts([\\/]|$)/;

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    statSync(p).isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
}
const norm = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ')
  .replace(/\s+/g, ' ').trim().toLowerCase();

// CONS-10: quotes live in the DIRECTORY config/sme/quotes/*.json (one file per category)
const bank = existsSync(BANK_DIR)
  ? readdirSync(BANK_DIR).filter((f) => f.endsWith('.json'))
      .flatMap((f) => { const j = JSON.parse(readFileSync(join(BANK_DIR, f), 'utf8')); return Array.isArray(j) ? j : (j.quotes || []); })
  : [];
const bankById = new Map(bank.map((q) => [String(q.id), q]));
const bankText = new Set(bank.map((q) => norm(String(q.quote || ''))));
const verifyTrue = new Set(bank.filter((q) => q.verify === true).map((q) => String(q.id)));


// SHELL SKIP: PLACEHOLDER-COPY + draft=true src pages are declared shells; the quote
// requirement binds when content-writer authors the page (Stage-3 exit re-runs this).
const SHELLS = new Set();
try {
  const w = (d, out = []) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = `${d}/${e.name}`; if (e.isDirectory()) w(p, out); else if (e.name.endsWith('.astro')) out.push(p); } return out; };
  for (const p of w('src/pages')) {
    const t = readFileSync(p, 'utf8');
    if (t.includes('PLACEHOLDER-COPY') && /draft\s*=\s*true/.test(t)) {
      let r = p.split(String.fromCharCode(92)).join('/').replace(/^src\/pages\//, '').replace(/\.astro$/, '');
      if (r === 'index') r = 'index'; SHELLS.add(r);
    }
  }
} catch {}
const pages = walk(DIST).filter((f) => f.endsWith(`${sep}index.html`));
// A gate that measures nothing must never report PASS. With no dist/ (wrong cwd, or
// run before `astro build`) every counter below is 0 and this exited 0, so Stage-3
// exit-gate item (e) went green on an empty tree - and (e) has no second instrument
// to catch it, because `grep -L`'s exit code is unusable as a gate.
if (!pages.length) {
  console.log(`HALT: no dist/**/index.html - run \`npm run build\` first, or set PROJECT_ROOT (looked in ${DIST})`);
  process.exit(1);
}
// Unknown flags are REFUSED: --dupes was documented for months and read by
// nothing, so stage-3-toolkit's post-fan-out duplicate scan ran the DEFAULT check
// and reported success.
const KNOWN_FLAGS = new Set(['--sources', '--dupes']);
const unknownFlags = process.argv.slice(2).filter((a) => a.startsWith('--') && !KNOWN_FLAGS.has(a));
if (unknownFlags.length) {
  console.error(`FAIL unknown option(s): ${unknownFlags.join(' ')}`);
  console.error(`     known: ${[...KNOWN_FLAGS].join(' ')}`);
  process.exit(2);
}
const WANT_SOURCES = process.argv.includes('--sources');
// --dupes: the post-fan-out scan. Parallel agents inserting the same block is the
// failure mode - the same quote body repeated INSIDE one page, or one body pasted
// into pages that were edited in the same fan-out.
const WANT_DUPES = process.argv.includes('--dupes');
const bodyHomes = new Map();      // normalised quote body -> [routes]
const withinPage = [];            // route: body repeated inside the same page
const seen = new Map();
let missingPages = [], unresolved = [], published = [], rendered = 0;
const renderedIds = new Set();

for (const f of pages) {
  // W11.4: the old replace() stripped the LAST separator only, so a nested route kept a
  // Windows backslash between its segments - `/contact	hank-you/` never matched the
  // `thank-you` tail and letter (e) failed an EXEMPT route on every Windows build.
  const route = relative(DIST, f).split(sep).filter((x) => x && x !== 'index.html').join('/') || 'index';
  if (EXCLUDE.test(route)) continue;
  if (SHELLS.has(route)) continue;
  const html = readFileSync(f, 'utf8');
  const blocks = [...html.matchAll(/<blockquote[^>]*data-expert-quote[^>]*>([\s\S]*?)<\/blockquote>/gi)];
  if (!blocks.length && !quoteExempt(route)) missingPages.push(route);
  for (const b of blocks) {
    rendered++;
    const idm = b[0].match(/data-quote-id=["']([^"']+)["']/i);
    const id = idm ? idm[1] : '';
    const text = norm(b[1]);
    if (WANT_DUPES) {
      const homes = bodyHomes.get(text) || [];
      if (homes.includes(route)) withinPage.push(`${route}: "${text.slice(0, 50)}"`);
      homes.push(route);
      bodyHomes.set(text, homes);
    }
    if (id && !bankById.has(id)) unresolved.push(`${route}:${id}`);
    if (!id && !bankText.has(text)) unresolved.push(`${route}:"${text.slice(0, 50)}"`);
    if (id && verifyTrue.has(id)) published.push(`${route}:${id}`);
    if (id) renderedIds.add(id);
    const key = id || text;
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key).push(route);
  }
}
// THE CAP, ONE NUMBER (reference/contracts.md E-E-A-T; the same words are in
// run-the-project Stage 3 step 2b and in build_sme_quotes.py used_on): a quote
// may appear on AT MOST 2 INDEXED PAGES. A second home is reported, not failed;
// a third home is a FAIL. Never let the rule text and this counter disagree.
const dupes = [...seen.entries()].filter(([, r]) => r.length > 1);
const overCap = dupes.filter(([, r]) => r.length > 2);

// --sources: the source_url actually resolves, and the credential is in the bank row.
const sourceFails = [];
if (WANT_SOURCES) {
  // A blocked host is not a broken link (same semantics as check-references.mjs):
  // the bank may record it, and then it is a documented decision rather than a guess.
  const BLOCKED_OK = new Set([401, 403, 429]);
  for (const id of [...renderedIds].sort()) {
    const q = bankById.get(id);
    if (!q) continue;                     // already reported as unresolved
    const url = String(q.source_url || '').trim();
    if (!url) { sourceFails.push(`${id}: no source_url in the bank row`); continue; }
    if (!String(q.last_verified || q['last verified'] || '').trim()) {
      sourceFails.push(`${id}: bank row has no \`last verified\` date`);
    }
    const cred = String(q.credential || q.role || '').trim();
    if (cred && !JSON.stringify(q).includes(cred)) {
      sourceFails.push(`${id}: credential "${cred.slice(0, 40)}" is not in its bank row`);
    }
    if (!/^https?:\/\//i.test(url)) { sourceFails.push(`${id}: source_url is not http(s): ${url.slice(0, 60)}`); continue; }
    let status = 0;
    try {
      let r = await fetch(url, { method: 'HEAD', redirect: 'follow' });
      if (r.status === 405 || r.status === 501) r = await fetch(url, { method: 'GET', redirect: 'follow' });
      status = r.status;
    } catch (e) {
      sourceFails.push(`${id}: source_url unreachable (${String(e.message).slice(0, 50)}): ${url.slice(0, 60)}`);
      continue;
    }
    if (status >= 200 && status < 300) continue;
    if (BLOCKED_OK.has(status) && String(q.source_status || '').toLowerCase() === 'blocked') continue;
    sourceFails.push(`${id}: source_url returned ${status}: ${url.slice(0, 60)}`);
  }
}

const crossPage = WANT_DUPES
  ? [...bodyHomes.entries()].filter(([, homes]) => new Set(homes).size > 1)
  : [];
for (const r of withinPage) console.log(`FAIL duplicate quote inside one page: ${r}`);
for (const [body, homes] of crossPage) console.log(`FAIL same quote body on ${new Set(homes).size} pages: "${body.slice(0, 40)}" -> ${[...new Set(homes)].join(', ')}`);
for (const r of missingPages) console.log(`FAIL no expert quote on content page: /${r}/`);
for (const f of sourceFails) console.log(`FAIL quote source: ${f}`);
for (const d of overCap) console.log(`FAIL quote used on more than 2 indexed pages: ${d[0].toString().slice(0, 40)} -> ${d[1].join(', ')}`);
for (const p of published) console.log(`FAIL published quote still verify:true: ${p}`);
for (const u of unresolved) console.log(`FAIL quote does not resolve to config/sme/quotes/*.json: ${u}`);
console.log(`rendered=${rendered} on ${pages.length - missingPages.length} pages, second_home=${dupes.length - overCap.length}, over_2_use_cap=${overCap.length}, verify_true=${published.length}, unresolved=${unresolved.length}, missing_pages=${missingPages.length}` +
  (WANT_SOURCES ? `, source_failures=${sourceFails.length} (checked ${renderedIds.size})` : '') +
  (WANT_DUPES ? `, within_page_dupes=${withinPage.length}, cross_page_dupes=${crossPage.length}` : ''));
// contracts: every gate prints WHAT IT MEASURED, not only what failed - the
// fixed shape `checked=<n> failed=<m>` on the verdict line. Without it a
// clean run and a run that measured nothing print the same words.
console.log(`check-quotes: checked=${rendered} failed=${overCap.length + published.length + unresolved.length + missingPages.length + sourceFails.length}`);
process.exit(missingPages.length + overCap.length + published.length + unresolved.length + sourceFails.length + withinPage.length + crossPage.length ? 1 : 0);
