from pathlib import Path

p = Path("outputs/puppy-page-redesign-biscuit.html")
b = p.read_bytes()
t = b.decode("utf-8")
print("first bytes:", list(b[:3]))
print("U+FFFD:", t.count(chr(0xFFFD)))
print("mojibake:", sum(t.count(x) for x in ["Â", "â€", "â˜", "Ã©", "Ã¨"]))

checks = {
    "Born row only": "<dt>Born</dt><dd>4 August 2026</dd>" in t,
    "Age in descriptor": 'Apricot Maltipoo girl<span class="only-av"> · About 3 months</span>' in t,
    "no Going home": "Going home" not in t,
    "no DOB note": "puppy feed DOB column" not in t,
    "no age note": "computed from her" not in t,
    "no passport dev note": "PASSPORT FACTS" not in t,
    "pull fact verbatim FAQ": "HDB allows one dog of an approved breed per flat." in t,
    "4th vaccine label": "Week 16 · 4th Vaccine" in t,
    "4th core support": "The 4th core puppy vaccination" in t,
    "optional 4th gone": "optional 4th" not in t,
    "tel 1": "tel:+6565691627" in t,
    "tel 2": "tel:+6582684039" in t,
    "training inclusion": "a free first training lesson with an AVS-certified trainer" in t,
    "surcharge unchanged": "The only extra is the 3% bank surcharge if you pay by credit card." in t,
    "synced date": 'Listing synced <time datetime="2026-11-01">1 Nov 2026</time>' in t,
    "stale shown": "data-stale> · may be out of date</span>" in t,
    "checked 1 Nov gone": "checked 1 Nov" not in t,
    "pp grid 2col every width": "grid-template-columns:repeat(2,minmax(0,1fr))" in t,
    "focus-visible ring": ".more-links a:focus-visible" in t,
}
vet = (
    'For <span data-pup-name>Biscuit</span>\'s remaining puppy core vaccines, please contact Vets For Pets Jurong '
    '(<a href="tel:+6565691627">6569 1627</a>) / Vets For Pets Lengkok Bahru (<a href="tel:+6582684039">8268 4039</a>) '
    'to arrange an appointment. Curious Tails will cover these vaccinations when done at Vets For Pets. Please mention '
    "to the clinic that Curious Tails will be covering."
)
checks["vet copy exact"] = vet in t

for k, v in checks.items():
    print(("OK  " if v else "FAIL"), k)
