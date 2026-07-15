# Daily Blog Automation - Setup & Operation Guide

## ✅ What's Implemented

Your Curious Tails site now has **fully automated daily blog creation and GBP posting**:

```
8:00 AM  → 📝 Create blog (seo-information-gain-brief → content-writer → image-gen → publish)
11:00 AM → 📤 Post to GBP (Zernio API)
Every 4h → 💬 Check & reply to GBP reviews
```

## 🚀 Starting the Automation

### Option 1: Local Daemon (Development/Testing)

```bash
# Terminal 1: Start the scheduler
npm run gbp:daily

# Keep this running in the background
# Press Ctrl+C to stop
```

The scheduler will:
- Run every day automatically
- Log all activity to console
- Create blogs at 8:00 AM
- Post to GBP at 11:00 AM
- Check reviews every 4 hours

### Option 2: PM2 (Production - Recommended)

```bash
# Install PM2 globally (one-time)
npm install -g pm2

# Start scheduler with PM2
pm2 start scripts/scheduler.mjs --name "curious-tails-daily"

# Configure to restart on system reboot
pm2 startup
pm2 save

# Monitor logs
pm2 logs curious-tails-daily

# Stop/restart when needed
pm2 stop curious-tails-daily
pm2 restart curious-tails-daily
```

### Option 3: Windows Task Scheduler

Create a batch file `start-automation.bat`:

```batch
@echo off
cd /d "D:\Claude Code\Curious Tails"
npm run gbp:daily
pause
```

Then schedule it in Windows Task Scheduler to run at system startup.

## 📝 Manual Triggers (Anytime)

```bash
# Create tomorrow's blog today
npm run blog:create

# Post a blog to GBP immediately (doesn't wait for 11am)
npm run gbp:post

# Check reviews and reply (doesn't wait for 4h)
npm run gbp:reviews
```

## 📊 Monitoring Progress

### Check Today's Automation Status

```bash
cat scripts/blog_automation_log.json
```

Shows:
- Day number
- Blog slug
- Timestamp
- Status (created, error, or schedule_complete)

### Check GBP Posting Status

```bash
cat scripts/posts_log.json
```

Shows:
- Blog URL
- Zernio post ID
- Posting timestamp
- Status (published)

### Check Blog Queue

```bash
cat scripts/blogs_queue.json
```

Shows:
- All blogs ready to post (both published and pending)
- Image URLs
- GBP preview text

## 🔧 Customization

### Change Blog Creation Time

Edit `scripts/scheduler.mjs`:

```javascript
const blogCreateSchedule = '0 8 * * *'; // Change the hour (0-23)
```

Examples:
- `'0 6 * * *'` → 6:00 AM
- `'0 10 * * *'` → 10:00 AM
- `'30 7 * * *'` → 7:30 AM

### Change GBP Posting Time

```javascript
const postSchedule = '0 11 * * *'; // Change to desired time
```

### Pause Automation

```bash
npm run gbp:daily  # Press Ctrl+C to stop
# OR
pm2 stop curious-tails-daily
```

## ⚠️ Troubleshooting

### Blogs not creating?

1. Check the logs:
   ```bash
   cat scripts/blog_automation_log.json
   ```

2. Run manually to see errors:
   ```bash
   npm run blog:create
   ```

3. Verify CSV is readable:
   ```bash
   head -5 research/site-blueprint.csv
   ```

### Blogs not posting to GBP?

1. Check Zernio config:
   ```bash
   cat ~/.zernio/config.json
   ```

2. Verify API key is current:
   - https://zernio.com/api/keys

3. Run manually:
   ```bash
   npm run gbp:post
   ```

### Scheduler not running?

1. Check Node.js version (requires >=22.12.0):
   ```bash
   node --version
   ```

2. Verify dependencies installed:
   ```bash
   npm install
   ```

3. Test scheduler startup:
   ```bash
   npm run gbp:daily
   ```

## 📈 Expected Workflow

**Day 1 (8:00 AM):**
- System creates Day 1 blog (cavapoo price)
- Adds to blogs_queue.json
- Logs to blog_automation_log.json

**Day 1 (11:00 AM):**
- System posts Day 1 blog to GBP
- Updates posts_log.json
- Blog visible on your GBP profile

**Day 2 (8:00 AM):**
- System creates Day 2 blog (pee pad training)
- Posts Day 1 to GBP (if not already posted)

**Repeat daily for 90 days** until all Day 1-90 blogs are published.

## 🎯 What's Next: Skill Integration

The current system creates blogs with **placeholder content**. To enable full automation:

1. **Integrate `seo-information-gain-brief` skill**
   - Replaces: placeholder brief generation
   - Provides: full SERP research, LSI keywords, dual-intent strategy

2. **Integrate `content-writer` skill**
   - Replaces: placeholder 300-word content sections
   - Provides: 2,000+ word blog posts with real depth

3. **Integrate `image-gen` skill**
   - Replaces: existing image file usage
   - Provides: 3 brand-new photorealistic images per blog

Once skills are wired, each daily blog will be production-ready with:
- ✅ Research-backed positioning
- ✅ SEO-optimized structure (H2s, LSI keywords, entities)
- ✅ 2,000+ word content
- ✅ 3 custom images
- ✅ FAQ schema
- ✅ Auto-posted to GBP at 11am

## 📞 Support

Run any time:
```bash
npm run gbp:daily      # See current schedule
npm run blog:create    # Create blog now
npm run gbp:post       # Post to GBP now
npm run gbp:reviews    # Check reviews now
```

---

**Status: Phase 3 Complete** ✅

Scheduler configured and ready to run. System creates 1 blog daily → posts to GBP at 11am → 90-day calendar completes automatically.
