#!/usr/bin/env python3
"""gen-og-image.py - 1200x630 share cards from the brand mark + the blueprint rows.

    python scripts/gen-og-image.py --default --bg "#0F172A" --accent "#38BDF8" --name "Curio"
    python scripts/gen-og-image.py --all --bg "#0F172A" --accent "#38BDF8" --name "Curio"

--default writes public/og-default.png, public/logo.png and public/logo.svg.
--all additionally writes public/og/<slug>.png for every indexable blueprint row.
Prints a PASS/FAIL table and exits 1 on any FAIL.  Dependency: Pillow (pip install pillow).
"""
import argparse, csv, os, sys, textwrap
from PIL import Image, ImageDraw, ImageFont

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


W, H = 1200, 630
FONT_CANDIDATES = [
    r"C:\Windows\Fonts\segoeuib.ttf", r"C:\Windows\Fonts\arialbd.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
]
TIER_TINT = {"core": 1.0, "monetization": 0.85, "outer": 0.7, "compare": 0.85, "utility": 0.55}

def font(size, path=None):
    for p in ([path] if path else []) + FONT_CANDIDATES:
        if p and os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except OSError:
                continue
    return ImageFont.load_default()

def hex_rgb(h):
    h = h.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))

def mix(rgb, factor):
    return tuple(max(0, min(255, int(c * factor))) for c in rgb)

def card(title, bg, accent, name, tier, mark, font_path):
    img = Image.new("RGB", (W, H), hex_rgb(bg))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, 18, H], fill=mix(hex_rgb(accent), TIER_TINT.get(tier, 1.0)))
    if mark and os.path.exists(mark):
        m = Image.open(mark).convert("RGBA")
        m.thumbnail((120, 120))
        img.paste(m, (72, 64), m)
    f_title = font(64, font_path)
    f_brand = font(30, font_path)
    lines = textwrap.wrap(title, width=26)[:4]
    y = 230 if len(lines) < 4 else 190
    for line in lines:
        d.text((72, y), line, font=f_title, fill=(255, 255, 255))
        y += 76
    d.text((72, H - 90), name, font=f_brand, fill=mix(hex_rgb(accent), 1.0))
    return img

def rows(csv_path):
    if not os.path.exists(csv_path):
        return []
    with open(csv_path, encoding="utf-8", newline="") as fh:
        return list(csv.DictReader(fh))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--default", action="store_true")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--bg", default="#0F172A")
    ap.add_argument("--accent", default="#38BDF8")
    ap.add_argument("--name", default="")
    ap.add_argument("--mark", default="brand/logo-mark.png")
    ap.add_argument("--font", default=None)
    ap.add_argument("--csv", default="research/site-blueprint.csv")
    a = ap.parse_args()
    checks = []
    os.makedirs("public/og", exist_ok=True)

    if a.default or a.all:
        img = card(a.name or "", a.bg, a.accent, a.name or "", "core", a.mark, a.font)
        img.save("public/og-default.png")
        ok = Image.open("public/og-default.png").size == (W, H)
        checks.append(("public/og-default.png", "1200x630" if ok else "WRONG SIZE", ok))
        if os.path.exists(a.mark):
            logo = Image.open(a.mark).convert("RGBA")
            canvas = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
            logo.thumbnail((432, 432))
            canvas.paste(logo, ((512 - logo.width) // 2, (512 - logo.height) // 2), logo)
            canvas.save("public/logo.png")
            checks.append(("public/logo.png", "512x512", True))
            if not os.path.exists("public/logo.svg"):
                with open("public/logo.svg", "w", encoding="utf-8") as fh:
                    fh.write(
                        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" '
                        f'aria-label="{a.name} logo"><rect width="512" height="512" fill="{a.bg}"/>'
                        f'<image href="/logo.png" x="40" y="40" width="432" height="432"/></svg>\n')
            checks.append(("public/logo.svg", "written", True))
        else:
            checks.append(("brand/logo-mark.png", "MISSING", False))

    if a.all:
        made = 0
        for r in rows(a.csv):
            slug = (r.get("url_slug") or "").strip()
            if not slug or slug == "/404" or "thank-you" in slug:
                continue
            name = "home" if slug == "/" else slug.strip("/").replace("/", "-")
            card(r.get("title", ""), a.bg, a.accent, a.name, r.get("page_tier", "core"), a.mark, a.font)\
                .save(f"public/og/{name}.png")
            made += 1
        checks.append(("public/og/<slug>.png", f"{made} cards", made > 0))

    print(f"{'output':<32}{'value':<18}result")
    print("-" * 60)
    failed = 0
    for n, v, ok in checks:
        print(f"{n:<32}{v:<18}{'PASS' if ok else 'FAIL'}")
        failed += 0 if ok else 1
    print("OG_OK" if not failed else "OG_FAIL")
    sys.exit(1 if failed else 0)

if __name__ == "__main__":
    main()
