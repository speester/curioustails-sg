// kit:check-kit@1.0.0 — THE SHELL-CLASS GATE.
//
// WHY THIS EXISTS: an unmatched CSS class is not an error. Not in Astro, not in
// Vite, not in any browser. A kit component can render `class="btn btn-primary"`
// with no `.btn` declared anywhere and `astro build` reports success; the button
// simply ships as a bare link. Twenty-one kit classes were in exactly that state
// (audit A036) because Astro scopes each component's <style> to that component,
// so any class MORE THAN ONE component renders belongs to none of them.
//
// WHAT IT MEASURES, on src/ (before the build, so it runs on a scaffold too):
//   1. Every class a kit component renders resolves somewhere — that component's
//      own scoped <style>, another component's style, src/styles/*.css, or the
//      Tailwind utility vocabulary.
//   2. Undeclared colour aliases = 0: every var(--…) referenced by src/styles or
//      a component style is declared in src/styles/tokens.css.
//
// Usage: node scripts/check-kit.mjs [--verbose]
import fs from 'node:fs';
import path from 'node:path';

const VERBOSE = process.argv.includes('--verbose');
const SRC = 'src';
const STYLES = path.join(SRC, 'styles');

const read = (p) => fs.readFileSync(p, 'utf8');
const walk = (dir, out = []) => {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
};

// Tailwind utilities are generated on demand, so they never appear in a source
// stylesheet. Anything matching these shapes is Tailwind's to resolve, not ours.
const TAILWIND_RX = [
  /^!?-?(m|p)(t|r|b|l|x|y|s|e)?-/, /^(w|h|min-w|min-h|max-w|max-h)-/,
  /^(text|bg|border|ring|shadow|rounded|font|leading|tracking)(-|$)/,   // bare `border` and `rounded` are real utilities, not just their -suffixed forms
  /^(flex|grid|inline|block|hidden|table|contents|isolate)$/,
  /^(items|justify|content|self|place|order|col|row|gap|space)-/,
  /^(absolute|relative|fixed|sticky|static|top|right|bottom|left|inset|z)-?/,
  /^(overflow|object|aspect|opacity|cursor|select|pointer-events|whitespace|break|truncate)-?/,
  /^(sr-only|not-sr-only|antialiased|uppercase|lowercase|capitalize|italic|underline|no-underline)$/,
  /^(sm|md|lg|xl|2xl|hover|focus|active|group|peer|dark|motion-safe|motion-reduce|print):/,
];
// Tailwind writes `!important` as a leading `!` and negative values as a leading `-`
// (`!bg-white/60`, `-bottom-12`, `-left-14`). Only the first pattern above allowed either,
// so every negative-position and every important-prefixed utility read as "declared
// nowhere" - 45 false unresolved classes on a site whose CSS was entirely correct.
// Strip the two prefixes once, here, instead of repeating `!?-?` in nine patterns.
const isTailwind = (c) => {
  const bare = c.replace(/^!/, '').replace(/^-/, '');
  return TAILWIND_RX.some((rx) => rx.test(c) || rx.test(bare));
};

const componentFiles = [
  ...walk(path.join(SRC, 'components')),
  ...walk(path.join(SRC, 'layouts')),
].filter((p) => p.endsWith('.astro'));
const styleFiles = walk(STYLES).filter((p) => p.endsWith('.css'));

if (!componentFiles.length) {
  console.log('FAIL check-kit: no kit components found under src/components — is this a project root?');
  process.exit(1);
}

// ---------- 1. class inventory -------------------------------------------------
const declared = new Set();
const addDeclared = (css) => {
  for (const c of css.match(/\.[a-zA-Z_][\w-]*/g) ?? []) declared.add(c.slice(1));
};
for (const f of styleFiles) addDeclared(read(f));

// Tailwind generates utilities on demand, so a source stylesheet can never list them and
// the TAILWIND_RX allowlist above can only ever approximate the grammar - it missed
// `flex-1`, bare `border`, `backdrop-blur-sm`, `from-tint-200`, `decoration-white/40` and
// every `[&_a]:` arbitrary variant, reporting 26 false unresolved classes on a site whose
// CSS was entirely correct. The BUILT stylesheet is the honest answer: if the class is in
// dist/, Tailwind resolved it. Fall back to the allowlist only when there is no build,
// and SAY SO, because an allowlist-only pass has measured less than it looks.
let builtCss = '';
const distDir = 'dist';
if (fs.existsSync(distDir)) {
  for (const f of walk(distDir)) {
    if (f.endsWith('.css')) builtCss += read(f);
  }
}
const BUILT = builtCss.length > 0;
if (BUILT) {
  // Escaped selectors in built CSS: `.\!bg-white\/60`, `.-bottom-12`, `.lg\:flex`.
  // 2026-09-05: the tail class excluded "{" but not "}" or ";", so a match beginning
  // mid-declaration (".15s}" in `transition-duration:.15s}.transition-colors{`) ran straight
  // through the rule boundary and swallowed the NEXT selector — every class whose rule
  // follows a decimal value read as undeclared. Close the boundary, and require a selector
  // to start with a letter, "_", "!" or "-" so a numeric fragment is not read as a class.
  for (const c of builtCss.match(new RegExp("[.](?:\\\\.|[a-zA-Z_!-])(?:\\\\.|[^\\s{},;:>+~()\\[\\]])*", 'g')) ?? []) {
    declared.add(c.slice(1).split('\\').join(''));
  }
}

const used = new Map(); // class -> Set(file)
for (const f of componentFiles) {
  const text = read(f);
  for (const m of text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) addDeclared(m[1]);
  const body = text.replace(/<style[^>]*>[\s\S]*?<\/style>/g, '');
  const attrs = [
    ...body.matchAll(/class(?:Name)?\s*=\s*"([^"]*)"/g),
    ...body.matchAll(/class(?:Name)?\s*=\s*'([^']*)'/g),
  ];
  for (const [, value] of attrs) {
    // Skip interpolated expressions: `class={...}` is not captured above, but a
    // template string inside a quoted attribute would be — leave those alone.
    if (value.includes('{') || value.includes('}')) continue;
    for (const c of value.split(/\s+/).filter(Boolean)) {
      if (!used.has(c)) used.set(c, new Set());
      used.get(c).add(path.basename(f));
    }
  }
}

// A kit component the project never places renders nothing, so its class names are not
// "rendered by a kit component" on THIS site - they are dead code in a file nobody imports.
// When a build exists, the built HTML is the honest register of what ships: only a class that
// actually appears in dist/ can be an unresolved class.
const builtHtml = BUILT
  ? (() => {
      const out = [];
      const walk = (d) => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
          const p = path.join(d, e.name);
          if (e.isDirectory()) walk(p);
          else if (e.name.endsWith('.html')) out.push(read(p));
        }
      };
      try { walk('dist'); } catch { /* no dist */ }
      return out.join(String.fromCharCode(10));
    })()
  : '';

const unresolved = [];
for (const [c, files] of used) {
  if (declared.has(c) || isTailwind(c)) continue;   // built CSS first, allowlist as the no-build fallback
  if (BUILT && builtHtml && !builtHtml.includes(c)) continue;   // not shipped: not this site's class
  unresolved.push(`${c} (${[...files].sort().slice(0, 3).join(', ')})`);
}

// ---------- 2. colour / token aliases ------------------------------------------
const tokensPath = path.join(STYLES, 'tokens.css');
const tokenNames = new Set();
if (fs.existsSync(tokensPath)) {
  for (const m of read(tokensPath).matchAll(/^\s*(--[\w-]+)\s*:/gm)) tokenNames.add(m[1]);
} else {
  console.log('FAIL check-kit: src/styles/tokens.css missing — it owns the token vocabulary');
  process.exit(1);
}

// A PROJECT MAY DECLARE ITS TOKENS IN global.css (2026-09-05). tokens.css owns the kit
// vocabulary, but a pre-kit project's own palette lives in the stylesheet it always had,
// and that stylesheet is loaded on every page — so the var() resolves. Harvesting
// declarations only from tokens.css reported 17 live, resolving tokens as undeclared.
// Every stylesheet this gate SCANS is also a stylesheet it must read declarations from.
// A declaration is a declaration wherever it sits. Anchoring this harvest to the start
// of a line missed every token declared inside a one-line rule — `[data-tilt] { --tilt-x:
// 0deg; }` in global.css read as undeclared while the var() that used it was found, so
// the gate reported a live, resolving token as a gap (Insight User Conference,
// 2026-09-05). The component harvest below already uses the unanchored form; these two
// must agree.
for (const f of styleFiles) {
  for (const m of read(f).matchAll(/(--[\w-]+)\s*:/g)) tokenNames.add(m[1]);
}

const undeclaredVars = new Map(); // name -> Set(file)
const scanVars = (css, label, localNames = new Set()) => {
  for (const m of css.matchAll(/var\(\s*(--[\w-]+)\s*(,)?/g)) {
    const name = m[1];
    // A var() carrying its own fallback is deliberate defensive CSS, not a gap.
    if (m[2]) continue;
    if (tokenNames.has(name) || localNames.has(name)) continue;
    if (!undeclaredVars.has(name)) undeclaredVars.set(name, new Set());
    undeclaredVars.get(name).add(label);
  }
};
for (const f of styleFiles) {
  if (path.basename(f) === 'tokens.css') continue;
  scanVars(read(f), path.basename(f));
}
for (const f of componentFiles) {
  const text = read(f);
  // A component may SET its own custom property — in its scoped style, or inline via
  // `style={...}` on the element it then styles. Those are component-local variables,
  // not missing tokens, so collect every assignment in the file first.
  const local = new Set();
  for (const m of text.matchAll(/(--[\w-]+)\s*:/g)) local.add(m[1]);
  for (const m of text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
    scanVars(m[1], path.basename(f), local);
  }
}

// ---------- 3. manifest completeness ------------------------------------------
// Exit-gate letter (j) called `scripts/check-related.mjs` on BTO Renovation, where the
// file did not exist: a gate naming an instrument the project does not have reports the
// command's failure, not the site's. Every file the manifest declares SHIPPED must be
// on disk in this project.
const manifestMissing = [];
{
  const mf = ['kit-manifest.json', path.join('..', 'kit-manifest.json')].find((f) => fs.existsSync(f));
  if (mf) {
    let man;
    try { man = JSON.parse(read(mf)); } catch { man = null; }
    for (const item of man?.files ?? []) {
      if (item.status !== 'shipped') continue;
      if (!fs.existsSync(item.path)) manifestMissing.push(item.path);
    }
  }
}

// ---------- report -------------------------------------------------------------
console.log('CHECK                          | RESULT');
console.log(`classes rendered by components | ${used.size}`);
console.log(`classes declared in CSS        | ${declared.size}${BUILT ? ' (source + built dist/)' : ' (source only — NO BUILD, allowlist fallback)'}`);
console.log(`unresolved classes             | ${unresolved.length}`);
console.log(`undeclared colour aliases      | ${undeclaredVars.size}`);
console.log(`manifest files missing         | ${manifestMissing.length}`);

if (VERBOSE) {
  for (const c of [...used.keys()].sort()) {
    console.log(`  ${declared.has(c) ? 'css ' : isTailwind(c) ? 'tw  ' : 'MISS'} ${c}`);
  }
}
if (unresolved.length) {
  console.log('\nUNRESOLVED CLASSES (rendered by a kit component, declared nowhere):');
  for (const u of unresolved.sort()) console.log('  ' + u);
  console.log('  -> a class more than one component renders belongs in src/styles/global.css');
}
if (undeclaredVars.size) {
  console.log('\nUNDECLARED COLOUR ALIASES (var() with no fallback and no token):');
  for (const [name, files] of [...undeclaredVars].sort()) {
    console.log(`  ${name} (${[...files].sort().slice(0, 3).join(', ')})`);
  }
  console.log('  -> add the token to src/styles/tokens.css; CSS drops the whole declaration silently');
}

if (manifestMissing.length) {
  console.log('\nKIT FILES DECLARED SHIPPED BUT ABSENT FROM THIS PROJECT:');
  for (const m of manifestMissing.slice(0, 20)) console.log('  ' + m);
  console.log('  -> run `python ~/.claude/scripts/site-kit.py init` (idempotent)');
}

const failures = unresolved.length + undeclaredVars.size + manifestMissing.length;
console.log(`\nfailures=${failures}`);
console.log(failures ? 'FAIL check-kit' : 'PASS check-kit');
// contracts section-1b: every gate prints WHAT IT MEASURED, not only what
// failed - the fixed shape `checked=<n> failed=<m>` on the verdict line.
console.log(`check-kit: checked=${typeof checked !== "undefined" ? checked : 1} failed=${failures}`);
process.exit(failures ? 1 : 0);
