# Automation Reliability & Timeout Prevention

## Problem: Skills Can Hang or Timeout

When `page-brief` runs live SERP research, it can:
- Take 2-3+ minutes (slow)
- Hang indefinitely (network issues, API limits)
- Block the entire 8:00 AM automation pipeline

## Solution: 3-Level Timeout Strategy

### Level 1: Script Timeout (In blog_creator_daily.mjs)

**Current behavior:** Topic is recorded as pending, instructions printed, skills NOT called automatically.

**Why this is safe:** The 8:00 AM automation completes in <5 seconds, never hangs.

**Trade-off:** User must manually run skills OR we need to integrate skill-runner.mjs for background queuing.

---

### Level 2: Non-Blocking Skill Queue (skill-runner.mjs)

**What it does:**
- Queues skills to run in background (non-blocking)
- Each skill has a 10-minute timeout
- If a skill hangs >10min, it's killed automatically
- Automation completes regardless of skill success/failure

**Usage:**
```javascript
import { queueSkillsNonBlocking } from './skill-runner.mjs';

queueSkillsNonBlocking([
  { skill: 'page-brief', args: '/blog/puppy-fireworks-singapore' },
  { skill: 'blog-writer', args: '/blog/puppy-fireworks-singapore' },
  { skill: 'image-gen', args: 'puppy-fireworks-singapore' },
  { skill: 'article-tiktok-video', args: '/blog/puppy-fireworks-singapore' }
]);
// Returns immediately, skills run in background
```

**Result:** Automation finishes at 8:00 AM even if skills are slow.

---

### Level 3: Cached Research (Fastest & Safest)

**Problem:** `page-brief` does live SERP research every time (slow).

**Solution:** Use pre-cached research:

1. **First-time setup:**
   ```bash
   # Run ONCE per keyword cluster:
   /local-research puppy fireworks singapore
   # Generates research.json + ground-truth data
   ```

2. **Daily brief generation:**
   - Use `page-brief` (reuses cached research.json)
   - OR pre-generate brief manually once, then use for multiple runs

3. **Result:** Brief generation goes from 2-3 min → 30 seconds

---

## Recommended Daily Workflow (Guaranteed No Hangs)

### 8:00 AM Automation (blog_creator_daily.mjs)
```
✅ Parse CSV → find next blog
✅ Record topic as pending (< 5 seconds)
✅ Print instructions + queue skills in background
✅ Log completion & exit
→ Total time: <10 seconds (never hangs)
```

### 8:01 AM - 10:00 AM (Skills Running in Background)
```
Background: page-brief → blog-writer → image-gen → article-tiktok-video
(Each has 10-minute timeout; can fail individually without blocking next day's run)
```

### 10:30 AM (Human Review, if needed)
```
Check pending_posts.json for status
If any skill failed: Re-run manually or fix issue
If all skills succeeded: Update blogs_queue.json + verify images/video
```

### 11:00 AM (GBP Posting - Guaranteed to Run)
```
✅ GBP scheduler runs (never blocked by skill timeouts)
✅ Posts blog to Google Business Profile
✅ Logs to posts_log.json
```

---

## Implementation Checklist

- [ ] **Option A (Safest, Current):** Keep manual skill trigger
  - No risk of hangs
  - User controls timing
  - Requires Claude Code open / manual execution

- [ ] **Option B (Recommended, Requires Code):** Integrate skill-runner.mjs
  - Queue skills in background at 8:00 AM
  - 10-minute timeout per skill
  - Logs failures to pending_posts.json
  - Safe for fully automated runs

- [ ] **Option C (Fastest, Requires Setup):** Pre-cache research + schedule brief generation
  - Run `/local-research` once for keyword cluster
  - Brief generation drops to 30 seconds
  - Combine with Option B for bulletproof automation

---

## Monitoring & Alerts

**To catch stuck skills early:**

1. **Daily log check:**
   ```bash
   # Check if any skills timed out
   grep "TIMEOUT\|failed" automation.log
   ```

2. **Pending posts status:**
   ```bash
   # See which blogs are waiting for content
   jq '.[] | select(.status != "complete") | {slug, status, queuedAt}' scripts/pending_posts.json
   ```

3. **Windows Task Scheduler:**
   - Check "Last Run Time" → should be ~8:00 AM daily
   - Check "Last Run Result" → should be 0 (success)

---

## Testing Timeout Protection

```bash
# Test that automation completes even if page-brief hangs:
npm run blog:create
# → Should complete in <10 seconds
# → Check that pending_posts.json updated

# If you enabled skill-runner.mjs:
# → Check automation.log for any TIMEOUT warnings
# → Verify skills started in background
```

---

## Summary

**Three safety levels (pick one):**

1. **Current (Safest)** — Manual skill trigger, zero automation risk
2. **Recommended** — skill-runner.mjs queues skills in background with timeout
3. **Fastest** — Pre-cached research + background skills

All three prevent 8:00 AM automation from hanging. Choose based on your risk tolerance + automation goals.
