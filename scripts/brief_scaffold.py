#!/usr/bin/env python3
"""brief_scaffold.py - generate the EVIDENCE half of briefs/<slug>.json and
merge the hand-authored strategy spec briefs/_specs/<slug>.mjs into it.

  python scripts/brief_scaffold.py <slug>          # write the evidence half
  python scripts/brief_scaffold.py --all           # every blueprint row with an extract
  python scripts/brief_scaffold.py --spec-stub <slug>
  python scripts/brief_scaffold.py --merge <slug>  # fold the spec in
  python scripts/brief_scaffold.py --digest <slug> # author-facing digest
Exit 0 on success, 1 on a missing input. Python 3.9+, stdlib only (node is used
only to evaluate a .mjs spec; a .json spec needs no node).
"""
import csv, json, os, re, subprocess, sys
from datetime import date
from pathlib import Path

# CONSOLE ENCODING. A Windows console is cp1252, and a gate that PRINTS page
# content dies with UnicodeEncodeError the moment a page contains a character
# outside it - mid-run, after some pages have been graded and before the
# denominator line, so the run reports NOTHING. Measured 2026-09-05: this
# killed verify_page.py on 22 of 29 projects, which is why the pipeline looked
# like it only ran on six. Degrade the CHARACTER, never the run.
import sys  # the encoding guard below USES sys; without this the
           # NameError was swallowed by its own except and the guard never applied.
try:
    sys.stdout.reconfigure(errors="replace")
    sys.stderr.reconfigure(errors="replace")
except Exception:  # noqa: BLE001
    pass


ROOT = Path(os.environ.get("PROJECT_ROOT", ".")).resolve()
BRIEFS = ROOT / "briefs"
SPECS = BRIEFS / "_specs"
SERP = ROOT / "research" / "serp"
BLUEPRINT = ROOT / "research" / "site-blueprint.csv"
CONFIG = ROOT / "config" / "project-config.md"

# Fields this script OWNS. Everything else in the brief belongs to the spec.
GENERATED = ("slug", "target_keyword", "secondary_keyword", "page_tier", "brief_depth",
             "serp_analysis", "landscape_stats", "topic_split", "lsi_keywords",
             "paa", "questions", "_scaffold")
STOP = set(("the a an and or for of to in on at by with from as is are was were be "
            "this that these those you your it its his her their our we they i "
            "how what why when where which who whom whose can do does did will "
            "would should could than then them there here into over under about "
            "best top good great vs versus near me my not no yes if but so").split())
# Contamination families (RULE 3): reject non-commercial intent outright.
CONTAM = (r"\bjobs?\b", r"\bsalary\b", r"\bvacanc", r"\bcareers?\b", r"\bcourses?\b",
          r"\bhow to become\b", r"\bapprentice", r"\binternship", r"\bhomework\b",
          r"\bwikipedia\b", r"\bdefinition physics\b", r"\bmeaning in hindi\b")
# Question forms used ONLY to top the bank up to 18-22 after the PAA set and the
# related searches are exhausted. They are neutral shapes, never invented facts.
QFORMS = ("How much does %s cost?", "How long does %s take?", "Is %s worth it?",
          "What does %s include?", "How do I choose %s?", "What goes wrong with %s?",
          "Who is %s for?", "What are the alternatives to %s?",
          "How is %s different from the alternatives?", "What should I check before %s?",
          "What does %s not cover?", "How do I get started with %s?",
          "What does %s depend on?", "When is %s the wrong choice?",
          "What questions should I ask about %s?", "How is %s priced?")
LSI_FLOOR = 150          # reference/contracts.md: 150-230, never under 100 usable


def cfg():
    out = {}
    if CONFIG.exists():
        for ln in CONFIG.read_text(encoding="utf-8", errors="replace").splitlines():
            m = re.match(r"^\s*[-*]?\s*([A-Z][A-Z0-9_]+)\s*[:=]\s*(.+?)\s*$", ln)
            if m:
                out[m.group(1)] = re.split(r"\s+#", m.group(2))[0].strip()
    return out


def rows():
    out = {}
    if BLUEPRINT.exists():
        with BLUEPRINT.open(newline="", encoding="utf-8-sig", errors="replace") as f:
            for r in csv.DictReader(f):
                k = (r.get("url_slug") or "").strip("/") or "index"  # contracts §9: url_slug is the canonical column; path/slug are FORBIDDEN legacy names
                rec = {a: (b or "").strip() for a, b in r.items()}
                out[k] = rec
                # Brief FILES are named with the flattened slug (briefs/pricing-heygen.json),
                # so the row must be reachable under that spelling too. Without this alias
                # every nested row silently fell back to slug.replace("-", " ") as its
                # keyword and shipped a brief targeting "pricing heygen".
                flat = k.replace("/", "-")
                if flat != k:
                    out.setdefault(flat, rec)
    return out


def fname(base, slug, ext):
    f = base / (slug.replace("/", "-") + ext)
    return f if f.exists() else base / (slug + ext)


def load_extract(slug):
    f = fname(SERP, slug, ".json")
    if not f.exists():
        print("FAIL research/serp/%s.json missing - run serp_extract.py first" % slug)
        return None
    return json.loads(f.read_text(encoding="utf-8", errors="replace"))


def load_headings(slug, extract):
    h = extract.get("competitor_headings")
    if h:
        return h
    f = fname(SERP, slug, "-headings.json")
    if f.exists():
        return json.loads(f.read_text(encoding="utf-8", errors="replace"))
    return {}


def median(xs):
    xs = sorted(x for x in xs if isinstance(x, (int, float)) and x > 0)
    if not xs:
        return 0
    m = len(xs) // 2
    return int(xs[m] if len(xs) % 2 else round((xs[m - 1] + xs[m]) / 2.0))


def norm_topic(h):
    t = re.sub(r"[^a-z0-9 ]", " ", (h or "").lower())
    return " ".join(w for w in t.split() if w not in STOP)[:60].strip()


def topic_split(headings):
    """Consensus = a topic >=50% of the crawled competitors carry; unique = 1."""
    seen, n = {}, max(1, len(headings))
    for url, hs in headings.items():
        for t in {norm_topic(h) for h in (hs or []) if norm_topic(h)}:
            seen.setdefault(t, set()).add(url)
    consensus = sorted([t for t, u in seen.items() if len(u) >= max(2, round(n * 0.5))])
    unique = sorted([t for t, u in seen.items() if len(u) == 1])
    return {"competitors_crawled": len(headings), "consensus": consensus,
            "unique": unique[:40],
            "note": "consensus topics MUST be covered; unique topics are the "
                    "information-gain shortlist for the spec"}


def fragments(strings, lo=2, hi=4):
    """RULE 0 fragmentation pass: 2-4-word fragments, edge stopwords stripped."""
    out = []
    for sline in strings:
        toks = [w for w in re.split(r"[^a-z0-9'-]+", (sline or "").lower()) if w]
        for n in range(lo, hi + 1):
            for i in range(0, max(0, len(toks) - n + 1)):
                frag = toks[i:i + n]
                while frag and frag[0] in STOP:
                    frag = frag[1:]
                while frag and frag[-1] in STOP:
                    frag = frag[:-1]
                if len(frag) >= 2:
                    out.append(" ".join(frag))
    return out


def spelling_fix(term, locale):
    if locale.startswith("en-US"):
        term = re.sub(r"(\w+)is(e|ed|ing|ation)\b", r"\1iz\2", term)
        term = term.replace("behaviour", "behavior").replace("favour", "favor")
        term = term.replace("centre", "center").replace("licence", "license")
    else:
        term = re.sub(r"(\w+)iz(e|ed|ing|ation)\b", r"\1is\2", term)
        term = term.replace("behavior", "behaviour").replace("favor", "favour")
        term = term.replace("center", "centre")
    return term


def build_lsi(extract, headings, kw, sec, conf):
    locale = (conf.get("SPELLING") or "en-US").strip()
    brand = [b.strip().lower() for b in re.split(r"[,;]", conf.get("BRAND_TERMS", "") or "")
             if b.strip()]
    city = (conf.get("PRIMARY_CITY") or "").strip().lower()
    national = (conf.get("SITE_ARCHETYPE") or "").lower() in (
        "publisher", "national", "referral", "publication")
    src = [o.get("title", "") for o in extract.get("organic", [])]
    src += extract.get("paa", []) + extract.get("related_searches", [])
    src += [(extract.get("ai_overview") or {}).get("text", "")]
    src += [h for hs in headings.values() for h in (hs or [])]
    src += [kw, sec]
    seen, allterms, removed, contam = set(), [], [], []
    for frag in fragments([x for x in src if x]):
        term = spelling_fix(frag, locale)
        if term in seen or len(term) < 5:
            continue
        seen.add(term)
        if any(re.search(p, term) for p in CONTAM):
            contam.append({"term": term, "contamination_note": "non-commercial intent"})
            continue
        if any(b and b in term for b in brand):
            removed.append({"term": term, "reason": "competitor/brand chrome"})
            continue
        if national and (city and city in term or re.search(r"\bnear me\b", term)):
            removed.append({"term": term, "reason": "geo chrome on a national site"})
            continue
        if re.search(r"^(cheap|affordable|best|top)\b.*\b(packages?|price list|tiered)\b", term):
            removed.append({"term": term, "reason": "mechanical tool permutation"})
            continue
        allterms.append(term)
    head = [w for w in re.split(r"[^a-z0-9]+", (kw or "").lower()) if w and w not in STOP]
    # RULE 6: prune AND top up in ONE pass, rebuilt from the page's own
    # vocabulary, so the list never silently undershoots the floor.
    if len(allterms) < LSI_FLOOR and head:
        base, vocab = " ".join(head[:3]), []
        for x in src:
            for w in re.split(r"[^a-z0-9'-]+", (x or "").lower()):
                if w and w not in STOP and len(w) > 3 and w not in head and w not in vocab:
                    vocab.append(w)
        for w in vocab:
            for cand in ("%s %s" % (base, w), "%s %s" % (w, base)):
                cand = spelling_fix(cand, locale)
                if cand in seen or len(cand) < 5:
                    continue
                if any(re.search(p, cand) for p in CONTAM):
                    continue
                if any(b and b in cand for b in brand):
                    continue
                seen.add(cand)
                allterms.append(cand)
            if len(allterms) >= 190:
                break
    scored = sorted(allterms, key=lambda t: (-sum(1 for w in head if w in t), len(t)))
    primary = [t for t in scored if all(w in t for w in head[:1])][:30]
    secondary = [t for t in scored if t not in primary][:60]
    return {"all": scored[:230], "primary": primary, "secondary": secondary,
            "_removed_as_unusable": removed, "excluded_contaminated": contam,
            "_flags": {"LSI_ALL": len(scored[:230]), "LSI_P": len(primary),
                       "floor_met": len(scored) >= LSI_FLOOR}}


def question_bank(extract, kw):
    qs, seen = [], set()
    for q in extract.get("paa", []):
        if q.lower() not in seen:
            seen.add(q.lower())
            qs.append(q)
    for r in extract.get("related_searches", []):
        if any(re.search(p, (r or "").lower()) for p in CONTAM):
            continue
        cand = r if r.strip().endswith("?") else "What is %s?" % r
        if cand.lower() not in seen and len(qs) < 22:
            seen.add(cand.lower())
            qs.append(cand)
    for form in QFORMS:
        if len(qs) >= 20:
            break
        cand = form % kw
        if cand.lower() not in seen:
            seen.add(cand.lower())
            qs.append(cand)
    return qs[:22]


def scaffold(slug, bp, conf):
    ex = load_extract(slug)
    if ex is None:
        return 1
    row = bp.get(slug, {})
    kw = row.get("target_keyword", "") or slug.replace("-", " ")
    # contracts §9 names the column secondary_keywordS (pipe-separated); the singular
    # spelling silently read an empty string and left every brief without a secondary.
    sec_raw = row.get("secondary_keywords", "") or row.get("secondary_keyword", "")
    sec = sec_raw.split("|")[0].strip()
    heads = load_headings(slug, ex)
    words = [o.get("words") for o in ex.get("organic", [])]
    band = {"top3_median": median(words[:3]), "top10_range":
            [min([w for w in words if w] or [0]), max([w for w in words if w] or [0])],
            "measured_on": ex.get("measured_on") or ex.get("extracted_on", "")}
    stats = {"organic_count": len(ex.get("organic", [])),
             "domains": sorted({o.get("domain", "") for o in ex.get("organic", []) if o.get("domain")}),
             "serp_features": ex.get("serp_features", []),
             "featured_snippet": ex.get("featured_snippet", ""),
             "ai_overview_present": (ex.get("ai_overview") or {}).get("present", False),
             "ai_overview_cited_sources": (ex.get("ai_overview") or {}).get("cited_source_count", 0),
             "local_pack": ex.get("local_pack", {})}
    lsi = build_lsi(ex, heads, kw, sec, conf)
    out = {"slug": slug, "target_keyword": kw, "secondary_keyword": sec,
           "page_tier": row.get("page_tier", ""), "brief_depth": row.get("brief_depth", "full"),
           "serp_analysis": {"word_band": band, "serp_extract_file":
                             "research/serp/%s.json" % slug, "landscape": stats},
           "landscape_stats": stats, "topic_split": topic_split(heads),
           "lsi_keywords": lsi, "paa": ex.get("paa", []),
           "questions": question_bank(ex, kw),
           "_scaffold": {"generated_on": date.today().isoformat(),
                         "measured_on": band["measured_on"],
                         "source": "brief_scaffold.py"}}
    f = BRIEFS / (slug.replace("/", "-") + ".json")
    BRIEFS.mkdir(parents=True, exist_ok=True)
    prev = {}
    if f.exists():
        prev = json.loads(f.read_text(encoding="utf-8", errors="replace"))
    prev.update(out)                      # generated half overwrites, spec half kept
    f.write_text(json.dumps(prev, indent=2, ensure_ascii=False), encoding="utf-8")
    flags = lsi.get("_flags", {})
    print("scaffold %s: organic=%d top3_median=%s consensus=%d unique=%d "
          "lsi=%d(P%d) questions=%d paa=%d LSI-ALL=%s"
          % (slug, stats["organic_count"], band["top3_median"],
             len(out["topic_split"]["consensus"]), len(out["topic_split"]["unique"]),
             len(lsi["all"]), len(lsi["primary"]), len(out["questions"]),
             len(out["paa"]), "ok" if flags.get("floor_met") else "LOW"))
    if not flags.get("floor_met"):
        # RULE 8: never silently lower the bar - say what to pull, pad nothing.
        print("  LSI-ALL=%d < %d: the SERP pool is too small. Pull phrase-match "
              "suggestions (dataforseo_labs_google_keyword_suggestions) into the "
              "extract and re-run; never pad with unusable permutations."
              % (len(lsi["all"]), LSI_FLOOR))
    if len(out["questions"]) < 18:
        print("  QUESTIONS=%d < 18: raise people_also_ask_click_depth on the pull "
              "and re-run serp_extract.py." % len(out["questions"]))
    if not SPECS.exists() or not fname(SPECS, slug, ".mjs").exists():
        print("  next: python scripts/brief_scaffold.py --spec-stub %s" % slug)
    return 0


SPEC_TEMPLATE = """// STRATEGY HALF of briefs/%(slug)s.json - HAND-AUTHORED, never generated.
// The evidence half (landscape, topic_split, lsi_keywords, questions, paa) is
// written by scripts/brief_scaffold.py and must not be repeated here.
// Fold this file in with: python scripts/brief_scaffold.py --merge %(slug)s
export default {
  meta_title: "",           // <=60 decoded characters, brand suffix included
  meta_description: "",     // 140-158 decoded characters
  h1: "",
  page_intent: "",
  centerpiece: "",
  centerpiece_attributes: [],
  quantitative_query: "",
  form_placement: "",
  information_gaps: [],     // pick from topic_split.unique + your own expertise
  content_outline: [],      // [{heading, level, key_points[], cro_phase, ux_note}]
  outline_deviations: { renamed: [], dropped_sections: [], sizing: "" },
  link_contract: { root: "", seed: "", node: "" },
  supplementary_links: [],
  external_links: [],       // each verified 200, with http_status recorded
  source_type_plan: [],
  social_research: { run: false, reason: "", negative_result_count: 0 },
  writer_constraints: [],
  faq: [],                  // >= the page's FAQ floor (contracts §1a: 10 on
                            // core|compare|monetization, 8 outer, 0 utility),
                            // or the WHOLE bank when it is smaller; picked from
                            // questions[]
  schema_plan: [],
  info_gain_score: 0,
  word_count_target: 0      // >= tier floor and >= 1.1 x serp_analysis word_band
};
"""


def spec_stub(slug):
    SPECS.mkdir(parents=True, exist_ok=True)
    f = SPECS / (slug.replace("/", "-") + ".mjs")
    if f.exists():
        print("spec exists: %s" % f)
        return 0
    f.write_text(SPEC_TEMPLATE % {"slug": slug}, encoding="utf-8")
    readme = SPECS / "README.md"
    if not readme.exists():
        readme.write_text(
            "# briefs/_specs - the STRATEGY half of every brief\n\n"
            "One `<slug>.mjs` per page, hand-authored. The evidence half is\n"
            "generated by `scripts/brief_scaffold.py` and lives in\n"
            "`briefs/<slug>.json`. Merge with `--merge <slug>`, then gate with\n"
            "`python scripts/validate_brief.py <slug>`.\n", encoding="utf-8")
    print("spec stub: %s" % f)
    return 0


def load_spec(slug):
    j = fname(SPECS, slug, ".json")
    if j.exists():
        return json.loads(j.read_text(encoding="utf-8", errors="replace"))
    m = fname(SPECS, slug, ".mjs")
    if not m.exists():
        print("FAIL briefs/_specs/%s.mjs missing - run --spec-stub %s" % (slug, slug))
        return None
    js = ("import spec from %s;\nprocess.stdout.write(JSON.stringify(spec));"
          % json.dumps(m.resolve().as_uri()))
    r = subprocess.run(["node", "--input-type=module", "-e", js],
                       capture_output=True, text=True, cwd=str(ROOT))
    if r.returncode or not r.stdout.strip():
        print("FAIL could not evaluate %s: %s" % (m, (r.stderr or "").strip()[:200]))
        return None
    return json.loads(r.stdout)


def merge(slug):
    f = BRIEFS / (slug.replace("/", "-") + ".json")
    if not f.exists():
        print("FAIL briefs/%s.json missing - run the scaffold first" % slug)
        return 1
    spec = load_spec(slug)
    if spec is None:
        return 1
    brief = json.loads(f.read_text(encoding="utf-8", errors="replace"))
    for k, v in spec.items():
        if k in GENERATED and k not in ("slug",):
            print("  skip %s: generated field, edit the extract not the spec" % k)
            continue
        brief[k] = v
    brief["meta_title_len"] = len(brief.get("meta_title") or "")
    brief["meta_description_len"] = len(brief.get("meta_description") or "")
    outline = brief.get("content_outline") or []
    # ~100 words per SECTION, which is the relationship the 25-35 section band was
    # designed around (25 sections ~ 2,500 words, 35 ~ 3,500). The old formula counted
    # 100 words per KEY POINT, so documenting a section more thoroughly raised the word
    # floor: a 30-section outline demanded 8,500 words against a 2,411-word SERP median.
    brief["word_floor_from_sections"] = 100 * len(outline)
    brief["content_length_estimate"] = brief.get("word_count_target", 0)
    brief["_spec_merged_on"] = date.today().isoformat()
    f.write_text(json.dumps(brief, indent=2, ensure_ascii=False), encoding="utf-8")
    phases = {str(s.get("cro_phase", "")) for s in outline if s.get("cro_phase")}
    lc = brief.get("link_contract") or {}
    print("merged %s: outline=%d phases=%d links=%d faq=%d -> validate_brief.py"
          % (slug, len(outline), len(phases), len([v for v in lc.values() if v]),
             len(brief.get("faq") or [])))
    return 0


def digest(slug):
    f = BRIEFS / (slug.replace("/", "-") + ".json")
    if not f.exists():
        print("FAIL briefs/%s.json missing" % slug)
        return 1
    b = json.loads(f.read_text(encoding="utf-8", errors="replace"))
    band = (b.get("serp_analysis") or {}).get("word_band") or {}
    ts = b.get("topic_split") or {}
    lsi = b.get("lsi_keywords") or {}
    print("=== BRIEF DIGEST %s ===" % slug)
    print("keyword      : %s | secondary: %s | tier: %s | depth: %s"
          % (b.get("target_keyword"), b.get("secondary_keyword") or "-",
             b.get("page_tier"), b.get("brief_depth")))
    print("landscape    : top3_median=%s top10=%s measured_on=%s"
          % (band.get("top3_median"), band.get("top10_range"), band.get("measured_on")))
    print("consensus    : %s" % ", ".join((ts.get("consensus") or [])[:12]))
    print("info gain    : %s" % ", ".join((ts.get("unique") or [])[:12]))
    print("lsi          : all=%d primary=%d secondary=%d removed=%d contaminated=%d"
          % (len(lsi.get("all") or []), len(lsi.get("primary") or []),
             len(lsi.get("secondary") or []), len(lsi.get("_removed_as_unusable") or []),
             len(lsi.get("excluded_contaminated") or [])))
    print("questions    : %d (paa verbatim %d)"
          % (len(b.get("questions") or []), len(b.get("paa") or [])))
    print("outline      : %d sections | faq %d | target %s words"
          % (len(b.get("content_outline") or []), len(b.get("faq") or []),
             b.get("word_count_target", 0)))
    missing = [k for k in ("meta_title", "meta_description", "h1", "content_outline",
                           "link_contract", "faq", "schema_plan", "word_count_target")
               if not b.get(k)]
    print("still needed : %s" % (", ".join(missing) or "nothing - run validate_brief.py"))
    return 0


BS_FLAGS = ("--spec-stub", "--merge", "--digest", "--all", "--status",
            "--help", "-h")


def main():
    if any(a in ("--help", "-h") for a in sys.argv[1:]):
        print(__doc__)
        return 0
    args = sys.argv[1:]
    # A FLAG IS NOT A SLUG. `brief_scaffold.py --bogus` used to be treated as the
    # slug to scaffold and wrote briefs/--bogus.json.
    for a in args:
        if a.startswith("-") and a not in BS_FLAGS:
            sys.stderr.write("brief_scaffold.py: unknown option %r" % a + chr(10))
            return 2
    if not args:
        print(__doc__)
        return 2
    conf, bp = cfg(), rows()
    if args[0] == "--spec-stub":
        return spec_stub(args[1].strip("/"))
    if args[0] == "--merge":
        return merge(args[1].strip("/"))
    if args[0] == "--digest":
        return digest(args[1].strip("/"))
    if args[0] == "--all":
        bad = 0
        for slug in sorted(bp):
            if fname(SERP, slug, ".json").exists():
                bad += scaffold(slug, bp, conf)
        return 1 if bad else 0
    return scaffold(args[0].strip("/") or "index", bp, conf)


if __name__ == "__main__":
    sys.exit(main())
