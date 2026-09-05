#!/usr/bin/env python3
"""post-launch-watch.py - the day 7 / 14 / 28 index watch, as a branch verdict per URL.

  python scripts/post-launch-watch.py --day 7
      reads  audits/inspections-day7.json   (GSC URL inspection results)
             audits/analytics-day7.json     (GSC search-analytics rows; optional)
      writes audits/index-watch-day7.md

Every URL gets ONE branch verdict, taken from the launch cadence:
  Discovered - currently not indexed  >= 30% of URLs
      -> host-duplication check (www twins) + internal-link depth/inbound check
         + a fresh Request-Indexing batch
  Crawled - currently not indexed
      -> content-quality pass on that page (`python scripts/verify_page.py <slug>`
         then content-writer)
  impressions on the wrong host
      -> the www->apex redirect is not firing
  sitemap last-downloaded older than the last deploy
      -> resubmit the sitemap index

A due day with no input file exits 1: the evidence cell cannot be filled from memory.
Stdlib only; it performs no network calls - the GSC reads happen through the MCP and
are saved to the two JSON files this reads.
"""
import re
import argparse
import json
import os
import sys
from collections import Counter
from datetime import date

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

DISCOVERED = "discovered"
CRAWLED = "crawled"


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def rows_of(blob, *keys):
    """Accept either a bare list or an object with one of `keys` holding the list."""
    if isinstance(blob, list):
        return blob
    if isinstance(blob, dict):
        for k in keys:
            v = blob.get(k)
            if isinstance(v, list):
                return v
        for v in blob.values():
            if isinstance(v, list) and v and isinstance(v[0], dict):
                return v
    return []


def coverage(rec):
    for k in ("coverage_state", "coverageState", "verdict", "indexing_state"):
        v = rec.get(k)
        if isinstance(v, str) and v.strip():
            return v.strip()
    inner = rec.get("inspection_result") or rec.get("indexStatusResult") or {}
    if isinstance(inner, dict):
        for k in ("coverageState", "coverage_state", "verdict"):
            v = inner.get(k)
            if isinstance(v, str) and v.strip():
                return v.strip()
    return "UNKNOWN"


def url_of(rec):
    for k in ("url", "inspectionUrl", "inspection_url", "page", "keys"):
        v = rec.get(k)
        if isinstance(v, str) and v.strip():
            return v.strip()
        if isinstance(v, list) and v:
            return str(v[0])
    return "(no url)"


def branch(state):
    s = state.lower()
    if "discovered" in s:
        return DISCOVERED, ("host-duplication check (www twins) + internal-link depth/inbound "
                            "check + a fresh Request-Indexing batch")
    if "crawled" in s:
        return CRAWLED, ("content-quality pass on this page: `python scripts/verify_page.py "
                         "<slug>` then content-writer")
    if "submitted and indexed" in s or s.startswith("indexed") or "url is on google" in s:
        return "indexed", "nothing to do"
    return "unknown", "re-inspect: GSC returned no coverage state"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--day", type=int, required=True, choices=(7, 14, 28))
    ap.add_argument("--apex", default="", help="apex host, for the wrong-host check")
    a = ap.parse_args()

    insp = "audits/inspections-day%d.json" % a.day
    anal = "audits/analytics-day%d.json" % a.day
    out = "audits/index-watch-day%d.md" % a.day

    if not os.path.exists(insp):
        print("FAIL %s missing — a due day with no inspection input cannot be reported. "
              "Run the GSC inspections and save them there first." % insp)
        return 1
    try:
        recs = rows_of(load(insp), "inspections", "results", "urls")
    except (ValueError, OSError) as e:
        print("FAIL could not parse %s: %s" % (insp, e))
        return 1
    if not recs:
        print("FAIL %s parsed to 0 rows" % insp)
        return 1

    apex = a.apex.strip()
    if not apex and os.path.exists("config/project-config.md"):
        for line in open("config/project-config.md", encoding="utf-8", errors="replace"):
            if line.startswith("DOMAIN:"):
                apex = re.split(r"\s{2,}#", line.split(":", 1)[1])[0].strip()
                break
    # project-config writes DOMAIN with the scheme ("https://corgi.sg" in all 21 live
    # projects), so a bare substring test against a www URL never matched.
    for pre in ("https://", "http://"):
        if apex.lower().startswith(pre):
            apex = apex[len(pre):]
    apex = apex.strip("/")
    if apex.startswith("www."):
        apex = apex[4:]

    verdicts, counts = [], Counter()
    for r in recs:
        if not isinstance(r, dict):
            continue
        state = coverage(r)
        key, action = branch(state)
        counts[key] += 1
        verdicts.append((url_of(r), state, key, action))

    total = len(verdicts) or 1
    disc_pct = 100.0 * counts[DISCOVERED] / total

    wrong_host = []
    if os.path.exists(anal) and apex:
        try:
            for row in rows_of(load(anal), "rows", "results"):
                if not isinstance(row, dict):
                    continue
                u = url_of(row)
                imp = row.get("impressions") or 0
                if apex and u.lower().startswith("https://www." + apex.lower()) and imp:
                    wrong_host.append((u, imp))
        except (ValueError, OSError) as e:
            print("WARN could not parse %s: %s" % (anal, e))

    L = ["# INDEX WATCH — day %d — %s" % (a.day, date.today().isoformat()), "",
         "Input: `%s`%s" % (insp, (" + `%s`" % anal) if os.path.exists(anal) else
                            " (no analytics file — the wrong-host branch was NOT evaluated)"),
         "", "## Totals", "",
         "| verdict | URLs |", "|---|---|"]
    for k in ("indexed", DISCOVERED, CRAWLED, "unknown"):
        L.append("| %s | %d |" % (k, counts[k]))
    L += ["", "Discovered-not-indexed: **%.0f%%** of %d URLs." % (disc_pct, total), ""]
    if disc_pct >= 30:
        L += ["> **BRANCH FIRED — discovered >= 30%.** Run the host-duplication check (www",
              "> twins), the internal-link depth/inbound check, and a fresh Request-Indexing",
              "> batch before anything else on this list.", ""]
    if wrong_host:
        L += ["> **BRANCH FIRED — impressions on the wrong host.** The www->apex redirect is",
              "> not firing:", ""]
        L += ["> - %s (%s impressions)" % (u, i) for u, i in wrong_host[:10]] + [""]
    L += ["## Per URL", "", "| URL | GSC state | verdict | action |", "|---|---|---|---|"]
    for u, state, key, action in verdicts:
        L.append("| %s | %s | %s | %s |" % (u, state, key, action))
    L += ["", "## Sitemap", "",
          "- [ ] sitemap last-downloaded is NEWER than the last deploy. If it is older,",
          "      resubmit the sitemap index — that is the whole branch.", ""]

    os.makedirs("audits", exist_ok=True)
    with open(out, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(L))
    print("wrote %s — %d URLs; indexed=%d discovered=%d crawled=%d unknown=%d (discovered %.0f%%)"
          % (out, total, counts["indexed"], counts[DISCOVERED], counts[CRAWLED],
             counts["unknown"], disc_pct))
    if wrong_host:
        print("BRANCH: %d URL(s) taking impressions on the www host" % len(wrong_host))
    # contracts section-1b: every gate prints WHAT IT MEASURED, not only
    # what failed - the fixed shape `checked=<n> failed=<m>`.
    print("post-launch-watch: checked=%d failed=%d"
          % (total, counts["unknown"] + len(wrong_host)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
