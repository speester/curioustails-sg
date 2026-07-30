# Claude Routine Prompts — Full Daily Blog + Social Automation

Two routines, local mode, timezone Asia/Singapore:

| Routine | Schedule | Purpose |
|---|---|---|
| 1. Create & Publish | Daily 8:00 AM | Topic → brief → article → images → video → /blog index → build → deploy |
| 2. Distribute | Daily 11:00 AM | GBP post + TikTok/YouTube/Facebook/Instagram via Post For Me |

## Required setup (one time, before first run)

1. Add the Post For Me API key to `D:\Claude Code\Curious Tails\.env`:
   ```
   POST_FOR_ME_API_KEY=your_key_here
   ```
2. Connect the social accounts (TikTok, YouTube, Facebook, Instagram) in the Post For Me dashboard for this project.
3. Create both routines in the Claude app (local mode) with the prompts below.
4. Keep the Claude app running so local routines can fire.

---

## ROUTINE 1 PROMPT — paste into "Curious Tails — Daily Blog Create & Publish" (8:00 AM)

```
You are running the fully-automated daily blog pipeline for Curious Tails.
Working directory: D:\Claude Code\Curious Tails
Site: https://curioustails.sg — Astro 7, deployed via Cloudflare Pages, which auto-builds on every push to the main branch of https://github.com/speester/curioustails-sg.
Run AUTONOMOUSLY: never stop to ask for approval. Where a skill's instructions say "stop for outline approval" or "wait for user", self-approve and continue — there is no human watching this run.

Produce exactly ONE new published blog post per run. Follow every stage in order. Do not skip verification gates.

=== STAGE 0 — SELECT TOPIC ===
1. Run: npm run blog:create
   (This parses research/site-blueprint.csv, picks the first Day-numbered blog whose URL is not in scripts/blogs_queue.json, and records it in scripts/pending_posts.json.)
2. Read scripts/pending_posts.json. Take the OLDEST entry as today's topic: note its slug, urlSlug, title, h1, targetKeyword, notes. Process only this one topic today.
3. Idempotency check: if src/pages/blog/<slug>.astro already exists AND scripts/blogs_queue.json already has an entry with url https://curioustails.sg/blog/<slug> AND https://curioustails.sg/blog/<slug> returns HTTP 200 — log "already published" to scripts/blog_automation_log.json and STOP (nothing to do).
4. If blog:create reported "All Day-numbered blogs are created or queued" and pending_posts.json is empty, log schedule_complete and STOP.

=== STAGE 1 — BRIEF (skip if cached) ===
1. If briefs/<slug>.json exists and is larger than 1 KB, use it and skip to Stage 2 (most briefs are pre-cached).
2. Otherwise invoke the page-brief skill with argument: <urlSlug> (e.g. /blog/puppy-fireworks-singapore). Allow up to 15 minutes. It must write briefs/<slug>.json.
3. Gate: briefs/<slug>.json must now exist and parse as JSON. If not, retry the skill once; if it fails again, log {status:"error", step:"page-brief", slug} to scripts/blog_automation_log.json and STOP.

=== STAGE 2 — ARTICLE ===
1. Invoke the blog-writer skill with argument: <urlSlug>. AUTONOMOUS OVERRIDE: blog-writer's instructions say to stop after the outline for approval — do NOT stop; review the outline yourself against the brief, then continue straight to writing.
2. It must write src/pages/blog/<slug>.astro following the existing blog page pattern (see src/pages/blog/cavapoo-vs-maltipoo.astro for reference): frontmatter with title/description/faqItems, DefBox intro, CaptionedBlock sections, FAQ, FinalCta, Schema (localBusiness, person, webPage, faqPage).
3. Hard content rules:
   - Phone number, if mentioned, is 8220 6408 (NEVER 8220 6480).
   - Prices only from src/data/pricing.ts or the brief; site-wide line is "From $3,288, all-in". Never invent figures.
   - Internal links only to URLs that exist as rows in research/site-blueprint.csv AND as files under src/pages/. The topic's notes field often names required links (e.g. /starter-kit, /blog/puppy-sleep-schedule) — include them.
   - Title format and keyword use per briefs/<slug>.json. No em dashes. Respect WORDS_TO_AVOID from config/project-config.md.
4. Gate: file exists, is valid Astro (has --- frontmatter and closing tags), and is at least 120 lines. If not, fix it before continuing.

=== STAGE 3 — IMAGES ===
1. Invoke the image-gen skill with argument: <slug>. It reads briefs/<slug>.json, derives image count, generates via kie.ai (KIE_API_KEY is in .env), and saves WebP files to src/assets/<slug>/.
2. Blog pages need max 3 images — if the skill plans more, cap at 3 (hero + 2 supporting).
3. Allow up to 20 minutes (kie.ai is async; poll, download, convert to WebP).
4. Gate: at least 1 WebP exists in src/assets/<slug>/. If image-gen fails completely after one retry, FALLBACK: reuse 3 existing on-brand images from src/assets/guides/ or src/assets/home/ (verified paths: guides/3-puppy-night-routine-sleeping-pen.webp, home/2-starter-kit-items-cavapoo-unboxing.webp, home/3-avs-certified-trainer-puppy-training-lesson.webp) and note the fallback in the log.
5. Update src/pages/blog/<slug>.astro image imports to the real generated files with descriptive alt text (subject in first 3 words; include the target keyword where natural).

=== STAGE 4 — VIDEO ===
1. Invoke the article-tiktok-video skill with argument: /blog/<slug>. AUTONOMOUS OVERRIDE: make all creative choices yourself (hook selection, look, voice); do not pause for input.
2. Expected outputs under outputs/article_tiktok/<slug>/: final_article_tiktok.mp4, final_nomusic.mp4, cover.jpg, packaging.md, script.txt.
3. Allow up to 30 minutes. If video generation fails after one retry, log {status:"video_failed", slug} but CONTINUE — the article still publishes today; Routine 2 will skip video platforms and post GBP only.
4. Gate: if final_article_tiktok.mp4 exists, verify it is > 1 MB and 9:16.

=== STAGE 5 — WIRE INTO THE SITE (critical, this was the missing step) ===
1. Add the new post to the blog index src/pages/blog/index.astro:
   - Add an image import at the top with the hero image from src/assets/<slug>/.
   - Add a new object to the TOP of the `posts` array (newest first): { title, href: '/blog/<slug>', date: today's date YYYY-MM-DD, tag: a short category like 'Puppy care', excerpt: 1-2 sentences in site voice, image: <imported image>, imageAlt }.
2. Append the GBP queue entry to scripts/blogs_queue.json (valid JSON array; do not touch existing entries; no skip flag):
   {
     "slug": "<slug>",
     "file": "<slug>.astro",
     "url": "https://curioustails.sg/blog/<slug>",
     "title": "<plain title, no surrounding escaped quotes>",
     "image": "TEMP — fill in Stage 6 step 3",
     "points": [5 real takeaways from the article, human-readable, no keyword-stuffing],
     "preview": "<GBP post text, UNDER 1500 chars: emoji hook line, 4-5 checkmark takeaways, one-line CTA, then the article URL on its own line. Must read like the existing first-time-mistakes entry, not like a template.>"
   }
3. Remove the processed topic from scripts/pending_posts.json.

=== STAGE 6 — BUILD, DEPLOY, VERIFY ===
1. Run: npm run build
   Gate: exit code 0. If the build fails, read the error, fix the cause (usually a bad import path or frontmatter syntax in the new files), and rebuild. NEVER push a failing build. Max 3 fix attempts, then log error and STOP without pushing.
2. After a green build, find the hashed hero image in dist/_astro/ (filename starts with the source image basename) and set the blogs_queue.json "image" field to "https://curioustails.sg/_astro/<hashed-filename>".
3. Commit and push (Cloudflare Pages deploys automatically from main):
   - git add ONLY: src/pages/blog/<slug>.astro, src/pages/blog/index.astro, src/assets/<slug>/, briefs/<slug>.json, scripts/blogs_queue.json, scripts/pending_posts.json, scripts/blog_automation_log.json, outputs/article_tiktok/<slug>/ (exclude the .mp4 files if any single file exceeds 20 MB — Cloudflare Pages rejects files over 25 MB).
   - Commit message: "feat(blog): publish <slug> (Day <N>) via daily automation" with the Claude co-author line.
   - git push origin main
4. Verify deployment: poll https://curioustails.sg/blog/<slug> every 60 seconds, up to 15 minutes, until HTTP 200. Also confirm the post card appears on https://curioustails.sg/blog/.
5. Log the final result to scripts/blog_automation_log.json: {dayNumber, slug, title, status: "published", articleUrl, videoFile or null, timestamp}.

=== FAILURE RULES ===
- Any unrecoverable failure: append {status:"error", step, slug, error} to scripts/blog_automation_log.json, do NOT push broken work, and end with a one-paragraph plain-language summary of what succeeded, what failed, and the exact command or skill to re-run manually.
- Never mark anything "published" without the HTTP 200 verification in Stage 6.
- Total runtime budget: 90 minutes. If exceeded, finish the current stage, push if the build is green, and log where you stopped.
```

---

## ROUTINE 2 PROMPT — paste into "Curious Tails — Daily Distribution" (11:00 AM)

```
You are running daily content distribution for Curious Tails.
Working directory: D:\Claude Code\Curious Tails
Run AUTONOMOUSLY — no approval pauses. Today's article and video were produced by the 8:00 AM routine.

=== STAGE 0 — FIND TODAY'S POST ===
1. Read scripts/blogs_queue.json. Today's post = the last entry (newest). Note slug, url, title.
2. Gate: url must return HTTP 200. If not live yet, poll every 5 minutes up to 60 minutes. Still not live → log {status:"error", step:"distribution", reason:"article not live"} to scripts/blog_automation_log.json and STOP (do not post dead links anywhere).
3. Idempotency: read scripts/social_posts_log.json (create as [] if missing) and scripts/posts_log.json. Skip any channel that already has an entry for this slug.

=== STAGE 1 — GOOGLE BUSINESS PROFILE ===
1. Run: npm run gbp:post
   (Zernio API, account configured in ~/.zernio/config.json; it picks the first unposted queue entry, posts it, and logs to scripts/posts_log.json.)
2. Gate: confirm a new entry for this slug's url appeared in scripts/posts_log.json. If the API errored, log it and continue to Stage 2 — GBP failure must not block social posting.

=== STAGE 2 — SOCIAL VIDEO POSTS (Post For Me API) ===
Skip this whole stage (with a log entry) if outputs/article_tiktok/<slug>/final_article_tiktok.mp4 does not exist.

1. Auth: read POST_FOR_ME_API_KEY from .env. All requests: header "Authorization: Bearer <key>". Base URL: https://api.postforme.dev/v1. If any documented call returns 404/400 unexpectedly, fetch https://docs.postforme.dev to confirm the current endpoint shape and adapt — do not silently skip.
2. Discover accounts: GET /social-accounts. Collect connected/active account IDs per platform: tiktok, youtube, facebook, instagram. Post ONLY to platforms that have a connected account; list any missing platforms in the final summary.
3. Upload the video once: POST /media/create-upload-url → returns an upload URL and a media URL; PUT the raw bytes of outputs/article_tiktok/<slug>/final_article_tiktok.mp4 to the upload URL; keep the media URL for all posts. (If Post For Me media upload fails twice: fallback — copy the mp4 to public/videos/<slug>.mp4, commit, push, wait for deploy, use https://curioustails.sg/videos/<slug>.mp4 — only if the file is under 25 MB.)
4. Write ONE caption PER PLATFORM. Source material: the article at src/pages/blog/<slug>.astro, outputs/article_tiktok/<slug>/packaging.md (pre-written hooks/hashtags), and script.txt. Voice: warm, neighbourly, expert — Curious Tails shop-floor tone. Facts only from the article; phone number if used is 8220 6408; pricing line only "From $3,288, all-in". Article URL: https://curioustails.sg/blog/<slug>

   TIKTOK caption requirements:
   - 100-150 characters. Hook first (question or stakes), no link (not clickable) — end with "Full guide on curioustails.sg".
   - 3-5 hashtags: mix 1-2 niche Singapore pet tags (#sgpets #puppysingapore #sgdogs) + 1-2 topic tags from packaging.md.
   - Include one comment-bait question.

   YOUTUBE (Short) requirements:
   - Title: ≤100 characters, keyword-led, curiosity gap (e.g. "Dog Scared of Fireworks in Singapore? Do This Before NDP").
   - Description: article URL on line 1, then 2-3 plain sentences summarising the takeaway, then 3-5 hashtags.
   - If the API supports a separate title field for YouTube, use it; otherwise put the title as the first line of the caption.

   FACEBOOK requirements:
   - 2-4 conversational sentences, article URL inline mid-caption (clickable on FB).
   - 0-3 hashtags max. End with a soft question to invite comments.

   INSTAGRAM (Reel) requirements:
   - Hook line + 2-3 short lines, tasteful emojis (2-4 total).
   - 5-10 hashtags at the end (Singapore pet niche + topic).
   - Links are not clickable: write "Full guide → link in bio" AND include the plain URL text.

5. Create one post per platform: POST /social-posts with body containing that platform's account ID array, the platform-specific caption, and media: [{ url: <media URL from step 3> }]. Send them one at a time; a failure on one platform must not block the others (retry each failure once).
6. Log every attempt to scripts/social_posts_log.json: {slug, platform, status: "posted"|"failed", postId or error, articleUrl, timestamp}.

=== STAGE 3 — SUMMARY ===
End with a table: channel | status | link/ID | note — covering GBP, TikTok, YouTube, Facebook, Instagram. Explicitly name any platform skipped because no account is connected in Post For Me, and any failures with the exact retry command.
```

---

## Notes

- Routine 1 is idempotent: if it fires twice, Stage 0 step 3 exits cleanly.
- Routine 2 is idempotent per channel via social_posts_log.json / posts_log.json.
- The old 8:00 AM topic-only routine and Windows Task Scheduler task should stay OFF — Routine 1 replaces both (it runs blog:create itself in Stage 0).
- Videos are kept out of git when any file exceeds 20 MB; they live in outputs/ locally and are distributed via Post For Me's media hosting.
