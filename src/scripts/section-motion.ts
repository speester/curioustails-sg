// kit:section-motion@1.0.0 - THE ONE island every Tier B section pattern shares.
// contracts 22: a pattern is Tier A (pure CSS) or Tier B (Tier A + this file). There is no
// third option, and there is no second island: four small scripts doing pointer maths is
// four chances to put layout work on the interaction path.
//
// Everything here is an ENHANCEMENT. With this file blocked, every pattern still renders,
// every rail still scrolls (native overflow + scroll-snap), and every reveal is already
// visible - the CSS ships the finished state and only ANIMATES when the observer says so.
//
// INP: every hot pointer listener coalesces into one requestAnimationFrame per frame, which
// is the rule audit_built_html.py --hygiene enforces on the built page.
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

/* ---------------------------------------------------------------- reveal on view */
// CSS does this on its own where `animation-timeline: view()` is supported. This is the
// fallback, and it has a 2.5s dead-man's switch: a stalled observer must never leave
// content hidden, so the class is added unconditionally on the timer.
function reveals() {
  const nodes = [...document.querySelectorAll<HTMLElement>('[data-reveal]')];
  if (!nodes.length) return;
  if (reduced.matches || !('IntersectionObserver' in window) ||
      CSS.supports('animation-timeline', 'view()')) {
    nodes.forEach((n) => n.classList.add('is-revealed'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      (e.target as HTMLElement).classList.add('is-revealed');
      io.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -10% 0px' });
  nodes.forEach((n) => io.observe(n));
  setTimeout(() => nodes.forEach((n) => n.classList.add('is-revealed')), 2500);
}

/* ---------------------------------------------------------------- rails */
// The rail is a native scroll container. These buttons are a convenience on top of it:
// they are rendered hidden and only unhidden here, so a JS-off page never shows a control
// that cannot work.
function rails() {
  for (const rail of document.querySelectorAll<HTMLElement>('[data-rail]')) {
    const track = rail.querySelector<HTMLElement>('[data-rail-track]');
    if (!track) continue;
    const controls = rail.querySelector<HTMLElement>('[data-rail-controls]');
    if (controls) controls.hidden = false;
    const step = () => Math.max(240, track.clientWidth * 0.8);
    rail.querySelector('[data-rail-prev]')?.addEventListener('click', () => {
      track.scrollBy({ left: -step(), behavior: reduced.matches ? 'auto' : 'smooth' });
    });
    rail.querySelector('[data-rail-next]')?.addEventListener('click', () => {
      track.scrollBy({ left: step(), behavior: reduced.matches ? 'auto' : 'smooth' });
    });
    const dots = [...rail.querySelectorAll<HTMLElement>('[data-rail-dot]')];
    if (dots.length) {
      const sync = () => {
        const i = Math.round(track.scrollLeft / Math.max(1, track.scrollWidth / dots.length));
        dots.forEach((d, n) => d.setAttribute('aria-current', String(n === i)));
      };
      let queued = false;
      track.addEventListener('scroll', () => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => { queued = false; sync(); });
      }, { passive: true });
      dots.forEach((d, n) => d.addEventListener('click', () => {
        track.scrollTo({ left: (track.scrollWidth / dots.length) * n,
                         behavior: reduced.matches ? 'auto' : 'smooth' });
      }));
      sync();
    }
  }
}

/* ---------------------------------------------------------------- pointer tracking */
// tilt + spotlight, one listener per element, one write per frame. The CSS reads
// --px/--py and decides what to do with them, so a pattern can opt into either effect
// without another script.
function pointer() {
  if (reduced.matches || matchMedia('(hover: none)').matches) return;
  for (const el of document.querySelectorAll<HTMLElement>('[data-pointer]')) {
    let queued = false, x = 0.5, y = 0.5;
    el.addEventListener('pointermove', (ev) => {
      const r = el.getBoundingClientRect();
      x = (ev.clientX - r.left) / r.width;
      y = (ev.clientY - r.top) / r.height;
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        el.style.setProperty('--px', x.toFixed(4));
        el.style.setProperty('--py', y.toFixed(4));
      });
    }, { passive: true });
    el.addEventListener('pointerleave', () => {
      el.style.setProperty('--px', '0.5');
      el.style.setProperty('--py', '0.5');
    });
  }
}

/* ---------------------------------------------------------------- counters */
// The final value is ALWAYS in the DOM as text. This only animates toward it, and skips
// entirely under reduced motion, so the number a reader needs is never behind an effect.
function counters() {
  const nodes = [...document.querySelectorAll<HTMLElement>('[data-count-to]')];
  if (!nodes.length || reduced.matches || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const el = e.target as HTMLElement;
      io.unobserve(el);
      const final = el.textContent ?? '';
      const to = Number(el.dataset.countTo);
      if (!isFinite(to)) continue;
      const t0 = performance.now();
      const tick = (t: number) => {
        const k = Math.min(1, (t - t0) / 900);
        el.textContent = String(Math.round(to * (1 - Math.pow(1 - k, 3))));
        if (k < 1) requestAnimationFrame(tick);
        else el.textContent = final;
      };
      requestAnimationFrame(tick);
    }
  });
  nodes.forEach((n) => io.observe(n));
}

/* ---------------------------------------------------------------- hover reveal */
// CSS handles this wherever :has() lands. This is the fallback, and it binds focus as well
// as hover so the pattern is reachable from the keyboard.
function hoverReveal() {
  for (const group of document.querySelectorAll<HTMLElement>('[data-hover-reveal]')) {
    const panes = [...group.querySelectorAll<HTMLElement>('[data-reveal-pane]')];
    const show = (id: string) => panes.forEach((p) => {
      p.hidden = p.dataset.revealPane !== id;
    });
    for (const trigger of group.querySelectorAll<HTMLElement>('[data-reveal-for]')) {
      const id = trigger.dataset.revealFor!;
      trigger.addEventListener('pointerenter', () => show(id));
      trigger.addEventListener('focus', () => show(id));
    }
  }
}

reveals();
rails();
pointer();
counters();
hoverReveal();
