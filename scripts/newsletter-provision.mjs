#!/usr/bin/env node
/**
 * newsletter-provision.mjs — create the newsletter list and write config/newsletter.json.
 *
 *   node scripts/newsletter-provision.mjs --provider SendFox --name "Curio weekly"
 *
 * SendFox: POST https://api.sendfox.com/lists with SENDFOX_API_KEY (from ~/.claude/.env).
 * Formaloo: requires a `newsletter` entry in config/forms.json (provisioned by
 * formaloo-provision.mjs); this script only records the contract.
 * Exit 1 when the provider is set but the list could not be created.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
const argv = process.argv.slice(2);
const arg = (n, d = null) => argv.includes(`--${n}`) ? (argv[argv.indexOf(`--${n}`) + 1] || 'true') : d;
const ex = p => { try { fs.accessSync(p); return true; } catch { return false; } };
const rd = p => fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
const cfgText = ex('config/project-config.md') ? rd('config/project-config.md') : '';
const cfg = k => (cfgText.match(new RegExp('^\\s*[-*]?\\s*`?' + k + '`?\\s*[:=]\\s*(.+?)\\s*$', 'mi')) || [])[1]?.replace(/^["'`]|["'`]$/g, '').trim() || '';
const provider = arg('provider', cfg('NEWSLETTER_PROVIDER') || 'none');
const name = arg('name', (cfg('BUSINESS_NAME') || 'Site') + ' newsletter');
if (provider === 'none' || !provider) { console.log('provider=none — no newsletter list, and Newsletter.astro must not render.'); console.log('NEWSLETTER_SKIPPED'); process.exit(0); }
function envVal(k) {
  if (process.env[k]) return process.env[k];
  const f = path.join(os.homedir(), '.claude', '.env');
  if (ex(f)) for (const line of rd(f).split(/\r?\n/)) { const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && m[1] === k) return m[2].replace(/^["']|["']$/g, ''); }
  return null;
}
let listId = null, endpoint = '/api/subscribe';
if (provider.toLowerCase() === 'sendfox') {
  const key = envVal('SENDFOX_API_KEY');
  if (!key) { console.error('FAIL: SENDFOX_API_KEY not resolvable (~/.claude/.env).'); process.exit(1); }
  const res = await fetch('https://api.sendfox.com/lists', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name })
  });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j) { console.error(`FAIL: SendFox list creation -> HTTP ${res.status}`); process.exit(1); }
  listId = (j.data && j.data.id) || j.id;
  if (!listId) { console.error('FAIL: SendFox returned no list id.'); process.exit(1); }
} else if (provider.toLowerCase() === 'formaloo') {
  const forms = ex('config/forms.json') ? JSON.parse(rd('config/forms.json')) : null;
  const entry = forms && (forms.forms || []).find(f => f.id === 'newsletter');
  if (!entry) { console.error('FAIL: NEWSLETTER_PROVIDER=Formaloo but config/forms.json has no `newsletter` entry.'); process.exit(1); }
  const live = ex('config/formaloo.json') ? JSON.parse(rd('config/formaloo.json')).live || {} : {};
  if (!live.newsletter) { console.error('FAIL: the `newsletter` form is not provisioned yet — run formaloo-provision.mjs --all first.'); process.exit(1); }
  listId = live.newsletter.slug; endpoint = entry.endpoint || '/api/subscribe';
} else { console.error(`FAIL: unknown NEWSLETTER_PROVIDER "${provider}".`); process.exit(1); }
const out = { provider, list_id: listId, endpoint, success_url: '/newsletter/thank-you/', ga4_event: 'newsletter_signup', generated_at: new Date().toISOString() };
fs.mkdirSync('config', { recursive: true });
fs.writeFileSync('config/newsletter.json', JSON.stringify(out, null, 2), 'utf8');
console.log('check'.padEnd(34) + 'value'.padEnd(26) + 'result');
console.log('-'.repeat(70));
console.log('provider'.padEnd(34) + String(provider).padEnd(26) + 'PASS');
console.log('list id'.padEnd(34) + String(listId).padEnd(26) + 'PASS');
console.log('config/newsletter.json'.padEnd(34) + 'written'.padEnd(26) + 'PASS');
console.log('\nNEWSLETTER_OK — set the provider secret as a Pages secret (prod + preview) and redeploy.');
