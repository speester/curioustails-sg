#!/usr/bin/env python3

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

"""tiers.py - THE ONE tier vocabulary and THE ONE legacy->canonical map.

reference/contracts.md §1a states the vocabulary; skills/content-writer/SKILL.md
"TIER RESOLUTION" states the normalisation. Before this module existed the map
lived only in prose, so every reader re-implemented it from memory and no two
readers agreed. Anything that needs to turn a legacy tier word into a contract
value imports from HERE. Do not paste a second copy of these tables anywhere.

Public surface:
    PAGE_TIERS, VALUE_TIERS      - the contract vocabularies
    normalize_page_tier(s)       -> (canonical|None, reason)
    resolve_value_tier(...)      -> (letter|None, source)

Both resolvers RETURN None rather than guessing. contracts §1a and gate-classes
§8: a gate that cannot resolve its own input HALTS, it never defaults to the
laxest value. The caller decides what to do with None; this module never
decides for it.

Python 3.9+, stdlib only.
"""

# BLUEPRINT COLUMN ALIASES. contracts §9 names `url_slug` as the canonical slug
# column, and it is - on the canonical 39-column shape. Portfolio-wide it is not
# universal: TheSuperPanel keys its rows on `path` and Oncurio on `slug`.
# verify_page.py read `url_slug` alone and therefore found NO row for any page on
# those two projects, so both tiers came back empty and every page HALTed on a
# tier it could not resolve while the blueprint row beside it was perfectly
# canonical. Read the canonical name FIRST and fall back only when it is absent,
# so a project on a legacy shape is graded rather than skipped - and WARN, so the
# fallback is visible instead of silent.
SLUG_COLS = ("url_slug", "slug", "path", "url")


def slug_of(row):
    """(value, column) for the slug of a blueprint row, canonical name first."""
    for c in SLUG_COLS:
        v = (row.get(c) or "").strip()
        if v:
            return v, c
    return "", ""


# contracts.md §1a - the only page_tier values any gate may read.
PAGE_TIERS = ("core", "outer", "utility", "compare", "monetization", "functional")
VALUE_TIERS = ("A", "B", "C", "D")

# ---------------------------------------------------------------------------
# page_tier: legacy stem -> canonical
# ---------------------------------------------------------------------------
# Byte-for-byte the map in content-writer/SKILL.md TIER RESOLUTION Step 1, plus
# the two values that only ever appear in the blueprint's `section_class` column
# and therefore never reached that skill: `node` and `hub`.
#
# OWNER DECISION 2026-09-04: `section_class: guide` (13 rows portfolio-wide) and
# `section_class: node` (40 rows) both resolve to `outer`. `guide` was already
# in the content-writer map. `node` is not a page type at all - it is a POSITION
# word naming a leaf hanging off a hub - so it carries no tier signal of its
# own. It is mapped to the SAFE WRONG ANSWER: a supporting page mislabelled
# `outer` fails visibly later (a money page with no CTA is obvious to the eye),
# whereas a supporting page mislabelled `core` buries the operator in false
# CTA/schema failures and teaches them to weaken the gate. gate-classes §8:
# twenty failures from one cause is how a gate stops being read.
STEM_TO_PAGE_TIER = {
    # -> core
    "core": "core", "core-hub": "core", "core-guide": "core", "money": "core",
    "money-core": "core", "standard": "core", "pillar": "core",
    "storefront": "core", "home": "core", "service": "core", "item": "core",
    "root": "core", "industry": "core",
    # -> outer
    "outer": "outer", "blog": "outer", "blog-outer": "outer",
    "outer-blog": "outer", "supporting": "outer", "cluster": "outer",
    "guide": "outer", "node": "outer",
    # Legacy stems found only in the four non-standard blueprint shapes
    # (audited 2026-09-04: KM Studio, TheSuperPanel, Oncurio, Pomeranian SG).
    # They live under `tier_name`, `page_type` or `intent`, never under
    # `section_class`, which is why the content-writer map never saw them.
    "informational": "outer", "explainer": "outer", "article": "outer",
    # -> compare
    "comparison": "compare", "comparison-hub": "compare", "compare": "compare",
    "versus": "compare", "vs": "compare", "review": "compare",
    "alternative": "compare",
    # -> monetization
    "monetization": "monetization", "commercial": "monetization",
    "affiliate": "monetization",
    # -> utility
    "utility": "utility", "contact": "utility", "about": "utility",
    "legal": "utility", "thank-you": "utility", "trust": "utility",
    # -> functional
    "functional": "functional", "roster": "functional",
    "availability": "functional",
}

# `hub` is a MODIFIER, not a tier: it implies value_tier A (see
# resolve_value_tier) and contributes nothing to page_tier. It is listed here so
# a compound like `core-hub` can drop it and still resolve on its other part.
MODIFIERS = {"hub", "l1", "l2", "l3", "l4"}

_DEPTH_TO_VALUE = {"l1": "A", "l2": "B", "l3": "C", "l4": "D",
                   "1": "A", "2": "B", "3": "C", "4": "D"}


def _clean(s):
    """Lowercase, strip parenthetical commentary and surrounding punctuation."""
    s = (s or "").strip().lower()
    if "(" in s:                       # `comparison-L2 (80 agg - biggest ...)`
        s = s.split("(", 1)[0].strip()
    return s.strip(" \t-_/")


def normalize_page_tier(literal):
    """Map any legacy tier word to a contracts §1a page_tier.

    Returns (canonical, reason). `canonical` is None when the value cannot be
    resolved - NEVER a fallback. `reason` always names what was read, so the
    caller can print the literal value it could not map.

    A hyphenated compound matches on ANY of its parts and the LEFTMOST winner
    takes it, because these labels are written most-specific-first:
    `money-core` -> core, `comparison-hub` -> compare, `core-guide-L3` -> core.
    """
    raw = literal
    s = _clean(literal)
    if not s:
        return None, "empty"
    if s in PAGE_TIERS:
        return s, "already canonical"
    if s in STEM_TO_PAGE_TIER:
        return STEM_TO_PAGE_TIER[s], "stem %r" % s
    # Compound: split and take the leftmost part that maps to a tier.
    parts = [p for p in s.replace("_", "-").replace("/", "-").split("-") if p]
    for p in parts:
        if p in MODIFIERS:
            continue
        if p in PAGE_TIERS:
            return p, "compound %r -> part %r" % (s, p)
        if p in STEM_TO_PAGE_TIER:
            return STEM_TO_PAGE_TIER[p], "compound %r -> part %r" % (s, p)
    return None, "unmappable %r" % (raw,)


def structural_depth(slug, parent="", parent_of=None):
    """Depth of a row in the silo, counted as a STRUCTURAL FACT, not a guess.

    depth = 1 for the home page; otherwise 1 + the length of the row's ancestor
    chain. The chain is the `parent` column when the blueprint has one, and the
    URL path segments when it does not - a page one segment below the root is a
    child of the home page either way, so the two agree.

    Three of the 29 blueprints (audited 2026-09-04) carry NO depth column at
    all: KM Studio, TheSuperPanel and Oncurio. Their depth is nonetheless
    written down - in `parent`, or in the URL itself. Reading it is not
    inventing it. Callers must still LABEL a value that came from here, because
    it is weaker evidence than an explicit L-code.

    `parent_of` is an optional dict slug -> parent used to walk a real chain;
    without it the chain is one hop.
    """
    s = (slug or "").strip()
    if s in ("/", ""):
        return 1
    p = (parent or "").strip().lower()
    if p and p not in ("root", "/", "-", "home"):
        depth, seen, cur = 2, {s}, (parent or "").strip()
        while parent_of and cur and cur not in seen and depth < 4:
            seen.add(cur)
            nxt = (parent_of.get(cur) or "").strip()
            if not nxt or nxt.lower() in ("root", "/", "-", "home"):
                break
            cur, depth = nxt, depth + 1
        return depth
    if p:                                   # parent is explicitly the root
        return 2
    # No parent column (or an empty cell): count URL segments.
    segs = [x for x in s.strip("/").split("/") if x]
    return min(1 + len(segs), 4) if segs else 1


def resolve_value_tier(hub_or_node="", page_tier_col="", brief_suffix="",
                       section_class="", slug="", parent="", parent_of=None,
                       allow_structural=False):
    """Resolve value_tier (A|B|C|D) from the depth signals a row carries.

    Precedence, per content-writer TIER RESOLUTION Step 2: the brief's own
    depth suffix wins, then the blueprint's `page_tier` column when it holds a
    bare depth NUMBER, then `hub_or_node`. Where two disagree the earlier one
    wins - one real row carries page_tier 2 and hub_or_node L3, a 500-word
    difference in floor, and the tie has to break the same way every time.

    `hub` -> A whatever its depth. `node` in the depth column carries no depth
    of its own: it falls through to whatever other signal the row has, and only
    when the row has none at all does it resolve to C (the plan's stated
    default for a leaf, and the modal depth portfolio-wide: L3 is 872 of 1,196
    rows).

    Returns (letter, source). `letter` is None only when the row carries no
    depth signal in any column AND is not a node/hub.
    """
    for label, val in (("brief suffix", brief_suffix),
                       ("page_tier column", page_tier_col),
                       ("hub_or_node", hub_or_node)):
        s = _clean(val)
        if not s:
            continue
        if s == "hub":
            return "A", "%s=hub (a hub is A whatever its depth)" % label
        if s in _DEPTH_TO_VALUE:
            return _DEPTH_TO_VALUE[s], "%s=%s" % (label, s)
        # A depth suffix inside a compound: `core-guide-L3`, `comparison-L2`.
        for p in s.replace("_", "-").split("-"):
            if p in _DEPTH_TO_VALUE and p.startswith("l"):
                return _DEPTH_TO_VALUE[p], "%s=%s (suffix %r)" % (label, s, p)
    # No depth anywhere. A node or a hub still resolves; anything else does not.
    if _clean(hub_or_node) == "node" or _clean(section_class) == "node":
        return "C", "node with no depth signal (contracts default for a leaf)"
    if _clean(section_class) == "hub":
        return "A", "section_class=hub"
    if allow_structural:
        d = structural_depth(slug, parent, parent_of)
        return _DEPTH_TO_VALUE[str(d)], "STRUCTURAL depth %d (no depth column; " \
            "counted from %s)" % (d, "parent chain" if parent else "url path")
    return None, "no depth signal in brief suffix, page_tier or hub_or_node"


if __name__ == "__main__":
    # A LIBRARY, not a gate - but it is on the shared-instrument path, so it
    # answers the same contract every instrument does: --help is 0, anything
    # else is 2.
    import sys as _sys
    if len(_sys.argv) > 1 and _sys.argv[1] not in ("--help", "-h"):
        _sys.stderr.write("tiers.py is a library, not a command "
                          "(imported by migrate_blueprint.py and by every "
                          "instrument that resolves a tier)" + chr(10))
        _sys.exit(2)
    print(__doc__)
