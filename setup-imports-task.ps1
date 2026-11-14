# Curious Tails Imports Sync — Windows Task Scheduler setup (T25)
#
# Creates a once-a-day task that runs scripts/imports/run-daily.mjs, i.e. the
# same pipeline as `npm run sync:imports`, with IMPORTS_AUTOPUBLISH forced off.
# The scheduled run never builds, commits or deploys.
#
# Run this file as Administrator (SYSTEM principal, runs when logged out).
# For a per-user task without Administrator, see docs/imports-daily-schedule.md.
#
#   powershell -ExecutionPolicy Bypass -File .\setup-imports-task.ps1
#
# Disable:  Disable-ScheduledTask -TaskName "Curious Tails Imports Sync"
# Enable:   Enable-ScheduledTask  -TaskName "Curious Tails Imports Sync"
# Remove:   Unregister-ScheduledTask -TaskName "Curious Tails Imports Sync" -Confirm:$false

param(
    [string]$Dotenv = (Join-Path $env:USERPROFILE '.claude\.env')
)

$ErrorActionPreference = 'Stop'

$isAdmin = [Security.Principal.WindowsIdentity]::GetCurrent()
if (-not ([Security.Principal.WindowsPrincipal] $isAdmin).IsInRole([Security.Principal.WindowsBuiltInRole] 'Administrator')) {
    Write-Error 'This script must be run as Administrator. For a per-user task without admin, see docs/imports-daily-schedule.md.'
    exit 1
}

$taskName = 'Curious Tails Imports Sync'
$taskDescription = 'Daily Curious Tails imports sync at 06:15 SGT: fetch, normalise, dedupe, gates, images, public JSON. Never deploys. IMPORTS_AUTOPUBLISH is forced off.'
$repo = $PSScriptRoot
$runner = Join-Path $repo 'scripts\imports\run-daily.mjs'
$node = (Get-Command node -ErrorAction Stop).Source
$dotenv = $Dotenv

if (-not (Test-Path $runner)) { Write-Error "Runner not found: $runner"; exit 1 }
if (-not (Test-Path $dotenv)) {
    Write-Warning "Dotenv not found: $dotenv. The task will fail unless IMPORTS_PRIVATE_DIR is set for SYSTEM."
}

Write-Host '========================================' -ForegroundColor Cyan
Write-Host 'Curious Tails Imports Sync setup' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan
Write-Host "Task:     $taskName"
Write-Host "Runner:   $runner"
Write-Host "Node:     $node"
Write-Host "Dotenv:   $dotenv"
Write-Host 'Schedule: daily at 06:15 (machine local time; intended Asia/Singapore)'
Write-Host 'Autopublish: OFF'
Write-Host ''

$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host 'Removing the old task...' -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Start-Sleep -Seconds 1
}

$trigger = New-ScheduledTaskTrigger -Daily -At '06:15'
$action = New-ScheduledTaskAction `
    -Execute $node `
    -Argument "`"$runner`" --dotenv `"$dotenv`"" `
    -WorkingDirectory $repo
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 90)
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask `
    -TaskName $taskName `
    -Description $taskDescription `
    -Trigger $trigger `
    -Action $action `
    -Settings $settings `
    -Principal $principal `
    -Force | Out-Null

Write-Host ''
Write-Host 'Task created.' -ForegroundColor Green
Write-Host ''
Write-Host 'Acceptance commands:' -ForegroundColor Cyan
Write-Host "  Start-ScheduledTask -TaskName `"$taskName`""
Write-Host "  Get-ScheduledTask  -TaskName `"$taskName`" | Get-ScheduledTaskInfo"
Write-Host '  Get-Content logs\imports\last-run.json'
Write-Host '  Get-Content logs\imports\NEEDS-ATTENTION.md   # only after a failure'
Write-Host ''
Write-Host 'Disable / enable / remove:' -ForegroundColor Cyan
Write-Host "  Disable-ScheduledTask -TaskName `"$taskName`""
Write-Host "  Enable-ScheduledTask  -TaskName `"$taskName`""
Write-Host "  Unregister-ScheduledTask -TaskName `"$taskName`" -Confirm:`$false"
