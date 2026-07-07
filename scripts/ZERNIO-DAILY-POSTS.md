# Daily GBP Posts via Zernio

Automatically posts one blog article to your Google Business Profile every day at 11:00 AM Singapore time.

## Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Verify Configuration
- ✅ `~/.zernio/config.json` — API key saved
- ✅ `.claude/client.md` — Business info set
- ✅ `scripts/posts_log.json` — Tracking file created

## Usage

### Start the Daily Scheduler
```bash
npm run gbp:daily
```

This will:
- Run continuously in the background
- Publish one blog post **every day at 11:00 AM Singapore time**
- Automatically select the next un-posted blog
- Add a "Learn more" button linking back to your site
- Never repost the same article

**Keep the terminal window open** or use PM2 to keep it running (see below).

### Publish Immediately (Don't Wait for 11am)
```bash
npm run gbp:post
```

## How It Works

**Posts rotate through your 3 blogs:**
1. Day 1: "5 First-Time Puppy Owner Mistakes to Avoid"
2. Day 2: "HDB Dogs in Singapore: A Complete Guide"
3. Day 3: "Cavapoo vs Maltipoo: Which Breed for You?"
4. Day 4+: Loops back, or new blogs you add

Each post includes:
- ✅ Your blog content summarized for GBP (under 1500 chars)
- ✅ "Learn more" button linking to the full article
- ✅ Brand voice & local keywords (Singapore, your service)

**Logged in `posts_log.json`:**
- URL, post ID, publish date, status
- Prevents reposting the same article
- Tracks your publishing history

## Add More Blog Posts

To add new blog posts to the daily rotation, edit `scripts/publish-daily-post.mjs`:

1. Find the `blogPosts` array (around line 17)
2. Add a new entry:
```javascript
{
  slug: 'your-blog-slug',
  file: 'your-blog-file.astro',
  url: 'https://curioustails.sg/blog/your-blog-slug',
  title: 'Your Blog Title',
  points: [
    'Key point 1',
    'Key point 2',
    'etc'
  ],
  preview: `Your GBP post text (under 1500 chars)...`
}
```

3. Save and the new post enters the rotation.

## Keep It Running 24/7

### Option 1: PM2 (Recommended for Production)
```bash
npm install -g pm2
pm2 start scripts/scheduler.mjs --name "curious-tails-gbp"
pm2 save
pm2 startup
```

Then PM2 will restart the scheduler automatically if it crashes or your system reboots.

### Option 2: Windows Task Scheduler
Create a `.bat` file:
```batch
@echo off
cd D:\Claude Code\Curious Tails
npm run gbp:daily
pause
```

Schedule it to run at startup in Windows Task Scheduler.

### Option 3: Keep Terminal Open
Just run `npm run gbp:daily` and keep the terminal window open.

## Monitor & Debug

**To check today's post manually:**
```bash
npm run gbp:post
```

**To see posting history:**
```bash
cat scripts/posts_log.json
```

**To verify Zernio connectivity:**
```bash
cat ~/.zernio/config.json
```

## Troubleshooting

**"Zernio API error" or "Not authorized"**
- Check `~/.zernio/config.json` has your correct API key
- Verify at https://zernio.com/api/keys

**"No more blogs available"**
- You've posted all 3 of your blogs
- Either write new blog content, or the scheduler will loop back to day 1
- To add new blogs, edit the `blogPosts` array in `publish-daily-post.mjs`

**"GBP not connected to Zernio"**
- Log into https://zernio.com
- Verify your Google Business Profile is linked
- Check account ID matches in `.claude/client.md` and the script

**Scheduler not publishing at 11am**
- Verify your server's timezone is set to Singapore time
- Or run `npm run gbp:post` manually to test immediately

## Unlimited Posts with Zernio

Unlike Postproxy (10/month limit), Zernio has **no post limits** — post daily forever. Each post drives traffic back to your blog, boosts SEO, and keeps your profile active.

---

**Questions?** Check Zernio docs: https://zernio.com/docs
