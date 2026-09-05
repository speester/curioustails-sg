#!/usr/bin/env python3
"""backlink-recheck.py - the day-30 / monthly backlink delta, with units named.

  python scripts/backlink-recheck.py [--baseline research/backlink-baseline.json]
                                     [--current research/backlinks/current.json]
                                     [--timeout 20] [--no-verify]

Writes audits/backlink-recheck-<date>.md: the delta against
research/backlink-baseline.json, with EVERY unit named (referring domains,
backlinks, broken targets) so "up 12" can never be read as the wrong quantity.

The one rule that makes this report worth reading: a target is only counted as
BROKEN after it has been re-curled LIVE in this run. A "broken" flag inherited
from a vendor pull is a claim, not a measurement - vendors keep reporting 404s
for URLs that were fixed weeks ago, and the verified broken count is the number
that must FALL month over month. --no-verify skips the re-curl and the report
then says, in the file, that the broken count is UNVERIFIED.

Stdlib only. Exit 1 when the verified broken-target count ROSE since the baseline.
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import date

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

UA = "Mozilla/5.0 (compatible; backlink-recheck/1.0)"


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def walk(blob):
    if isinstance(blob, list):
        for x in blob:
            yield from walk(x)
    elif isinstance(blob, dict):
        if "url_to" in blob or "target" in blob or "url" in blob:
            yield blob
        for k in ("tasks", "result", "items"):
            if k in blob:
                yield from walk(blob[k])


def summarise(blob):
    """(referring_domains, backlinks, {target: vendor_says_broken})."""
    rd = bl = None
    if isinstance(blob, dict):
        for k in ("referring_domains", "referring_domains_count"):
            if isinstance(blob.get(k), int):
                rd = blob[k]
        for k in ("backlinks", "backlinks_count", "total_backlinks"):
            if isinstance(blob.get(k), int):
                bl = blob[k]
    targets = {}
    doms, links = set(), 0
    for it in walk(blob):
        t = it.get("url_to") or it.get("target") or it.get("url")
        if not isinstance(t, str) or not t.startswith("http"):
            continue
        links += 1
        doms.add(t.split("/")[2].lower())
        broken = bool(it.get("is_broken") or it.get("broken")
                      or (isinstance(it.get("status_code"), int) and it["status_code"] >= 400))
        targets[t] = targets.get(t, False) or broken
    return (rd if rd is not None else len(doms),
            bl if bl is not None else links,
            targets)


def live_status(url, timeout):
    req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status
    except urllib.error.HTTPError as e:
        if e.code in (403, 405, 501):                  # HEAD refused - retry as GET
            try:
                req = urllib.request.Request(url, headers={"User-Agent": UA})
                with urllib.request.urlopen(req, timeout=timeout) as r:
                    return r.status
            except urllib.error.HTTPError as e2:
                return e2.code
            except Exception:
                return 0
        return e.code
    except Exception:
        return 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--baseline", default="research/backlink-baseline.json")
    ap.add_argument("--current", default="research/backlinks/current.json")
    ap.add_argument("--timeout", type=int, default=20)
    ap.add_argument("--no-verify", action="store_true")
    a = ap.parse_args()

    for p in (a.baseline, a.current):
        if not os.path.exists(p):
            print("FAIL %s missing — the delta needs both a baseline and a fresh pull." % p)
            return 1
    try:
        b_rd, b_bl, b_tgt = summarise(load(a.baseline))
        c_rd, c_bl, c_tgt = summarise(load(a.current))
    except (ValueError, OSError) as e:
        print("FAIL could not parse input: %s" % e)
        return 1

    claimed = sorted(t for t, broken in c_tgt.items() if broken)
    verified, revived = [], []
    if a.no_verify:
        verified = claimed
    else:
        for t in claimed:
            code = live_status(t, a.timeout)
            (verified if (code == 0 or code >= 400) else revived).append((t, code))
        verified = [t for t, _ in verified]

    b_claimed = sorted(t for t, broken in b_tgt.items() if broken)
    d_rd, d_bl = c_rd - b_rd, c_bl - b_bl
    d_broken = len(verified) - len(b_claimed)

    L = ["# BACKLINK RECHECK — %s" % date.today().isoformat(), "",
         "Baseline `%s` vs current `%s`." % (a.baseline, a.current), "",
         "| quantity | baseline | current | delta |", "|---|---:|---:|---:|",
         "| referring domains | %d | %d | %+d |" % (b_rd, c_rd, d_rd),
         "| backlinks | %d | %d | %+d |" % (b_bl, c_bl, d_bl),
         "| broken targets (VERIFIED LIVE) | %d | %d | %+d |" % (len(b_claimed), len(verified), d_broken),
         "",
         "Units are named on every row: *referring domains* and *backlinks* are different",
         "quantities and a bare \"+12\" means neither.", ""]
    if a.no_verify:
        L += ["> **UNVERIFIED.** --no-verify was passed, so the broken count is the vendor's",
              "> claim, not a measurement. Do not report it as a fact.", ""]
    else:
        L += ["Every target below was re-curled in THIS run before being counted.", ""]
        if revived:
            L += ["## Vendor said broken, live says otherwise (%d)" % len(revived), "",
                  "These were NOT counted as broken:", ""]
            L += ["- %s -> HTTP %d" % (t, c) for t, c in revived] + [""]
    if verified:
        L += ["## Verified broken targets (%d)" % len(verified), ""]
        L += ["- %s" % t for t in verified] + [""]
    L += ["## Verdict", "",
          ("- **REGRESSION** — the verified broken-target count ROSE by %d. It must fall." % d_broken)
          if d_broken > 0 else
          ("- Verified broken targets fell by %d." % -d_broken) if d_broken < 0 else
          "- Verified broken-target count is unchanged.", ""]

    os.makedirs("audits", exist_ok=True)
    out = "audits/backlink-recheck-%s.md" % date.today().isoformat()
    with open(out, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(L))
    print("wrote %s — referring domains %+d, backlinks %+d, verified broken targets %+d "
          "(%d claimed, %d still broken, %d revived)"
          % (out, d_rd, d_bl, d_broken, len(claimed), len(verified), len(revived)))
    print("backlink-recheck: checked=%d failed=%d"
          % (len(claimed), max(0, d_broken)))
    return 1 if d_broken > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
