// kit:url@1.0.0 - the ONLY place a self-referencing URL is built.
// Cloudflare Pages serves directory builds at /page/ ; canonical MUST equal served URL.

const SITE = import.meta.env.SITE ?? '';

/** Normalise any internal path to canonical form: leading slash, trailing slash, no query/hash. */
export function canonicalPath(path: string): string {
  if (!path) return '/';
  let p = String(path).trim();
  p = p.split('#')[0].split('?')[0];
  if (/^https?:\/\//i.test(p)) {
    try { p = new URL(p).pathname; } catch { /* fall through */ }
  }
  if (!p.startsWith('/')) p = '/' + p;
  p = p.replace(/\/{2,}/g, '/');
  // A path whose last segment has a file extension (sitemap-0.xml, llms.txt) keeps its shape.
  const last = p.split('/').filter(Boolean).pop() ?? '';
  if (last.includes('.')) return p;
  if (!p.endsWith('/')) p += '/';
  return p;
}

/** Absolute canonical URL for an internal path. Throws if `site` is unset in astro.config.mjs. */
export function absoluteUrl(path: string): string {
  const origin = String(SITE).replace(/\/+$/, '');
  if (!origin) throw new Error('[url.ts] astro.config.mjs `site` is not set - cannot build absolute URLs.');
  return origin + canonicalPath(path);
}

/** Slash-tolerant lookup for path-keyed registries (asset map, image dims, quotes). */
export function slashTolerant<T>(map: Record<string, T>, path: string): T | undefined {
  const c = canonicalPath(path);
  return map[c] ?? map[c.replace(/\/$/, '')] ?? map[c.replace(/\/$/, '') + '/'];
}

/** True when a href points inside this site (used by nav/link checks). */
export function isInternal(href: string): boolean {
  if (!href) return false;
  if (href.startsWith('/')) return true;
  const origin = String(SITE).replace(/\/+$/, '');
  return Boolean(origin) && href.startsWith(origin);
}
