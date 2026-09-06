#!/usr/bin/env python3
"""verify_page.py - per-page brief->page contract, measured on BUILT dist/ HTML.

Usage:
  python scripts/verify_page.py <slug> [--write-ledger]
  python scripts/verify_page.py --all [--order core-first] [--write-ledger]
  python scripts/verify_page.py --draft <file.astro>
  python scripts/verify_page.py --artifact-leak
Exit 0 only when every gate PASSes; exit 1 on any FAIL. Python 3.9+, stdlib only.
"""
import csv, html as H, json, os, re, subprocess, sys

# CONSOLE ENCODING. A Windows console is cp1252, and a gate that PRINTS page
# content dies with UnicodeEncodeError the moment a page carries a character
# outside it - mid-run, after some pages are graded and BEFORE the denominator
# line, so the whole run reports nothing. Measured 2026-09-05: this killed
# verify_page.py on 22 of 29 projects, which is why the pipeline looked like it
# only ran on six. Degrade the CHARACTER, never the run.
import sys  # the encoding guard below USES sys; without this the
           # NameError was swallowed by its own except and the guard never applied.
try:
    sys.stdout.reconfigure(errors="replace")
    sys.stderr.reconfigure(errors="replace")
except Exception:  # noqa: BLE001
    pass

from pathlib import Path

ROOT = Path(os.environ.get("PROJECT_ROOT", ".")).resolve()
DIST, BRIEFS = ROOT / "dist", ROOT / "briefs"
BLUEPRINT = ROOT / "research" / "site-blueprint.csv"
LEDGER = ROOT / "config" / "pipeline-ledger.csv"

# reference/contracts.md §1a - THE ONE TIER VOCABULARY (CONS-18). TWO blueprint
# columns, one meaning each: page_tier decides the FAQ floor and the schema
# branch; value_tier decides the WORD floor. Every other tier word in this
# pipeline is DEAD - "money", "pillar", "cluster", "standard", "storefront",
# "blog", "supporting", "commercial", "trust", and a bare value_tier letter used
# as a page_tier. The old FLOOR map mixed all five vocabularies, so a canonical
# blueprint hit the 1,800 default on every row.
# Imported, not restated: this tuple carried FIVE values while
# validate_brief.py carried six, so `functional` was a legal page_tier at
# brief time and an unknown one at verify time. contracts section-1a is the
# authority and tiers.py is its one implementation.
# (imported below, after sys.path is set)
VALUE_FLOOR = {"a": 2200, "b": 1600, "c": 1100, "d": 900}
UTILITY_FLOOR = 600                    # page_tier = utility (/contact 600, /about 800)
FAQ_FLOOR = {"core": 10, "compare": 10, "monetization": 10, "outer": 8,
             "utility": 0, "functional": 0}
NOFLOOR = {"utility", "functional"}    # page_tiers without a value-tier word floor
# contracts §1a states the functional tier carries word, FAQ and quote floors of
# 0. Before 2026-09-04 neither table implemented it, so a functional roster row
# with value_tier A owed 2,200 words - the exact padding the tier exists to stop.
# reference/contracts.md, THE ONE EXEMPTION LIST (contracts_check.py rule
# `one-exemption-list`): figures, the expert quote and the Sources block are
# required on every CONTENT route and on no other. The identical predicate is
# implemented in audit_built_html.sec_figures() (Task G3.2) and in ledger.py
# (Task G3.4) - never widen it in one script only.
# contracts §3: the figure / quote / Sources predicate is implemented ONCE, in
# exemptions.py, and imported here. Three instruments carrying three tuples is what
# made /about/ pass one letter and fail two others on every site ever built.
import os as _os
import sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from exemptions import (exemption, figure_floor, UTILITY_ROUTES,  # noqa: E402
                        FULL, PARTIAL, EXEMPT)
from shapes import as_dict, as_list, dicts, as_int, as_text, load_json  # noqa: E402,F401
from tiers import (slug_of as tier_slug_of,                       # noqa: E402
                   PAGE_TIERS, VALUE_TIERS)                       # noqa: F401
UNIT = r"(?:\bdays?\b|\bweeks?\b|\bmonths?\b|\bhours?\b|\byears?\b|%|S?\$)"
MARKER = re.compile(
    r"\[(VERIFY|NEEDS PROOF|NEEDS|CONFIRM|PROOF|TODO|CITE|PLACEHOLDER)[^\]]*\]", re.I)
# A trailing sentence period is not part of the figure: the old class swallowed it,
# so "$2.48." never matched the sourced "$2.48" in the ground-truth corpus.
# content-writer's FIGURE PROVENANCE rule covers "every currency amount, fee,
# percentage, year-count, interval/duration and regulatory figure". Matching only
# currency and percentages meant "10 years of experience", "over 500 happy families"
# and "dewormed at 6 weeks" carried zero provenance and passed every gate.
COUNT_UNITS = (r"years?|yrs?|weeks?|months?|days?|hours?|customers?|clients?|families|"
               r"puppies|litters|projects|installations|reviews|jobs|units?|homes?|"
               r"properties|patients?|students?|sessions?|visits?")
# A NUMBER DOES NOT END IN A COMMA (2026-09-05). `\d[\d,]*` let a figure run past the
# comma that separates it from the next word, so "weeks 8, 12 and 16, home after the first
# two" was read as the quantity "16, home" and the provenance gate demanded a source for a
# list separator. Digits may CONTAIN a comma; they may not end with one.
NUM = r"\d(?:[\d,]*\d)?"
MONEY = re.compile(
    r"(?:S?\$\s?" + NUM + r"(?:\.\d+)?"
    r"|\b" + NUM + r"(?:\.\d+)?\s?(?:%|per cent|percent)\b"
    r"|\b" + NUM + r"\+?\s?(?:" + COUNT_UNITS + r")\b)", re.I)
SPELL = {
    "en-US": [r"\bageing", r"\brandomis", r"\borganis(?:e|ed|ing|ation)",
              r"\bstandardis", r"\brecognis", r"\bsummaris",
              r"\bcharacteris(?:e|ed|ing|ation)", r"\bprioritis", r"\bbehaviour",
              r"\bfavour", r"\bprogramme", r"\blicence", r"\bcentre\b", r"\bhaemo"],
    "en-GB": [r"\baging\b", r"\brandomiz", r"\borganiz(?:e|ed|ing|ation)",
              r"\bstandardiz", r"\brecogniz", r"\bsummariz",
              r"\bcharacteriz(?:e|ed|ing|ation)", r"\bprioritiz", r"\bbehavior\b",
              r"\bfavor\b", r"\bprogram(?!me)", r"\blicense", r"\bcenter\b", r"\bhemo"],
}
CHROME = re.compile(r"<(script|style|svg|header|nav|footer|aside)\b[^>]*>.*?</\1\s*>",
                    re.I | re.S)
JSONLD = re.compile(r'<script[^>]+application/ld\+json[^>]*>(.*?)</script>', re.I | re.S)
P_TAG = re.compile(r"<p(?:\s[^>]*)?>(.*?)</p\s*>", re.I | re.S)
H_TAG = re.compile(r"<h([1-6])(?:\s[^>]*)?>(.*?)</h\1\s*>", re.I | re.S)
A_TAG = re.compile(r"<a(?:\s[^>]*)?\shref=[\"']([^\"']+)[\"'][^>]*>(.*?)</a\s*>", re.I | re.S)
IMG_TAG = re.compile(r"<img\b[^>]*>", re.I)
BREAKERS = re.compile(r"^<(?:h[2-6]|ul|ol|table|figure|blockquote|dl|pre)\b", re.I)
# out-of-script glyph gate: Latin-1 plus the punctuation the house style declares.
ALLOWED_GLYPHS = set("\u2018\u2019\u201c\u201d\u2026\u2013\u00d7\u00b0\u2192"
                     "\u2022\u00a0\u20ac\u00a3\u2212\u00b2\u00b3\u2713")
# REQ-9: what counts as a RASTER visual. Under IMAGE_POLICY photo|mixed only these
# extensions satisfy the >=2 floor - an SVG card loaded through <img src="*.svg">
# is reported as svg_as_raster and never counted, because that fallback path is
# exactly how a "typographic by choice" page used to pass the image floor with
# zero photographs. Under IMAGE_POLICY figure the raster floor is 0.
RASTER_EXT = (".webp", ".avif", ".jpg", ".jpeg", ".png", ".gif")


def img_kind(src):
    """'raster' | 'svg' | 'other' - by extension, query/hash stripped."""
    s = re.sub(r"[?#].*$", "", (src or "").strip().lower())
    if s.startswith("data:image/svg"):
        return "svg"
    if s.startswith("data:"):
        return "raster"
    ext = "." + s.rsplit(".", 1)[1] if "." in s.rsplit("/", 1)[-1] else ""
    if ext in RASTER_EXT:
        return "raster"
    return "svg" if ext == ".svg" else "other"


def route_exempt(slug, cfg, key):
    """THE ONE EXEMPTION LIST - exemptions.py owns it; this is the thin adapter."""
    return exemption(slug, cfg, key) == EXEMPT


def fail(gate, msg, out):
    out.append(("FAIL", gate, msg))


def ok(gate, msg, out):
    out.append(("PASS", gate, msg))


BLOCK_TAG = re.compile(
    r"</?(?:p|h[1-6]|li|ul|ol|table|thead|tbody|tr|td|th|section|article|aside|header|"
    r"footer|main|div|figure|figcaption|blockquote|summary|details|dl|dt|dd|nav|form)"
    r"(?:\s[^>]*)?>", re.I)


def text_of(fragment):
    t = re.sub(r"<[^>]+>", " ", fragment or "")
    return re.sub(r"\s+", " ", H.unescape(t)).strip()


def figure_text(fragment):
    """Body text with BLOCK BOUNDARIES kept as a barrier, for figure scanning only.

    text_of() collapses every tag to a space, so the tail of one block fuses with the
    head of the next: "read 2026-08-31</p><h2>Hours" becomes "31 Hours", which the
    figure pattern reads as a real quantity and the provenance gate then fails as an
    unsourced figure that appears nowhere on the page. "|" is not whitespace, so a
    figure pattern cannot span it. This is deliberately NOT text_of: the FAQ parity and
    entity gates compare against strings that carry no separator, and putting the
    barrier in the shared extractor broke both.
    """
    # EVERY tag is a barrier, not only block ones. A step number in its own inline span
    # ("<span>1</span>Weeks 1 to 2") fused into "1 Weeks" and was reported as an
    # unsourced quantity. A figure that is real is written inside one text node, so
    # nothing legitimate is lost by refusing to read one across an element boundary.
    # FORM CONTROLS ARE NOT CLAIMS. A <select> offering "6 to 12 months" is a choice the
    # visitor makes, not a figure the page asserts, and scanning it made the provenance
    # gate demand a source for the contact form's own dropdown.
    f = re.sub(r"(?is)<(form|select|datalist|fieldset)\b.*?</\1\s*>", " ", fragment or "")
    t = re.sub(r"<[^>]+>", " | ", f)
    return re.sub(r"[ \t]+", " ", H.unescape(t)).strip()


def words(s):
    return [w for w in re.findall(r"[A-Za-z0-9$%'\u2019-]+", s or "") if w.strip("-'")]


def sentences(s):
    parts = re.split(r"(?<!\bJ\.P)(?<!\bU\.S)(?<!\bNo)(?<!\bDr)(?<!\bSt)[.!?]+(?=\s|$)", s or "")
    return [p.strip() for p in parts if p.strip()]


def read_config():
    cfg = {}
    p = ROOT / "config" / "project-config.md"
    if not p.exists():
        return cfg
    for line in p.read_text(encoding="utf-8", errors="replace").splitlines():
        m = re.match(r"^\s*[-*]?\s*([A-Z][A-Z0-9_]+)\s*[:=]\s*(.+?)\s*$", line)
        if m:
            cfg[m.group(1)] = m.group(2).strip().strip("`")
    return cfg


def split_list(v):
    return [x.strip() for x in re.split(r"[,;|]", v or "") if x.strip()]


def slugify(path):
    return (path or "").strip().strip("/") or "index"


# flattened slug -> the route path from the blueprint, so dist_file never has to guess
# whether a hyphen in a slug was a path separator (heygen-vs-synthesia is ONE segment).
ROUTE_OF_SLUG = {}
# flattened slug -> canonical blueprint key. Resolved before any row lookup.
SLUG_ALIASES = {}


# A description attribute may legally contain the OTHER quote character. Matching
# double-quoted and single-quoted forms separately keeps an apostrophe in
# "the vendor's own page" from truncating the measured length to 40 characters.
DESC_RE = re.compile(
    r'<meta[^>]+name=.description.[^>]+content="([^"]*)"'
    r"|<meta[^>]+name=.description.[^>]+content='([^']*)'",
    re.I | re.S)


# Blueprint rows whose column count does not match the header. Named in the run
# summary: a ragged CSV silently mis-keys every column to its right.
RAGGED = []
LEGACY_SLUG_COL = set()


def read_blueprint():
    rows = {}
    if not BLUEPRINT.exists():
        return rows
    with BLUEPRINT.open(newline="", encoding="utf-8-sig", errors="replace") as f:
        for r in csv.DictReader(f):
            # contracts §9 names url_slug as the canonical column and it is read
            # FIRST. It is not, however, universal: audited 2026-09-04, two of 29
            # blueprints key their rows on `path` or `slug` instead, and reading
            # only `url_slug` found no row at all for any page on those projects -
            # so page_tier and value_tier both came back empty and every page
            # HALTed on an unresolvable tier while a perfectly canonical blueprint
            # row sat beside it. Fall back through the alias list, and WARN, so a
            # legacy column name is visible rather than silent.
            key, keycol = tier_slug_of(r)
            if keycol and keycol != "url_slug":
                LEGACY_SLUG_COL.add(keycol)
            # A row with MORE fields than the header lands under DictReader's restkey
            # (None) as a LIST, and the blanket .strip() crashed the whole gate on a
            # single ragged line. Report the row instead of dying on it.
            if None in r:
                RAGGED.append(key or "(no url_slug)")
            rec = {k: (v if isinstance(v, str) else " ".join(map(str, v or []))).strip()
                   for k, v in r.items() if k is not None}
            rows[slugify(key)] = rec
            # Flattened alias: pages are addressed as pricing-heygen (the brief filename)
            # while the route is /pricing/heygen/.
            route = key.strip("/") or "index"
            ROUTE_OF_SLUG[slugify(key)] = route
            # Briefs and ledger rows address pages by the FLATTENED slug
            # (briefs/pricing-heygen.json for the route /pricing/heygen/). The alias
            # lives in its OWN map, never as a second row: a duplicate row made every
            # nested page collide with itself in the sibling head-phrase scan.
            flat = slugify(key).replace("/", "-")
            if flat != slugify(key):
                SLUG_ALIASES[flat] = slugify(key)
                ROUTE_OF_SLUG.setdefault(flat, route)
    if LEGACY_SLUG_COL:
        print("WARN blueprint keys its rows on %s, not the contracts section-9 "
              "column `url_slug` - rows were read through the alias list"
              % ", ".join("`%s`" % c for c in sorted(LEGACY_SLUG_COL)))
    if RAGGED:
        print("WARN blueprint rows have more fields than the header (columns to "
              "the right are mis-keyed): %s" % ", ".join(RAGGED[:8]))
    return rows


def dist_file(slug):
    if slug in ("", "index", "home"):
        return DIST / "index.html"
    route = ROUTE_OF_SLUG.get(slug, slug)
    for cand in (DIST / route / "index.html", DIST / slug / "index.html",
                 DIST / (route + ".html"), DIST / (slug + ".html")):
        if cand.exists():
            return cand
    return DIST / route / "index.html"


def all_pages():
    return sorted(DIST.rglob("index.html")) if DIST.exists() else []


def page_slug(path):
    rel = path.relative_to(DIST).parent.as_posix()
    return "index" if rel in (".", "") else rel


def load_brief(slug):
    # The root page's dist slug is "index", but the research side names the root row "home"
    # (research/serp/home.json, and brief_scaffold.py derives the brief name from it). Without
    # the alias the home page is the one page on the site with no brief, and every brief-based
    # check on it reports "brief has no target_keyword" rather than a real finding.
    names = [slug.replace("/", "-"), slug]
    if slug == "index":
        names.append("home")
    for cand in [BRIEFS / (n + ".json") for n in names]:
        if cand.exists():
            d = load_json(cand, on_error=None)
            if d is None:
                print("FAIL brief %s is not readable JSON - it is truncated or "
                      "half-written. The page is graded with NO brief, so every "
                      "brief-derived floor below is unresolvable." % cand.name)
                return {}
            return as_dict(d)
    return {}


def body_html(html):
    m = re.search(r"<main\b[^>]*>(.*?)</main\s*>", html, re.I | re.S)
    return CHROME.sub(" ", m.group(1) if m else html)


def asset_index():
    known = set()
    amap = ROOT / "public" / "images" / "asset-map.json"
    if amap.exists():
        try:
            data = json.loads(amap.read_text(encoding="utf-8", errors="replace"))
            vals = data.values() if isinstance(data, dict) else data
            for v in vals:
                for item in (v if isinstance(v, list) else [v]):
                    if isinstance(item, dict):
                        known.add(str(item.get("file") or item.get("src") or ""))
                    else:
                        known.add(str(item))
        except Exception:
            pass
    for base in (ROOT / "public", DIST):
        if base.exists():
            for f in base.rglob("*"):
                if f.is_file():
                    known.add("/" + f.relative_to(base).as_posix())
    return known


def _drop_tagged(text):
    """Lines carrying a [VERIFY]/[NEEDS PROOF]/... marker are NOT evidence.

    Without this a figure tagged as unverified in an SME file provenanced an
    untagged copy of itself in the body copy - the artifact leak the --artifact-leak
    gate exists to catch, laundered through the provenance corpus.
    """
    return "\n".join(ln for ln in text.splitlines() if not MARKER.search(ln))


def corpus_text():
    chunks = []
    p = ROOT / "research" / "market-voice.md"
    if p.exists():
        chunks.append(p.read_text(encoding="utf-8", errors="replace"))
    # business-context.md's ## CANONICAL section is the sourced half; the rest is
    # discovery narrative and provenances nothing.
    p = ROOT / "config" / "business-context.md"
    if p.exists():
        t = p.read_text(encoding="utf-8", errors="replace")
        m = re.search(r"^##\s*CANONICAL.*?(?=^##\s|\Z)", t, re.S | re.M | re.I)
        chunks.append(m.group(0) if m else t)
    for d in ("research/items", "config/sme"):
        p = ROOT / d
        if p.exists():
            for f in p.glob("*.md"):
                chunks.append(f.read_text(encoding="utf-8", errors="replace"))
    return _drop_tagged("\n".join(chunks))


def site_head_index():
    """{slug: (title, h1, first-150-words)} for every built page."""
    idx = {}
    for f in all_pages():
        html = f.read_text(encoding="utf-8", errors="replace")
        t = re.search(r"<title[^>]*>(.*?)</title>", html, re.I | re.S)
        h1 = re.search(r"<h1(?:\s[^>]*)?>(.*?)</h1\s*>", html, re.I | re.S)
        body = text_of(body_html(html))
        idx[page_slug(f)] = (text_of(t.group(1)) if t else "",
                             text_of(h1.group(1)) if h1 else "",
                             " ".join(words(body)[:150]))
    return idx


def phrase_in(hay, phrase, filler=0):
    if not phrase:
        return True
    hay_l = " " + re.sub(r"\s+", " ", (hay or "").lower()) + " "
    if phrase.lower() in hay_l:
        return True
    if filler:
        toks = [re.escape(t) for t in phrase.lower().split()]
        pat = (r"\W+(?:\w+\W+){0,%d}" % filler).join(toks)
        return re.search(pat, hay_l) is not None
    return False


def cover(terms, hay_lower, hay_tokens):
    exact = sum(1 for t in terms if t.lower() in hay_lower)
    tok = 0
    for t in terms:
        tt = [x for x in re.findall(r"[a-z0-9]+", t.lower()) if len(x) > 2]
        if tt and all(x in hay_tokens for x in tt):
            tok += 1
    n = max(1, len(terms))
    return (round(100 * exact / n), round(100 * tok / n),
            [t for t in terms if t.lower() not in hay_lower])


def check_page(slug, cfg, bp, heads, assets, corpus, draft_html=None):
    out, summ = [], {}
    row = bp.get(slug) or bp.get(SLUG_ALIASES.get(slug, ""), {})
    brief = load_brief(slug)
    if draft_html is not None:
        html = draft_html
    else:
        f = dist_file(slug)
        if not f.exists():
            return [("FAIL", "build", "dist page missing: %s" % f)], "build=missing"
        html = f.read_text(encoding="utf-8", errors="replace")
    body = body_html(html)
    btext = text_of(body)
    bl = btext.lower()
    btok = set(re.findall(r"[a-z0-9]+", bl))
    bw = len(words(btext))
    # contracts.md §1a: read BOTH columns under their canonical names, no fallbacks
    # to the dead vocabulary.
    # as_text, not .strip(): a brief carrying `page_tier: 2` (an int, which one
    # real project ships) raised AttributeError here and killed the whole run.
    page_tier = as_text(row.get("page_tier") or brief.get("page_tier")).lower()
    value_tier = as_text(row.get("value_tier") or brief.get("value_tier")).lower()
    # ROUTE CLASS is the ONE resolution that does not need a blueprint row, and
    # it is a CITATION, not a fallback: contracts section-1a names 404,
    # thank-you, privacy and terms as carrying no floor, and /contact 600 and
    # /about 800 as the two utility overrides. Those six route names ARE the
    # contract's own vocabulary, so a built route with one of those tails is
    # `utility` whether or not anyone remembered to write it a blueprint row.
    #
    # It stops there, deliberately. An archive (`/blog`, `/services`) and a
    # programmatic set (`/areas/*`, `/puppy/*`) are NOT resolved here even
    # though a structural test could guess them, because guessing `utility` for
    # a page that is really a money hub drops its word floor from 2,200 to 600
    # and prints PASS - the exact laxest-default failure this block exists to
    # prevent. Those routes keep HALTing until a blueprint row declares them.
    tier_by_route = ""
    if not page_tier:
        _tail = slug.strip("/").split("/")[-1].lower()
        if _tail in UTILITY_ROUTES or _tail in ("about", "about-us", "contact",
                                                "contact-us", "privacy-policy",
                                                "terms-of-service", "terms-of-use"):
            page_tier, tier_by_route = "utility", _tail
    if tier_by_route:
        out.append(("PASS", "tier", "utility RESOLVED BY ROUTE CLASS (%r is named "
                    "floor-free in contracts section-1a); this route has NO "
                    "blueprint row - add one" % tier_by_route))
    # contracts §1a: a tier that cannot be read is a HALT, never a default.
    # Audited 2026-09-04: page_tier defaulted to "outer" and value_tier to "C" on
    # 26 of 29 projects whose blueprints predate the 39-column contract, so every
    # A-tier money page was graded against the 1,100-word C floor and the 8-FAQ
    # outer floor, and printed PASS. A gate that cannot read its own key must say
    # so; it must not grade the page against the laxest available standard.
    tier_errs = []
    if page_tier not in FAQ_FLOOR and page_tier not in NOFLOOR:
        tier_errs.append("page_tier %r is not in the contracts section-1a vocabulary "
                         "(core|outer|utility|compare|monetization|functional)"
                         % (page_tier or "<empty>"))
    if page_tier not in NOFLOOR and value_tier not in VALUE_FLOOR:
        tier_errs.append("value_tier %r is not A|B|C|D - the blueprint has no "
                         "value_tier column or the brief omits the field"
                         % (value_tier or "<empty>"))
    if tier_errs:
        return ([("FAIL", "tier", "; ".join(tier_errs)
                  + " | fix the blueprint row and the brief, per contracts "
                    "section-1a and section-9; verify_page will not grade a page whose floors "
                    "cannot be resolved")],
                "tier=unresolvable")
    tier = page_tier                   # every message below prints the page_tier
    depth = (row.get("brief_depth") or brief.get("brief_depth") or "").strip().lower()
    legal_route = slug.strip("/").split("/")[-1] in UTILITY_ROUTES
    keywordless = not ((row.get("target_keyword") or "").strip()
                       or (brief.get("target_keyword") or "").strip())
    # a deliberately keywordless blueprint row (functional grid, generated hub) is
    # measured as a utility page: it has no brief-driven copy contract to enforce
    is_utility = (page_tier in NOFLOOR or depth == "utility" or legal_route
                  or keywordless)
    # THE shared predicate (contracts §3). `state` is full | partial | exempt, and it is
    # the same answer check-quotes.mjs and check-references.mjs get. NOT the same
    # answer audit_built_html.py and ledger.py get: both still pass the route alone,
    # so a keywordless or utility ROW that is not a utility ROUTE diverges there.
    # See the status note on exemptions.py::exemption_for.
    fig_state = exemption(slug, cfg, "FIGURE_EXEMPT_ROUTES", tier=page_tier,
                          brief_depth=depth, has_keyword=not keywordless)
    quote_state = exemption(slug, cfg, "QUOTE_EXEMPT_ROUTES", tier=page_tier,
                            brief_depth=depth, has_keyword=not keywordless)
    fig_exempt = fig_state == EXEMPT
    # /contact/ is PARTIAL for figures (one non-interactive figure below the form) and
    # carries no quote or Sources duty at all.
    quote_exempt = quote_state in (EXEMPT, PARTIAL)

    # ---- words ----------------------------------------------------------
    # contracts.md §1a: floor = f(value_tier); page_tier=utility overrides to 600;
    # 404 / thank-you / privacy / terms carry no floor at all.
    if legal_route:
        floor = 0
    elif is_utility:
        floor = UTILITY_FLOOR
    else:
        floor = VALUE_FLOOR.get(value_tier, VALUE_FLOOR["c"])
    # contracts §1a: briefs write the band at serp_analysis.word_band; reading the
    # top-level key alone left tmin=0 on ~130 briefed pages, so the commissioned
    # target was never compared to the finished page (audit 2026-09-04 finding 3).
    band = (as_dict(as_dict(brief.get("serp_analysis")).get("word_band"))
            or as_dict(brief.get("word_band")))
    target, tmin = brief.get("word_count_target"), 0
    if isinstance(band, dict) and band.get("top3_median"):
        try:
            tmin = int(round(1.1 * float(band["top3_median"])))
        except (TypeError, ValueError):
            tmin = 0
    if isinstance(target, (int, float)):
        tmin = max(tmin, int(target))
    need = max(floor, tmin)
    summ["w"] = bw
    # contracts.md §1a states the band as "-0% / +15% of the governing number.
    # Under the floor is a FAIL and always was. Over the band is now equally a
    # FAIL." Only the UNDER half was implemented, so the ceiling half of the
    # rule had never fired on any page ever built: found 2026-09-04 by
    # gate_conflicts.py --probe, which added 6,000 words to a page and watched
    # every gate keep printing PASS. A stated bound with no instrument is a note.
    # The ceiling is +15% of the GOVERNING NUMBER, and the governing number is
    # the commissioned target (1.1 x the top-3 median, or the brief's explicit
    # word_count_target) - never the tier FLOOR. A floor is a minimum; +15% of a
    # minimum is not a ceiling, and deriving one that way failed a 1,689-word
    # blog post against a 690-word "band" it was never commissioned to. When a
    # page carries no band, it has no ceiling, and the gate says so rather than
    # inventing one.
    band_ceiling = int(round(tmin * 1.15)) if tmin else 0
    summ["w"] = bw
    if bw < need:
        fail("words", "%d < floor %d (page_tier=%s value_tier=%s band=%s)"
             % (bw, need, page_tier, value_tier.upper(), tmin or "-"), out)
    elif band_ceiling and bw > band_ceiling:
        fail("words", "%d > band ceiling %d (+15%% of %d) - CUT, do not justify: "
             "restated content first, then sentences with no figure or mechanism, "
             "then the outline's P3 sections. Never cut a sourced figure, a "
             "practitioner note, an SME quote or a required H2 (page_tier=%s "
             "value_tier=%s)"
             % (bw, band_ceiling, need, page_tier, value_tier.upper()), out)
    else:
        ok("words", "%d in band [%d, %s] / floor %d"
           % (bw, need, band_ceiling or "no commissioned band - no ceiling", floor),
           out)

    # ---- kw (binary assertion first) ------------------------------------
    kw = (brief.get("target_keyword") or "").strip()
    sec = (brief.get("secondary_keyword") or "").strip()
    tm = re.search(r"<title[^>]*>(.*?)</title>", html, re.I | re.S)
    title = text_of(tm.group(1)) if tm else ""
    hs = [(int(l), text_of(t)) for l, t in H_TAG.findall(html)]
    h1s = [t for l, t in hs if l == 1]
    h2s = [t for l, t in hs if l == 2]
    first100 = " ".join(words(btext)[:100])
    if kw:
        dens = bl
        for q in (brief.get("faq") or []):
            qt = q.get("question", "") if isinstance(q, dict) else str(q)
            if qt:
                dens = dens.replace(qt.lower(), " ")
        # The BRAND is not keyword optimisation. When BUSINESS_NAME contains the target term -
        # "BTO Renovation SG" against the target "bto renovation" - the header, the byline and
        # three footer mentions spend five of the allowance on every page before a word of copy
        # is written, and the ceiling becomes unreachable by construction. Strip the brand
        # first, exactly as the FAQ questions above are stripped, then count the prose.
        bn = (cfg.get("BUSINESS_NAME") or "").strip().lower()
        if bn and kw.lower() in bn:
            dens = dens.replace(bn, " ")
        # OCCURRENCES THIS PIPELINE REQUIRES ELSEWHERE ARE NOT STUFFING. The headings
        # gate fails the page if a briefed H2 is missing, and the entity gate fails it
        # if a HIGH entity is absent; when the target phrase IS a briefed H2 or a HIGH
        # entity, counting those toward a stuffing ceiling makes three gates
        # contradict, and every way of satisfying one breaks another. Measured live on
        # hdb-renovation: 7 against a ceiling of 6, where the H1, the capsule, a briefed
        # H2 and a required entity account for four. Strip the mandated occurrences,
        # then judge the prose that remains.
        hits = len(re.findall(re.escape(kw.lower()), dens))
        # The CEILING counts prose only. A briefed H2 carrying the target phrase is
        # REQUIRED by the headings gate, so counting it as stuffing made the two gates
        # contradict. The FLOOR still counts every occurrence, because the floor asks
        # whether the page is about the topic at all.
        dens_prose = dens
        for h in h2s:
            if phrase_in(h, kw):
                dens_prose = dens_prose.replace(h.lower(), " ", 1)
        hits_prose = len(re.findall(re.escape(kw.lower()), dens_prose))
        ceiling = max(1, bw // 150)
        probs = []
        if not phrase_in(title, kw):
            probs.append("not in <title>")
        if not any(phrase_in(h, kw) for h in h1s):
            probs.append("not in <h1>")
        if not phrase_in(first100, kw):
            probs.append("not in first 100 words")
        if not any(phrase_in(h, kw) for h in h2s):
            probs.append("not in any H2")
        # reference/contracts.md HEAD: 4-6 exact-match body mentions on a
        # standard-length page, floor 3 under ~1,200 body words.
        kw_lo = 4 if bw >= 1200 else 3
        kw_hi = min(6 if bw >= 1200 else max(3, ceiling), ceiling)
        if hits < kw_lo:
            probs.append("body %dx < %d (band 4-6, floor 3 under 1,200 words)"
                         % (hits, kw_lo))
        if hits_prose > kw_hi:
            probs.append("body %dx in prose > band max %d (ceiling <=1 per ~150 words "
                         "= %d; briefed H2s excluded, they are required elsewhere)"
                         % (hits_prose, kw_hi, ceiling))
        for p in P_TAG.findall(body):
            if len(re.findall(re.escape(kw.lower()), text_of(p).lower())) > 1:
                probs.append("twice in one <p>")
                break
        if sec and not phrase_in(btext, sec, filler=2):
            probs.append('secondary "%s" not present as an exact phrase' % sec)
        if probs:
            fail("kw", "; ".join(probs), out)
            summ["kw"] = "fail"
        else:
            ok("kw", "title/h1/first100/h2/body=%dx (band %d-%d) ratio=1:%d "
                     "secondary=exact" % (hits, kw_lo, kw_hi, bw // max(1, hits)), out)
            summ["kw"] = "ok:%dx" % hits
    elif keywordless:
        ok("kw", "keywordless row by design (functional/hub) - no keyword contract", out)
        summ["kw"] = "none"
    else:
        fail("kw", "brief has no target_keyword", out)
        summ["kw"] = "fail"

    # ---- lsi ------------------------------------------------------------
    lsi = brief.get("lsi_keywords") or {}
    # The scaffold emits {primary, secondary, all}; hand-authored briefs have shipped
    # a flat list. Treat that as the "all" band rather than crashing the run.
    if isinstance(lsi, list):
        lsi = {"all": lsi}
    elif not isinstance(lsi, dict):
        lsi = {}
    # `page_type` is where this blueprint records hub-ness; `hub_or_node` carries the silo
    # LEVEL ("L2"), not the word "hub". Reading only the latter classified both L2 hubs as
    # ordinary content pages, so the 5-link body cap meant for a leaf was applied to a page
    # whose whole job is to link to its children.
    is_hub = (row.get("hub_or_node", "").lower() == "hub"
              or row.get("page_type", "").lower() == "hub"
              or tier == "hub" or slug == "index")
    for key, floor_pct, label in (("primary", 80, "P"), ("secondary", 70, "S"), ("all", 40, "A")):
        terms = lsi.get(key) or []
        if not terms:
            continue
        ex, tk, missing = cover(terms, bl, btok)
        best = max(ex, tk)
        summ["lsi" + label] = "%d%%" % best
        low = 15 if is_hub else floor_pct
        if best < low:
            fail("lsi", "%s %d%% < %d%% (exact %d%% / token %d%%); missing: %s"
                 % (key, best, low, ex, tk, ", ".join(missing[:12])), out)
        elif key == "all" and best > 70:
            ok("lsi", "all %d%% ADVISORY over 60%% - re-read for inserted-phrase artifacts"
               % best, out)
        else:
            ok("lsi", "%s %d%% (exact %d%% / token %d%%)" % (key, best, ex, tk), out)

    # ---- ent ------------------------------------------------------------
    _em = brief.get("entity_map") or {}
    ents = (_em.get("entities") if isinstance(_em, dict) else _em) or []
    if ents:
        hi = [e for e in ents if str(e.get("salience", "")).upper() == "HIGH"]
        me = [e for e in ents if str(e.get("salience", "")).upper() == "MEDIUM"]
        mh = [e.get("name", "") for e in hi if e.get("name", "").lower() not in bl]
        mm = [e.get("name", "") for e in me if e.get("name", "").lower() not in bl]
        summ["ent"] = "%d/%dH,%d/%dM" % (len(hi) - len(mh), len(hi), len(me) - len(mm), len(me))
        pct_m = 100 * (len(me) - len(mm)) // max(1, len(me))
        if mh or pct_m < 80:
            fail("ent", "HIGH missing: %s | MEDIUM %d%%: %s"
                 % (", ".join(mh) or "-", pct_m, ", ".join(mm[:8]) or "-"), out)
        else:
            ok("ent", summ["ent"], out)

    # ---- faq ------------------------------------------------------------
    # Capture the ELEMENT'S TEXT, not the characters between its '>' and the next '<'.
    # The kit wraps every question in an inner <h3>, so the old pattern returned 14
    # EMPTY strings and the parity check below compared them to 14 real questions -
    # failing 20 of 27 pages on this site while printing the unfalsifiable
    # "FAQPage JSON-LD (14) != visible set (14)". Counts equal, contents empty.
    vis = [text_of(m) for m in re.findall(
        r'data-faq-question[^>]*>(.*?)</summary\s*>', html, re.I | re.S)]
    vis = [v for v in vis if v.strip()]
    if not vis:
        vis = [t for l, t in hs if l == 3 and t.strip().endswith("?")]
    ld_qs = []
    # The kit BaseLayout emits FAQPage INSIDE @graph, and this walker did not descend
    # it - so every kit-built page reported jsonld=0 and the parity check below, which
    # only ran when ld_qs was non-empty, never ran at all. Same walker shape as the
    # head gate.
    for blk in JSONLD.findall(html):
        try:
            data = json.loads(blk)
        except Exception:
            continue
        stack = list(data if isinstance(data, list) else [data])
        while stack:
            node = stack.pop()
            if not isinstance(node, dict):
                continue
            stack.extend(g for g in (node.get("@graph") or []) if isinstance(g, dict))
            if "FAQPage" in json.dumps(node.get("@type", "")):
                for q in node.get("mainEntity", []) or []:
                    if isinstance(q, dict) and q.get("name"):
                        ld_qs.append(q["name"])
    bank = len(as_list(brief.get("faq"))) + len(as_list(brief.get("questions")))
    # contracts.md §1a: FAQ floor = f(page_tier), never f(value_tier); the brief-time
    # gate in validate_brief.py uses the SAME map, so a brief can no longer pass with
    # 6 promoted FAQs and then FAIL here (CONS-23).
    # page_tier is validated above, so this lookup cannot miss; no laxest-floor
    # fallback (contracts §1a, audit 2026-09-04 finding 2).
    need_faq = 0 if is_utility else FAQ_FLOOR[page_tier]
    if bank:
        need_faq = min(need_faq, bank)
    summ["faq"] = len(vis)
    if not is_utility and len(vis) < need_faq:
        fail("faq", "visible %d < %d" % (len(vis), need_faq), out)
    elif not is_utility and vis and not ld_qs:
        # verify-page.md promises "the FAQPage JSON-LD question set == the visible set".
        # A page shipping NO FAQPage schema used to satisfy that promise silently.
        fail("faq", "%d visible FAQs but no readable FAQPage JSON-LD "
                    "(is it nested in @graph, or missing?)" % len(vis), out)
    elif ld_qs and sorted(x.strip().lower() for x in ld_qs) != sorted(
            text_of(x).strip().lower() for x in vis):
        fail("faq", "FAQPage JSON-LD (%d) != visible set (%d)" % (len(ld_qs), len(vis)), out)
    else:
        ok("faq", "visible=%d jsonld=%d" % (len(vis), len(ld_qs)), out)

    # ---- paa ------------------------------------------------------------
    paa = brief.get("paa") or []
    if paa:
        rew = {r.get("original", ""): r.get("used", "")
               for r in (brief.get("paa_rewords") or [])}
        heads_l = [h.lower().rstrip("?") for _, h in hs]
        verb = sum(1 for q in paa[:4]
                   if rew.get(q, q).lower().rstrip("?") in heads_l)
        covered = sum(1 for q in paa
                      if phrase_in(btext, rew.get(q, q).rstrip("?"), filler=3)
                      or rew.get(q, q).lower().rstrip("?") in heads_l)
        summ["paa"] = "%d/%d" % (verb, min(4, len(paa)))
        if not is_utility and verb < min(3, len(paa)):
            fail("paa", "verbatim %d/%d (need >=3 of top 4); covered %d/%d"
                 % (verb, min(4, len(paa)), covered, len(paa)), out)
        else:
            ok("paa", "verbatim %d/%d covered %d/%d"
               % (verb, min(4, len(paa)), covered, len(paa)), out)

    # ---- h1 uniqueness --------------------------------------------------
    if len(h1s) != 1:
        fail("h1", "%d <h1> on the page (need exactly 1)" % len(h1s), out)
        summ["h1"] = "dupe"
    else:
        clash = []
        first150 = " ".join(words(btext)[:150])
        # heads is keyed by the ROUTE slug (pricing/heygen) while `slug` may be the
        # flattened brief slug (pricing-heygen). Comparing the raw strings failed to
        # skip the page itself, so every nested page collided with its own head phrase.
        canon = SLUG_ALIASES.get(slug, slug)
        for other, (ot, oh, _) in heads.items():
            if other == slug or SLUG_ALIASES.get(other, other) == canon:
                continue
            okw = bp.get(other, {}).get("target_keyword", "")
            # Mirror of the nesting rule below: a HUB's term appearing in a SPOKE's title
            # ("hdb renovation" inside "HDB Renovation Permit") is the silo working, and a
            # page with no target keyword of its own is not competing for anything.
            if kw and okw and not phrase_in(okw, kw) and (
                    phrase_in(ot, kw) or phrase_in(oh, kw)):
                clash.append(other)
            # A HUB's term is legitimately a substring of its spokes': "bto renovation" lives
            # inside "bto renovation cost", and a cost page that never says "bto renovation"
            # would read as written for a crawler. That nesting is correct siloing, not
            # cannibalisation, so it is only a clash when the other page's term is NOT already
            # contained in this page's own target. Two pages genuinely chasing one term still
            # fail, which is what this check is for.
            nested = bool(kw and okw and phrase_in(kw, okw))
            # A page with no target keyword of its own (about, terms, an index) cannot
            # cannibalise anything: it is SUPPOSED to name the site's topics in its opening.
            # Without this the utility pages fail for describing the site they belong to.
            if kw and okw and not nested and (phrase_in(title, okw) or phrase_in(h1s[0], okw)
                                              or phrase_in(first150, okw)):
                clash.append(other + "(sibling phrase here)")
        if clash:
            fail("h1", "head-phrase collision with: %s"
                 % ", ".join(sorted(set(clash))[:6]), out)
            summ["h1"] = "clash"
        else:
            ok("h1", "unique (0 collisions across %d built pages)" % len(heads), out)
            summ["h1"] = "unique"

    # ---- breaks ---------------------------------------------------------
    plist = P_TAG.findall(body)
    longp, bad_p = [], None
    for p in plist:
        t = text_of(p)
        if not t:
            continue
        sc, wc = len(sentences(t)), len(words(t))
        if sc > 8:
            longp.append(t[:200])
        if bad_p is None and (sc > 3 or wc > 60):
            bad_p = "<p> with %d sentences / %d words: %s..." % (sc, wc, t[:70])
    run = maxrun = gap = maxgap = 0
    for tag, inner in re.findall(
            r"<(p|h[2-6]|ul|ol|table|figure|blockquote|dl|pre)\b[^>]*>(.*?)</\1\s*>",
            body, re.I | re.S):
        if tag.lower() == "p":
            run += 1
            maxrun = max(maxrun, run)
            gap += len(words(text_of(inner)))
            maxgap = max(maxgap, gap)
        else:
            run = gap = 0
    if bad_p:
        fail("breaks", bad_p, out)
    elif maxrun >= 3:
        fail("breaks", "run of %d consecutive <p> without a break element" % maxrun, out)
    elif maxgap > 250:
        fail("breaks", "%d words between structural breaks (max 250)" % maxgap, out)
    else:
        ok("breaks", "maxrun=%d max_gap=%dw" % (maxrun, maxgap), out)
    for lp in longp:
        print("  NOTE eyeball this paragraph (>8 sentences): %s" % lp)

    # ---- capsule / front ------------------------------------------------
    cap = re.search(r"</h1\s*>(.*?)(?:<h2|\Z)", html, re.I | re.S)
    captext = text_of(cap.group(1))[:1200] if cap else ""
    capfull = " ".join(words(captext)[:70])
    has_fig = re.search(UNIT, capfull, re.I) is not None
    caplen = len(words(captext)[:60])
    h2caps = 0
    for h in h2s:
        seg = html.split(h, 1)
        if len(seg) > 1:
            t = text_of(seg[1][:1500])
            if len(words(t)) >= 30 and re.search(UNIT, " ".join(words(t)[:60]), re.I):
                h2caps += 1
    pct = round(100 * h2caps / max(1, len(h2s)))
    if not is_utility and (not captext or not phrase_in(capfull, kw) or not has_fig):
        fail("capsule", "no labelled 40-60w answer capsule after the H1 carrying the "
                        "target phrase + a concrete figure", out)
    else:
        ok("capsule", "%dw phrase=yes figure=%s h2_capsules=%d/%d (%d%%)"
           % (caplen, "yes" if has_fig else "no", h2caps, len(h2s), pct), out)
    front = " ".join(sentences(btext)[:2])
    if not is_utility and not re.search(UNIT, front, re.I):
        fail("front", "first two body sentences carry no concrete figure", out)
    else:
        ok("front", "figure present in the first 2 sentences", out)

    # ---- tells ----------------------------------------------------------
    tells = []
    # A generic word inside BUSINESS_NAME ("Pet", "Farm", "Services") is not a
    # location tell; without this a site failed on its own name.
    GENERIC = {"farm", "farms", "pet", "pets", "shop", "store", "group", "services",
               "service", "company", "kennel", "kennels", "dog", "dogs", "puppy", "puppies"}
    # The hardcoded list above is a pet-niche list, so any other vertical whose BUSINESS_NAME
    # contains its own common noun fails on every page: "BTO Renovation SG" made the word
    # "renovation" a location tell 25 pages running. BRAND_GENERIC_TOKENS in project-config
    # names the tokens of THIS brand that are ordinary nouns rather than proper nouns.
    GENERIC |= {t.strip().lower()
                for t in (cfg.get("BRAND_GENERIC_TOKENS") or "").replace(",", " ").split()
                if t.strip()}
    for name in filter(None, [cfg.get("PRIMARY_CITY"), cfg.get("COUNTRY"),
                              cfg.get("BUSINESS_NAME")]):
        for tok in name.split():
            if len(tok) > 3 and tok.lower() not in GENERIC and re.search(
                    r"[a-z,]\s" + re.escape(tok.lower()) + r"\b", btext):
                tells.append(tok.lower())
    lvls = [l for l, _ in hs]
    jumps = sum(1 for a, b in zip(lvls, lvls[1:]) if b - a > 1)
    if tells or jumps:
        fail("tells", "lowercase_proper=%s h1->h3 jumps=%d"
             % (",".join(sorted(set(tells))) or "0", jumps), out)
    else:
        ok("tells", "lowercase_proper=0 h1->h3=0", out)

    # ---- links ----------------------------------------------------------
    # CONTEXTUAL links only. The Root-Seed-Node cap governs TOPICAL body links - the
    # ones that pass authority and shape the silo. A conversion CTA pointing at the
    # form is chrome, not a contextual link, and counting it meant that adding the
    # CTA cadence a lead page needs pushed the page over its own linking cap. Excluded
    # by role (data-cta / the primary CTA class), never by destination alone, so a real
    # contextual link to the same page still counts.
    # CONTEXTUAL links only. The Root-Seed-Node cap governs TOPICAL body links - the
    # ones that pass authority and shape the silo. A conversion CTA pointing at the
    # form is chrome, not a contextual link, and counting it meant that adding the CTA
    # cadence a lead page needs pushed the page over its own linking cap. Excluded by
    # ROLE (data-cta, or a button class), never by destination, so a genuine
    # contextual link to the same page still counts. A_TAG captures href + inner text,
    # not the attributes, so the role test needs the whole opening tag.
    CTA_ROLE = re.compile(r"data-cta|data-primary-cta|class=[\"'][^\"']*\bbtn\b", re.I)
    internal = []
    for m in re.finditer(r"<a(?:\s[^>]*)?\shref=[\"']([^\"']+)[\"']([^>]*)>(.*?)</a\s*>",
                         body, re.I | re.S):
        href, attrs, inner = m.group(1), m.group(2), m.group(3)
        if not href.startswith("/"):
            continue
        if CTA_ROLE.search(m.group(0)[:m.group(0).find(">") + 1]):
            continue
        internal.append((href, text_of(inner)))
    contract = brief.get("link_contract") or {}
    want = [row.get("link_root", ""), row.get("link_seed", ""), row.get("link_node", "")]
    want = [w for w in want if w] or [contract.get(k, "") for k in ("root", "seed", "node")
                                      if contract.get(k)]
    missing_l = [w for w in want
                 if not any(w.rstrip("/") == h.rstrip("/") for h, _ in internal)]
    built = {("/" + page_slug(p) + "/").replace("/index/", "/") for p in all_pages()}
    broken = [h for h, _ in internal
              if h.split("#")[0].split("?")[0] not in built
              and not (DIST / h.strip("/")).exists()]
    cap_links = 99 if (is_hub or slug == "index" or is_utility) else 5
    over = []
    reg = ROOT / "config" / "anchor-registry.json"
    if reg.exists():
        try:
            rj = json.loads(reg.read_text(encoding="utf-8", errors="replace"))
            for e in rj.get("over_soft_cap", []):
                # brand/compliance anchors are allowed over the soft cap (Task G3.8)
                if e.get("reason") in ("brand", "compliance"):
                    continue
                if e.get("target") and any(e["target"].rstrip("/") == h.rstrip("/")
                                           for h, _ in internal):
                    over.append("%s->%s" % (e.get("anchor"), e.get("target")))
        except Exception:
            pass
    if missing_l or broken or len(internal) > cap_links or over:
        fail("links", "missing contract=%s broken=%s body=%d cap=%s anchors_over_cap=%d"
             % (missing_l or "-", broken or "-", len(internal), cap_links, len(over)), out)
    else:
        ok("links", "body=%d (root/seed/node present) broken=0 anchors_over_cap=0"
           % len(internal), out)

    # ---- images ---------------------------------------------------------
    # REQ-9: the floor is POLICY-AWARE and counted BY EXTENSION. Under photo /
    # mixed only rasters count toward >=2; an SVG in an <img> is reported as
    # svg_as_raster and is itself a FAIL under photo. Under figure the raster
    # floor is 0 (alt/dims/placeholders still apply).
    imgs = IMG_TAG.findall(html)
    policy = (cfg.get("IMAGE_POLICY") or "photo").strip().lower()
    if policy not in ("photo", "figure", "mixed"):
        policy = "photo"
    raster = svg_as_raster = unsized = noalt = 0
    for tag in imgs:
        m = re.search(r'\ssrc=["\']([^"\']+)["\']', tag) or \
            re.search(r'\ssrcset=["\']([^"\',\s]+)', tag)
        s = m.group(1) if m else ""
        resolves = bool(s) and (s in assets or s.startswith("data:")
                                or (DIST / s.lstrip("/")).exists())
        if resolves:
            kind = img_kind(s)
            if kind == "raster":
                raster += 1
            elif kind == "svg":
                svg_as_raster += 1
        if not re.search(r'\swidth=', tag) or not re.search(r'\sheight=', tag):
            unsized += 1
        if not re.search(r'\salt=', tag):
            noalt += 1
    placeholders = len(re.findall(
        r'src=["\'][^"\']*(?:placeholder|coming-soon|no-image)', html, re.I))
    summ["img"] = raster
    need_img = 0 if (is_utility or policy == "figure") else 2
    svg_leak = svg_as_raster if policy == "photo" else 0
    if raster < need_img or unsized or noalt or placeholders or svg_leak:
        fail("images",
             "policy=%s raster=%d (need %d) svg_as_raster=%d unsized=%d no_alt=%d "
             "placeholders=%d" % (policy, raster, need_img, svg_as_raster, unsized,
                                  noalt, placeholders), out)
    else:
        ok("images", "policy=%s raster=%d (need %d) svg_as_raster=%d unsized=0 alt=ok "
                     "placeholders=0" % (policy, raster, need_img, svg_as_raster), out)

    # ---- figures --------------------------------------------------------
    figs = len(re.findall(r"<figure[^>]*\bdata-figure\b", html, re.I))
    anim = len(re.findall(r"data-figure-interactive", html, re.I))
    summ["fig"] = "%d(%danim)" % (figs, anim)
    # W11.3: this file IMPORTED figure_floor() and never called it, so /contact/ — which
    # the shared predicate calls PARTIAL (exactly ONE non-interactive figure below the
    # form) — was measured against the FULL floor of ">=2 figures, >=1 interactive". That
    # is the exact INVERSE of audit_built_html.py --figures, which failed the same page for
    # having 2 interactive figures. One route, two instruments, opposite verdicts.
    lo, need_anim, cap_anim = figure_floor(fig_state)
    if fig_exempt:
        ok("figures", "n/a (exempt route: contracts.md one-exemption-list)", out)
    elif figs < lo:
        fail("figures", "data-figure=%d (need >=%d for a %s route)"
             % (figs, lo, fig_state), out)
    elif anim < need_anim:
        fail("figures", "data-figure-interactive=%d (need >=%d for a %s route)"
             % (anim, need_anim, fig_state), out)
    elif cap_anim is not None and anim > cap_anim:
        fail("figures", "data-figure-interactive=%d (max %d for a %s route: an animated "
             "figure beside a form is a distraction)" % (anim, cap_anim, fig_state), out)
    elif figs and len(re.findall(r"<figcaption\b", html, re.I)) < figs:
        # A figure without a caption is an unlabelled picture: the reader is not
        # told what it shows and the caption is where a figure's provenance
        # lives. Nothing checked this until the fixture seeded a caption-less
        # figure and every instrument passed it (2026-09-04).
        fail("figures", "%d data-figure block(s) but only %d <figcaption> - every "
             "figure carries a caption naming what it shows and when it was read"
             % (figs, len(re.findall(r"<figcaption\b", html, re.I))), out)
    else:
        ok("figures", "data-figure=%d interactive=%d (%s floor: >=%d figures, %s)"
           % (figs, anim, fig_state, lo,
              "no interactive" if cap_anim == 0 else ">=%d interactive" % need_anim), out)

    # ---- glyphs / ids / ranks (Curio shipped a stray CJK glyph, a duplicate
    # ---- id and hardcoded ranks that contradicted the computed scores) ------
    bad_glyphs = []
    for m in re.finditer(r"[^\x00-\xff]", btext):
        ch = m.group(0)
        if ch in ALLOWED_GLYPHS:
            continue
        ctx = btext[max(0, m.start() - 20):m.start() + 20].replace("\n", " ")
        bad_glyphs.append("U+%04X in '%s'" % (ord(ch), ctx))
    summ["glyph"] = len(bad_glyphs)
    if bad_glyphs:
        fail("glyphs", "%d characters outside Latin-1 + the declared punctuation set: %s"
             % (len(bad_glyphs), " | ".join(bad_glyphs[:5])), out)
    else:
        ok("glyphs", "0 out-of-script characters in <main> prose", out)

    idvals = re.findall(r"\sid=['\"]([^'\"]+)['\"]", html)
    dup_ids = sorted({i for i in idvals if idvals.count(i) > 1})
    summ["dupid"] = len(dup_ids)
    if dup_ids:
        fail("ids", "%s: %d duplicate id= values %s"
             % (slug, len(dup_ids), dup_ids[:8]), out)
    else:
        ok("ids", "%d ids, 0 duplicates" % len(idvals), out)

    ranks_bad = []
    for tbl in re.findall(r"<table[^>]*\bdata-comparison-table\b.*?</table\s*>",
                          html, re.I | re.S):
        scores = [float(x) for x in
                  re.findall(r"data-row-score=['\"]([-\d.]+)['\"]", tbl)]
        if not scores:
            ranks_bad.append("ComparisonTable emitted no data-row-score "
                             "(the Task G2.30 component contract)")
            continue
        if scores != sorted(scores, reverse=True):
            ranks_bad.append("rows not in descending rubric-score order: %s" % scores[:8])
        shown = [int(x) for x in re.findall(r"data-rank=['\"](\d+)['\"]", tbl)]
        if shown and shown != list(range(1, len(shown) + 1)):
            ranks_bad.append("asserted ranks %s do not match the computed order" % shown[:8])
    summ["ranks"] = "ok" if not ranks_bad else "fail"
    if ranks_bad:
        fail("ranks", "; ".join(ranks_bad[:4]), out)
    else:
        ok("ranks", "comparison rows sorted by the rubric-computed score", out)

    # ---- quote / sources ------------------------------------------------
    quotes = len(re.findall(r"data-expert-quote", html, re.I))
    summ["quote"] = quotes
    if not quote_exempt and quotes < 1:
        fail("quote", "no <blockquote data-expert-quote> on a content page", out)
    else:
        ok("quote", "count=%d" % quotes, out)
    # content-writer's SOURCES RULE promises "every provenance-checked figure has a
    # matching Sources entry". The old gate searched the whole HTML for the literal
    # string "data-sources", so an EMPTY block - or the string appearing in chrome -
    # passed, and no figure was ever matched to an entry.
    src_block = re.search(r"<section[^>]*\bdata-sources\b.*?</section\s*>", html,
                          re.I | re.S)
    src_entries = []
    if src_block:
        for li in re.findall(r"<li\b.*?</li\s*>", src_block.group(0), re.I | re.S):
            claim = text_of(li).strip()
            if claim:
                src_entries.append(claim)
        if not src_entries:
            body_txt = text_of(src_block.group(0)).strip()
            if body_txt:
                src_entries = [ln for ln in body_txt.splitlines() if ln.strip()]
    # figure_text, not btext: block boundaries must not fuse into a figure.
    body_figs = sorted(set(MONEY.findall(figure_text(body_html(html)))))
    norm = lambda x: re.sub(r"[,\s]", "", x.lower())
    entry_blob = norm(" ".join(src_entries))
    unsourced = [f for f in body_figs if norm(f) not in entry_blob]
    summ["src"] = ("%d/%d" % (len(body_figs) - len(unsourced), len(body_figs))
                   if src_entries else "missing")
    if not quote_exempt and not src_block:
        fail("sources", "no <section data-sources> block", out)
    elif not quote_exempt and not src_entries:
        fail("sources", "<section data-sources> is an empty shell (0 entries)", out)
    else:
        # The old third branch failed the page unless every MONEY match appeared
        # VERBATIM inside a Sources entry. Sources entries are publication titles,
        # publishers and read-dates; they do not contain "3 months", "5 days" or even
        # "S$1,350". The test was unpassable by construction, and it duplicated work
        # the `provenance` gate already does properly: that gate matches every figure
        # against the brief's evidence corpus, which is where a figure's source
        # actually lives. This gate owns the BLOCK (present, non-empty); provenance
        # owns the FIGURES.
        ok("sources", ("%d entr(ies) over %d figure(s); figure provenance is the "
                       "`provenance` gate" % (len(src_entries), len(body_figs)))
           if src_block else "n/a (utility)", out)

    # ---- formplace ------------------------------------------------------
    # A005 - the brief declares where the lead capture goes; NOTHING checked the built
    # page. Money pages shipped with no <form> at all against briefs that asked for one,
    # and every visitor was sent to /contact/ to convert - measurable lost lead volume,
    # on the one surface with no gate.
    fp = str(brief.get("form_placement", "")).strip().lower()
    main_html = body_html(html)
    forms_in_main = len(re.findall(r"<form\b", main_html, re.I))
    cta_links = len(re.findall(r'<a[^>]+href=["\']?/contact/', main_html, re.I))
    summ["formplace"] = "%s forms=%d cta=%d" % (fp or "-", forms_in_main, cta_links)
    if not fp or fp not in ("none", "inline_cta", "hero_form", "full_form"):
        if not is_utility:
            fail("formplace", "brief form_placement is %r, not one of "
                              "none|inline_cta|hero_form|full_form" % (fp or ""), out)
        else:
            ok("formplace", "n/a (utility)", out)
    elif fp in ("full_form", "hero_form") and forms_in_main < 1:
        fail("formplace", "brief says %s but <main> contains 0 <form> elements" % fp, out)
    elif fp == "inline_cta" and cta_links < 1 and forms_in_main < 1:
        fail("formplace", "brief says inline_cta but no in-body CTA links to /contact/", out)
    else:
        ok("formplace", "%s (forms=%d, /contact/ links=%d)"
           % (fp, forms_in_main, cta_links), out)

    # ---- provenance -----------------------------------------------------
    found = MONEY.findall(figure_text(body_html(html)))
    # A figure is provenanced when it appears in EVIDENCE, not merely somewhere in the
    # brief. json.dumps(brief) folded in the hand-authored strategy half (meta copy,
    # writer_constraints, outline prose), so a figure the writer invented in the outline
    # provenanced the same figure in the copy. Restrict to the brief's evidence keys.
    EVIDENCE_KEYS = ("serp_analysis", "ground_truth", "external_links", "paa",
                     "sources", "citations", "evidence", "price_facts")
    evidence = {k: brief.get(k) for k in EVIDENCE_KEYS if brief.get(k)}
    corp = re.sub(r"[,\s]", "", (corpus + json.dumps(evidence)).lower())
    # A figure carrying an INLINE ATTRIBUTION on the page is provenanced, whether or
    # not the brief happens to hold it. "S$15,400 (HomeMatch, observed 2026-09-01)" is
    # exactly the sourcing contract the content skill enforces; failing it because the
    # brief's evidence block is older than the copy punishes the honest form. The
    # attribution must be CLOSE to the figure - within the same clause - so a citation
    # elsewhere on the page cannot launder an unsourced number.
    ATTRIB = re.compile(
        r"\((?:[^()]{0,60}?)(?:observed|read|published|source[d]?|per)\s[^()]{0,40}\)"
        r"|\b(?:observed|read|published|checked|collected)\s+(?:on\s+|at\s+)?"
        r"20\d\d-[01]\d-[0-3]\d",
        re.I)
    flat = figure_text(body_html(html))

    def attributed(fig):
        for m in re.finditer(re.escape(fig), flat):
            window = flat[m.end():m.end() + 120]
            # TRIED AND REVERTED 2026-09-04: truncating this window at the next
            # figure, so one attribution could not cover two amounts. It fails
            # correct copy - "S$45,000 across 38 jobs (read 2026-09-04)" has
            # BOTH figures before the single attribution that legitimately
            # covers both, and each truncates the other's window to nothing.
            # One dated clause covering the amounts inside it is the honest
            # form, so the window stays at 120 characters.
            if ATTRIB.search(window):
                return True
        return False

    unmatched = [f for f in found
                 if re.sub(r"[,\s]", "", f.lower()) not in corp and not attributed(f)]
    summ["prov"] = "ok" if not unmatched else "fail"
    if unmatched:
        fail("provenance", "no corpus match: %s"
             % ", ".join(sorted(set(unmatched))[:8]), out)
    else:
        ok("provenance", "%d/%d figures matched" % (len(found), len(found)), out)

    # ---- avoid / spelling -----------------------------------------------
    absolute = split_list(cfg.get("WORDS_TO_AVOID_ABSOLUTE") or cfg.get("WORDS_TO_AVOID"))
    claim = split_list(cfg.get("WORDS_TO_AVOID_CLAIM_ONLY"))
    baseline = {}
    base = ROOT / "audits" / "claim-word-baseline.json"
    if base.exists():
        try:
            baseline = json.loads(base.read_text(encoding="utf-8", errors="replace"))
        except Exception:
            baseline = {}
    ahits = [w for w in absolute if re.search(r"\b" + re.escape(w.lower()) + r"s?\b", bl)]
    chits = [w for w in claim if re.search(r"\b" + re.escape(w.lower()) + r"s?\b", bl)]
    cnew = [w for w in chits if w not in set(baseline.get(slug, []))]
    summ["avoid"] = len(ahits) + len(cnew)
    if ahits or cnew:
        for w in ahits + cnew:
            for s in sentences(btext):
                if re.search(r"\b" + re.escape(w.lower()) + r"s?\b", s.lower()):
                    print("  context [%s]: %s" % (w, s[:160]))
                    break
        fail("avoid", "absolute=%s claim_over_baseline=%s" % (ahits or "-", cnew or "-"), out)
    else:
        ok("avoid", "0 absolute / %d claim-only-as-refusal (baseline ok)" % len(chits), out)
    loc = (cfg.get("SPELLING") or "en-US").strip()
    scrub = bl
    for a in [x.lower() for x in split_list(cfg.get("SPELLING_ALLOW"))]:
        scrub = scrub.replace(a, " ")
    shits = [p for p in SPELL.get(loc, []) if re.search(p, scrub)]
    if shits:
        fail("spelling", "%s: %d other-locale stems %s" % (loc, len(shits), shits[:6]), out)
    else:
        ok("spelling", "%s 0 hits (%d allowlisted)"
           % (loc, len(split_list(cfg.get("SPELLING_ALLOW")))), out)

    # ---- emdash / markers / head ----------------------------------------
    em = html.count("\u2014") + len(re.findall(r"&mdash;|&#8212;", html))
    glued = len(re.findall(r"\w<a\s", html)) + len(re.findall(r"</a>\w", html))
    lts = len(re.findall(r"&lt;strong&gt;", html))
    com = len(re.findall(r"<!--", html))
    summ["emdash"] = em
    if em or glued or lts or com:
        fail("emdash", "emdash=%d glued=%d lt_strong=%d comments=%d"
             % (em, glued, lts, com), out)
    else:
        ok("emdash", "emdash=0 glued=0 lt_strong=0 comments=0", out)
    mk = MARKER.findall(html)
    if mk:
        fail("markers", "%d editorial markers in dist (incl. JSON-LD): %s"
             % (len(mk), sorted(set(mk))[:5]), out)
    else:
        ok("markers", "0", out)

    # Match the attribute's OWN quote character. The old class stopped at the first
    # apostrophe INSIDE a double-quoted attribute, so a description containing
    # "the vendor's own page" measured 40 characters instead of 157.
    # Match the attribute's OWN quote character. The old character class stopped at the
    # first apostrophe INSIDE a double-quoted attribute, so a description containing
    # "the vendor's own page" measured 40 characters instead of 157.
    desc = DESC_RE.search(html)
    dtext = H.unescape(desc.group(1) or desc.group(2) or "") if desc else ""
    canon = re.search(r'<link[^>]+rel=["\']canonical["\'][^>]+href=["\']([^"\']+)', html, re.I)
    ogimg = re.search(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)',
                      html, re.I)
    hp = []
    if len(title) > 60:
        hp.append("title %d > 60" % len(title))
    if not (140 <= len(dtext) <= 158):
        hp.append("meta description %d outside 140-158" % len(dtext))
    noindexed = re.search(r'<meta[^>]+name=["\']robots["\'][^>]+noindex', html, re.I)
    if not canon:
        if not noindexed:
            hp.append("no canonical")
    elif not canon.group(1).rstrip().endswith("/"):
        hp.append("canonical not slash-terminated")
    if not ogimg:
        hp.append("no og:image")
    elif "og-default" in ogimg.group(1) and not noindexed:
        # BaseLayout uses og-default.png for noindex routes ON PURPOSE ("og-default.png is the
        # fallback for noindex/utility only"), and gen-og-image.py --routes does not emit a card
        # for a page that is excluded from the sitemap. Flagging it asked for a card that the
        # generator is designed not to produce.
        hp.append("og:image is the site default")
    types = []
    for blk in JSONLD.findall(html):
        try:
            data = json.loads(blk)
        except Exception:
            hp.append("unparseable JSON-LD")
            continue
        nodes = data if isinstance(data, list) else [data]
        for node in nodes:
            if not isinstance(node, dict):
                continue
            t = node.get("@type")
            types += t if isinstance(t, list) else ([t] if t else [])
            for g in node.get("@graph", []) or []:
                if isinstance(g, dict) and g.get("@type"):
                    gt = g["@type"]
                    types += gt if isinstance(gt, list) else [gt]
    for t in sorted(set(types)):
        if types.count(t) > 1:
            hp.append("@type %s appears %dx" % (t, types.count(t)))
    for want_t in (brief.get("schema_plan") or []):
        name = want_t if isinstance(want_t, str) else want_t.get("type", "")
        if name and name not in types:
            hp.append("schema_plan %s missing" % name)
    summ["head"] = "ok" if not hp else "fail"
    if hp:
        fail("head", "; ".join(hp), out)
    else:
        ok("head", "title=%d desc=%d canonical=/ og:image=ok types=%s"
           % (len(title), len(dtext), ",".join(sorted(set(types)))), out)

    # ---- headings -------------------------------------------------------
    dev = brief.get("outline_deviations") or {}
    # 22 hand-authored briefs carry outline_deviations as a LIST of free-form notes
    # instead of the scaffold's {renamed, dropped_sections, sizing} object. That shape
    # crashed the gate outright ('list' object has no attribute 'get'), so the page was
    # never measured. Tolerate it here; validate_brief.py FAILS it at brief time.
    if not isinstance(dev, dict):
        dev = {}
    # Both lists are hand-authored and have shipped as bare strings as well as
    # objects. A shape assumption here crashed the whole run, so the page was never
    # measured at all; validate_brief.py is where the shape is enforced.
    def _pair(x):
        if isinstance(x, dict):
            return (x.get("from", ""), x.get("to", ""))
        return (str(x), str(x))

    def _head(x):
        return x.get("heading", "") if isinstance(x, dict) else str(x)

    renamed = dict(_pair(r) for r in (dev.get("renamed") or []))
    dropped = {_head(d) for d in (dev.get("dropped_sections") or [])}
    briefed = [s.get("heading", "") for s in dicts(brief.get("content_outline"))
               # W10.5: `level` ships as int 2 (one project), 'h2' (another) and
               # ABSENT (a third). `str(2).upper() == "H2"` is False, so the headings
               # gate was silently skipped on every brief with integer levels.
               if _level_of(s.get("level")) in (None, "H2")]
    norm = lambda s: re.sub(r"[^a-z0-9 ]", "", s.lower()).strip()
    present = {norm(h) for _, h in hs}
    miss = [b for b in briefed if b not in dropped and norm(renamed.get(b, b)) not in present]
    if briefed:
        if miss:
            fail("headings", "%d/%d briefed H2s missing: %s"
                 % (len(miss), len(briefed), miss[:5]), out)
        else:
            ok("headings", "%d/%d (deviations honoured: %d renamed, %d dropped)"
               % (len(briefed), len(briefed), len(renamed), len(dropped)), out)

    line = ("w=%s kw=%s lsiP=%s lsiS=%s lsiA=%s ent=%s faq=%s paa=%s h1=%s fig=%s "
            "img=%s quote=%s src=%s prov=%s avoid=%s emdash=%s glyph=%s dupid=%s "
            "ranks=%s head=%s") % (
        summ.get("w", "-"), summ.get("kw", "-"), summ.get("lsiP", "-"),
        summ.get("lsiS", "-"), summ.get("lsiA", "-"), summ.get("ent", "-"),
        summ.get("faq", "-"), summ.get("paa", "-"), summ.get("h1", "-"),
        summ.get("fig", "-"), summ.get("img", "-"), summ.get("quote", "-"),
        summ.get("src", "-"), summ.get("prov", "-"), summ.get("avoid", "-"),
        summ.get("emdash", "-"), summ.get("glyph", "-"), summ.get("dupid", "-"),
        summ.get("ranks", "-"), summ.get("head", "-"))
    return out, line


def head_sha():
    """Short HEAD sha the gate was measured against -> ledger copy_gate_sha."""
    try:
        r = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=str(ROOT),
                           capture_output=True, text=True)
        return (r.stdout or "").strip() or "nogit"
    except Exception:
        return "nogit"


def write_ledger(slug, line):
    if not LEDGER.exists():
        print("  (no config/pipeline-ledger.csv - skipping --write-ledger)")
        return
    with LEDGER.open(newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))
    if not rows:
        return
    cols = list(rows[0].keys())
    for r in rows:
        if slugify(r.get("slug", "")) == slug and "copy_gate" in cols:
            r["copy_gate"] = line
            if "copy_gate_sha" in cols:
                r["copy_gate_sha"] = head_sha()
    with LEDGER.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(rows)


def artifact_leak():
    tagged = set()
    for d in ("config/sme", "research/items"):
        p = ROOT / d
        if p.exists():
            for f in p.glob("*.md"):
                for line in f.read_text(encoding="utf-8", errors="replace").splitlines():
                    if MARKER.search(line):
                        tagged.update(MONEY.findall(line))
    leaked = []
    for f in all_pages():
        t = text_of(body_html(f.read_text(encoding="utf-8", errors="replace")))
        for fig in tagged:
            if fig in t:
                leaked.append((page_slug(f), fig))
    # gate-classes section-4: THE ARTIFACT MUST BE DEPLOYABLE. A site-wide
    # `noindex, nofollow` shipped inside dist/_headers behind a comment saying
    # its removal was "a deliberate owner step" - a control whose enforcement is
    # a sentence a human must remember is not a control. Nothing checked for it
    # until the fixture seeded it and all 14 instruments passed (2026-09-04).
    STAGING = (
        (re.compile(r"X-Robots-Tag\s*:\s*[^\n]*noindex", re.I),
         "a noindex X-Robots-Tag"),
        (re.compile(r"<meta[^>]+name=[\"']robots[\"'][^>]+noindex", re.I),
         "a noindex robots meta"),
        (re.compile(r"https?://[^\s\"']*\.pages\.dev", re.I),
         "a preview host"),
        (re.compile(r"\b(?:sk_test_|pk_test_|TEST_API_KEY)", re.I),
         "a test credential"),
        (re.compile(r"G-XXXX+|UA-XXXX+|GA_MEASUREMENT_ID", re.I),
         "a placeholder analytics id"),
    )
    # CONFLICT C41, resolved here rather than argued about per build. score-loop
    # says the pre-launch noindex is CORRECT while LAUNCH_STATUS is not LIVE;
    # gate-classes section-4 says a staging control must never ship inside the
    # artifact. Both are right, and the resolution is to make the control
    # MECHANICAL instead of remembered: the noindex is allowed exactly while
    # LAUNCH_STATUS is not LIVE, it is REPORTED every run so it can never be
    # forgotten, and it becomes a FAIL the moment the config says LIVE. A
    # control enforced by a gate reading a config value is a control; a
    # control enforced by a comment asking a human to remember is not.
    cfg = read_config()
    live = (cfg.get("LAUNCH_STATUS") or "").strip().upper().startswith("LIVE")
    # A noindex on a route that SHOULD be noindexed is not a leak. Failing
    # /contact/thank-you/ for the meta tag it is supposed to carry is the
    # twenty-failures-from-one-correct-decision defect (gate-classes section-8).
    NOINDEX_OK = ("thank-you", "thankyou", "could-not-send", "404")
    staging_hits, launch_state = [], []
    for f in list(DIST.rglob("_headers")) + list(DIST.rglob("_redirects")) \
            + list(all_pages()):
        try:
            t = f.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        rel = str(f.relative_to(DIST)).replace("\\", "/")
        for rx, why in STAGING:
            if not rx.search(t):
                continue
            if "noindex" in why:
                if any(k in rel for k in NOINDEX_OK):
                    continue          # correct on this route, at any status
                if not live:
                    launch_state.append((rel, why))
                    continue
            staging_hits.append((rel, why))
    for where, why in launch_state:
        print("NOTE artifact-leak %s: %s - CORRECT while LAUNCH_STATUS is not "
              "LIVE. REMOVAL STEP: delete it and re-run this gate as the first "
              "action of go-live; this gate FAILS on it once LAUNCH_STATUS "
              "reads LIVE." % (where, why))
    for where, why in staging_hits:
        print("FAIL artifact-leak %s: %s survived into dist/ - staging-only "
              "controls live in a staging-only mechanism, never in the artifact "
              "production deploys" % (where, why))
    for s, fig in leaked:
        print("FAIL artifact-leak %s: %s" % (s, fig))
    if staging_hits:
        print("FAIL artifact-leak checked=%d failed=%d"
              % (len(list(all_pages())), len(staging_hits) + len(leaked)))
        return 1
    if leaked:
        return 1
    pages = len(list(all_pages()))
    if not pages:
        print("FAIL artifact-leak: no built pages found - the gate measured nothing")
        return 1
    print("PASS artifact-leak 0 of %d tagged figure(s) found across %d page(s)  "
          "checked=%d failed=0" % (len(tagged), pages, pages))
    return 0


# Flags the pipeline skills cite. --avoid / --spelling / --order / --json were all
# documented for months and implemented by NONE of them: an unrecognised flag simply
# fell through, so `verify_page.py --all --avoid` ran the default gate and printed a
# plausible full report. A flag that is named in a gate must either exist or not be named.
ONLY_GATES = {"--avoid": "avoid", "--spelling": "spelling", "--figures": "figures",
              "--links": "links", "--head": "head"}
FLAGS = set(ONLY_GATES) | {"--all", "--write-ledger", "--json", "--order"}
ORDERS = ("core-first", "money-first")  # "money" is a section-1a dead word;
# "core-first" is the canonical spelling of the same order. Both accepted.
# "money-first" = core/monetization, then L2 hubs, then outer. Live blueprints spell
# the monetization tier "money" as often as "monetization", and hub_or_node carries
# L1/L2/L3 rather than the word "hub" - reading only the canonical spellings sorted
# every money page LAST, which is the exact opposite of the flag's name.
TIER_RANK = {"core": 0, "monetization": 0, "money": 0, "compare": 1,
             "outer": 2, "utility": 3}
HUBBY = {"hub", "l1", "l2"}


def usage(msg):
    sys.stderr.write("verify_page.py: %s\n" % msg)
    sys.stderr.write(__doc__ or "")
    return 2


def _level_of(raw):
    """int 2 | 'h2' | 'H2' | absent -> 'H2' | None. The ONE normaliser, mirrored in
    validate_brief._norm_level (W10.5)."""
    if raw is None or raw == "":
        return None
    text = str(raw).strip().upper()
    if text.isdigit():
        return "H" + text
    if text.startswith("H") and text[1:].isdigit():
        return text
    return None


def main():
    if any(a in ("--help", "-h") for a in sys.argv[1:]):
        print(__doc__)
        return 0
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        return 2
    if args[0] == "--artifact-leak":
        return artifact_leak()

    # ---- argument validation (nothing below runs on an unknown flag) -------
    order = ""
    i = 0
    positional = []
    while i < len(args):
        a = args[i]
        if a == "--order":
            i += 1
            order = args[i] if i < len(args) else ""
            if order not in ORDERS:
                return usage("--order takes one of: %s" % ", ".join(ORDERS))
        elif a == "--draft":
            # `--draft` used to be honoured only as args[0], so `--all --draft <file>`
            # silently ran the full pass over dist/ and reported on pages the caller
            # never asked about.
            if "--all" in args:
                return usage("--draft grades ONE unbuilt file; it cannot be combined "
                             "with --all")
            if i + 1 >= len(args):
                return usage("--draft needs a file path")
            positional = ["--draft", args[i + 1]]
            args = positional
            break
        elif a.startswith("--"):
            if a not in FLAGS:
                return usage("unknown option %r" % a)
        else:
            positional.append(a)
        i += 1

    cfg, bp, assets, corpus = read_config(), read_blueprint(), asset_index(), corpus_text()
    write_l = "--write-ledger" in args
    as_json = "--json" in args
    only = [g for f, g in ONLY_GATES.items() if f in args]

    if args[0] == "--draft":
        html = Path(args[1]).read_text(encoding="utf-8", errors="replace")
        slug = Path(args[1]).stem
        res, line = check_page(slug, cfg, bp, {}, assets, corpus, draft_html=html)
        if only:
            res = [r for r in res if r[1] in only]
        for status, gate, msg in res:
            print("%-4s %-11s %s" % (status, gate, msg))
        print("SUMMARY %s :: %s" % (slug, line))
        return 1 if any(x[0] == "FAIL" for x in res) else 0

    heads = site_head_index()
    if "--all" in args:
        slugs = [page_slug(p) for p in all_pages()]
        # A gate that measures nothing must never report PASS. With no dist/ (wrong
        # cwd, or run before `astro build`) this printed "ALL PASS 0 pages" and exited
        # 0, so Stage-3 exit-gate items (h) and (o) went green on an empty tree - the
        # same defect class as the globstar hole documented in item (e).
        if not slugs:
            print("HALT: no dist/**/index.html - run `npm run build` first, or set "
                  "PROJECT_ROOT (looked in %s)" % (DIST,))
            return 1
    elif positional:
        slugs = [slugify(positional[0])]
    else:
        return usage("name a slug, or pass --all")

    if order in ("core-first", "money-first"):
        # core/monetization first, then L2 hubs, then outer - the order a session
        # should spend its remaining context in.
        def rank(s):
            row = bp.get(s) or bp.get(SLUG_ALIASES.get(s, ""), {})
            tier = (row.get("page_tier") or "outer").strip().lower()
            hub = (row.get("hub_or_node") or "").strip().lower()
            return (TIER_RANK.get(tier, 2), 0 if hub in HUBBY else 1, s)
        slugs.sort(key=rank)

    bad = 0
    payload = []
    for s in slugs:
        res, line = check_page(s, cfg, bp, heads, assets, corpus)
        shown = [r for r in res if r[1] in only] if only else res
        # W11.8: `--figures` / `--links` / `--head` / `--spelling` / `--avoid` filtered the
        # PRINTOUT while the exit code stayed computed over ALL gates, so golden RULE 3/4's
        # documented `verify_page.py --figures <slug>` -> EXIT=0 proof was unreachable on
        # any page with an unrelated failing gate. The flag scopes the whole run.
        failed = any(x[0] == "FAIL" for x in shown)
        if as_json:
            payload.append({"slug": s, "summary": line, "failed": failed,
                            "rows": [{"status": st, "gate": g, "detail": m}
                                     for st, g, m in shown]})
        else:
            print("--- %s" % s)
            for status, gate, msg in shown:
                print("%-4s %-11s %s" % (status, gate, msg))
            print("SUMMARY %s :: %s" % (s, line))
        if write_l:
            write_ledger(s, line)
        if failed:
            bad += 1
    if as_json:
        print(json.dumps({"pages": len(slugs), "failed": bad, "results": payload}, indent=2))
    elif "--all" in args:
    # contracts: every gate prints WHAT IT MEASURED, not only what failed.
    # The fixed shape `checked=<n> failed=<m>` on the verdict line is what makes
    # a pass readable: without it "0 failures" and "measured nothing" print the
    # same words.
        print("%s checked=%d failed=%d"
              % ("ALL PASS" if not bad else "FAIL", len(slugs), bad))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
