#!/usr/bin/env python3
"""logo-16px-preview.py - render every logo candidate at 16 and 32 px, plus a contact sheet,
so the 16-px legibility test happens BEFORE the human picks.

    python scripts/logo-16px-preview.py brand/logo-candidates/

Writes <n>-16px.png, <n>-32px.png and _sheet.png next to the candidates.
Prints a PASS/FAIL table; exits 1 when fewer than three candidates were rendered.
Dependency: Pillow (pip install pillow).
"""
import os, sys, glob
from PIL import Image

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


def main():
    folder = (sys.argv[1] if len(sys.argv) > 1 else "brand/logo-candidates").rstrip("/\\")
    if not os.path.isdir(folder):
        print(f"FAIL: {folder} does not exist")
        sys.exit(1)
    files = [f for f in sorted(glob.glob(os.path.join(folder, "*.png")))
             if not f.endswith(("-16px.png", "-32px.png", "_sheet.png"))]
    rows, tiles = [], []
    for f in files:
        base = os.path.splitext(f)[0]
        img = Image.open(f).convert("RGBA")
        for size in (16, 32):
            small = img.resize((size, size), Image.LANCZOS)
            small.save(f"{base}-{size}px.png")
        preview = Image.open(f"{base}-16px.png").resize((128, 128), Image.NEAREST)
        tiles.append((os.path.basename(base), preview))
        # ink coverage of the 16px render: a mark that is nearly empty or nearly solid is mush
        px = Image.open(f"{base}-16px.png").convert("RGBA").getdata()
        ink = sum(1 for p in px if p[3] > 40 and sum(p[:3]) < 720) / 256.0
        readable = 0.06 <= ink <= 0.80
        rows.append((os.path.basename(f), f"ink={ink:.2f}", readable))
    if tiles:
        cols = min(4, len(tiles))
        rows_n = (len(tiles) + cols - 1) // cols
        sheet = Image.new("RGB", (cols * 150, rows_n * 170), (255, 255, 255))
        for i, (name, tile) in enumerate(tiles):
            sheet.paste(tile, ((i % cols) * 150 + 11, (i // cols) * 170 + 11))
        sheet.save(os.path.join(folder, "_sheet.png"))
    print(f"{'candidate':<28}{'16px check':<16}result")
    print("-" * 54)
    for n, v, ok in rows:
        print(f"{n:<28}{v:<16}{'PASS' if ok else 'FAIL (remove from the lineup)'}")
    print(f"\ncandidates={len(rows)} sheet={os.path.join(folder, '_sheet.png') if tiles else 'none'}")
    ok = len(rows) >= 3 and all(r[2] for r in rows)
    print("LOGO_PREVIEW_OK" if ok else "LOGO_PREVIEW_FAIL")
    sys.exit(0 if ok else 1)

if __name__ == "__main__":
    main()
