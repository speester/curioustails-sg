// Polite HTTP client for the imports pipeline (spec §6.2).
//
// - robots.txt fetched once per host per run and obeyed (disallowed → skipped, logged)
// - one identifying User-Agent, no spoofing, no proxies, no cookie replay
// - concurrency 1 across the whole run; >= 4 s between requests to the same host
// - per-host caps per run (detail pages, images)
// - 429/5xx: backoff 8 s then 30 s (max 3 attempts), Retry-After honoured up to 120 s
// - 403 / Cloudflare block or challenge → host blocked for the rest of the run,
//   alert emitted, and every later call returns {blocked:true} with no network call
// - hosts on the hard deny list (dogs.ie, owner D4) are never contacted at all
// - ETag / Last-Modified validators sent when a cache object is supplied

export const USER_AGENT = 'CuriousTailsImports/1.0 (+https://curioustails.sg/contact/)';
export const DEFAULT_SPACING_MS = 4000;
export const DEFAULT_CAPS = { detail: 60, image: 150, discover: 30 };
export const BACKOFF_MS = [8000, 30000, 120000];
export const MAX_ATTEMPTS = 3;
export const MAX_RETRY_AFTER_MS = 120000;

// dogs.ie and images.dogs.ie hard-block us (Cloudflare 403, even robots.txt).
// Owner D4 / K-072: zero requests to any *.dogs.ie host.
export const DENY_HOSTS = [/(^|\.)dogs\.ie$/i];

const BLOCK_MARKERS = [
  /Attention Required! \| Cloudflare/i,
  /Sorry, you have been blocked/i,
  /cf-chl|cf_chl_opt/i,
  /<title>\s*Just a moment\.\.\.\s*<\/title>/i,
];

export function isBlockResponse(status, body = '', headers = {}) {
  const h = (k) => (typeof headers.get === 'function' ? headers.get(k) : headers[k]);
  if (status === 403) return true;
  if (/challenge/i.test(h('cf-mitigated') || '')) return true;
  return BLOCK_MARKERS.some((re) => re.test(body));
}

// ---- robots.txt ---------------------------------------------------------------

export function parseRobots(text, agent = 'CuriousTailsImports') {
  const groups = [];
  let cur = null;
  let lastWasAgent = false;
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const field = m[1].toLowerCase();
    const value = m[2].trim();
    if (field === 'user-agent') {
      if (!lastWasAgent) groups.push((cur = { agents: [], rules: [] }));
      cur.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (!cur) continue;
      if ((field === 'allow' || field === 'disallow') && value) cur.rules.push({ allow: field === 'allow', path: value });
    }
  }
  const a = agent.toLowerCase();
  const own = groups.filter((g) => g.agents.some((x) => x !== '*' && a.includes(x)));
  const star = groups.filter((g) => g.agents.includes('*'));
  const rules = (own.length ? own : star).flatMap((g) => g.rules);
  return { rules };
}

function patternToRegex(path) {
  const anchored = path.endsWith('$');
  const body = (anchored ? path.slice(0, -1) : path)
    .split('*')
    .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp('^' + body + (anchored ? '$' : ''));
}

export function robotsAllows(robots, pathAndQuery) {
  if (!robots) return true;
  let best = null;
  for (const r of robots.rules) {
    if (!patternToRegex(r.path).test(pathAndQuery)) continue;
    if (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow)) best = r;
  }
  return best ? best.allow : true;
}

// ---- client -------------------------------------------------------------------

function retryAfterMs(value, nowMs) {
  if (!value) return null;
  if (/^\d+$/.test(value.trim())) return Number(value) * 1000;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : Math.max(0, t - nowMs);
}

export function createHttp({
  fetchImpl = globalThis.fetch,
  now = () => Date.now(),
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  spacingMs = DEFAULT_SPACING_MS,
  caps = DEFAULT_CAPS,
  cache = null, // { [url]: { etag, lastModified } }, persisted by the caller
  onEvent = () => {},
  userAgent = USER_AGENT,
  // { host: epochMs } of the previous run's last request per host (persisted by the
  // caller), so spacing also holds across back-to-back processes.
  lastRequestAt = {},
} = {}) {
  const hosts = new Map(); // host -> { robots, robotsLoaded, blocked, lastEnd, counts }
  const log = [];
  let chain = Promise.resolve();

  const hostState = (host) => {
    if (!hosts.has(host)) hosts.set(host, { robots: null, robotsLoaded: false, blocked: null, lastEnd: lastRequestAt[host] ?? null, lastStart: lastRequestAt[host] ?? null, counts: {} });
    return hosts.get(host);
  };
  const denied = (host) => DENY_HOSTS.some((re) => re.test(host));
  const iso = (ms) => new Date(ms).toISOString();

  function record(entry) {
    log.push(entry);
    onEvent({ type: 'request', ...entry });
  }

  function markBlocked(host, st, reason, url) {
    st.blocked = reason;
    onEvent({ type: 'alert', level: 'error', host, reason: `blocked: ${reason}`, url });
  }

  // One network call, with spacing. Never called for blocked/denied hosts.
  async function rawFetch(url, { kind, headers = {}, as = 'text' }) {
    const u = new URL(url);
    const st = hostState(u.host);
    if (st.lastEnd != null) {
      const wait = st.lastEnd + spacingMs - now();
      if (wait > 0) await sleep(wait);
    }
    const start = now();
    const gapMs = st.lastStart == null ? null : start - st.lastStart;
    st.lastStart = start;
    let res;
    let body = '';
    let status = 0;
    let error = null;
    try {
      res = await fetchImpl(url, { headers: { 'User-Agent': userAgent, Accept: '*/*', ...headers }, redirect: 'follow' });
      status = res.status;
      body = as === 'buffer' ? Buffer.from(await res.arrayBuffer()) : await res.text();
    } catch (e) {
      error = String(e?.message || e);
    }
    st.lastEnd = now();
    record({ at: iso(start), host: u.host, path: u.pathname + u.search, kind, status, outcome: error ? 'network-error' : 'fetched', gapMs, error });
    return { res, status, body, error };
  }

  async function loadRobots(u, st) {
    st.robotsLoaded = true;
    const robotsUrl = `${u.protocol}//${u.host}/robots.txt`;
    const { res, status, body, error } = await rawFetch(robotsUrl, { kind: 'robots' });
    if (!error && isBlockResponse(status, body, res?.headers)) {
      markBlocked(u.host, st, `robots.txt HTTP ${status}`, robotsUrl);
      return;
    }
    if (status >= 200 && status < 300) st.robots = parseRobots(body);
    else if (status >= 400 && status < 500) st.robots = { rules: [] }; // no robots.txt → allowed
    else st.robots = { rules: [{ allow: false, path: '/' }] }; // 5xx or unreachable → treat as disallow-all for this run
  }

  async function get(url, { kind = 'page', as = 'text', headers = {} } = {}) {
    const u = new URL(url);
    const host = u.host;
    const path = u.pathname + u.search;
    const skip = (outcome, extra = {}) => {
      record({ at: iso(now()), host, path, kind, status: null, outcome, gapMs: null });
      return { ok: false, url, status: null, ...extra };
    };

    if (denied(u.hostname)) {
      onEvent({ type: 'alert', level: 'warn', host, reason: 'deny-listed host, request refused', url });
      return skip('denylist', { blocked: true, denied: true });
    }
    const st = hostState(host);
    if (st.blocked) return skip('blocked-skip', { blocked: true });
    if (!st.robotsLoaded) await loadRobots(u, st);
    if (st.blocked) return skip('blocked-skip', { blocked: true });
    if (!robotsAllows(st.robots, path)) return skip('robots-skip', { robotsDisallowed: true });
    const cap = caps[kind];
    if (cap != null && (st.counts[kind] || 0) >= cap) return skip('cap-skip', { capped: true });
    st.counts[kind] = (st.counts[kind] || 0) + 1;

    const cond = {};
    const c = cache?.[url];
    if (c?.etag) cond['If-None-Match'] = c.etag;
    if (c?.lastModified) cond['If-Modified-Since'] = c.lastModified;

    for (let attempt = 1; ; attempt++) {
      const { res, status, body, error } = await rawFetch(url, { kind, as, headers: { ...cond, ...headers } });
      const textBody = typeof body === 'string' ? body : '';
      if (!error && isBlockResponse(status, textBody, res?.headers)) {
        markBlocked(host, st, `HTTP ${status}`, url);
        return { ok: false, url, status, blocked: true };
      }
      if (status === 304) return { ok: true, url, status, notModified: true, body: null };
      if (!error && status >= 200 && status < 300) {
        if (cache) {
          const etag = res.headers.get('etag');
          const lastModified = res.headers.get('last-modified');
          if (etag || lastModified) cache[url] = { etag: etag || undefined, lastModified: lastModified || undefined };
        }
        return { ok: true, url, status, body, headers: res.headers };
      }
      const retryable = error || status === 429 || status >= 500;
      if (!retryable || attempt >= MAX_ATTEMPTS) return { ok: false, url, status, error, body: textBody || null };
      const ra = retryAfterMs(res?.headers?.get?.('retry-after'), now());
      if (ra != null && ra > MAX_RETRY_AFTER_MS) {
        onEvent({ type: 'alert', level: 'warn', host, reason: `Retry-After ${Math.round(ra / 1000)} s exceeds cap; giving up`, url });
        return { ok: false, url, status, gaveUp: true };
      }
      await sleep(Math.max(ra ?? 0, BACKOFF_MS[attempt - 1]));
    }
  }

  // Serialise every call: concurrency 1 for the whole run.
  const serial = (url, opts) => {
    const p = chain.then(() => get(url, opts));
    chain = p.catch(() => {});
    return p;
  };

  return {
    get: serial,
    getJson: async (url, opts) => {
      const r = await serial(url, opts);
      if (r.ok && r.body) {
        try { return { ...r, json: JSON.parse(r.body) }; } catch (e) { return { ...r, ok: false, error: `bad JSON: ${e.message}` }; }
      }
      return r;
    },
    isBlocked: (host) => !!hosts.get(host)?.blocked,
    // Persist this and pass it back as lastRequestAt on the next run.
    lastRequestAt: () => Object.fromEntries([...hosts].filter(([, st]) => st.lastEnd != null).map(([h, st]) => [h, st.lastEnd])),
    blockedHosts: () => [...hosts].filter(([, s]) => s.blocked).map(([h, s]) => ({ host: h, reason: s.blocked })),
    log,
  };
}
