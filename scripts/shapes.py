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

"""shapes.py - THE ONE shape-tolerant accessor layer for brief and blueprint data.

A brief and a blueprint are DATA THIS PIPELINE ITSELF WROTE. They are produced
by generators, edited by agents and hand-corrected by owners, so every field can
arrive in a shape its reader did not expect. A gate must be able to FAIL its own
upstream, which means it has to survive READING it.

Measured 2026-09-05 by `fixtures/test_malformed.py`: seven of fifteen corrupted
shapes killed an instrument outright, and in every case the instrument produced
NO VERDICT AT ALL rather than a failing one. In a pipeline whose gate output is
pasted into an artifact, an absent verdict reads as "not run yet", not as "your
data is wrong" - which is strictly worse than a wrong answer.

USE THESE INSTEAD OF `x.get(...)` AND `len(x)` on anything read off disk:

    as_dict(x)   -> x if it is a dict, else {}
    as_list(x)   -> x if it is a list, [] for None/scalars, [x] for a lone dict
    dicts(x)     -> as_list(x) keeping only the dict members - what every
                    "for row in ..." loop over brief data actually wants
    as_int(x, d) -> int(x) where that is meaningful, else d
    as_text(x)   -> a stripped string, never None

None of these HIDE a defect: they hand the caller an empty container so the
caller's own check ("outline count 0 sections, depth=full wants 25-35") fires
and names the real problem. That is the difference between a gate that fails
bad data and a gate that dies on it.

Python 3.9+, stdlib only.
"""


def as_dict(x):
    """The mapping x claims to be, or an empty one."""
    return x if isinstance(x, dict) else {}


def as_list(x):
    """The sequence x claims to be.

    A lone dict becomes a one-item list, because `field: {...}` where a list of
    one was meant is the single commonest generator slip. A string is NOT
    exploded into characters - that turns one bad field into a thousand bogus
    rows, which is how a tolerant reader becomes a lying one.
    """
    if isinstance(x, list):
        return x
    if isinstance(x, tuple):
        return list(x)
    if isinstance(x, dict):
        return [x]
    return []


def dicts(x):
    """as_list(x), keeping only the members that are actually mappings."""
    return [i for i in as_list(x) if isinstance(i, dict)]


def as_int(x, default=None):
    try:
        if isinstance(x, bool):
            return default
        return int(float(x))
    except (TypeError, ValueError):
        return default


def as_text(x):
    if x is None:
        return ""
    if isinstance(x, (list, tuple, dict)):
        return ""
    return str(x).strip()


def load_json(path, on_error=None):
    """Read a JSON document, returning `on_error` instead of raising.

    A truncated or half-written brief is a real state on disk - an interrupted
    generator leaves one every time - and `json.loads` raising out of a gate's
    main loop takes the whole run down with it.
    """
    import json
    try:
        with open(str(path), encoding="utf-8", errors="replace") as f:
            return json.load(f)
    except Exception:                                          # noqa: BLE001
        return {} if on_error is None else on_error


def cell(v):
    """A CSV cell as a stripped string, whatever DictReader handed us.

    A row with MORE fields than the header lands under DictReader's restkey
    (None) as a LIST, and the near-universal `(v or "").strip()` raises
    AttributeError on it - taking the whole gate down over one stray comma in
    one row. A ragged row is a real thing an owner produces by typing a comma
    into a notes field, so it must be REPORTED, never fatal.
    """
    if isinstance(v, (list, tuple)):
        return " ".join(as_text(x) for x in v).strip()
    return as_text(v)


def csv_rows(path, ragged=None):
    """[{col: text}] from a CSV, BOM-tolerant and ragged-tolerant.

    `ragged` (optional list) collects the key of every row that carried more
    fields than the header, so the caller can report them.
    """
    import csv as _csv
    out = []
    try:
        with open(str(path), newline="", encoding="utf-8-sig",
                  errors="replace") as f:
            for r in _csv.DictReader(f):
                if None in r and ragged is not None:
                    ragged.append(cell(r.get("url_slug")) or "(no url_slug)")
                out.append({k: cell(v) for k, v in r.items() if k is not None})
    except OSError:
        return []
    return out


if __name__ == "__main__":
    # A LIBRARY, not a gate - but it is on the shared-instrument path, so it
    # answers the same contract every instrument does: --help is 0, anything
    # else is 2.
    import sys as _sys
    if len(_sys.argv) > 1 and _sys.argv[1] not in ("--help", "-h"):
        _sys.stderr.write("shapes.py is a library, not a command "
                          "(imported by verify_page.py and validate_brief.py)"
                          + chr(10))
        _sys.exit(2)
    print(__doc__)
