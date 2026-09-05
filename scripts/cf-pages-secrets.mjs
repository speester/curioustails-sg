#!/usr/bin/env node
/**
 * cf-pages-secrets.mjs — set a secret on a Cloudflare Pages project through the Pages API for
 * production AND preview. NEVER `wrangler secret put` (it truncates values ending in `==`).
 *
 *   node scripts/cf-pages-secrets.mjs --set FORMALOO_API_KEY --both
 *   node scripts/cf-pages-secrets.mjs --verify FORMALOO_API_KEY
 *
 * Reads CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID and the secret's VALUE from ~/.claude/.env
 * (never printed). CLOUDFLARE_PROJECT comes from --project or config/project-config.md.
 * Secrets bind only on a NEW deployment — redeploy after setting.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const argv = process.argv.slice(2);
const arg = (n, d = null) => argv.includes(`--${n}`) ? (argv[argv.indexOf(`--${n}`) + 1] || 'true') : d;
const ex = p => { try { fs.accessSync(p); return true; } catch { return false; } };
const rd = p => fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
function envAll() {
  const out = { ...process.env };
  const f = path.join(os.homedir(), '.claude', '.env');
  if (ex(f)) for (const line of rd(f).split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}
const E = envAll();
const cfgText = ex('config/project-config.md') ? rd('config/project-config.md') : '';
const project = arg('project') || (cfgText.match(/^\s*[-*]?\s*`?CLOUDFLARE_PROJECT`?\s*[:=]\s*(.+)$/mi) || [])[1]?.trim();
const token = E.CLOUDFLARE_API_TOKEN, account = E.CLOUDFLARE_ACCOUNT_ID;
if (!token || !account) { console.error('FAIL: CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID not resolvable (~/.claude/.env).'); process.exit(1); }
if (!project) { console.error('FAIL: CLOUDFLARE_PROJECT not found (--project or config/project-config.md).'); process.exit(1); }
const API = `https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/${project}`;

async function getProject() {
  const r = await fetch(API, { headers: { Authorization: `Bearer ${token}` } });
  const j = await r.json();
  if (!j.success) { console.error(`FAIL: GET project -> ${JSON.stringify(j.errors)}`); process.exit(1); }
  return j.result;
}
const verifyName = arg('verify');
if (verifyName) {
  const p = await getProject();
  const rows = ['production', 'preview'].map(envName => {
    const v = ((p.deployment_configs || {})[envName] || {}).env_vars || {};
    const hit = v[verifyName];
    return [envName, hit ? (hit.type || 'plain_text') : 'MISSING', hit ? 'PASS' : 'FAIL'];
  });
  console.log('environment'.padEnd(16) + 'binding'.padEnd(16) + 'result');
  console.log('-'.repeat(44));
  for (const r of rows) console.log(String(r[0]).padEnd(16) + String(r[1]).padEnd(16) + r[2]);
  const failed = rows.filter(r => r[2] === 'FAIL').length;
  console.log(failed ? 'SECRETS_FAIL' : 'SECRETS_OK');
  process.exit(failed ? 1 : 0);
}
const name = arg('set');
if (!name) { console.error('FAIL: --set <NAME> or --verify <NAME> is required.'); process.exit(1); }
const value = E[name];
if (!value) { console.error(`FAIL: ${name} has no value in the environment or ~/.claude/.env.`); process.exit(1); }
const envs = argv.includes('--both') ? ['production', 'preview'] : [arg('env', 'production')];
const body = { deployment_configs: {} };
for (const e of envs) body.deployment_configs[e] = { env_vars: { [name]: { type: 'secret_text', value } } };
const r = await fetch(API, { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const j = await r.json();
console.log('environment'.padEnd(16) + 'action'.padEnd(24) + 'result');
console.log('-'.repeat(52));
for (const e of envs) console.log(String(e).padEnd(16) + `set ${name} (secret_text)`.padEnd(24) + (j.success ? 'PASS' : 'FAIL'));
if (!j.success) { console.error(JSON.stringify(j.errors)); console.log('SECRETS_FAIL'); process.exit(1); }
console.log('\nSECRETS_OK — secrets bind only on a NEW deployment: redeploy now.');
