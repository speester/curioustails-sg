import hashlib
import io
import re
import urllib.request
from pathlib import Path

LIVE = "https://curioustails-staging.pages.dev/outputs/"
DEPLOY = "https://ea7b24bc.curioustails-staging.pages.dev/outputs/"
ROBOTS = "https://curioustails-staging.pages.dev/robots.txt"


def fetch(url):
    req = urllib.request.Request(url, headers={"Cache-Control": "no-cache", "User-Agent": "k078-check"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status, {k.lower(): v for k, v in r.headers.items()}, r.read()


src = Path("outputs/puppy-page-redesign-biscuit.html").read_bytes()
stage = Path("_k002_stage/outputs/index.html").read_bytes()

for label, url in [("live", LIVE), ("deployment", DEPLOY)]:
    status, headers, body = fetch(url)
    print(label, status, "x-robots-tag:", headers.get("x-robots-tag"), "bytes:", len(body))
    print("  sha256:", hashlib.sha256(body).hexdigest())
    print("  identical to source:", body == src, "| to stage:", body == stage)
    print("  BOM:", body[:3] == b"\xef\xbb\xbf", "| first:", body[:3])

status, headers, body = fetch(ROBOTS)
print("robots", status, "x-robots-tag:", headers.get("x-robots-tag"), "body:", body.decode("utf-8", "replace").strip())

t = src.decode("utf-8")
print("source sha256:", hashlib.sha256(src).hexdigest(), "bytes:", len(src))
print("U+FFFD:", t.count(chr(0xFFFD)), "| mojibake:", sum(t.count(x) for x in ["Ã‚", "Ã¢â‚¬", "Ã¢Ëœ", "ÃƒÂ©", "ÃƒÂ¨"]))
for s in ["Listing synced", "may be out of date", "data-synced-at", "data-stale", "data-avail", "Available now Â· <time"]:
    print(f"  {s!r}:", t.count(s))
print("date hardcoded in markup:", bool(re.search(r"data-avail[^>]*>[^<]*\d{4}", t)))
print("time tags:", re.findall(r"<time[^>]*>[^<]*</time>", t)[:5])


