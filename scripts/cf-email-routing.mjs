#!/usr/bin/env node
/**
 * cf-email-routing.mjs — provision branded mailboxes on Cloudflare Email Routing.
 *
 *   node scripts/cf-email-routing.mjs --domain example.com --addresses hello,editorial --forward you@gmail.com
 *   node scripts/cf-email-routing.mjs --from-config --domain example.com   # FORWARD_TO + EDITORIAL_EMAIL from config/project-config.md
 *   node scripts/cf-email-routing.mjs --verify --domain example.com
 *
 * Enables routing, adds the MX/TXT records the API prescribes (the fallback when
 * /email/routing/enable errors on the token), creates the destination address (which triggers
 * Cloudflare's verification email — the OWNER must click it) and the rules.
 * Exit 1 on any FAIL. Node 20+, stdlib only.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
const argv = process.argv.slice(2);
const arg = (n, d = null) => argv.includes(`--${n}`) ? (argv[argv.indexOf(`--${n}`) + 1] || 'true') : d;
const ex = p => { try { fs.accessSync(p); return true; } catch { return false; } };
const rd = p => fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
function env(k) {
  if (process.env[k]) return process.env[k];
  const f = path.join(os.homedir(), '.claude', '.env');
  if (ex(f)) for (const line of rd(f).split(/\r?\n/)) { const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && m[1] === k) return m[2].replace(/^["']|["']$/g, ''); }
  return null;
}
const token = env('CLOUDFLARE_API_TOKEN'), account = env('CLOUDFLARE_ACCOUNT_ID');
const domain = arg('domain');
if (!token || !account) { console.error('FAIL: CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID not resolvable.'); process.exit(1); }
if (!domain) { console.error('FAIL: --domain <example.com> required.'); process.exit(1); }
const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const api = async (method, url, body) => {
  const r = await fetch('https://api.cloudflare.com/client/v4' + url, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({ success: false, errors: [{ message: `HTTP ${r.status}` }] }));
  return j;
};
const zoneRes = await api('GET', `/zones?name=${encodeURIComponent(domain)}`);
const zone = (zoneRes.result || [])[0];
if (!zone) { console.error(`FAIL: zone ${domain} not found on this account.`); process.exit(1); }
const rows = [];
const add = (n, v, ok) => rows.push([n, v, ok ? 'PASS' : 'FAIL']);

if (arg('verify') === 'true') {
  const rules = await api('GET', `/zones/${zone.id}/email/routing/rules`);
  const dests = await api('GET', `/accounts/${account}/email/routing/addresses`);
  for (const r of (rules.result || [])) {
    const to = ((r.matchers || [])[0] || {}).value || '';
    const fwd = (((r.actions || [])[0] || {}).value || [])[0] || '';
    const d = (dests.result || []).find(x => x.email === fwd);
    add(`rule ${to} -> ${fwd}`, d && d.verified ? 'verified' : 'UNVERIFIED', !!(d && d.verified));
  }
  if (!(rules.result || []).length) add('routing rules', 'none', false);
} else {
  // --from-config reads FORWARD_TO and EDITORIAL_EMAIL out of the project's own
  // config instead of asking the operator to retype a private address. The launch
  // skill cited this flag for months while the script ignored it, so the command
  // it named as the provisioning step exited 1 every single time.
  const fromConfig = argv.includes('--from-config');
  const cfgTxt = ex('config/project-config.md') ? rd('config/project-config.md') : '';
  const cfgVal = (k) => {
    const m = cfgTxt.match(new RegExp('^' + k + ':\\s*(.+)$', 'm'));
    return m ? m[1].split('#')[0].trim() : '';
  };
  const forward = arg('forward') || (fromConfig ? cfgVal('FORWARD_TO') : null);
  const cfgLocal = (cfgVal('EDITORIAL_EMAIL').split('@')[0] || '').trim();
  const addresses = (arg('addresses') || (fromConfig && cfgLocal ? cfgLocal : 'hello'))
    .split(',').map(s => s.trim()).filter(Boolean);
  if (!forward) {
    console.error(fromConfig
      ? 'FAIL: --from-config found no FORWARD_TO: in config/project-config.md'
      : 'FAIL: --forward <destination@example.com> required (or --from-config).');
    process.exit(1);
  }
  const enable = await api('POST', `/zones/${zone.id}/email/routing/enable`, {});
  add('email routing enabled', enable.success ? 'yes' : `API said: ${(enable.errors || [{}])[0].message} (falling back to DNS records)`, true);
  const dns = await api('GET', `/zones/${zone.id}/email/routing/dns`);
  let dnsOk = 0, dnsTotal = 0;
  for (const rec of (dns.result || [])) {
    dnsTotal++;
    const r = await api('POST', `/zones/${zone.id}/dns_records`, { type: rec.type, name: rec.name, content: rec.content, priority: rec.priority, ttl: 1 });
    if (r.success || (r.errors || []).some(e => /already exists|identical record/i.test(e.message || ''))) dnsOk++;
  }
  add('MX + SPF records present', `${dnsOk}/${dnsTotal}`, dnsTotal === 0 || dnsOk === dnsTotal);
  const dest = await api('POST', `/accounts/${account}/email/routing/addresses`, { email: forward });
  add('destination address registered', dest.success ? 'created (verification email sent)' : ((dest.errors || [{}])[0].message || 'exists'), true);
  for (const a of addresses) {
    const rule = await api('POST', `/zones/${zone.id}/email/routing/rules`, {
      name: `${a}@${domain}`, enabled: true,
      matchers: [{ type: 'literal', field: 'to', value: `${a}@${domain}` }],
      actions: [{ type: 'forward', value: [forward] }]
    });
    add(`rule ${a}@${domain}`, rule.success ? 'created' : ((rule.errors || [{}])[0].message || 'exists'), rule.success || (rule.errors || []).some(e => /already exists/i.test(e.message || '')));
  }
}
console.log('check'.padEnd(46) + 'value'.padEnd(34) + 'result');
console.log('-'.repeat(92));
for (const r of rows) console.log(String(r[0]).padEnd(46) + String(r[1]).padEnd(34) + r[2]);
const failed = rows.filter(r => r[2] === 'FAIL').length;
console.log(failed ? 'EMAIL_ROUTING_FAIL' : 'EMAIL_ROUTING_OK');
console.log('OWNER ACTION: click Cloudflare\'s destination-verification email, then send a real test mail to the branded address and confirm arrival. An unverified destination silently drops mail.');
process.exit(failed ? 1 : 0);
