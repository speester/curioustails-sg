#!/usr/bin/env python3
"""refresh-prices.py - re-read every "read <D Month YYYY>" stamped figure.

  python scripts/refresh_prices.py --check [--max-age 90]   # audit only
  python scripts/refresh_prices.py [--max-age 90]           # re-stamp readable sources
Stdlib only. Exit 0 when no stamp is older than --max-age and none is unreadable.
"""
import os, re, sys, urllib.error, urllib.request
from datetime import date, datetime
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
SRC = ROOT / "src"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")
STAMP = re.compile(r"read\s+(\d{1,2})\s+([A-Z][a-z]+)\s+(20\d{2})")
SOURCE = re.compile(r'(?:sourceHref|source_url|href)\s*[:=]\s*["\'](https?://[^"\']+)["\']')
MONTHS = {m: i for i, m in enumerate(
    ["January", "February", "March", "April", "May", "June", "July", "August",
     "September", "October", "November", "December"], 1)}
BLOCKED = {400, 401, 403, 405, 406, 429, 999}


def files():
    if not SRC.exists():
        return []
    return [p for p in SRC.rglob("*")
            if p.is_file() and p.suffix in (".astro", ".ts", ".tsx", ".js", ".mjs", ".json", ".md")]


def probe(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=45) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception:
        return 0


KNOWN_FLAGS = ("--check", "--max-age")


def _approved_on_past(line):
    """approved_on must be a real date that is NOT in the future.

    Every other approval in the pipeline (checkpoint.py::_waiver_ok) requires
    `on <= today`; without it, `approved_on: 2099-01-01` bought a permanent exemption.
    """
    m = re.search(r'approved_on:\s*(20[0-9][0-9]-[01][0-9]-[0-3][0-9])', line)
    return bool(m) and m.group(1) <= date.today().isoformat()


def main():
    if any(a in ("--help", "-h") for a in sys.argv[1:]):
        print(__doc__)
        return 0
    argv = sys.argv[1:]
    # An unknown flag used to fall through to the MUTATING default: `--chek` did not
    # audit, it re-stamped every stale price to today's date. A typo in a gate command
    # must never become a silent write, and never a silent PASS.
    unknown = [a for a in argv
               if a.startswith("-") and a.split("=")[0] not in KNOWN_FLAGS]
    if unknown:
        print("refresh_prices.py: unknown option " + ", ".join(unknown),
              file=sys.stderr)
        print(__doc__, file=sys.stderr)
        return 2
    check = "--check" in argv
    # A gate that measures nothing must never report PASS. With no src/ (wrong cwd)
    # this printed "stamped figures=0 stale>90d: 0" and exited 0, so Stage-3 exit-gate
    # item (b) went green on an empty tree. "0 stamped figures inside a real src/" is
    # a legitimate answer; "no src/ at all" is not.
    if not SRC.exists():
        print("HALT: src/ missing - run from PROJECT_ROOT (looked in %s)" % (SRC,))
        return 1
    # `--max-age=30` satisfied the unknown-flag check (which splits on "=") and was
    # then ignored here, so a tightened window silently ran at the 90-day default.
    # A bare trailing `--max-age` also raised IndexError instead of a usage error.
    max_age = 90
    for i, a in enumerate(argv):
        if a.startswith("--max-age="):
            val = a.split("=", 1)[1]
        elif a == "--max-age":
            if i + 1 >= len(argv):
                print("refresh_prices.py: --max-age needs a number", file=sys.stderr)
                return 2
            val = argv[i + 1]
        else:
            continue
        if not val.isdigit():
            print("refresh_prices.py: --max-age needs a number, got %r" % val,
                  file=sys.stderr)
            return 2
        max_age = int(val)
    today = date.today()
    total = stale = unreadable = rewritten = 0
    for f in files():
        text = f.read_text(encoding="utf-8", errors="replace")
        urls = SOURCE.findall(text)
        out, changed = text, False
        for m in STAMP.finditer(text):
            total += 1
            try:
                d = date(int(m.group(3)), MONTHS.get(m.group(2), 1), int(m.group(1)))
            except ValueError:
                d = date(2000, 1, 1)
            age = (today - d).days
            if age <= max_age:
                continue
            stale += 1
            url = urls[0] if urls else ""
            status = probe(url) if url else 0
            if status and 200 <= status < 300:
                if not check:
                    new = "read %d %s %d" % (today.day,
                                             list(MONTHS)[today.month - 1], today.year)
                    out = out.replace(m.group(0), new)
                    changed = True
                    rewritten += 1
                print("refresh %s: %s -> re-read %s (HTTP %d, age was %dd)"
                      % (f.name, m.group(0), url, status, age))
            else:
                unreadable += 1
                print('FAIL %s: %s unreadable at source (HTTP %s%s) - the page must print '
                      '"pricing could not be verified at source on %s" and NO number'
                      % (f.name, url or "(no source url)", status,
                         ", blocked" if status in BLOCKED else "", today.isoformat()))
        if changed and not check:
            f.write_text(out, encoding="utf-8")
    print("stamped figures=%d stale>%dd: %d unreadable=%d re-stamped=%d"
          % (total, max_age, stale, unreadable, rewritten))
    # contracts: every gate prints WHAT IT MEASURED, not only what failed.
    # The fixed shape `checked=<n> failed=<m>` on the verdict line is what makes
    # a pass readable: without it "0 failures" and "measured nothing" print the
    # same words.
    print("refresh_prices: checked=%d failed=%d" % (total, stale + unreadable))
    if check and total == 0:
        # Zero stamped figures on a real tree is not a clean bill of health: it means
        # no writer ever stamped a "read <D Month YYYY>" figure, so the staleness gate
        # measured nothing. Same shape as the zero-route defect in check-related.mjs.
        # A site with genuinely no volatile figures is a real case, so it gets an
        # EXPLICIT, owner-visible declaration rather than a silent pass.
        cfg = ROOT / "config" / "project-config.md"
        declared = False
        if cfg.exists():
            # Held to the same standard as every other exemption hardened on
            # 2026-09-04: a bare word the build session can type is not a decision.
            txt = cfg.read_text(encoding='utf-8', errors='replace')
            for line in txt.splitlines():
                if not re.match(r'(?i)^VOLATILE_FIGURES:', line):
                    continue
                declared = bool(
                    re.search(r'(?i)VOLATILE_FIGURES:\s*none', line)
                    and re.search(r'(?i)approved_by:\s*owner', line)
                    and _approved_on_past(line))
                break
        if declared:
            print("0 stamped figures; VOLATILE_FIGURES: none is declared in "
                  "config/project-config.md - nothing to age.")
            return 0
        print("HALT refresh_prices: 0 stamped figures found, so this gate measured an "
              "empty set. Either the stamps were never written, or this site has no "
              "volatile figures - in which case put this ONE LINE in "
              "config/project-config.md so the exemption is on the record:\n"
              "  VOLATILE_FIGURES: none approved_by: owner approved_on: "
              + date.today().isoformat())
        return 1
    return 1 if (unreadable or (check and stale)) else 0


if __name__ == "__main__":
    sys.exit(main())
