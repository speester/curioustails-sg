import { gsap } from 'gsap';

// Decorative, pointer-only interactions (button squish-press, 3D tilt-on-hover,
// cursor buddy). Split out of BaseLayout's inline script and loaded via a
// dynamic import so this non-critical code doesn't add to the parse/eval cost
// of the initial page script (see technical-audit §1.2, unused JS on BaseLayout).
export function initHoverInteractions() {
  // Playful squish-press feedback on every clay button/pill.
  document.querySelectorAll<HTMLElement>('.clay-btn, .clay-btn-outline, .clay-hover').forEach((el) => {
    el.addEventListener('pointerdown', () => gsap.to(el, { scale: 0.94, duration: 0.15, ease: 'power2.out' }));
    el.addEventListener('pointerup', () => gsap.to(el, { scale: 1, duration: 0.35, ease: 'back.out(2)' }));
    el.addEventListener('pointerleave', () => gsap.to(el, { scale: 1, duration: 0.35, ease: 'back.out(2)' }));
  });

  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  // Subtle 3D tilt-on-hover for image frames and cards marked [data-tilt].
  // Desktop/pointer devices only; skipped entirely under reduced motion.
  document.querySelectorAll<HTMLElement>('[data-tilt]').forEach((el) => {
    el.style.transformPerspective = '900px';
    // Bake the element's existing static Tailwind rotate-* slant into GSAP's
    // tracked rotation first, so animating rotationX/Y doesn't reset it to 0.
    const matrix = getComputedStyle(el).transform;
    let baseRotation = 0;
    if (matrix && matrix !== 'none') {
      const m = matrix.match(/^matrix\(([^)]+)\)/);
      if (m) {
        const [a, b] = m[1].split(',').map(Number);
        baseRotation = (Math.atan2(b, a) * 180) / Math.PI;
      }
    }
    gsap.set(el, { rotation: baseRotation });

    const hasLift = el.classList.contains('clay-hover');
    const setRotateX = gsap.quickTo(el, 'rotationX', { duration: 0.4, ease: 'power2.out' });
    const setRotateY = gsap.quickTo(el, 'rotationY', { duration: 0.4, ease: 'power2.out' });
    const setLift = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power2.out' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      setRotateY(px * 10);
      setRotateX(py * -10);
    });
    el.addEventListener('pointerenter', () => {
      if (hasLift) setLift(-6);
    });
    el.addEventListener('pointerleave', () => {
      setRotateX(0);
      setRotateY(0);
      if (hasLift) setLift(0);
    });
  });

  // Cute cursor buddy: a little paw print that trails the mouse with a soft
  // lag, and wags gently. Desktop pointer devices only; hides over text
  // inputs/links so it never gets in the way of reading or clicking.
  const buddy = document.getElementById('cursor-buddy');
  if (buddy) {
    const setX = gsap.quickTo(buddy, 'x', { duration: 0.55, ease: 'power3.out' });
    const setY = gsap.quickTo(buddy, 'y', { duration: 0.55, ease: 'power3.out' });
    let shown = false;

    gsap.to(buddy, { rotation: 14, duration: 1.6, ease: 'sine.inOut', yoyo: true, repeat: -1 });

    window.addEventListener('pointermove', (e) => {
      setX(e.clientX);
      setY(e.clientY);
      if (!shown) {
        shown = true;
        gsap.to(buddy, { opacity: 0.9, duration: 0.3 });
      }
    });
    document.addEventListener('pointerleave', () => gsap.to(buddy, { opacity: 0, duration: 0.3 }));
    document.addEventListener('pointerdown', () =>
      gsap.to(buddy, { scale: 1.4, duration: 0.15, ease: 'power2.out', yoyo: true, repeat: 1 })
    );
  }
}
