import io

t = io.open("outputs/puppy-page-redesign-biscuit.html", encoding="utf-8").read()
print("chars", len(t))
for i, l in enumerate(t.splitlines(), 1):
    if "data-today" in l or "classList.add('js')" in l or "documentElement.classList" in l:
        print(i, repr(l))
print("---")
for i, l in enumerate(t.splitlines(), 1):
    if 1450 <= i <= 1470:
        print(i, repr(l))
