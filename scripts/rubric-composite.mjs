// kit:rubric-composite@1.0.0 — put the BUILT samples beside the house bar.
//
// WHY THIS EXISTS: contracts §21 says "no rubric dimension below 7/10 ships without a
// written reason in the CP3 artifact", and the Stage 1.9 tournament scored HERO-ONLY
// MOCKUPS — the one screen every concept gets right — while the 5,000px below it went
// unscored until the owner opened the site. RUBRIC.md's own instruction is "put the
// candidate BESIDE the two same-role references at the same width"; nothing produced
// that image, so the scores referred to a comparison nobody had made.
//
// WHAT IT DOES
//   1. finds the built CP3 sample screenshots (.claude/docs/screenshots/<name>-<w>.png)
//   2. pairs each with the same-role house-bar references in ~/.claude/design-references/
//   3. writes an HTML composite per role (candidate | es24 | iuc, side by side, per width)
//      to .claude/docs/screenshots/rubric-<role>.html, and
//   4. prints the 10-dimension scoring TABLE SKELETON to paste into the CP3 artifact.
//
// It does NOT score. A model scoring its own output against a bar it also chose is the
// defect this whole gate exists to interrupt; what this guarantees is that the image the
// scores refer to exists, at both widths, for every sample that shipped.
//
// Usage: node scripts/rubric-composite.mjs --samples [--role home]
// Exit 1 when a sample or a width is missing — a comparison you cannot see is not one.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const argv = process.argv.slice(2);
const ROLE = (argv.includes('--role') ? argv[argv.indexOf('--role') + 1] : '') || '';
const ROOT = process.env.PROJECT_ROOT || process.cwd();
const SHOTS = path.join(ROOT, '.claude', 'docs', 'screenshots');
const SAMPLES = path.join(ROOT, '.claude', 'state', 'checkpoint3-samples.json');
const HOUSE = path.join(os.homedir(), '.claude', 'design-references');
const WIDTHS = ['1440', '375'];

const DIMENSIONS = [
  'Locked direction', 'Signature device above the fold', 'Section treatment variety',
  'Seam variety', 'Data as design', 'Type system', 'Palette discipline',
  'Evidence UI', 'Density & whitespace', 'Motion restraint with life',
];

if (!fs.existsSync(HOUSE)) {
  console.log(`FAIL rubric-composite: house bar missing at ${HOUSE} — there is nothing to compare against`);
  process.exit(1);
}
if (!fs.existsSync(SAMPLES)) {
  console.log(`FAIL rubric-composite: ${SAMPLES} missing — Checkpoint 3 has no recorded samples, so no built page is under review`);
  process.exit(1);
}

const state = JSON.parse(fs.readFileSync(SAMPLES, 'utf8'));
const samples = state.samples ?? [];
if (!samples.length) {
  console.log('FAIL rubric-composite: checkpoint3-samples.json records 0 samples');
  process.exit(1);
}

// astro-build's screenshot naming rule: /pricing/ -> pricing ; / -> home ; /blog/x/ -> blog_x
const shotName = (p) => (p ?? '').replace(/^\/+|\/+$/g, '').replace(/\//g, '_') || 'home';

// The house bar is captured per ROLE. Map a sample's archetype onto the closest one so
// the composite really is "same-role beside same-role", per RUBRIC.md.
const roleOf = (s) => {
  const a = (s.archetype ?? s.role ?? '').toLowerCase();
  const p = (s.path ?? '').toLowerCase();
  if (p === '/' || a.includes('home')) return 'home';
  if (a.includes('outer') || a.includes('blog') || p.includes('/blog/')) return 'article';
  if (a.includes('hub') || a.includes('pillar')) return 'hub';
  return 'money';
};
const HOUSE_FOR = {
  home: ['es24-home', 'iuc-home'],
  hub: ['es24-hub', 'iuc-home'],
  article: ['es24-article', 'iuc-article'],
  money: ['iuc-money', 'es24-hub'],
};

const missing = [];
const built = [];
for (const s of samples) {
  const role = roleOf(s);
  if (ROLE && role !== ROLE) continue;
  const name = shotName(s.path);
  const row = { role, name, shots: {} };
  for (const w of WIDTHS) {
    // Screenshot files are written as <name>-<width>.png, optionally -light/-dark.
    const hit = fs.existsSync(SHOTS)
      ? fs.readdirSync(SHOTS).find((f) => f.startsWith(`${name}-${w}`) && f.endsWith('.png'))
      : null;
    if (hit) row.shots[w] = path.join(SHOTS, hit);
    else missing.push(`${name} @ ${w}`);
  }
  built.push(row);
}

if (!built.length) {
  console.log(`FAIL rubric-composite: no samples matched${ROLE ? ` --role ${ROLE}` : ''}`);
  process.exit(1);
}

const rel = (from, to) => path.relative(path.dirname(from), to).split(path.sep).join('/');

for (const row of built) {
  const refs = HOUSE_FOR[row.role] ?? HOUSE_FOR.money;
  const out = path.join(SHOTS, `rubric-${row.role}-${row.name}.html`);
  const cols = (w) => {
    const cells = [];
    if (row.shots[w]) {
      cells.push(`<figure><figcaption>THIS BUILD — /${row.name}/ @ ${w}</figcaption>
        <img src="${rel(out, row.shots[w])}" alt=""></figure>`);
    }
    for (const r of refs) {
      const f = path.join(HOUSE, `${r}-${w}.png`);
      if (fs.existsSync(f)) {
        cells.push(`<figure><figcaption>HOUSE BAR — ${r} @ ${w}</figcaption>
          <img src="${rel(out, f)}" alt=""></figure>`);
      }
    }
    return `<section><h2>${w}px</h2><div class="row">${cells.join('\n')}</div></section>`;
  };
  const html = `<!doctype html><meta charset="utf-8">
<title>Rubric composite — ${row.role} / ${row.name}</title>
<style>
  body { margin:0; padding:1.5rem; background:#111; color:#eee;
         font:14px/1.5 ui-sans-serif,system-ui,sans-serif; }
  h1 { font-size:1.1rem; } h2 { font-size:.9rem; letter-spacing:.08em; text-transform:uppercase; color:#9aa; }
  .row { display:flex; gap:1rem; align-items:flex-start; overflow-x:auto; }
  figure { margin:0; flex:0 0 auto; max-width:33vw; }
  figcaption { font-size:.75rem; color:#9aa; padding:.4rem 0; }
  img { display:block; width:100%; height:auto; border:1px solid #333; background:#fff; }
</style>
<h1>${row.name} (${row.role}) beside the house bar — score dimensions 1-10 against THIS image</h1>
${WIDTHS.map(cols).join('\n')}`;
  fs.mkdirSync(SHOTS, { recursive: true });
  fs.writeFileSync(out, html, 'utf8');
  console.log(`wrote ${path.relative(ROOT, out)}`);
}

console.log('\nPASTE THIS TABLE INTO THE CHECKPOINT 3 ARTIFACT, SCORED');
console.log('(any dimension under 7 needs a written reason on the same row)\n');
console.log('| dimension | 1440 | 375 | pixel evidence | reason if <7 |');
console.log('|---|---|---|---|---|');
for (const d of DIMENSIONS) console.log(`| ${d} |  |  |  |  |`);

if (missing.length) {
  console.log('\nFAILURES:');
  for (const m of missing) console.log(`  missing screenshot: ${m}`);
  console.log(`\nFAIL rubric-composite (${missing.length} missing) — a rubric row scored ` +
    'against an image that was never captured is a number, not a judgement');
  process.exit(1);
}
console.log(`\nsamples=${built.length} widths=${WIDTHS.join(',')} missing=0`);
console.log('PASS rubric-composite');
process.exit(0);
