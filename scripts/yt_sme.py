#!/usr/bin/env python
"""yt_sme.py - YouTube expert sourcing for sme-extract, without pulling raw text into context.

  python scripts/yt_sme.py search "<query>" [location]      # compact candidate table
  python scripts/yt_sme.py info <video_id>                  # title/channel/date for attribution
  python scripts/yt_sme.py subs <video_id> <slug>           # -> sme/raw/<slug>-transcript.txt (timestamped)
  python scripts/yt_sme.py grep <slug> <regex> [ctx]        # search a saved transcript, print hits with hh:mm:ss
"""
import json
import os
import re
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.path.insert(0, os.path.join(os.path.expanduser("~"), ".claude", "scripts"))
from dfs import call  # noqa: E402

RAW = os.path.join("sme", "raw")


def hhmmss(sec):
    sec = int(float(sec or 0))
    return "%02d:%02d:%02d" % (sec // 3600, (sec % 3600) // 60, sec % 60)


def search(q, location="Singapore"):
    d = call("serp/youtube/organic/live/advanced",
             [{"keyword": q, "location_name": location, "language_code": "en", "block_depth": 20}])
    items = (d["tasks"][0]["result"][0].get("items") or [])
    print("rank | id | cc | mins | views | channel | title")
    for it in items:
        if it.get("type") != "youtube_video":
            continue
        badges = it.get("badges") or []
        print("%2s | %-12s | %-3s | %4d | %8s | %-28s | %s" % (
            it.get("rank_absolute"), it.get("video_id"),
            "CC" if "CC" in badges else "-",
            round((it.get("duration_time_seconds") or 0) / 60),
            it.get("views_count"), (it.get("channel_name") or "")[:28],
            (it.get("title") or "")[:70]))


def info(vid):
    d = call("serp/youtube/video_info/live/advanced",
             [{"video_id": vid, "location_name": "Singapore", "language_code": "en"}])
    items = (d["tasks"][0]["result"][0].get("items") or [])
    for it in items:
        print(json.dumps({k: it.get(k) for k in
                          ("title", "channel_name", "channel_url", "publication_date",
                           "views_count", "duration_time", "subtitles")}, ensure_ascii=False)[:1200])


def subs(vid, slug):
    d = call("serp/youtube/video_subtitles/live/advanced",
             [{"video_id": vid, "location_name": "Singapore", "language_code": "en",
               "subtitles_language": "en"}])
    res = (d["tasks"][0].get("result") or [{}])[0]
    items = res.get("items") or []
    lines = []
    for it in items:
        txt = (it.get("text") or "").replace("\n", " ").strip()
        if txt:
            lines.append("[%s] %s" % (hhmmss(it.get("start_time")), txt))
    if not lines:
        print("NO CAPTIONS for %s (%s)" % (vid, json.dumps(res)[:300]))
        return 1
    os.makedirs(RAW, exist_ok=True)
    path = os.path.join(RAW, slug + "-transcript.txt")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    words = sum(len(l.split()) for l in lines)
    print("saved %s  lines=%d words=%d  span=%s..%s" %
          (path, len(lines), words, lines[0][:10], lines[-1][:10]))
    return 0


def grep(slug, pattern, ctx=0):
    path = os.path.join(RAW, slug + "-transcript.txt")
    lines = open(path, encoding="utf-8").read().splitlines()
    rx = re.compile(pattern, re.I)
    ctx = int(ctx)
    for i, l in enumerate(lines):
        if rx.search(l):
            for j in range(max(0, i - ctx), min(len(lines), i + ctx + 1)):
                print(lines[j])
            if ctx:
                print("--")


def flow(slug, width=32):
    """Reflow caption fragments into ~`width`-word blocks with a start timestamp."""
    path = os.path.join(RAW, slug + "-transcript.txt")
    out_dir = os.path.join("sme", "flow")
    os.makedirs(out_dir, exist_ok=True)
    blocks, cur, ts = [], [], None
    seen = set()
    for line in open(path, encoding="utf-8"):
        m = re.match(r"\[(\d\d:\d\d:\d\d)\] (.*)", line.rstrip("\n"))
        if not m:
            continue
        stamp, txt = m.group(1), m.group(2)
        # YouTube rolling captions repeat text across cues; drop exact repeats
        if txt in seen:
            continue
        seen.add(txt)
        if ts is None:
            ts = stamp
        cur.extend(txt.split())
        if len(cur) >= int(width):
            blocks.append("[%s] %s" % (ts, " ".join(cur)))
            cur, ts = [], None
    if cur:
        blocks.append("[%s] %s" % (ts or "00:00:00", " ".join(cur)))
    p = os.path.join(out_dir, slug + ".txt")
    open(p, "w", encoding="utf-8").write("\n".join(blocks) + "\n")
    print("%s blocks=%d" % (p, len(blocks)))


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a:
        sys.exit(__doc__)
    cmd = a[0]
    if cmd == "search":
        search(*a[1:])
    elif cmd == "info":
        info(a[1])
    elif cmd == "subs":
        sys.exit(subs(a[1], a[2]))
    elif cmd == "flow":
        flow(*a[1:])
    elif cmd == "grep":
        grep(*a[1:])
    else:
        sys.exit(__doc__)
