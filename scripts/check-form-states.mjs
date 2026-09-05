#!/usr/bin/env node
// kit:check-form-states@1.0.0 — the four states of the lead form, DRIVEN, not inspected.
// Usage: node scripts/check-form-states.mjs [--all | <slug>...]
//
// WHY THIS GATE EXISTS (2026-09-02): forms were gated hard for what they COLLECT
// (check-form-sync: the registry and the markup agree) and for WHO they collect it for
// (check-form-purpose: a consumer-lead form never ships on a B2B page), plus a live smoke
// test of the endpoint. Error, validation, loading and success had no design contract and
// no gate — on a lead-gen archetype that is the highest-value screen on the site, and it
// was the one screen nothing measured.
//
// This script does not read markup for attributes that suggest a state exists. It SUBMITS
// the form in a browser, with the network stubbed, and asserts what a reader would see:
//   INVALID  submit empty -> a message per offending field, aria-invalid on the control,
//            focus moved to the first one, and no navigation.
//   LOADING  a hung request -> the submit is disabled and the form reports aria-busy.
//   ERROR    a refusal -> one role="alert" region, visible, with every typed value intact.
//   SUCCESS  an ok -> a role="status" panel, the fields gone, focus moved into the panel.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const argv = process.argv.slice(2);
const failures = [];
const fail = (route, state, msg) => failures.push(`${route} [${state}] ${msg}`);

function builtRoutes() {
  const out = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (e.name !== 'index.html') continue;
      const html = fs.readFileSync(p, 'utf8');
      if (!/<form[^>]*data-form-key/.test(html)) continue;      // only pages that carry a form
      let r = '/' + path.relative('dist', p).replace(/\\/g, '/').replace(/index\.html$/, '');
      out.push(r.replace(/\/{2,}/g, '/'));
    }
  };
  walk('dist');
  return out.sort();
}

const all = builtRoutes();
const target = argv.find((a) => !a.startsWith('--'));
const routes = target ? all.filter((r) => r.includes(target)) : all;
// A gate that measures nothing must not report PASS (contracts_check `gate-not-vacuous`):
// run before `astro build`, or from the wrong directory, this would otherwise go green on
// an empty tree. dist/ with pages but no form is a different, legitimate answer.
if (!fs.existsSync('dist')) { console.error('FAIL dist/ not found - run `npm run build` first.'); process.exit(1); }
const anyPage = fs.readdirSync('dist', { recursive: true }).some?.((f) => String(f).endsWith('index.html'));
if (!anyPage) { console.error('FAIL dist/ contains no built page - run `npm run build` first.'); process.exit(1); }
if (!all.length) {
  console.log('PASS check-form-states (dist/ is built and no page renders a registry form)');
  process.exit(0);
}
if (!routes.length) { console.error(`FAIL no built route matched "${target}"`); process.exit(1); }

const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  let file = path.join('dist', p);
  if (p.endsWith('/')) file = path.join(file, 'index.html');
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('404'); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' });
  res.end(fs.readFileSync(file));
});
await new Promise((r) => server.listen(0, r));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;

const { chromium } = await import('playwright');
const browser = await chromium.launch();

/** Stub the form endpoint. `mode` decides what the reader gets back. */
async function open(route, mode) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const page = await ctx.newPage();
  await page.route('**/api/**', async (r) => {
    if (mode === 'hang') { await new Promise(() => {}); return; }
    if (mode === 'refuse') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, message: 'We could not send that just now.' }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });
  await page.goto(ORIGIN + route, { waitUntil: 'load' });
  return { ctx, page };
}

const fillAll = async (page) => page.evaluate(() => {
  const form = document.querySelector('form[data-form-key]');
  for (const ctl of form.querySelectorAll('input, select, textarea')) {
    if (ctl.type === 'hidden' || ctl.closest('[aria-hidden="true"]')) continue;
    if (ctl.tagName === 'SELECT') { const o = [...ctl.options].find((x) => x.value); if (o) ctl.value = o.value; }
    else if (ctl.type === 'email') ctl.value = 'reader@example.com';
    else if (ctl.type === 'tel') ctl.value = '+65 8000 0000';
    else ctl.value = 'A sentence a real reader would type.';
    ctl.dispatchEvent(new Event('input', { bubbles: true }));
  }
});

for (const route of routes) {
  // ---- INVALID -------------------------------------------------------------------------
  {
    const { ctx, page } = await open(route, 'ok');
    const hasRequired = await page.evaluate(() => !!document.querySelector('form[data-form-key] [required]'));
    if (hasRequired) {
      const before = page.url();
      await page.click('form[data-form-key] [type=submit]');
      await page.waitForTimeout(250);
      const v = await page.evaluate(() => {
        const form = document.querySelector('form[data-form-key]');
        const shown = [...form.querySelectorAll('[data-field-error]')].filter((e) => !e.hidden && e.textContent.trim());
        return {
          state: form.dataset.state,
          invalid: form.querySelectorAll('[aria-invalid="true"]').length,
          messages: shown.length,
          described: [...form.querySelectorAll('[aria-invalid="true"]')].every((c) => c.getAttribute('aria-describedby')),
          focused: document.activeElement && document.activeElement.getAttribute('aria-invalid') === 'true',
          colourOnly: shown.every((e) => e.textContent.trim().length > 3),
        };
      });
      if (page.url() !== before) fail(route, 'invalid', 'the browser navigated — an empty required form must not POST');
      if (!v.invalid) fail(route, 'invalid', 'no control carries aria-invalid after submitting an empty required form');
      if (!v.messages) fail(route, 'invalid', 'no per-field message is shown — the reader is told something is wrong but not what');
      if (!v.described) fail(route, 'invalid', 'an invalid control has no aria-describedby pointing at its message');
      if (!v.focused) fail(route, 'invalid', 'focus was not moved to the first invalid control');
      if (!v.colourOnly) fail(route, 'invalid', 'a validation signal carries no text — colour alone is not a message');
      if (v.state !== 'invalid') fail(route, 'invalid', `form data-state is "${v.state}" (want "invalid")`);
    }
    await ctx.close();
  }

  // ---- LOADING -------------------------------------------------------------------------
  {
    const { ctx, page } = await open(route, 'hang');
    await fillAll(page);
    await page.click('form[data-form-key] [type=submit]');
    await page.waitForTimeout(300);
    const l = await page.evaluate(() => {
      const form = document.querySelector('form[data-form-key]');
      const btn = form.querySelector('[type=submit]');
      return { state: form.dataset.state, busy: form.getAttribute('aria-busy'), disabled: !!btn.disabled };
    });
    if (l.state !== 'loading') fail(route, 'loading', `form data-state is "${l.state}" during an in-flight submit`);
    if (l.busy !== 'true') fail(route, 'loading', 'form does not report aria-busy while submitting');
    if (!l.disabled) fail(route, 'loading', 'the submit button stays clickable — an impatient second click is a duplicate lead');
    await ctx.close();
  }

  // ---- ERROR ---------------------------------------------------------------------------
  {
    const { ctx, page } = await open(route, 'refuse');
    await fillAll(page);
    const typed = await page.evaluate(() => [...document.querySelectorAll('form[data-form-key] input:not([type=hidden])')].map((i) => i.value));
    await page.click('form[data-form-key] [type=submit]');
    await page.waitForTimeout(400);
    const e = await page.evaluate(() => {
      const form = document.querySelector('form[data-form-key]');
      const err = form.querySelector('[data-form-error]');
      const cs = err ? getComputedStyle(err) : null;
      return {
        state: form.dataset.state,
        visible: !!err && !err.hidden && cs.display !== 'none' && err.textContent.trim().length > 0,
        role: err && err.getAttribute('role'),
        values: [...form.querySelectorAll('input:not([type=hidden])')].map((i) => i.value),
        stillDisabled: !!form.querySelector('[type=submit]').disabled,
      };
    });
    if (!e.visible) fail(route, 'error', 'the server refused and the reader was told nothing');
    if (e.role !== 'alert') fail(route, 'error', `the error region has role="${e.role}" (want "alert" — it appears after the reader has moved on)`);
    if (JSON.stringify(e.values) !== JSON.stringify(typed)) fail(route, 'error', 'typed values were lost on a refusal');
    if (e.stillDisabled) fail(route, 'error', 'the submit button is still disabled after a refusal — the reader cannot retry');
    if (e.state !== 'error') fail(route, 'error', `form data-state is "${e.state}" (want "error")`);
    await ctx.close();
  }

  // ---- SUCCESS -------------------------------------------------------------------------
  {
    const { ctx, page } = await open(route, 'ok');
    await fillAll(page);
    await page.click('form[data-form-key] [type=submit]');
    await page.waitForTimeout(400);
    const okv = await page.evaluate(() => {
      const form = document.querySelector('form[data-form-key]');
      const ok = form.querySelector('[data-form-success]');
      const visibleFields = [...form.querySelectorAll('.field')].filter((f) => f.offsetParent !== null).length;
      return {
        state: form.dataset.state,
        visible: !!ok && !ok.hidden && ok.textContent.trim().length > 0,
        role: ok && ok.getAttribute('role'),
        visibleFields,
        focusInside: !!ok && ok.contains(document.activeElement),
        nextStep: !!ok && ok.textContent.trim().split(/\s+/).length >= 8,
      };
    });
    if (!okv.visible) fail(route, 'success', 'a successful submit renders no confirmation');
    if (okv.role !== 'status') fail(route, 'success', `the confirmation has role="${okv.role}" (want "status")`);
    if (okv.visibleFields) fail(route, 'success', `${okv.visibleFields} field(s) are still on screen after success — the reader can send it twice`);
    if (!okv.focusInside) fail(route, 'success', 'focus was not moved into the confirmation');
    if (!okv.nextStep) fail(route, 'success', 'the confirmation does not say what happens next');
    if (okv.state !== 'success') fail(route, 'success', `form data-state is "${okv.state}" (want "success")`);
    await ctx.close();
  }

  console.log(`${route.padEnd(34)} | invalid loading error success`);
}

await browser.close();
server.close();

console.log(`\nforms=${routes.length} failures=${failures.length}`);
if (failures.length) { console.log('\nFAILURES:'); for (const f of failures) console.log('  ' + f); }
console.log(failures.length ? 'FAIL check-form-states' : 'PASS check-form-states');
// contracts section-1b: every gate prints WHAT IT MEASURED, not only what
// failed - the fixed shape `checked=<n> failed=<m>` on the verdict line.
console.log(`check-form-states: checked=${routes.length} failed=${failures.length}`);
process.exit(failures.length ? 1 : 0);
