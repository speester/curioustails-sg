# Review authenticity: checked against Google, and resolved

Opened 2026-08-27 with a serious allegation. Checked against the live Google Business Profile the
same day. **The allegation was wrong on its main point, and this file has been rewritten to say so.**

## What I claimed, and why it was wrong

I found ten sentences appearing verbatim under two or more different reviewer names on the site,
and inferred that the review text had been assembled from a pool of fragments and attributed to
named individuals. The inference rested on one premise: four different people do not write the
same sentence.

That premise is false here. I pulled all 56 reviews from the Google Business Profile via the
DataForSEO Business Data API (saved to `sme/raw/google-reviews.json`) and ran the same analysis on
the real reviews. **Twenty-five sentences appear under more than one real reviewer name on Google
itself.** For example, "We loved the aftercare support; you can tell they truly care about the pups
and the owners" was written by five separate real reviewers: Andrew Mak, Andy Liew, GH,
Patricia Lim and mei siang gan.

The site was reflecting Google accurately. The reviews are real.

(Worth the owner's attention separately: the phrasing overlap on Google is itself unusual, and is
the sort of pattern that appears when customers are handed suggested wording. That is a question
about how reviews are solicited, not about the website, and it is not something this repository
can answer.)

## What was genuinely wrong

Four defects, 61 page placements. All attribution or editing, none fabrication.

| defect | placements | detail |
|---|---|---|
| Karen Joy Pepito's card showed **Damon Fong's** review | 14 | real text, wrong name |
| "Bichonpoo owner" showed **Po Xian Lee's** review | 1 | real text, attribution replaced with a non-name |
| Jaden Chua's review silently **grammar-edited** | 40 | real reads "Nelson **were** professional and reassuring and were attentive"; the site had cleaned it up |
| Po Xian Lee's review **breed-genericised** | 6 | real reads "the perfect **Bichonpoo**"; the site said "the perfect **puppy**" |

Plus two more found while fixing:

- The shared `featuredReview` constant in `src/lib/schema.ts`, emitted into Product structured data
  on 42 breed pages, carried the same genericised edit ("our puppy" for "our Cavapoo") and a
  `datePublished` of **2024-07-01**. The real review was posted **2026-06-09**. Nobody wrote that date.
- `site.reviews.count` said **41**. Google shows **56**. The site was under-selling itself on every page.

## What was done, 2026-08-27

1. `scripts/build_reviews.py` generates `src/data/reviews.ts` from the Google pull. 54 usable
   reviews, verbatim, with each reviewer's own name. The script does no grammar cleanup, no breed
   swapping and no re-attribution, and says so in its header.
2. `scripts/wire_reviews.py` repointed all **49 review carousels** at `testimonialsFor(slug)`, a
   deterministic evenly-spread selection. Hand-pasted review cards are gone, so the two
   mis-attributions and two edits cannot recur by construction.
3. The schema constant and its 42 page copies now carry Andrew Mak's verbatim text and the real
   posting date.
4. Review count corrected to 56.

### Measured result

- Mis-attributed or edited review instances: **0** (was 4 distinct, 61 placements).
- Most-repeated review: **3 pages** (was 45).
- No quoted block anywhere in `dist/` now appears on more than **2 pages** (the top four were all
  reviews before; they are now ordinary boilerplate).
- Reviews no longer appear among the largest duplicated blocks at all.

Mean page uniqueness reads 78.4%, essentially unchanged from 79.8%, and that is honest: the metric
counts a block as shared if it appears on two pages or more, so spreading reviews from 45 pages to
3 barely moves it. The number that matters for near-duplicate detection is the concentration, and
that fell by a factor of fifteen.

## Still open for the owner
Nothing on authenticity. Two unrelated items:

1. The Google phrasing-overlap question above, if you want to look at how reviews are being asked for.
2. Review velocity for Lane 3 (the local pack). 56 reviews at 5.0 against Cotton Pups at 84,
   The Lovely Pets at 237 and Dawgs & Co at 187.

## Note on the original error
The evidence I had was real and the pattern was worth stopping for. The mistake was treating a
strong inference as a finding before checking it against the source that could settle it, when
that source was one API call away. Halting the work was right; stating it as fact was not.
