import hashlib
import urllib.request
from pathlib import Path

LIVE = "https://curioustails-staging.pages.dev/outputs/"
DEPLOY = "https://0ae1b56b.curioustails-staging.pages.dev/outputs/"
ROBOTS = "https://curioustails-staging.pages.dev/robots.txt"
ROOT = "https://curioustails-staging.pages.dev/"


def fetch(url):
    req = urllib.request.Request(url, headers={"Cache-Control": "no-cache", "User-Agent": "k081-check"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status, {k.lower(): v for k, v in r.headers.items()}, r.read()


src = Path("outputs/puppy-page-redesign-biscuit.html").read_bytes()
stage = Path("_k002_stage/outputs/index.html").read_bytes()
print("source == stage:", src == stage, "| bytes:", len(src), "| sha256:", hashlib.sha256(src).hexdigest())

for label, url in [("live", LIVE), ("deployment", DEPLOY)]:
    status, headers, body = fetch(url)
    print(label, status, "x-robots-tag:", headers.get("x-robots-tag"), "bytes:", len(body))
    print("  sha256:", hashlib.sha256(body).hexdigest())
    print("  identical to source:", body == src, "| to stage:", body == stage)
    print("  BOM:", body[:3] == b"\xef\xbb\xbf")

status, headers, body = fetch(ROBOTS)
print("robots", status, "body:", body.decode("utf-8", "replace").strip().replace("\n", " | "))

status, headers, body = fetch(ROOT)
print("root", status, "x-robots-tag:", headers.get("x-robots-tag"), "bytes:", len(body))

t = src.decode("utf-8")
print("U+FFFD:", t.count(chr(0xFFFD)))
print("dossier:", t.count('class="dossier-card"'), "cards |", t.count('<li><b>'), "chips |", 'id="about"' in t)
for s in ["Maltipoos are companion dogs first.", "They are gentle with children, quick to learn, and happiest when someone is usually home.",
          "She is vaccinated, dewormed and microchipped, and has passed a vet health check.",
          "If that sounds like your household, come and meet her. There is no pressure to buy, and we'll tell you honestly if another breed would suit you better."]:
    print("  copy present:", s in t, "::", s[:55])
