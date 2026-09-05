#!/usr/bin/env python3
"""disavow-gen.py - research/disavow.txt from a DataForSEO referring-domains pull.

  python scripts/disavow-gen.py [--in research/backlinks/referring-domains.json]
                                [--spam-scores research/backlinks/spam-scores.json]
                                [--threshold 20] [--out research/disavow.txt] [--dry-run]

Input is whatever `backlinks_referring_domains` and `backlinks_bulk_spam_score`
wrote, parsed with json.load - never a regex. DataForSEO "rank" is NOT spamminess
and is never read here.

Policy (launch SKILL.md):
  * spam score > threshold (default 20) -> disavow candidate
  * <= threshold -> NEVER over-disavow
  * a domain matching an ALLOW pattern (real businesses, dev blogs, legitimate
    directories) is EXCLUDED and named in the header comment, so the legitimate
    profile gets reclaimed FIRST instead of thrown away
  * `domain:` format, ONE DOMAIN PER LINE

GENERATOR DISCIPLINE: the parsed collection AND the derived output must be
NON-EMPTY before the destination is opened, and any existing non-versioned
disavow.txt is copied to research/disavow-<timestamp>.bak in the same step. A
generator that writes unconditionally turns a parse failure into data loss.
Stdlib only.
"""
import argparse
import json
import os
import re
import shutil
import sys
from datetime import datetime

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Hosts that are legitimate by construction: disavowing them throws away a real
# link. Reclaim these profiles instead.
ALLOW = (
    r"\.gov(\.[a-z]{2})?$", r"\.edu(\.[a-z]{2})?$", r"\.ac\.[a-z]{2}$",
    r"(^|\.)github\.(com|io)$", r"(^|\.)gitlab\.com$", r"(^|\.)stackoverflow\.com$",
    r"(^|\.)stackexchange\.com$", r"(^|\.)medium\.com$", r"(^|\.)wikipedia\.org$",
    r"(^|\.)reddit\.com$", r"(^|\.)linkedin\.com$", r"(^|\.)crunchbase\.com$",
    r"(^|\.)producthunt\.com$", r"(^|\.)news\.ycombinator\.com$",
)
ALLOW_RE = re.compile("|".join(ALLOW), re.I)


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def walk_items(blob):
    """DataForSEO nests results under tasks[].result[].items[]; accept a bare list too."""
    if isinstance(blob, list):
        for x in blob:
            yield from walk_items(x)
        return
    if not isinstance(blob, dict):
        return
    if "domain" in blob or "target" in blob:
        yield blob
    for key in ("tasks", "result", "items"):
        if key in blob:
            yield from walk_items(blob[key])


def host_of(item):
    h = item.get("domain") or item.get("target") or ""
    h = str(h).strip().lower()
    h = re.sub(r"^https?://", "", h).split("/")[0]
    return h[4:] if h.startswith("www.") else h


def spam_of(item):
    for k in ("backlinks_spam_score", "spam_score"):
        v = item.get(k)
        if isinstance(v, (int, float)):
            return float(v)
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="src", default="research/backlinks/referring-domains.json")
    ap.add_argument("--spam-scores", default="research/backlinks/spam-scores.json")
    ap.add_argument("--threshold", type=float, default=20.0)
    ap.add_argument("--out", default="research/disavow.txt")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    if not os.path.exists(a.src):
        print("FAIL input not found: %s (run backlinks_referring_domains first)" % a.src)
        return 1
    try:
        items = list(walk_items(load(a.src)))
    except (ValueError, OSError) as e:
        print("FAIL could not parse %s: %s" % (a.src, e))
        return 1

    scores = {}
    for it in items:
        h, s = host_of(it), spam_of(it)
        if h and s is not None:
            scores[h] = max(s, scores.get(h, s))
    if os.path.exists(a.spam_scores):
        try:
            for it in walk_items(load(a.spam_scores)):
                h, s = host_of(it), spam_of(it)
                if h and s is not None:
                    scores[h] = max(s, scores.get(h, s))
        except (ValueError, OSError) as e:
            print("FAIL could not parse %s: %s" % (a.spam_scores, e))
            return 1

    # ASSERT the parsed collection is non-empty BEFORE opening the destination.
    if not scores:
        print("FAIL parsed 0 domains with a spam score from %s — refusing to write %s "
              "(an empty write is data loss, not a clean slate)" % (a.src, a.out))
        return 1

    over = sorted(h for h, s in scores.items() if s > a.threshold)
    allowed = [h for h in over if ALLOW_RE.search(h)]
    disavow = [h for h in over if h not in set(allowed)]

    print("domains parsed=%d  spam>%g=%d  excluded_as_legitimate=%d  to_disavow=%d"
          % (len(scores), a.threshold, len(over), len(allowed), len(disavow)))
    for h in allowed:
        print("  EXCLUDED (legitimate, reclaim instead): %s (spam %.0f)" % (h, scores[h]))

    if not disavow:
        print("FAIL nothing to disavow above the threshold — refusing to write %s" % a.out)
        return 1
    if a.dry_run:
        for h in disavow:
            print("  domain:%s" % h)
        print("dry-run: %s not written" % a.out)
        return 0

    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    if os.path.exists(a.out):
        bak = "research/disavow-%s.bak" % datetime.now().strftime("%Y%m%d-%H%M%S")
        shutil.copy2(a.out, bak)
        print("backed up existing %s -> %s" % (a.out, bak))

    lines = [
        "# Generated by scripts/disavow-gen.py on %s" % datetime.now().strftime("%Y-%m-%d"),
        "# Source: %s (spam score > %g). DataForSEO 'rank' is NOT spamminess and is not read." % (a.src, a.threshold),
        "# %d domain(s) at or below the threshold were left alone — never over-disavow." % (len(scores) - len(over)),
    ]
    if allowed:
        lines.append("# EXCLUDED as legitimate (reclaim these profiles FIRST, do not disavow):")
        lines += ["#   %s (spam %.0f)" % (h, scores[h]) for h in allowed]
    lines += ["domain:%s" % h for h in disavow]

    with open(a.out, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines) + "\n")
    print("wrote %s (%d domain: lines)" % (a.out, len(disavow)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
