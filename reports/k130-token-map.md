# K-130 token map: prototype → global.css (compromise C1)

The Biscuit prototype (`outputs/puppy-page-redesign-biscuit.html`) defined its own palette. The template
(`src/components/puppy-page/puppy-page.css`) points every prototype token at the site token with the **identical
oklch value**, so the colours do not move and no new palette is introduced.

| Prototype token | Value | Template reads | Match |
|---|---|---|---|
| `--cream-50/100/200/300/600/700/800/900` | oklch 98%…20% | `--color-cream-*` | exact |
| `--peach-100/200` | oklch 94% .045 55 / 88% .075 52 | `--color-peach-*` | exact |
| `--mint-100/200/300` | oklch 93% .05 165 … | `--color-mint-*` | exact |
| `--lilac-100/300/500/900` | oklch 93% .035 300 … | `--color-lilac-*` | exact |
| `--coral-100/500/600` | oklch 93% .055 40 … | `--color-coral-*` | exact (coral-600 is the 2026-09-05 darkened value in both) |
| `--head` / `--body` | Fredoka / Nunito | `--font-heading` / `--font-body` | exact (same self-hosted files) |
| **`--mint-700`** | **oklch(42% .08 163)** | **kept at the prototype value** | **no global.css token** — needs owner approval: add `--color-mint-700` to global.css, or map to `--color-lilac-700` (a visible colour change on chips, ticks and the placed ribbon) |
| `--wa`, `--wa-hover`, `--wa-edge` | #25D366 … | literal, as everywhere on the site | the site uses the same literals |
| `--card` | #fff | literal | as prototype |

Dropped with the prototype chrome: `.util`, `.hdr`, `.logo`, `.nav`, `.burger`, the prototype footer, `.note`
spec blocks and the `body.is-placed .only-*` toggles (variants are resolved at build time).
