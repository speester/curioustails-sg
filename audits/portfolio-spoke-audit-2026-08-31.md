# Portfolio spoke audit — 2026-08-31

Every domain in `audits/cross-domain-linking-plan.md`, fetched live today, plus a check of
which domains are actually in the owner's Cloudflare account. Raw data:
`audits/portfolio-spoke-audit-2026-08-31.json`.

Method: GET `https://<domain>/`, strip script/style, count words, read `<title>`/`<h1>`, count
JSON-LD blocks, count links to curioustails.sg, and grep for the phone number in both the
correct (8220 6408) and transposed (8220 6480) forms.

| domain | status | words | kind | JSON-LD | links to hub | phone |
|---|---|---|---|---|---|---|
| curioustails.sg | 200 | 3,167 | content | 14 | — (hub) | correct |
| puppysingapore.com | 200 | 3,948 | content | 5 | 0 | not shown |
| cavapoopuppy.sg | 200 | 2,361 | content | 7 | 1 | correct |
| shihtzu.sg | 200 | 3,086 | content | 6 | 1 | correct |
| shibainu.sg | 200 | 2,817 | content | 6 | 1 | correct |
| maltipoo.sg | 200 | 2,650 | content | 7 | 1 | correct |
| dachshund.sg | 200 | 2,459 | content | 6 | 1 | correct |
| bichon.sg | 200 | 2,161 | content | 5 | 1 | correct |
| poodle.sg | 200 | 2,005 | content | 6 | 1 | correct |
| maltese.sg | 200 | 1,951 | content | 5 | 1 | correct |
| chihuahua.sg | 200 | 1,940 | content | 5 | 1 | correct |
| corgi.sg | 200 | 1,868 | content | 5 | 1 | correct |
| puppysg.com | 200 | 343 | thin, no H1 | 1 | 0 | not shown |
| wgpetfarm.com | 200 | 207 | shell, H1 "William Goh" | 1 | 0 | not shown |
| **pomeranian.sg** | **dead** | — | — | — | — | — |
| cavapoo.sg | 200 | client-rendered | **NOT OURS** | 1 | 0 | — |

## Three findings that change the standing plans

### 1. cavapoo.sg is not in this portfolio

It is not among the 33 zones in the owner's Cloudflare account. It is hosted on Netlify and its
title reads "Cavapoo.sg | Premium Cavapoo Puppies in Singapore | **Furgive You Pte Ltd**".

This corrects two documents:

- The 2026-08-31 brief described the Cavapoo SERP as "four domains you own occupy four
  consecutive slots". It is **three** owned pages (puppysingapore.com #9, curioustails.sg #13,
  cavapoopuppy.sg #28) plus one competitor at #19.
- `IMPROVEMENTS-curioustails-2026-08-31.md` items I8/I9 recommend 301-redirecting
  cavapoopuppy.sg into cavapoo.sg because cavapoo.sg "wins every tracked query head-to-head".
  **Do not do this.** It would redirect an owned domain into a competitor's website and hand
  them the traffic. That recommendation was made with the repo location flagged as unknown; it
  is now resolved, and the answer kills the item.

The memory note `domain-portfolio.md`, which lists cavapoo.sg as an owned domain, is also wrong
and has been corrected.

### 2. The spoke → hub links already exist

Eleven spokes each already carry exactly one link to curioustails.sg. The brief's claim that
"zero cross-domain links exist" came from grepping the Curious Tails repo only, which cannot see
outbound links that live in the spokes' own codebases.

So phase §4a of the linking plan is effectively **already shipped**. What remains unbuilt is the
hub → spoke direction (§4b, the `/our-breed-sites/` page) and the entity schema layer (§3a).

### 3. pomeranian.sg is serving a registrar's expired-domain parking template

Its Cloudflare DNS is:

```
A     pomeranian.sg      127.0.0.1
AAAA  pomeranian.sg      ::1
MX    pomeranian.sg      localhost
TXT   pomeranian.sg      "expired"
```

Every working spoke instead has `CNAME <domain> → <slug>.pages.dev, proxied`. The domain lapsed
at some point, was re-registered, and the parking records were never replaced.

There is a scaffolded local repo at `D:\Claude Code\Pomeranian SG` (one commit: "scaffold
pomeranian.sg from template") and **no Cloudflare Pages project** for it. So this is not a DNS
typo to patch — it is an unbuilt site. Pointing DNS at nothing would achieve nothing.

## Other observations

- **Phone number is correct everywhere it appears.** The 8220 6480 transposition bug does not
  survive anywhere in the portfolio. No action needed.
- **wgpetfarm.com is a 207-word shell** whose H1 is a person's name. It is named a T1 sister
  retail brand in the linking plan; it is not currently a site that can carry that role.
- **puppysg.com is 343 words with no H1.**
- The breed spokes deploy to `<slug>.pages.dev` but none of those Pages projects are in this
  Cloudflare account, so they are built from a second account. Worth knowing before anyone tries
  to redeploy one from here.
