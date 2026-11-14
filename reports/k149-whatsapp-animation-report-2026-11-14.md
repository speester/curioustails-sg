# K-149 — Phone animation back on the WhatsApp section

- **Preview:** https://k132-channel-join.curioustails-staging.pages.dev/ (deployment `3e293cfe`, https://3e293cfe.curioustails-staging.pages.dev). Project `curioustails-staging`, `x-robots-tag: noindex, nofollow` confirmed live. **Production untouched.**
- **Source:** `scripts/k145-build-channel-stage.mjs` → `_k132_stage/index.html`. CSS and JS unchanged.
- **Evidence:** `outputs/k149-whatsapp-animation/live/` (`full-{1440,390}-{motion,reduced}.png`, `phone-in-view-390.png`, `measure.json`), probe `reports/k145-verify.cjs`.

## What changed

| Order | Section | Visual |
|---|---|---|
| 1 | Telegram, "On Telegram, every post leads with the photo" | still post strip (Telegram skin: chat green `#dbe6cf`, price `#1773ad`) |
| 2 | WhatsApp, "Follow us on WhatsApp, the app you already have" | **the phone demo** (WhatsApp skin `#008069`, Follow → Following) |

- **Which section owns the demo** is now its own constant, `DEMO_CHANNEL = 'whatsapp'`. Before, it was implied by position ("first section"). Order is still the one `CHANNELS = ['telegram', 'whatsapp']` array, unchanged. Every section that is not `DEMO_CHANNEL` gets the strip, so the page can only ever carry one loop.
- **Telegram H2 reworded.** It was **"Prefer Telegram? Every post leads with the photo"**, which read as a second option after the flip. It is now **"On Telegram, every post leads with the photo"**: it states the thing instead of asking a preference.
- **The WhatsApp H2 is not touched.** Body copy, sticker labels, tilt (Telegram −3°, WhatsApp 2.5°, measured live), UTMs and `channel_join` wiring are unchanged. Only the WhatsApp block moved within the page; its text is identical.

## Measured on the live preview (Playwright Chromium)

| Check | 1440 | 390 |
|---|---|---|
| `scrollWidth` / `clientWidth` (motion and reduced) | 1440 / 1440 | **390 / 390** |
| Phone demos on the page | 1 (in `section_whatsapp`) | 1 (in `section_whatsapp`) |
| Phone frame, inside its section | x 970–1238, inside | x 61–329, inside (no clipping) |
| Running animations, phone in view | 12 | 12 |
| Running animations, reduced motion | **0** | **0** |
| Sticker tap targets | 223×78 (TG), 243×78 (WA) | 316×78 each |
| Strip cards (Telegram) | 3 | 3 |
| Hidden content (h2, p, a, li, figcaption, img) | 0 | 0 |
| Segmented control | 0 | 0 |
| Console and page errors | none | none |

At 390 the demo is below the fold, so on load all 12 animations are **paused**, not running: the existing IntersectionObserver idles the loop off screen. When the phone is scrolled into view, all 12 run (`phone-in-view-390.png`). The plain 390 row of the probe therefore reads 0 running, which is the designed pause, not a failure.

**Reduced motion, finished state visible** (computed, both widths):
- "✓ Following" shown (opacity 1); "Follow" hidden (opacity 0).
- Bell on shown (1); bell off hidden (0).
- Toast "Following. Notifications are on." shown (1); post shown (1).

The hidden pieces are the swapped-out start states, by design. WhatsApp's wording for "Joined" is "Following".

## GA, re-run on the live preview (`?ga_test=1`)

One `channel_join` fetch POST was sent to `tid=G-S1WGGDQKQ4` for every activation:

```
en=channel_join  ep.channel=whatsapp  ep.section=section_whatsapp  ep.environment=staging  ep.debug_mode=true  dl=https://3e293cfe.curioustails-staging.pages.dev/
en=channel_join  ep.channel=telegram  ep.section=section_telegram  ep.environment=staging  ep.debug_mode=true  dl=https://3e293cfe.curioustails-staging.pages.dev/
```

- **Mouse:** both hits above, and both popups opened.
- **Tab+Enter:** the same two hits, with a new client.
- **Same-tab path, opt-in:** `click 2511ms → GA fetch keepalive=true channel_join/whatsapp 2526ms → pagehide 3318ms`.
- **Without the opt-in:** 0 collect requests at both widths; the same-tab path logged `click → pagehide` with no GA call. The guard holds.

## Page weight delta

Network at 1440, scrolled to the bottom. "Before" is K-145 flip deployment `a168e933`.

| | Requests | All bytes | Own bytes |
|---|---|---|---|
| Before (demo on Telegram) | 10 | 120,129 | 49,361 |
| After (demo on WhatsApp) | 10 | 119,739 | 48,971 |
| **Delta** | 0 | **−390** | **−390** |

The delta is neutral, as expected: same assets, the demo moved and was not duplicated. The 390 bytes is HTML (the shorter H2 and the moved block) plus transfer variance.

## Notes

- The `DEMO_CHANNEL` edit in the generator was already on disk, uncommitted, when I started. It matched the intended change, so I kept it as is. My only generator edit was the Telegram title.
- The limits from K-145 still apply. A click is not a join. On staging without `?ga_test=1`, clicks are deliberately not recorded. `channel`, `section` and `environment` still need registering as custom dimensions.
