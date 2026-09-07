#!/usr/bin/env python
"""fetch_review_media.py - download Google review photos and reviewer avatars locally.

Google's lh3.googleusercontent.com URLs are not stable and hotlinking them puts a
third-party request on the critical path of a money page. Everything is pulled once,
converted to WebP, and served from src/assets/reviews/ like every other image on the
site. Re-run after a fresh GBP pull; existing files are left alone.

  python scripts/fetch_review_media.py
"""
import hashlib, io, json, sys, urllib.request
from pathlib import Path
from PIL import Image

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
SRC = Path("sme/raw/google-reviews.json")
OUT = Path("src/assets/reviews")
OUT.mkdir(parents=True, exist_ok=True)

UA = {"User-Agent": "Mozilla/5.0 (compatible; curioustails-build/1.0)"}


def sized(url: str, px: int) -> str:
    """Google serves any size off the same object; ask for the one we render."""
    for tail in ("=k-no", "=s64-c-rp-mo-br100"):
        if url.endswith(tail):
            return url[: -len(tail)] + "=w%d" % px
    return url


def grab(url: str, px: int, prefix: str) -> str | None:
    name = "%s-%s.webp" % (prefix, hashlib.sha1(url.encode()).hexdigest()[:10])
    dest = OUT / name
    if dest.exists():
        return name
    try:
        req = urllib.request.Request(sized(url, px), headers=UA)
        raw = urllib.request.urlopen(req, timeout=30).read()
        im = Image.open(io.BytesIO(raw))
        if im.mode not in ("RGB", "RGBA"):
            im = im.convert("RGB")
        im.thumbnail((px, px))
        im.save(dest, "WEBP", quality=82, method=6)
        return name
    except Exception as e:                      # a missing photo must never break a build
        print("  skip %s: %s" % (url[:60], e))
        return None


rows = json.loads(SRC.read_text(encoding="utf-8"))
photos, avatars = 0, 0
manifest = {}
for r in rows:
    rid = r.get("review_id") or ""
    entry = {"photos": [], "avatar": None}
    for img in (r.get("images") or []):
        u = img.get("image_url")
        if not u:
            continue
        n = grab(u, 1000, "p")
        if n:
            entry["photos"].append(n)
            photos += 1
    if r.get("profile_image_url"):
        n = grab(r["profile_image_url"], 128, "a")
        if n:
            entry["avatar"] = n
            avatars += 1
    manifest[rid] = entry

Path("src/data/review-media.json").write_text(
    json.dumps(manifest, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
print("photos=%d avatars=%d manifest=src/data/review-media.json" % (photos, avatars))
