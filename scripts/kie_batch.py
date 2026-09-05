#!/usr/bin/env python3
"""kie-batch.py - kie.ai image batch runner: create -> poll -> download -> WebP.

  python scripts/kie_batch.py manifest.json [--force] [--probe] [--lint]
Manifest item (image-gen PART C emits these names; the older short names are
still accepted so old manifests keep running):
  name|file_name, prompt|image_prompt, aspect_ratio, size|resolution, route,
  slot|outline_section, alt|alt_text, consistency_id
The long names were the SKILL's output contract and the short names were this
runner's input contract, and nobody reconciled them: a manifest written to the
skill emitted alt_text/outline_section, this file read alt/slot, and .get()
returned "" - which is exactly why every asset-map entry on the Humva build
carries alt_text:"" and consistency_id:"" (2026-08-31).
Idempotent by file existence; merges the route-keyed asset map; never overwrites.
Stdlib only (urllib). Needs KIE_API_KEY in the environment (name from KIE_AI_ENV).
Exit 0 when every requested image exists on disk, 1 otherwise.
"""
import json, os, re, subprocess, sys, time, urllib.error, urllib.request
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
CREATE = "https://api.kie.ai/api/v1/jobs/createTask"
POLL = "https://api.kie.ai/api/v1/jobs/recordInfo?taskId=%s"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")
BANNED_ADJ = ["hyper-realistic", "ultra-realistic", "photorealistic", "render", "cgi",
              "3d", "stunning", "beautiful", "perfect", "flawless", "dreamy",
              "ethereal", "magical", "luminous", "cinematic", "glossy", "clean digital"]
UI_NOUNS = ["dashboard", "screen", "interface", "app window", "screenshot", "report view"]
STAFF = ["technician", "our team", "dispatch", "call centre", "call center", "our crew"]
PLAIN = "plain unlettered surface"


# The ONE place the two field vocabularies are reconciled. Read every manifest
# value through this, never with a bare .get().
FIELD_ALIASES = {
    "name": ("name", "file_name"),
    "prompt": ("prompt", "image_prompt"),
    "size": ("size", "resolution"),
    "slot": ("slot", "outline_section"),
    "alt": ("alt", "alt_text"),
    "consistency_id": ("consistency_id",),
    "role": ("role",),
    "route": ("route",),
    "aspect_ratio": ("aspect_ratio",),
}
# A slot that is a POSITION rather than the section it serves. "body-1" tells the
# prompt writer nothing about what the image must depict, so the scene falls back
# to generic stock - the Humva failure. The slot carries the outline HEADING.
POSITIONAL_SLOT = re.compile(r"^(feature|hero|body|inbody|img|image|slot)[-_ ]?\d*$", re.I)
STOP = {"the", "and", "for", "with", "from", "that", "this", "your", "you", "are",
        "how", "why", "what", "when", "into", "than", "then", "them", "they", "have",
        "has", "had", "will", "can", "does", "did", "not", "one", "two", "its", "was"}


def field(it, key, default=""):
    for k in FIELD_ALIASES.get(key, (key,)):
        v = it.get(k)
        if v not in (None, ""):
            return v
    return default


def words(s):
    return {w for w in re.findall(r"[a-z0-9]+", (s or "").lower())
            if len(w) >= 4 and w not in STOP}


def outline_index():
    """route -> {heading: significant words of heading + key_points}, from the briefs."""
    out = {}
    bd = ROOT / "briefs"
    if not bd.is_dir():
        return out
    for f in sorted(bd.glob("*.json")):
        try:
            d = json.loads(f.read_text(encoding="utf-8", errors="replace"))
        except Exception:
            continue
        secs = {}
        for s in (d.get("content_outline") or []):
            h = (s.get("heading") or "").strip()
            if not h:
                continue
            secs[h] = words(h) | words(" ".join(s.get("key_points") or []))
        if secs:
            out["/" + (d.get("slug") or f.stem).strip("/") + "/"] = secs
    return out


def cfg():
    out, p = {}, ROOT / "config" / "project-config.md"
    if p.exists():
        for line in p.read_text(encoding="utf-8", errors="replace").splitlines():
            m = re.match(r"^\s*[-*]?\s*([A-Z][A-Z0-9_]+)\s*[:=]\s*(.+?)\s*$", line)
            if m:
                # project-config comment convention: a value ends at two-or-more
                # spaces followed by "#". A single "#" inside a value is kept.
                out[m[1]] = re.split(r"\s{2,}#", m[2])[0].strip().strip("`")
    return out


C = cfg()
MODEL = C.get("KIE_AI_MODEL", "nano-banana-2-lite")
KEY = os.environ.get(C.get("KIE_AI_ENV", "KIE_API_KEY"), os.environ.get("KIE_API_KEY", ""))


def out_dir():
    explicit = C.get("IMAGE_OUTPUT_DIR")
    if explicit:
        return ROOT / explicit
    for cand in (ROOT / "public" / "images", ROOT / "src" / "assets"):
        if cand.exists() and any(cand.rglob("*.webp")):
            return cand
    return ROOT / "src" / "assets"


def post(url, body):
    req = urllib.request.Request(
        url, data=json.dumps(body).encode("utf-8"),
        headers={"Authorization": "Bearer " + KEY, "Content-Type": "application/json",
                 "User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def get(url):
    req = urllib.request.Request(url, headers={"Authorization": "Bearer " + KEY,
                                               "User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def download(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=180) as r, dest.open("wb") as f:
        f.write(r.read())


def to_webp(src, dest, max_px):
    """Convert with cwebp, then Pillow, and only then keep the original bytes.

    The bare cwebp/keep-original pair silently shipped 2.9 MB PNGs on any machine without
    the webp CLI - which is most Windows boxes - and a 160-image run is then ~460 MB of
    page weight that no audit in this pipeline measures. Pillow is present wherever these
    scripts run, so try it before giving up.
    """
    try:
        subprocess.run(["cwebp", "-q", "76", "-resize", str(max_px), "0",
                        str(src), "-o", str(dest)], check=True,
                       capture_output=True)
        src.unlink(missing_ok=True)
        return dest
    except Exception:
        pass
    try:
        from PIL import Image
        im = Image.open(src)
        if im.mode not in ("RGB", "RGBA"):
            im = im.convert("RGB")
        if max_px and im.width > max_px:
            im = im.resize((max_px, round(im.height * max_px / im.width)), Image.LANCZOS)
        im.save(dest, "WEBP", quality=76, method=6)
        src.unlink(missing_ok=True)
        return dest
    except Exception as e:
        print("  warn: no webp encoder (%s); keeping original bytes" % e)
        final = dest.with_suffix(src.suffix)
        src.replace(final)
        return final


def png_dims(p):
    try:
        b = p.read_bytes()[:33]
        if b[:8] == b"\x89PNG\r\n\x1a\n":
            return int.from_bytes(b[16:20], "big"), int.from_bytes(b[20:24], "big")
    except Exception:
        pass
    return 0, 0


def lint(manifest, page_kinds):
    # SECTION RELEVANCE is the half this linter never had. Everything below the
    # first four rows is prompt CRAFT - camera, adjectives, banned nouns - and a
    # prompt can satisfy every one of them while depicting nothing to do with the
    # section it sits beside. That is the Humva failure: technically clean prompts,
    # generic stock results, because nothing ever asserted the scene came from the
    # section's own heading and key_points.
    bad = {"plain_surface_clause missing": [], "ui_nouns (review pages)": [],
           "banned_adjectives": [], "staff/dispatch terms": [],
           "alt missing": [], "consistency_id missing": [],
           "slot is positional, not an outline heading": [],
           "slot not in the brief's content_outline": [],
           "prompt unrelated to its section": []}
    archetype = (C.get("SITE_ARCHETYPE") or "").lower()
    outlines = outline_index()
    for it in manifest:
        p = (field(it, "prompt") or "").lower()
        nm = field(it, "name")
        route = field(it, "route")
        slot = field(it, "slot")
        if not field(it, "alt"):
            bad["alt missing"].append(nm)
        if not field(it, "consistency_id"):
            bad["consistency_id missing"].append(nm)
        if not slot or POSITIONAL_SLOT.match(str(slot)):
            bad["slot is positional, not an outline heading"].append(
                "%s(%s)" % (nm, slot or "-"))
        else:
            secs = outlines.get(route if route.endswith("/") else route + "/")
            if secs is not None:
                if slot not in secs:
                    bad["slot not in the brief's content_outline"].append(
                        "%s(%s)" % (nm, str(slot)[:34]))
                # The scene must be BUILT FROM the section. Two significant words
                # shared with the heading + key_points is a low bar on purpose: it
                # catches "stopwatch on a bench" under "How token credits are
                # consumed" without dictating the picture.
                elif len(words(p) & secs[slot]) < 2:
                    bad["prompt unrelated to its section"].append(
                        "%s(%s)" % (nm, str(slot)[:34]))
        if PLAIN not in p:
            bad["plain_surface_clause missing"].append(nm)
        if page_kinds.get(route, "") == "review" and any(n in p for n in UI_NOUNS):
            bad["ui_nouns (review pages)"].append(nm)
        if any(re.search(r"\b" + re.escape(a) + r"\b", p) for a in BANNED_ADJ):
            bad["banned_adjectives"].append(nm)
        if archetype in ("referral", "publisher", "lead-gen", "operator-built") and \
                any(s in p for s in STAFF):
            bad["staff/dispatch terms"].append(nm)
    for k, v in bad.items():
        print("%s: %d %s" % (k, len(v), v[:5] if v else ""))
    return 1 if any(bad.values()) else 0


def merge_map(entries):
    mp = ROOT / "public" / "images" / "asset-map.json"
    before = {}
    if mp.exists():
        try:
            before = json.loads(mp.read_text(encoding="utf-8", errors="replace"))
        except Exception:
            before = {}
    # A route's value is EITHER a list of raster entries (what this script writes) or the
    # dict {feature, feature_kind, alt} that gen-feature-svgs.mjs writes and that
    # ArticleCard/ArticleLayout read as `assetMap[route].feature`. Both shapes are live in
    # the same file, so read the raster list through here and never index a route directly:
    # assuming the list shape crashed the first raster run on a site whose SVG fallbacks had
    # already been generated (btorenovation.sg, 2026-09-01), and flattening the dict to a
    # list would have thrown at build in every card on the site.
    def rasters(v):
        if isinstance(v, list):
            return v
        if isinstance(v, dict):
            return [x for x in v.get("images", []) if isinstance(x, dict)]
        return []

    def put(v, lst):
        # W10.4 - ONE SHAPE, ALWAYS A DICT. The bare-list value was the third vocabulary in
        # this file: RouteImage.astro reads `assetMap[route].images`, so every list-shaped
        # route rendered no image at all (12 of them on one live site). Normalising here
        # means every consumer can read `.images` without a shape test.
        v = dict(v) if isinstance(v, dict) else {}
        v["images"] = lst
        return v

    n_before = sum(len(rasters(v)) for v in before.values()) if isinstance(before, dict) else 0
    for route, items in entries.items():
        prev = before.get(route, [])
        cur = {i["file"]: i for i in rasters(prev)}
        for i in items:
            cur[i["file"]] = i
        before[route] = put(prev, list(cur.values()))
    n_after = sum(len(rasters(v)) for v in before.values())
    mp.parent.mkdir(parents=True, exist_ok=True)
    mp.write_text(json.dumps(before, indent=2, ensure_ascii=False), encoding="utf-8")
    dims = {i["file"]: {"width": i.get("width", 0), "height": i.get("height", 0)}
            for v in before.values() for i in rasters(v)}
    dp = ROOT / "src" / "data" / "image-dims.json"
    dp.parent.mkdir(parents=True, exist_ok=True)
    dp.write_text(json.dumps(dims, indent=2), encoding="utf-8")
    return n_before, n_after


KIE_FLAGS = ("--force", "--lint", "--probe", "--help", "-h")


def main():
    if any(a in ("--help", "-h") for a in sys.argv[1:]):
        print(__doc__)
        return 0
    argv = sys.argv[1:]
    # An unknown flag, or a manifest path that is not a file, must be an ERROR
    # before anything is read - this used to traceback out of argv[0].
    for a in argv:
        if a.startswith("--") and a not in KIE_FLAGS:
            sys.stderr.write("kie_batch.py: unknown option %r" % a + chr(10))
            return 2
    if argv and not argv[0].startswith("--") and not Path(argv[0]).is_file():
        sys.stderr.write("kie_batch.py: no such manifest: " + argv[0] + chr(10))
        return 2
    if not argv:
        print(__doc__)
        return 2
    # FLAGS ONLY, NO MANIFEST. `kie_batch.py --lint` read "--lint" AS the manifest
    # path and tracebacked out of read_text(). RULE 18 guards SPENDING MONEY and
    # its GATE line was exactly that command, so the rule's instrument had never
    # run. An instrument must fail its input, never die on it.
    paths = [a for a in argv if not a.startswith("--")]
    if not paths:
        found = sorted(ROOT.glob("image-manifest*.json")) +             sorted((ROOT / "config").glob("image-manifest*.json"))
        if not found:
            print("kie_batch --lint: checked=0 failed=0 (EXEMPT: no "
                  "image-manifest*.json on disk - there is no image spend to cost)")
            return 0
        paths = [str(found[0])]
        print("kie_batch --lint: no manifest given, linting %s" % paths[0])
    manifest = json.loads(Path(paths[0]).read_text(encoding="utf-8", errors="replace"))
    force = "--force" in argv
    if "--lint" in argv:
        kinds = {}
        bp = ROOT / "research" / "site-blueprint.csv"
        if bp.exists():
            import csv
            with bp.open(newline="", encoding="utf-8-sig", errors="replace") as f:
                for r in csv.DictReader(f):
                    # contracts §9: the columns are `url_slug` and `page_tier`; `path`
                    # and `tier` are FORBIDDEN dead names that yield '' on every row of a
                    # canonical 39-column blueprint - so both lint rows below were
                    # permanently 0 and proved nothing.
                    _slug = (r.get("url_slug") or r.get("path") or "").strip("/")
                    kinds["/" + _slug + "/"] = (r.get("page_tier")
                                                or r.get("tier") or "").lower()
        return lint(manifest, kinds)
    if not KEY:
        print("FAIL KIE_API_KEY not in the environment (load it from ~/.claude/.env)")
        return 1
    base = out_dir()
    print("IMAGE PLAN: model=%s out=%s n=%d" % (MODEL, base, len(manifest)))
    if "--probe" in argv or True:
        try:
            probe = post(CREATE, {"model": MODEL,
                                  "input": {"prompt": "a plain unlettered ceramic tile",
                                            "image_input": [], "aspect_ratio": "1:1",
                                            "resolution": "1K", "output_format": "png"}})
            used = str(probe.get("data", {}).get("model", MODEL))
            if used and used != MODEL:
                print("STOP model fallback: requested %s, service used %s" % (MODEL, used))
                return 1
            print("model=%s ok" % MODEL)
        except urllib.error.HTTPError as e:
            print("STOP probe failed HTTP %s - re-read the contract block in image-gen" % e.code)
            return 1
    created = ok = failed = skipped = 0
    entries = {}
    for it in manifest:
        route = it.get("route", "/")
        d = base / route.strip("/") if route.strip("/") else base
        d.mkdir(parents=True, exist_ok=True)
        final = d / (it["name"] + ".webp")
        if final.exists() and not force:
            skipped += 1
            w, h = png_dims(final)
            entries.setdefault(route, []).append(
                {"file": "/" + final.relative_to(ROOT).as_posix().replace("public/", ""),
                 "alt_text": field(it, "alt"), "outline_section": field(it, "slot"),
                 "consistency_id": field(it, "consistency_id"), "width": w, "height": h})
            continue
        try:
            r = post(CREATE, {"model": MODEL,
                              "input": {"prompt": it["prompt"], "image_input": [],
                                        "aspect_ratio": it.get("aspect_ratio", "16:9"),
                                        "resolution": it.get("size", "2K"),
                                        "output_format": "png"}})
            # surface the API's own message instead of dying on data=None: kie.ai returns
            # {"code":500,"msg":"...","data":null} for a bad field (e.g. resolution must be
            # "1K"/"2K", never pixel dimensions) and the AttributeError hid that entirely.
            if not isinstance(r.get("data"), dict):
                raise RuntimeError("kie.ai %s: %s" % (r.get("code"), r.get("msg")))
            tid = r["data"].get("taskId") or r.get("taskId")
            created += 1
        except Exception as e:
            print("FAIL create %s: %s" % (it["name"], e))
            failed += 1
            continue
        url, wait = "", 4
        for _ in range(60):
            time.sleep(wait)
            wait = min(wait * 1.4, 20)
            try:
                rec = get(POLL % tid)
            except Exception:
                continue
            data = rec.get("data", rec)
            # kie.ai returns the URLs in data.resultJson, which is a JSON *string*, not a
            # nested object. Looking only in data.resultUrls / data.response.resultUrls
            # meant a task that had ALREADY SUCCEEDED never yielded a URL: the loop ran its
            # full 60-poll backoff and reported "no result". That is the 75-minute stall.
            urls = data.get("resultUrls") or (data.get("response") or {}).get("resultUrls") or []
            if not urls and data.get("resultJson"):
                try:
                    rj = data["resultJson"]
                    rj = json.loads(rj) if isinstance(rj, str) else rj
                    urls = rj.get("resultUrls") or []
                except Exception:
                    urls = []
            if urls:
                url = urls[0]
                break
            if str(data.get("state", "")).lower() in ("fail", "failed", "error"):
                break
        if not url:
            print("FAIL no result %s (retry this slot)" % it["name"])
            failed += 1
            continue
        tmp = d / (it["name"] + ".png")
        try:
            download(url, tmp)
        except Exception as e:
            print("FAIL download %s: %s" % (it["name"], e))
            failed += 1
            continue
        w, h = png_dims(tmp)
        # `slot` now carries the section HEADING (PART B section-relevance rule), so it
        # can no longer double as the size switch it used to be - a heading is never
        # literally "feature", and every image would silently drop to 1000px.
        # `role` is the explicit field; `slot` is still honoured for old manifests.
        role = (field(it, "role") or field(it, "slot")).strip().lower()
        saved = to_webp(tmp, final, 1600 if role in ("feature", "hero") else 1000)
        ok += 1
        entries.setdefault(route, []).append(
            {"file": "/" + saved.relative_to(ROOT).as_posix().replace("public/", ""),
             "alt_text": field(it, "alt"), "outline_section": field(it, "slot"),
             "consistency_id": field(it, "consistency_id"), "width": w, "height": h})
        time.sleep(0.6)  # ~20 req / 10 s throttle
    nb, na = merge_map(entries)
    print("created=%d ok=%d failed=%d skipped(existing)=%d map_entries before=%d after=%d"
          % (created, ok, failed, skipped, nb, na))
    if na < nb:
        print("FAIL asset map shrank - restore from git")
        return 1
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
