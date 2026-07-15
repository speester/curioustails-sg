@echo off
REM Setup Windows Task Scheduler for Daily Blog Automation
REM Run this file as Administrator

echo.
echo ========================================
echo Windows Task Scheduler Setup
echo ========================================
echo.

REM Check if running as Administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script must be run as Administrator!
    echo.
    echo Right-click this file and select "Run as Administrator"
    pause
    exit /b 1
)

setlocal enabledelayedexpansion

set "TASK_NAME=Curious Tails Daily Automation"
set "SCRIPT_PATH=D:\Claude Code\Curious Tails\start-automation.bat"
set "WORKING_DIR=D:\Claude Code\Curious Tails"

echo Setting up Task Scheduler...
echo.

REM Check if task already exists and delete it
echo Checking for existing task...
schtasks /query /tn "%TASK_NAME%" >nul 2>&1
if %errorLevel% equ 0 (
    echo Task already exists. Removing...
    schtasks /delete /tn "%TASK_NAME%" /f >nul 2>&1
    timeout /t 2 /nobreak >nul
)

REM Create the scheduled task
echo Creating scheduled task...
schtasks /create ^
    /tn "%TASK_NAME%" ^
    /tr "\"%SCRIPT_PATH%\"" ^
    /sc onstart ^
    /delay 0000:05 ^
    /rl highest ^
    /ru SYSTEM ^
    /f

if %errorLevel% neq 0 (
    echo ERROR: Failed to create task
    pause
    exit /b 1
)

echo.
echo ========================================
echo ✓ Task Created Successfully!
echo ========================================
echo.
echo Task Details:
echo   Name: %TASK_NAME%
echo   Trigger: At system startup (5 minute delay)
echo   Action: Run %SCRIPT_PATH%
echo   User: SYSTEM (runs even when not logged in)
echo.
echo Next Steps:
echo   1. Restart your computer
echo   2. Check logs after 8:01 AM:
echo      cat "D:\Claude Code\Curious Tails\automation.log"
echo   3. Verify blog was created and posted to GBP
echo.
echo To view task in Task Scheduler:
echo   Press Windows+R, type 'taskschd.msc', press Enter
echo.
pause
