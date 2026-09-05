#!/usr/bin/env node
/**
 * formaloo-provision.mjs — provision EVERY form in config/forms.json (idempotent per form).
 *
 *   node scripts/formaloo-provision.mjs --all [--only contact] [--recreate contact]
 *
 * Writes config/formaloo.json (live map + api_facts). Exit 1 on any failure.
 */
import { createForm, createField, readChoices, loadJson, saveJson, FACTS, token, BASE } from './formaloo-api.mjs';

const argv = process.argv.slice(2);
const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null;
const recreate = argv.includes('--recreate') ? argv[argv.indexOf('--recreate') + 1] : null;

const forms = loadJson('config/forms.json');
if (!forms || !Array.isArray(forms.forms) || !forms.forms.length) { console.error('FAIL: config/forms.json missing or has no forms[].'); process.exit(1); }
const out = loadJson('config/formaloo.json', { generated_at: null, mode: 'native', api_facts: {}, live: {}, honeypot_field: 'company_website' });
const workspace = forms.workspace || null;
const results = [];

for (const f of forms.forms) {
  if (only && f.id !== only) continue;
  const existing = out.live[f.id];
  if (existing && existing.slug && f.id !== recreate) {
    results.push([f.id, 'already provisioned', 'PASS']);
    continue;
  }
  try {
    const form = await createForm({
      title: f.title, address: f.address,
      send_emails_to: f.notify_email, submit_email_notif: true, send_user_confirm: true,
      success_message: f.success_message, error_message: f.error_message || 'Something went wrong — please email us instead.',
      button_text: f.button_text, allow_indexing: false, has_recaptcha: false
    }, workspace);
    const fields = [];
    for (const spec of f.fields) {
      const created = await createField(form.slug, spec, workspace);
      const entry = { alias: spec.alias, slug: created.slug, type: spec.type, title: spec.title, required: !!spec.required, position: spec.position, hidden: spec.type === 'hidden' };
      if (spec.type === 'dropdown') {
        const choices = await readChoices(created.slug, workspace);
        if (!choices.length) throw new Error(`dropdown ${spec.alias}: read-back choice list is EMPTY — do not submit against it`);
        entry.choices = choices;
      }
      fields.push(entry);
    }
    out.live[f.id] = {
      slug: form.slug, address: form.address, display_key: form.display_key,
      submit_url: `${BASE}/form-displays/slug/${form.slug}/submit/`,
      notify_email: f.notify_email, ga4_event: f.ga4_event, success_url: f.success_url,
      endpoint: f.endpoint, fields
    };
    results.push([f.id, `${fields.length} fields`, 'PASS']);
  } catch (e) {
    results.push([f.id, e.message.slice(0, 60), 'FAIL']);
  }
}
out.api_facts = { ...out.api_facts, ...FACTS };
out.generated_at = new Date().toISOString();
saveJson('config/formaloo.json', out);

// W10.3 - THE FILE THE HARD-STOP READS. astro-build HARD-STOPS on
// `gen-formaloo-map.mjs`, and that script (with check-form-sync.mjs) reads ONE FLAT
// `config/formaloo.<key>.json` per form — `{slug, address, display_key, submit_url,
// notify_email, ga4_event, success_url, endpoint, default_dial_code, fields[]}`. This
// provisioner only ever wrote the nested `config/formaloo.json{live:{}}`, so the per-key
// files were HAND-AUTHORED in a third vocabulary and the HARD-STOP fired on every project
// that had actually provisioned its forms. Write both: formaloo.json keeps the api_facts,
// and each live form is emitted in the exact shape its consumer reads.
for (const [key, live] of Object.entries(out.live)) {
  const flat = { ...live };
  // COUNTRY -> default_dial_code, the one derived value gen-formaloo-map warns about.
  if (!flat.default_dial_code && out.default_dial_code) flat.default_dial_code = out.default_dial_code;
  flat.honeypot_field = out.honeypot_field;
  flat.generated_at = out.generated_at;
  saveJson(`config/formaloo.${key}.json`, flat);
  console.log(`wrote config/formaloo.${key}.json (${(flat.fields || []).length} fields)`);
}

console.log('form'.padEnd(18) + 'detail'.padEnd(44) + 'result');
console.log('-'.repeat(70));
for (const r of results) console.log(String(r[0]).padEnd(18) + String(r[1]).padEnd(44) + r[2]);
const failed = results.filter(r => r[2] === 'FAIL').length;
console.log(`\nforms=${results.length} failed=${failed} auth_variant=${FACTS.auth_variant} field_variant=${FACTS.field_variant} choice_value_format=${FACTS.choice_value_format}`);
console.log(failed ? 'PROVISION_FAIL' : 'PROVISION_OK');
process.exit(failed ? 1 : 0);
