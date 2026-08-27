#!/usr/bin/env python
"""market_prices.py - record what Singapore competitors actually publish for a breed.

  python scripts/market_prices.py <breed-slug> [<breed-slug> ...]
  python scripts/market_prices.py --report

Writes research/market-prices.json:
  { "<breed>": { "checked": "<ISO date>", "sources": [ {url, domain, prices:[...], rank} ],
                 "published_range": [low, high] | null, "shops_checked": n, "shops_publishing": n } }

Rule this file exists to enforce: a market-comparison figure may appear on a page ONLY if it is in
here with a URL and a date. Where `published_range` is null the page must say that comparable shops
do not publish a per-breed price, which is true and is the stronger claim anyway.
"""
import json
import os
import re
import sys
import time
import urllib.request
from datetime import date

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.path.insert(0, os.path.join(os.path.expanduser("~"), ".claude", "scripts"))
from dfs import call  # noqa: E402

OUT = os.path.join("research", "market-prices.json")
# our own properties and non-shop results are never "the market"
OURS = {"curioustails.sg", "puppysingapore.com", "wgpetfarm.com", "puppysg.com", "cavapoo.sg"}
SKIP = {"facebook.com", "www.facebook.com", "instagram.com", "www.instagram.com", "www.lemon8-app.com",
        "www.royalcanin.com", "blog.petloverscentre.com", "dogsactually.com", "www.reddit.com",
        # breed names that collide with unrelated products or property listings
        "jewel-cafe.sg", "www.srx.com.sg", "crypto.com", "www.propertyguru.com.sg",
        "en.wikipedia.org", "sg.carousell.com", "www.carousell.sg"}
PRICE = re.compile(r"(?:S?\$)\s?([0-9]{1,2},[0-9]{3})")
# a puppy price, not a phone number or a year
LO, HI = 1500, 20000


def fetch(url, timeout=25):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read(1500000).decode("utf-8", "replace")


def prices_in(html):
    out = []
    for m in PRICE.finditer(html):
        v = int(m.group(1).replace(",", ""))
        if LO <= v <= HI:
            out.append(v)
    return sorted(set(out))


def serp(breed):
    kw = "%s price singapore" % breed.replace("-", " ")
    d = call("serp/google/organic/live/advanced",
             [{"keyword": kw, "location_name": "Singapore", "language_code": "en",
               "depth": 10, "device": "desktop"}])
    items = (d["tasks"][0]["result"][0].get("items") or [])
    return [(it.get("rank_absolute"), it.get("domain"), it.get("url"))
            for it in items if it.get("type") == "organic"]


def breed_specific(breed, url):
    """Only a page that is ABOUT this breed can supply this breed's price.
    A shop's catch-all listing page mixes every breed and produces a fake range."""
    toks = [t for t in breed.split("-") if len(t) > 3] or breed.split("-")
    u = url.lower()
    return any(t in u for t in toks)


def check(breed):
    rows, allp = [], []
    for rank, domain, url in serp(breed):
        if not domain or domain in OURS or domain in SKIP:
            continue
        if not breed_specific(breed, url):
            rows.append({"url": url, "domain": domain, "rank": rank, "prices": [],
                         "skipped": "not a breed-specific page"})
            continue
        try:
            html = fetch(url)
        except Exception as e:
            rows.append({"url": url, "domain": domain, "rank": rank, "prices": [], "error": str(e)[:80]})
            continue
        p = prices_in(html)
        rows.append({"url": url, "domain": domain, "rank": rank, "prices": p})
        allp.extend(p)
        time.sleep(0.5)
    publishing = [r for r in rows if r.get("prices")]
    rng = [min(allp), max(allp)] if allp else None
    # A spread wider than 4x is a scrape artifact, not a market range. Refuse it rather than
    # publish a number nobody could stand behind.
    unreliable = bool(rng) and rng[1] > rng[0] * 4
    if unreliable:
        rng = None
    return {
        "checked": date.today().isoformat(),
        "query": "%s price singapore" % breed.replace("-", " "),
        "sources": rows,
        "published_range": rng,
        "shops_checked": len(rows),
        "shops_publishing": len(publishing),
        "raw_spread": [min(allp), max(allp)] if allp else None,
        "rejected_as_scrape_artifact": unreliable,
    }


def load():
    if os.path.isfile(OUT):
        return json.load(open(OUT, encoding="utf-8"))
    return {}


def save(d):
    os.makedirs("research", exist_ok=True)
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        json.dump(d, f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write("\n")


def report(d):
    print("%-32s %8s %10s %s" % ("breed", "checked", "publish", "published range"))
    for b in sorted(d):
        r = d[b]
        rng = r["published_range"]
        print("%-32s %8d %10d %s" % (
            b, r["shops_checked"], r["shops_publishing"],
            ("$%s to $%s" % (format(rng[0], ","), format(rng[1], ","))) if rng else "NONE PUBLISHED"))


def main():
    a = sys.argv[1:]
    d = load()
    if not a or a[0] == "--report":
        report(d)
        return 0
    for breed in a:
        print("checking %s ..." % breed, flush=True)
        d[breed] = check(breed)
        save(d)
        r = d[breed]
        print("  %d shops checked, %d publish, range %s"
              % (r["shops_checked"], r["shops_publishing"], r["published_range"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
