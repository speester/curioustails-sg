---
name: image-gen
description: >
  Generates a cohesive set of photorealistic website images via kie.ai. Derives
  HOW MANY images and WHICH scenes from the page-brief outline, produces
  art-directed prompts (consistent camera/lighting/palette), then runs them
  through kie.ai (create -> poll -> download) and saves WebP into the Astro
  project. Use when a page needs images, or "generate images for [page]".
---

# Image Generation (outline-driven prompt engine + kie.ai runner)

## Variables this skill needs (resolve from project-config.md)
COUNTRY, PRIMARY_CITY, BUSINESS_TYPE, WORDS_TO_AVOID, OWNER_NAME,
KIE_AI_ENV (env name for KIE_API_KEY), KIE_AI_MODEL (e.g. nano-banana-2).
Reads: briefs/<slug>.json (the page brief — this drives image COUNT + scenes),
research/items/<slug>.md (ground truth for accurate subject/scene detail).
PER-RUN INPUTS (resolved from the brief unless overridden):
PAGE_SUBJECT, SECONDARY_KEYWORD (for alt text).
WRITES: src/assets/<page>/<n>-<slug>.webp + an alt-text/asset map JSON.

If briefs/<slug>.json is missing, STOP — run page-brief first.

## PART 0 — DERIVE THE IMAGE COUNT FROM THE OUTLINE (new)
Do this before planning visuals. The number of images is NOT fixed.

1. Walk the brief's content_outline in order. Mark a section as IMAGE-BEARING
   when ANY of these is true:
   - its ux_note names an image-bearing component (hero, captioned-block,
     comparison-split with imagery, listing/product grid, gallery, lifestyle,
     image block, video-with-poster, before/after), OR
   - it is the Hero, a primary showcase/inventory block, an About/brand-story
     section, a testimonial/social-proof block, or a final CTA section, OR
   - its cro_element clearly benefits from a supporting visual (e.g. a visual
     break to reset scroll fatigue).
   Sections that are pure text, FAQ accordions, schema-only, pricing tables, or
   nav/summary are NOT image-bearing.

2. Assign image SLOTS:
   - Hero: exactly 1 (always). It must be the highest-impact image.
   - Listing/product grid: 1 representative image per displayed item UP TO the
     grid's default item count in the brief (cap at 6 unless the brief specifies
     more). If items reuse a shared subject, still generate distinct scenes.
   - Every other image-bearing section: 1 image each (a section may request 2
     only if its ux_note explicitly needs a pair, e.g. before/after).

3. Apply floors and caps so the set stays cohesive and cost-sane:
   - Minimum 4 images (Hero + at least 3 supporting), even on short pages.
   - Soft cap 16 images per page. If the outline implies more, keep the Hero,
     all listing items, and then the highest-value supporting sections by
     cro_phase priority (Phase 1 and Phase 4 proof first), and DROP the rest.
     Report which sections were dropped for imagery and why.
   - Round the total so the variety mandates in Part B remain satisfiable
     (e.g. if total < 6, relax the "≥5 zero-people / ≥3 outdoors" mandates
     proportionally — see Part B note).

4. Output an IMAGE PLAN before generating anything:
   N = derived count. A table of: slot # -> outline section heading -> section
   type -> intended scene one-liner -> aspect_ratio (from the section's role:
   Hero 16:9 desktop + optional 9:16 mobile; listing 1:1 or 4:3; blog header
   3:1; everything else 16:9) -> resolution (Hero 3840x2160; Feature/About/
   Lifestyle/Portfolio 2560x1440; others 1280x720).
   Confirm N out loud, e.g. "<!-- IMAGE PLAN: 9 images derived from 12-section
   outline -->", then proceed.

## PART A — Silent planning (do not print; locks values for ALL N prompts)
1. Subject physical lock: name the subject with 2–3 distinguishing traits that
   separate it from look-alikes; realistic size in cm/kg; coat/colour in a
   paint-brand reference; eye/nose/detail colours. Any later prompt that
   contradicts this fails validation. Lock age-appropriate surface language if a
   developmental stage applies (e.g. juvenile animal coat).
2. Series visual lock: 3–4 named palette colours appearing across the whole set;
   one Kelvin lighting range all images fall within; a consistency_id string
   "subject-COUNTRY-#HEX1-#HEX2-[Krange]-v1".
3. Location vocabulary: name 5–8 specific [COUNTRY/CITY] locations with real
   surface materials + atmospheric conditions (need only enough to cover N
   unique scenes). Banned: generic "a living room/park/studio/cafe/street/store".
4. Camera assignment across the N images: max 2 uses per camera body, never
   consecutive; varied framing/perspective; no two near-identical compositions.
5. Micro-moments for any people scenes: one unique asymmetric physical detail
   each, no repeats. People depicted as caregiver/owner/family, unnamed.
6. Failure-risk note: top 3 likely generation failures for this subject +
   context, and the prompt sentence mitigating each.

## PART B — Core prompt rules (every prompt)
- Owner exclusion: NEVER depict OWNER_NAME or any named real individual.
  Substitute caregiver/lifestyle/unnamed-staff scenes.
- No commercial storefront / retail counter / shop signage scenes (they render
  fake). Convey credibility through lifestyle imagery in named real locations.
- Whole-person framing: if a scene includes ANY human contact (lap, holding,
  hands-on care, grooming), the prompt must first establish the person as a
  complete figure — state "face, shoulders and torso fully in frame" plus age
  band, hair and clothing — BEFORE describing their hands or lap. Prompts that
  reference only a lap/hand/arm reliably generate disembodied limbs with no
  visible person (verified failure: pricing aftercare lap-check image,
  2026-07). Never anchor a people-scene on an anonymous body part.
- Realism: start every prompt "Photograph shot on [camera body].". Describe
  materials, surfaces, light interactions. Name a real film stock + its colour
  science. Positive framing only — never "no/not/without/avoid".
- Banned adjectives: hyper-realistic, ultra-realistic, photorealistic, render,
  CGI, 3D, stunning, beautiful, perfect, flawless, dreamy, ethereal, magical,
  luminous, cinematic, glossy, clean digital.
- No legible text/logos/signage on any surface (replace with plain colour shapes
  or remove the label-bearing object).
- WORDS_TO_AVOID banned in every field.
- Apply as relevant: light on two surfaces; subsurface scattering on living
  subjects; strand separation on fur/hair; motion state + shutter; eye
  catchlight; hand position + finger count for people; contact shadow with
  colour/softness; one lived-in detail in lifestyle scenes; warm domestic tone
  for any care/grooming scene; scale vs a real nearby object; palette anchor
  clause; film-stock clause. Subject named in sentence 1 with locked traits.
- Character limits: Hero/Feature/About/Portfolio/Lifestyle ≤1100; others ≤800.
  Negative-space note for Hero/CTA/Blog/Pricing.

VARIETY MANDATES (scale to N):
- ≥1/3 of images have zero people · ≥1/4 are outdoors · ≥1/3 of people-scenes
  show a candid micro-moment. (For small sets N<6, treat these as "where
  natural" rather than hard quotas; never force an outdoor scene onto a section
  whose content is indoor.)

## PART C — Output the prompt array (JSON, length = N from the IMAGE PLAN)
One object per slot: image_number, outline_section (the heading it serves),
section_purpose, user_journey_stage, file_name (<60 chars), alt_text (<125
chars; subject in first 3 words; ≥ half the set includes SECONDARY_KEYWORD where
the subject appears), tags[4-7], image_prompt (the actual string), camera{...},
composition{framing,perspective,negative_space,focus_plane,lens_character},
resolution, aspect_ratio, consistency_id (identical across the set).

## PART D — kie.ai runner (create -> poll -> download)
kie.ai is ASYNCHRONOUS. For each of the N prompts:
1. Read the current endpoint + request body for KIE_AI_MODEL from docs.kie.ai
   (paths can change; do not hardcode). Auth: Authorization: Bearer $KIE_API_KEY
   (key from env named in KIE_AI_ENV).
2. POST create-task { prompt, aspectRatio } (+ model fields). HTTP 200 returns a
   task_id = CREATED, not done.
3. Poll the query-record endpoint with task_id until complete (or use a
   callback). Back off between polls.
4. Download the result IMMEDIATELY and save locally — kie.ai deletes generated
   files after 14 days. Never store only the URL.
5. Convert/save as WebP into src/assets/<page>/. Record the asset map
   (file -> alt_text -> outline_section -> consistency_id).
Operational guards:
- Throttle: kie.ai limit ~20 requests / 10s; do not fire all N at once.
- Retry a failed task; if it still fails, log it and CONTINUE to the next image
  rather than aborting the batch. Report failed slots at the end.
- Never expose KIE_API_KEY in any committed file or frontend.

## SELF-CHECK
☐ N derived from the outline and an IMAGE PLAN was shown before generating
☐ Exactly one Hero; listing items covered up to the grid cap; pure-text/FAQ/
  schema sections got no image
☐ N within floor(4) and cap(16); dropped sections reported if capped
☐ Every prompt starts "Photograph shot on [camera]" with locked subject traits
☐ Zero banned adjectives / WORDS_TO_AVOID / legible text / owner / storefront
☐ Camera + composition variety; variety mandates met (or relaxed-for-small-N
  noted)
☐ Every people-scene prompt frames the whole person (face + shoulders + torso
  stated in-frame) — no prompt built around a lap/hand/arm alone
☐ After download, EYEBALL every people-scene image: a visible person must
  actually be in frame (head + torso). Disembodied limbs = regenerate that slot
☐ Each image maps to a real outline_section; alts include SECONDARY_KEYWORD
  where natural; subject in first 3 words of every alt
☐ All N images downloaded locally as WebP (not just URLs); failures logged
☐ Identical consistency_id across the set
