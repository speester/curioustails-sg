#!/usr/bin/env python3
"""blueprint-rows.py — the authoritative row count of research/site-blueprint.csv
(utility rows included, contracts.md §8/§9). --tree prints the URL tree for CP2."""
import argparse
import csv
import os
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
BLUEPRINT = os.path.join("research", "site-blueprint.csv")


def rows(path):
    if not os.path.isfile(path):
        print("FAIL %s not found" % path)
        sys.exit(1)
    # utf-8-SIG: a blueprint saved from Excel carries a BOM, which turns the first
    # header into "﻿url_slug". Every row then read as keywordless and this script
    # printed 0 for a 28-row CSV — a number CP2's URL TREE, retro's "pages vs briefs" and
    # exit-gate letter (a) all consumed as the truth.
    with open(path, encoding="utf-8-sig", errors="replace", newline="") as fh:
        # contracts.md §9: the ONE header names the column `url_slug`. `path`, `tier`,
        # `primary_keyword`, `volume`, `intent` and `build_method` are FORBIDDEN names in
        # every shipped script, so there is no fallback chain to a dead vocabulary and a
        # blueprint that lacks `url_slug` is a validate-blueprint.mjs failure, not a
        # silent zero here (CONS3-2).
        return [r for r in csv.DictReader(fh) if (r.get("url_slug") or "").strip()]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tree", action="store_true")
    ap.add_argument("--path", default=BLUEPRINT)
    args = ap.parse_args()
    data = rows(args.path)
    if not data:
        # A count of zero is never a pass: it means the file is empty, header-only, or
        # keyed on a dead column name.
        print("FAIL %s has 0 rows carrying a url_slug" % args.path)
        return 1
    if args.tree:
        for item in sorted(data, key=lambda r: r.get("url_slug", "")):
            print("%-45s %-12s %s" % (item.get("url_slug", ""),
                                      item.get("page_tier", ""),
                                      item.get("target_keyword", "")))
    # contracts: every gate prints WHAT IT MEASURED, not only what failed.
    # The fixed shape `checked=<n> failed=<m>` on the verdict line is what makes
    # a pass readable: without it "0 failures" and "measured nothing" print the
    # same words.
    print("blueprint-rows: checked=%d failed=0" % len(data))
    return 0


if __name__ == "__main__":
    sys.exit(main())
