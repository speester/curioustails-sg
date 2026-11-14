# K-074 report — Biscuit's passport, About, link chips, vaccine copy, sync date

**Date:** 2026-11-13 · **Scope:** `outputs/puppy-page-redesign-biscuit.html` and its staging bundle `_k002_stage/` only. No Astro source, data file, other page or the live site was changed.

## Diff summary per section

| § | Change |
|---|---|
| 1 | Passport: removed `<small>puppy feed DOB column</small>`, `<small>computed from her 4 August 2026 birth</small>`, the whole `Going home` row, and the `§2 PASSPORT FACTS` developer note. |
| 2a | Passport rebuilt as one `<article class="passport">`: ID label → name (`Biscuit's passport`) → one-line descriptor (`Apricot Maltipoo girl · About 3 months`) → 2×2 fact grid **Sex / Colour / Microchip / Born** (2 columns at every width) → a hairline-separated secondary row with the facts that were already on the card (Breed, Origin, HDB flat, Grown size). One 2px `--cream-300` border, one soft shadow (the `.clay` triple shadow was dropped), max-width 760px, centred. Labels are small caps in `--cream-600`; values Fredoka 500. No empty rows, no `<small>`s left. |
| 2b | About: lead sentence in Fredoka at `clamp(1.3rem,2.2vw,1.6rem)`; the old two paragraphs split into four short ones at `max-width:58ch` (measured ≈ 69 characters a line at 1440); one pull element **“HDB approved — HDB allows one dog of an approved breed per flat.”** — the headline fact is on the page in the chips, the passport and the FAQ, and the supporting line is the FAQ sentence verbatim, so nothing is inferred. Section top padding raised to 80/120px so it reads as its own block after the peach passport band. |
| 3 | The inline `Temperament · Size and coat · HDB rules · Grooming` line moved out of the “Think twice” card into a full-width `<nav class="more-links">` with heading **More about the Maltipoo** and four equal chips (2 per row mobile, 4 across ≥768px), chevron, hover (coral border/fill, 2px lift, chevron nudge) and a 3px `--lilac-500` `:focus-visible` ring. Hrefs and labels unchanged. |
| 4 | Timeline: `Week 16 · optional 4th` → **`Week 16 · 4th Vaccine`**; supporting line “Only if your vet advises extra early protection” contradicted the label, replaced with “The 4th core puppy vaccination”; dashed “optional” node style removed. FAQ answer on the same page updated to match (“The 4th core vaccination follows at 16 weeks…”). Vet card copy already matched the requested text exactly; both numbers are `tel:` links. Inclusions sentence now includes “a free first training lesson with an AVS-certified trainer”; bank-surcharge sentence unchanged (mobile short version also mentions the lesson). |
| 5 | Hero date and the FAQ “Is Biscuit still available?” answer are now rendered from `syncedAt` by `outputs/build-biscuit-stage.py`. |

## The three removed notes — before / after

| Before | After |
|---|---|
| `<dt>Born</dt><dd>4 August 2026<small>puppy feed DOB column</small></dd>` | `<dt>Born</dt><dd>4 August 2026</dd>` |
| `<dt>Age</dt><dd>About 3 months<small>computed from her 4 August 2026 birth</small></dd>` | `About 3 months` now sits in the descriptor line (`only-av`), no note |
| `<dt>Going home</dt><dd>Ready to go home<small>week 9 · 6 October 2026</small></dd>` | removed entirely |
| `<p class="note">§2 PASSPORT FACTS · PuppyPassport. Born reads the puppy feed's DOB- column…</p>` | removed |

## Date-rendering code (`outputs/build-biscuit-stage.py`)

```python
SGT = timezone(timedelta(hours=8))
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
STALE_AFTER = timedelta(days=7)

def parse_synced_at(raw):
    if not isinstance(raw, str) or not raw.strip():
        return None
    try:
        dt = datetime.fromisoformat(raw.strip().replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        return None
    return dt.astimezone(timezone.utc)

def render_synced(synced, now):
    if synced is None:
        return {"hero": "", "faq": ""}          # missing/unparseable -> date omitted
    local = synced.astimezone(SGT)
    label = f"{local.day} {MONTHS[local.month - 1]} {local.year}"
    iso = synced.strftime("%Y-%m-%dT%H:%M:%S.") + f"{synced.microsecond // 1000:03d}Z"
    stale_attr = "" if now - synced > STALE_AFTER else " hidden"
    return {
        "hero": (f'<span>· <span data-synced-at="{iso}">Listing synced '
                 f'<time datetime="{local.date().isoformat()}">{label}</time></span>'
                 f'<span class="stale" data-stale{stale_attr}> · may be out of date</span></span>'),
        "faq": f' The listing was last synced on <time datetime="{local.date().isoformat()}">{label}</time>.',
    }
```

The fragments are written between `<!--synced:hero-->…<!--/synced:hero-->` and `<!--synced:faq-->…<!--/synced:faq-->` markers. The page script only reveals the stale suffix, it never prints a date:

```js
const synced = $('[data-synced-at]');
if (synced) {
  const t = Date.parse(synced.dataset.syncedAt);
  if (Number.isFinite(t) && Date.now() - t > 7 * 864e5) $$('[data-stale]').forEach(el => { el.hidden = false; });
}
```

Tested cases: `None`, `''`, `'garbage'`, `'2026-11-10'` (no zone) → date omitted; `2026-11-10T20:00:00Z` → `11 Nov 2026` (SGT rollover), suffix hidden; current `2026-11-01T06:29:22.239Z` → **`Listing synced 1 Nov 2026 · may be out of date`** (12 days old).

## Phone links

- `tel:+6565691627` → “6569 1627” (Vets For Pets Jurong); `tel:+6582684039` → “8268 4039” (Vets For Pets Lengkok Bahru).
- The rest of the site (`src/`, `config/`, `public/`, `dist/`, live `curioustails.sg` home) carries **no clinic phone numbers at all**: it names Vets For Pets as partner vet only. The only other source is the owner's copy in `reports/puppy-page-owner-feedback-addendum-2026-11-08.md`, which matches both numbers exactly. No conflict found. (That addendum still lists checking the numbers against the clinic's own listings as an open owner item.)

## Deploy

- Project `curioustails-staging`, environment **production**, branch `main`
- Final deployment id **`f73d21ee-2a4a-40d4-9fd0-c63f5a9cfb00`** · https://f73d21ee.curioustails-staging.pages.dev
- Live: https://curioustails-staging.pages.dev/outputs/
- Supersedes the first-pass deploy `b427eb9f-5d31-4ed3-a4fc-df8f284cba63` (same page before the pull-line source fix).
- Bundle includes the project's `functions/_middleware.js` (www → apex redirect only), same as the K-002 deploy `4865d373`. 51 files, 1 changed (`outputs/index.html`).

## Verification (live, after the final deploy)

- `/outputs/`, `/`, `/robots.txt` and the deployment URL: `200`, `X-Robots-Tag: noindex, nofollow`; robots.txt `Disallow: /`; `<meta name="robots" content="noindex">` present.
- Served page 117,242 bytes, SHA-256 `23a53a0b1e2b27ecff03cfea32c549fa734e66aa83dea01bbc3ffed0de48db0d`, byte-identical to the source and to `_k002_stage/outputs/index.html`, no BOM.
- `Â`/`â€`/`â˜…`/U+FFFD × 0; `›` × 3, `★` × 20, `·` intact.
- Removed from the passport, × 0: `puppy feed DOB column`, `computed from her`, `Going home`, `week 9 · 6 October 2026`, `optional 4th`, `checked 1 Nov`. (`ready to go home · 6 October 2026` intentionally remains in the vaccination timeline, outside K-074's scope — see flags.)
- 1440×1000 and 390×844: 0 console errors, 0 page errors, `scrollWidth === clientWidth`; passport grid 2 columns at both widths (151px ×2 at 390, 326px ×2 at 1440); secondary fact row 2 columns at 390, 4 at 1440; chips 4 columns at 1440, 2 at 390; chip hover changes border, fill, 2px lift and 3px chevron nudge; `:focus-visible` ring `3px solid` with 3px offset.
- Sync line live: `Available now · Balestier · Listing synced 1 Nov 2026 · may be out of date`; FAQ: `The listing was last synced on 1 Nov 2026.`

Screenshots (live, `reports/k074-shots/`; fixed site chrome hidden for region shots): `passport-1440.png`, `passport-390.png`, `about-1440.png`, `about-390.png`, `chips-1440.png`, `chips-390.png`, plus `chips-focus-1440.png`, `chips-focus-390.png` (keyboard focus ring) and `hero-1440.png`, `hero-390.png` for the sync line. Raw measurements in `reports/k074-shots/verify.json`; scripts in `reports/k074-tools/`.

## Left as is (flag)

- The vaccination timeline's week-9 row still reads “About a week after the 2nd vaccination · 6 October 2026 for Biscuit” (derived from DOB; not in the K-074 scope list).
- The hidden `§4 HEALTH RECORD` design note still quotes business-context.md's “optional 16” schedule; it is `display:none` and was not edited. Business-context.md itself is not updated.
- Rebuild: `python outputs/build-biscuit-stage.py`, then `wrangler pages deploy _k002_stage --project-name curioustails-staging --branch main`.
