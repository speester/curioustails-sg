// Host canonicalisation (PLAN-puppy-portfolio-gsc-ga-2026-10 task 1.6, 2026-10-17).
// The Cloudflare token has no Rulesets/Page Rules scope and Pages _redirects cannot match
// on host, so the www -> apex 301 lives here. pages.dev noindex is already served by _headers.
export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.hostname === 'www.curioustails.sg') {
    url.hostname = 'curioustails.sg';
    return Response.redirect(url.toString(), 301);
  }
  return context.next();
}
