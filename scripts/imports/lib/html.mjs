// Small, dependency-free HTML/XML helpers shared by the source adapters (T7–T10).
//
// Adapters parse server-rendered pages with regexes and balanced-brace JSON
// extraction only: no DOM library, no headless browser (spec §6.2).

const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#039': "'" };

export function decodeEntities(s) {
  if (s == null) return s;
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+|#039);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

// Tags out, entities decoded, whitespace collapsed.
export const textOf = (html) =>
  decodeEntities(String(html ?? '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();

// Index of the brace/bracket that closes the one at `start`, string-aware.
export function matchClose(str, start) {
  const open = str[start];
  const close = open === '{' ? '}' : open === '[' ? ']' : null;
  if (!close) return -1;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < str.length; i++) {
    const ch = str[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === open) depth++;
    else if (ch === close && --depth === 0) return i;
  }
  return -1;
}

// Parse the JSON object/array that follows `"key":` in `str` (first match from `from`).
export function jsonAfterKey(str, key, from = 0) {
  const needle = `"${key}":`;
  let at = str.indexOf(needle, from);
  while (at !== -1) {
    let i = at + needle.length;
    while (/\s/.test(str[i] || '')) i++;
    if (str[i] === '{' || str[i] === '[') {
      const end = matchClose(str, i);
      if (end !== -1) {
        try { return JSON.parse(str.slice(i, end + 1)); } catch {}
      }
    }
    at = str.indexOf(needle, at + 1);
  }
  return null;
}

// Every <script type="application/ld+json"> block, parsed; @graph flattened.
export function jsonLdBlocks(html) {
  const out = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    let data;
    try { data = JSON.parse(m[1].trim()); } catch { continue; }
    const items = Array.isArray(data) ? data : data['@graph'] ? data['@graph'] : [data];
    for (const it of items) if (it && typeof it === 'object') out.push(it);
  }
  return out;
}

export const jsonLdOfType = (html, type) =>
  jsonLdBlocks(html).find((b) => [].concat(b['@type'] || []).some((t) => String(t).toLowerCase() === type.toLowerCase())) || null;

// Next.js App Router flight data: each self.__next_f.push([1,"…"]) string, decoded.
export function nextFlightChunks(html) {
  const out = [];
  const re = /self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g;
  let m;
  while ((m = re.exec(html))) {
    try { out.push(JSON.parse(m[1])); } catch {}
  }
  return out;
}

// <url>/<sitemap> entries of a sitemap or sitemap index.
export function sitemapEntries(xml) {
  const out = [];
  const re = /<(url|sitemap)>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = re.exec(xml))) {
    const loc = /<loc>\s*([^<]+?)\s*<\/loc>/i.exec(m[2]);
    if (!loc) continue;
    const lastmod = /<lastmod>\s*([^<]+?)\s*<\/lastmod>/i.exec(m[2]);
    const images = [...m[2].matchAll(/<image:loc>\s*([^<]+?)\s*<\/image:loc>/gi)].map((x) => decodeEntities(x[1]));
    out.push({ loc: decodeEntities(loc[1]), lastmod: lastmod ? lastmod[1] : null, images });
  }
  return out;
}

// Integer from "2", "2 Male" etc.; null when absent.
export const intOrNull = (v) => {
  const m = /\d+/.exec(String(v ?? ''));
  return m ? Number(m[0]) : null;
};

// "1 Female, 2 Male" / "Male: 2, Female: 1" → { maleCount, femaleCount }.
// When the field is present, a sex it doesn't mention counts as 0.
export function sexCounts(text) {
  if (!text) return { maleCount: null, femaleCount: null };
  const t = String(text);
  // (?<![a-z]) keeps "male" from matching inside "female".
  const grab = (word) => {
    const a = new RegExp(`(\\d+)\\s*(?:x\\s*)?(?<![a-z])${word}`, 'i').exec(t);
    const b = new RegExp(`(?<![a-z])${word}s?\\s*[:\\-]?\\s*(\\d+)`, 'i').exec(t);
    return a ? Number(a[1]) : b ? Number(b[1]) : null;
  };
  const female = grab('female');
  const male = grab('male');
  if (male == null && female == null) return { maleCount: null, femaleCount: null };
  return { maleCount: male ?? 0, femaleCount: female ?? 0 };
}

export const sexCode = (s) => {
  const t = String(s ?? '').trim().toLowerCase();
  if (/^f(emale)?$|bitch/.test(t)) return 'F';
  if (/^m(ale)?$|dog$/.test(t)) return 'M';
  return null;
};
