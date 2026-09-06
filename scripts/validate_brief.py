#!/usr/bin/env python3
"""validate-brief.py - hard gates on briefs/<slug>.json. Stdlib only.

  python scripts/validate_brief.py <slug> [--freshness]
  python scripts/validate_brief.py --all [--freshness]
  python scripts/validate_brief.py --status     # briefs/README.md status table
Exit 0 when every check passes, 1 otherwise.
"""
import csv, io, json, os, re, sys
from shapes import (as_dict, as_list, dicts, as_int, as_text, load_json,
                    cell, csv_rows)  # noqa: E402,F401
from datetime import date
from pathlib import Path

# CONSOLE ENCODING. A Windows console is cp1252, and a gate that PRINTS page
# content dies with UnicodeEncodeError the moment a page contains a character
# outside it - mid-run, after some pages have been graded and before the
# denominator line, so the run reports NOTHING. Measured 2026-09-05: this
# killed verify_page.py on 22 of 29 projects, which is why the pipeline looked
# like it only ran on six. Degrade the CHARACTER, never the run.
import sys  # the encoding guard below USES sys; without this the
           # NameError was swallowed by its own except and the guard never applied.
try:
    sys.stdout.reconfigure(errors="replace")
    sys.stderr.reconfigure(errors="replace")
except Exception:  # noqa: BLE001
    pass


ROOT = Path(os.environ.get("PROJECT_ROOT", ".")).resolve()
BRIEFS = ROOT / "briefs"
BLUEPRINT = ROOT / "research" / "site-blueprint.csv"
COMPONENTS = ROOT / "src" / "components"
SERP = ROOT / "research" / "serp"
LEDGER = ROOT / "config" / "pipeline-ledger.csv"
FRESH_DAYS = 30          # a SERP extract older than this vs copy_date is STALE
FRESH = False            # set by --freshness
STALE = []               # slugs that failed the freshness gate (for --all)
ORDER_INVERTED = []      # slugs whose brief postdates its copy (for --all)
EXEMPT = []              # utility rows with no target keyword (for --all)

# reference/contracts.md §1a - THE ONE TIER VOCABULARY (CONS-18). Identical maps in
# verify_page.py (Task G3.1): word floor = f(value_tier), FAQ floor = f(page_tier).
# `functional` is in the contracts section-1a vocabulary and was added to
# verify_page.py and exemptions.py but not here, so a functional roster brief
# failed at the BRIEF gate and could never reach verify.
PAGE_TIERS = ("core", "outer", "utility", "compare", "monetization", "functional")
VALUE_FLOOR = {"a": 2200, "b": 1600, "c": 1100, "d": 900}
UTILITY_FLOOR = 600
FAQ_FLOOR = {"core": 10, "compare": 10, "monetization": 10, "outer": 8,
             "utility": 0, "functional": 0}
DEPTH_SECTIONS = {"full": (25, 35), "blog": (15, 40), "low-demand": (8, 12), "utility": (0, 99)}
# E9 (owner decision 2026-09-03): a per-depth FLOOR and NO CEILING. contracts §4 used to
# state a 150-230 band and "never under 100 USABLE" that this table contradicted on both
# edges and no code enforced; §4 now cites this table as the single source.
DEPTH_LSI = {"full": 150, "blog": 100, "low-demand": 50, "utility": 0}
REQUIRED = ["slug", "target_keyword", "page_intent", "page_tier", "brief_depth",
            "serp_format_verdict", "serp_analysis", "meta_title", "meta_title_len",
            "meta_description", "meta_description_len", "h1", "centerpiece",
            "centerpiece_attributes", "quantitative_query", "form_placement",
            "entity_definitions", "entity_map", "lsi_keywords", "lsi_keyword_weighting",
            "paa", "content_outline", "outline_cross_check", "outline_deviations",
            "link_contract", "supplementary_links", "external_links",
            "source_type_plan", "social_research", "writer_constraints",
            "faq", "questions", "schema_plan", "info_gain_score",
            "word_count_target", "content_length_estimate", "word_floor_from_sections"]
CHECKS = []


_EEAT_CACHE = {}


def _eeat_bank():
    """research/eeat-findings.json, loaded once. Absent = a pre-contracts-23 project."""
    if "bank" not in _EEAT_CACHE:
        path = os.path.join("research", "eeat-findings.json")
        try:
            with open(path, encoding="utf-8") as fh:
                _EEAT_CACHE["bank"] = json.load(fh).get("findings", [])
        except (OSError, ValueError):
            _EEAT_CACHE["bank"] = []
    return _EEAT_CACHE["bank"]


def _eeat_for(slug):
    """The findings Stage 1 assigned to THIS page (contracts 23)."""
    s = (slug or "").strip("/")
    return [f for f in _eeat_bank()
            if str(f.get("assigned_slug") or "").strip("/") == s and s]


def _claim_stub(f):
    """First six words of the claim - what an outline heading is likely to echo."""
    return " ".join(str(f.get("claim") or "").split()[:6])


def rec(name, okflag, detail):
    CHECKS.append((name, "PASS" if okflag else "FAIL", detail))


_LEDGER_CACHE = {}


def _ledger_row(slug):
    """The row config/pipeline-ledger.csv holds for this slug, or {}."""
    if not _LEDGER_CACHE:
        _LEDGER_CACHE["_loaded"] = True
        p = ROOT / "config" / "pipeline-ledger.csv"
        if p.exists():
            with p.open(newline="", encoding="utf-8-sig", errors="replace") as fh:
                for r in csv.DictReader(fh):
                    _LEDGER_CACHE[(r.get("slug") or "").strip("/") or "index"] = r
    return _LEDGER_CACHE.get(slug.strip("/") or "index", {})


def rows():
    out = {}
    if BLUEPRINT.exists():
        with BLUEPRINT.open(newline="", encoding="utf-8-sig", errors="replace") as f:
            for r in csv.DictReader(f):
                # contracts §9: url_slug is the canonical column; path/slug are FORBIDDEN
                # legacy names. Reading those first made EVERY row key fall back to
                # "index", so value_tier defaulted and every internal target looked unknown.
                k = (r.get("url_slug") or "").strip("/") or "index"
                rec = {a: cell(b) for a, b in r.items() if a is not None}
                out[k] = rec
                # Brief files are named with the flattened slug (briefs/pricing-heygen.json).
                flat = k.replace("/", "-")
                if flat != k:
                    out.setdefault(flat, rec)
    return out


def components():
    if not COMPONENTS.exists():
        return set()
    return {p.stem for p in COMPONENTS.rglob("*.astro")}


def serp_file(slug):
    f = SERP / (slug.replace("/", "-") + ".json")
    return f if f.exists() else SERP / (slug + ".json")


def copy_date_of(slug):
    if not LEDGER.exists():
        return ""
    with LEDGER.open(newline="", encoding="utf-8-sig", errors="replace") as f:
        for r in csv.DictReader(f):
            if (r.get("slug") or "").strip("/") == slug.strip("/"):
                return (r.get("copy_date") or "").strip()[:10]
    return ""


def serp_age(slug):
    """Days between the SERP extract measured_on and the page copy_date.

    Returns (age_days_or_None, measured_on, reference_date). The reference is
    the ledger copy_date when the page is written, else today - so a brief that
    is stale BEFORE the page is written is caught at brief time too.
    """
    f = serp_file(slug)
    if not f.exists():
        return None, "", ""
    try:
        d = json.loads(f.read_text(encoding="utf-8", errors="replace"))
    except Exception:
        return None, "", ""
    # W7.8 - THE FIELD NAMED THREE WAYS. `serp_extract.py` writes `measured_on`, but the
    # kit's own SERP producer `dfs-pull.mjs` writes `pulled_at` - so on every project built
    # with the kit producer this returned None and EVERY page reported `age=unknown`,
    # `stale=<all>`, forever. contracts §9/§12 name the field ONCE (measured_on); the two
    # aliases are read here so existing artifacts keep working.
    m = str(d.get("measured_on") or d.get("extracted_on")
            or d.get("pulled_at") or "")[:10]
    ref = copy_date_of(slug) or date.today().isoformat()
    try:
        return (date.fromisoformat(ref) - date.fromisoformat(m)).days, m, ref
    except ValueError:
        return None, m, ref


def validate(slug, bp, comps):
    del CHECKS[:]
    # RULE 35: a route with no target keyword and no SERP (privacy, terms, 404,
    # thank-you) gets NO brief. Counting it as a missing brief is what made "0 FAIL"
    # unachievable, and a permanently red gate is a gate operators learn to override.
    row = bp.get(slug.strip("/") or "index", {})
    if row and not (row.get("target_keyword") or "").strip():
        if (row.get("page_tier") or "").strip().lower() in ("utility", "legal"):
            print("EXEMPT brief: n/a - no target keyword (%s)" % slug)
            EXEMPT.append(slug)
            return 0, {}
    f = BRIEFS / (slug.replace("/", "-") + ".json")
    if not f.exists():
        f = BRIEFS / (slug + ".json")
    if not f.exists():
        print("FAIL brief missing: %s" % f)
        return 1, {}
    b = load_json(f, on_error=None)
    if b is None or not isinstance(b, dict):
        print("FAIL brief is not readable JSON (truncated or half-written): %s" % f)
        return 1, {}
    row = bp.get(slug, {})

    missing = [k for k in REQUIRED if k not in b]
    rec("schema", not missing, "0 missing required fields" if not missing
        else "missing: " + ", ".join(missing))
    if b.get("_brief_depth") == "reduced":
        rec("reduced brief", False, "_brief_depth=reduced is forbidden")

    depth = (b.get("brief_depth") or row.get("brief_depth") or "full").strip().lower()
    # contracts.md §1a - both tier columns, read once, under their canonical names.
    page_tier = (b.get("page_tier") or row.get("page_tier") or "outer").strip().lower()
    value_tier = (b.get("value_tier") or row.get("value_tier") or "C").strip().lower()
    # outline_deviations is the scaffold object {renamed, dropped_sections, sizing}.
    # Hand-authored briefs have shipped it as a LIST of free-form notes; that shape
    # crashed verify_page.py, so the page silently went unmeasured. Fail it here,
    # where the brief is still cheap to fix.
    dev = b.get("outline_deviations")
    rec("outline_deviations is an object", isinstance(dev, dict),
        "dict" if isinstance(dev, dict) else "%s - expected {renamed, dropped_sections, sizing}"
        % type(dev).__name__)
    lsi = b.get("lsi_keywords")
    rec("lsi_keywords is an object", isinstance(lsi, dict),
        "dict" if isinstance(lsi, dict) else "%s - expected {primary, secondary, all}"
        % type(lsi).__name__)
    rec("page_tier in vocabulary", page_tier in PAGE_TIERS,
        "%s (contracts §1a: %s)" % (page_tier, "|".join(PAGE_TIERS)))
    rec("value_tier in vocabulary", value_tier in VALUE_FLOOR,
        "%s (contracts §1a: A|B|C|D)" % value_tier.upper())
    # STOP HERE when either tier is unreadable. rec() only RECORDS, so execution used
    # to reach the FAQ_FLOOR subscript below and raise KeyError, aborting the whole
    # --all sweep at the first legacy brief and hiding every brief after it. Mirrors
    # verify_page.py's tier_errs early return.
    if page_tier not in PAGE_TIERS or value_tier not in VALUE_FLOOR:
        # Report before returning. The CHECKS print loop lives at the END of this
        # function, so a bare early return exited 1 with NO output at all and the
        # operator saw a failing brief with no stated reason.
        for _n, _v, _d in CHECKS:
            print("%-4s %-32s %s" % (_v, _n, _d))
        print("BRIEF FAIL (tier vocabulary): %s" % slug)
        return 1, b
    lo, hi = DEPTH_SECTIONS.get(depth, (25, 35))
    outline = as_list(b.get("content_outline"))
    rec("outline count", lo <= len(outline) <= hi or depth == "utility",
        "%d sections (depth=%s wants %d-%d)" % (len(outline), depth, lo, hi))
    p12 = [s for s in dicts(outline)
           if str(s.get("priority", "")).upper().startswith(("P1", "P2"))]
    pct = round(100 * len(p12) / max(1, len(outline)))
    rec("p1p2 >= 45%", pct >= 45 or depth == "utility", "%d%%" % pct)
    phases = {str(s.get("cro_phase", "")) for s in outline}
    rec("5 CRO phases", len({p for p in phases if p in "12345"}) == 5 or depth in ("utility", "low-demand"),
        "phases=%s" % sorted(phases))
    bad_ux = sorted({s.get("ux_note", "") for s in outline
                     if s.get("ux_note") and comps and s["ux_note"] not in comps})
    rec("ux_note components exist", not bad_ux,
        "unknown: %s (globbed %d)" % (", ".join(bad_ux[:6]) or "-", len(comps)))

    q, faq = as_list(b.get("questions")), as_list(b.get("faq"))
    rec("questions 18-22", 18 <= len(q) <= 22 or depth == "utility", "%d" % len(q))
    # CONS-23: the brief floor IS the page floor. A brief with 6 promoted FAQs used to
    # pass here and then FAIL verify_page.py with `faq 6 < 10` one stage later.
    # content-writer promotes from questions[] up to the floor; when the ENTIRE bank is
    # smaller than the floor, the bank is the floor.
    # No laxest-floor fallback: page_tier is validated against PAGE_TIERS above,
    # so an unknown tier is already a failure rather than a silent 8.
    faq_floor = 0 if depth == "utility" else FAQ_FLOOR[page_tier]
    faq_bank = len(q) + len(faq)
    faq_need = min(faq_floor, faq_bank) if faq_bank else faq_floor
    rec("faq >= page FAQ floor", len(faq) >= faq_need,
        "%d (floor %d, page_tier=%s, bank=%d)" % (len(faq), faq_need, page_tier, faq_bank))

    lsi = b.get("lsi_keywords") or {}
    lsi = as_dict(lsi)
    alln, prim = len(as_list(lsi.get("all"))), len(as_list(lsi.get("primary")))
    rec("lsi.all usable", alln >= DEPTH_LSI.get(depth, 100) or depth == "utility",
        "%d (min %d)" % (alln, DEPTH_LSI.get(depth, 100)))
    rec("lsi.primary <= 30", prim <= 30, "%d" % prim)
    serp_ev = json.dumps(b.get("serp_analysis") or {}).lower() + json.dumps(b.get("paa") or []).lower()
    bare = [t for t in (lsi.get("primary") or [])
            if re.fullmatch(r"\d{2,4}", t.strip()) and t.strip() not in serp_ev]
    rec("no bare numbers in primary", not bare, ", ".join(bare[:6]) or "0")
    chrome = [t for t in (lsi.get("all") or [])
              if re.search(r"\bnear me\b|\bprice list\b|\bpackages?\b$", t, re.I)
              and page_tier not in ("core", "compare", "monetization")]
    rec("chrome terms filtered", not chrome, ", ".join(chrome[:6]) or "0")
    removed = len(lsi.get("_removed_as_unusable") or [])
    contam = len(lsi.get("excluded_contaminated") or [])

    _em = b.get("entity_map") or {}
    ents = (_em.get("entities") if isinstance(_em, dict) else _em) or []
    nocov = [e.get("name", "") for e in ents
             if str(e.get("salience", "")).upper() == "HIGH" and not e.get("covered_by_section")]
    rec("entity_map >= 15", len(ents) >= 15 or depth in ("utility", "low-demand"), "%d" % len(ents))
    rec("HIGH entities covered", not nocov, ", ".join(nocov[:6]) or "0")

    tl, dl = b.get("meta_title_len"), b.get("meta_description_len")
    tl = tl if isinstance(tl, int) else len(b.get("meta_title") or "")
    dl = dl if isinstance(dl, int) else len(b.get("meta_description") or "")
    rec("meta_title_len <= 60", tl <= 60, "%d" % tl)
    rec("meta_description_len 140-158", 140 <= dl <= 158, "%d" % dl)

    # contracts.md §1a: word floor = f(value_tier); page_tier=utility overrides to 600.
    # contracts §1a gives BOTH utility and functional a floor override; functional
    # was added to PAGE_TIERS and FAQ_FLOOR but not here, so a roster brief still owed
    # up to 2,200 words at brief time while verify_page graded it at 600.
    floor = (UTILITY_FLOOR if (depth == "utility" or page_tier in ("utility", "functional"))
             else VALUE_FLOOR.get(value_tier, VALUE_FLOOR["c"]))
    sect_floor = b.get("word_floor_from_sections")
    if not isinstance(sect_floor, int):
        sect_floor = sum(100 * len(s.get("key_points") or []) or 100 for s in outline)
    target = b.get("word_count_target")
    target = target if isinstance(target, int) else 0
    rec("word_count_target >= tier floor", target >= floor,
        "target=%d floor=%d (value_tier=%s page_tier=%s)"
        % (target, floor, value_tier.upper(), page_tier))
    rec("word_count_target >= section floor", target >= sect_floor or depth == "utility",
        "target=%d floor_from_sections=%d" % (target, sect_floor))
    band = (as_dict(as_dict(b.get("serp_analysis")).get("word_band"))
            or as_dict(b.get("word_band")))
    rec("word_band measured", bool(band.get("top3_median")), json.dumps(band)[:70])

    lc = b.get("link_contract") or {}
    want = {k: row.get("link_" + k, "") for k in ("root", "seed", "node")}
    mism = [k for k, v in want.items() if v and lc.get(k, "").rstrip("/") != v.rstrip("/")]
    rec("link_contract == blueprint row", not mism, "mismatched: %s" % (mism or "-"))
    # A supplementary link ships as {target_slug, anchor, reason}; a bare
    # string made this comprehension raise AttributeError and kill the whole
    # validator mid-run. A gate must FAIL malformed data, never die on it -
    # dying reports nothing at all, which reads as silence rather than as a
    # defect.
    def _target(l):
        return (l.get("target_slug", "") if isinstance(l, dict) else str(l))

    targets = {v for v in lc.values() if v} | {_target(l)
                                               for l in (b.get("supplementary_links") or [])}
    # "/" strips to the empty string, which is the home row's key "index".
    unknown = [t for t in targets
               if t and (t.strip("/") or "index") not in bp and t.strip("/") != "index"]
    rec("internal targets in blueprint", not unknown, ", ".join(sorted(unknown)[:6]) or "0")

    # A005 - form_placement was in REQUIRED (key present) and its ENUM was never
    # checked, so every Core brief on BTO carried the freeform sentence "Primary form at
    # the page foot via ContactForm..." and passed. The built money pages then shipped
    # ZERO <form> elements against it. On a lead-gen site this is the highest-leverage
    # conversion surface on the whole build.
    FORM_PLACEMENTS = ("none", "inline_cta", "hero_form", "full_form")
    fp = str(b.get("form_placement", "")).strip()
    rec("form_placement is one of none|inline_cta|hero_form|full_form",
        fp in FORM_PLACEMENTS,
        fp[:60] if fp else "(empty)")

    ext = as_list(b.get("external_links"))
    # `status_checked: false` used to EXEMPT a link from the check, so declaring a link
    # unverified was the way to pass the verification gate. It is now the failure it
    # describes. BLOCKED is not BROKEN (same semantics as check-references.mjs): a host
    # that refuses bots (400/401/403/429) may be cited when the brief says so.
    # 202 joins them: bot-mitigation front ends (Semantic Scholar, some Cloudflare and
    # DataDome configurations) answer a scripted GET with 202 and a challenge page while
    # serving the record to a browser. That is a refused bot, not a dead citation, and
    # the alternative - swapping in a "200" that is itself a challenge page, as JSTOR's
    # stable URLs return - would verify nothing while looking verified.
    BLOCKED_CODES = {"202", "400", "401", "403", "429"}
    unver = []
    for e in dicts(ext):
        code = str(e.get("http_status", "")).strip()
        if code == "200":
            continue
        if str(e.get("status", "")).lower() == "blocked" and code in BLOCKED_CODES:
            continue
        if e.get("status_checked") is False:
            unver.append((e.get("url", "") or "?") + " (never verified - open it or drop it)")
        else:
            unver.append("%s (%s)" % (e.get("url", "") or "?", code or "no status"))
    rec("external_links verified 200", not unver, ", ".join(unver[:5]) or "0")

    v = b.get("serp_format_verdict") or {}
    rec("serp_format_verdict", bool(v.get("dominant_type")), json.dumps(v)[:80])
    sr = b.get("social_research") or {}
    rec("social_research recorded", "run" in sr, json.dumps(sr)[:80])

    sf = serp_file(slug)
    rec("research/serp/<slug>.json present", sf.exists(),
        sf.name if sf.exists() else "MISSING - the live pull was never extracted")
    if FRESH:
        # A006 - ORDER. The information-gain brief is the INPUT to the copy. A brief whose
        # _generated.on postdates the ledger row's copy_date cannot have informed the page,
        # so the page is unwritten by definition - unless the copy was re-run through
        # content-writer AFTER the brief landed, which the copy_gate_sha date records.
        # W10.2 - THE KEYS NOBODY WRITES. `_generated.on` has ZERO mentions in page-brief,
        # the brief engine and brief_scaffold.py (which writes `_scaffold.generated_on` and
        # `_spec_merged_on`), and `copy_gate_date` is not one of the ledger's 43 columns -
        # so `bdate` and `regated` were ALWAYS empty, the order check was vacuous on every
        # kit project, and RULE 35's "unless copy_gate_sha postdates the brief" could never
        # fire. Read what the producers actually write, and FAIL when the brief carries no
        # date at all rather than passing for lack of one.
        bdate = (str((b.get("_spec_merged_on") or ""))[:10]
                 or ((b.get("_generated") or {}).get("on") or "").strip()[:10]
                 or ((b.get("_scaffold") or {}).get("generated_on") or "").strip()[:10])
        led = _ledger_row(slug)
        cdate = (led.get("copy_date") or "").strip()[:10]
        regated = (led.get("copy_gate") or "").strip()[:10]
        order_ok = True
        detail = "brief=%s copy=%s" % (bdate or "-", cdate or "-")
        if not bdate:
            order_ok = False
            detail += " - the brief carries NO generation date (_spec_merged_on / "
            detail += "_generated.on / _scaffold.generated_on all absent)"
        if bdate and cdate and bdate > cdate and not (regated and regated >= bdate):
            order_ok = False
            detail += " - brief written AFTER the copy; the page is unbriefed"
            ORDER_INVERTED.append(slug)
        rec("brief predates the copy it informed", order_ok, detail)
        age, measured, ref = serp_age(slug)
        fresh_ok = age is not None and age <= FRESH_DAYS
        if not fresh_ok:
            STALE.append(slug)
        rec("serp extract fresh (<=%dd vs copy_date)" % FRESH_DAYS, fresh_ok,
            "measured_on=%s ref=%s age=%s" % (measured or "-", ref or "-",
                                              ("%dd" % age) if age is not None else "unknown"))

    paa = b.get("paa") or []
    heads = {str(s.get("heading", "")).lower().rstrip("?") for s in outline}
    rew = {r.get("original", ""): r.get("used", "") for r in (b.get("paa_rewords") or [])}
    inout = sum(1 for p in paa[:4] if rew.get(p, p).lower().rstrip("?") in heads)
    rec("paa in outline >= 3 of top 4", (not paa) or inout >= min(3, len(paa)),
        "paa_in_outline=%d/%d" % (inout, min(4, len(paa))))

    # ---------------------------------------------------------------- contracts 23
    # THE EEAT EVIDENCE BANK. Stage 0.6 researched 30-40 sourced findings and Stage 1
    # assigned each one to exactly one page. A brief for a page with assigned findings
    # and no eeat_findings[] is a brief that dropped the research on the floor - and no
    # other check in this file can see that, because every other check grades the brief
    # against the SERP rather than against what the project already knows.
    _assigned = _eeat_for(b.get("slug") or "")
    if _assigned:
        got = {str(x.get("id") if isinstance(x, dict) else x)
               for x in (b.get("eeat_findings") or [])}
        want = {f["id"] for f in _assigned}
        rec("eeat_findings carries every assigned finding", want <= got,
            "%d/%d assigned ids in brief.eeat_findings%s"
            % (len(want & got), len(want),
               "" if want <= got else " - missing: " + ", ".join(sorted(want - got))))
        # `" ".join(json.dumps(...))` joined a STRING character by character, inserting a
        # space between every letter, so a finding id could never be found and this check
        # silently passed nothing. Serialise once, search once.
        _heads = json.dumps(b.get("content_outline") or [], ensure_ascii=False).lower()
        covered = sum(1 for f in _assigned
                      if f["id"].lower() in _heads
                      or _claim_stub(f).lower() in _heads)
        rec("one outline section per assigned finding", covered == len(want),
            "%d/%d findings have an outline section naming them" % (covered, len(want)))
        for f in _assigned:
            for k in ("claim", "why", "type", "confidence", "limitation", "sources"):
                if not any(isinstance(x, dict) and x.get("id") == f["id"] and x.get(k)
                           for x in (b.get("eeat_findings") or [])):
                    rec("eeat finding %s carries %s" % (f["id"], k), False,
                        "brief.eeat_findings[%s].%s is empty - the writer cannot state a "
                        "limitation it was never given" % (f["id"], k))
                    break

    # ---------------------------------------------------------------- 2026-08-31
    # The brief already REQUIRED entity_map and outline_cross_check as keys, so a map
    # of bare names and a cross-check that stopped at "I" both passed. These four
    # checks are the difference between a field being PRESENT and a field carrying the
    # signal it exists for.
    _em = b.get("entity_map") or {}
    ents = (_em.get("entities") if isinstance(_em, dict) else _em) or []
    # ATTRIBUTES + USE CASES: a name alone is a string, a name with properties is a
    # thing. Without these the map identifies entities but says nothing about them.
    with_attrs = sum(1 for e in ents if isinstance(e, dict) and (e.get("attributes") or []))
    with_uses = sum(1 for e in ents if isinstance(e, dict) and (e.get("use_cases") or []))
    rec("entity attributes on every entity", bool(ents) and with_attrs == len(ents),
        "%d/%d carry attributes[]" % (with_attrs, len(ents)))
    rec("entity use_cases on every entity", bool(ents) and with_uses == len(ents),
        "%d/%d carry use_cases[]" % (with_uses, len(ents)))
    # CLASS-9 ADJACENT-DOMAIN: the wide semantic net. Task 2B rule 3 used to force
    # every entity to own a section, which made a non-vertical entity structurally
    # impossible - so a map could be 100% on-topic and still look complete. 3-6 is the
    # whole budget: below it the net is vertical, above it the page is taking a
    # keyword detour.
    axes = [str((e or {}).get("relation_axis") or "").strip().lower() for e in ents
            if isinstance(e, dict)]
    adjacent = sum(1 for a in axes if a in ("upstream", "downstream", "parallel"))
    rec("adjacent-domain entities (3-6)", 3 <= adjacent <= 6,
        "%d with relation_axis upstream/downstream/parallel" % adjacent)
    # CROSS-CHECKS J-M: A-I ask whether the outline covers what OUR research surfaced.
    # J asks what a buyer needs that nobody surfaced, K puts a CTA at the decision, L
    # makes the answer liftable, M links the obligation. All four report or the brief
    # is not finished.
    xc = b.get("outline_cross_check") or {}
    have = [k for k in ("J", "K", "L", "M") if str(k) in xc or k.lower() in xc]
    rec("outline cross-check J-M reported", len(have) == 4,
        "present=%s" % (",".join(have) or "none"))

    bad = sum(1 for c in CHECKS if c[1] == "FAIL")
    for name, verd, detail in CHECKS:
        print("%-4s %-32s %s" % (verd, name, detail))
    fmt = (v.get("dominant_type") or "-")
    if bad:
        print("BRIEF FAIL (%d checks): %s" % (bad, slug))
    else:
        print("BRIEF OK: sections=%d p1p2=%d%% phases=%d questions=%d faq=%d "
              "lsi=%d/%d entities=%d words=%d title=%d meta=%d format=%s band=%s "
              "removed_unusable=%d excluded_contaminated=%d"
              % (len(outline), pct, len({p for p in phases if p in '12345'}), len(q),
                 len(faq), alln, prim, len(ents), target, tl, dl, fmt,
                 band.get("top3_median", "-"), removed, contam))
    return (1 if bad else 0), b


def status_table(bp):
    # A table with no rows is not "all clear" — it is a gate that measured nothing.
    # Same vacuity bug --all carried: run from the wrong cwd, or before Stage 1, and
    # this printed a header and exited 0 while 20 pages were written against stubs.
    if not bp and not list(BRIEFS.glob("*.json")):
        print("HALT: no blueprint rows and no briefs/*.json - run from PROJECT_ROOT "
              "after Stage 1 (looked in %s and %s)" % (BLUEPRINT, BRIEFS))
        return 1
    # A093 - the "validator" column read "pending run" on EVERY row: the table told you a
    # brief FILE existed and nothing else, which is precisely how 20 brief_scaffold stubs
    # were counted as briefs. It now RUNS the validator per row (RULE 35's "never count
    # files as evidence"), and computes the _specs equality instead of leaving it to two
    # `wc -l` outputs read side by side.
    comps = components()
    print("| slug | keyword | volume | tier | brief_depth | status | _specs | validator |")
    print("|---|---|---|---|---|---|---|---|")
    briefed = pending = bad = scaffold = specs = 0
    keyworded = 0
    for slug, row in sorted(bp.items(), key=lambda kv: kv[1].get("build_order", "999")):
        flat = slug.replace("/", "-")
        f = BRIEFS / (flat + ".json")
        has = f.exists() or (BRIEFS / (slug + ".json")).exists()
        has_kw = bool((row.get("target_keyword") or "").strip())
        if has_kw:
            keyworded += 1
        spec = (BRIEFS / "_specs" / (flat + ".mjs")).exists()
        if spec:
            specs += 1
        verdict = "-"
        if not has_kw and (row.get("page_tier") or "").lower() in ("utility", "legal"):
            verdict = "EXEMPT (no target keyword)"
        elif has:
            briefed += 1
            # A stub carries the SERP-only keys and none of the information-gain half.
            try:
                b = json.loads(f.read_text(encoding="utf-8", errors="replace")) \
                    if f.exists() else json.loads((BRIEFS / (slug + ".json")).read_text(
                        encoding="utf-8", errors="replace"))
            except Exception:
                b = {}
            missing_req = [k for k in REQUIRED if k not in b]
            if len(missing_req) >= 10 or not spec:
                verdict = "SCAFFOLD (%d required keys missing%s)" % (
                    len(missing_req), "" if spec else ", no _specs")
                scaffold += 1
            else:
                buf = io.StringIO()
                _real = sys.stdout
                sys.stdout = buf
                try:
                    code, _ = validate(slug, bp, comps)
                finally:
                    sys.stdout = _real
                if code:
                    nfail = sum(1 for c in CHECKS if c[1] == "FAIL")
                    verdict = "FAIL (%d checks)" % nfail
                    bad += 1
                else:
                    verdict = "PASS"
        else:
            pending += 1
        print("| %s | %s | %s | %s | %s | %s | %s | %s |"
              % (slug, row.get("target_keyword", ""), row.get("search_volume", ""),
                 row.get("page_tier", ""), row.get("brief_depth", ""),
                 "briefed" if has else "MISSING", "yes" if spec else "-", verdict))
    print("\nbriefed=%d pending=%d scaffold=%d failing=%d total=%d"
          % (briefed, pending, scaffold, bad, len(bp)))
    # contracts: every gate prints WHAT IT MEASURED, not only what failed.
    # The fixed shape `checked=<n> failed=<m>` on the verdict line is what
    # makes a pass readable: without it "0 failing" and "measured nothing"
    # print the same words.
    print("validate_brief --status: checked=%d failed=%d"
          % (len(bp), bad + pending + scaffold))
    # RULE 35's equality, COMPUTED.
    print("_specs=%d keyworded_briefs=%d -> %s"
          % (specs, keyworded, "PASS" if specs == keyworded else
             "FAIL (a brief with a target keyword and no _specs is a stub)"))
    return 0 if (pending == 0 and bad == 0 and scaffold == 0 and specs == keyworded) else 1


def self_test():
    """W10.5 / W12.x — the type and date rules that used to be silently skipped."""
    bad = []
    # 1. content_outline[].level ships as int (48 briefs), 'h2' (53) and absent (20);
    #    verify_page kept only `level == 'H2'`, so the headings gate was skipped on one
    #    project and over-counted H3s on another. NORMALISE, then compare.
    for raw, want in ((2, "H2"), ("h2", "H2"), ("H2", "H2"), (3, "H3"), ("h3", "H3")):
        got = _norm_level(raw)
        if got != want:
            bad.append("level %r normalises to %r, want %r" % (raw, got, want))
    if _norm_level(None) is not None:
        bad.append("an ABSENT level must stay absent, not become H2")
    # 2. the freshness reader must accept every name a SERP producer writes (W7.8)
    for key in ("measured_on", "extracted_on", "pulled_at"):
        if key not in open(__file__, encoding="utf-8", errors="replace").read():
            bad.append("serp_age() does not read %s" % key)
    # 3. the LSI floors are the ONE source (E9: floors, no ceiling)
    if set(DEPTH_LSI) != {"full", "blog", "low-demand", "utility"}:
        bad.append("DEPTH_LSI no longer carries the four depths contracts s4 cites")
    for line in bad:
        print("FAIL " + line)
    print("-" * 70)
    print("validate_brief self-test: %d check(s) failed" % len(bad))
    return 1 if bad else 0


def _norm_level(raw):
    """W10.5 — content_outline[].level is int | 'h2' | 'H2' | absent across live briefs.
    ONE normaliser, so every consumer counts the same headings."""
    if raw is None or raw == "":
        return None
    text = str(raw).strip().upper()
    if text.isdigit():
        return "H" + text
    if text.startswith("H") and text[1:].isdigit():
        return text
    return None


def main():
    global FRESH
    if any(a in ("--help", "-h") for a in sys.argv[1:]):
        print(__doc__)
        return 0
    args = sys.argv[1:]
    if "--self-test" in args:
        return self_test()
    FRESH = "--freshness" in args
    args = [a for a in args if a != "--freshness"]
    # A flag this script does not know is a typo in a gate command, not a slug.
    unknown = [a for a in args
               if a.startswith("-") and a not in ("--all", "--status", "--self-test")]
    if unknown:
        print("validate_brief.py: unknown option " + ", ".join(unknown),
              file=sys.stderr)
        return 2
    del STALE[:]
    del ORDER_INVERTED[:]
    del EXEMPT[:]
    bp, comps = rows(), components()
    if not args:
        print(__doc__)
        return 2
    if args[0] == "--status":
        return status_table(bp)
    if args[0] == "--all":
        targets = sorted(bp) or sorted(p.stem for p in BRIEFS.glob("*.json"))
        # A gate that measures nothing must never report PASS. With neither a blueprint
        # nor a briefs/ directory (wrong cwd, or run before Stage 1) this printed
        # "stale=0" / "0 FAIL" and exited 0, so Stage-3 exit-gate item (a) went green
        # on an empty tree.
        if not targets:
            print("HALT: no blueprint rows and no briefs/*.json - run from PROJECT_ROOT "
                  "after Stage 1 (looked in %s and %s)" % (BLUEPRINT, BRIEFS))
            return 1
        bad = 0
        for slug in targets:
            print("--- %s" % slug)
            code, _ = validate(slug, bp, comps)
            bad += code
        if FRESH:
            for slug in STALE:
                print("FAIL stale SERP extract (> %d days): %s" % (FRESH_DAYS, slug))
            for slug in ORDER_INVERTED:
                print("FAIL brief written after the copy (unbriefed page): %s" % slug)
            print("stale=%d order_inverted=%d" % (len(STALE), len(ORDER_INVERTED)))
        print("exempt=%d (utility rows with no target keyword)" % len(EXEMPT))
        print("%s" % ("0 FAIL" if not bad else "%d FAIL" % bad))
        return 1 if bad else 0
    code, _ = validate(args[0].strip("/") or "index", bp, comps)
    return code


if __name__ == "__main__":
    sys.exit(main())
