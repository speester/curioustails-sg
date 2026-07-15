---
name: local-seo-gbp-posts
description: Keep a client's Google Business Profile active with regular Google Business posts, from two sources — (A) repurpose the website's latest blog into a post with a "Learn more" button, and (B) reshare the client's recent Instagram photos into the profile. Rewrites copy to under 1500 characters and runs through Zernio. The "posts" half of the GBP delivery system for a 1-person local SEO business.
version: 1.1.0
requires:
  - The Zernio CLI, installed and authenticated (npm install -g @zernio/cli; zernio auth:check returns success)
  - The Zernio Node SDK for CTA buttons (npm install @zernio/node) — the CLI alone cannot set a call-to-action button
  - The client's Google Business Profile connected inside Zernio
  - (Optional, for the Instagram → GBP mode) the client's Instagram connected inside Zernio
  - A client.md knowledge base for the client (from the local-seo-onboarding skill)
---

# Local SEO — Google Business Profile Posts

A Google Business Profile that posts regularly looks active, ranks better, and gives
searchers a reason to click. Most local businesses already write blog content that never
gets reused. This skill turns each blog post into a Google Business post — keeping the
profile fresh without creating anything from scratch.

**What it does each run, for one client:**
1. Finds the business's blog posts and picks the next one not yet turned into a GBP post.
2. Scrapes that post and pulls its key points + its own hero image.
3. Rewrites it into a Google Business post under **1500 characters** in the brand voice.
4. Attaches the hero image and a **"Learn more" button** linking to the full article.
5. Publishes it (or saves a draft for approval) and logs it so it's never reused.

> You are Claude following this document. Do the reasoning steps yourself (matching the
> account, choosing the next blog, rewriting). Run the commands shown.

---

## How often to run it — pace to the blog
Aim for **2–3 Google Business posts per week**, but never post the same blog twice and never
post more than once a day. The real limiter is how often the business publishes:

- **Publishes often (weekly+):** you'll usually have fresh blogs — post 2–3x/week from the
  newest unused posts.
- **Publishes rarely / has a back catalogue:** work through their existing evergreen posts
  2–3x/week until you run low, then drop to a maintenance pace as new posts appear.
- **Has no blog / nothing left to reuse:** don't invent filler. Tell the operator the well
  is dry and suggest a topic (or that the client needs new blog content). See *No blog?* below.

A scheduled "GBP posting run" 2–3 mornings a week is the intended model. Each run publishes
**one** post.

---

## Step 0 — Identify the client's Google Business Profile account
Don't assume an account ID — discover it.

1. Read the client's `client.md` for the business **name**, **domain**, location.
2. `zernio accounts:list --pretty`
3. Find the entry where `platform` is `googlebusiness` and the `displayName` /
   `metadata.selectedLocationName` matches this client (confirm with domain/location if
   several could match). Note its account `_id` — this is `<accountId>` below.
4. If no `googlebusiness` account matches, **stop** and tell the operator the client's GBP
   isn't connected in Zernio yet.

> Optional: cache it as `gbp_account_id` in `client.md`; re-verify each run.

---

## Step 1 — Find the blog posts
Get the list of the business's blog articles. Try in order:
1. `https://<domain>/sitemap.xml` (or `/sitemap_index.xml`) — filter to blog/article URLs.
2. The blog index page (`/blog`, `/news`, `/articles`).

Many sites block default scrapers, so always fetch with a real browser User-Agent:
```bash
curl -sL -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0 Safari/537.36" "<url>" -o /tmp/page.html
```
Collect candidate article URLs (newest first if the sitemap has `lastmod`).

---

## Step 2 — Pick the next un-used blog (state file)
Keep a log at `clients/<name>/gbp/posts_log.json` — one entry per blog already posted. It is
the memory that stops reposting and the audit trail for the monthly report:
```json
{
  "blogUrl": "https://…/blog/…",
  "gbpPostId": "…",
  "title": "…",
  "postedAt": "2026-06-15T…",
  "status": "published"       // published | draft
}
```
Choose the **newest candidate URL not already in `posts_log.json`**. If every candidate is
already logged, see *No blog?* below.

---

## Step 3 — Scrape the chosen post
Fetch it with the browser User-Agent (Step 1). Extract:
- The article **title** and a few **key points / takeaways**.
- The post's **own hero image** — the content/featured image, usually matching the slug
  (e.g. `/images/blog/<slug>.webp`). **Do not use the `og:image` if it's a generic site
  default** (e.g. `og-default.*`); find the real article image instead.

---

## Step 4 — Write the Google Business post
Read `client.md` for **brand voice**, the **service**, the **location/areas**, and the
**`sensitive_niche`** flag. Then write the post:
- **Under 1500 characters** (hard limit). Aim shorter — lead with a strong first line; the
  opening shows before "more".
- Brand voice; written as the business, not the agency.
- Summarise the value of the article in 2–4 short paragraphs.
- Naturally include the **service + location** once or twice (local-SEO signal).
- **Do NOT paste the blog link in the text** — it goes in the Learn more button (Step 6).
- No hashtags (GBP doesn't use them like Instagram).

### Guardrails (always on; hard when `sensitive_niche: true`)
For health / disability / NDIS / legal / finance clients: keep claims factual and general,
don't imply individual outcomes, and never reference personal/customer details.

---

## Step 5 — Prepare and upload the image
Google Business needs JPG/PNG (not WebP) and a reasonable size.
```bash
# download with browser UA
curl -sL -A "Mozilla/5.0 … Chrome/124.0 Safari/537.36" "<heroImageUrl>" -o /tmp/hero.src
# convert to JPG (handles WebP) — keep it under ~5MB
# cross-platform (requires ImageMagick 7): magick <in> <out.jpg>
# (macOS fallback without ImageMagick: sips -s format jpeg /tmp/hero.src --out /tmp/hero.jpg)
magick /tmp/hero.src /tmp/hero.jpg
# upload to Zernio — returns a URL to use in the post
zernio media:upload /tmp/hero.jpg --pretty
```
Take the returned `url`.

---

## Step 6 — Create the post (with the "Learn more" button)
The CLI's `posts:create` **cannot** set a call-to-action button. The button is a
platform-specific field, so create the post through the **Zernio Node SDK**. Write a small
script with this run's values and run it:

```js
// /tmp/gbp_post.mjs
import Zernio from '@zernio/node';
import fs from 'fs'; import os from 'os'; import path from 'path';

const key = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.zernio/config.json'))).apiKey;
const zernio = new Zernio({ apiKey: key, baseURL: 'https://zernio.com/api' });

const res = await zernio.posts.createPost({ body: {
  content: `<<the post text from Step 4>>`,
  mediaItems: [{ type: 'image', url: '<<media url from Step 5>>' }],
  platforms: [{
    platform: 'googlebusiness',
    accountId: '<<accountId from Step 0>>',
    platformSpecificData: { callToAction: { type: 'LEARN_MORE', url: '<<the blog URL>>' } },
  }],
  isDraft: false,   // true = save as draft for owner approval instead of publishing
}});
const p = res.data?.post || res.data || res;
console.log(p.status, p._id);
```
```bash
node /tmp/gbp_post.mjs
```
- `callToAction.type` options: `LEARN_MORE` (default here), `BOOK`, `ORDER`, `SHOP`,
  `SIGN_UP`, `CALL`. Use `LEARN_MORE` pointing at the blog article.
- **First few posts for a new client:** set `isDraft: true`, show the operator the draft, and
  only switch to `isDraft: false` once they trust the output. Per-client preference can live
  in `client.md` as `post_approval` (`auto` default | `draft_first`).

---

## Step 7 — Log it & report
Append the blog URL, returned `gbpPostId`, title, timestamp, and status to
`posts_log.json`. This guarantees the blog is never reused and feeds the monthly client
report ("published N GBP posts this month, each linking back to the site"). End the run with
a one-line summary of what was posted (or that the blog well is dry).

---

## Alternate source — Instagram → GBP reshare
Service businesses that post real job photos to Instagram have a ready supply of authentic
images for the profile. This mode reshares those into Google Business posts. Use it to fill
the week between blog posts (e.g. blog post Mon, two IG reshares Wed/Fri), or as the main
source when the client posts to IG more than they blog.

**Requires:** the client's **Instagram connected in Zernio** (part of onboarding access). If no
`instagram` account matches the client in `zernio accounts:list`, this mode can't run — flag
it to the operator.

1. **Pull recent IG posts** (caption + image) for the client's IG account:
   ```bash
   zernio analytics:posts --platform instagram --source external --accountId <igAccountId> \
     --from <today-30> --to <today> --pretty
   ```
   Each post returns `content` (caption), `mediaItems[].url` + `.type`, `mediaType`,
   `platformPostUrl`, and `publishedAt`.
2. **Pick the next un-reshared photo post.** Skip any `platformPostUrl` already in
   `posts_log.json`. Prefer `mediaType`/`mediaItems[].type` = image; skip Reels/videos (this
   mode posts photos). Choose a post whose photo represents the work well.
3. **Adapt the caption for Google Business.** IG captions don't translate 1:1:
   - Strip hashtags and `@mentions` (GBP doesn't use them).
   - Keep it concise, under 1500 chars, in brand voice; work in the **service + location** once.
   - No link is required; if you want a button, add a `LEARN_MORE` CTA to the website
     (via the SDK, as in Step 6) — never link back to Instagram.
4. **Reshare the image:**
   ```bash
   curl -sL -A "Mozilla/5.0 … Chrome/124.0 Safari/537.36" "<mediaItems[].url>" -o /tmp/ig.jpg
   magick /tmp/ig.jpg /tmp/ig_gbp.jpg                     # normalise format/size (ImageMagick 7; macOS fallback: sips)
   zernio media:upload /tmp/ig_gbp.jpg --pretty               # → media url
   zernio posts:create --text "<adapted caption>" --accounts <gbpAccountId> \
     --media "<uploaded url>" --draft     # drop --draft to publish; or use the SDK for a CTA
   ```
5. **Log it** in `posts_log.json` with the IG `platformPostUrl` as the key (so it's never
   reshared twice) and the returned GBP post id.

> Guardrails still apply: only the client's own photos, never anything showing identifiable
> people without consent, and for a `sensitive_niche` keep imagery generic (no
> clients/patients).

## No blog? / nothing left to reuse
If the site has no blog, or every post is already in `posts_log.json`:
- Don't post filler. Tell the operator.
- Options to suggest: repurpose a **service page** or FAQ into an educational post; a
  seasonal/offer angle; or flag that the client needs fresh blog content (a content upsell).

---

## Config fields this skill reads from `client.md`
| Field | Purpose |
|-------|---------|
| `name`, `domain` | Match the client to the right `googlebusiness` account; find the blog |
| `gbp_account_id` *(optional cache)* | Resolved Zernio account `_id`; re-verify each run |
| `services`, `areas` | Weave service + location into the post for local-SEO signal |
| `sensitive_niche` | `true` → factual/guarded language |
| `post_approval` | `auto` (default, publish) · `draft_first` (save drafts for approval) |

## Multi-client
Repeat per client (loop over each `clients/<name>/`). Each client keeps its own
`posts_log.json`, so cadence and history are tracked independently.

## Pairs with
- **local-seo-reviews** — the other half of GBP delivery (review monitoring + replies).
- **local-seo-audit / local-seo-citations** — diagnosis and the "Build Authority" push.

## Image source note
Primary image = the blog post's **own hero image** (always on-topic, the business owns it).
Instagram is a possible secondary source *if* the client's IG is connected in Zernio (it
often isn't) — but matching a random IG image to a specific article is risky, so prefer the
blog's hero.
