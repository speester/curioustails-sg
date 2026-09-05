#!/usr/bin/env python3
"""kit:exemptions@1.0.0 — THE figure/quote/Sources exemption predicate. ONE implementation.

contracts.md §3 says verify_page.py, audit_built_html.py and ledger.py implement the
IDENTICAL predicate. They did not: verify_page.py exempted a page whose page_tier was
`utility`, ledger.py exempted by tier column, and audit_built_html.py + check-quotes.mjs
matched a route TAIL against their own five-name tuple. The consequence was structural,
not cosmetic: /about/ and /contact/ passed letter (h) and failed letters (d) and (e) on
every site, so the Stage 3 exit gate could never go green.

THREE STATES (owner decision 2026-09-02, contracts §3 as written):

  full     the content-route floor: >= 2 figures, >= 1 interactive, >= 1 expert quote,
           a Sources block. Every content route, INCLUDING /about/ - an about page is
           where E-E-A-T is argued, so it carries the full floor whatever tier it was
           filed under.
  partial  /contact/ only: EXACTLY ONE non-interactive figure, placed below the form.
           An interactive figure beside a form is a distraction, so the interactive
           requirement inverts into a ceiling. No quote and no Sources block are due.
  exempt   404 / thank-you / privacy / terms, anything named in the project's
           FIGURE_EXEMPT_ROUTES / QUOTE_EXEMPT_ROUTES, and any row that is genuinely
           utility (page_tier utility|legal, brief_depth utility, or a deliberately
           keywordless blueprint row). No floor at all.

The route decides before the tier does: /about/ and /contact/ are named routes with a
stated policy, and a tier column cannot quietly downgrade them.
"""
import re

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


UTILITY_ROUTES = ("404", "thank-you", "thankyou", "privacy", "terms")
# contracts §1a declares page_tier `functional` ("every instrument keys its exemption on
# THIS tier value") and no consumer knew the word, so a functional roster row was
# classified `full` and owed 2 figures, a quote and a Sources block.
UTILITY_TIERS = ("utility", "legal", "functional")
FULL_ROUTES = ("about", "about-us")
PARTIAL_ROUTES = ("contact", "contact-us")

FULL = "full"
PARTIAL = "partial"
EXEMPT = "exempt"

# state -> (minimum figures, minimum interactive figures, maximum interactive figures)
FIGURE_FLOOR = {FULL: (2, 1, None), PARTIAL: (1, 0, 0), EXEMPT: (0, 0, None)}


def _tail(slug):
    return (slug or "").strip("/").split("/")[-1].lower()


def _extras(cfg, key):
    """The routes named by a *_EXEMPT_ROUTES config key.

    TWO ENTRY FORMATS, ONE PARSER. `validate_config.py` accepts (and the owner-rules
    prescribe) `<route> = <reason> (<date>)`; both predicates used to store the WHOLE
    string, so an exemption that passed the config gate exempted nothing. Take the text
    left of the first `=`, then normalise.
    """
    if not cfg or not key:
        return []
    out = []
    # The JS half splits on a bare "#"; this half split on two-or-more spaces then
    # "#", so `roster # generated grid, no prose` yielded a different route set in
    # python than in node - one instrument treated a route as exempt and the other
    # demanded figures, quote and Sources on it. One predicate means one split.
    for raw in re.split(r"[,;]", re.split(r"\s*#", cfg.get(key, "") or "")[0]):
        route = raw.split("=")[0].strip().strip("/").lower()
        if not route or route.startswith("none"):
            continue
        out.append(route)
    return out


def exemption(slug, cfg=None, key=None, tier="", brief_depth="", has_keyword=True):
    """-> "full" | "partial" | "exempt". Every instrument calls THIS, never its own list."""
    tail = _tail(slug)
    whole = (slug or "").strip("/").lower()
    if tail in FULL_ROUTES:
        return FULL
    if tail in PARTIAL_ROUTES:
        return PARTIAL
    if tail in UTILITY_ROUTES:
        return EXEMPT
    extras = _extras(cfg, key)
    if whole in extras or tail in extras:
        return EXEMPT
    if (tier or "").strip().lower() in UTILITY_TIERS:
        return EXEMPT
    if (brief_depth or "").strip().lower() == "utility":
        return EXEMPT
    if not has_keyword:
        return EXEMPT
    return FULL


# The blueprint column names contracts §9 declares. `path` and `tier` are FORBIDDEN
# names — reading them yields '' on a canonical 39-column blueprint, so an exemption
# keyed on them is keyed on an empty cell.
def exemption_for(slug, cfg=None, key=None, row=None):
    """The row-aware entry point. Use this wherever a blueprint row is in hand.

    HONEST STATUS, audited 2026-09-04: this function is NOT yet what every instrument
    calls. It has no callers. `verify_page.py:393/395` passes tier/depth/keyword by
    hand (equivalent, and correct); `audit_built_html.py:56/472` and `ledger.py:108`
    still pass the route alone, so a keywordless or utility ROW that is not also a
    utility ROUTE is exempt in letters (h)/(n) and graded in (d)/(f)/(j). That is
    latent rather than live on the projects on disk, which satisfy both floors anyway.
    Do not restate the "one entry point" claim until the three route-only call sites
    pass `row=` - a docstring asserting a convergence that has not happened is how the
    divergence stays invisible. `row` is the blueprint row; everything is read from it
    here.
    """
    row = row or {}
    return exemption(
        slug, cfg, key,
        tier=(row.get("page_tier") or "").strip(),
        brief_depth=(row.get("brief_depth") or "").strip(),
        has_keyword=bool((row.get("target_keyword") or "").strip())
        if "target_keyword" in row else True,
    )


def is_exempt(slug, cfg=None, key=None, **kw):
    """Back-compatible boolean for the gates that only ever asked yes/no."""
    return exemption(slug, cfg, key, **kw) == EXEMPT


def figure_floor(state):
    """(min figures, min interactive, max interactive) for a state from exemption()."""
    return FIGURE_FLOOR[state]


if __name__ == "__main__":
    # A LIBRARY, not a gate — but it is on the shared-instrument path, so it answers the
    # same contract every instrument does: --help is 0, anything else is 2.
    import sys as _sys
    if len(_sys.argv) > 1 and _sys.argv[1] not in ("--help", "-h"):
        _sys.stderr.write("exemptions.py is a library, not a command "
                          "(imported by verify_page.py, audit_built_html.py, ledger.py "
                          "and the .mjs twin lib/exemptions.mjs)" + chr(10))
        _sys.exit(2)
    print(__doc__)
