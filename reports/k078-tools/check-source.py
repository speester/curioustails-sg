import io

t = io.open("outputs/puppy-page-redesign-biscuit.html", encoding="utf-8").read()
checks = {
    "no synced": "synced" not in t.lower(),
    "no stale": "stale" not in t.lower(),
    "no may be out of date": "may be out of date" not in t,
    "no Listing synced": "Listing synced" not in t,
    "no data-synced-at": "data-synced-at" not in t,
    "no data-stale": "data-stale" not in t,
    "no pp-more": "pp-more" not in t,
    "no owner-card": "owner-card" not in t,
    "no pull b": ".pull b{" not in t,
    "no #.pp{": ".pp{" not in t,
    "data-avail": "data-avail" in t,
    "passport media": 'class="pp-media"' in t,
    "passport grid": 'class="pp-grid"' in t,
    "glance": 'class="glance"' in t,
    "lead drop": "::first-letter" in t,
}
for k, v in checks.items():
    print(("OK  " if v else "FAIL"), k)
print("U+FFFD", t.count(chr(0xFFFD)))
print("mojibake", sum(t.count(x) for x in ["Â", "â€", "â˜", "Ã©", "Ã¨"]))
print("chars", len(t))
