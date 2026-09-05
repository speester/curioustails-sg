#!/usr/bin/env node
/**
 * formaloo-api.mjs — the ONLY place Formaloo HTTP shapes live. Every call tries the documented
 * variant first and the recorded fallback second, and records what worked in api_facts.
 * Node 20+, stdlib only. Imported by formaloo-provision/smoke/list/delete-test-rows.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export const BASE = 'https://api.formaloo.me/v3.0';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const ex = p => { try { fs.accessSync(p); return true; } catch { return false; } };
const rd = p => fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '');

export const FACTS = { base: BASE, auth_variant: null, field_variant: null, submit_path: '/form-displays/slug/{FORM_SLUG}/submit/', submit_key: 'api_key', delete_variant: null, choice_value_format: 'slug' };

export function creds() {
  let k = process.env.FORMALOO_API_KEY, s = process.env.FORMALOO_API_SECRET;
  const envFile = path.join(os.homedir(), '.claude', '.env');   // global file is the source of truth
  if ((!k || !s) && ex(envFile)) for (const line of rd(envFile).split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue;
    const v = m[2].replace(/^["']|["']$/g, '');
    if (m[1] === 'FORMALOO_API_KEY' && !k) k = v;
    if (m[1] === 'FORMALOO_API_SECRET' && !s) s = v;
  }
  return { key: k || null, secret: s || null };
}

async function raw(method, url, { headers = {}, body = null } = {}) {
  const res = await fetch(url, { method, headers: { 'User-Agent': UA, ...headers }, body });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch { }
  return { status: res.status, ok: res.ok, json, text };
}

/** Mint a JWT. Variant A: Basic secret. Variant B: client_id/client_secret multipart. */
export async function token() {
  const { key, secret } = creds();
  if (!key || !secret) throw new Error('FORMALOO_API_KEY / FORMALOO_API_SECRET not resolvable (~/.claude/.env)');
  const url = `${BASE}/oauth2/authorization-token/`;
  const fdA = new FormData(); fdA.append('grant_type', 'client_credentials');
  let r = await raw('POST', url, { headers: { 'x-api-key': key, Authorization: `Basic ${secret}` }, body: fdA });
  if (r.ok && r.json && r.json.authorization_token) { FACTS.auth_variant = 'A'; return r.json.authorization_token; }
  const fdB = new FormData();
  fdB.append('grant_type', 'client_credentials'); fdB.append('client_id', key); fdB.append('client_secret', secret);
  r = await raw('POST', url, { headers: { 'x-api-key': key }, body: fdB });
  if (r.ok && r.json && r.json.authorization_token) { FACTS.auth_variant = 'B'; return r.json.authorization_token; }
  throw new Error(`token exchange failed (both variants): HTTP ${r.status} ${r.text.slice(0, 200)}`);
}

function provHeaders(jwt, workspace) {
  const { key } = creds();
  const h = { 'x-api-key': key, Authorization: `JWT ${jwt}`, 'Content-Type': 'application/json' };
  if (workspace && workspace !== 'N/A') h['x-workspace'] = workspace;
  return h;
}
const unwrapForm = b => (b && b.data && b.data.form) || (b && b.data) || b;

export async function createForm(spec, workspace) {
  const jwt = await token();
  const r = await raw('POST', `${BASE}/forms/`, { headers: provHeaders(jwt, workspace), body: JSON.stringify(spec) });
  if (!r.ok) throw new Error(`create form failed: HTTP ${r.status} ${r.text.slice(0, 200)}`);
  const form = unwrapForm(r.json);
  if (!form || !form.slug || !form.address) throw new Error(`create form returned no slug/address: ${r.text.slice(0, 200)}`);
  return { slug: form.slug, address: form.address, display_key: form.display_key || form.public_key || null };
}

const TYPE_PATH = { short_text: 'short_text', long_text: 'long_text', email: 'email', phone: 'phone', dropdown: 'dropdown', date: 'date', hidden: 'hidden' };

export async function createField(formSlug, field, workspace) {
  const jwt = await token();
  const body = { form: formSlug, title: field.title, alias: field.alias, position: field.position, required: !!field.required };
  if (field.type === 'dropdown' && (field.choices || field.bulk_choices)) body.bulk_choices = field.choices || field.bulk_choices;
  if (field.type === 'hidden') body.invisible = true;
  let r = await raw('POST', `${BASE}/fields/${TYPE_PATH[field.type]}/`, { headers: provHeaders(jwt, workspace), body: JSON.stringify(body) });
  if (r.ok) { FACTS.field_variant = FACTS.field_variant || 'A'; }
  else {
    const jwt2 = await token();
    r = await raw('POST', `${BASE}/fields/`, { headers: provHeaders(jwt2, workspace), body: JSON.stringify({ ...body, type: field.type }) });
    if (!r.ok) throw new Error(`create field ${field.alias} failed (both variants): HTTP ${r.status} ${r.text.slice(0, 200)}`);
    FACTS.field_variant = 'B';
  }
  const f = (r.json && r.json.data && (r.json.data.field || r.json.data)) || r.json;
  return { slug: f.slug || f.id || null, alias: field.alias };
}

export async function readChoices(fieldSlug, workspace) {
  const jwt = await token();
  const r = await raw('GET', `${BASE}/fields/${fieldSlug}/choices/`, { headers: provHeaders(jwt, workspace) });
  if (!r.ok) return [];
  const list = (r.json && r.json.data && (r.json.data.objects || r.json.data.choices)) || [];
  return list.map(c => ({ title: c.title, slug: c.slug || c.id }));
}

/** Submit keyed on the PRIVATE form slug. `key` is the account api key or the display key. */
export async function submit(formSlug, payload, keyOverride) {
  const { key } = creds();
  const r = await raw('POST', `${BASE}/form-displays/slug/${formSlug}/submit/`, {
    headers: { 'x-api-key': keyOverride || key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ submit_by_alias: true, ...payload })
  });
  return r;
}

export async function readRows(formSlug, workspace, { retries = 5, waitMs = 2000 } = {}) {
  for (let i = 0; i < retries; i++) {
    const jwt = await token();
    const r = await raw('GET', `${BASE}/forms/${formSlug}/rows/`, { headers: provHeaders(jwt, workspace) });
    if (r.ok) {
      const rows = (r.json && r.json.data && (r.json.data.rows || r.json.data.objects)) || [];
      if (rows.length) return rows.map(row => ({
        slug: row.slug || row.id,
        data: Object.fromEntries((row.rendered_data || []).map(d => [d.alias || d.title, d.value ?? d.rendered_value ?? '']))
      }));
    }
    await new Promise(r2 => setTimeout(r2, waitMs));   // rows are not readable immediately after a 201
  }
  return [];
}

export async function deleteRows(formSlug, rowSlugs, workspace) {
  if (!rowSlugs.length) return { deleted: 0, variant: null };
  let jwt = await token();
  let okA = 0;
  for (const s of rowSlugs) {
    const r = await raw('DELETE', `${BASE}/rows/${s}/`, { headers: provHeaders(jwt, workspace) });
    if (r.ok) okA++;
  }
  if (okA === rowSlugs.length) { FACTS.delete_variant = 'A'; return { deleted: okA, variant: 'A' }; }
  jwt = await token();
  const r = await raw('POST', `${BASE}/forms/${formSlug}/rows/bulk-delete/`, {
    headers: provHeaders(jwt, workspace), body: JSON.stringify({ slugs_list: rowSlugs })
  });
  if (r.ok) { FACTS.delete_variant = 'B'; return { deleted: rowSlugs.length, variant: 'B' }; }
  return { deleted: okA, variant: null, manual: `https://app.formaloo.com/forms/${formSlug}` };
}

export function loadJson(p, dflt = null) { return ex(p) ? JSON.parse(rd(p)) : dflt; }
export function saveJson(p, obj) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf8'); }
