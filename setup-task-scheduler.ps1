# Windows Task Scheduler Setup Script
# This script creates a scheduled task for Daily Blog Automation
# Run as Administrator

# Check if running as Administrator
$isAdmin = [Security.Principal.WindowsIdentity]::GetCurrent().Owner
if (-not ([Security.Principal.WindowsPrincipal] $isAdmin).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Error "This script must be run as Administrator!"
    exit 1
}

$taskName = "Curious Tails Daily Automation"
$taskDescription = "Automatically creates daily blogs and posts to Google Business Profile at 8am and 11am"
$scriptPath = "D:\Claude Code\Curious Tails\start-automation.bat"
$workingDirectory = "D:\Claude Code\Curious Tails"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Windows Task Scheduler Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if task already exists
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

if ($existingTask) {
    Write-Host "Task already exists. Removing old task..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Start-Sleep -Seconds 2
}

# Create task trigger - Run at system startup
Write-Host "Creating task trigger (run at startup)..." -ForegroundColor Green
$trigger = New-ScheduledTaskTrigger -AtStartup -RandomDelay (New-TimeSpan -Minutes 5)

# Create task action - Run the batch file
Write-Host "Creating task action (run batch file)..." -ForegroundColor Green
$action = New-ScheduledTaskAction -Execute $scriptPath -WorkingDirectory $workingDirectory

# Create task settings
Write-Host "Configuring task settings..." -ForegroundColor Green
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Hours 23 -Minutes 55)

# Create the scheduled task
Write-Host "Registering scheduled task..." -ForegroundColor Green
Register-ScheduledTask `
    -TaskName $taskName `
    -Description $taskDescription `
    -Trigger $trigger `
    -Action $action `
    -Settings $settings `
    -RunLevel Highest `
    -User "SYSTEM" `
    -Force | Out-Null

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "✅ Task Created Successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Task Details:" -ForegroundColor Cyan
Write-Host "  Name: $taskName" -ForegroundColor White
Write-Host "  Trigger: At system startup (5 min delay)" -ForegroundColor White
Write-Host "  Action: Run $scriptPath" -ForegroundColor White
Write-Host "  User: SYSTEM (runs even when not logged in)" -ForegroundColor White
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Restart your computer" -ForegroundColor White
Write-Host "  2. Check logs after 8:01 AM:" -ForegroundColor White
Write-Host "     cat 'D:\Claude Code\Curious Tails\automation.log'" -ForegroundColor Gray
Write-Host "  3. Verify blog was created and posted to GBP" -ForegroundColor White
Write-Host ""
Write-Host "To view task in Task Scheduler:" -ForegroundColor Cyan
Write-Host "  Press Windows+R, type 'taskschd.msc', press Enter" -ForegroundColor Gray
Write-Host ""
