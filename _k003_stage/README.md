# K-003 Channel join lab

Ten animated Telegram + WhatsApp channel-join modules, shown in a gallery that themes each one to any of the 13 sites.

- Telegram: https://t.me/puppysingapore (the brief gave `http://`; the modules use `https://`, which t.me serves the same)
- WhatsApp channel: https://www.whatsapp.com/channel/0029VaDo1HT9WtCCFm6zUn3b

## Run it locally

```
cd "D:\Claude Code\Curious Tails\outputs\channel-join-lab"
node serve.mjs          # http://localhost:4317
```

Press **Select this design** on a card. Add an optional note and press **Save selection**. The local server writes `selection.json` in this folder:

```json
{ "task": "K-003", "design": "05", "name": "Channel Switch", "site": "curioustails.sg", "note": "...", "at": "2026-11-11T14:41:56.455Z" }
```

That file is what the rollout reads. On the Cloudflare staging preview the page cannot write files, so the pick is saved in that browser only. Use **Copy selection text** and send the text to the coordinator.

## Files

| File | What it is |
|---|---|
| `index.html` | Gallery and the markup for all 10 modules |
| `modules.css` | All 10 designs. Reads only `--cj-*` tokens. This is the stylesheet the rollout ships |
| `lab.js` | Site themes, gallery controls, module behaviour (04 tabs, 05 switch, 07 dock, 08 dismiss, 09 in-view, 10 QR) and selection saving |
| `qr.js` | QR path data for both channel URLs (python `qrcode`, EC level M) |
| `serve.mjs` | Local static server with `POST /api/select` and `GET /api/selection` |

## Facts the copy relies on (checked 2026-11-11)

- Telegram channel "Puppy Singapore": 4.45K subscribers. Each post lists breed, price, gender, age and puppy ID with a photo.
- WhatsApp channel "Puppy Singapore": 1.2K followers.
- 20 Telegram posts between 18 Oct and 11 Nov 2026, so no module says "daily". Follower counts are not in any module because they go out of date. Show them only if they are fetched at build time.

## Built-in quality

- White text on every fill is at least 4.5:1. The Telegram and WhatsApp fills are darkened from the official colours (`#1773ad` 5.13:1, `#0e7a43` 5.41:1); the official colours are kept for glows. Fills that carry text use `--cj-primary-700`. Shih Tzu SG's `#d2540f` is 4.19:1, so the module uses `#b5460c` (5.46:1) there.
- Every tap target is at least 44px tall. Links open in a new tab with `rel="noopener"`.
- Animation uses transform and opacity only. `prefers-reduced-motion` stops every loop.
- Each module is its own size container (`<div class="cj"><div class="cj-NN">`), so it lays out by the space it is given, not by the screen width.
- Tested with Playwright at 1280px and 390px: no horizontal overflow, no script errors, all interactions work, the selection survives a reload.

## Rollout plan (runs after the owner picks)

Sites: curioustails.sg, puppysingapore.com, bichon.sg, cavapoopuppy.sg, chihuahua.sg, corgi.sg, dachshund.sg, maltese.sg, maltipoo.sg, pomeranian.sg, poodle.sg, shibainu.sg, shihtzu.sg.

For each site:

1. Add `src/components/ChannelJoin.astro` with only the chosen module's markup, its icons inlined, and its script if it has one (04, 05, 07, 08, 09, 10).
2. Add `src/styles/channel-join.css` with the shared base plus the chosen design's block from `modules.css`. Map the tokens on `:root` to the site's own tokens, for example `--cj-primary: var(--color-primary); --cj-primary-700: var(--color-primary-700); --cj-ink: var(--color-ink); --cj-font-display: var(--font-display)`.
3. Place it where the owner's note says, or at the design's "best placement" from the gallery. For 07 (floating dock), check each site's existing floating WhatsApp chat button first so they do not overlap.
4. Build, run the site's own gates, deploy to a staging branch (noindex) for review, then to production only after approval.
