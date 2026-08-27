# Measurement baseline, 2026-08-27

The growth plan mandates two numbers, checked monthly. This is the first reading taken
directly rather than quoted from the plan, so future sessions compare like with like.
All figures are Search Console, 28-day window 2026-07-30 to 2026-08-26, taken 2026-08-27.

## Number 1: portfolio clicks

| property | 28d clicks | daily mean | monthly run rate | first 14d -> last 14d |
|---|---|---|---|---|
| curioustails.sg | 472 | 16.9 | **512** | 16.6 -> 17.1 |
| puppysingapore.com | 2,526 | 90.2 | **2,743** | 88.4 -> 92.0 |
| **portfolio** | 2,998 | 107.1 | **3,255** | |

Target 5,000/mo. **Gap 1,745.**

Note the plan's baseline said ~3,400 (510 + 2,900). Curious Tails matches at 512. The
puppysingapore.com figure does not: its true 28-day run rate is 2,743, about 5% below the
plan's estimate. The gap to target is therefore 1,745 rather than 1,600. Not a large
difference, but the plan's Lane 1 assumption of "2,900 to 3,200 on trend alone" starts from a
lower base than written, and the last-14-day trend there is nearly flat (88.4 to 92.0 clicks a
day), not the steep climb the June-to-August history showed.

Curious Tails is also flat over the same window: 16.6 to 17.1 clicks a day. Seven weeks of
history and a 7x rise got it to about 17/day, and it has stayed there for a month.

## Number 2: PRICE cluster median position

Measured 2026-08-27 over the 90-day query export: **129 price queries, 744 impressions,
41 clicks, median position 8.1.**

The plan recorded 126 queries, 700 impressions, 38 clicks, median 8.4. Close enough to confirm
the plan's read; the small differences are the moving 90-day window. Target is median 3.

## What is not measured
GA4 remains unavailable (OAuth scope). Every priority in the plan is ranked on impressions,
positions and SERP evidence with no conversion data behind it. "High buying intent" is still
measured by query language, not by what produced a WhatsApp enquiry. Re-auth with
`python ~/.claude/ga-oauth-setup.py`.

## Reading this against the session's work
Nothing in this session could move either number, because nothing has been deployed. Eleven
commits sit local. These figures are the before, not a result. The next reading worth taking is
roughly three weeks after the batch goes live and is recrawled, and the number to watch first is
the PRICE cluster median rather than clicks, because position moves before traffic does.
