// kit:exemptions@1.0.0 — THE figure/quote/Sources exemption predicate, JS side.
// The Python twin is scripts/exemptions.py; the two MUST stay identical in behaviour
// (contracts §3: widening one instrument alone is a defect). Three states:
//   full     content-route floor: >=2 figures, >=1 interactive, >=1 expert quote, Sources
//   partial  /contact/ only: EXACTLY ONE non-interactive figure below the form
//   exempt   404 / thank-you / privacy / terms, *_EXEMPT_ROUTES, and true utility rows
// The route decides before the tier does: /about/ carries the full floor whatever tier
// it was filed under, because an about page is where E-E-A-T is argued.
import { readFileSync } from 'node:fs';

export const UTILITY_ROUTES = ['404', 'thank-you', 'thankyou', 'privacy', 'terms'];
// contracts §1a declares page_tier `functional`; no consumer knew the word, so a
// functional roster row was classified `full` and owed 2 figures, a quote and Sources.
export const UTILITY_TIERS = ['utility', 'legal', 'functional'];
export const FULL_ROUTES = ['about', 'about-us'];
export const PARTIAL_ROUTES = ['contact', 'contact-us'];

export const FULL = 'full';
export const PARTIAL = 'partial';
export const EXEMPT = 'exempt';

// state -> { minFigures, minInteractive, maxInteractive }
export const FIGURE_FLOOR = {
  [FULL]: { minFigures: 2, minInteractive: 1, maxInteractive: null },
  [PARTIAL]: { minFigures: 1, minInteractive: 0, maxInteractive: 0 },
  [EXEMPT]: { minFigures: 0, minInteractive: 0, maxInteractive: null },
};

const strip = (s) => String(s || '').replace(/^\/+|\/+$/g, '').toLowerCase();
const tailOf = (s) => strip(s).split('/').pop();

/** Read a comma-separated *_EXEMPT_ROUTES key out of config/project-config.md. */
export function configRoutes(key, file = 'config/project-config.md') {
  try {
    // Matches the PERMISSIVE python reader (audit_built_html.py:116,
    // verify_page.py:139): an optional list bullet, and ":" or "=" as the
    // separator. The colon-only, column-zero form returned an empty set for a
    // line python honoured, so one config file exempted a route in python and
    // not in node.
    const KEY_RX = new RegExp('^\\s*[-*]?\\s*' + key + '\\s*[:=]\\s*(.+?)\\s*$', 'm');
    const m = readFileSync(file, 'utf8').match(KEY_RX);
    if (!m || /^none/i.test(m[1].trim())) return new Set();
  // The python readers end with .strip('`'); without this a backticked value
  // (`roster`) exempted the route in python and matched nothing in node.
    // TWO BUGS, ONE LINE. (1) `.map(strip)` never trimmed WHITESPACE, so every entry
    // after the first comma kept its leading space and matched nothing —
    // check-quotes.mjs failed 25 routes verify_page.py passed. (2) the format
    // validate_config.py accepts is `<route> = <reason> (<date>)`, and the whole string
    // was stored, so a config-legal exemption exempted nothing. Split on [,;], take the
    // text left of `=`, then normalise — exactly what exemptions.py does.
    return new Set(
      m[1].split('#')[0]
        .split(/[,;]/)
        .map((x) => strip(x.split('=')[0].trim().replace(new RegExp('^`|`$', 'g'), '')))
        .filter(Boolean),
    );
  } catch {
    return new Set();
  }
}

/** -> 'full' | 'partial' | 'exempt'. Every instrument calls THIS. */
export function exemption(slug, { extras = new Set(), tier = '', briefDepth = '', hasKeyword = true } = {}) {
  const tail = tailOf(slug);
  const whole = strip(slug);
  if (FULL_ROUTES.includes(tail)) return FULL;
  if (PARTIAL_ROUTES.includes(tail)) return PARTIAL;
  if (UTILITY_ROUTES.includes(tail)) return EXEMPT;
  if (extras.has(whole) || extras.has(tail)) return EXEMPT;
  if (UTILITY_TIERS.includes(String(tier).trim().toLowerCase())) return EXEMPT;
  if (String(briefDepth).trim().toLowerCase() === 'utility') return EXEMPT;
  if (!hasKeyword) return EXEMPT;
  return FULL;
}

export function isExempt(slug, opts) {
  return exemption(slug, opts) === EXEMPT;
}

export function figureFloor(state) {
  return FIGURE_FLOOR[state];
}

// ---------------------------------------------------------------------------------------
// THE ONE ENTRY POINT (W11.2). Before this, seven importers called `exemption()` with
// seven different argument sets: verify_page.py passed tier/depth/keyword, ledger.py passed
// the tier alone, and audit_built_html / check-quotes / check-references / h-gates /
// gen-feature-svgs / seo-audit passed the ROUTE ONLY — so a keywordless utility row was
// exempt in letters (h) and (n) and graded in (d), (e), (f) and (o). The blueprint row is
// read HERE, once, and every caller gets the same verdict.
// ---------------------------------------------------------------------------------------
import { parseCsv } from './csv.mjs';

const ROOT = process.env.PROJECT_ROOT || process.cwd();
let _rows = null;

/** The blueprint rows, keyed by normalised url_slug. Parsed once per process. */
export function blueprintRows(file = null) {
  if (_rows) return _rows;
  _rows = new Map();
  const path = file || `${ROOT}/research/site-blueprint.csv`;
  try {
    // utf8 with the BOM stripped: an Excel-saved blueprint makes the first header
    // "﻿url_slug" and every row then reads as keywordless.
    const text = readFileSync(path, 'utf8').replace(/^﻿/, '');
    // parseCsv returns [{cells, quoted}] -- NOT header-keyed objects. Reading
    // `row.url_slug` off that gave undefined on every row, so this map stayed empty
    // and nothing threw: the banner above promised one verdict for python and JS and
    // silently delivered a route-only verdict to every JS gate. Header-key it here,
    // the way every other parseCsv consumer in this tree already does.
    const parsed = parseCsv(text);
    const head = (parsed.shift()?.cells || []).map((h) => String(h).trim());
    for (const r of parsed) {
      const row = Object.fromEntries(
        head.map((h, i) => [h, String(r.cells[i] ?? '').trim()]));
      const slug = String(row.url_slug || '').trim();
      if (slug) _rows.set(strip(slug), row);
    }
  } catch {
    /* no blueprint here: every caller falls back to the route-only verdict */
  }
  return _rows;
}

/** -> 'full' | 'partial' | 'exempt'. THE call every instrument makes. */
export function exemptionFor(slug, key = null, file = 'config/project-config.md') {
  const row = blueprintRows().get(strip(slug)) || {};
  return exemption(slug, {
    extras: key ? configRoutes(key, file) : new Set(),
    // contracts §9: `page_tier`, never the FORBIDDEN dead name `tier`.
    tier: row.page_tier || '',
    briefDepth: row.brief_depth || '',
    hasKeyword: 'target_keyword' in row
      ? Boolean(String(row.target_keyword || '').trim())
      : true,
  });
}

export function isExemptFor(slug, key = null) {
  return exemptionFor(slug, key) === EXEMPT;
}
