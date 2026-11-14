# K-132 — Channel join block (Phone Peek base, die-cut stickers, join animation)

- **Preview:** https://k132-channel-join.curioustails-staging.pages.dev/ (deployment `3df9a25e`, https://3df9a25e.curioustails-staging.pages.dev)
- **Source:** `_k132_stage/` (`index.html`, `channel-join.css`, `channel-join.js`, `puppy-2950.webp`, `_headers`, `robots.txt`)
- **Screenshots:** `outputs/k132-channel-join/`
- Deployed with `wrangler pages deploy _k132_stage --project-name curioustails-staging --branch k132-channel-join`. Production untouched.

## The six items

1. **Layout, Phone Peek kept.** Copy left, phone right on desktop. Headline "New puppies, straight to your phone" and the body "Each post carries a photo with the breed, price, gender, age and puppy ID." kept. The "Puppy Singapore channels" eyebrow is removed with no replacement (`.cj-kicker` absent, checked in the DOM).
2. **Phone animation.** A Telegram channel screen: header with avatar, name and bell, a "Today" chip and one post with a photo and caption (Maltipoo · Male · 2 months · S$3,888 · Puppy ID 2950, taken from the real listing in `src/data/available-puppies.json`, photo `src/assets/live/2950-1-64963ef1.webp`). A touch dot rises to **Join**, presses it (button scales to .94 and darkens), the button crossfades to **✓ Joined**, the dot travels to the bell, presses it, the bell swaps from struck-through to filled with a small ring wiggle and a dot, and a toast reads "Joined. Notifications are on." The WhatsApp option runs the same sequence in WhatsApp colours with Follow → Following. Only `transform` and `opacity` animate; the phone is `aria-hidden`; a polite live text describes the demo for screen readers. The loop pauses while the block is off screen.
3. **Die-cut stickers.** Two links, each a chunky pill with a 6 px white border, flat fill `#229ED9` / `#25D366`, a white glyph disc (plane / bubble), two-line label (Telegram / Join the channel, WhatsApp / Follow the channel) and a flat ink offset shadow. Hover lifts the face 4 px while the shadow drops further; active presses the face onto the shadow. Labels are dark `#111b21` because white fails on both fills (3.02:1 and 1.98:1); dark gives 5.79:1 and 8.80:1. Size: 223–243 × 78 px on desktop, 316 × 78 px at 390.
4. **Selector.** `Telegram | WhatsApp` buttons with `aria-pressed` in a `role="group"`. Selected = dark brand fill, white text and a check mark. At 390 it is a full-width segmented control, two equal halves of 155 px, 48 px tall. On desktop it sits inline above the phone (it switches the phone preview). Left/Right arrows move between options; Tab and Enter work; focus ring is a 3 px ink outline.
5. **Phone on mobile.** The block stacks below 720 px container width (covers every viewport ≤ 640): copy, stickers, selector, then the phone centred and unrotated. At 390 the phone frame is 268 × 520 px at x 61–329, fully inside the viewport, shadow included.
6. **Links.** Taken from the K-003 lab page: `https://t.me/puppysingapore` and `https://www.whatsapp.com/channel/0029VaDo1HT9WtCCFm6zUn3b`, both `target="_blank" rel="noopener"`.

## Measured (live preview, Playwright Chromium)

| Check | 1440 | 390 |
|---|---|---|
| `scrollWidth` / `clientWidth` | 1440 / 1440 | 390 / 390 |
| Console / page errors | none | none |
| Phone frame box | 295 × 533 (rotated 3°), x 932–1227 | 268 × 520, x 61–329 |
| Selector buttons | 153 × 44 each | 155 × 48 each |
| Running animations | 12 | 12 |
| Running animations, reduced motion | 0 | 0 |
| Keyboard: Tab → Telegram, → WhatsApp | `aria-pressed` false/true, `data-ch="wa"` | same |

## Loop and reset

One 7 s loop (all 12 animations share it). 0.3–0.8 s post slides in; 2.0 s tap on Join; 2.2 s Joined; 3.4 s tap on bell, bell on; 3.9–6.0 s toast; 6.2–6.7 s soft crossfade back: the post fades up and out, Joined fades back to Join, the bell fades back to off, toast fades out. Every animated property is either equal at 0 % and 100 % or at opacity 0 at both ends, so there is no visible jump. Choosing the other app restarts the loop from frame 0.

## Reduced motion

The resting CSS of every animated element is the finished state; the keyframes are only attached under `prefers-reduced-motion: no-preference`. With `reduce`, the phone shows the post, **✓ Joined**, the bell on and the toast, unrotated, with no animations (0 running) and no hover transitions on the stickers (hover gets an ink ring instead of a lift).

## noindex

`_headers` serves `X-Robots-Tag: noindex, nofollow` (confirmed on the live response), `robots.txt` is `Disallow: /`, and the page carries `<meta name="robots" content="noindex,nofollow">`.
