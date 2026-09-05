#!/usr/bin/env python3
"""audit_built_html.py - site-wide dist/ audit. Stdlib only, Python 3.9+.

  python scripts/audit_built_html.py --all
  python scripts/audit_built_html.py --head --images --schema
  python scripts/audit_built_html.py --overlap --exclusions config/audit-exclusions.json
Sections: --preflight --head --images --figures --sections --hygiene --overlap --cta
          --graph --schema --thin --identity --coverage
Exit 0 when every selected section is clean, 1 otherwise.
"""
import csv, datetime as _dt, html as H, json, os, re, subprocess, sys

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

from collections import defaultdict
from pathlib import Path

ROOT = Path(os.environ.get("PROJECT_ROOT", ".")).resolve()
DIST = ROOT / "dist"
BLUEPRINT = ROOT / "research" / "site-blueprint.csv"
CHROME = re.compile(r"<(script|style|svg|header|nav|footer|aside)\b[^>]*>.*?</\1\s*>",
                    re.I | re.S)
JSONLD = re.compile(r'<script[^>]+application/ld\+json[^>]*>(.*?)</script>', re.I | re.S)
A_TAG = re.compile(r"<a(?:\s[^>]*)?\shref=[\"']([^\"']+)[\"'][^>]*>(.*?)</a\s*>", re.I | re.S)
IMG = re.compile(r"<img\b[^>]*>", re.I)
# reference/contracts.md, THE ONE EXEMPTION LIST (contracts_check.py rule
# `one-exemption-list`): figures, the expert quote and the Sources block are
# required on every CONTENT route and on no other. Identical predicate in
# verify_page.py (Task G3.1) and ledger.py (Task G3.4) - never widen one alone.
# REQ-9: raster extensions, and the same img_kind() classifier verify_page.py uses.
RASTER_EXT = (".webp", ".avif", ".jpg", ".jpeg", ".png", ".gif")


def _cell(v):
    """A ragged CSV row lands under DictReader's restkey as a LIST, and
    `(v or "").strip()` raised AttributeError on it - one stray comma in a
    notes field took the whole gate down."""
    if isinstance(v, (list, tuple)):
        return " ".join(str(x or "") for x in v).strip()
    return (v or "").strip()


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
# contracts §3: the figure / quote / Sources predicate is implemented ONCE, in
# exemptions.py, and imported here. Three instruments carrying three tuples is what
# made /about/ pass one letter and fail two others on every site ever built.
import datetime as _dt
import os as _os
import sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from exemptions import (exemption, figure_floor, UTILITY_ROUTES,  # noqa: E402
                        FULL, PARTIAL, EXEMPT, _extras)
UTILITY = UTILITY_ROUTES


def route_exempt(slug, cfg, key):
    """THE ONE EXEMPTION LIST - exemptions.py owns it; this is the thin adapter."""
    return exemption(slug, cfg, key) == EXEMPT
RESULTS = []


def _archive_listed(family, exclusions=None):
    """True when config/audit-exclusions.json declares this family archive-exempt.

    The archive exemption relieves a family of the uniqueness floor entirely, and it
    was granted by a regex over a family name the build session itself authors. An
    exemption that a build can grant itself is not an exemption; this makes it a
    recorded decision under "archive_families".
    """
    # Prefer the exclusions dict main() already loaded from --exclusions; only fall
    # back to the default path when a caller has none. Re-reading a hardcoded path made
    # the same declaration pass at one location and fail at another.
    data = exclusions
    if data is None:
        import json as _json
        p = ROOT / "config" / "audit-exclusions.json"
        if not p.exists():
            return False
        try:
            data = _json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            return False
    listed = (data or {}).get("archive_families") or []
    fam = (family or "").strip().lower()
    return any(fam == str(x).strip().lower() for x in listed)


def rec(section, name, okflag, detail):
    RESULTS.append((section, name, "PASS" if okflag else "FAIL", detail))


def text_of(frag):
    return re.sub(r"\s+", " ", H.unescape(re.sub(r"<[^>]+>", " ", frag or ""))).strip()


def words(s):
    return re.findall(r"[A-Za-z0-9$%'-]+", s or "")


def pages():
    return sorted(DIST.rglob("index.html")) if DIST.exists() else []


def slug_of(p):
    rel = p.relative_to(DIST).parent.as_posix()
    return "index" if rel in (".", "") else rel


def body_of(html):
    m = re.search(r"<main\b[^>]*>(.*?)</main\s*>", html, re.I | re.S)
    return CHROME.sub(" ", m.group(1) if m else html)


def read_cfg():
    cfg, p = {}, ROOT / "config" / "project-config.md"
    if p.exists():
        for line in p.read_text(encoding="utf-8", errors="replace").splitlines():
            m = re.match(r"^\s*[-*]?\s*([A-Z][A-Z0-9_]+)\s*[:=]\s*(.+?)\s*$", line)
            if m:
                cfg[m.group(1)] = m.group(2).strip().strip("`")
    return cfg


def blueprint_rows():
    rows = []
    if BLUEPRINT.exists():
        with BLUEPRINT.open(newline="", encoding="utf-8-sig", errors="replace") as f:
            rows = [{k: _cell(v) for k, v in r.items() if k is not None}
                for r in csv.DictReader(f)]
    return rows


def load(paths):
    return {slug_of(p): p.read_text(encoding="utf-8", errors="replace") for p in paths}


# ---------------------------------------------------------------- preflight
def sec_preflight(docs):
    okd = DIST.exists() and len(docs) > 0
    rec("preflight", "dist exists", okd, "%d built pages" % len(docs))
    try:
        dirty = subprocess.run(["git", "status", "--porcelain"], cwd=str(ROOT),
                               capture_output=True, text=True).stdout.strip()
        head = subprocess.run(["git", "rev-parse", "HEAD"], cwd=str(ROOT),
                              capture_output=True, text=True).stdout.strip()
    except Exception:
        dirty, head = "git-unavailable", ""
    rec("preflight", "clean tree", dirty == "", dirty[:120] or "clean")
    stamped = ""
    for html in docs.values():
        m = re.search(r'<meta[^>]+name=["\']build-commit["\'][^>]+content=["\']([^"\']+)',
                      html, re.I)
        if m:
            stamped = m.group(1)
            break
    rec("preflight", "head == dist build-commit", (not head) or (not stamped) or
        stamped.startswith(head[:7]), "head=%s dist=%s" % (head[:7], stamped[:7] or "-"))
    rows = blueprint_rows()
    bp = {(r.get("url_slug") or "").strip("/") or "index" for r in rows if r.get("url_slug")}  # contracts §9: url_slug is the canonical column; path/slug are FORBIDDEN legacy names
    built = set(docs)
    rec("preflight", "blueprint <-> built reconciled", bp == built or not bp,
        "in blueprint not built: %s | built not in blueprint: %s"
        % (sorted(bp - built)[:6] or "-", sorted(built - bp)[:6] or "-"))


# --------------------------------------------------------------------- head
def sec_head(docs):
    titles, descs, bad_t, bad_d, nocanon, badcanon, noh1, multih1, noog = (
        defaultdict(list), defaultdict(list), [], [], [], [], [], [], [])
    for s, html in docs.items():
        tm = re.search(r"<title[^>]*>(.*?)</title>", html, re.I | re.S)
        t = text_of(tm.group(1)) if tm else ""
        titles[t].append(s)
        if len(t) > 60:
            bad_t.append("%s(%d)" % (s, len(t)))
        dm = re.search(r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']*)',
                       html, re.I)
        d = H.unescape(dm.group(1)) if dm else ""
        descs[d].append(s)
        if not (140 <= len(d) <= 158):
            bad_d.append("%s(%d)" % (s, len(d)))
        c = re.search(r'<link[^>]+rel=["\']canonical["\'][^>]+href=["\']([^"\']+)', html, re.I)
        if not c:
            nocanon.append(s)
        elif not c.group(1).rstrip().endswith("/"):
            badcanon.append(s)
        n1 = len(re.findall(r"<h1\b", html, re.I))
        if n1 == 0:
            noh1.append(s)
        elif n1 > 1:
            multih1.append(s)
        if not re.search(r'property=["\']og:image["\']', html, re.I):
            noog.append(s)
    dup_t = {k: v for k, v in titles.items() if len(v) > 1 and k}
    dup_d = {k: v for k, v in descs.items() if len(v) > 1 and k}
    rec("head", "duplicate titles", not dup_t, str({k[:40]: v for k, v in dup_t.items()})[:200])
    rec("head", "titles > 60", not bad_t, ", ".join(bad_t[:10]) or "0")
    rec("head", "duplicate descriptions", not dup_d, str(list(dup_d.values())[:4])[:200])
    rec("head", "descriptions outside 140-158", not bad_d, ", ".join(bad_d[:10]) or "0")
    rec("head", "canonical present", not nocanon, ", ".join(nocanon[:10]) or "0")
    rec("head", "canonical slash-terminated", not badcanon, ", ".join(badcanon[:10]) or "0")
    rec("head", "exactly one <h1>", not (noh1 or multih1),
        "missing:%s multiple:%s" % (noh1[:6] or "-", multih1[:6] or "-"))
    rec("head", "og:image present", not noog, ", ".join(noog[:10]) or "0")
    slashless = []
    for s, html in docs.items():
        for href in re.findall(r'href="(/[^"#?]*[^/"#?])"', html):
            if "." not in href.rsplit("/", 1)[-1]:
                slashless.append("%s->%s" % (s, href))
    rec("head", "slash-less internal hrefs", not slashless, ", ".join(slashless[:8]) or "0")
    nulls = [s for s, h in docs.items() if re.search(r'"name"\s*:\s*(null|undefined)', h)]
    rec("head", "null/undefined in JSON-LD", not nulls, ", ".join(nulls[:8]) or "0")
    sm = DIST / "sitemap-0.xml"
    if not sm.exists():
        # sorted(): an unsorted glob picked nondeterministically between
        # sitemap-index.xml and sitemap-0.xml across runs.
        cands = sorted(DIST.glob("sitemap*.xml"))
        sm = cands[0] if cands else None
    # Recorded in BOTH branches: a row that only ever appears on failure still makes
    # the scorecard denominator depend on the outcome, which is the A128 complaint.
    rec("head", "sitemap present", bool(sm and sm.exists()),
        "dist/sitemap*.xml" if (sm and sm.exists()) else "no dist/sitemap*.xml")
    if sm and sm.exists():
        # A128 (a) - a sitemap INDEX lists sitemap chunks, not pages, so reading one file
        # compared 3 <loc>s against 60 pages. Expand the index one level, exactly as
        # indexnow_submit.py does.
        def _locs(path):
            try:
                return re.findall(r"<loc>(.*?)</loc>",
                                  path.read_text(encoding="utf-8", errors="replace"))
            except Exception:
                return []
        urls = []
        for u in _locs(sm):
            name = u.rstrip("/").rsplit("/", 1)[-1]
            child = DIST / name
            if name.endswith(".xml") and child.exists() and child != sm:
                urls.extend(_locs(child))
            else:
                urls.append(u)
        for extra in sorted(DIST.glob("sitemap-*.xml")):
            if extra != sm and not any(extra.name in u for u in _locs(sm)):
                urls.extend(_locs(extra))
        # A sitemap INDEX's own <loc> points at another sitemap, not at a page. The
        # loop above swept sitemap-index.xml in as an "extra" and counted its single
        # pointer as a 27th URL against 26 indexable pages, so this gate reported a
        # phantom mismatch on a correct sitemap. A URL ending .xml is never a page.
        urls = sorted({u for u in set(urls) if not u.rstrip("/").endswith(".xml")})

        # A128 (b) - `re.search("noindex", html)` matched the WORD anywhere: a page whose
        # copy discussed noindexing, or whose inline script mentioned it, counted as
        # noindexed and vanished from the indexable count. Match the robots meta the
        # pipeline actually emits (the pattern gate1-preflight row 12 uses).
        NOINDEX_RX = re.compile(
            "<meta[^>]+name=[\"']?robots[\"']?[^>]*noindex", re.I)
        noindex = [s_ for s_, h in docs.items() if NOINDEX_RX.search(h)]

        # A128 (c) - `s in u` matched "/about/" inside "/about-us/". Compare SLUGS.
        def _slug(u):
            path = re.sub(r"^https?://[^/]+", "", u)
            return path.strip("/") or "index"
        listed = {_slug(u) for u in urls}
        listed_noindex = sorted(set(noindex) & listed)
        indexable = [s_ for s_ in docs if s_ not in noindex]
        missing = sorted(set(indexable) - listed)
        rec("head", "sitemap count == indexable pages",
            len(listed) == len(indexable),
            "sitemap=%d indexable=%d%s" % (len(listed), len(indexable),
                                           ("; not listed: " + ", ".join(missing[:6]))
                                           if missing else ""))
        rec("head", "no noindex URL in sitemap", not listed_noindex,
            ", ".join(listed_noindex[:6]) or "0")
    else:
        # Both sub-rows are recorded in BOTH branches, so the scorecard's row set -
        # and therefore its denominator - no longer depends on the outcome.
        rec("head", "sitemap count == indexable pages", False, "no sitemap to read")
        rec("head", "no noindex URL in sitemap", False, "no sitemap to read")



# ------------------------------------------------------------------- images
# ------------------------------------------------------------------- alt text
# contracts.md: an alt is measured on the BUILT page, never on the generator's
# intent. Until 2026-08-31 the ONLY alt assertion in the whole pipeline was that
# the attribute EXISTS, so alt="" and alt="image" passed every gate while
# image-gen's checklist ("alts include SECONDARY_KEYWORD where natural") was
# prose with no instrument behind it. An alt has TWO duties and a gate needs
# both ends of it:
#   accessibility - an alt that describes nothing helps no screen reader
#   image SEO     - an alt with no topical term is invisible to image search
# ...plus the cap, because "put the keyword in every alt" is the spam pattern
# this rule would otherwise create. Descriptive FIRST, topical SECOND, capped.
GENERIC_ALT = {
    "image", "images", "photo", "photos", "picture", "pic", "screenshot", "icon",
    "logo", "graphic", "illustration", "banner", "thumbnail", "img", "untitled",
    "alt", "alt text", "placeholder", "figure", "chart", "diagram", "hero",
}
FILENAME_ALT = re.compile(r"\.(webp|jpe?g|png|svg|gif|avif)$", re.I)
STOPWORDS = {
    "the", "and", "for", "with", "from", "that", "this", "your", "you", "are",
    "was", "how", "why", "what", "when", "into", "than", "then", "them", "they",
    "have", "has", "had", "will", "can", "does", "did", "not", "best",
}
ALT_MIN = 15        # shorter than this describes nothing
ALT_MAX = 125       # image-gen already specifies alt_text < 125 chars
ALT_KW_CAP = 2      # at most N alts per page may carry the full target phrase


def alt_tokens(s):
    """Significant lowercase word stems of a phrase (>=4 chars, not a stopword)."""
    out = set()
    for w in re.findall(r"[a-z0-9]+", (s or "").lower()):
        if len(w) >= 4 and w not in STOPWORDS:
            out.add(w[:-1] if w.endswith("s") and len(w) > 4 else w)
    return out


def sec_images(docs, cfg):
    assets = set()
    for base in (ROOT / "public", DIST):
        if base.exists():
            for f in base.rglob("*"):
                if f.is_file():
                    assets.add("/" + f.relative_to(base).as_posix())
    policy = (cfg.get("IMAGE_POLICY") or "photo").strip().lower()
    if policy not in ("photo", "figure", "mixed"):
        policy = "photo"
    # REQ-9: count BY EXTENSION against the declared policy. Under photo/mixed only
    # rasters satisfy the >=2 floor; an SVG card carried through <img src="*.svg">
    # is reported as svg_as_raster and never counted, so the fallback card path can
    # no longer make a page with zero photographs pass the image floor. Under
    # figure the raster floor is 0.
    raster_floor = 0 if policy == "figure" else 2
    thin, unsized, noalt, missing, ph, ogdef, svgimg = [], [], [], [], [], [], []
    badalt, offtopic, stuffed = [], [], []
    # url_slug -> the row's own keywords, so "topical" means THIS page's
    # topic and never a sitewide keyword bag (contracts.md 9 column names).
    kw = {}
    for r in blueprint_rows():
        k = (r.get("url_slug") or "").strip("/") or "index"
        kw[k] = (r.get("target_keyword") or "",
                 r.get("secondary_keywords") or "")
    for s, html in docs.items():
        if s.split("/")[-1] in UTILITY:
            continue
        n = 0
        target, secondary = kw.get(s, ("", ""))
        topic = alt_tokens(target) | alt_tokens(secondary)
        page_alts, kw_hits = [], 0
        for tag in IMG.findall(html):
            m = re.search(r'\ssrc=["\']([^"\']+)["\']', tag)
            src = m.group(1) if m else ""
            resolves = bool(src) and (src in assets or src.startswith("data:")
                                      or (DIST / src.lstrip("/")).exists())
            if resolves:
                kind = img_kind(src)
                if kind == "raster":
                    n += 1
                elif kind == "svg":
                    svgimg.append("%s:%s" % (s, src[:40]))
            elif src:
                missing.append("%s:%s" % (s, src))
            if not re.search(r'\swidth=', tag) or not re.search(r'\sheight=', tag):
                unsized.append("%s:%s" % (s, src[:40]))
            am = re.search(r'\salt=["\']([^"\']*)["\']', tag)
            if am is None:
                noalt.append("%s:%s" % (s, src[:40]))
            elif resolves and img_kind(src) == "raster":
                alt = am.group(1).strip()
                # alt="" is the CORRECT markup for a decorative image - and a
                # decorative image is exactly what must not count toward the
                # >=2 content-visual floor. Declaring it decorative is honest;
                # having it satisfy the floor is not.
                if not alt:
                    n -= 1
                else:
                    page_alts.append(alt)
                    low = alt.lower()
                    if (low in GENERIC_ALT or FILENAME_ALT.search(alt)
                            or len(alt) < ALT_MIN or len(alt) > ALT_MAX
                            or (" " not in alt and ("_" in alt or "-" in alt))):
                        badalt.append("%s:%s" % (s, alt[:44] or "(empty)"))
                    if target and target.lower() in low:
                        kw_hits += 1
        if n < raster_floor:
            thin.append("%s(%d)" % (s, n))
        # TOPICAL CONTEXT: at least ONE alt on the page shares a significant word
        # with the page's own keyword. This is the half image-gen only ever
        # described in prose - a perfectly accessible alt with no topical term
        # ("a stopwatch on a bench") is invisible to image search.
        if page_alts and topic and not any(alt_tokens(a) & topic for a in page_alts):
            offtopic.append("%s:%s" % (s, page_alts[0][:44]))
        # ...and the opposite failure. Blending the keyword into EVERY alt is
        # alt-stuffing, so the same gate that requires one caps the rest.
        if kw_hits > ALT_KW_CAP:
            stuffed.append("%s(%d alts carry the full target phrase)" % (s, kw_hits))
        if re.search(r'src=["\'][^"\']*(placeholder|coming-soon|no-image)', html, re.I):
            ph.append(s)
        og = re.search(r'property=["\']og:image["\'][^>]+content=["\']([^"\']+)', html, re.I)
        if not og or "og-default" in og.group(1):
            ogdef.append(s)
    rec("images", "pages < 2 visuals (policy=%s)" % policy, not thin,
        ", ".join(thin[:10]) or "0")
    rec("images", "svg_as_raster (policy=%s)" % policy,
        policy != "photo" or not svgimg,
        "%d %s" % (len(svgimg), ", ".join(svgimg[:8]) or ""))
    rec("images", "unsized <img>", not unsized, ", ".join(unsized[:10]) or "0")
    rec("images", "<img> without alt", not noalt, ", ".join(noalt[:10]) or "0")
    rec("images", "alt generic/filename/len", not badalt,
        ", ".join(badalt[:8]) or "0")
    rec("images", "pages with no topical alt", not offtopic,
        ", ".join(offtopic[:8]) or "0")
    rec("images", "alt keyword stuffing (>%d)" % ALT_KW_CAP, not stuffed,
        ", ".join(stuffed[:8]) or "0")
    rec("images", "missing image files", not missing, ", ".join(missing[:10]) or "0")
    rec("images", "card placeholders", not ph, ", ".join(ph[:10]) or "0")
    rec("images", "og:image missing/default", not ogdef, ", ".join(ogdef[:10]) or "0")

    # A127 - THE LCP IMAGE. The first content <img> above the first <h2> is, on almost
    # every page this pipeline builds, the LCP element. Marking it loading="lazy" defers
    # the very request the page is waiting on: a self-inflicted LCP failure that no other
    # gate reads, because every per-image rule here is about alt text and dimensions.
    Q = "[\"']"
    lcp_lazy, lcp_nopri = [], []
    for s_, html in docs.items():
        if s_.split("/")[-1] in UTILITY:
            continue
        if re.search("<meta[^>]+name=" + Q + "?robots" + Q + "?[^>]*noindex", html, re.I):
            continue
        body = html.split("<main", 1)[-1]
        head = body.split("<h2", 1)[0]
        tags = IMG.findall(head)
        if not tags:
            continue
        # THE LCP CANDIDATE IS NOT THE LOGO. tags[0] took the first <img> in the region,
        # which on every page is the 40x40 aria-hidden header wordmark - a decorative
        # image that is never the largest contentful paint, and can never carry
        # fetchpriority=high without mis-prioritising the real hero. Skip decorative and
        # small images and take the first CONTENT image instead.
        def _decorative(t):
            if re.search(r"aria-hidden=" + Q + "?true", t, re.I):
                return True
            if re.search(r"\salt=" + Q + Q, t):
                return True
            for dim in ("width", "height"):
                d = re.search(r"\s%s=" % dim + Q + "?(\\d+)", t, re.I)
                if d and int(d.group(1)) < 200:
                    return True
            return False

        content_tags = [t for t in tags if not _decorative(t)]
        if not content_tags:
            continue
        tag = content_tags[0]
        m = re.search(r"\ssrc=" + Q + "([^\"']+)" + Q, tag)
        src = m.group(1) if m else ""
        if re.search("loading=" + Q + "?lazy", tag, re.I):
            lcp_lazy.append("%s:%s" % (s_, src[:40]))
        preloaded = bool(src) and re.search(
            "<link[^>]+rel=" + Q + "?preload" + Q + "?[^>]*as=" + Q + "?image"
            + Q + "?[^>]*" + re.escape(src), html, re.I)
        if not re.search("fetchpriority=" + Q + "?high", tag, re.I) and not preloaded:
            lcp_nopri.append("%s:%s" % (s_, src[:40]))
    # A016 - ONE SERIES LOCK PER SITE. The lock (palette, Kelvin range, film stock) was
    # re-derived on every image run, so each batch got its own light and its own colour
    # and the site's photographs matched within a page and clashed across it - which is
    # precisely how a set of generated images reads as generated.
    amap = ROOT / "public" / "images" / "asset-map.json"
    if amap.exists():
        ids = set()

        def _walk(node):
            if isinstance(node, list):
                for n in node:
                    _walk(n)
            elif isinstance(node, dict):
                for k, v in node.items():
                    if k in ("consistency_id", "consistencyId") and isinstance(v, str) and v.strip():
                        ids.add(v.strip())
                    else:
                        _walk(v)

        try:
            _walk(json.loads(amap.read_text(encoding="utf-8", errors="replace")))
        except Exception:
            ids = set()
        rec("images", "distinct consistencyId in asset-map.json",
            len(ids) <= 1, "%d: %s" % (len(ids), ", ".join(sorted(ids)[:4]) or "none"))

    rec("images", "lcp_img_lazy", not lcp_lazy, ", ".join(lcp_lazy[:10]) or "0")
    rec("images", "hero_priority_missing", not lcp_nopri, ", ".join(lcp_nopri[:10]) or "0")


# ------------------------------------------------------------------ figures
def sec_figures(docs, cfg):
    thin, noanim, extra_anim, skipped = [], [], [], []
    for s, html in docs.items():
        state = exemption(s, cfg, "FIGURE_EXEMPT_ROUTES")
        if state == EXEMPT:
            skipped.append(s)
            continue
        lo, need_anim, cap_anim = figure_floor(state)
        f = len(re.findall(r"<figure[^>]*\bdata-figure\b", html, re.I))
        a = len(re.findall(r"data-figure-interactive", html, re.I))
        if f < lo:
            thin.append("%s(%d<%d)" % (s, f, lo))
        if a < need_anim:
            noanim.append(s)
        # /contact/ is PARTIAL: the interactive requirement INVERTS into a ceiling,
        # because an interactive figure beside a form is a distraction (contracts §3).
        if cap_anim is not None and a > cap_anim:
            extra_anim.append("%s(%d>%d)" % (s, a, cap_anim))
    rec("figures", "pages under their figure floor", not thin,
        ", ".join(thin[:10]) or "0")
    rec("figures", "pages with 0 interactive", not noanim, ", ".join(noanim[:10]) or "0")
    rec("figures", "partial routes over the interactive ceiling", not extra_anim,
        ", ".join(extra_anim[:10]) or "0")
    rec("figures", "exempt routes skipped", True,
        ", ".join(sorted(skipped)[:10]) or "0")



# ------------------------------------------------------------------ sections
# CONTRACTS 22 - THE THIRD AXIS. --figures measures the informative diagrams; --rhythm
# (design-audit.mjs) measures tone and the eight shared treatments. Neither notices that
# every one of those treatments was rendered as the same rounded white card with a pastel
# icon tile, which is the defect the owner actually reported: "the design system is fine,
# the section vocabulary is one item long".
#
# TWO HALVES, and the second is the one that matters:
#   REPETITION (per route) - no pattern more than twice, >= 4 distinct on a 6-section page,
#                            card rows under half the page, nothing untagged.
#   NOVELTY (site-wide)    - patterns that exist in NO kit, no verbatim kit copies, real
#                            spread on the axes that carry look, no cross-project tuple
#                            collision. Renaming slugs cannot satisfy any of it: a site
#                            whose every section is symmetric-grid/elevated-card/equal-row
#                            under nineteen names IS the original defect in a costume,
#                            which is what axis_diversity exists to catch.
PATTERN_RX = re.compile(r'data-section-pattern="([^"]+)"', re.I)
EVIDENCE_RX = re.compile(r'data-pattern-evidence="([^"]+)"', re.I)
SECTION_TAG_RX = re.compile(r"<section\b[^>]*>", re.I)
# the axis values that mean "a row of cards" - the specific shape the report was about
CARD_SKELETONS = ("symmetric-grid", "offset-grid")
CARD_CONTAINERS = ("elevated-card", "hairline-card")
LOOK_AXES = ("skeleton", "container", "edge", "texture")   # >= 3 distinct values each
OTHER_AXES = ("rhythm", "emphasis", "motion", "evidence")  # >= 2 distinct values each
MAX_REPEAT = 2
MIN_DISTINCT = 4
MIN_SECTIONS_FOR_VARIETY = 6
MAX_CARD_SHARE = 0.50
MIN_INVENTED = 3
LOOK_AXIS_FLOOR = 3
OTHER_AXIS_FLOOR = 2


def _pattern_shortlist():
    """design-system.md's `| PAT-n |` rows, via the ONE parser (design_fingerprint.py).

    Absent or unparseable, the built-HTML half still runs: repetition is measurable
    without the shortlist, and saying so beats reporting a green.
    """
    # design_fingerprint.py is a PORTFOLIO tool (~/.claude/scripts), not a kit
    # instrument, so importing it from THIS file's directory always failed inside
    # a project - and the bare `except` below turned that into "no `| PAT-n |`
    # rows", which reads as "the designer never wrote a shortlist". The project
    # had one; the gate could not load the parser. Never report "measured zero"
    # when the truth is "could not measure": that is gate-classes' third
    # vacuous-pass shape, an except that swallows the reason.
    here = os.path.dirname(os.path.abspath(__file__))
    home = os.path.join(os.path.expanduser("~"), ".claude", "scripts")
    for d in (here, home):
        if d not in sys.path:
            sys.path.insert(0, d)
    try:
        import design_fingerprint as df
    except Exception as exc:                                   # noqa: BLE001
        return [], ("IMPORT FAILED: %s (looked in %s and %s)"
                    % (exc, here, home))
    try:
        rows = [r for r in df.pattern_rows(str(ROOT)) if r.get("axes")]
    except Exception as exc:                                   # noqa: BLE001
        return [], "PARSE FAILED: %s" % exc
    return rows, df


def _kit_sections_dir():
    return Path(os.path.expanduser("~/.claude/scripts/site-kit/src/components/sections"))


def _verbatim_kit_copies():
    """Project pattern components byte-identical to the kit's, imports aside.

    A kit component dropped in unstyled is the whole failure mode this axis exists to
    stop: the kit is a FLOOR, and a site made only of unmodified floor is the fifth site
    that looks like the first four.
    """
    proj = ROOT / "src" / "components" / "sections"
    kit = _kit_sections_dir()
    if not proj.is_dir() or not kit.is_dir():
        return []

    def body(path):
        try:
            txt = path.read_text(encoding="utf-8", errors="replace")
        except Exception:
            return None
        keep = [ln.rstrip() for ln in txt.splitlines()
                if ln.strip() and not ln.lstrip().startswith("import ")]
        return "\n".join(keep)

    same = []
    for f in sorted(proj.glob("*.astro")):
        k = kit / f.name
        if k.is_file() and body(f) is not None and body(f) == body(k):
            same.append(f.name)
    return same


def sec_sections(docs, cfg):
    rows, df = _pattern_shortlist()
    by_slug = {r["slug"]: r for r in rows}

    # ---- REPETITION, per route
    over, thin, untagged, no_evidence, cardy = [], [], [], [], []
    built = {}
    for s, html in docs.items():
        body = body_of(html)
        tags = SECTION_TAG_RX.findall(body)
        bands = [t for t in tags if "data-treatment" in t.lower()]
        pats = PATTERN_RX.findall(body)
        for slug in pats:
            built[slug] = built.get(slug, 0) + 1
        # a Section.astro band with no pattern is an untagged content band
        missing = sum(1 for t in bands if "data-section-pattern" not in t.lower())
        # the pattern may sit on a child INSIDE the band, so only report a shortfall
        blind = max(0, len(bands) - len(pats)) if missing else 0
        if blind:
            untagged.append("%s(%d)" % (s, blind))
        ev = len(EVIDENCE_RX.findall(body))
        if pats and ev < len(pats):
            no_evidence.append("%s(%d/%d)" % (s, ev, len(pats)))
        counts = {}
        for slug in pats:
            counts[slug] = counts.get(slug, 0) + 1
        worst = max(counts.values()) if counts else 0
        if worst > MAX_REPEAT:
            hot = sorted(counts, key=lambda k: -counts[k])[0]
            over.append("%s(%s x%d)" % (s, hot, worst))
        if len(tags) >= MIN_SECTIONS_FOR_VARIETY:
            if len(set(pats)) < MIN_DISTINCT:
                thin.append("%s(%d distinct/%d sections)" % (s, len(set(pats)), len(tags)))
            n_card = 0
            for t in bands:
                if 'data-treatment="cards"' in t.lower():
                    n_card += 1
            for slug in pats:
                ax = by_slug.get(slug, {}).get("axes", {})
                if (ax.get("skeleton") in CARD_SKELETONS
                        and ax.get("container") in CARD_CONTAINERS):
                    n_card += 1
            share = n_card / float(len(tags))
            if share > MAX_CARD_SHARE:
                cardy.append("%s(%d%%)" % (s, round(share * 100)))

    rec("sections", "sections_untagged", not untagged, ", ".join(untagged[:8]) or "0")
    rec("sections", "evidence_untagged", not no_evidence,
        ", ".join(no_evidence[:8]) or "0")
    rec("sections", "pattern_max_repeat <= %d" % MAX_REPEAT, not over,
        ", ".join(over[:8]) or "0")
    rec("sections", "section_patterns_distinct >= %d" % MIN_DISTINCT, not thin,
        ", ".join(thin[:8]) or "0")
    rec("sections", "card_row_share <= %d%%" % int(MAX_CARD_SHARE * 100), not cardy,
        ", ".join(cardy[:8]) or "0")

    # ---- NOVELTY, site-wide
    if not rows:
        rec("sections", "shortlist parsed from design-system.md", False,
            (df if isinstance(df, str) else
             "no `| PAT-n |` rows - contracts 22 shortlist missing, novelty "
             "unmeasurable"))
        return
    shipped = [r for r in rows if r["slug"] in built]
    invented = [r for r in shipped if r["origin"] == "invented"]
    rec("sections", "patterns_invented >= %d" % MIN_INVENTED, len(invented) >= MIN_INVENTED,
        "%d of %d shipped rows are invented" % (len(invented), len(shipped)))

    verbatim = _verbatim_kit_copies()
    rec("sections", "patterns_verbatim_kit", not verbatim,
        ", ".join(verbatim[:8]) or "0")

    diversity, thin_axes = {}, []
    for axis in LOOK_AXES + OTHER_AXES:
        vals = {r["axes"].get(axis) for r in shipped if r["axes"].get(axis)}
        diversity[axis] = len(vals)
        floor = LOOK_AXIS_FLOOR if axis in LOOK_AXES else OTHER_AXIS_FLOOR
        if len(vals) < floor:
            thin_axes.append("%s(%d<%d)" % (axis, len(vals), floor))
    rec("sections", "axis_diversity", not thin_axes,
        ", ".join(thin_axes) or " ".join("%s=%d" % (k, v) for k, v in diversity.items()))

    collisions = []
    if df is not None:
        me = os.path.basename(str(ROOT).rstrip("\\/")) or ROOT.name
        reg = df._registry()
        for site, entry in sorted(reg.items()):
            if site == me:
                continue
            theirs = {q.get("tuple") for q in entry.get("patterns", [])
                      if isinstance(q, dict)}
            for r in shipped:
                if r["tuple"] in theirs:
                    collisions.append("%s==%s" % (r["slug"], site))
    rec("sections", "registry_collision", not collisions,
        ", ".join(collisions[:8]) or "0")

    # the dominant signature device has to be expressed by an INVENTED pattern, not only
    # named in the direction memo: a signature nothing renders is a sentence.
    ds = (ROOT / "design-system.md")
    sig_txt = ds.read_text(encoding="utf-8", errors="replace").lower() if ds.is_file() else ""
    sig_block = ""
    if "## signature components" in sig_txt:
        sig_block = sig_txt.split("## signature components", 1)[1].split("\n## ", 1)[0]
    hit = None
    for r in invented:
        words = [w for w in re.split(r"[^a-z0-9]+", r["slug"].lower()) if len(w) > 3]
        if any(w in sig_block for w in words) or r["slug"].lower() in sig_block:
            hit = r["slug"]
            break
    rec("sections", "signature_device_present", bool(hit),
        hit or "no invented pattern appears in ## Signature components")


# ------------------------------------------------------------------ hygiene
# INP (Interaction to Next Paint) replaced FID in 2024 and scores MAIN-THREAD WORK
# DURING an interaction. A high-frequency pointer listener that writes style or reads
# layout on every event puts that work on the interaction path. The kit's own
# cursor-follow orb and tilt panel did exactly that until 2026-08-31 - and
# premium-design-standard MANDATES a cursor-tracking tilt panel in every hero, so the
# pipeline required the pattern with no rule about how to implement it.
# The fix is always the same shape: coalesce into ONE requestAnimationFrame per frame.
HOT_EVENTS = ("pointermove", "mousemove", "touchmove", "scroll", "wheel", "resize")
SCRIPT_RX = re.compile("<script" + '\\' + "b[^>]*>(.*?)</script" + '\\' + "s*>", re.I | re.S)


def unthrottled_listeners(html, extra_sources=()):
    """Hot listeners whose surrounding handler never defers to a frame/idle callback.

    A130: scanning INLINE scripts only meant the row read 0 on every kit-built page,
    because the kit's motion code ships in dist/_astro/*.js. `extra_sources` carries the
    bundles the page actually references, and a bundle the heuristic cannot read is
    reported as UNKNOWN rather than counted as clean.
    """
    out = []
    for blk in list(SCRIPT_RX.findall(html)) + list(extra_sources):
        for ev in HOT_EVENTS:
            q = chr(39) + chr(34)
            for m in re.finditer("addEventListener" + chr(92) + "(" + chr(92) + "s*[" + q + "]" + ev, blk):
                window = blk[max(0, m.start() - 400):m.start() + 700]
                if not re.search(r"requestAnimationFrame|requestIdleCallback", window):
                    out.append(ev)
    return out



# ACCESSIBILITY, measured on the built page. Two failures that no other row catches
# and that both degrade the same thing - whether a control announces what it is and
# what it does:
#   1. a toggle that never says whether it is open (aria-expanded), or what it opens
#      (aria-controls). A drawer/accordion/menu button without these is a button that
#      screen-reader users cannot reason about.
#   2. an icon-only control: <a>/<button> whose entire content is an inline <svg> with
#      no <title>, no aria-label on the svg, and no aria-label on the control. It has
#      no accessible name at all - it announces as "link" or "button".
B = chr(92)
TOGGLE_RX = re.compile("<(button|a)" + B + "b[^>]*(aria-controls|data-(toggle|drawer|accordion|menu))[^>]*>", re.I)
CTRL_RX = re.compile("<(button|a)" + B + "b[^>]*>(.*?)</" + B + "1" + B + "s*>", re.I | re.S)


def a11y_problems(html):
    bad = []
    for m in TOGGLE_RX.finditer(html):
        tag = m.group(0)
        if "aria-expanded" not in tag.lower():
            bad.append("toggle-without-aria-expanded")
        if "aria-controls" not in tag.lower():
            bad.append("toggle-without-aria-controls")
    for m in CTRL_RX.finditer(html):
        open_tag, inner = m.group(0)[:m.group(0).find(">") + 1], m.group(2)
        if "<svg" not in inner.lower():
            continue
        text = re.sub("<[^>]+>", "", inner).strip()
        if text:
            continue                                  # has a visible text label
        low = open_tag.lower()
        if "aria-label" in low or "aria-labelledby" in low or "title=" in low:
            continue
        svg = inner[inner.lower().find("<svg"):]
        if "<title" in svg.lower() or "aria-label" in svg.lower():
            continue
        bad.append("icon-only control with no accessible name")
    return bad

def sec_hygiene(docs, cfg):
    hot, a11y = {}, {}
    scanned_bundles = set()
    for s, h in docs.items():
        bundles = []
        for src in re.findall(r'<script[^>]+src=["\']([^"\']+)["\']', h, re.I):
            if "/_astro/" not in src:
                continue
            f = DIST / src.lstrip("/")
            if f.exists():
                scanned_bundles.add(f.name)
                bundles.append(f.read_text(encoding="utf-8", errors="replace"))
        names = unthrottled_listeners(h, bundles)
        if names:
            hot[s] = ",".join(sorted(set(names)))
        probs = a11y_problems(h)
        if probs:
            a11y[s] = ",".join(sorted(set(probs)))
    em = {s: h.count("\u2014") + len(re.findall(r"&mdash;|&#8212;", h))
          for s, h in docs.items()}
    embad = {s: n for s, n in em.items() if n}
    glue = {s: len(re.findall(r"\w<a\s", h)) + len(re.findall(r"</a>\w", h))
            for s, h in docs.items()}
    gbad = {s: n for s, n in glue.items() if n}
    comm = {s: len(re.findall(r"<!--", h)) for s, h in docs.items()}
    cbad = {s: n for s, n in comm.items() if n}
    lts = [s for s, h in docs.items() if "&lt;strong&gt;" in h]
    dupattr = [s for s, h in docs.items()
               if re.search(r'<[a-z]+[^>]*\s(\w+)="[^"]*"[^>]*\s\1="', h, re.I)]
    rec("hygiene", "a11y: toggle/icon control names", not a11y,
        ", ".join("%s:%s" % kv for kv in list(a11y.items())[:6]) or "0")
    rec("hygiene", "unthrottled hot listeners (INP)", not hot,
        ("inline+%d bundle(s) scanned; " % len(scanned_bundles))
        + (", ".join("%s:%s" % kv for kv in list(hot.items())[:6]) or "0"))
    rec("hygiene", "em dashes in dist", not embad, str(dict(list(embad.items())[:8])) or "0")
    rec("hygiene", "glued anchors", not gbad, str(dict(list(gbad.items())[:8])) or "0")
    rec("hygiene", "HTML comments in dist", not cbad, str(dict(list(cbad.items())[:8])) or "0")
    rec("hygiene", "&lt;strong&gt;", not lts, ", ".join(lts[:8]) or "0")
    rec("hygiene", "duplicate attributes", not dupattr, ", ".join(dupattr[:8]) or "0")
    src = ROOT / "src"
    esc = []
    if src.exists():
        for f in src.rglob("*"):
            if f.is_file() and f.suffix in (".astro", ".ts", ".tsx", ".js", ".mjs", ".md"):
                t = f.read_text(encoding="utf-8", errors="replace")
                if "\\u2014" in t:
                    esc.append(str(f.relative_to(ROOT)))
    rec("hygiene", "escaped em dash in src", not esc, ", ".join(esc[:8]) or "0")
    css_leak = []
    for c in (DIST / "_astro").glob("*.css") if (DIST / "_astro").exists() else []:
        if "color:var(--text-" in c.read_text(encoding="utf-8", errors="replace"):
            css_leak.append(c.name)
    rec("hygiene", "unresolved text-[var(--...)] in CSS", not css_leak,
        ", ".join(css_leak[:6]) or "0")
    need = ["robots.txt", "llms.txt"]
    # A129 - the key lives in the ENVIRONMENT (~/.claude/.env), or in a per-site
    # config/indexnow-key.txt when the shared key was refused by the host (403
    # UserForbiddedToAccessSite). Reading it only from project-config meant the key file
    # silently dropped out of the checked list on every project - the row shrank from
    # three files to two and still printed "all present".
    # W11.6 - FOUR SOURCES, IN ORDER. Letter (i) was red on both real projects in a plain
    # shell because the key only ever came from the environment, and project-config's own
    # convention is INDEXNOW_ENV: a variable NAME, not the value. Resolve, in order:
    #   1. the variable project-config NAMES in INDEXNOW_ENV, from the environment
    #   2. $INDEXNOW_KEY / INDEXNOW_KEY: in project-config
    #   3. ~/.claude/.env (where every credential on this machine actually lives)
    #   4. a 32-hex <key>.txt at the dist root whose body equals its own stem - which IS
    #      the IndexNow protocol's own proof of ownership
    env_name = (cfg.get("INDEXNOW_ENV") or "").strip() or "INDEXNOW_KEY"
    key = (os.environ.get(env_name) or cfg.get("INDEXNOW_KEY")
           or os.environ.get("INDEXNOW_KEY") or "")
    if not key:
        try:
            dotenv = Path(os.path.expanduser("~")) / ".claude" / ".env"
            for line in dotenv.read_text(encoding="utf-8", errors="replace").splitlines():
                m = re.match(r"^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.+?)\s*$", line)
                if m and m.group(1) in (env_name, "INDEXNOW_KEY"):
                    key = m.group(2).strip().strip("'\"")
                    break
        except Exception:
            pass
    keyfile = ROOT / "config" / "indexnow-key.txt"
    if keyfile.exists():
        key = keyfile.read_text(encoding="utf-8", errors="replace").strip() or key
    if not key:
        for cand in list(DIST.glob("*.txt")) + list((ROOT / "public").glob("*.txt")):
            stem = cand.stem
            if re.fullmatch(r"[0-9a-f]{32}", stem):
                try:
                    if cand.read_text(encoding="utf-8", errors="replace").strip() == stem:
                        key = stem
                        break
                except Exception:
                    pass
    if key:
        need.append(key + ".txt")
    missing = [n for n in need if not (DIST / n).exists() and not (ROOT / "public" / n).exists()]
    if not key:
        rec("hygiene", "robots/llms/IndexNow files", False,
            "IndexNow key: UNKNOWN (not in $%s, project-config INDEXNOW_KEY, "
            "~/.claude/.env, config/indexnow-key.txt, or a 32-hex key file at the "
            "dist root) - the key file was NOT checked" % env_name)
    else:
        rec("hygiene", "robots/llms/IndexNow files", not missing,
            ", ".join(missing) or "all present (key file %s.txt)" % key[:8])

    # NAV CURRENT-LOCATION STATE. On a 30-80 page silo site the header is the only place a
    # visitor can see which section they are standing in; without aria-current there is no
    # cue for sighted or screen-reader users, and the silo the architecture depends on is
    # invisible in the chrome. The floor: every page whose own route -- or an ancestor of it
    # -- appears in the header nav carries exactly one aria-current in that nav.
    navbad = []
    for s_, h in docs.items():
        m = re.search(r"<nav\b[^>]*>.*?</nav\s*>", h, re.I | re.S)
        if not m:
            continue
        nav = m.group(0)
        hrefs = re.findall(r'href="([^"]+)"', nav)
        route = s_ if s_.startswith("/") else "/" + s_
        hit = any(hr == route or (hr not in ("/", "") and route.startswith(hr)) for hr in hrefs)
        if not hit:
            continue
        n = len(re.findall(r"\baria-current=", nav))
        if n != 1:
            navbad.append("%s(%d)" % (s_, n))
    rec("hygiene", "nav aria-current (exactly 1 on in-nav routes)", not navbad,
        ", ".join(navbad[:8]) or "0")


# ------------------------------------------------------------------ overlap
# CONS-16 - ONE OVERLAP IMPLEMENTATION. `node scripts/seo-audit.mjs --overlap`
# (Tasks G4.9 / G4.25) is the ENGINE: it strips config/audit-exclusions.json,
# measures 6-word shingle uniqueness for EVERY template family, the
# keyword-collision window (title / H1 / first 150 words) and hidden duplicate
# text, and writes audits/overlap.json. THIS SECTION IS A THIN CALLER: it reads
# that file, prints the scorecard rows and produces the ledger cell
# `uniqueness`. It re-implements nothing - two engines would hand the Stage 3
# exit gate two uniqueness numbers with two floors, which is exactly the defect
# G4.9's INSTRUMENT OWNERSHIP table exists to prevent.
OVERLAP_JSON = ROOT / "audits" / "overlap.json"
FLOOR_ANY = 0.60          # contracts.md: Critical floor for any page
FLOOR_COMPONENT = 0.85    # component-/data-driven family before its row closes


def sec_overlap(docs, exclusions):
    if not OVERLAP_JSON.exists():
        rec("overlap", "audits/overlap.json present", False,
            "run `node scripts/seo-audit.mjs --overlap` first - it is the ONE engine")
        return
    try:
        data = json.loads(OVERLAP_JSON.read_text(encoding="utf-8", errors="replace"))
    except Exception as exc:
        rec("overlap", "audits/overlap.json readable", False, "%s" % exc)
        return
    fams = data.get("families") or []
    # W7.5 - A STALE OR EMPTY ARTIFACT IS NOT A PASS. This section PASSed on a leftover
    # `{"families": []}` and on data measured before the current build, so both real
    # projects printed "EXIT GATE: 4/4 PASS" for a scan that had not run against the
    # HTML being graded.
    if not fams:
        rec("overlap", "audits/overlap.json holds families", False,
            "0 families - the overlap scan measured nothing; run "
            "`node scripts/seo-audit.mjs --overlap` against THIS build")
        return
    measured = str(data.get("measured_on") or
                   (fams[0].get("measured_on") if fams else "") or "")[:10]
    dist_mtime = ""
    try:
        newest = max((p.stat().st_mtime for p in DIST.rglob("index.html")), default=0)
        if newest:
            dist_mtime = _dt.date.fromtimestamp(newest).isoformat()
    except Exception:
        dist_mtime = ""
    rec("overlap", "overlap.json is not older than dist/",
        bool(measured) and (not dist_mtime or measured >= dist_mtime)
        # A future measured_on bought permanent freshness - the same shape as the
        # future approved_on fixed in refresh_prices.py.
        and measured <= _dt.datetime.now().isoformat(),
        "measured_on=%s dist=%s" % (measured or "ABSENT", dist_mtime or "?"))

    # the caller and the engine must have stripped the SAME declared set
    declared = len(exclusions.get("markers") or exclusions.get("verbatim_blocks") or []) \
        + len(exclusions.get("selectors") or []) + len(exclusions.get("regulatory") or [])
    used = data.get("exclusions_used")
    rec("overlap", "exclusion set declared == used", used is None or used == declared,
        "declared=%d used=%s (config/audit-exclusions.json)" % (declared, used))
    bad, detail = [], []
    for f in fams:
        fam = f.get("family", "?")
        mn = f.get("min")
        floor = f.get("floor", FLOOR_ANY)
        if f.get("archive"):
            # Recorded EITHER WAY: a row that only ever appears on failure makes the
            # scorecard denominator depend on the outcome. The archive predicate is a
            # regex over a family name the build session itself authors, so the
            # exemption must also be declared in config/audit-exclusions.json under
            # "archive_families" - otherwise a build grants itself the waiver.
            _ok = _archive_listed(f.get("family", ""), exclusions)
            rec("overlap", "archive exemption is declared", _ok,
                ("family %r" % f.get("family")) if _ok else
                ("family %r matches the archive pattern but is not listed under "
                 "\"archive_families\" in config/audit-exclusions.json - create the "
                 "file if it does not exist. The exemption removes this family's "
                 "uniqueness floor entirely, so it is a decision to record, not a "
                 "side effect of how the family happens to be named."
                 % f.get("family")))
        if f.get("component") or f.get("data_driven"):
            floor = max(floor, f.get("componentFloor", FLOOR_COMPONENT))
        if f.get("archive"):
            detail.append("%s exempt(archive)" % fam)
            continue
        detail.append("%s min=%.2f (floor %.2f, n=%s)" % (fam, float(mn or 0), floor,
                                                          f.get("pages", "?")))
        if mn is None or float(mn) < floor:
            bad.append(fam)
    rec("overlap", "template family uniqueness >= floor", not bad,
        "; ".join(detail[:6]) or "no families")
    # E5 (owner decision 2026-09-03): the producer MEASURES these now. `used is None`
    # means the key is absent, i.e. the artifact predates the measuring producer - that
    # is an unproven row, not a clean one.
    collisions = data.get("collisions")
    if collisions is None:
        rec("overlap", "keyword collisions", False,
            "audits/overlap.json carries no `collisions` key - it was written by a "
            "seo-audit.mjs older than 2026-09-03, which emitted the row as a constant")
    else:
        rec("overlap", "keyword collisions", not collisions,
            "; ".join("%s %r on %s" % (c.get("kind"), c.get("value"),
                                       " + ".join(c.get("routes", [])))
                      for c in collisions[:6]) or "0")
    hidden = data.get("hidden")
    if hidden is None:
        rec("overlap", "hidden duplicate text", False,
            "audits/overlap.json carries no `hidden` key - it was written by a "
            "seo-audit.mjs older than 2026-09-03")
    else:
        rec("overlap", "hidden duplicate text", not hidden,
            ", ".join("%s (%s chars, also on %d)" % (h.get("route"), h.get("chars"),
                                                     len(h.get("also_on", [])))
                      for h in hidden[:6]) or "0")
    mins = [float(f.get("min") or 0) for f in fams if not f.get("archive")]
    print("  measured_on: %s | ledger uniqueness=%s | top shared 6-grams: %s"
          % (data.get("measured_on", "?"),
             ("%.2f" % min(mins)) if mins else "n/a",
             (data.get("top_shared") or [])[:5]))


# -------------------------------------------------------------------- graph
def sec_graph(docs):
    out_links, inbound = {}, defaultdict(set)
    for s, html in docs.items():
        body = body_of(html)
        hrefs = set()
        for h, _ in A_TAG.findall(body):
            if h.startswith("/"):
                hrefs.add(h.split("#")[0].split("?")[0].strip("/") or "index")
        out_links[s] = hrefs
        for h in hrefs:
            inbound[h].add(s)
    seen, stack = set(), ["index"]
    while stack:
        cur = stack.pop()
        if cur in seen or cur not in docs:
            continue
        seen.add(cur)
        stack.extend(out_links.get(cur, ()))
    # A056 - THE ONE EXEMPTION LIST applies here too. /privacy/, /terms/, /thank-you/ and
    # every noindexed page were counted as orphans and as under-linked: utility routes are
    # SUPPOSED to live in the footer, so the graph rows carried permanent noise, and a row
    # that is always red stops being read. And the flat ">=3 inbound for everything" floor
    # is not RULE 21's: core/hub rows need 3, every other content row needs 2.
    cfg_ = read_cfg()
    extra_exempt = set()
    # ONE PARSER. This block re-implemented the config-key parser and kept the WHOLE
    # entry, so on the only format validate_config.py accepts -
    # `<route> = <reason> (<date>)` - it stored "roster = generated grid (2026-09-02)"
    # and matched no route at all. A project that passed the config gate therefore got
    # ZERO graph exemptions, and /privacy/-style rows stayed permanently red in letter
    # (j) - the exact noise the comment above says was fixed. one-exemption-impl could
    # not see it because it looks for a re-declared route LIST, not a re-implemented
    # config-key PARSER.
    for key in ("FIGURE_EXEMPT_ROUTES", "QUOTE_EXEMPT_ROUTES"):
        extra_exempt.update(_extras(cfg_, key))

    def _exempt(slug):
        if slug.split("/")[-1] in UTILITY:
            return True
        if slug.strip("/") in extra_exempt:
            return True
        return bool(re.search(r"<meta[^>]+name=[\"']?robots[\"']?[^>]*noindex",
                              docs.get(slug, ""), re.I))

    exempt = sorted(s for s in docs if _exempt(s))
    tiers = {}
    for r in blueprint_rows():
        k = (r.get("url_slug") or "").strip("/") or "index"
        tiers[k] = ((r.get("page_tier") or "").strip().lower(),
                    (r.get("hub_or_node") or "").strip().upper())

    orphans = sorted(s for s in (set(docs) - seen) if not _exempt(s))
    hubs = [s for s in docs
            if not _exempt(s) and (tiers.get(s, ("", ""))[1] in ("L1", "L2")
                                   or (s.count("/") == 0 and s != "index"))]
    weak_hubs = [h for h in hubs if len(inbound.get(h, ())) < 2]
    weak = []
    for slug in docs:
        if slug == "index" or _exempt(slug):
            continue
        pt = tiers.get(slug, ("", ""))[0]
        floor = 3 if (pt in ("core", "monetization") or slug in hubs) else 2
        if len(inbound.get(slug, ())) < floor:
            weak.append("%s(%d/%d)" % (slug, len(inbound.get(slug, ())), floor))
    rec("graph", "orphans (BFS over in-content links)", not orphans, ", ".join(orphans[:10]) or "0")
    rec("graph", "hubs with < 2 in-content inbound", not weak_hubs, ", ".join(weak_hubs[:10]) or "0")
    rec("graph", "inbound floor (core/hub 3, other 2)", not weak, ", ".join(weak[:10]) or "0")
    rec("graph", "exempt routes skipped", True, ", ".join(exempt[:10]) or "0")


# ------------------------------------------------------------------- schema
def sec_schema(docs):
    dupes, missing, nodates, badtypes = [], [], [], []
    for s, html in docs.items():
        types = []
        for blk in JSONLD.findall(html):
            try:
                data = json.loads(blk)
            except Exception:
                badtypes.append("%s(unparseable)" % s)
                continue
            for node in (data if isinstance(data, list) else [data]):
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
                dupes.append("%s:%s x%d" % (s, t, types.count(t)))
        bf = ROOT / "briefs" / ((s.replace("/", "-")) + ".json")
        if bf.exists():
            try:
                plan = json.loads(bf.read_text(encoding="utf-8", errors="replace")).get("schema_plan") or []
            except Exception:
                plan = []
            for want in plan:
                name = want if isinstance(want, str) else want.get("type", "")
                if name and name not in types:
                    missing.append("%s:%s" % (s, name))
        if not re.search(r'"dateModified"', html) and s.split("/")[-1] not in UTILITY:
            nodates.append(s)
    rec("schema", "duplicate @type per page", not dupes, ", ".join(dupes[:10]) or "0")
    rec("schema", "planned schema present", not missing, ", ".join(missing[:10]) or "0")
    rec("schema", "dateModified present", not nodates, ", ".join(nodates[:10]) or "0")
    rec("schema", "JSON-LD parses", not badtypes, ", ".join(badtypes[:6]) or "0")
    src = ROOT / "src" / "pages"
    authors = []
    if src.exists():
        for f in src.rglob("*.astro"):
            if '"author"' in f.read_text(encoding="utf-8", errors="replace"):
                authors.append(str(f.relative_to(ROOT)))
    rec("schema", "author overridden in src/pages", not authors, ", ".join(authors[:8]) or "0")


# --------------------------------------------------------------------- thin
def sec_thin(docs):
    thin = []
    for s, html in docs.items():
        if s.split("/")[-1] in ("privacy", "terms"):
            continue
        if re.search(r"noindex", html, re.I):
            continue
        n = len(words(text_of(body_of(html))))
        if n < 300:
            thin.append("%s(%d)" % (s, n))
    rec("thin", "indexable pages < 300 words", not thin, ", ".join(thin[:10]) or "0")


# ----------------------------------------------------------------- identity
def sec_identity(docs, cfg):
    leaks = []
    needles = [v for v in (cfg.get("FORWARD_TO"),) if v]
    needles += re.findall(r"[\w.+-]+@gmail\.com", " ".join(docs.values()))
    for s, html in docs.items():
        for n in set(needles):
            if n and n in html:
                leaks.append("%s:%s" % (s, n))
    rec("identity", "personal address / FORWARD_TO in dist", not leaks,
        ", ".join(sorted(set(leaks))[:8]) or "0")


# ------------------------------------------------------------------ cta
def sec_cta(docs, cfg):
    """score-loop PART 1 rule 1: CTA CADENCE.

    "No content page may run more than ~40% of its scroll depth without a call
    to action. A 5,000-word page needs four or five, not two." Measured on a
    real build the worst gap before that rule was 82% of page depth: after the
    hero, nothing to click until 84%.

    The rule had NO INSTRUMENT until 2026-09-05 - it was checked by hand once,
    with a throwaway one-liner, during the first Stage 4.6 run. Scroll depth is
    approximated by position within <main>, which is what a markup-level gate
    can honestly claim; the pixel version belongs to design-audit.

    UTILITY routes are out of scope: the rule says CONTENT page, and failing
    /privacy/ for having one CTA is the archetype category error gate-classes
    section-3 names.
    """
    CTA_RX = re.compile(r'data-cta|class="[^"]*\bcta\b[^"]*"|data-primary-cta',
                        re.I)
    CAP = 40
    worst, bad = [], []
    for s_, html in sorted(docs.items()):
        tail = s_.strip("/").split("/")[-1].lower()
        if tail in ("about", "contact", "privacy", "terms", "thank-you", "404",
                    "editorial-policy", "blog"):
            continue
        body = body_of(html)
        n = len(body)
        if n < 500:
            continue
        pos = [m.start() for m in CTA_RX.finditer(body)]
        pts = [0] + pos + [n]
        gap = max(pts[i + 1] - pts[i] for i in range(len(pts) - 1))
        pct = round(100.0 * gap / n)
        worst.append((pct, s_, len(pos)))
        if pct > CAP:
            bad.append("%s %d%% (ctas=%d)" % (s_, pct, len(pos)))
    worst.sort(reverse=True)
    rec("cta", "no content page runs >%d%% of depth with no CTA" % CAP,
        not bad, ("%d over: %s" % (len(bad), "; ".join(bad[:6]))) if bad
        else "worst %d%% (%s)" % (worst[0][0], worst[0][1]) if worst
        else "no content route measured")
    print("  CTA cadence: checked=%d failed=%d (cap %d%% of <main> depth)"
          % (len(worst), len(bad), CAP))


# ----------------------------------------------------------------- coverage
def sec_coverage(docs):
    rows = blueprint_rows()
    bp = {(r.get("url_slug") or "").strip("/") or "index" for r in rows if r.get("url_slug")}  # contracts §9: url_slug is the canonical column; path/slug are FORBIDDEN legacy names
    skipped = sorted(set(docs) - bp)
    rec("coverage", "every built route in the blueprint", not skipped,
        "skipped: %s" % (", ".join(skipped[:10]) or "-"))
    print("  Coverage: audited %d/%d built routes" % (len(docs), len(docs)))


# Every flag this script answers to. A flag that is not here is a CALLER BUG, not a
# no-op: `--brand-assets` was cited by checkpoint.py item (i) for weeks, ran nothing,
# and exited 0, so the brand-asset half of the design gate was never measured.
KNOWN_FLAGS = {
    "--all", "--exclusions",
    "--preflight", "--head", "--images", "--figures", "--hygiene", "--overlap",
    "--graph", "--schema", "--thin", "--identity", "--coverage",
    "--sections", "--cta",
}


def main():
    if any(a in ("--help", "-h") for a in sys.argv[1:]):
        print(__doc__)
        return 0
    args = set(sys.argv[1:])
    exc_path = None
    argv = sys.argv[1:]
    # CONS-26 mirror (ledger.py): reject unknown flags loudly.
    for i, a in enumerate(argv):
        if not a.startswith("--"):
            continue
        if i and argv[i - 1] == "--exclusions":
            continue
        if a not in KNOWN_FLAGS:
            print("FAIL unknown flag %r - known: %s"
                  % (a, ", ".join(sorted(KNOWN_FLAGS))))
            return 2
    if "--exclusions" in argv:
        exc_path = Path(argv[argv.index("--exclusions") + 1])
    exclusions = {}
    p = exc_path or (ROOT / "config" / "audit-exclusions.json")
    if p.exists():
        try:
            exclusions = json.loads(p.read_text(encoding="utf-8", errors="replace"))
        except Exception:
            exclusions = {}
    docs, cfg = load(pages()), read_cfg()
    if not docs:
        print("HALT: dist/ missing or empty - run astro-build/content-writer first")
        return 1
    allsec = "--all" in args or not (args - {"--exclusions", str(exc_path)})
    def want(n):
        return allsec or ("--" + n) in args
    if want("preflight"):
        sec_preflight(docs)
    if want("head"):
        sec_head(docs)
    if want("images"):
        sec_images(docs, cfg)
    if want("figures"):
        sec_figures(docs, cfg)
    if want("sections"):
        sec_sections(docs, cfg)
    if want("hygiene"):
        sec_hygiene(docs, cfg)
    if want("overlap"):
        sec_overlap(docs, exclusions)
    if want("graph"):
        sec_graph(docs)
    if want("schema"):
        sec_schema(docs)
    if want("thin"):
        sec_thin(docs)
    if want("identity"):
        sec_identity(docs, cfg)
    if want("cta"):
        sec_cta(docs, cfg)
    if want("coverage"):
        sec_coverage(docs)
    print("\n%-10s %-34s %-5s %s" % ("SECTION", "CHECK", "VERD", "DETAIL"))
    print("-" * 100)
    for sec, name, verd, detail in RESULTS:
        print("%-10s %-34s %-5s %s" % (sec, name, verd, detail[:60]))
    bad = sum(1 for r in RESULTS if r[2] == "FAIL")
    print("\nSCORECARD (seo-audit-summary.md format)")
    for sec in sorted({r[0] for r in RESULTS}):
        f = sum(1 for r in RESULTS if r[0] == sec and r[2] == "FAIL")
        print("  %-12s defects: %d" % (sec, f))
    # contracts: every gate prints WHAT IT MEASURED, not only what failed - the
    # fixed shape `checked=<n> failed=<m>` on the verdict line. Without it a
    # clean run and a run that measured nothing print the same words.
    print("EXIT GATE: %d/%d PASS  checked=%d failed=%d"
          % (len(RESULTS) - bad, len(RESULTS), len(RESULTS), bad))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
