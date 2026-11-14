/* K-003 channel join lab: site themes, gallery controls, module behaviour,
   and selection persistence (selection.json via serve.mjs, else this browser). */
(function () {
  'use strict';

  // Tokens read from each site's src/styles on 2026-11-11.
  var SITES = {
    'curioustails.sg':   { label: 'Curious Tails', primary: 'oklch(68% 0.205 34)', p700: 'oklch(50% 0.16 40)', ink: 'oklch(20% 0.028 45)', soft: 'oklch(42% 0.03 45)', paper: 'oklch(98% 0.012 80)', surface: '#ffffff', display: "Fredoka, system-ui, sans-serif", body: "Nunito, system-ui, sans-serif" },
    'puppysingapore.com':{ label: 'Puppy Singapore', primary: '#6d28d9', p700: '#5521b0', ink: '#211a2e', soft: '#574d6b', paper: 'oklch(0.99 0.005 85)', surface: '#ffffff', display: "'Bricolage Grotesque', system-ui, sans-serif", body: "Archivo, system-ui, sans-serif" },
    'bichon.sg':         { label: 'Bichon SG', primary: '#7c5cd6', p700: '#5b3eb0', ink: '#2b2247', soft: '#6b6289', paper: '#ece6f7', surface: '#ffffff', display: "Chewy, system-ui, sans-serif", body: "Mulish, system-ui, sans-serif" },
    'cavapoopuppy.sg':   { label: 'Cavapoo SG', primary: '#3d6bff', p700: '#2450c9', ink: '#1b2c4f', soft: '#4a5c82', paper: '#f2f5ff', surface: '#ffffff', display: "Grandstander, cursive", body: "Outfit, system-ui, sans-serif" },
    'chihuahua.sg':      { label: 'Chihuahua SG', primary: '#0fb3a4', p700: '#0a7168', ink: '#1f3d3a', soft: '#415b57', paper: '#eaf8f4', surface: '#ffffff', display: "Fredoka, system-ui, sans-serif", body: "Nunito, system-ui, sans-serif" },
    'corgi.sg':          { label: 'Corgi SG', primary: '#2e9e44', p700: '#1e7330', ink: '#1c271c', soft: '#5c6a56', paper: '#f4f8f1', surface: '#ffffff', display: "Rowdies, system-ui, sans-serif", body: "Figtree, system-ui, sans-serif" },
    'dachshund.sg':      { label: 'Dachshund SG', primary: '#b4552d', p700: '#8a3d1e', ink: '#262319', soft: '#6e6857', paper: '#fdf9f0', surface: '#ffffff', display: "'Zilla Slab', Georgia, serif", body: "Karla, system-ui, sans-serif" },
    'maltese.sg':        { label: 'Maltese SG', primary: '#b6923a', p700: '#8f7024', ink: '#33302a', soft: '#7c7365', paper: '#fffefb', surface: '#ffffff', display: "Fraunces, Georgia, serif", body: "Jost, system-ui, sans-serif" },
    'maltipoo.sg':       { label: 'Maltipoo SG', primary: '#5c7838', p700: '#425a24', ink: '#272e1b', soft: '#565f45', paper: '#fffef9', surface: '#ffffff', display: "'Bricolage Grotesque', sans-serif", body: "Quicksand, system-ui, sans-serif" },
    'pomeranian.sg':     { label: 'Pomeranian SG', primary: '#c0491d', p700: '#97350f', ink: '#2a2420', soft: '#5a5049', paper: '#f7f3ec', surface: '#fffdf8', display: "Fraunces, Georgia, serif", body: "Sora, system-ui, sans-serif" },
    'poodle.sg':         { label: 'Poodle SG', primary: '#e8547a', p700: '#c63e64', ink: '#4a2a28', soft: '#8a6a62', paper: '#fff6f8', surface: '#ffffff', display: "'Baloo 2', sans-serif", body: "Rubik, system-ui, sans-serif" },
    'shibainu.sg':       { label: 'Shiba Inu SG', primary: '#c43b1e', p700: '#9c2d13', ink: '#26221f', soft: '#5c5148', paper: '#f5efe3', surface: '#ffffff', display: "'Shippori Mincho B1', Georgia, serif", body: "'Zen Kaku Gothic New', system-ui, sans-serif" },
    'shihtzu.sg':        { label: 'Shih Tzu SG', primary: '#ff6a1c', p700: '#b5460c' /* site's #d2540f is 4.19:1 with white; darkened for the module */, ink: '#2a1c10', soft: '#6e4a2c', paper: '#fff4e6', surface: '#ffffff', display: "'Lilita One', system-ui, sans-serif", body: "'Hanken Grotesk', system-ui, sans-serif" }
  };

  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---- site theme ---- */
  var siteSel = $('#g-site');
  Object.keys(SITES).forEach(function (k) {
    var o = document.createElement('option'); o.value = k; o.textContent = SITES[k].label + ' (' + k + ')'; siteSel.appendChild(o);
  });
  function applySite(k) {
    var s = SITES[k] || SITES['curioustails.sg'];
    $$('.g-stage').forEach(function (st) {
      var m = { '--cj-primary': s.primary, '--cj-primary-700': s.p700, '--cj-ink': s.ink, '--cj-ink-soft': s.soft, '--cj-paper': s.paper, '--cj-surface': s.surface, '--cj-font-display': s.display, '--cj-font-body': s.body };
      Object.keys(m).forEach(function (p) { st.style.setProperty(p, m[p]); });
    });
    store.set('k003-site', k);
  }
  siteSel.value = SITES[store.get('k003-site')] ? store.get('k003-site') : 'curioustails.sg';
  applySite(siteSel.value);
  siteSel.addEventListener('change', function () { applySite(siteSel.value); });

  /* ---- width + motion ---- */
  function seg(id, cb) {
    var root = $(id);
    root.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      $$('button', root).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      cb(b.dataset.v);
    });
  }
  seg('#g-width', function (v) { $('#g-main').dataset.width = v; });
  seg('#g-motion', function (v) { document.documentElement.dataset.motion = v; });

  /* ---- 04 Phone Peek tabs ---- */
  $$('.cj-04').forEach(function (m) {
    var go = $('.cj-go', m), t = $('.cj-go-t', m);
    $$('[role="tab"]', m).forEach(function (tab) {
      tab.addEventListener('click', function () {
        var ch = tab.dataset.ch; m.dataset.ch = ch;
        $$('[role="tab"]', m).forEach(function (x) { x.setAttribute('aria-selected', String(x === tab)); });
        go.href = go.dataset[ch]; t.textContent = ch === 'tg' ? 'Join on Telegram' : 'Follow on WhatsApp';
      });
    });
  });

  /* ---- 05 Channel Switch (remembers the visitor's app) ---- */
  $$('.cj-05').forEach(function (m) {
    var go = $('.cj-go', m);
    function set(ch) { m.dataset.ch = ch; go.href = go.dataset[ch]; var r = $('input[value="' + ch + '"]', m); if (r) r.checked = true; }
    set(store.get('cj-channel') === 'wa' ? 'wa' : 'tg');
    $$('input', m).forEach(function (r) { r.addEventListener('change', function () { set(r.value); store.set('cj-channel', r.value); }); });
  });

  /* ---- 07 Floating Dock ---- */
  $$('.cj-07').forEach(function (m) {
    var fab = $('.cj-fab', m), items = $$('.cj-item', m);
    function open(v) {
      m.dataset.open = String(v); fab.setAttribute('aria-expanded', String(v));
      items.forEach(function (a) { a.tabIndex = v ? 0 : -1; });
    }
    fab.addEventListener('click', function () { open(m.dataset.open !== 'true'); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && m.dataset.open === 'true') { open(false); fab.focus(); } });
    document.addEventListener('click', function (e) { if (!m.contains(e.target)) open(false); });
  });

  /* ---- 08 Ticker Strip dismiss ---- */
  $$('.cj-08').forEach(function (m) {
    if (store.get('cj-strip-closed') === '1') m.hidden = true;
    $('.cj-x', m).addEventListener('click', function () { m.hidden = true; store.set('cj-strip-closed', '1'); });
  });
  $$('[data-reset="08"]').forEach(function (b) {
    b.addEventListener('click', function () { $$('.cj-08').forEach(function (m) { m.hidden = false; }); store.set('cj-strip-closed', '0'); });
  });

  /* ---- 09 Paw Trail: start when in view ---- */
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { e.target.classList.toggle('is-in', e.isIntersecting); }); }, { threshold: 0.35 });
    $$('.cj-09').forEach(function (m) { io.observe(m); });
  } else { $$('.cj-09').forEach(function (m) { m.classList.add('is-in'); }); }

  /* ---- 10 QR codes ---- */
  $$('[data-qr]').forEach(function (el) {
    var q = window.CJ_QR && window.CJ_QR[el.dataset.qr]; if (!q) return;
    el.insertAdjacentHTML('afterbegin', '<svg viewBox="0 0 ' + q.n + ' ' + q.n + '" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="' + q.d + '"/></svg>');
  });

  /* ---- Selection ---- */
  var current = null; // { design, name, site, note, at }
  var note = $('#g-note'), msg = $('#g-msg'), where = $('#g-where');
  function render() {
    $$('.g-card').forEach(function (c) {
      var on = !!current && c.dataset.design === current.design;
      c.classList.toggle('is-picked', on);
      var b = $('.g-sel', c); b.setAttribute('aria-pressed', String(on)); b.textContent = on ? 'Selected' : 'Select this design';
    });
    var pick = $('#g-pick');
    pick.classList.toggle('is-set', !!current);
    pick.lastElementChild.innerHTML = current ? 'Selected: <b>' + current.design + ' ' + current.name + '</b>' : 'No design selected yet';
  }
  function text() {
    if (!current) return '';
    return 'K-003 channel join selection: design ' + current.design + ' (' + current.name + '), previewed on ' + current.site + ', saved ' + current.at + (current.note ? '. Note: ' + current.note : '');
  }
  function save(origin) {
    if (!current) { msg.textContent = 'Pick a design first.'; msg.className = 'g-status'; return; }
    current.note = note.value.trim(); current.site = siteSel.value; current.at = new Date().toISOString();
    store.set('k003-selection', JSON.stringify(current));
    render();
    fetch('/api/select', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(current) })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) { msg.className = 'g-status ok'; msg.textContent = 'Saved to ' + j.file + '.'; })
      .catch(function () {
        msg.className = 'g-status ok';
        msg.textContent = origin === 'card'
          ? 'Saved in this browser. Press Save selection after adding a note, or Copy selection text to send it.'
          : 'Saved in this browser. This preview cannot write files, so press Copy selection text and send it to the coordinator.';
      });
  }
  $$('.g-card').forEach(function (c) {
    $('.g-sel', c).addEventListener('click', function () {
      current = { design: c.dataset.design, name: c.dataset.name, site: siteSel.value, note: note.value.trim(), at: '' };
      save('card');
    });
  });
  $('#g-save').addEventListener('click', function () { save('panel'); });
  $('#g-copy').addEventListener('click', function () {
    var t = text(); if (!t) { msg.textContent = 'Pick a design first.'; return; }
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject())
      .then(function () { msg.className = 'g-status ok'; msg.textContent = 'Copied: ' + t; })
      .catch(function () { window.prompt('Copy this text:', t); });
  });

  // Restore: the file on disk wins over this browser.
  try { current = JSON.parse(store.get('k003-selection')); } catch (e) { current = null; }
  if (current && current.note) note.value = current.note;
  render();
  fetch('/api/selection').then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (j) {
    if (j && j.design) { current = j; note.value = j.note || ''; render(); where.textContent = 'Loaded from selection.json (saved ' + j.at + ').'; }
  }).catch(function () { /* static preview */ });
})();
