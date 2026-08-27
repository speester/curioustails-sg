# Review authenticity: stop-and-check before any review work scales

Found 2026-08-27 while starting Lane 2c (sibling duplication). Not acted on. Needs the owner.

## What I was doing
Lane 2c names the review carousel as the biggest duplicated block across the 48 breed pages, and
the plan's fix is to transcribe more reviews and distribute them evenly. Measuring first showed
the distribution problem is real and fixable today: 10 distinct reviews already exist in the
pages, but two of them appear on 45 pages each while others sit on 1 to 6.

I was about to move all ten into a derived `src/data/reviews.ts` and spread them evenly. I stopped
because of what the extraction showed.

## What I found
**Identical sentences appear under different reviewer names.** Ten sentences are shared across
two or more named reviewers. Examples, verbatim from `src/pages/`:

| sentence | attributed to |
|---|---|
| "Our pup was clean, well-socialised, and full of energy when we brought it home." | Bichonpoo owner, Damon Fong, Karen Joy Pepito, Po Xian Lee |
| "The full vaccination was already covered, which showed how much they care." | Alex Tan, Jaden Chua, Michelle Ng |
| "Everything from the health records to the paperwork was handled seamlessly." | Bichonpoo owner, Karen Joy Pepito, Po Xian Lee |
| "The puppy came home healthy and vet-checked, which gave us real peace of mind." | Damon Fong, Karen Joy Pepito |
| "Honestly, Nelson and Kim couldn't have been more helpful and answered every single question we had, which made the whole thing stress-free." | Damon Fong, Karen Joy Pepito |

Four different people do not write the same sentence. The pattern is consistent with review text
assembled from a pool of fragments and then attributed to named individuals.

**A breed-swapped variant exists.** On `/puppies/bichon-frise/` the review reads "Our search for
the perfect **Bichonpoo** ended the moment we stepped into Curious Tails's Balestier store...",
attributed to "Bichonpoo owner". The same sentence appears on six other pages as "Our search for
the perfect **puppy** ended...", attributed to Po Xian Lee. One of these has been edited, and a
testimonial that has been edited is no longer a testimonial.

**It reaches structured data.** This is the part that raises the stakes. Built output at
`dist/puppies/corgi/index.html` emits a `Product` node containing:

```
review.author.name = "Andrew Mak"
review.reviewBody  = "Couldn't recommend Curious Tails in Balestier enough after ..."
```

So the site is not only displaying the text, it is telling Google in machine-readable form that a
named individual wrote that specific wording. Google's review snippet policy prohibits
fabricated, incentivised or altered reviews, and structured data asserting false authorship is
the version of this with the most exposure.

## What I did NOT do
- Did not redistribute these reviews across pages.
- Did not move them into a shared data file.
- Did not add, edit, reword or delete any review text.
- Did not touch the review schema.

Scaling this content evenly across 48 pages would have multiplied the problem while making it
look tidier, which is the worst available outcome.

## What I need from you, in order
1. **Confirm provenance.** Open the Google Business Profile and compare these ten review texts
   against the real 41 reviews. For each: verbatim, edited, or not a real review.
2. **Anything not verbatim comes off the site**, including out of the structured data. That is a
   same-day fix once you tell me which ones.
3. **Then** the Lane 2c work proceeds properly: real reviews only, copied exactly as written,
   into a derived `src/data/reviews.ts`, distributed so no review lands on more than about a
   quarter of the pages.

If it turns out all ten are genuine and the repetition is coincidence, say so and I will proceed
with the redistribution immediately. I do not think that is what this is.

## Related measurement, for context
`python scripts/sibling_overlap.py` (added this session) measures the real duplication on built
output: mean uniqueness across the 48 breed pages is **79.8%**, and no page falls below the 60%
template-family floor. That is materially better than the 40 to 60% the growth plan assumed, so
the duplication drag is smaller than feared. `--blocks` lists the shared text, and the review
quotes are the top four entries by duplicated word count.
