#!/usr/bin/env python
"""sibling_overlap.py - measure how much of each breed page is shared with its 47 siblings.

  python scripts/sibling_overlap.py            # per-page uniqueness, worst first
  python scripts/sibling_overlap.py --blocks   # the shared blocks themselves, biggest first

Measures the BUILT output in dist/puppies/*/index.html, chrome stripped, because the source
files say nothing about what a crawler actually compares. A "block" here is a paragraph-level
text node; a block appearing on many pages is duplication that no amount of unique intro copy
offsets. Lane 2c of the growth plan names this as the largest positional drag.
"""
import argparse
import glob
import html
import os
import re
import sys
from collections import Counter, defaultdict

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

CHROME = re.compile(r"<(header|nav|footer|script|style|svg|aside)\b.*?</\1>", re.S | re.I)
TAG = re.compile(r"<[^>]+>")
BLOCK = re.compile(r"<(p|li|h2|h3)\b[^>]*>(.*?)</\1>", re.S | re.I)
WS = re.compile(r"\s+")
MIN_WORDS = 8


def text_blocks(path):
    raw = open(path, encoding="utf-8", errors="replace").read()
    body = CHROME.sub(" ", raw)
    out = []
    for _, inner in BLOCK.findall(body):
        t = WS.sub(" ", html.unescape(TAG.sub(" ", inner))).strip()
        if len(t.split()) >= MIN_WORDS:
            out.append(t)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--blocks", action="store_true")
    ap.add_argument("--min-pages", type=int, default=5)
    a = ap.parse_args()

    pages = {}
    for f in sorted(glob.glob("dist/puppies/*/index.html")):
        slug = os.path.basename(os.path.dirname(f))
        pages[slug] = text_blocks(f)
    if not pages:
        sys.exit("no built breed pages found; run npm run build first")

    seen = Counter()
    for blocks in pages.values():
        for b in set(blocks):
            seen[b] += 1

    if a.blocks:
        where = defaultdict(list)
        for slug, blocks in pages.items():
            for b in set(blocks):
                where[b].append(slug)
        rows = [(n, b) for b, n in seen.items() if n >= a.min_pages]
        rows.sort(key=lambda r: (-r[0] * len(r[1].split()), -r[0]))
        print("shared blocks on >= %d of %d breed pages, by total duplicated words\n"
              % (a.min_pages, len(pages)))
        for n, b in rows[:30]:
            print("%3d pages x %4d words = %6d  %s" % (n, len(b.split()), n * len(b.split()), b[:110]))
        total_dup = sum(n * len(b.split()) for n, b in rows)
        print("\ntotal duplicated words across the silo: %d" % total_dup)
        return 0

    print("%-32s %6s %7s %7s  %s" % ("breed", "words", "unique", "shared", "uniqueness"))
    scores = []
    for slug, blocks in sorted(pages.items()):
        total = sum(len(b.split()) for b in blocks)
        uniq = sum(len(b.split()) for b in blocks if seen[b] == 1)
        pct = (uniq / total * 100) if total else 0.0
        scores.append((pct, slug, total, uniq))
    scores.sort()
    for pct, slug, total, uniq in scores:
        print("%-32s %6d %7d %7d  %5.1f%%" % (slug, total, uniq, total - uniq, pct))
    avg = sum(s[0] for s in scores) / len(scores)
    print("\nmean uniqueness %.1f%% across %d pages (floor for a template family: 60%%)"
          % (avg, len(scores)))
    below = [s for s in scores if s[0] < 60]
    print("pages below the 60%% floor: %d" % len(below))
    return 0


if __name__ == "__main__":
    sys.exit(main())
