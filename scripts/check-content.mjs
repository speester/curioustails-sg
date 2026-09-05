#!/usr/bin/env node
// kit:check-content@1.0.0 — every content-level string gate, on src/ AND dist/.
// Usage: node scripts/check-content.mjs [--placeholders|--identity|--prices|--samples
//                                        |--classes|--dupes|--props|--design-system|--fonts]
// No flag = run everything. Exit 1 on any FAIL. Always names the EMITTING FILE.
import fs from 'node:fs';
import path from 'node:path';

const flags = process.argv.slice(2).filter((a) => a.startsWith('--'));
const only = (name) => flags.length === 0 || flags.includes(`--${name}`);

// The launch gate cites `check-content.mjs --avoid` as a THIN CALLER of the one banned-word
// engine. It carried no such flag, so the call ran every OTHER check and reported PASS while
// the word list was never consulted. It carries no list, stem rule or scope rule of its own.
const KNOWN = ['placeholders', 'identity', 'prices', 'samples', 'classes', 'dupes',
               'props', 'design-system', 'fonts', 'markup', 'avoid'];
const unknown = flags.filter((f) => !KNOWN.includes(f.replace(/^--/, '')));
if (unknown.length) {
  console.error(`FAIL unknown option(s): ${unknown.join(' ')}`);
  console.error(`     known: ${KNOWN.map((k) => '--' + k).join(' ')}`);
  process.exit(2);
}
if (flags.includes('--avoid')) {
  const { spawnSync } = await import('node:child_process');
  const py = process.env.PYTHON || 'python';
  const r = spawnSync(py, ['scripts/verify_page.py', '--all', '--avoid'], { stdio: 'inherit' });
  if (r.error) { console.error(`FAIL could not run ${py} scripts/verify_page.py: ${r.error.message}`); process.exit(1); }
  process.exit(r.status ?? 1);
}
const rows = [];
const detail = [];

function add(check, fails, note = '') {
  rows.push([check, fails.length === 0 ? 'PASS' : `FAIL (${fails.length})`, note]);
  for (const f of fails.slice(0, 40)) detail.push(`  [${check}] ${f}`);
  if (fails.length > 40) detail.push(`  [${check}] ... ${fails.length - 40} more`);
}

function walk(dir, exts, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p, exts, out); continue; }
    if (exts.has(path.extname(e.name))) out.push(p);
  }
  return out;
}

const SRC = walk('src', new Set(['.astro', '.ts', '.tsx', '.js', '.mjs', '.json', '.css']));
const DIST = walk('dist', new Set(['.html']));
const readAll = (files) => files.map((f) => [f, fs.readFileSync(f, 'utf8')]);
const SRC_TXT = readAll(SRC);
const DIST_TXT = readAll(DIST);
// W11.7: a gate that measured nothing is not a pass.
if (!DIST.length) { console.log('HALT: no dist/**/index.html - there is nothing to gate. Run `npm run build`, or set PROJECT_ROOT.'); process.exit(1); }

function scan(pairs, re, label) {
  const hits = [];
  for (const [file, txt] of pairs) {
    const lines = txt.split(/\r?\n/);
    lines.forEach((l, i) => { if (re.test(l)) hits.push(`${file}:${i + 1} ${label}: ${l.trim().slice(0, 120)}`); re.lastIndex = 0; });
  }
  return hits;
}

// COMMENT-AWARE FILTER (2026-09-05). Several source scans below fail on lines that are
// COMMENTS ABOUT the thing being banned - a component header explaining that "[TO SET]"
// is the failure it exists to prevent, a rule list mentioning `[VERIFY]`. A comment cannot
// reach a reader, so it cannot be the defect. Build the per-file comment-line index once
// and reuse it for every source scan that asks "does this SHIP?".
const COMMENT_LINES = new Map();
for (const [file, txt] of SRC_TXT) {
  const set = new Set();
  let inBlock = false;
  txt.split(/\r?\n/).forEach((l, i) => {
    const opens = l.lastIndexOf('/*'), closes = l.lastIndexOf('*/');
    if (inBlock) set.add(i + 1);
    else if (/^\s*(\/\/|\*)/.test(l) || opens >= 0) set.add(i + 1);
    if (opens >= 0 && (closes < 0 || closes < opens)) inBlock = true;
    else if (closes >= 0 && closes > opens) inBlock = false;
  });
  COMMENT_LINES.set(file, set);
}
const notInComment = (hit) => {
  const m = hit.match(/^(.*):(\d+) /);
  return !(m && COMMENT_LINES.get(m[1])?.has(Number(m[2])));
};
// An <input placeholder="you@example.com"> is FORM UX, not an invented identity: it is the
// example address a user is shown while the field is empty, and it ships on every form the
// kit generates. Only a placeholder outside an input attribute is the defect.
const notInputPlaceholder = (hit) => !/<input[^>]*placeholder="/i.test(hit);

// ---- placeholders / unresolved flags (src) ----
if (only('placeholders')) {
  // SHELL EXEMPTION: PLACEHOLDER-COPY + draft=true pages are machine-declared shells;
  // the Stage-3 exit grep gates the marker, not CP3's scaffold-green verify.
  const SHELLS = new Set(SRC_TXT.filter(([f, t]) => t.includes('PLACEHOLDER-COPY') && /draft\s*=\s*true/.test(t)).map(([f]) => f));
  const NONSHELL = SRC_TXT.map(([f, t]) => [f, SHELLS.has(f) ? t.split('PLACEHOLDER-COPY').join('SHELL-DECLARED') : t]);
  add('placeholders/src', scan(NONSHELL, /PLACEHOLDER-COPY|\[VERIFY\]|\[NEEDS PROOF\]|\[PLACEHOLDER|\[TO SET\]|Lorem ipsum|\bTODO\b/, 'marker').filter(notInComment));
}

// ---- escaped inline HTML + anchor whitespace + comments + em dashes (dist) ----
if (only('markup') || flags.length === 0) {
  add('escaped-inline-html', scan(DIST_TXT, /&lt;(strong|em|a|br)&gt;/, 'escaped tag — the component must use set:html'));
  add('anchor-whitespace', scan(DIST_TXT, /[A-Za-z0-9]<a |<\/a>[A-Za-z0-9]|<\/(strong|em)>[A-Za-z]/, 'glued inline element'));
  add('html-comments', scan(DIST_TXT, /<!--/, 'comment in shipped HTML'));
  add('em-dash-dist', scan(DIST_TXT, /—|&mdash;|&#8212;/, 'em dash'));
  // Only text that can REACH dist counts. An em dash inside a // or /* */ comment is
  // never rendered, and flagging every kit comment header buried the one hit that
  // mattered (a dash inside an innerHTML string) under 40 false positives.
  // The comment filter tested "a colon immediately precedes //", which is not the same
  // question as "is the dash inside a comment": `avsNumber: 'X', // the licence — note`
  // has a comma before the //, so every trailing code comment came back as a hit. Ask
  // the actual question - does the dash sit after a // or inside a /* */ on that line.
  // 2026-09-05: the line-local test could not see a CSS or JSDoc BLOCK comment whose
  // continuation lines start with plain prose. Every kit stylesheet header therefore came
  // back as a hit. Track comment state per FILE and ask whether the hit's line is inside one.
  const commentLineIndex = new Map();
  for (const [file, txt] of SRC_TXT) {
    const set = new Set();
    let inBlock = false;
    txt.split(/\r?\n/).forEach((l, i) => {
      const opens = l.lastIndexOf('/*'), closes = l.lastIndexOf('*/');
      if (inBlock) set.add(i + 1);
      else if (/^\s*\/\//.test(l) || opens >= 0) set.add(i + 1);
      if (opens >= 0 && (closes < 0 || closes < opens)) inBlock = true;
      else if (closes >= 0 && closes > opens) inBlock = false;
    });
    commentLineIndex.set(file, set);
  }
  const dashInComment = (hit) => {
    const m = hit.match(/^(.*):(\d+) escaped em dash in source:/);
    if (m && commentLineIndex.get(m[1])?.has(Number(m[2]))) return true;
    const line = hit;
    const text = line.slice(line.indexOf(' in source:') + ' in source:'.length);
    const dash = text.search(/—|&mdash;|&#8212;/);
    if (dash < 0) return false;
    const before = text.slice(0, dash);
    return /\/\//.test(before) || /\/\*/.test(before) || /^\s*\*/.test(before);
  };
  add('em-dash-src-escape',
      scan(SRC_TXT, /—|&mdash;|&#8212;/, 'escaped em dash in source').filter((h) => !dashInComment(h)));
  add('straight-apostrophe', scan(SRC_TXT.filter(([f]) => f.endsWith('.astro')), /(?:label|heading|title|cta)\s*[:=]\s*"[^"]*[A-Za-z]'[a-z]/, "straight apostrophe in a UI label — use \u2019"));
}

// ---- identity: personal mail, placeholder contact values ----
if (only('identity')) {
  add('personal-email', [...scan(SRC_TXT, /@(gmail|outlook|hotmail|yahoo|icloud)\./i, 'free-mail address'),
                         ...scan(DIST_TXT, /@(gmail|outlook|hotmail|yahoo|icloud)\./i, 'free-mail address')]);
  add('placeholder-identity', scan(SRC_TXT, /@(example|yourdomain)\.|founded:\s*20[0-9]{2}|\[TO SET\]|\+1 ?555/i, 'invented identity value').filter(notInComment).filter(notInputPlaceholder));
}

// ---- prices only in PRICES_FILE ----
if (only('prices')) {
  const pricePages = SRC_TXT.filter(([f]) => /src[\\/](pages|components)[\\/]/.test(f) && f.endsWith('.astro'));
  const hits = [];
  for (const [file, txt] of pricePages) {
    txt.split(/\r?\n/).forEach((l, i) => {
      // The amount must be at least two characters. `$1` in a .replace() is a capture-group
      // backreference, not a price, and Image.astro's srcset builder tripped this on every run.
      if (/(\$|S\$|£)\s?[0-9][0-9,.]+/.test(l) && !/data-price/.test(l)) hits.push(`${file}:${i + 1} price literal: ${l.trim().slice(0, 120)}`);
    });
  }
  add('price-literals', hits, 'prices live only in src/data/pricing.ts');
}

// ---- SAMPLE data feeding rendered claims ----
if (only('samples')) {
  add('sample-data', scan(SRC_TXT.filter(([f]) => /src[\\/](data|pages)[\\/]/.test(f)), /\bSAMPLE\b|\[PLACEHOLDER|\[TO SET\]|\bTODO\b/, 'sample/placeholder data'));
}

// ---- class existence for project-prefixed classes ----
if (only('classes')) {
  const cssFiles = [...walk('src/styles', new Set(['.css'])), ...walk('dist/_astro', new Set(['.css']))];
  const css = cssFiles.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  const PREFIX = /\b((?:btn|card|panel|section|fig|jumpnav|quote|price|lane)-[a-z0-9-]+)\b/g;
  const unknown = [];
  const SHELL_FILES = new Set(SRC_TXT.filter(([f, t]) => t.includes('PLACEHOLDER-COPY') && /draft\s*=\s*true/.test(t)).map(([f]) => f));
  for (const [file, txt] of SRC_TXT.filter(([f]) => f.endsWith('.astro') && !SHELL_FILES.has(f))) {
    for (const m of txt.matchAll(/class(?:Name)?="([^"]*)"/g)) {
      for (const c of m[1].split(/\s+/)) {
        PREFIX.lastIndex = 0;
        if (!PREFIX.test(c)) continue;
        // A component may declare the class in its OWN scoped <style>. Astro only emits that
        // CSS into dist when the component actually renders, so a correct-but-unused (or
        // conditionally rendered) component reported its own classes as unknown. Read the
        // file's style blocks too (2026-09-05).
        const ownStyles = [...txt.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((s) => s[1]).join('\n');
        if (!css.includes('.' + c) && !ownStyles.includes('.' + c)) unknown.push(`${file} unknown class: ${c}`);
      }
    }
  }
  add('class-existence', [...new Set(unknown)]);
}

// ---- duplicate blocks (>= 40 identical words) within and across files ----
if (only('dupes')) {
  const seen = new Map();
  const dupes = [];
  const SHELL_FILES = new Set(SRC_TXT.filter(([f, t]) => t.includes('PLACEHOLDER-COPY') && /draft\s*=\s*true/.test(t)).map(([f]) => f));
  for (const [file, txt] of SRC_TXT.filter(([f]) => f.endsWith('.astro') && !SHELL_FILES.has(f))) {
    // strip Astro frontmatter — identical import blocks across pages are not content duplication
    const bodyTxt = txt.replace(/^---[\s\S]*?---/, ' ');
    // Strip JSX expressions as well as tags. Two pages embedding the SAME figure component
    // share its inline {[0,1,2].map(...)} verbatim, and counting that as duplicated content
    // reported component reuse as plagiarism while hiding whether any prose actually repeats.
    // JSX expressions nest ({items.map(i => <li x={i} />)}), so strip innermost-first until
    // the string stops changing rather than in a single pass.
    let stripped = bodyTxt;
    for (let n = 0; n < 12; n++) {
      const next = stripped.replace(/\{[^{}]*\}/g, ' ');
      if (next === stripped) break;
      stripped = next;
    }
    const words = stripped.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean);
    for (let i = 0; i + 40 <= words.length; i += 10) {
      const key = words.slice(i, i + 40).join(' ').toLowerCase();
      if (seen.has(key)) dupes.push(`${file} duplicates block first seen in ${seen.get(key)}`);
      else seen.set(key, file);
    }
  }
  add('duplicate-blocks', [...new Set(dupes)]);
}

// ---- layout props with zero call sites ----
if (only('props')) {
  const layouts = walk('src/layouts', new Set(['.astro']));
  const pages = SRC_TXT.filter(([f]) => /src[\\/]pages[\\/]/.test(f)).map(([, t]) => t).join('\n');
  const dead = [];
  for (const l of layouts) {
    const txt = fs.readFileSync(l, 'utf8');
    const iface = txt.match(/interface\s+Props\s*\{([\s\S]*?)\}/);
    if (!iface) continue;
    for (const m of iface[1].matchAll(/^\s*([A-Za-z0-9_]+)\??\s*:/gm)) {
      const prop = m[1];
      // A boolean prop is idiomatically passed as a BARE attribute (`<X noindex />`),
      // which carries no `=`. Requiring one reported a wired prop as dead.
      const used = new RegExp(`\\b${prop}\\s*=`).test(pages)
        || new RegExp(`(<|\\s)${prop}(\\s|/>|>|$)`, "m").test(pages);
      if (!used) dead.push(`${l} prop with 0 call sites: ${prop}`);
    }
  }
  add('dead-layout-props', dead, 'delete it or wire it — never leave it');
}

// ---- design-system.md reconciled against astro-build's bans ----
if (only('design-system')) {
  const ds = fs.existsSync('design-system.md') ? fs.readFileSync('design-system.md', 'utf8') : '';
  const conflicts = [];
  if (!ds) conflicts.push('design-system.md missing at project root');
  if (/\b(Inter|DM Sans|Poppins|Montserrat)\b/i.test(ds) && !/##\s*Font override/i.test(ds)) conflicts.push('reflex-reject font named with no "## Font override" section');
  if (/glassmorph|glass\b/i.test(ds)) conflicts.push('glassmorphism named — astro-build bans it (premium #2 "glass" does not override this)');
  const navCount = (ds.match(/^\s*[-*]\s+nav:/gim) || []).length;
  const navCap = /publisher|publication/i.test(ds) ? 5 : 4;
  if (navCount > navCap) conflicts.push(`nav spec lists ${navCount} items — cap is <=4 (local) / <=5 groups (publisher)`);
  if (/write for us/i.test(ds) && /nav/i.test(ds)) conflicts.push('Write for Us appears in the nav spec — monetization pages live in the footer utility row');
  if (/4-column footer|four-column footer/i.test(ds)) conflicts.push('4-column footer specified — footer is one row + footnote (publication) or NAP+legal (local)');
  add('design-system-reconcile', conflicts, 'resolve IN design-system.md, never silently in code');
}

// ---- font CDN ban ----
if (only('fonts')) {
  add('font-cdn', scan(DIST_TXT, /fonts\.(googleapis|gstatic)\.com/, 'Google Fonts CDN'));
  const woff = fs.existsSync('public/fonts') ? fs.readdirSync('public/fonts').filter((f) => f.endsWith('.woff2')) : [];
  add('self-hosted-fonts', woff.length ? [] : ['no .woff2 in public/fonts/']);
}

console.log('CHECK                    | RESULT     | NOTE');
for (const [c, r, n] of rows) console.log(`${c.padEnd(24)} | ${r.padEnd(10)} | ${n}`);
if (detail.length) { console.log('\nDETAIL (file:line — fix the COMPONENT, not the page):'); for (const d of detail) console.log(d); }
const failed = rows.filter((r) => r[1].startsWith('FAIL')).length;
console.log(`\nchecks=${rows.length} failed=${failed}`);
// contracts: every gate prints WHAT IT MEASURED, not only what failed - the
// fixed shape `checked=<n> failed=<m>` on the verdict line. Without it a
// clean run and a run that measured nothing print the same words. A gate
// whose checked is 0 must FAIL unless it also prints an exemption reason.
console.log(`check-content: checked=${rows.length} failed=${failed}`);
console.log(failed ? 'FAIL check:content' : 'PASS check:content');
process.exit(failed ? 1 : 0);
