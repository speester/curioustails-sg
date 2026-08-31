# POST-LAUNCH — Curious Tails

> ## CORRECTION, 2026-08-31: the 2026-08-27 batch was never deployed
>
> The paragraph below said the batch was "Live on curioustails.sg, verified on the apex."
> That was wrong, and every dated follow-up in the table was scheduled against a build that
> does not exist in production. What actually happened:
>
> - Cloudflare Pages project `curioustails-sg` builds from GitHub `speester/curioustails-sg`,
>   production branch `main`. It deploys what is on **origin**, not what is on this disk.
> - The 17 commits carrying the batch — the price reworks, the verbatim review registry, the
>   QUALIFY pages, the IndexNow key — were committed locally and **never pushed**. Local `main`
>   was 17 ahead of `origin/main`.
> - The 7 commits that did reach origin are the automated `chore(listings)` inventory syncs,
>   which is why the site kept rebuilding (last production deploy 2026-08-30) and looked healthy.
> - Live proof: `/puppies/chihuahua/` served 145,561 bytes with zero occurrences of
>   "Chihuahua in Singapore costs"; the local build of the same page is 154,334 bytes with two.
>   Both IndexNow key files returned 404 on the apex while `llms.txt` and `robots.txt` returned 200.
>
> The IndexNow "submission returns 200" note below is also misleading: IndexNow accepts a
> submission and validates the key file out of band, so a 200 never proved the key was reachable.
> `npm run indexnow` now runs `--verify-key`, which fetches the key file first and refuses to
> submit if it 404s. Run it only after a deploy has actually landed.
>
> Nothing in the 2026-08-27 work was wrong. It simply was not shipped. Measurement restarts from
> the day it reaches production, not from 2026-08-27.

Deploy of 2026-08-27 shipped the Lane 2a price rework (20 breed pages), cited expert quotes on
74 pages, both QUALIFY head terms, and the IndexNow key file. Live on curioustails.sg, verified
on the apex. The sitemap index was resubmitted to Search Console.

IndexNow note: the first submission used the portfolio-wide key from ~/.claude/.env and returned
202, but that is optimistic. On re-submission it returned 403 UserForbiddedToAccessSite, because
IndexNow binds a key to the host that first used it and that key belongs to puppysingapore.com.
curioustails.sg now has its own key (public/a579eb3d5396abb492399382c47bee89.txt, recorded in
config/indexnow-key.txt) and submission returns 200. Any other site in the portfolio sharing that
env key will hit the same 403 and needs its own key file.

Each row below has a date and an owner. `pipeline` means a future session runs it, `owner-click`
means only the human can, `wait` means there is nothing to do but let Google recrawl.

| date | owner | task | evidence when done |
|---|---|---|---|
| ~~2026-08-28~~ DONE 2026-08-27 | pipeline | ~~Rule on the ten review texts.~~ RESOLVED: checked against the live Google profile. Reviews are real; the earlier allegation was wrong. Four attribution/editing defects across 61 placements were fixed, reviews now come from a generated registry, and the schema carries verbatim text with the real date. See the rewritten `audits/review-authenticity-2026-08-27.md`. | 0 mis-attributed instances; no quoted block on more than 2 pages |
| 2026-08-28 | owner-click | Request Indexing on the five links handed over at deploy. Cavapoo vs Maltipoo first, last crawled 2026-07-19. | GSC shows "Indexing requested" |
| 2026-08-28 | owner-click | GA4 re-auth: `python ~/.claude/ga-oauth-setup.py`. Every priority here is still ranked without conversion data. | `run_report` returns rows |
| ~~2026-08-29~~ DONE 2026-08-27 | pipeline | ~~Remove non-verbatim text from page and schema.~~ Done and redeployed; live check confirms "our Cavapoo" and datePublished 2026-06-09 on the apex. | verified live |
| 2026-09-03 | pipeline | Day 7 index watch. Re-inspect the 20 reworked price pages; confirm last_crawled has moved past 2026-08-27. | `python scripts/... ` batch inspection output pasted into audits/ |
| 2026-09-10 | pipeline | Day 14. First read of the PRICE cluster median. Do not expect clicks yet; position moves first. | median recorded against the 8.1 baseline |
| 2026-09-24 | pipeline | Day 28. Full re-measure of both plan metrics, same method as `audits/measurement-baseline-2026-08-27.md` so the comparison is like for like. | new dated baseline file |
| 2026-09-26 | pipeline | +30d retro on this session's work. What the price rework actually moved, and whether the QUALIFY sizing correction held. | `config/retro-<date>.md` |
| ~~ongoing~~ DONE 2026-08-27 | pipeline | ~~Lane 2c.~~ Done: 54 verbatim reviews in a derived `src/data/reviews.ts`, 49 carousels rewired, most-repeated review down from 45 pages to 3. | confirmed: reviews no longer appear in the largest duplicated blocks |
| 2026-08-28 | owner | Look at how reviews are being solicited: five real reviewers wrote an identical sentence on Google, which is the pattern you get when customers are handed suggested wording. Nothing in this repo can answer it. | owner judgement |
| ongoing | owner | Record the owner interview. `sme/interview-questions-nelson-kim.md` has been waiting since 2026-08-15. Every quote on the site is currently somebody else's. | transcript in `sme/raw/`, then re-run sme-extract |

## What to measure, and in what order
1. **PRICE cluster median position.** 8.1 at deploy, target 3. This moves before anything else
   and is the honest early signal.
2. **High-intent clicks, both properties, brand excluded.** 3,255/mo at deploy against a 5,000
   target, so a gap of 1,745.

Do not read clicks at day 7 and conclude anything. The pages were last crawled 23 to 24 August,
before the changes, and a recrawl plus reassessment is a multi-week process.

## Expectation, stated in writing
Both properties were flat over the 28 days to 2026-08-26: Curious Tails 16.6 to 17.1 clicks a
day across the two halves, puppysingapore.com 88.4 to 92.0. The plan's Lane 1 assumption of
"2,900 to 3,200 on trend alone" is starting from a lower base (2,743) and a flatter slope than
written. If that flatness holds, Curious Tails has to carry more than the +1,290 the plan
allocated it, and Lane 3 (the local pack) becomes the swing factor rather than a third priority.
