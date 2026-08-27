# POST-LAUNCH — Curious Tails

Deploy of 2026-08-27 shipped the Lane 2a price rework (20 breed pages), cited expert quotes on
74 pages, both QUALIFY head terms, and the IndexNow key file. Live on curioustails.sg, verified
on the apex. IndexNow accepted 75 URLs; the sitemap index was resubmitted to Search Console.

Each row below has a date and an owner. `pipeline` means a future session runs it, `owner-click`
means only the human can, `wait` means there is nothing to do but let Google recrawl.

| date | owner | task | evidence when done |
|---|---|---|---|
| 2026-08-28 | owner-click | Rule on the ten review texts in `audits/review-authenticity-2026-08-27.md`. Highest priority: live rich-results inspection shows Review snippets generating on every page checked, so this markup is producing star ratings in search today. | each of the ten marked verbatim / edited / not real |
| 2026-08-28 | owner-click | Request Indexing on the five links handed over at deploy. Cavapoo vs Maltipoo first, last crawled 2026-07-19. | GSC shows "Indexing requested" |
| 2026-08-28 | owner-click | GA4 re-auth: `python ~/.claude/ga-oauth-setup.py`. Every priority here is still ranked without conversion data. | `run_report` returns rows |
| 2026-08-29 | pipeline | Anything the owner marks not-verbatim comes off the page AND out of the Product review schema, same day. Then redeploy. | grep dist for the removed text returns 0 |
| 2026-09-03 | pipeline | Day 7 index watch. Re-inspect the 20 reworked price pages; confirm last_crawled has moved past 2026-08-27. | `python scripts/... ` batch inspection output pasted into audits/ |
| 2026-09-10 | pipeline | Day 14. First read of the PRICE cluster median. Do not expect clicks yet; position moves first. | median recorded against the 8.1 baseline |
| 2026-09-24 | pipeline | Day 28. Full re-measure of both plan metrics, same method as `audits/measurement-baseline-2026-08-27.md` so the comparison is like for like. | new dated baseline file |
| 2026-09-26 | pipeline | +30d retro on this session's work. What the price rework actually moved, and whether the QUALIFY sizing correction held. | `config/retro-<date>.md` |
| ongoing | pipeline | Lane 2c once reviews are ruled on: real reviews only into a derived `src/data/reviews.ts`, none on more than about a quarter of the pages. | `scripts/sibling_overlap.py --blocks` no longer lists a review in the top four |
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
