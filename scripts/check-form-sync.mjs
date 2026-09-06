#!/usr/bin/env node
// kit:check-form-sync@1.0.0 — the Functions must not drift from config/formaloo.<key>.json.
// Usage: node scripts/check-form-sync.mjs
import fs from 'node:fs';
import path from 'node:path';

// LEAD_CAPTURE says how this site takes an enquiry. A WhatsApp-first or phone-first
// business has no form by design, and hard-stopping it forever is a gate that can never
// go green on a correctly built site. `form` (default) keeps the original behaviour.
const LEAD_CAPTURE = (() => {
  try {
    const m = fs.readFileSync('config/project-config.md', 'utf8').match(/^LEAD_CAPTURE:(.*)$/m);
    if (m) {
      const v = m[1].split('#')[0].trim().toLowerCase();
      if (v) return v;
    }
  } catch { /* no config: assume a form, as before */ }
  return 'form';
})();
const FORMLESS = ['whatsapp', 'phone', 'none'].includes(LEAD_CAPTURE);

const cfgFiles = fs.existsSync('config') ? fs.readdirSync('config').filter((f) => /^formaloo\..+\.json$/.test(f)) : [];
if (FORMLESS) {
  console.log(`PASS no form by design - LEAD_CAPTURE: ${LEAD_CAPTURE}. Enquiries arrive`);
  console.log('     through that channel, so there is no config/formaloo.<key>.json to read.');
  process.exit(0);
}
if (!cfgFiles.length) { console.error('FAIL no config/formaloo.<key>.json'); process.exit(1); }

const rows = []; const detail = [];
const add = (c, fails, note = '') => {
  rows.push([c, fails.length ? `FAIL (${fails.length})` : 'PASS', note]);
  for (const f of fails) detail.push(`  [${c}] ${f}`);
};

const missingFn = [], slugDrift = [], choiceDrift = [], keyInBundle = [], purposeCopy = [];
for (const file of cfgFiles) {
  const c = JSON.parse(fs.readFileSync(path.join('config', file), 'utf8'));
  // TWO supported shapes (formaloo-forms skill): a Function per form, OR one
  // functions/api/inquiry.js proxy with a `form` discriminator, whose per-form contract is
  // compiled into functions/api/_formaloo-map.js. Only the first was ever checked, so every
  // project on the documented proxy architecture failed function-exists with nothing wrong.
  // THIRD SHAPE (2026-09-05): the form config names its own Pages Function in `function`
  // ("/api/lead"), and a project may implement it as .js rather than .ts. Checking only
  // `${key}.ts` and the inquiry.js proxy failed a site whose two Functions exist, are
  // live and are named by the config the gate had already read.
  const declared = String(c.function || '').replace(/^\/+/, '').split('/').pop();
  const candidates = [`${c.key}.ts`, `${c.key}.js`, declared ? `${declared}.ts` : '', declared ? `${declared}.js` : '']
    .filter(Boolean)
    .map((n) => path.join('functions', 'api', n));
  let fnPath = candidates.find((p) => fs.existsSync(p)) ?? candidates[0];
  const proxyPath = path.join('functions', 'api', 'inquiry.js');
  const mapPath = path.join('functions', 'api', '_formaloo-map.js');
  let fn;
  if (fs.existsSync(fnPath)) {
    fn = fs.readFileSync(fnPath, 'utf8');
  } else if (fs.existsSync(proxyPath) && fs.existsSync(mapPath)) {
    // Assert against proxy + compiled map together: the map holds the slug, the submit URL
    // and the alias/choice allowlist that the per-form Function would otherwise carry.
    fnPath = `${proxyPath} + ${mapPath}`;
    fn = fs.readFileSync(proxyPath, 'utf8') + String.fromCharCode(10) + fs.readFileSync(mapPath, 'utf8');
  } else {
    missingFn.push(`${c.key}: neither ${fnPath} nor ${proxyPath} + ${mapPath} exists`);
    continue;
  }

  // A Function may DERIVE its allowlist from the contract file instead of restating it:
  // `import cfg from '../../config/formaloo.contact.json'` then iterating cfg.fields
  // handles every field and every choice by construction, and names none of them in its
  // own source. Scanning for literal aliases failed exactly that Function (Insight User
  // Conference, 2026-09-05). When the Function imports this key's contract, the
  // enumeration IS the contract, so there is nothing left for this check to compare.
  const derivesFromContract =
    new RegExp(`formaloo\.${c.key}\.json|formaloo\.json`).test(fn);
  if (!derivesFromContract) {
    if (!fn.includes(c.slug)) slugDrift.push(`${c.key}: FORM_SLUG "${c.slug}" not found in ${fnPath}`);
    if (!/form-displays\/slug\//.test(fn)) slugDrift.push(`${c.key}: ${fnPath} does not POST to the public display endpoint`);
  }
  // SCAN THE CODE, NOT THE PROSE. A Function that documents WHY it avoids the
  // authenticated /rows/ path was failed for containing the string it warns against
  // (oncurio.com, 2026-09-05). Strip comments before asserting on what the code calls.
  const fnCode = fn.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
  if (/\/rows\b/.test(fnCode)) slugDrift.push(`${c.key}: ${fnPath} still uses the authenticated rows path (it 500s from inside a Worker)`);

  for (const f of (derivesFromContract ? [] : c.fields ?? [])) {
    // The display endpoint is keyed by FIELD SLUG, so a Function that maps the slug
    // handles the field whatever it calls the input locally. Requiring the provider's
    // alias verbatim failed a correct Function whose own field name was "budget"
    // against Formaloo's alias "budget_band".
    const handled = fn.includes(f.alias) || (f.slug && fn.includes(f.slug));
    if (!handled) choiceDrift.push(`${c.key}: field "${f.alias}" (slug ${f.slug || 'none'}) is in neither the Function's allowlist nor its slug map`);
    for (const ch of f.choices ?? []) {
      if (!fn.includes(ch.slug)) choiceDrift.push(`${c.key}: choice slug "${ch.slug}" (${f.alias}) missing from the Function's choice map`);
    }
  }

  // Compliance copy must match the purpose.
  const pageGlob = [];
  const walk = (d) => { if (!fs.existsSync(d)) return; for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith('.astro')) pageGlob.push(p); } };
  walk(path.join('src', 'pages'));
  for (const p of pageGlob) {
    const src = fs.readFileSync(p, 'utf8');
    if (!src.includes(`formKey="${c.key}"`)) continue;
    if (c.purpose === 'partner-pitch' && /tcpa|autodial|911/i.test(src)) {
      purposeCopy.push(`${p} uses partner-pitch form "${c.key}" but renders consumer compliance copy`);
    }
  }
}

// The display key must never reach the client bundle.
if (fs.existsSync('dist/_astro')) {
  for (const f of fs.readdirSync('dist/_astro').filter((x) => x.endsWith('.js'))) {
    const js = fs.readFileSync(path.join('dist/_astro', f), 'utf8');
    for (const file of cfgFiles) {
      const c = JSON.parse(fs.readFileSync(path.join('config', file), 'utf8'));
      if (c.displayKey && js.includes(c.displayKey)) keyInBundle.push(`${f}: contains the display key for ${c.key}`);
      if (/x-api-key|FORMALOO/i.test(js)) keyInBundle.push(`${f}: contains an API-key reference`);
    }
  }
}

add('function-exists', missingFn);
add('slug-and-endpoint', slugDrift);
add('alias-choice-map', [...new Set(choiceDrift)]);
add('purpose-vs-copy', purposeCopy, 'a consumer-lead form on a B2B page is a liability');
add('no-key-in-bundle', [...new Set(keyInBundle)]);

console.log('CHECK              | RESULT     | NOTE');
for (const [c, r, n] of rows) console.log(`${c.padEnd(18)} | ${r.padEnd(10)} | ${n}`);
if (detail.length) { console.log('\nDETAIL:'); for (const d of detail) console.log(d); }
const failed = rows.filter((r) => r[1].startsWith('FAIL')).length;
console.log(`\nforms=${cfgFiles.length} failed=${failed}`);
// contracts section-1b: every gate prints WHAT IT MEASURED, not only what
// failed - the fixed shape `checked=<n> failed=<m>` on the verdict line.
console.log(`check-form-sync: checked=${cfgFiles.length} failed=${failed ? 1 : 0}`);
console.log(failed ? 'FAIL check:form' : 'PASS check:form');
process.exit(failed ? 1 : 0);
