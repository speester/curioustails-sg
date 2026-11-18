# Imports daily schedule (T25)

The imported-puppy feed refreshes itself once a day. It never deploys: the
scheduled run stops after the public JSON and the images are written, so a
publish is still an owner decision.

> **Changed 2026-11-18 (owner decision, PLAN-puppy-sales-recovery D2):** the
> scheduled run now **auto-publishes** every gate-passing item (safety valve off)
> and runs with `--push`, which commits only `src/data/imported-puppies.json` and
> `src/assets/imported/` to GitHub `main` from a dedicated worktree
> (`D:\Claude Code\_ct-imports-publish`). That push deploys the site. Lead-only
> sources (dfsi, puppies.ie), the leak check, liveness (a listing gone from its
> source never publishes) and takedowns still apply. Kill switch:
> `IMPORTS_DAILY_AUTOPUBLISH=0` in the task environment. The sections below
> describe the original queue-only design.

## What runs

- **Task name:** `Curious Tails Imports Sync`
- **Time:** daily at **06:15** machine local time. The machine is on
  Asia/Singapore, so this is 06:15 SGT; if the timezone changes, change the
  trigger too.
- **Command (the scheduled task's action):**

  ```text
  "C:\Program Files\nodejs\node.exe" ^
    "D:\Claude Code\Curious Tails\scripts\imports\run-daily.mjs" ^
    --dotenv "C:\Users\admin\.claude\.env"
  ```

  Working directory: `D:\Claude Code\Curious Tails`.

- **Manual command (same code path):**

  ```powershell
  npm run sync:imports:daily -- --no-fetch   # re-validate only, zero network
  npm run sync:imports:daily                 # live fetch
  scripts\imports\run-daily.bat --no-fetch   # double-clickable equivalent
  ```

`run-daily.mjs` runs the same pipeline as `npm run sync:imports`: fetch →
normalise → dedupe → gates → images → public JSON. It does **not** run
`astro build`, `git commit`, `npm run deploy` or any Cloudflare command.

## Publishing stays owner-gated

`IMPORTS_AUTOPUBLISH` is **unset** and the scheduled runner deletes it even if
an outer environment sets it. A clean item therefore lands in the private
review queue as `auto-ready`; the public feed only changes after the owner
approves, either in the review UI or with:

```powershell
npm run review:imports
npm run approve:import -- approve <imp-id> --actor owner:me
```

The next sync (manual or the next scheduled run) writes the approved item to
`src/data/imported-puppies.json`. Nothing auto-publishes until someone edits
`run-daily.mjs` after the T17 legal sign-off.

## Files a run leaves

| File | What it is |
|---|---|
| `logs/imports/<date>.log` | Counts-only operational log. `<date>` is the **UTC** date the run started, so a 06:15 SGT run is usually named with the previous UTC day. No seller, phone, email, URL, microchip or source listing id. |
| `logs/imports/last-run.json` | The clean-run record: status (`ok` / `attention` / `failed`), exit code, mode, autopublish flag, counts, gates, queue counts, alert reasons, board result. |
| `logs/imports/NEEDS-ATTENTION.md` | The durable alert. Written on a hard or soft alert; overwritten by the next alert; **not** deleted by a later success. |
| `NEEDS-ATTENTION.md` (repo root) | Pointer the next session sees immediately. Delete it together with the log alert once read. |

A Windows toast is deliberately not used: it disappears before an unattended
machine's owner sees it. The two files above survive a logout, a reboot and a
fresh agent session.

## Alerts and exit codes

| Condition | Exit | Alert |
|---|---|---|
| A source host is blocked (403/Cloudflare/challenge) | **1** | `source-blocked` |
| A published photo is missing from `src/assets/imported` | **1** | `missing-photo` |
| Feed schema/leak validation fails, run lock is busy, store error, unexpected exception | **1** | the thrown reason |
| A source/adapter errors but is not blocked | 0 | `source-error` / `adapter-error` |
| Review queue over 20 items, or oldest item over 72 h | 0 | `review-backlog` / `review-backlog-age` |

Hard failures exit non-zero, so Task Scheduler records the run as failed and
`last-run.json` says `failed`. Soft alerts exit zero because the run itself
completed; they still write `NEEDS-ATTENTION.md` for the owner.

### Optional board post

If `BOARD_TOKEN` is set (in the task environment or in the dotenv file passed
with `--dotenv`) and `BOARD_URL` names the board's alert endpoint, the same
alert is POSTed as JSON with a bearer token. Without `BOARD_TOKEN` the board
step is skipped and the alert file says `no BOARD_TOKEN`. There is no default
`BOARD_URL`: guessing another service's endpoint is how an alert goes nowhere.
The local Orca kanban has no alert endpoint, so today the board step is
intentionally a no-op; the files are the alert.

## Install, disable, re-enable, remove

Install as a SYSTEM task (runs when logged out; needs Administrator):

```powershell
powershell -ExecutionPolicy Bypass -File .\setup-imports-task.ps1
```

The setup script registers the task with the SYSTEM principal and passes the
owner's dotenv path explicitly, so a SYSTEM task does not look in
`C:\Windows\system32\config\systemprofile\.claude\.env`.

Per-user install without Administrator (runs only while that user is logged
on; this is what is currently registered on this machine):

```powershell
$repo = 'D:\Claude Code\Curious Tails'
$action = New-ScheduledTaskAction -Execute (Get-Command node).Source `
  -Argument "`"$repo\scripts\imports\run-daily.mjs`" --dotenv `"$env:USERPROFILE\.claude\.env`"" `
  -WorkingDirectory $repo
$trigger = New-ScheduledTaskTrigger -Daily -At '06:15'
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -StartWhenAvailable -RunOnlyIfNetworkAvailable -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 90)
Register-ScheduledTask -TaskName 'Curious Tails Imports Sync' -Trigger $trigger `
  -Action $action -Settings $settings -Force
```

Disable / re-enable / remove:

```powershell
Disable-ScheduledTask  -TaskName 'Curious Tails Imports Sync'
Enable-ScheduledTask   -TaskName 'Curious Tails Imports Sync'
Unregister-ScheduledTask -TaskName 'Curious Tails Imports Sync' -Confirm:$false
```

Equivalent `schtasks` form:

```bat
schtasks /change /tn "Curious Tails Imports Sync" /disable
schtasks /change /tn "Curious Tails Imports Sync" /enable
schtasks /delete /tn "Curious Tails Imports Sync" /f
```

To test the action without waiting for 06:15:

```powershell
Start-ScheduledTask -TaskName 'Curious Tails Imports Sync'
Get-ScheduledTaskInfo -TaskName 'Curious Tails Imports Sync'
Get-Content .\logs\imports\last-run.json
```

## What still needs a human the next morning

- **Approvals.** A clean item is `auto-ready`, not live. The owner approves it
  in `npm run review:imports` (or `approve:import`), and the next sync writes it.
- **A blocked source.** The pipeline stops that host for the run and does not
  retry or bypass it. A human decides whether to wait, contact the source, or
  accept the gap.
- **Legal sign-off.** Enabling `IMPORTS_AUTOPUBLISH` is a code change plus the
  T17 legal decision; the schedule will not do it.
- **Photo/schema failures.** `missing-photo` or a `feed-validation` alert means
  a published card would be broken; the owner fixes the source record or takes
  the listing down with `npm run unpublish:import`.
