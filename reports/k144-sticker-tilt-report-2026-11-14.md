# K-144 — Tilt the two channel stickers

- **Preview:** https://k132-channel-join.curioustails-staging.pages.dev/ (deployment `a6f4c6e2`, https://a6f4c6e2.curioustails-staging.pages.dev). Same preview branch as K-132, project `curioustails-staging`. Production untouched.
- **Source:** `_k132_stage/channel-join.css` only (no markup, copy or JS change). Pre-change copy kept in git (`3d4b373`).
- **Screenshots:** `outputs/k144-sticker-tilt/` (local) and `outputs/k144-sticker-tilt/live/` (live preview): `stickers-<w>-<motion>[-hover-tg|-active-tg].png`, `full-<w>[-reduced-motion].png`. Raw numbers: `outputs/k144-sticker-tilt/live/measure.json`. Probe: `reports/k144-verify.cjs`.

## What changed

- `.cj-stk` carries the tilt through the independent `rotate:` property: Telegram `--cj-tilt: -3deg`, WhatsApp `--cj-tilt: 2.5deg`. The face and its children keep their own `transform`, so the hover lift and press still compose.
- The tilt sits on `.cj-stk`, not `.cj-stk-face`. In the markup the shadow `.cj-stk-sh` is a **sibling** of the face (both children of `.cj-stk`), so rotating the face alone would have left the shadow upright. Measured: the Telegram shadow sits at (+4.3, +5.8) from the face, which is (4, 6) rotated −3°. The WhatsApp shadow sits at (+3.7, +6.2), which is (4, 6) rotated +2.5°. The shadow stays attached.
- **Hover** (`hover: hover` only): `rotate: calc(var(--cj-tilt) / 3)` (−1° / +0.83°), face `translateY(-4px)`, shadow drops to (5, 9). The sticker peels up and straightens a little. It never tilts further. The old `rotate(-1deg)` in the face transform is removed.
- **Active:** `rotate` returns to the full tilt (0.08 s). The face presses onto the shadow `translate(3px, 4px)`.
- **Reduced motion:** the static tilt stays (−3° / 2.5°). Transitions are `none`. Hover and press do not change rotate or transform, and hover keeps the K-132 2 px ink ring.
- **Narrow container (≤720):** `.cj-stickers` gap 16 → 28 px and padding `0 6px 6px 0` → `6px 6px 12px 0`. The left ends of the two full-width pills lean toward each other, so the extra gap keeps the visible face-to-face gap at 16.6 px, the same as before the tilt.

## Measured (live preview, Playwright Chromium)

| Check | 1440 | 390 |
|---|---|---|
| `documentElement.scrollWidth` / `clientWidth` | 1440 / 1440 | **390 / 390** |
| Same, reduced motion | 1440 / 1440 | 390 / 390 |
| Computed `rotate` tg / wa | −3deg / 2.5deg | −3deg / 2.5deg |
| Sticker layout size (tap target) | 223×78, 243×78 | 316×78 each (≥48) |
| Rotated tg box incl. shadow, right edge | 431 | 356 (inside 390) |
| Closest face-to-face gap tg↔wa | 22.3 px | 16.6 px |
| tg shadow → wa face | 18.2 px | 10.9 px (no overlap) |
| Clipping ancestors (overflow hidden/clip) | none | none |
| Hover tg: rotate / face | −1deg / translateY(−4) | same |
| Active tg: rotate / face | −3deg / translate(3, 4) | same |
| Reduced motion: hover rotate / face / running animations | −3deg / none / 0 | same |
| Label / fill colours | #111b21 on #229ed9 / #25d366 (unchanged: 5.79:1, 8.80:1) | same |
| Console / page errors | none | none |

## noindex

Live `x-robots-tag: noindex, nofollow`. `robots.txt` is `Disallow: /`, and the meta robots tag is unchanged.

## Notes

- At 1440 the rotated Telegram end rises about 2 px above the `.cj-stickers` padding box. Nothing clips it (no overflow ancestor) and 30 px of margin sits above, so desktop padding is unchanged.
- `wrangler pages deploy` was run from the project root, so it also bundled the root `functions/` folder. This is the same as the K-132 deploy, on the staging project only.
