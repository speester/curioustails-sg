import io

t = io.open("outputs/puppy-page-redesign-biscuit.html", encoding="utf-8").read()
lines = t.splitlines()
for n in [14, 436, 705, 713, 1368, 1385]:
    print(n, repr(lines[n - 1])[:400])
