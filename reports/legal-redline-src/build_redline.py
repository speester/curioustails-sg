"""Build the K-008 legal redline as Markdown (redline + clean) and Word (tracked changes + comments)."""
import re
import sys
from datetime import datetime, timezone

from docx import Document
from docx.enum.text import WD_COLOR_INDEX
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt, RGBColor

import redline_content as C

OUT_DIR = sys.argv[1]
STEM = f"imported-puppy-legal-redline-{C.DATE}"
AUTHOR = "Curious Tails draft (Claude)"
REV_DATE = datetime.strptime(C.REVISED, "%Y-%m-%d").replace(tzinfo=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

TOKEN = re.compile(r"\[-(.*?)-\]|\{\+(.*?)\+\}", re.S)


def segments(text):
    """Split markup into (kind, text) with kind in keep/del/ins."""
    out, pos = [], 0
    for m in TOKEN.finditer(text):
        if m.start() > pos:
            out.append(("keep", text[pos:m.start()]))
        out.append(("del", m.group(1)) if m.group(1) is not None else ("ins", m.group(2)))
        pos = m.end()
    if pos < len(text):
        out.append(("keep", text[pos:]))
    return out


def original(text):
    return "".join(t for k, t in segments(text) if k != "ins").replace("⟦", "[").replace("⟧", "]")


def clean(text):
    return "".join(t for k, t in segments(text) if k != "del").replace("⟦", "[").replace("⟧", "]")


def brackets(s):
    return s.replace("⟦", "[").replace("⟧", "]")


# ------------------------------------------------------------------ Markdown
def md_redline(text):
    parts = []
    for k, t in segments(text):
        t = brackets(t)
        if k == "keep":
            parts.append(t)
        else:
            # GFM needs the markers flush against text: move edge whitespace outside.
            core = t.strip()
            lead, trail = t[: len(t) - len(t.lstrip())], t[len(t.rstrip()):]
            mark = f"~~{core}~~" if k == "del" else f"<ins>{core}</ins>"
            parts.append(lead + mark + trail if core else t)
    return "".join(parts)


def md_block(kind, val):
    if kind == "p":
        return brackets(val) + "\n"
    if kind == "h2":
        return f"## {val}\n"
    if kind == "ul":
        return "".join(f"- {brackets(x)}\n" for x in val)
    if kind == "ol":
        return "".join(f"{i}. {brackets(x)}\n" for i, x in enumerate(val, 1))
    raise ValueError(kind)


def build_md():
    L = [f"# {C.TITLE}\n", f"**Date:** {C.DATE} · **Revised:** {C.REVISED} (K-068, owner decisions applied) · **Task:** K-008 / T17 · **Status:** DRAFT, not in use\n"]
    L.append("> Legend: ~~struck through~~ = deleted base text · <ins>underlined</ins> = new text · [square brackets] = open decision. "
             "The Word file of the same name carries the same changes as tracked changes, with these notes as margin comments.\n")
    for kind, val in C.COVER:
        L.append(md_block(kind, val))
    for title, clauses in (C.PART_A, C.PART_B, C.PART_C):
        L.append(f"---\n\n## {title}\n")
        for heading, paras, note in clauses:
            L.append(f"### {heading}\n")
            for p in paras:
                L.append(md_redline(p) + "\n")
            L.append(f"> **Note to counsel:** {brackets(note)}\n")
    L.append("---\n\n## Part D. Copy that must change to match\n")
    L.append(C.PART_D_INTRO + "\n")
    L.append("| " + " | ".join(C.PART_D_HEAD) + " |\n|---|---|---|\n" +
             "".join(f"| {w} | {c} | {p} |\n" for w, c, p in C.PART_D))
    L.append("## Part E. Questions for counsel\n")
    L.append("".join(f"- {q}\n" for q in C.PART_E))
    L.append("## Part F. Owner decisions that change the text\n")
    L.append(C.PART_F_INTRO + "\n\n" + "".join(f"- {x}\n" for x in C.PART_F))
    L.append(C.PART_F_OPEN_INTRO + "\n\n" + "".join(f"- {x}\n" for x in C.PART_F_OPEN))
    # Clean version
    L.append("---\n\n# Appendix: clean text (all changes accepted)\n")
    for title, clauses in (C.PART_A, C.PART_B, C.PART_C):
        L.append(f"## {title}\n")
        for heading, paras, _ in clauses:
            L.append(f"**{heading}**\n")
            for p in paras:
                c = clean(p).strip()
                if c:
                    L.append(c + "\n")
    L.append("---\n\n# Appendix: base text as drafted on 2026-11-08 (all changes rejected)\n")
    for title, clauses in (C.PART_A, C.PART_B, C.PART_C):
        L.append(f"## {title}\n")
        for heading, paras, _ in clauses:
            base = [original(p).strip() for p in paras]
            base = [b for b in base if b]
            L.append(f"**{heading}**: " + (" ".join(base) if base else "*(no base text; new clause)*") + "\n")
    return "\n".join(L)


# ------------------------------------------------------------------ Word
_rev_id = [100]


def _next_id():
    _rev_id[0] += 1
    return str(_rev_id[0])


def _run_xml(text, deleted=False, highlight=False):
    r = OxmlElement("w:r")
    if highlight:
        rpr = OxmlElement("w:rPr")
        hl = OxmlElement("w:highlight")
        hl.set(qn("w:val"), "yellow")
        rpr.append(hl)
        r.append(rpr)
    t = OxmlElement("w:delText" if deleted else "w:t")
    t.set(qn("xml:space"), "preserve")
    t.text = text
    r.append(t)
    return r


def _runs_for(text, deleted=False):
    """Split on ⟦⟧ so placeholders get yellow highlight."""
    out = []
    for i, piece in enumerate(re.split(r"(⟦.*?⟧)", text)):
        if not piece:
            continue
        if piece.startswith("⟦"):
            out.append(_run_xml("[" + piece[1:-1] + "]", deleted, highlight=True))
        else:
            out.append(_run_xml(piece, deleted))
    return out


def add_tracked_paragraph(doc, text, style=None):
    p = doc.add_paragraph(style=style)
    for kind, t in segments(text):
        if kind == "keep":
            for r in _runs_for(t):
                p._p.append(r)
        else:
            wrap = OxmlElement("w:ins" if kind == "ins" else "w:del")
            wrap.set(qn("w:id"), _next_id())
            wrap.set(qn("w:author"), AUTHOR)
            wrap.set(qn("w:date"), REV_DATE)
            for r in _runs_for(t, deleted=(kind == "del")):
                wrap.append(r)
            p._p.append(wrap)
    return p


def add_plain(doc, text, style=None, bold_prefix=None):
    p = doc.add_paragraph(style=style)
    for piece in re.split(r"(⟦.*?⟧)", text):
        if not piece:
            continue
        if piece.startswith("⟦"):
            r = p.add_run("[" + piece[1:-1] + "]")
            r.font.highlight_color = WD_COLOR_INDEX.YELLOW
        else:
            p.add_run(piece)
    return p


def build_docx(path):
    doc = Document()
    st = doc.styles["Normal"]
    st.font.name = "Calibri"
    st.font.size = Pt(11)
    doc.core_properties.title = C.TITLE
    doc.core_properties.author = AUTHOR

    doc.add_heading(C.TITLE, level=0)
    add_plain(doc, f"Date: {C.DATE} · Revised: {C.REVISED} (K-068, owner decisions applied) · Task: K-008 / T17 · Status: DRAFT, not in use")
    lg = doc.add_paragraph()
    lg.add_run("Track changes is on. Deletions and insertions are tracked against the 2026-11-08 draft wording; "
               "notes to counsel are margin comments; yellow = open decision.").italic = True

    for kind, val in C.COVER:
        if kind == "p":
            add_plain(doc, val)
        elif kind == "h2":
            doc.add_heading(val, level=2)
        elif kind == "ul":
            for x in val:
                add_plain(doc, x, style="List Bullet")
        elif kind == "ol":
            for x in val:
                add_plain(doc, x, style="List Number")

    for title, clauses in (C.PART_A, C.PART_B, C.PART_C):
        doc.add_page_break()
        doc.add_heading(title, level=1)
        for heading, paras, note in clauses:
            h = doc.add_heading(heading, level=3)
            doc.add_comment(h.runs, text=brackets(note), author=AUTHOR, initials="CT")
            for ptxt in paras:
                add_tracked_paragraph(doc, ptxt)

    doc.add_page_break()
    doc.add_heading("Part D. Copy that must change to match", level=1)
    add_plain(doc, C.PART_D_INTRO)
    tbl = doc.add_table(rows=1, cols=3)
    tbl.style = "Table Grid"
    for cell, txt in zip(tbl.rows[0].cells, C.PART_D_HEAD):
        cell.text = ""
        cell.paragraphs[0].add_run(txt).bold = True
    for row in C.PART_D:
        cells = tbl.add_row().cells
        for cell, txt in zip(cells, row):
            cell.text = txt
    doc.add_heading("Part E. Questions for counsel", level=1)
    for q in C.PART_E:
        add_plain(doc, q)
    doc.add_heading("Part F. Owner decisions that change the text", level=1)
    add_plain(doc, C.PART_F_INTRO)
    for x in C.PART_F:
        add_plain(doc, x, style="List Bullet")
    add_plain(doc, C.PART_F_OPEN_INTRO)
    for x in C.PART_F_OPEN:
        add_plain(doc, x, style="List Bullet")

    # Turn on Track Changes so counsel's own edits are tracked too.
    settings = doc.settings.element
    tr = OxmlElement("w:trackRevisions")
    # CT_Settings sequence: trackRevisions comes after proofState and before defaultTabStop.
    anchor = settings.find(qn("w:defaultTabStop"))
    if anchor is not None:
        anchor.addprevious(tr)
    else:
        settings.append(tr)
    doc.save(path)


if __name__ == "__main__":
    md_path = f"{OUT_DIR}/{STEM}.md"
    with open(md_path, "w", encoding="utf-8", newline="\n") as f:
        f.write(build_md())
    build_docx(f"{OUT_DIR}/{STEM}.docx")
    print(md_path)
    print(f"{OUT_DIR}/{STEM}.docx")
