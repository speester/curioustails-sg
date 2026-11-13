// Local review UI for imported listings (spec §6.7, T16).
//
// This server is the owner's front door to the queue, and it only ever exists
// on loopback. REVIEW_HOST is a literal, never read from HOST or an env var:
// a test asserts both the constant and the address the socket actually bound
// to, so an accidental 0.0.0.0 deploy cannot happen quietly.
//
// Requests from a foreign Host header are refused (DNS rebinding), and every
// action needs the per-process token embedded in the page. Approve/Reject/
// Reserve/Unpublish delegate to lib/owner.mjs, where lead-only sources are
// refused for real, not just hidden behind a disabled button.
import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT, openStore } from './lib/store.mjs';
import {
  queueView, approveItem, rejectItem, reserveItem, unpublishItem, OwnerActionError,
} from './lib/owner.mjs';

export const REVIEW_HOST = '127.0.0.1';
export const REVIEW_PORT = 4791;

const PHOTO_RE = /^imp-[0-9a-f]{10}-\d+(-card)?\.webp$/;

const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const attr = (v) => esc(v).replace(/`/g, '&#96;');

function hostnameOf(req) {
  const raw = String(req.headers.host || '');
  if (!raw) return '';
  if (raw.startsWith('[')) return raw.slice(1, raw.indexOf(']'));
  return raw.split(':')[0];
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
    ...headers,
  });
  res.end(body);
}

const sendJson = (res, status, value) => send(res, status, JSON.stringify(value), { 'content-type': 'application/json; charset=utf-8' });

function sendHtml(res, html) {
  send(res, 200, html, { 'content-type': 'text/html; charset=utf-8' });
}

function money(n) {
  return Number.isFinite(n) ? `S$${Number(n).toLocaleString('en-SG')}` : '—';
}

function gateChip(g) {
  const ok = g?.pass !== false;
  const sev = g?.severity ? ` · ${esc(g.severity)}` : '';
  return `<li class="gate ${ok ? 'gate-ok' : 'gate-fail'}" title="${attr(g?.detail)}">
    <span class="gate-id">${esc(g?.gate)}</span>
    <span class="gate-detail">${ok ? 'pass' : esc(g?.detail || 'fail')}${ok ? '' : sev}</span>
  </li>`;
}

function card(q) {
  const photos = (q.photos || []).slice(0, 3);
  const thumbs = photos.length
    ? `<div class="thumbs">${photos.map((p, i) => `<a href="/photo/${attr(p)}" target="_blank" rel="noopener"><img src="/photo/${attr(p)}" alt="${attr(q.photoAlt?.[i] || 'Listing photo')}" loading="lazy"></a>`).join('')}</div>`
    : '<p class="muted">No local photos.</p>';
  const reasons = q.reviewReasons?.length
    ? `<ul class="reasons">${q.reviewReasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>`
    : '<p class="muted">Every gate passed at intake.</p>';
  const source = q.source?.site && q.source?.url
    ? `<a href="${attr(q.source.url)}" target="_blank" rel="noreferrer noopener">${esc(q.source.site)}</a>`
    : '<span class="muted">source hidden</span>';
  const decided = q.decision
    ? `<span class="badge badge-decision">${esc(q.decision)}${q.decidedBy ? ` · ${esc(q.decidedBy)}` : ''}</span>`
    : '';
  const lead = q.leadOnly ? '<span class="badge badge-lead">lead-only — cannot be approved</span>' : '';
  const live = q.live ? `<span class="badge badge-live">live · ${esc(q.liveStatus || '')}</span>` : '';
  const approve = q.approvable
    ? `<button data-action="approve" data-id="${attr(q.id)}">Approve</button>`
    : `<button disabled title="${q.leadOnly ? 'Lead-only source: never publishable' : 'A gate needs an edit first'}">Approve</button>`;
  return `<article class="card" data-id="${attr(q.id)}">
    <header class="card-head">
      <div>
        <h2>${esc(q.breedLabel || q.breed || q.id)}</h2>
        <p class="muted mono">${esc(q.id)} · ${esc(q.disposition || '')} ${lead}${live}${decided}</p>
      </div>
      <div class="price">${money(q.priceSGD)}</div>
    </header>
    <div class="facts">
      <span>${esc(q.sex?.male ?? 0)} male · ${esc(q.sex?.female ?? 0)} female</span>
      <span>${esc(q.age || 'age unknown')}</span>
      <span>${photos.length} photo${photos.length === 1 ? '' : 's'}</span>
      <span>${source}</span>
    </div>
    ${thumbs}
    <ul class="gates">${(q.gates || []).map(gateChip).join('')}</ul>
    ${reasons}
    <footer class="actions">
      ${approve}
      <button class="secondary" data-action="reject" data-id="${attr(q.id)}">Reject</button>
      <button class="secondary" data-action="reserve" data-id="${attr(q.id)}" ${q.live ? '' : 'disabled'}>Reserve</button>
      <button class="danger" data-action="unpublish" data-id="${attr(q.id)}" ${q.live ? '' : 'disabled'}>Unpublish</button>
      <span class="status" aria-live="polite"></span>
    </footer>
  </article>`;
}

function page({ queue, token }) {
  const auto = queue.filter((q) => q.disposition === 'auto-ready').length;
  const review = queue.filter((q) => q.disposition === 'review').length;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="review-token" content="${attr(token)}">
<title>Imported listings review · Curious Tails</title>
<style>
  :root { color-scheme: light; --ink:#1d2320; --muted:#5f6b64; --line:#d9ded9; --bg:#f5f6f2; --card:#fff; --ok:#1f7a4d; --bad:#b3261e; --warn:#8a5a00; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:15px/1.45 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
  header.top { position:sticky; top:0; z-index:2; background:rgba(245,246,242,.96); border-bottom:1px solid var(--line); padding:14px 20px; display:flex; gap:16px; align-items:baseline; flex-wrap:wrap; }
  header.top h1 { font-size:17px; margin:0; }
  header.top .counts { color:var(--muted); font-size:13px; }
  main { max-width:1080px; margin:0 auto; padding:20px; display:grid; gap:18px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:16px; }
  .card-head { display:flex; justify-content:space-between; gap:16px; align-items:flex-start; }
  .card-head h2 { font-size:18px; margin:0 0 4px; }
  .price { font-size:20px; font-weight:700; white-space:nowrap; }
  .mono { font-family:ui-monospace, SFMono-Regular, Consolas, monospace; font-size:12px; }
  .muted { color:var(--muted); }
  .facts { display:flex; gap:14px; flex-wrap:wrap; margin:10px 0; color:var(--muted); font-size:13px; }
  .thumbs { display:flex; gap:8px; margin:10px 0; }
  .thumbs img { width:132px; height:99px; object-fit:cover; border-radius:8px; border:1px solid var(--line); display:block; }
  .gates { list-style:none; display:grid; grid-template-columns:repeat(auto-fill, minmax(118px, 1fr)); gap:6px; padding:0; margin:10px 0; }
  .gate { border:1px solid var(--line); border-radius:7px; padding:5px 7px; font-size:12px; display:flex; flex-direction:column; }
  .gate-ok { background:#f0f7f2; }
  .gate-fail { background:#fdf1ef; border-color:#e7b8b2; }
  .gate-id { font-weight:700; }
  .gate-detail { color:var(--muted); overflow-wrap:anywhere; }
  .reasons { margin:8px 0; padding-left:20px; color:var(--bad); font-size:13px; }
  .badge { display:inline-block; border-radius:999px; padding:2px 8px; font-size:11px; font-weight:700; margin-left:4px; vertical-align:1px; }
  .badge-decision { background:#e8eef9; color:#284a86; }
  .badge-lead { background:#fdecea; color:var(--bad); }
  .badge-live { background:#e9f5ec; color:var(--ok); }
  .actions { display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-top:12px; padding-top:12px; border-top:1px solid var(--line); }
  button { font:inherit; font-weight:650; border-radius:8px; border:1px solid transparent; padding:7px 13px; cursor:pointer; background:#1f5f43; color:#fff; }
  button.secondary { background:#fff; color:var(--ink); border-color:var(--line); }
  button.danger { background:#fff; color:var(--bad); border-color:#e7b8b2; }
  button:disabled { opacity:.45; cursor:not-allowed; }
  .status { color:var(--muted); font-size:13px; }
  .empty { background:var(--card); border:1px dashed var(--line); border-radius:12px; padding:28px; text-align:center; color:var(--muted); }
</style>
</head>
<body>
<header class="top">
  <h1>Imported listings review</h1>
  <span class="counts">auto-ready ${auto} · review ${review} · local only (127.0.0.1)</span>
</header>
<main>
${queue.length ? queue.map(card).join('\n') : '<p class="empty">Queue is empty. Run <code>npm run sync:imports</code> to refresh it.</p>'}
</main>
<script>
  const token = document.querySelector('meta[name="review-token"]').content;
  async function act(button) {
    const card = button.closest('.card');
    const status = card.querySelector('.status');
    const action = button.dataset.action;
    const id = button.dataset.id;
    if (action === 'unpublish' && !confirm('Remove this puppy from the public feed and add a redirect?')) return;
    for (const b of card.querySelectorAll('button')) b.disabled = true;
    status.textContent = action + '…';
    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-review-token': token },
        body: JSON.stringify({ action, id, reason: action === 'unpublish' ? 'owner' : undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
      status.textContent = action + ' recorded. Run sync to publish.';
      setTimeout(() => location.reload(), 700);
    } catch (e) {
      status.textContent = 'Refused: ' + e.message;
      for (const b of card.querySelectorAll('button')) b.disabled = false;
    }
  }
  for (const b of document.querySelectorAll('button[data-action]')) b.addEventListener('click', () => act(b));
</script>
</body>
</html>`;
}

/**
 * createReviewServer({ store, repoRoot?, actor?, now? })
 * → { server, token, listen(port?), close() }
 */
export function createReviewServer({
  store, repoRoot = REPO_ROOT, actor = 'owner:local', now = () => new Date(),
} = {}) {
  if (!store) throw new Error('createReviewServer: store is required');
  const token = randomBytes(16).toString('hex');

  const allowedPhotos = () => {
    const { queue } = queueView({ store, repoRoot });
    const set = new Set();
    for (const q of queue) {
      for (const name of q.photos || []) {
        set.add(name);
        set.add(String(name).replace(/\.webp$/, '-card.webp'));
      }
    }
    return set;
  };

  const handler = async (req, res) => {
    if (hostnameOf(req) !== REVIEW_HOST) {
      send(res, 403, 'forbidden host');
      return;
    }
    const path = String(req.url || '/').split('?')[0];

    if (req.method === 'GET' && path === '/') {
      try {
        sendHtml(res, page({ ...queueView({ store, repoRoot }), token }));
      } catch (e) {
        send(res, 500, `queue error: ${esc(e?.message || e)}`);
      }
      return;
    }

    if (req.method === 'GET' && path.startsWith('/photo/')) {
      let name;
      try { name = decodeURIComponent(path.slice('/photo/'.length)); } catch { name = ''; }
      if (!PHOTO_RE.test(name) || !allowedPhotos().has(name)) {
        send(res, 404, 'not found');
        return;
      }
      const file = join(store.path('images-processed'), name);
      if (!existsSync(file)) {
        send(res, 404, 'not found');
        return;
      }
      send(res, 200, readFileSync(file), { 'content-type': 'image/webp' });
      return;
    }

    if (path === '/api/action') {
      if (req.method !== 'POST') { send(res, 405, 'method not allowed'); return; }
      if (String(req.headers['x-review-token'] || '') !== token) {
        sendJson(res, 403, { error: 'missing or wrong review token' });
        return;
      }
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 64 * 1024) { sendJson(res, 413, { error: 'body too large' }); return; }
        chunks.push(chunk);
      }
      let body;
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch {
        sendJson(res, 400, { error: 'invalid JSON' });
        return;
      }
      const action = String(body.action || '');
      const id = String(body.id || '');
      const at = now;
      try {
        let result;
        if (action === 'approve') result = approveItem({ store, repoRoot, id, actor, now: at });
        else if (action === 'reject') result = rejectItem({ store, repoRoot, id, actor, now: at });
        else if (action === 'reserve') result = reserveItem({ store, repoRoot, id, actor, now: at });
        else if (action === 'unpublish') result = unpublishItem({ store, repoRoot, id, reason: String(body.reason || 'owner'), actor, now: at });
        else { sendJson(res, 400, { error: `unknown action: ${action}` }); return; }
        sendJson(res, 200, { ok: true, action, result });
      } catch (e) {
        if (e instanceof OwnerActionError) sendJson(res, e.status, { error: e.message });
        else sendJson(res, 500, { error: 'owner action failed' });
      }
      return;
    }

    send(res, 404, 'not found');
  };

  const server = http.createServer(handler);

  return {
    server,
    token,
    listen(port = REVIEW_PORT) {
      return new Promise((resolve, reject) => {
        const onError = (e) => { server.off('listening', onListening); reject(e); };
        const onListening = () => {
          server.off('error', onError);
          resolve({ host: REVIEW_HOST, port: server.address().port });
        };
        server.once('error', onError);
        server.once('listening', onListening);
        // The literal host is the security property; nothing here consults HOST.
        server.listen(port, REVIEW_HOST);
      });
    },
    close() {
      return new Promise((resolve) => {
        if (!server.listening) { resolve(); return; }
        server.close(() => resolve());
        server.closeAllConnections?.();
      });
    },
  };
}

export async function main() {
  const store = openStore();
  const review = createReviewServer({ store, repoRoot: REPO_ROOT, actor: 'owner:local' });
  const { port } = await review.listen(REVIEW_PORT);
  console.log(`review UI: http://${REVIEW_HOST}:${port}/  (local only; Ctrl+C to stop)`);
  return review;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
