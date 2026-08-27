#!/usr/bin/env python
"""wire_reviews.py - point every review Carousel at the generated registry.

  python scripts/wire_reviews.py --plan
  python scripts/wire_reviews.py --apply

Replaces the hand-pasted `items={[ ... ]}` array inside each review Carousel with
`items={testimonialsFor('<slug>')}`. Hand-pasted review cards are what produced the
mis-attributions and the 45-pages-per-review concentration; a generated registry removes both.
Only a Carousel whose heading looks like a reviews heading is touched.
"""
import argparse
import glob
import os
import re
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

REVIEWY = re.compile(r"owners say|what owners|review|testimonial", re.I)


def slug_of(path):
    rel = path.replace(os.sep, "/").split("src/pages/")[-1][: -len(".astro")]
    return "index" if rel == "index" else rel


def find_carousels(s):
    """Yield (start, end, heading) for each <Carousel ... /> block."""
    for m in re.finditer(r"<Carousel\b", s):
        i = m.start()
        depth = 0
        j = i
        while j < len(s):
            if s[j] == "<":
                depth += 1
            elif s[j] == ">":
                depth -= 1
                if depth == 0:
                    break
            j += 1
        block = s[i:j + 1]
        hm = re.search(r'heading=(?:"([^"]*)"|\{`([^`]*)`\})', block)
        yield i, j + 1, (hm.group(1) or hm.group(2) if hm else "")


def rewrite(path, apply):
    s = open(path, encoding="utf-8").read()
    slug = slug_of(path)
    changed = 0
    out = s
    for start, end, heading in reversed(list(find_carousels(s))):
        block = s[start:end]
        if "items={[" not in block:
            continue
        if not REVIEWY.search(heading or ""):
            continue
        new_block = re.sub(r"items=\{\[.*?\n(\s*)\]\}",
                           "items={testimonialsFor(%s)}" % repr(slug).replace('"', "'"),
                           block, flags=re.S)
        if new_block == block:
            print("  WARN could not rewrite items in %s" % slug)
            continue
        out = out[:start] + new_block + out[end:]
        changed += 1
    if changed and "testimonialsFor" not in out.split("---")[1]:
        depth = slug.count("/")
        rel = "../" * (depth + 1) + "data/reviews"
        imports = list(re.finditer(r"^import .*?;$", out, re.M))
        if imports:
            last = imports[-1]
            out = out[:last.end()] + "\nimport { testimonialsFor } from '%s';" % rel + out[last.end():]
    if changed and apply:
        open(path, "w", encoding="utf-8", newline="\n").write(out)
    return changed


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--plan", action="store_true")
    a = ap.parse_args()
    total = files = 0
    for f in sorted(glob.glob("src/pages/**/*.astro", recursive=True)):
        n = rewrite(f, a.apply)
        if n:
            files += 1
            total += n
            print("  %-46s %d carousel(s)" % (slug_of(f), n))
    print("%s %d review carousels across %d pages"
          % ("rewrote" if a.apply else "would rewrite", total, files))
    return 0


if __name__ == "__main__":
    sys.exit(main())
