#!/usr/bin/env python
"""place_sme_quotes.py - put one <ExpertQuote/> on every content page, respecting the 2-page cap.

  python scripts/place_sme_quotes.py --plan     # print the assignment, touch nothing
  python scripts/place_sme_quotes.py --apply    # insert import + component, write pages[] back

Assignment rules (contracts: no quote on more than 2 indexed pages):
  * every page gets the category its content belongs to;
  * within a category quotes are handed out round-robin, least-used first;
  * a quote already on 2 pages is skipped;
  * insertion point is immediately before <FAQ, else before <FinalCta.
Utility routes (404, privacy-policy, thank-you) are exempt and are reported, never silently skipped.
"""
import argparse
import json
import glob
import os
import re
import sys
from collections import defaultdict

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

EXEMPT = {"404", "privacy-policy", "thank-you"}
CAP = 2

POODLE_MIX = {
    "cavapoo", "maltipoo", "cockapoo", "bichonpoo", "cavapoochon", "shihpoo",
    "goldendoodle", "labradoodle", "cavachon", "toy-poodle", "pomsky",
}
LARGE_ACTIVE = {
    "border-collie", "german-shepherd", "golden-retriever", "siberian-husky",
    "samoyed", "chow-chow", "shiba-inu", "corgi", "sheltie", "english-bulldog",
    "cocker-spaniel", "beagle", "whippet",
}
PAGE_CATEGORY = {
    "index": "buying-safely",
    "about-us": "buying-safely",
    "contact": "buying-safely",
    "pricing": "cost-and-pricing",
    "starter-kit": "cost-and-pricing",
    "delivery": "puppy-care-training",
    "free-training": "puppy-care-training",
    "available-puppies": "buying-safely",
    "puppies/index": "blog-guides",
    "learn/index": "health-and-vet",
    "learn/puppy-health": "health-and-vet",
    "learn/verify-license": "buying-safely",
    "learn/smuggled-puppies": "buying-safely",
    "first-time-owners/index": "first-time-owners",
    "first-time-owners/breed-selector": "first-time-owners",
    "first-time-owners/budget-guide": "cost-and-pricing",
    "first-time-owners/hdb-breeds": "first-time-owners",
    "first-time-owners/puppy-care-101": "puppy-care-training",
    "blog/index": "blog-guides",
    "blog/cavapoo-vs-maltipoo": "breed-poodle-mix",
    "blog/first-time-mistakes": "buying-safely",
    "blog/hdb-dog-guide": "first-time-owners",
    "blog/pet-ownership-course-singapore": "buying-safely",
    "blog/puppy-fireworks-singapore": "puppy-care-training",
    "blog/puppy-first-night": "puppy-care-training",
    "blog/small-dog-breeds-singapore": "breed-toy-small",
}


def slug_of(path):
    s = path.replace("\\", "/").split("src/pages/", 1)[1][: -len(".astro")]
    return s


def category_for(slug):
    if slug in PAGE_CATEGORY:
        return PAGE_CATEGORY[slug]
    if slug.startswith("puppies/"):
        breed = slug.split("/", 1)[1]
        if breed in POODLE_MIX:
            return "breed-poodle-mix"
        if breed in LARGE_ACTIVE:
            return "breed-large-active"
        return "breed-toy-small"
    return "blog-guides"


def load_banks():
    banks = {}
    for f in sorted(glob.glob("config/sme/quotes/*.json")):
        banks[os.path.basename(f)[:-5]] = json.loads(open(f, encoding="utf-8").read())
    return banks


def route_of(slug):
    return "/" if slug == "index" else "/" + re.sub(r"/index$", "", slug) + "/"


def build_plan(banks):
    pages = sorted(slug_of(p) for p in glob.glob("src/pages/**/*.astro", recursive=True))
    used = defaultdict(int)
    plan, exempt, unplaced = [], [], []
    for slug in pages:
        if slug in EXEMPT:
            exempt.append(slug)
            continue
        cat = category_for(slug)
        pool = banks.get(cat) or []
        pick = None
        for q in sorted(pool, key=lambda q: used[q["id"]]):
            if used[q["id"]] < CAP:
                pick = q
                break
        if not pick:
            unplaced.append((slug, cat))
            continue
        used[pick["id"]] += 1
        plan.append((slug, cat, pick["id"]))
    return plan, exempt, unplaced, used


def insert(slug, quote_id):
    path = os.path.join("src", "pages", slug + ".astro")
    src = open(path, encoding="utf-8").read()
    if "ExpertQuote" in src:
        return "already"
    depth = slug.count("/")
    rel = "../" * (depth + 1) + "components/ExpertQuote.astro"
    imports = list(re.finditer(r"^import .*?;$", src, re.M))
    if not imports:
        return "no-import-block"
    last = imports[-1]
    src = src[: last.end()] + "\nimport ExpertQuote from '%s';" % rel + src[last.end():]
    tag = '\n  <ExpertQuote id="%s" />\n' % quote_id
    for anchor in ("<FAQ", "<FinalCta"):
        m = re.search(r"^([ \t]*)" + re.escape(anchor), src, re.M)
        if m:
            src = src[: m.start()] + tag + src[m.start():]
            open(path, "w", encoding="utf-8", newline="\n").write(src)
            return "ok"
    return "no-anchor"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--plan", action="store_true")
    a = ap.parse_args()
    banks = load_banks()
    plan, exempt, unplaced, used = build_plan(banks)

    by_cat = defaultdict(int)
    for slug, cat, qid in plan:
        by_cat[cat] += 1
    print("PLAN: %d pages, %d exempt, %d unplaced" % (len(plan), len(exempt), len(unplaced)))
    for cat in sorted(by_cat):
        print("  %-22s %2d pages from %2d quotes" % (cat, by_cat[cat], len(banks.get(cat) or [])))
    if exempt:
        print("  exempt routes (reported, not skipped silently): " + ", ".join(exempt))
    for slug, cat in unplaced:
        print("  UNPLACED %s (category %s exhausted at cap %d)" % (slug, cat, CAP))
    over = [q for q, n in used.items() if n > CAP]
    print("  over_2_use_cap=%d" % len(over))

    if not a.apply:
        for slug, cat, qid in plan:
            print("    %-46s %-22s %s" % (slug, cat, qid))
        return 1 if unplaced else 0

    results = defaultdict(list)
    for slug, cat, qid in plan:
        results[insert(slug, qid)].append(slug)
    for k in sorted(results):
        print("  %-16s %d" % (k, len(results[k])))
        if k not in ("ok", "already"):
            for s in results[k]:
                print("      " + s)

    # write pages[] / used_on back into the banks
    assigned = defaultdict(list)
    for slug, cat, qid in plan:
        assigned[qid].append(route_of(slug))
    for cat, entries in banks.items():
        for q in entries:
            if q["id"] in assigned:
                q["pages"] = assigned[q["id"]]
                q["used_on"] = assigned[q["id"]][0]
        p = "config/sme/quotes/%s.json" % cat
        with open(p, "w", encoding="utf-8", newline="\n") as f:
            json.dump(entries, f, ensure_ascii=False, indent=2)
            f.write("\n")
    print("  banks updated with pages[]")
    return 0


if __name__ == "__main__":
    sys.exit(main())
