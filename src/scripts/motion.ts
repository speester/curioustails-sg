// kit:motion@1.0.0 — vanilla motion kit. Budget: <= 10 KB raw.
// Rules: entrance on the OUTER wrapper, ambient loop on an INNER element; every handler
// writes its observable state synchronously so it is assertable without a compositing pane.
import { bindAutoEvents } from '../lib/track';

const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE_POINTER = typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches;
const DEAD_MAN_MS = 2500;

function revealAllNow(): void {
  for (const el of Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'))) {
    // transition FIRST, then opacity — the fallback must not depend on the transition
    // that may itself be the thing that stalled.
    el.style.transition = 'none';
    el.style.opacity = '1';
    el.style.transform = 'none';
    el.setAttribute('data-revealed', 'fallback');
  }
}

function initReveal(): void {
  const els = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
  if (!els.length) return;
  if (REDUCED || !('IntersectionObserver' in window)) { revealAllNow(); return; }

  let revealedAny = false;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const el = e.target as HTMLElement;
      const delay = Math.min(Number(el.dataset.revealDelay ?? 0), 500);
      window.setTimeout(() => {
        el.style.opacity = '1';
        el.style.transform = 'none';
        el.setAttribute('data-revealed', 'io');
      }, delay);
      revealedAny = true;
      io.unobserve(el);
    }
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });

  for (const el of els) io.observe(el);

  // DEAD-MAN'S SWITCH: if nothing revealed at all, force everything visible.
  window.setTimeout(() => { if (!revealedAny) revealAllNow(); }, DEAD_MAN_MS);
}

function initTilt(): void {
  if (REDUCED || !FINE_POINTER) return;
  const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-tilt]'));
  for (const card of cards) {
    const baked = getComputedStyle(card).rotate;                   // bake in any static rotation
    const baseRotate = baked && baked !== 'none' ? baked : '0deg';
    card.style.transformPerspective = '700px';
    card.style.transition = 'transform .4s ease-out';
    // INP: pointermove fires faster than the display refreshes, so the layout READ
    // (getBoundingClientRect) and the style WRITE are coalesced into ONE
    // requestAnimationFrame per frame. Writing on every event put a forced
    // synchronous layout on the interaction path, which is precisely the
    // main-thread cost INP scores. Same motion, a fraction of the work.
    let cx = 0, cy = 0, queued = false;
    const paintTilt = () => {
      queued = false;
      const r = card.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const px = (cx - r.left) / r.width - 0.5;
      const py = (cy - r.top) / r.height - 0.5;
      card.style.transform = `perspective(700px) rotate(${baseRotate}) rotateY(${px * 8}deg) rotateX(${-py * 8}deg)`;
    };
    card.addEventListener('pointermove', (ev) => {
      cx = ev.clientX; cy = ev.clientY;
      if (!queued) { queued = true; requestAnimationFrame(paintTilt); }
    }, { passive: true });
    card.addEventListener('pointerleave', () => {
      queued = true;   // swallow any frame still queued so it cannot fight the reset
      card.style.transition = 'transform .6s cubic-bezier(.22,1,.36,1)';
      card.style.transform = `perspective(700px) rotate(${baseRotate})`;
      window.setTimeout(() => { card.style.transition = 'transform .4s ease-out'; queued = false; }, 620);
    });
  }
}

function initQuoteDraw(): void {
  const marks = Array.from(document.querySelectorAll<SVGGeometryElement>('[data-quote-draw] path, [data-quote-draw] line'));
  if (!marks.length) return;
  if (REDUCED || !('IntersectionObserver' in window)) {
    for (const m of marks) { m.style.strokeDasharray = 'none'; m.style.strokeDashoffset = '0'; }
    return;
  }
  for (const m of marks) {
    const len = typeof m.getTotalLength === 'function' ? m.getTotalLength() : 0;
    if (!len) continue;
    m.style.strokeDasharray = String(len);
    m.style.strokeDashoffset = String(len);
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const m = e.target as SVGGeometryElement;
      m.style.transition = 'stroke-dashoffset 1.1s ease-out';
      m.style.strokeDashoffset = '0';
      io.unobserve(m);
    }
  }, { threshold: 0.2 });
  for (const m of marks) io.observe(m);

  for (const btn of Array.from(document.querySelectorAll<HTMLElement>('[data-quote-replay]'))) {
    btn.addEventListener('click', () => {
      const scope = btn.closest('[data-quote-draw]');
      if (!scope) return;
      for (const m of Array.from(scope.querySelectorAll<SVGGeometryElement>('path, line'))) {
        const len = typeof m.getTotalLength === 'function' ? m.getTotalLength() : 0;
        if (!len) continue;
        m.style.transition = 'none';
        m.style.strokeDashoffset = String(len);
        void m.getBoundingClientRect();
        m.style.transition = 'stroke-dashoffset 1.1s ease-out';
        m.style.strokeDashoffset = '0';
      }
    });
  }
}

function boot(): void {
  initReveal();
  initTilt();
  initQuoteDraw();
  bindAutoEvents();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
