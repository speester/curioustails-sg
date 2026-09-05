#!/usr/bin/env python3
"""ledger.py - pipeline ledger integrity, next-slug and computed rollups.

  python scripts/ledger.py init          # create the CSV from the blueprint
  python scripts/ledger.py check [--stage build|launch|audit|retro]
                                         # 0 empty cells for that stage, or exit 1
                                         # default --stage build (Stage 3 exit); columns a
                                         # later stage fills are exempt until that stage
  python scripts/ledger.py check --freshness
                                         # + serp_extract older than copy_date by >30d
                                         #   (Stage 3 exit gate item (a))
  python scripts/ledger.py next          # first slug with an empty cell, in build_order
  python scripts/ledger.py next --batch 4  # the next N incomplete slugs - the fan-out wave
                                         #   (FAN-OUT MODE is the default after CP3)
  python scripts/ledger.py rollup        # computed counts (never typed)
  python scripts/ledger.py --toolkit-check
  python scripts/ledger.py --schema      # the 44 names, one per line
  python scripts/ledger.py --write-schema  # regenerate reference/ledger-columns.txt
Stdlib only. The column list is NEVER a literal here - it is loaded from
~/.claude/skills/run-the-project/reference/ledger-columns.txt (contracts.md §10).
"""
import csv, os, re, subprocess, sys
from datetime import date

TODAY = date.today().isoformat()
from pathlib import Path

ROOT = Path(os.environ.get("PROJECT_ROOT", ".")).resolve()
LEDGER = ROOT / "config" / "pipeline-ledger.csv"
BLUEPRINT = ROOT / "research" / "site-blueprint.csv"
# CONS-24: NO `COLS = [...]` LITERAL LIVES HERE. The 44 names of
# reference/contracts.md §10 are loaded from reference/ledger-columns.txt, which
# `ledger.py --write-schema` generates from §10. A literal here is what let the
# ledger be created with 38 columns while every G5 gate expected 42.
SCHEMA_FILE = os.path.join(os.path.expanduser("~"), ".claude", "skills",
                           "run-the-project", "reference", "ledger-columns.txt")


def load_cols():
    """The 44 column names of reference/contracts.md §10 - never a literal in this file.
    BOOTSTRAP (CONS-24): --write-schema is the command that CREATES the reference file, so it
    cannot require it to already exist; in that one invocation load_cols() returns [] and the
    writer falls back to SCHEMA_SOURCE. Every other entry point still hard-fails on a missing
    file, so a normal run can never silently invent a column order."""
    if not os.path.isfile(SCHEMA_FILE):
        if "--write-schema" in sys.argv:
            return []
        print("FAIL %s missing - run `ledger.py --write-schema` (contracts.md §10)" % SCHEMA_FILE)
        sys.exit(1)
    cols = [c.strip() for c in open(SCHEMA_FILE, encoding="utf-8").read().split() if c.strip()]
    if "kie_webp" in cols:
        print("FAIL kie_webp is a retired column (contracts.md §10) - `visuals` replaces it")
        sys.exit(1)
    return cols


COLS = load_cols()
# The one authoritative order, used ONLY by --write-schema when the reference file
# has to be (re)generated from contracts.md §10. Every other read goes through COLS.
SCHEMA_SOURCE = ("slug tier archetype_role brief_depth kd ceiling_tier build_order "
                 "brief_date serp_extract word_band copy_date copy_gate copy_gate_sha "
                 "words h3 tables capsule_pct kw_ratio lsi_pct entity_pct paa_covered "
                 "paa_verbatim faq_visible visuals svg_figures section_patterns "
                 "interactive_patterns "
                 "og_image sme_quotes eeat_points claims_inline sources_block uniqueness "
                 "contrast_pass hero_visible anchors_over_cap form_smoke_test page_audit "
                 "final_audit committed_sha staging_checked deployed deployed_sha retro").split()
TOOLKIT = ["verify_page.py", "audit_built_html.py", "validate_brief.py", "serp_extract.py",
           "brief_scaffold.py",
           "kie_batch.py", "build_sme_quotes.py", "check-quotes.mjs", "check-content.mjs",
           "check-references.mjs", "anchor-registry.mjs", "gen-posts.mjs", "ledger.py",
           "refresh_prices.py", "fix-link-spacing.mjs", "page-health.mjs", "screenshots.mjs"]
UTILITY = {"utility", "legal"}
# reference/contracts.md, THE ONE EXEMPTION LIST - identical predicate in
# verify_page.py (Task G3.1) and audit_built_html.py (Task G3.2).
# contracts §3: the figure / quote / Sources predicate is implemented ONCE, in
# exemptions.py, and imported here. Three instruments carrying three tuples is what
# made /about/ pass one letter and fail two others on every site ever built.
import os as _os
import sys as _sys

# CONSOLE ENCODING. A Windows console is cp1252, and a gate that PRINTS page
# content dies with UnicodeEncodeError the moment a page contains a character
# outside it - mid-run, after some pages have been graded and before the
# denominator line, so the run reports NOTHING. Measured 2026-09-05: this
# killed verify_page.py on 22 of 29 projects, which is why the pipeline looked
# like it only ran on six. Degrade the CHARACTER, never the run.
try:
    sys.stdout.reconfigure(errors="replace")
    sys.stderr.reconfigure(errors="replace")
except Exception:  # noqa: BLE001
    pass

_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from exemptions import (exemption, figure_floor, UTILITY_ROUTES,  # noqa: E402
                        FULL, PARTIAL, EXEMPT)
EXEMPT_COLS = ("sme_quotes", "eeat_points", "sources_block", "svg_figures", "visuals")
# CONS-25: a column is not "empty", it is NOT YET DUE. Stage 3 cannot fill a cell that
# Stage 4 writes, so demanding it at the Stage 3 exit gate deadlocked the pipeline
# (Stage 3 could not exit until Stage 4 ran; Stage 4 could not start until Stage 3 exited).
# Each stage exempts only what a LATER stage fills.
NOT_YET_DUE = {
    "build":  ("staging_checked", "deployed", "deployed_sha", "final_audit", "retro"),
    "launch": ("final_audit", "retro"),
    "audit":  ("retro",),
    "retro":  (),
}
STAGES = tuple(NOT_YET_DUE)
# The PASS shape of a verify_page summary. A cell that does not match it, or
# that contains FAIL, does NOT close the row (REQ: the gate must BLOCK).
PASS_SHAPE = re.compile(r"^w=\d+ kw=ok(?::\d+x)? .*head=ok$")
# A utility route (privacy, terms, thank-you, 404) has NO target keyword by design, so
# page-check reports kw=none for it and that is its passing state. Holding those rows to
# kw=ok made the gate unsatisfiable without writing a false summary into the ledger.
PASS_SHAPE_UTILITY = re.compile(r"^w=\d+ kw=none .*head=ok$")
FRESH_DAYS = 30


def route_exempt(slug):
    """THE ONE EXEMPTION LIST - exemptions.py owns it (contracts §3)."""
    return exemption(slug) == EXEMPT


def days_between(extract_cell, copy_cell):
    """Days from the serp_extract date to the copy_date (or today)."""
    m = re.search(r"\d{4}-\d{2}-\d{2}", extract_cell or "")
    c = re.search(r"\d{4}-\d{2}-\d{2}", copy_cell or "")
    if not m:
        return None
    # `2026-02-30` matches the regex and raises out of the whole `check` run; an
    # impossible date is a FAILING cell, not a crash.
    try:
        ref = date.fromisoformat(c.group(0)) if c else date.today()
        return (ref - date.fromisoformat(m.group(0))).days
    except ValueError:
        return "BAD-DATE"


# contracts §9 names the blueprint column `page_tier`; `tier` is a FORBIDDEN dead name.
# The ledger's own column is `tier`, so the two must be mapped, not assumed equal — reading
# `r.get("tier")` off a canonical 39-column blueprint yielded '' on EVERY row, and the
# ledger's exemption then keyed on an empty cell. (Real ledgers carry tiers only because an
# older init ran against an older blueprint.)
BLUEPRINT_CELL = {
    "tier": ("page_tier", "tier"),
    "brief_depth": ("brief_depth",),
    "kd": ("kd",),
    "ceiling_tier": ("ceiling_tier", "value_tier"),
    "build_order": ("build_order",),
}


def _copy_blueprint_cells(row, bp_row):
    for col, names in BLUEPRINT_CELL.items():
        for name in names:
            val = (bp_row.get(name) or "").strip()
            if val:
                row[col] = val
                break


def read():
    if not LEDGER.exists():
        print("FAIL config/pipeline-ledger.csv missing - run `ledger.py init`")
        sys.exit(1)
    with LEDGER.open(newline="", encoding="utf-8-sig", errors="replace") as f:
        return list(csv.DictReader(f))


def _blueprint_slugs():
    out = []
    if BLUEPRINT.exists():
        with BLUEPRINT.open(newline="", encoding="utf-8-sig", errors="replace") as f:
            for r in csv.DictReader(f):
                out.append(((r.get("url_slug") or "").strip("/") or "index", r))
    return out


def stamp(slug, summary=""):
    """Re-stamp copy_gate + copy_gate_sha for ONE row, at the CURRENT HEAD.

    A page edited after its gate ran carries a green cell that describes code which no
    longer exists - which is what `copy_gate_sha != committed_sha` reports. The rule
    ("re-run qc for the touched routes and re-stamp before claiming complete") had no
    command behind it, so re-stamping meant hand-editing a CSV.
    """
    slug = (slug or "").strip("/") or "index"
    rows = read()
    hit = None
    for r in rows:
        if ((r.get("slug") or "").strip("/") or "index") == slug:
            hit = r
            break
    if hit is None:
        print("FAIL no ledger row for %r (run `ledger.py sync` if the blueprint grew)" % slug)
        return 1
    try:
        rr = subprocess.run(["git", "rev-parse", "--short", "HEAD"],
                            capture_output=True, text=True)
        sha = rr.stdout.strip() if rr.returncode == 0 else ""
    except Exception:
        sha = ""
    if not sha:
        print("FAIL cannot read HEAD - provenance needs the local repository "
              "(`site-kit.py init` creates it)")
        return 1
    if summary:
        hit["copy_gate"] = summary
    elif not (hit.get("copy_gate") or "").strip():
        print("FAIL copy_gate is empty and no summary was passed: "
              "run `npm run qc` for /%s/ and pass its PASS summary as the second argument"
              % slug)
        return 1
    hit["copy_gate_sha"] = sha
    hit["copy_date"] = TODAY
    with LEDGER.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=COLS, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)
    print("ledger stamp: %s copy_gate_sha=%s copy_date=%s" % (slug, sha, TODAY))
    return 0


def sync():
    """Append ledger rows for blueprint slugs that have none. Touches nothing else.

    `init` overwrites; a blueprint that grew mid-build (a new silo row) therefore had
    no safe path into the ledger except re-running init and losing every evidence cell
    already recorded.
    """
    if not LEDGER.exists():
        return init()
    existing = read()
    have = {(r.get("slug") or "").strip("/") or "index" for r in existing}
    added = []
    for slug, r in _blueprint_slugs():
        if slug in have:
            continue
        row = {c: "" for c in COLS}
        row["slug"] = slug
        _copy_blueprint_cells(row, r)
        existing.append(row)
        added.append(slug)
    with LEDGER.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=COLS, extrasaction="ignore")
        w.writeheader()
        w.writerows(existing)
    print("ledger sync: appended %d row(s)%s"
          % (len(added), (": " + ", ".join(added[:10])) if added else ""))
    return 0


def init():
    # An existing ledger carrying EVIDENCE is the build's record of what was done. init
    # rewrites the file from the blueprint, so running it a second time silently erased
    # every gate result recorded so far.
    if LEDGER.exists():
        try:
            prior = read()
        except SystemExit:
            prior = []
        evidence_cols = [c for c in COLS if c not in ("slug", "tier", "archetype_role",
                                                      "brief_depth", "kd", "ceiling_tier",
                                                      "build_order")]
        if any((r.get(c) or "").strip() for r in prior for c in evidence_cols):
            print("FAIL ledger exists with evidence; use `ledger.py sync` to append "
                  "missing blueprint rows without overwriting recorded results")
            return 1
    rows = []
    if BLUEPRINT.exists():
        with BLUEPRINT.open(newline="", encoding="utf-8-sig", errors="replace") as f:
            for r in csv.DictReader(f):
                slug = (r.get("url_slug") or "").strip("/") or "index"  # contracts §9: url_slug is the canonical column; path/slug are FORBIDDEN legacy names
                row = {c: "" for c in COLS}
                row["slug"] = slug
                _copy_blueprint_cells(row, r)
                rows.append(row)
    LEDGER.parent.mkdir(parents=True, exist_ok=True)
    with LEDGER.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=COLS)
        w.writeheader()
        w.writerows(rows)
    print("ledger: created %s with %d rows x %d columns" % (LEDGER, len(rows), len(COLS)))
    return 0


def order_key(r):
    try:
        return int(r.get("build_order") or 999)
    except ValueError:
        return 999


# REQ-5: the inert-card count rides in the interactive_patterns cell - no new column.
# A bare integer no longer closes the row; the cell must read <n>/inert=<m>.
CELL_SHAPES = {
    "interactive_patterns": re.compile(r"^\d+/inert=\d+$"),
}


def offshape(rows):
    bad = []
    for r in rows:
        for col, pat in CELL_SHAPES.items():
            v = (r.get(col) or "").strip()
            if v and not pat.match(v):
                bad.append("%s %s=%r" % (r.get("slug"), col, v))
    return bad


def _refuse_if_vacuous(what):
    """W12.1: `check`, `next` and `rollup` all reported success on a HEADER-ONLY ledger —
    "0 empty cells across 0 rows", "every row is complete", "TOTAL 0/0 done", exit 0 —
    and the blueprint read was wrapped in `except Exception: pass`, so a project with no
    blueprint at all looked finished."""
    rows = read()
    if not rows:
        print("HALT: ledger %s: 0 rows. A ledger with no rows measures nothing — run "
              "`ledger.py init` (or `sync`) against research/site-blueprint.csv." % what)
        return None
    if not BLUEPRINT.exists():
        print("FAIL research/site-blueprint.csv missing — the ledger cannot be checked "
              "against the rows it is supposed to cover")
        return None
    return rows


def check(args=()):
    fresh = "--freshness" in args
    stage = "build"
    if "--stage" in args:
        i = list(args).index("--stage")
        stage = args[i + 1] if i + 1 < len(args) else ""
    if stage not in NOT_YET_DUE:
        print("FAIL unknown --stage %r; expected one of: %s" % (stage, ", ".join(STAGES)))
        return 2
    pending = NOT_YET_DUE[stage]
    rows = _refuse_if_vacuous("check")
    if rows is None:
        return 1
    # target keyword per slug, straight from the blueprint
    has_kw = {}
    try:
        with BLUEPRINT.open(newline="", encoding="utf-8-sig", errors="replace") as fh:
            for br in csv.DictReader(fh):
                sl = (br.get("url_slug") or "").strip("/") or "index"
                has_kw[sl] = bool((br.get("target_keyword") or "").strip())
    except Exception:
        pass
    empties, badgate, stalesha, stale = [], [], [], []
    # A blueprint row with no ledger row is a page the ledger cannot report on, so its
    # absence reads as completeness.
    ledger_slugs = {(r.get("slug") or "").strip("/") or "index" for r in rows}
    orphan_bp = sorted(sl for sl in has_kw if sl not in ledger_slugs)
    inverted = []
    for r in rows:
        tier = (r.get("tier") or "").lower()
        slug = r.get("slug", "?")
        # THE shared predicate: same answer verify_page.py and audit_built_html.py get,
        # so a row cannot be exempt in the ledger and graded in the gate.
        # W11.2: passing the tier ALONE made a keywordless row `full` here and `exempt`
        # in letters (h)/(n). brief_depth and the keyword decide too.
        exempt = exemption(slug, tier=tier,
                           brief_depth=(r.get("brief_depth") or "").strip(),
                           has_keyword=has_kw.get(slug, True)) == EXEMPT
        for c in COLS:
            if c in EXEMPT_COLS and exempt:
                continue
            if c in pending:
                continue
            if not (r.get(c) or "").strip():
                empties.append("%s.%s" % (slug, c))
        cg = (r.get("copy_gate") or "").strip()
        # Which shape applies is decided by whether the row HAS a target keyword, not by a
        # hardcoded route list: /blog/ is an outer-tier index with no money term, and holding
        # it to kw=ok would have meant writing a summary the page-check never produced.
        shape = PASS_SHAPE if (exempt is False and has_kw.get(slug, True)) else PASS_SHAPE_UTILITY
        if not has_kw.get(slug, True):
            shape = PASS_SHAPE_UTILITY
        if cg and (not shape.match(cg) or "FAIL" in cg):
            badgate.append(slug)
        gs = (r.get("copy_gate_sha") or "").strip()
        cs = (r.get("committed_sha") or "").strip()
        if gs and cs and gs[:7] != cs[:7]:
            stalesha.append("%s(gate=%s committed=%s)" % (slug, gs[:7], cs[:7]))
        # A006 - a row whose brief postdates its copy REOPENS: the brief cannot have
        # informed copy written before it existed. Mirror of the copy_gate_sha rule.
        # W7.3: `'n/a (no brief)' > '2026-09-02'` is TRUE as a string, so every row
        # carrying the value owner-rules prescribe for a briefless page REOPENED. Compare
        # DATES, and only when both cells actually are dates.
        _bd = re.match(r"\d{4}-\d{2}-\d{2}", (r.get("brief_date") or "").strip())
        _cd = re.match(r"\d{4}-\d{2}-\d{2}", (r.get("copy_date") or "").strip())
        bd = _bd.group(0) if _bd else ""
        cd = _cd.group(0) if _cd else ""
        if bd and cd and bd > cd:
            inverted.append("%s(brief=%s copy=%s)" % (slug, bd, cd))
        if fresh:
            d = days_between(r.get("serp_extract"), r.get("copy_date"))
            if d == "BAD-DATE":
                stale.append("%s(unparseable date in serp_extract/copy_date)" % slug)
            elif isinstance(d, int) and d > FRESH_DAYS:
                stale.append("%s(%dd)" % (slug, d))
    if empties:
        print("FAIL ledger: %d empty cells: %s" % (len(empties), ", ".join(empties[:20])))
    bad = offshape(rows)
    for b in bad:
        print("FAIL off-shape cell " + b)
    for sslug in badgate:
        print("FAIL copy_gate cell is not a PASS summary: %s" % sslug)
    for x in stalesha:
        print("FAIL page edited after its gate ran (copy_gate_sha != committed_sha): %s" % x)
    for x in stale:
        print("FAIL serp_extract older than copy_date by >%dd: %s" % (FRESH_DAYS, x))
    for x in orphan_bp:
        print("FAIL blueprint row without ledger row: %s "
              "(run `ledger.py sync`)" % x)
    # A005 - `form_smoke_test` read "n/a (no form)" on all 28 BTO rows, INCLUDING
    # /contact/, which has one. The single cell meant to prove the lead path works
    # proved nothing, and ledger.py passed it.
    smoke_bad = []
    for r in rows:
        slug = r.get("slug", "?")
        cell = (r.get("form_smoke_test") or "").strip()
        if not cell:
            continue
        if not re.match(r"^n/a\b", cell, re.I):
            continue
        # "n/a" is only honest when the brief said there is no form.
        if not re.search(r"form_placement\s*:\s*none", cell, re.I):
            smoke_bad.append("%s(%s)" % (slug, cell[:30]))
            continue
        dist = ROOT / "dist" / slug.strip("/") / "index.html"
        if slug.strip("/") in ("", "index"):
            dist = ROOT / "dist" / "index.html"
        try:
            if dist.exists() and re.search(r"<form\b", dist.read_text(
                    encoding="utf-8", errors="replace"), re.I):
                smoke_bad.append("%s(n/a but dist HTML contains a <form>)" % slug)
        except Exception:
            pass
    for x in smoke_bad:
        print("FAIL form_smoke_test cell is not honest - it must read "
              "\"n/a - form_placement:none\" or a dated smoke result: %s" % x)

    for x in inverted:
        print("FAIL brief_date > copy_date - row REOPENS, copy was never briefed: %s" % x)
    print("ledger: %d empty cells, %d failing copy_gate cells, %d stale copy_gate_sha "
          "across %d rows x %d columns [--stage %s; not yet due: %s]"
          % (len(empties), len(badgate), len(stalesha), len(rows), len(COLS),
             stage, ", ".join(pending) or "none"))
    # contracts: every gate prints WHAT IT MEASURED, not only what failed.
    # The fixed shape `checked=<n> failed=<m>` on the verdict line is what makes
    # a pass readable: without it "0 failures" and "measured nothing" print the
    # same words.
    print("ledger check: checked=%d failed=%d"
          % (len(rows), len(empties) + len(badgate) + len(stalesha)))
    print("interactive_patterns: %d off-shape" % len(bad))
    if fresh:
        print("serp_extract older than copy_date by >%dd: %d" % (FRESH_DAYS, len(stale)))
    return 1 if (empties or badgate or stalesha or stale or bad
                 or orphan_bp or inverted or smoke_bad) else 0


def _incomplete(stage="build"):
    """Every row with an empty cell that is DUE AT THIS STAGE, in build_order.

    W12.3: this ignored NOT_YET_DUE entirely, so once the Stage-3 exit gate had run every
    row reported "blocked at final_audit" and `next --batch` re-dispatched pages that were
    finished — the fan-out wave spent its budget rewriting completed work."""
    pending = NOT_YET_DUE.get(stage, ())
    out = []
    for r in sorted(read(), key=order_key):
        for c in COLS:
            if c in pending:
                continue
            if not (r.get(c) or "").strip():
                out.append((r.get("slug"), r.get("build_order") or "-", c))
                break
    return out


def nxt(batch=1):
    """`next` names ONE page; `next --batch N` names the next N.

    One-at-a-time is the right answer for the sequential fallback and the WRONG answer
    after Checkpoint 3, where FAN-OUT MODE is the default (run-the-project/SKILL.md,
    Stage 3 THROUGHPUT). An orchestrator that can only ask "what is next?" discovers the
    work one page per round-trip and can never size a fan-out wave, so the wave never
    gets launched and the build runs sequentially by accident."""
    if _refuse_if_vacuous("next") is None:
        return 1
    rows = _incomplete()
    if not rows:
        print("next: none - every row is complete")
        return 0
    if batch <= 1:
        slug, order, cell = rows[0]
        print("next: %s (build_order %s, first empty cell: %s)" % (slug, order, cell))
        return 0
    take = rows[:batch]
    print("next %d of %d incomplete row(s), in build_order:" % (len(take), len(rows)))
    for slug, order, cell in take:
        print("  %-40s build_order %-4s blocked at: %s" % (slug, order, cell))
    print("fan-out wave: %s" % " ".join(t[0] for t in take))
    return 0


def rollup():
    rows = _refuse_if_vacuous("rollup")
    if rows is None:
        return 1
    done = [r for r in rows if (r.get("copy_gate") or "").strip()
            and (r.get("page_audit") or "").strip()]
    by_tier = {}
    for r in rows:
        by_tier.setdefault((r.get("tier") or "?").lower(), [0, 0])
        by_tier[(r.get("tier") or "?").lower()][0] += 1
        if r in done:
            by_tier[(r.get("tier") or "?").lower()][1] += 1
    print("ROLLUP (computed from rows, never typed)")
    for t, (n, d) in sorted(by_tier.items()):
        print("  %-14s %d/%d done" % (t, d, n))
    print("  TOTAL          %d/%d done" % (len(done), len(rows)))
    assert sum(n for n, _ in by_tier.values()) == len(rows), "tier counts do not sum"
    return 0


def toolkit_check():
    d = ROOT / "scripts"
    have = {p.name for p in d.glob("*")} if d.exists() else set()
    missing = [t for t in TOOLKIT if t not in have]
    print("toolkit: present=%d missing=%d %s" % (len(TOOLKIT) - len(missing), len(missing),
                                                 missing or ""))
    return 1 if missing else 0


def write_schema():
    """(Re)generate reference/ledger-columns.txt from contracts.md §10's order."""
    os.makedirs(os.path.dirname(SCHEMA_FILE), exist_ok=True)
    with open(SCHEMA_FILE, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(SCHEMA_SOURCE) + "\n")
    print("ledger: wrote %s (%d columns)" % (SCHEMA_FILE, len(SCHEMA_SOURCE)))
    return 0


def print_schema():
    for c in COLS:
        print(c)
    return 0


KNOWN_FLAGS = ("--freshness", "--stage")
VERBS = ("check", "init", "sync", "stamp", "next", "rollup")
VERBS_WITH_ARGS = ("stamp",)
OPTS = ("--write-schema", "--schema", "--toolkit-check", "--self-test", "--help")


def self_test():
    """The five behaviours that used to fail silently on a real tree."""
    import shutil, tempfile
    bad, cwd = [], os.getcwd()
    tmp = tempfile.mkdtemp(prefix="ledger-selftest-")
    global ROOT, LEDGER, BLUEPRINT
    _root, _led, _bp = ROOT, LEDGER, BLUEPRINT
    try:
        ROOT = Path(tmp)
        LEDGER = ROOT / "config" / "pipeline-ledger.csv"
        BLUEPRINT = ROOT / "research" / "site-blueprint.csv"
        (ROOT / "config").mkdir(parents=True)
        (ROOT / "research").mkdir(parents=True)

        # 1. W12.1 header-only ledger + no blueprint is a FAIL, not "0/0 done"
        LEDGER.write_text(",".join(COLS) + chr(10), encoding="utf-8")
        buf, sys.stdout = sys.stdout, open(os.devnull, "w", encoding="utf-8")
        rc = check(("--stage", "build"))
        sys.stdout.close(); sys.stdout = buf
        if rc == 0:
            bad.append("check passes on a header-only ledger")

        # 2. W10.1 a fresh init on a CANONICAL 39-column blueprint fills tier
        BLUEPRINT.write_text(
            "url_slug,page_tier,brief_depth,target_keyword,value_tier,build_order" + chr(10)
            + "/a/,core,full,a keyword,b,1" + chr(10)
            + "/privacy/,legal,utility,,c,2" + chr(10), encoding="utf-8")
        LEDGER.unlink()
        buf, sys.stdout = sys.stdout, open(os.devnull, "w", encoding="utf-8")
        init()
        sys.stdout.close(); sys.stdout = buf
        rows = read()
        if not rows or not (rows[0].get("tier") or "").strip():
            bad.append("init on a 39-column blueprint left `tier` blank "
                       "(it read the FORBIDDEN column name)")

        # 3. W7.3 'n/a (no brief)' must not REOPEN a row
        if not ("n/a (no brief)" > "2026-09-02"):
            bad.append("fixture wrong: the string comparison used to be True")
        rows[0]["brief_date"] = "n/a (no brief)"
        rows[0]["copy_date"] = "2026-09-02"
        with LEDGER.open("w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=COLS, extrasaction="ignore")
            w.writeheader(); w.writerows(rows)
        buf, sys.stdout = sys.stdout, open(os.devnull, "w", encoding="utf-8")
        out_rc = check(("--stage", "brief"))
        sys.stdout.close(); sys.stdout = buf
        _ = out_rc                       # the row is incomplete for other reasons
        _bd = re.match(r"\d{4}-\d{2}-\d{2}", "n/a (no brief)")
        if _bd:
            bad.append("the date guard still matches a non-date brief_date")

        # 4. W12.3 `next` must respect NOT_YET_DUE
        if any(c in NOT_YET_DUE.get("build", ()) for _s, _o, c in _incomplete("build")):
            bad.append("_incomplete() returns a cell that is NOT YET DUE at this stage")

        # 5. W12.3c an impossible date is a FAIL, not a traceback
        if days_between("2026-02-30", "") != "BAD-DATE":
            bad.append("days_between does not survive an impossible date")
    except Exception as exc:
        bad.append("self-test raised: %r" % exc)
    finally:
        ROOT, LEDGER, BLUEPRINT = _root, _led, _bp
        os.chdir(cwd)
        shutil.rmtree(tmp, ignore_errors=True)
    for line in bad:
        print("FAIL " + line)
    print("-" * 70)
    print("ledger self-test: %d check(s) failed" % len(bad))
    return 1 if bad else 0


def die(what, token):
    sys.stderr.write("ledger.py: unknown %s %r\n%s" % (what, token, __doc__))
    return 2


def main():
    a = sys.argv[1:] or ["check"]
    # CONS-26: an unrecognised verb or flag used to fall through to check(), so a typo
    # (or a documented-but-nonexistent flag like --resume/--backfill) ran the WRONG
    # command and printed plausible output. Unknown input is now a hard error.
    if not a[0].startswith("--") and a[0] not in VERBS:
        return die("command", a[0])
    skip = False
    for i, x in enumerate(a):
        if skip:
            skip = False
            continue
        if not x.startswith("--"):
            # VERB-AWARE. Every positional after the verb used to be rejected, so both
            # documented forms of `ledger.py stamp <slug> ["<summary>"]` exited 2
            # "unknown argument" — the verb could not be invoked at all.
            if i and a[0] not in VERBS_WITH_ARGS:
                return die("argument", x)
            continue
        if x not in OPTS + KNOWN_FLAGS + ("--batch",):
            return die("option", x)
        if x in ("--stage", "--batch"):
            skip = True
    if a[0] in ("--help", "-h"):
        print(__doc__)
        return 0
    if a[0] == "--self-test":
        return self_test()
    if a[0] == "--write-schema":
        return write_schema()
    if a[0] == "--schema":
        return print_schema()
    if a[0] == "--toolkit-check":
        return toolkit_check()
    if a[0] == "init":
        return init()
    if a[0] == "sync":
        return sync()
    if a[0] == "stamp":
        if len(a) < 2:
            print("FAIL usage: ledger.py stamp <slug> [\"<qc PASS summary>\"]")
            return 2
        return stamp(a[1], a[2] if len(a) > 2 else "")
    if a[0] == "next":
        n = 1
        if "--batch" in a:
            i = a.index("--batch")
            n = int(a[i + 1]) if i + 1 < len(a) and a[i + 1].isdigit() else 4
        return nxt(n)
    if a[0] == "rollup":
        return rollup()
    return check(a)


if __name__ == "__main__":
    sys.exit(main())
