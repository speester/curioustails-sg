# K-149: Phone demo back on the WhatsApp section

- **Preview:** https://k132-channel-join.curioustails-staging.pages.dev/ (deployment `d656ec94`, https://d656ec94.curioustails-staging.pages.dev). Project `curioustails-staging`, branch `k132-channel-join`. `x-robots-tag: noindex, nofollow`. **Production untouched.**
- **Owner, 14 Nov:** "WhatsApp, used back the animation from before."

## Change

`scripts/k145-build-channel-stage.mjs` gave the demo to whichever section came **first**. It now has `DEMO_CHANNEL = 'whatsapp'`: that section gets the phone demo wherever it sits, and every other section gets the still strip. `CHANNELS` stays `['telegram', 'whatsapp']`.

| Order | Section | Visual |
|---|---|---|
| 1 | Telegram, "Prefer Telegram? Every post leads with the photo" | still strip, Telegram skin (`data-ch="tg"`, price `#1773ad`) |
| 2 | WhatsApp, "Follow us on WhatsApp, the app you already have" | **the phone demo**, WhatsApp skin (head `rgb(0,128,105)`), the same 7 s loop |

The regenerated `index.html` contains the same lines as before, only moved. Besides the moved blocks, the class swap (`cj-has-demo`/`cj-has-strip`) and the demo's screen-reader line now uses its WhatsApp text, which is the original K-145 wording. CSS, JS, the copy, the tilt, the UTMs and the events are unchanged.

## Acceptance, live (Playwright Chromium, `reports/k145-verify.cjs` + `outputs/k149-demo-whatsapp/inview.cjs`)

| Check | 1440 | 390 |
|---|---|---|
| `scrollWidth` (motion / reduced) | 1440 / 1440 | **390 / 390** |
| Phone demos on page | 1 | 1 |
| Phone frame inside its section | yes (x 957–1251) | yes (x 61–329) |
| Running animations, demo in view | 12 (the one loop) | 12 |
| Running animations, reduced motion | **0** | **0** |
| Reduced-motion end state | ✓ Following, bell on (opacity 1), toast "Following. Notifications are on." | same |
| Hidden content (h2, p, a, li, figcaption, img) | 0 | 0 |
| Sticker tap targets | 223×78 TG, 243×78 WA | 316×78 each |
| Console and page errors | none | none |

At 390 with the page at the top, running animations read 0. That is expected: the demo now sits in the second section, below the fold, and the existing off-screen IntersectionObserver pauses it there. Scrolled into view, it runs (12).

**GA, re-run on the live page with `?ga_test=1`:** `channel_join` was sent for both CTAs by mouse and by Tab+Enter:
`channel=whatsapp section=section_whatsapp environment=staging` and `channel=telegram section=section_telegram environment=staging`. Same-tab path: `click → GA fetch keepalive=true channel_join/whatsapp → pagehide`. Without the opt-in there were 0 collect requests.

**Page weight** (1440, scrolled to the bottom, compared with K-145 flip `a168e933`): 10 → 10 requests. Own bytes 48,982 → 49,020 (**+38 B**). All bytes +811 B, which is Google Fonts response variance. The demo moved; nothing was duplicated.

## Note: K-149 was dispatched twice. The Telegram H2 is now out of sync

A second worker ran the same card in the same working tree. At 22:38 it committed `9648792`, with report `reports/k149-whatsapp-animation-report-2026-11-14.md` and deploy `3e293cfe`. That commit has the same `DEMO_CHANNEL` change, and it **also** changes the Telegram H2 to "On Telegram, every post leads with the photo".

This brief said to leave the copy untouched, so I built and deployed with the committed H2, "Prefer Telegram? …". The result:

| Where | Telegram H2 |
|---|---|
| `scripts/k145-build-channel-stage.mjs` at HEAD | "On Telegram, every post leads with the photo" |
| `_k132_stage/index.html` at HEAD (that commit picked up my rebuild) | "Prefer Telegram? Every post leads with the photo" |
| Live alias (my deploy `d656ec94`, after `3e293cfe`) | "Prefer Telegram? Every post leads with the photo" |

The coordinator has to choose one. To ship "On Telegram": `node scripts/k145-build-channel-stage.mjs`, then deploy `_k132_stage`. To keep "Prefer Telegram?": revert that one line in the generator. Nothing else differs between the two runs.

Evidence: `outputs/k149-demo-whatsapp/live/` (`measure.json`, `inview.json`, full-page and WhatsApp-section screenshots at both widths, with and without motion).
