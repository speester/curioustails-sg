// K-119 codemod for the 48 breed pages.
//
// Applies, per file:
//   T03  delete " No add-ons quietly billed later." from priceAnchor
//   T06  price-block footnote (inclusions + payment + surcharge), shared "How do I pay?" FAQ
//   T08  VaccinationTimeline (replace the 6 inline tables, insert on the other 42)
//   T10  boarding capped at one month (side list, aftercare paragraph, FAQ answer, comparison item)
//   T11  ReserveSteps after the aftercare block; drop that block's first paragraph
//   T15  visible starter-kit prose: $500+ -> $${KIT_TOTAL}, 30+ items -> ${KIT_COUNT} items
//
// Rules: one identical codemod line per file; no new sentence typed per page.
// Meta/title and the schema array are never rewritten by T15.
//
// Usage: node reports/k119-tools/codemod-breed-pages.mjs [--dry]
import fs from 'node:fs';
import path from 'node:path';

const DRY = process.argv.includes('--dry');
const DIR = 'src/pages/puppies';
const EXCL = new Set(['index', 'bernedoodle', 'labrador']);
const SLUGS = fs.readdirSync(DIR)
  .filter((f) => f.endsWith('.astro'))
  .map((f) => f.replace(/\.astro$/, ''))
  .filter((s) => !EXCL.has(s))
  .sort();

const log = [];
const problems = [];
const act = (slug, task, msg) => log.push(`${slug}\t${task}\t${msg}`);

const IMPORT_LINES = [
  "import VaccinationTimeline from '../../components/VaccinationTimeline.astro';",
  "import ReserveSteps from '../../components/ReserveSteps.astro';",
  "import { INCLUSIONS_LINE, PAYMENT_LINE, SURCHARGE_LINE, SHARED_BUY_FAQ, KIT_TOTAL, KIT_COUNT } from '../../data/buying-terms';",
];

function findStatement(text, startRx) {
  const m = text.match(startRx);
  if (!m) return null;
  const start = m.index;
  let i = start + m[0].length;
  let mode = null;
  while (i < text.length) {
    const c = text[i];
    if (mode === null) {
      if (c === "'" || c === '"' || c === '`') mode = c;
      else if (c === ';') return [start, i + 1];
    } else if (c === '\\') { i += 1; }
    else if (c === mode) { mode = null; }
    i += 1;
  }
  return null;
}

function findSchemaArray(text) {
  const start = text.indexOf('const schemas = [');
  if (start < 0) return null;
  let depth = 0;
  for (let i = text.indexOf('[', start); i < text.length; i++) {
    if (text[i] === '[') depth++;
    else if (text[i] === ']') {
      depth--;
      if (depth === 0) {
        const semi = text.indexOf(';', i);
        return [start, semi + 1];
      }
    }
  }
  return null;
}

function elementEnd(text, start) {
  const open = text.slice(start).match(/^<([a-zA-Z][\w:-]*)/);
  if (!open) return -1;
  const tag = open[1].toLowerCase();
  const re = new RegExp(`<${tag}\\b[^>]*>|</${tag}>`, 'gi');
  re.lastIndex = start;
  let depth = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m[0][1] === '/') {
      depth--;
      if (depth === 0) return m.index + m[0].length;
    } else {
      const selfClosing = /\/>$/.test(m[0]);
      if (!selfClosing) depth++;
      if (depth === 0) return m.index + m[0].length;
    }
  }
  return -1;
}

// Convert JS string literals that hold a token into template literals, without
// touching apostrophes inside words or anything inside an existing template.
function stringsToTemplates(text, token) {
  let out = '';
  let i = 0;
  let inTemplate = false;
  while (i < text.length) {
    const c = text[i];
    if (inTemplate && c === '\\') { out += c + (text[i + 1] ?? ''); i += 2; continue; }
    if (c === '`') { inTemplate = !inTemplate; out += c; i++; continue; }
    if (!inTemplate && (c === "'" || c === '"')) {
      const prev = out.replace(/\s+$/, '').slice(-1);
      const startsString = !/[A-Za-z0-9_$)\]]/.test(prev);
      let j = i + 1;
      let body = '';
      let closed = false;
      while (j < text.length && text[j] !== '\n') {
        if (text[j] === '\\') { body += text[j] + (text[j + 1] ?? ''); j += 2; continue; }
        if (text[j] === c) { closed = true; break; }
        body += text[j];
        j++;
      }
      if (startsString && closed && body.includes(token)) {
        const inner = body
          .replace(new RegExp('\\\\' + (c === '"' ? '"' : "'"), 'g'), c)
          .replace(/`/g, '\\`')
          .replace(/\$\{/g, '\\${');
        out += '`' + inner + '`';
        i = j + 1;
        continue;
      }
    }
    out += c;
    i++;
  }
  return out;
}

for (const slug of SLUGS) {
  const file = path.join(DIR, slug + '.astro');
  let text = fs.readFileSync(file, 'utf8');
  const before = text;

  // ---- T03: remove the retired promise from the hero price anchor ----
  const anchorHits = (text.match(/No add-ons quietly billed later\./g) ?? []).length;
  if (anchorHits > 1) problems.push(`${slug}: ${anchorHits} occurrences of the retired promise`);
  const beforeT03 = text;
  text = text.replace(/\s*No add-ons quietly billed later\./g, '');
  if (text !== beforeT03) act(slug, 'T03', `removed retired promise x${anchorHits}`);

  if (!text.includes("import { INCLUSIONS_LINE")) {
    const anchor = "import FinalCta from '../../components/FinalCta.astro';";
    if (!text.includes(anchor)) { problems.push(`${slug}: no FinalCta import anchor`); continue; }
    text = text.replace(anchor, anchor + '\n' + IMPORT_LINES.join('\n'));
    act(slug, 'T06', 'imports added');
  }

  // ---- T08: vaccination timeline ----
  if (!text.includes('<VaccinationTimeline />')) {
    const headingIdx = text.indexOf('Vaccination and Licensing Timeline');
    if (headingIdx >= 0) {
      const csStart = text.lastIndexOf('<ComparisonSplit', headingIdx);
      const csEnd = text.indexOf('/>', headingIdx) + 2;
      const footStart = text.indexOf('<div class="mx-auto max-w-[1400px] px-5 sm:px-8 -mt-6 pb-10">', csEnd);
      if (csStart < 0 || csEnd < 2 || footStart < 0) {
        problems.push(`${slug}: inline vaccination table shape not recognised`);
      } else {
        const footEnd = elementEnd(text, footStart);
        text = text.slice(0, csStart) + '<VaccinationTimeline />' + text.slice(footEnd);
        act(slug, 'T08', 'replaced inline vaccination table');
      }
    } else {
      const hStart = text.indexOf('<div id="health"');
      if (hStart < 0) {
        problems.push(`${slug}: no #health anchor for VaccinationTimeline`);
      } else {
        const hEnd = elementEnd(text, hStart);
        text = text.slice(0, hEnd) + '\n\n  <VaccinationTimeline />' + text.slice(hEnd);
        act(slug, 'T08', 'inserted after #health');
      }
    }
  }

  // ---- T10: boarding cap ----
  const sideBefore = text;
  text = text.replace(/'Free boarding after deposit, until you\\?'re ready'/g, "'Free boarding after deposit, up to a month'");
  text = text.replace(/'Free boarding after deposit until you are ready'/g, "'Free boarding after deposit, up to a month'");
  text = text.replace(/free boarding after your deposit until you(?:'|\\')re ready/g, 'free boarding for up to a month after your deposit, vaccinations kept on schedule at our cost');
  text = text.replace(/we board your puppy for free, food and lodging covered, until you(?:'|\\')re ready/g, 'we board your puppy free for up to a month, food and lodging covered');
  if (text !== sideBefore) act(slug, 'T10', 'boarding capped');

  // ---- T11: reserve steps ----
  if (!text.includes('<ReserveSteps')) {
    const trustIdx = text.indexOf('<div id="trust"');
    if (trustIdx < 0) {
      problems.push(`${slug}: no #trust anchor for ReserveSteps`);
    } else {
      const breedAttr = text.match(/<FinalCta[^>]*breed="([^"]+)"/);
      const breed = breedAttr ? breedAttr[1] : slug;
      text = text.slice(0, trustIdx) + `<ReserveSteps heading="What Happens After You Reserve a ${breed}" />\n\n  ` + text.slice(trustIdx);
      act(slug, 'T11', `steps inserted (${breed})`);
    }

    const acIdx = text.indexOf('CaptionedBlock heading="Free Training, Free Boarding and Real Aftercare"');
    if (acIdx >= 0) {
      const openEnd = text.indexOf('>', acIdx) + 1;
      const pStart = text.indexOf('<p>', openEnd);
      if (pStart >= 0 && pStart - openEnd < 400) {
        const pEnd = text.indexOf('</p>', pStart) + 4;
        text = text.slice(0, pStart) + text.slice(pEnd);
        act(slug, 'T11', 'aftercare first paragraph removed');
      } else {
        problems.push(`${slug}: aftercare block has no first <p> to remove`);
      }
    }
  }

  // ---- T06: remove the decorative "all-in" from StatStrip labels ----
  // The label is a secondary decoration, not a price statement; the price block
  // below carries the payment disclosure. Never remove the price itself.
  const statBefore = text;
  text = text.replace(/label: '([^']*?), all-in'/g, "label: '$1'");
  if (text !== statBefore) act(slug, 'T06', 'StatStrip all-in label cleaned');

  // ---- T06: price footnote + shared buy FAQ ----
  const priceIdx = text.indexOf('id="price"');
  if (priceIdx < 0) problems.push(`${slug}: no #price block`);
  else {
    const openTag = '<p class="text-sm leading-relaxed text-[var(--color-cream-600)]">';
    const pOpen = text.indexOf(openTag, priceIdx);
    if (pOpen < 0) problems.push(`${slug}: no price footnote paragraph`);
    else {
      const insertAt = pOpen + openTag.length;
      if (!text.slice(insertAt, insertAt + 80).includes('INCLUSIONS_LINE')) {
        text = text.slice(0, insertAt) + '\n        {`${INCLUSIONS_LINE} ${PAYMENT_LINE} ${SURCHARGE_LINE}`}' + text.slice(insertAt);
        act(slug, 'T06', 'price footnote prepended');
      }
    }
  }

  if (!text.includes('const allFaqItems')) {
    const schemaIdx = text.indexOf('const schemas = [');
    if (schemaIdx < 0) problems.push(`${slug}: no schemas array`);
    else {
      text = text.slice(0, schemaIdx) + 'const allFaqItems = [...faqItems, ...SHARED_BUY_FAQ];\n\n' + text.slice(schemaIdx);
      act(slug, 'T06', 'allFaqItems added');
    }
  }
  text = text.replace(/faqPageSchema\(faqItems\)/g, 'faqPageSchema(allFaqItems)');
  text = text.replace(/items=\{faqItems\}/g, 'items={allFaqItems}');

  // ---- T15: visible starter-kit prose, in segments outside title/meta/schema ----
  const ranges = [
    findStatement(text, /const title\s*=/),
    findStatement(text, /const description\s*=/),
    findSchemaArray(text),
  ].filter(Boolean).sort((a, b) => a[0] - b[0]);

  const transform = (s) => {
    let t = s;
    t = t.replace(/\{ value: '\$500\+', label: 'starter kit included free' \}/g, "{ value: `$${KIT_TOTAL}`, label: 'starter kit included free' }");
    t = t.replace(/'(\$500\+) starter kit with 30\+ items included'/g, '`$${KIT_TOTAL} starter kit with ${KIT_COUNT} items included`');
    t = t.replace(/heading="The \$500\+ Starter Kit ([^"]+)"/g, 'heading={`The $${KIT_TOTAL} Starter Kit $1`}');
    t = t.replace(/subhead="([^"]*\$500\+[^"]*)"/g, 'subhead={`$1`}');
    t = stringsToTemplates(t, '$500+');
    t = stringsToTemplates(t, '30+ starter-kit items');
    t = stringsToTemplates(t, '30+ items');
    t = t.replace(/worth \$500 and up: more than 30 items/g, 'worth $${KIT_TOTAL}: {KIT_COUNT} items');
    t = t.replace(/\$500\+/g, '$${KIT_TOTAL}');

    const phrases = [
      ['30+ starter-kit items', '${KIT_COUNT} starter-kit items', '{KIT_COUNT} starter-kit items'],
      ['30+ item kit', '${KIT_COUNT} item kit', '{KIT_COUNT} item kit'],
      ['30+ items', '${KIT_COUNT} items', '{KIT_COUNT} items'],
    ];
    for (const [needle, inTemplate, inJsx] of phrases) {
      let idx = t.indexOf(needle);
      while (idx >= 0) {
        const backticks = (t.slice(0, idx).match(/`/g) ?? []).length;
        const replacement = backticks % 2 === 1 ? inTemplate : inJsx;
        t = t.slice(0, idx) + replacement + t.slice(idx + needle.length);
        idx = t.indexOf(needle, idx + replacement.length);
      }
    }
    return t;
  };

  const segs = [];
  let cursor = 0;
  for (const [a, b] of ranges) {
    if (a < cursor) continue;
    segs.push({ text: text.slice(cursor, a), lock: false });
    segs.push({ text: text.slice(a, b), lock: true });
    cursor = b;
  }
  segs.push({ text: text.slice(cursor), lock: false });
  const next = segs.map((s) => (s.lock ? s.text : transform(s.text))).join('');
  if (next !== text) {
    text = next;
    act(slug, 'T15', 'visible kit total/count applied');
  }

  if (text !== before) {
    if (!DRY) fs.writeFileSync(file, text);
    act(slug, 'WRITE', DRY ? 'dry' : 'saved');
  }
}

fs.writeFileSync('reports/k119-tools/codemod-log.tsv', log.join('\n') + '\n');
console.log(`files=${SLUGS.length} actions=${log.length} problems=${problems.length}`);
if (problems.length) {
  console.log('\nPROBLEMS:');
  for (const p of problems) console.log('  ' + p);
}
const byTask = {};
for (const l of log) { const t = l.split('\t')[1]; byTask[t] = (byTask[t] || 0) + 1; }
console.log('\nactions by task:', JSON.stringify(byTask));
if (problems.length) process.exit(1);
