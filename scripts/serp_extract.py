#!/usr/bin/env python3
"""serp-extract.py - compress a persisted DataForSEO serp_organic_live_advanced
result into research/serp/<slug>.json so the raw pull is never read into context.

  python scripts/serp_extract.py <raw-result.json> research/serp/<slug>.json
Exit 0 on success, 1 when the input has no recognisable items array.
"""
import datetime, json, os, re, sys
from datetime import date
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



def walk(node, want):
    """Yield every dict whose 'type' equals want, at any depth."""
    if isinstance(node, dict):
        if node.get("type") == want:
            yield node
        for v in node.values():
            yield from walk(v, want)
    elif isinstance(node, list):
        for v in node:
            yield from walk(v, want)


def items(root):
    if isinstance(root, dict):
        for key in ("items", "result", "tasks"):
            if key in root:
                yield from items(root[key])
        if root.get("type"):
            yield root
    elif isinstance(root, list):
        for v in root:
            yield from items(v)


def main():
    if any(a in ("--help", "-h") for a in sys.argv[1:]):
        print(__doc__)
        return 0
    bad = [a for a in sys.argv[1:] if a.startswith("-")]
    if bad:
        sys.stderr.write("serp_extract.py: unknown option %s" % ", ".join(bad) + chr(10))
        return 2
    if len(sys.argv) < 3:
        print(__doc__)
        return 2
    src, dst = Path(sys.argv[1]), Path(sys.argv[2])
    raw = json.loads(src.read_text(encoding="utf-8", errors="replace"))
    organic, paa, related, features = [], [], [], set()
    ai_text, ai_cited, snippet, local_pack = "", 0, "", []
    for it in items(raw):
        t = it.get("type")
        if t:
            features.add(t)
        if t == "organic":
            organic.append({"rank": it.get("rank_absolute"), "title": it.get("title"),
                            "domain": it.get("domain"), "url": it.get("url"),
                            "words": (it.get("extra") or {}).get("word_count")})
        elif t == "people_also_ask":
            for q in it.get("items") or []:
                if q.get("title"):
                    paa.append(q["title"])
        elif t == "people_also_ask_element" and it.get("title"):
            paa.append(it["title"])
        elif t == "related_searches":
            related += [x for x in (it.get("items") or []) if isinstance(x, str)]
        elif t == "ai_overview":
            parts = []
            for el in it.get("items") or []:
                if isinstance(el, dict):
                    parts.append(el.get("text") or "")
                    ai_cited += len(el.get("references") or [])
            ai_cited += len(it.get("references") or [])
            ai_text = re.sub(r"\s+", " ", " ".join(parts))[:2000]
        elif t == "featured_snippet":
            # The FORMAT is the whole point: a table snippet and a paragraph snippet ask
            # for different pages. Storing `featured_title or "paragraph"` meant the
            # format was a TITLE when one existed and the literal word "paragraph"
            # otherwise - so the brief's serp_format_verdict was asserted, never derived.
            blob = json.dumps(it).lower()
            if '"table"' in blob or "<table" in blob:
                fmt = "table"
            elif ('"list"' in blob or "<ul" in blob or "<ol" in blob
                  or re.search(r"\b\d+\.\s", str(it.get("description") or ""))):
                fmt = "list"
            else:
                fmt = "paragraph"
            snippet = {"present": True, "format": fmt,
                       "title": it.get("featured_title") or it.get("title") or ""}
        elif t == "local_pack":
            local_pack.append(it.get("rank_absolute"))
    if not organic and not paa:
        print("FAIL no organic/PAA items found in %s" % src)
        return 1
    seen, paa_u = set(), []
    for q in paa:
        if q.lower() not in seen:
            seen.add(q.lower())
            paa_u.append(q)
    # A062 - `measured_on` is when the SERP WAS PULLED, not when it was parsed. Stamping
    # today's date meant re-parsing a six-month-old raw payload reset the freshness clock
    # and every staleness gate downstream read green on stale evidence.
    measured = None
    for t in (raw.get("tasks") or []):
        for r in (t.get("result") or []):
            measured = measured or r.get("datetime")
        measured = measured or t.get("time")
    if not measured:
        try:
            measured = datetime.datetime.fromtimestamp(
                os.path.getmtime(src)).isoformat(timespec="seconds")
        except Exception:
            measured = None
    if not measured:
        print("FAIL cannot determine when %s was pulled - measured_on would be a guess, "
              "and the freshness gate reads it" % src)
        return 1
    out = {"extracted_on": date.today().isoformat(),
           "measured_on": str(measured)[:19],         # read by the freshness gate
           "source_file": str(src),
           "organic": organic[:10], "paa": paa_u, "related_searches": related[:12],
           "serp_features": sorted(features),
           "ai_overview": {"present": bool(ai_text), "cited_source_count": ai_cited,
                           "text": ai_text},
           "featured_snippet": snippet,
           "local_pack": {"present": bool(local_pack), "positions": sorted(p for p in local_pack if p)}}
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    print("serp_extract %s: organic=%d paa=%d related=%d ai_overview=%s(%d cited) "
          "featured=%s local_pack=%s"
          % (dst.stem, len(out["organic"]), len(paa_u), len(out["related_searches"]),
             "present" if ai_text else "none", ai_cited, snippet or "none",
             "yes" + str(out["local_pack"]["positions"]) if local_pack else "no"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
