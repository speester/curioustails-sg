# Windows Task Scheduler Setup - Step by Step

## Overview

Windows Task Scheduler will automatically run your blog automation every day. The scheduler will:
- **8:00 AM** — Create a new blog
- **11:00 AM** — Post it to Google Business Profile
- **Every 4 hours** — Check and reply to reviews

---

## Prerequisites

✅ Verify these are installed:

```bash
node --version        # Should show v24.x or higher
npm --version         # Should show 10.x or higher
```

If either is missing, install Node.js from https://nodejs.org/

---

## Step 1: Verify the Batch File

The batch file `start-automation.bat` has been created at:
```
D:\Claude Code\Curious Tails\start-automation.bat
```

**To test it works, open Command Prompt and run:**

```cmd
cd "D:\Claude Code\Curious Tails"
start-automation.bat
```

You should see:
```
🚀 Daily Automation Scheduler Started
📝 Blogs created at 08:00 AM Singapore time
📅 Blogs post to GBP at 11:00 AM Singapore time
...
```

Press `Ctrl+C` to stop the test.

---

## Step 2: Open Task Scheduler

1. **Press** `Windows Key + R` to open Run dialog
2. **Type:** `taskschd.msc`
3. **Click** OK

This opens Windows Task Scheduler.

---

## Step 3: Create a New Task

1. In Task Scheduler, click **"Create Task"** (right side panel)

2. **Name:** Enter `Curious Tails Daily Automation`

3. **Description:** Enter `Automatically creates daily blogs and posts to Google Business Profile at 8am and 11am`

4. **Check:** ☑️ "Run whether user is logged in or not"

5. **Check:** ☑️ "Run with highest privileges"

6. Click **OK** (don't click next, click OK)

---

## Step 4: Set the Trigger (When to Run)

1. Click the **"Triggers"** tab

2. Click **"New..."** button

3. **Begin the task:** Select `"At startup"`

4. **Delay task for:** `5 minutes` (gives system time to initialize)

5. **Repeat task every:** Check ☑️ and select `1 day`

6. Click **OK**

**Result:** The scheduler will start 5 minutes after Windows boots, then restart daily.

---

## Step 5: Set the Action (What to Run)

1. Click the **"Actions"** tab

2. Click **"New..."** button

3. **Action:** Select `"Start a program"`

4. **Program/script:** Enter the full path:
   ```
   D:\Claude Code\Curious Tails\start-automation.bat
   ```

5. **Start in:** Enter the working directory:
   ```
   D:\Claude Code\Curious Tails
   ```

6. Click **OK**

---

## Step 6: Set Advanced Settings

1. Click the **"Settings"** tab

2. **Check the following boxes:**
   - ☑️ "Allow task to be run on demand"
   - ☑️ "If the task is already running, then the following rule applies: Do not start a new instance"
   - ☑️ "Stop the task if it runs longer than: 23 hours 55 minutes"

3. Leave other settings as default

4. Click **OK** to save the task

---

## Step 7: Verify the Task is Created

1. In Task Scheduler, you should see `"Curious Tails Daily Automation"` listed

2. **Right-click** on it and select **"Run"** to test it immediately

3. Wait 5-10 seconds, then check:
   ```bash
   cat "D:\Claude Code\Curious Tails\automation.log"
   ```
   
   Should show: `[HH:MM:SS] Starting Daily Automation`

---

## Step 8: Verify It Works

### Check 1: Batch File is Running

Open Command Prompt and run:
```bash
tasklist | find "node"
```

Should show Node.js running if the task is active.

### Check 2: Check Today's Automation Log

```bash
cat "D:\Claude Code\Curious Tails\automation.log"
```

Should show entries with today's date and time.

### Check 3: Check Blog Creation Log

```bash
cat "D:\Claude Code\Curious Tails\scripts\blog_automation_log.json"
```

Should show an entry with today's timestamp.

### Check 4: Check GBP Posting Log

```bash
cat "D:\Claude Code\Curious Tails\scripts\posts_log.json"
```

Should show a new entry if it's after 11:00 AM.

---

## Manual Testing

### Test 1: Run Now (Don't Wait Until 8am)

```bash
cd "D:\Claude Code\Curious Tails"
npm run blog:create
npm run gbp:post
```

This creates a blog immediately and posts it to GBP.

### Test 2: Manually Run the Task

1. Open Task Scheduler
2. Find `"Curious Tails Daily Automation"`
3. **Right-click** → **Run**
4. Watch the logs:
   ```bash
   tail -f "D:\Claude Code\Curious Tails\automation.log"
   ```

---

## Troubleshooting

### Task Not Running?

1. **Check if Windows Task Scheduler service is running:**
   ```bash
   net start | find "Task Scheduler"
   ```

2. **View task history:**
   - Right-click task → **View History**
   - Look for error codes

3. **Check the log file:**
   ```bash
   cat "D:\Claude Code\Curious Tails\automation.log"
   ```

### "Access Denied" Error?

- Go back to **Step 3** and make sure:
  - ☑️ "Run with highest privileges" is checked
  - ☑️ "Run whether user is logged in or not" is checked

### Batch File Not Found?

- Edit the task (double-click it)
- **Actions** tab → **Edit**
- Verify the Program/script path is exactly:
  ```
  D:\Claude Code\Curious Tails\start-automation.bat
  ```

### Node.js or npm Not Found?

- Add Node.js to system PATH:
  1. Right-click **This PC** → **Properties**
  2. **Advanced system settings**
  3. **Environment Variables**
  4. Under **System variables**, find `Path` and click **Edit**
  5. Click **New** and add: `C:\Program Files\nodejs`
  6. Click **OK** three times
  7. Restart Windows

---

## Daily Schedule Explained

Once the task is running:

**Daily Flow:**
```
Boot (or 5 min after boot)
    ↓
Task Scheduler launches start-automation.bat
    ↓
Node.js runs: npm run gbp:daily
    ↓
Scheduler waits for times...
    ↓
8:00 AM → Creates today's blog
    ↓
11:00 AM → Posts blog to GBP
    ↓
Every 4 hours → Checks reviews
    ↓
Repeats tomorrow
```

---

## Monitor Your Automation

### Real-time Log Monitoring

Open PowerShell and run:
```powershell
Get-Content "D:\Claude Code\Curious Tails\automation.log" -Tail 20 -Wait
```

This shows the last 20 lines and updates live.

### Daily Summary

```bash
# See what was created
cat "D:\Claude Code\Curious Tails\scripts\blog_automation_log.json" | tail -3

# See what was posted
cat "D:\Claude Code\Curious Tails\scripts\posts_log.json" | tail -3
```

---

## Stop or Disable the Task

If you need to stop the automation:

1. Open Task Scheduler
2. Right-click `"Curious Tails Daily Automation"`
3. Click **"Disable"** (to keep the task but stop it running)
4. Or click **"Delete"** to remove it entirely

---

## Enable After Disabling

1. Open Task Scheduler
2. Right-click `"Curious Tails Daily Automation"`
3. Click **"Enable"**

---

## Restart Task Daily (Optional)

If you want to restart the task daily instead of running continuously:

1. Edit the task
2. **Triggers** tab → **Edit trigger**
3. Change: **"At startup"** to **"Daily"** at **"08:00:00 AM"**
4. **OK**

This will restart the task at 8am each day (cleaner approach).

---

## ✅ Setup Complete!

Your Windows Task Scheduler is now configured to:

- Start automatically when Windows boots
- Create a daily blog at 8:00 AM Singapore time
- Post to Google Business Profile at 11:00 AM Singapore time
- Check and reply to reviews every 4 hours
- Run continuously without needing a terminal window open
- Auto-restart if it crashes

The automation will now run every single day, creating and publishing your blog content automatically.

---

## Next Steps

1. **Restart your computer** to test the startup trigger
2. **Check logs at 8:01 AM** to verify blog creation
3. **Check logs at 11:01 AM** to verify GBP posting
4. **Monitor `automation.log`** for any issues

If everything works, you're done! Your blog automation will run 24/7 with no further action needed.
