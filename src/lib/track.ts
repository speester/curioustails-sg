// kit:track@1.0.0 - the only GA4 event emitter. Names come from src/data/registry.ts GA4_EVENTS.
// (It was imported from src/data/site.ts, which never exported it: every track() call threw
// before its try block, so no delegated click event ever reached GA.)
import { GA4_EVENTS } from '../data/registry';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
    track?: (name: string, params?: Record<string, unknown>) => void;
  }
}

export function track(name: string, params: Record<string, unknown> = {}): void {
  try {
    if (!(GA4_EVENTS as readonly string[]).includes(name)) {
      // A name that is not in the registry can never be registered as a key event.
      console.warn(`[track] "${name}" is not in GA4_EVENTS - add it to src/data/registry.ts or use an existing name.`);
    }
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('event', name, params);
    }
  } catch {
    /* analytics must never break a page */
  }
}

/** Bind the delegated emitters once, from the shared motion/entry script. */
export function bindAutoEvents(): void {
  if (typeof document === 'undefined') return;
  document.addEventListener('click', (ev) => {
    const el = (ev.target as HTMLElement | null)?.closest('a, button');
    if (!el) return;
    const href = (el as HTMLAnchorElement).getAttribute?.('href') ?? '';
    const label = (el.textContent ?? '').trim().slice(0, 80);

    if (/^tel:/i.test(href)) return track('call_click', { href });
    if (/wa\.me|api\.whatsapp\.com/i.test(href)) return track('whatsapp_click', { href });
    if (el.getAttribute('target') === '_blank' && /^https?:/i.test(href)) return track('outbound_click', { href });
    if (el.classList.contains('btn') || el.hasAttribute('data-cta')) return track('cta_click', { label, href });
  }, { passive: true });
}
