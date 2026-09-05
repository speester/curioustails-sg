#!/usr/bin/env python3
"""gsc-inspect-table.py - the per-URL Request-Indexing table, in priority order.

  python scripts/gsc-inspect-table.py [--property sc-domain:example.sg]
                                      [--inspections audits/inspections-day7.json]
                                      [--per-day 12] [--out audits/indexing-<date>.md]

Request Indexing is the ONE click the Search Console API cannot do. So launch Step 8
and every indexing session END with this table: one row per URL, each carrying the
GSC inspect deep link, in the priority order the cadence sets --

    home (only if its coverage is stale/not-indexed) -> hubs -> win-now -> rest

capped at --per-day (10-12) because that is the daily submission budget. Links come
from a saved inspection result's `inspection_result_link` when one exists; otherwise
the deep link is constructed from the property and the URL, which is the same page.

URLs and their tiers come from research/site-blueprint.csv (page_tier / hub_or_node /
value_tier); nothing is invented. Stdlib only, no network: the GSC reads happen
through the MCP and are saved to the inspections JSON this reads.
"""
import re
import argparse
import csv
import json
import os
import sys
from datetime import date
from urllib.parse import quote

sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def cfg(key, default=""):
    p = "config/project-config.md"
    if not os.path.exists(p):
        return default
    for line in open(p, encoding="utf-8", errors="replace"):
        if line.startswith(key + ":"):
            return re.split(r"\s{2,}#", line.split(":", 1)[1])[0].strip() or default
    return default


def host(raw):
    """DOMAIN is written with a scheme in some project configs ("https://corgi.sg"),
    which built https://https://corgi.sg/ into every link. Normalise it here."""
    h = (raw or "").strip()
    for pre in ("https://", "http://"):
        if h.lower().startswith(pre):
            h = h[len(pre):]
    return h.strip("/")


def canon(domain, slug):
    """The canonical served form: absolute, and trailing-slash unless it is a file."""
    s = slug if slug.startswith("/") else "/" + slug
    last = s.rstrip("/").split("/")[-1]
    if "." not in last and not s.endswith("/"):
        s += "/"
    return "https://%s%s" % (domain, s)


def deep_link(prop, url, saved):
    if saved:
        return saved
    return ("https://search.google.com/search-console/inspect?resource_id=%s&id=%s"
            % (quote(prop, safe=""), quote(url, safe="")))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--property", default="")
    ap.add_argument("--inspections", default="")
    ap.add_argument("--per-day", type=int, default=12)
    ap.add_argument("--out", default="")
    a = ap.parse_args()

    domain = host(cfg("DOMAIN"))
    prop = a.property or cfg("GSC_PROPERTY") or (("sc-domain:" + domain) if domain else "")
    if prop.startswith("sc-domain:"):
        prop = "sc-domain:" + host(prop.split(":", 1)[1])
    if not prop:
        print("FAIL no GSC property: pass --property or set DOMAIN/GSC_PROPERTY in "
              "config/project-config.md")
        return 1
    if not domain:
        print("FAIL DOMAIN not set in config/project-config.md — the table needs absolute URLs")
        return 1

    bp = "research/site-blueprint.csv"
    if not os.path.exists(bp):
        print("FAIL %s missing — the priority order comes from the blueprint, not from memory" % bp)
        return 1

    rows = []
    with open(bp, newline="", encoding="utf-8-sig", errors="replace") as f:
        for r in csv.DictReader(f):
            slug = (r.get("url_slug") or "").strip()
            if not slug:
                continue
            rows.append({
                "url": canon(domain, slug),
                "slug": slug,
                "tier": (r.get("page_tier") or "").strip().lower(),
                "hub": (r.get("hub_or_node") or "").strip().lower(),
                "value": (r.get("value_tier") or "").strip().upper(),
            })
    if not rows:
        print("FAIL %s parsed to 0 rows" % bp)
        return 1

    states, links = {}, {}
    if a.inspections:
        if not os.path.exists(a.inspections):
            print("FAIL --inspections file not found: %s" % a.inspections)
            return 1
        try:
            blob = json.load(open(a.inspections, encoding="utf-8"))
        except (ValueError, OSError) as e:
            print("FAIL could not parse %s: %s" % (a.inspections, e))
            return 1
        stack = [blob]
        while stack:
            x = stack.pop()
            if isinstance(x, list):
                stack.extend(x)
            elif isinstance(x, dict):
                u = x.get("url") or x.get("inspectionUrl") or x.get("inspection_url")
                if isinstance(u, str) and u.startswith("http"):
                    inner = x.get("inspection_result") or {}
                    st = (x.get("coverage_state") or x.get("coverageState")
                          or (inner.get("coverageState") if isinstance(inner, dict) else None))
                    if st:
                        states[u] = str(st)
                    ln = x.get("inspection_result_link") or x.get("inspectionResultLink")
                    if ln:
                        links[u] = ln
                stack.extend(v for v in x.values() if isinstance(v, (list, dict)))

    def indexed(u):
        s = states.get(u, "").lower()
        return "indexed" in s and "not indexed" not in s

    home = [r for r in rows if r["slug"] in ("/", "")]
    hubs = [r for r in rows if r not in home and (r["hub"] == "hub" or r["tier"] == "core")]
    winnow = [r for r in rows if r not in home and r not in hubs and r["value"] in ("A", "B")]
    rest = [r for r in rows if r not in home and r not in hubs and r not in winnow]

    ordered = []
    # home goes first ONLY when it is stale or not indexed; a fresh home wastes the click
    for r in home:
        if not states or not indexed(r["url"]):
            ordered.append((r, "home (coverage stale or not indexed)"))
    for r in hubs:
        ordered.append((r, "hub"))
    for r in winnow:
        ordered.append((r, "win-now (value %s)" % (r["value"] or "?")))
    for r in rest:
        ordered.append((r, "rest"))
    if states:
        ordered = [(r, why) for r, why in ordered if not indexed(r["url"])]

    today = ordered[:a.per_day]
    out = a.out or ("audits/indexing-%s.md" % date.today().isoformat())

    L = ["# REQUEST-INDEXING TABLE — %s" % date.today().isoformat(), "",
         "Property `%s`. Request Indexing is the one click the API cannot do: these links" % prop,
         "open the GSC inspect page for each URL — click **Request Indexing** on each.",
         "Daily budget: %d URLs." % a.per_day, ""]
    if not states:
        L += ["> No inspection results were supplied (`--inspections`), so no URL could be",
              "> skipped as already-indexed. The order is still correct; the list is longer",
              "> than it needs to be.", ""]
    L += ["| # | URL | why it is in this position | GSC state | inspect link |",
          "|---:|---|---|---|---|"]
    for i, (r, why) in enumerate(today, 1):
        L.append("| %d | %s | %s | %s | %s |"
                 % (i, r["url"], why, states.get(r["url"], "unknown"),
                    deep_link(prop, r["url"], links.get(r["url"]))))
    L += ["", "Queued for the following days: %d URL(s)." % max(0, len(ordered) - len(today)), "",
          "Copy these rows into `audits/OPEN-ITEMS.md` under **OWNER-ONLY** — they are",
          "owner clicks, not session work.", ""]

    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    with open(out, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(L))
    print("wrote %s — %d URL(s) today, %d queued (of %d blueprint rows)"
          % (out, len(today), max(0, len(ordered) - len(today)), len(rows)))
    # contracts section-1b: every gate prints WHAT IT MEASURED, not only
    # what failed - the fixed shape `checked=<n> failed=<m>`.
    print("gsc-inspect-table: checked=%d failed=0" % len(rows))
    return 0


if __name__ == "__main__":
    sys.exit(main())
