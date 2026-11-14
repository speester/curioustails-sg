# K-145: Two channel sections (WhatsApp, Telegram) with GA click measurement

- **Preview:** https://k132-channel-join.curioustails-staging.pages.dev/ (deployment `f8f9f15c`, https://f8f9f15c.curioustails-staging.pages.dev). Same preview branch as K-132/K-144, project `curioustails-staging`. **Production untouched**, nothing merged.
- **Source:** `_k132_stage/` (`index.html` is generated, `channel-join.css`, `channel-join.js`, `post-2899.webp`, `post-2954.webp`, `post-3010.webp`, `puppy-2950.webp`, `_headers`, `robots.txt`).
- **Generator:** `scripts/k145-build-channel-stage.mjs` (+ `scripts/k145-channel-icons.svg`, the K-132 sprite verbatim). `node scripts/k145-build-channel-stage.mjs` rewrites `_k132_stage/index.html`.
- **Probe:** `reports/k145-verify.cjs <url> <outDir> [beforeUrl]`. Live output: `outputs/k145-channel-sections/live/` (`full-{1440,390}-{motion,reduced}.png`, `measure.json`, `payload-channel_join.txt`).
- Deployed from inside `_k132_stage` this time, so the root `functions/` folder is no longer bundled into the preview (K-144 note).

## Update: order flipped to Telegram first (coordinator decision, 14 Nov)

- **New order: Telegram first (phone demo, Telegram skin), WhatsApp second (still post strip, WhatsApp skin).** Deployment `a168e933` (https://a168e933.curioustails-staging.pages.dev), alias https://k132-channel-join.curioustails-staging.pages.dev/.
- **The flip follows observed posting activity, not preference.** The public Telegram preview (`t.me/s/puppysingapore`) showed two posts a day, the latest on 14 Nov 2026 at 04:09 and 10:08 UTC. The WhatsApp channel page shows no post dates. The primary slot goes to the channel that is visibly active.
- **Only change:** the one `CHANNELS` array, now `['telegram', 'whatsapp']`, and its comment. The copy for each platform is identical to the original below. There is still one demo, and it sits in the first section.
- Copy note for the owner: the Telegram H2 still opens "Prefer Telegram?", which reads like a second option now that it leads. It is unchanged, as instructed.
- **Re-check on the live deployment** (`outputs/k145-channel-sections/live-flip/`):
  - 390: `scrollWidth` 390/390, with and without reduced motion.
  - Phone frame at x 61–329 and y 449–969, inside its section and below the Telegram sticker. Skin is Telegram blue `rgb(58,127,191)`, and the finished state reads "Joined".
  - Strip under WhatsApp: 3 cards. Stickers are 316×78.
  - 12 running animations with motion and 0 with reduced motion, one phone, no errors, no hidden content.
  - 1440: 1440/1440.
  - With `?ga_test=1`, `channel_join` fired for both CTAs (mouse and Tab+Enter), sending `environment=staging`.
  - `x-robots-tag: noindex, nofollow` is still served.

The sections below describe the original WhatsApp-first build. Every measurement there still holds, apart from the order.

## Page structure

```
main.pv-wrap
├─ section.cj#section_whatsapp        (aria-labelledby cj-wa-title)
│   └─ .cj-k132.cj-has-demo[data-ch=wa]
│       ├─ .cj-copy: h2 · p.cj-sub · ONE sticker a[data-cj-channel=whatsapp]
│       └─ .cj-demo: sr-only description + phone demo (WhatsApp skin, the one 7 s loop)
└─ section.cj#section_telegram        (aria-labelledby cj-tg-title)
    └─ .cj-k132.cj-has-strip[data-ch=tg]
        ├─ .cj-copy: h2 · p.cj-sub · ONE sticker a[data-cj-channel=telegram]
        └─ figure.cj-strip: "What a post looks like" · ul of 3 still post cards · "Sample posts, taken from recent listings."
```

- **Order lives in one place:** `const CHANNELS = ['whatsapp', 'telegram'];` in the generator. The demo goes to whichever section is **first** and the still strip to the second, so a flip never clones the animation. Tested: reversing the array produced `section_telegram` with `cj-has-demo data-ch="tg"` first and `section_whatsapp` with `cj-has-strip` second. Restoring it gave a byte-identical page. The strip's skin also follows the channel (WhatsApp chat beige and green price under `data-ch="wa"`).
- **Segmented control removed:** markup, CSS (`.cj-seg*`) and JS are gone. On the live page at both widths, `.cj-seg, [aria-pressed]` matches 0 elements.
- **Which channel is kept current:** the public Telegram preview (`t.me/s/puppysingapore`) shows posts twice a day, most recently 14 Nov 2026 at 04:09 and 10:08 UTC. The WhatsApp channel page does not show post dates, so I could not check it. I kept WhatsApp first as the brief asks. **If the owner confirms WhatsApp is not posted to as often, flip the one array.**

## Copy, verbatim

**Section 1: WhatsApp**
- H2: **Follow us on WhatsApp, the app you already have**
- Body: It is already on your phone. One tap on Follow and our puppy posts start arriving in your Updates tab. No new app to install, no new account to make.
- Sticker: **WhatsApp** / Follow the channel
- Proof: phone demo, WhatsApp skin. Post, tap Follow, then Following, bell on, toast "Following. Notifications are on."
- Screen-reader text: The phone shows a WhatsApp channel post with a puppy photo, breed, price, gender, age and puppy ID, then a tap on Follow and a tap on the bell to turn notifications on.

**Section 2: Telegram**
- H2: **Prefer Telegram? Every post leads with the photo**
- Body: Each puppy lands photo first, and a tap opens it full-size. Joining shares nothing personal with other members, and you can leave whenever you like.
- Sticker: **Telegram** / Join the channel
- Proof label: WHAT A POST LOOKS LIKE. Three still cards: Cockapoo · Male · 3 months · S$3,488 · Puppy ID 2899 · 10:08 / Cavachon · Male · 2 months · S$4,288 · Puppy ID 2954 · 12:08 / Maltese · Female · S$4,488 · Puppy ID 3010 · 18:08. Note: "Sample posts, taken from recent listings."

The figures come from `src/data/available-puppies.json`. Maltese 3010 has no age in the data, so the card shows none. The photos are cut from `src/assets/live` to 320×360 WebP. I dropped Toy Poodle 2977 because its photo has a burned-in "FOR RESERVATION ONLY" banner. There are no frequency claims, member counts or "first to know" lines. The public Telegram counter (4.45K) is not used.

**Copy lint:** I ran `copy_lint.py` (rtp-v3) on a scratch project with each section as its own route, so C6b compares the two sections directly. Result: **0 fails on C1–C6b, C14 and C15.** The only fails were C9 ("no dateline") on both pages, because the wrapper pages I built for the test have no date. That is not a copy issue.

## GA event spec

| | |
|---|---|
| Event | `channel_join` |
| Fires on | `click` on the section's sticker `<a>` (mouse, touch, **Enter**), plus `auxclick` with the middle button |
| `channel` | `whatsapp` \| `telegram` (from `data-cj-channel`) |
| `section` | `section_whatsapp` \| `section_telegram` (from `data-cj-section`) |
| `environment` | `production` on `curioustails.sg` / `www.curioustails.sg`, otherwise `staging` |
| `page_location` | `location.origin + location.pathname` (query and hash dropped). GA4 treats it as a reserved field, so it arrives as `dl`, not `ep.page_location`. It feeds GA's standard Page location dimension. |
| Personal data | none. No IDs, no hashes, no link text. |
| Outbound URL | `…?utm_source=website&utm_medium=channel_section&utm_campaign=channel_join&utm_content=section_<channel>`. Both tagged URLs resolve with HTTP 200 to "Puppy Singapore". |

**GA guard (kept, not weakened):** the page uses the same hostname test as `BaseLayout.astro`. Off `curioustails.sg` it sets `window['ga-disable-G-S1WGGDQKQ4'] = true` and does not even load gtag.js. The one opt-in is `?ga_test=1`. It clears the flag for that page view and configures with `debug_mode: true`, so every hit carries `ep.debug_mode=true` and `environment=staging`. Measured on the live preview without the opt-in: the flag is `true`, gtag.js is not loaded, and there are **0 collect requests** at both widths.

**Navigation and delivery, measured:**
- The CTAs keep `target="_blank"`, so this page stays alive. GA4 batches the hit and sends it once the new tab hides this page, or after about 5 s.
- Same-tab case (an in-app browser that ignores `_blank`): the click is held with `event_callback` plus an 800 ms `event_timeout` and a 900 ms cap.
- **`event_callback` fires when the hit is queued (about 70 ms), not when it is sent**, so the callback alone proves nothing.
- What delivers the hit is GA4's own `pagehide` flush: `fetch(…, {keepalive: true})`, which outlives the page. CDP does not show requests from an unloading page, so the probe logs GA's fetch calls to localStorage.
- Live, with the opt-in: `click 2483ms → pagehide 4216ms → GA fetch keepalive=true channel_join/whatsapp`.
- Live, guard on: `click → pagehide`, no GA call. The link still navigated, to the UTM-tagged WhatsApp URL.
- I did **not** use a `sendBeacon` fallback of my own: the Measurement Protocol needs an API secret, which cannot go in page code.

**Not registered yet:** the property has two custom dimensions, `wa_source` and `wa_variant`. `channel`, `section` and `environment` must be registered as **event-scoped custom dimensions** before they show in reports. That is a one-time Admin step: the analytics MCP here is read-only.

**No double count with the site handler:** BaseLayout's `whatsapp_click` matches only `wa.me` and `api.whatsapp.com`. The channel URL is `www.whatsapp.com/channel/…`, so it does not fire. GA4 enhanced measurement also logs its own outbound `click` event on these links (seen in the payloads); `channel_join` is the event to report on.

## Observed payload (live preview, `?ga_test=1`, Playwright Chromium)

Every activation sent one `channel_join` POST to `/g/collect`: mouse click on WhatsApp, mouse click on Telegram, and Tab-to-focus + **Enter** on each. Text with fingerprint fields trimmed, from `outputs/k145-channel-sections/live/payload-channel_join.txt`:

```
v=2  tid=G-S1WGGDQKQ4  dl=https://k132-channel-join.curioustails-staging.pages.dev/  dt=Channel Join Sections
en=channel_join  ep.debug_mode=true  ep.channel=whatsapp  ep.section=section_whatsapp  ep.environment=staging
en=channel_join  ep.debug_mode=true  ep.channel=telegram  ep.section=section_telegram  ep.environment=staging
(keyboard run: the same two hits, a new cid)
```

Event order per run: `page_view, channel_join, click, channel_join, click, scroll`. Both popups opened on the tagged URLs.

**DebugView:** I could not take a DebugView screenshot, because DebugView has no API and is not reachable from here. The GA4 realtime API shows 0 `channel_join` for property 530833097, which fits GA keeping `debug_mode` hits out of standard and realtime reports. The evidence is the outgoing payload above. To see it in DebugView, open the preview with `?ga_test=1`, click a sticker, then look at Admin → DebugView.

Separately, two probe hits went out during the investigation, from `127.0.0.1` with `channel=test` and `section=probe`. Both had `debug_mode` and `environment=staging`. Local test clicks (`dl=http://127.0.0.1:8145/`) were also sent with the opt-in.

## The limits, plainly

- **A click is not a join.** `channel_join` measures intent to join. Neither Telegram nor WhatsApp reports back who joined from where. Read it against WhatsApp enquiries later. **Do not call it a join rate.**
- **On staging, without `?ga_test=1`, clicks are deliberately not recorded.** Click measurement starts the day this ships to production. Today's deliverable is the event spec and the observed payload, not a traffic number.
- **The UTM tags are carried but unread today.** Neither channel's stats show referrer UTMs to an admin. They only help if a landing page with analytics ever sits between the click and the channel.

## Acceptance, measured on the live preview (Playwright Chromium)

| Check | 1440 | 390 |
|---|---|---|
| `scrollWidth` / `clientWidth` | 1440 / 1440 | **390 / 390** |
| Same, reduced motion | 1440 / 1440 | 390 / 390 |
| Section boxes | 146–1294 (1148 wide) each | 16–374 (358 wide) each |
| CTAs per section | 1 | 1 |
| Sticker tap target | 243×78 (WA), 223×78 (TG) | 316×78 each (≥48) |
| Phone demos on the page | 1 | 1 |
| Running animations | 12 (the one loop) | 12 |
| Running animations, reduced motion | **0** | **0** |
| Visible content hidden (h2, p, a, li, figcaption, img), reduced motion | 0 | 0 |
| Segmented control / `aria-pressed` | 0 | 0 |
| Console and page errors | none | none |

**Contrast:** title 17.18:1 and body 8.09:1 on the card paper; WhatsApp sticker label 8.80:1; Telegram sticker label 5.79:1. All tokens are unchanged from K-132. New strip text: caption 17.46:1, Telegram price `#1773ad` 5.13:1, meta `#5d6b74` 5.50:1, label and note 8.09:1. In a flipped order, the WhatsApp price `#0e7a43` is 5.41:1.

**Reduced motion:** the phone shows its finished state (post, ✓ Following, bell on, toast) with nothing moving. The strip is still by design. The sticker tilt stays static, as in K-144.

## Page weight delta

Measured over the network on the live preview at 1440, scrolled to the bottom. "Before" is K-144 deployment `a6f4c6e2`.

| | Requests | All bytes | Own bytes (no Google Fonts) |
|---|---|---|---|
| Before (K-132/K-144 one block) | 7 | 97,295 | 26,524 |
| After (two sections) | 10 | 119,727 | 48,956 |
| **Delta** | **+3** | **+22,432** | **+22,432** |

The whole delta is the three strip photos, about 20.9 KB, all `loading="lazy"`, plus HTML +0.9 KB, CSS +0.4 KB and JS +0.2 KB. There is **no second animation**: running animations stay at 12. GA adds nothing on staging without the opt-in. In production, gtag.js is already loaded by BaseLayout, so the section adds no GA weight there.

## Left for the owner

1. Approve the copy, and confirm WhatsApp-first (or flip `CHANNELS`, given Telegram is the channel visibly posted to every day).
2. Register `channel`, `section` and `environment` as event-scoped custom dimensions in GA Admin.
3. Nothing merges into the site until approved. When it does, the click handler and gtag call move into the site build; BaseLayout already provides gtag and the guard.
4. These working-tree files are uncommitted on `k119-content-gap`: `_k132_stage/*`, `scripts/k145-*`, `reports/k145-*`, `outputs/k145-channel-sections/`.
