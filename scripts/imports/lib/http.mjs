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
export const MAX_REDIRECTS = 5;

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
      // Redirects are followed by get() one hop at a time, so every target is
      // checked against its own host's robots.txt before it is requested
      // (K-085). 'follow' here would silently skip that check.
      res = await fetchImpl(url, { headers: { 'User-Agent': userAgent, Accept: '*/*', ...headers }, redirect: 'manual' });
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
    let robotsUrl = `${u.protocol}//${u.host}/robots.txt`;
    // robots.txt itself may redirect. Follow at most 3 hops without a robots
    // check (robots.txt is always an allowed path); a deny-listed target is
    // treated as "no robots available", which means disallow-all for this run.
    for (let hop = 0; hop < 3; hop++) {
      const { res, status, body, error } = await rawFetch(robotsUrl, { kind: 'robots' });
      if (!error && status >= 300 && status < 400) {
        const loc = res?.headers?.get?.('location');
        if (!loc) break;
        let next;
        try { next = new URL(loc, robotsUrl); } catch { break; }
        if (denied(next.hostname)) break;
        robotsUrl = next.href;
        continue;
      }
      if (!error && isBlockResponse(status, body, res?.headers)) {
        markBlocked(u.host, st, `robots.txt HTTP ${status}`, robotsUrl);
        return;
      }
      if (status >= 200 && status < 300) st.robots = parseRobots(body);
      else if (status >= 400 && status < 500) st.robots = { rules: [] }; // no robots.txt → allowed
      else st.robots = { rules: [{ allow: false, path: '/' }] }; // 5xx or unreachable → disallow-all for this run
      return;
    }
    // Redirect loop, bad target, or deny-listed robots host: be conservative.
    st.robots = { rules: [{ allow: false, path: '/' }] };
  }

  async function get(url, { kind = 'page', as = 'text', headers = {} } = {}) {
    const requested = new URL(url);
    const skip = (outcome, extra = {}, at = requested, redirectFrom = null) => {
      record({
        at: iso(now()), host: at.host, path: at.pathname + at.search, kind, status: null, outcome, gapMs: null,
        ...(redirectFrom ? { redirectFrom } : {}),
      });
      return { ok: false, url: at.href, status: null, ...(redirectFrom ? { redirectFrom } : {}), ...extra };
    };

    if (denied(requested.hostname)) {
      onEvent({ type: 'alert', level: 'warn', host: requested.host, reason: 'deny-listed host, request refused', url: requested.href });
      return skip('denylist', { blocked: true, denied: true });
    }
    const st = hostState(requested.host);
    if (st.blocked) return skip('blocked-skip', { blocked: true });
    if (!st.robotsLoaded) await loadRobots(requested, st);
    if (st.blocked) return skip('blocked-skip', { blocked: true });
    if (!robotsAllows(st.robots, requested.pathname + requested.search)) return skip('robots-skip', { robotsDisallowed: true });
    const cap = caps[kind];
    if (cap != null && (st.counts[kind] || 0) >= cap) return skip('cap-skip', { capped: true });
    if (cap != null) st.counts[kind] = (st.counts[kind] || 0) + 1;

    const cond = {};
    const c = cache?.[requested.href];
    if (c?.etag) cond['If-None-Match'] = c.etag;
    if (c?.lastModified) cond['If-Modified-Since'] = c.lastModified;

    let current = requested;
    const redirectChain = [];
    for (let hop = 0; ; hop++) {
      const u = new URL(current.href);
      if (hop > 0) {
        // K-085: every redirect hop re-checks robots for the target host and path.
        if (denied(u.hostname)) {
          onEvent({ type: 'alert', level: 'warn', host: u.host, reason: 'redirect target is deny-listed; not followed', url: u.href });
          return skip('denylist', { blocked: true, denied: true, redirectDisallowed: true, redirectChain }, u, requested.href);
        }
        const targetState = hostState(u.host);
        if (targetState.blocked) return skip('blocked-skip', { blocked: true, redirectChain }, u, requested.href);
        if (!targetState.robotsLoaded) await loadRobots(u, targetState);
        if (targetState.blocked) return skip('blocked-skip', { blocked: true, redirectChain }, u, requested.href);
        if (!robotsAllows(targetState.robots, u.pathname + u.search)) {
          return skip(
            'robots-skip',
            { robotsDisallowed: true, redirectDisallowed: true, redirectChain },
            u,
            requested.href,
          );
        }
      }

      for (let attempt = 1; ; attempt++) {
        const { res, status, body, error } = await rawFetch(u.href, { kind, as, headers: { ...cond, ...headers } });
        const textBody = typeof body === 'string' ? body : '';
        const location = res?.headers?.get?.('location');
        if (!error && status >= 300 && status < 400 && location) {
          let next;
          try { next = new URL(location, u.href); } catch {
            return { ok: false, url: u.href, status, error: 'bad redirect target', redirectChain };
          }
          redirectChain.push({ from: u.href, to: next.href, status });
          onEvent({ type: 'redirect', host: u.host, status, from: u.href, to: next.href });
          if (hop >= MAX_REDIRECTS) return { ok: false, url: u.href, status, error: 'too many redirects', redirectChain };
          current = next;
          break; // continue with the next hop
        }
        if (!error && isBlockResponse(status, textBody, res?.headers)) {
          markBlocked(u.host, hostState(u.host), `HTTP ${status}`, u.href);
          return { ok: false, url: u.href, status, blocked: true, redirectChain };
        }
        if (status === 304) return { ok: true, url: u.href, status, notModified: true, body: null, redirectChain };
        if (!error && status >= 200 && status < 300) {
          if (cache && u.href === requested.href) {
            const etag = res.headers.get('etag');
            const lastModified = res.headers.get('last-modified');
            if (etag || lastModified) cache[requested.href] = { etag: etag || undefined, lastModified: lastModified || undefined };
          }
          return { ok: true, url: u.href, status, body, headers: res.headers, redirectChain };
        }
        const retryable = error || status === 429 || status >= 500;
        if (!retryable || attempt >= MAX_ATTEMPTS) return { ok: false, url: u.href, status, error, body: textBody || null, redirectChain };
        const ra = retryAfterMs(res?.headers?.get?.('retry-after'), now());
        if (ra != null && ra > MAX_RETRY_AFTER_MS) {
          onEvent({ type: 'alert', level: 'warn', host: u.host, reason: `Retry-After ${Math.round(ra / 1000)} s exceeds cap; giving up`, url: u.href });
          return { ok: false, url: u.href, status, gaveUp: true, redirectChain };
        }
        await sleep(Math.max(ra ?? 0, BACKOFF_MS[attempt - 1]));
      }
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
