// kit:middleware@1.0.0 — the ONE place Astro.locals.rhythm is created.
// Every section component (Hero, Section, MotionBand, Separator) calls claimSlot() or
// markTone() against this object to decide its tone band and whether a seam is emitted.
// Without it those components read `undefined.usedVariants` and the build dies on the
// first route, so this file is part of the scaffold, not a page-level concern.
import { defineMiddleware } from 'astro:middleware';
import { createRhythm } from './lib/section-rhythm';

export const onRequest = defineMiddleware((context, next) => {
  // A FRESH rhythm per page: seam variety is a per-page property, and a shared object
  // would make page 2's first seam depend on how many sections page 1 happened to have.
  // seamStart is derived from the path so two pages of equal shape do not open with the
  // identical divider.
  const path = context.url.pathname;
  let h = 0;
  for (let i = 0; i < path.length; i++) h = (h * 31 + path.charCodeAt(i)) >>> 0;
  context.locals.rhythm = createRhythm(h % 9);
  // Citation order is per page too: Sources.astro appends to it, References.astro prints it.
  context.locals.citeOrder = [];
  // Per-page set of raster filenames already placed. Section.astro pulls its own image from
  // public/images/asset-map.json by matching the section HEADING against the outline_section
  // recorded at generation time; without a per-page claim record two sections that share a
  // heading (several pages repeat "Sources") would render the same photograph twice.
  context.locals.usedImages = new Set<string>();
  // Monotonic per-page counter for SectionDecor's SVG pattern ids. decorIndex repeats once the
  // six-motif rotation wraps, so it cannot make a document-unique id on its own.
  context.locals.decorSeq = { n: 0 };
  return next();
});
