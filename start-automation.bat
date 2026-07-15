@echo off
REM Daily Blog Automation Scheduler for Curious Tails
REM This script starts the automated blog creation and GBP posting

setlocal enabledelayedexpansion

REM Get the directory where this script is located
set "SCRIPT_DIR=%~dp0"

REM Change to the project directory
cd /d "%SCRIPT_DIR%"

REM Log file for debugging
set "LOG_FILE=%SCRIPT_DIR%automation.log"

REM Add timestamp to log
echo. >> "%LOG_FILE%"
echo ============================================ >> "%LOG_FILE%"
echo [%date% %time%] Starting Daily Automation >> "%LOG_FILE%"
echo ============================================ >> "%LOG_FILE%"

REM Check if Node.js is installed
node --version >> "%LOG_FILE%" 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found >> "%LOG_FILE%"
    exit /b 1
)

REM Check if npm is installed
npm --version >> "%LOG_FILE%" 2>&1
if errorlevel 1 (
    echo [ERROR] npm not found >> "%LOG_FILE%"
    exit /b 1
)

REM Install dependencies if needed
if not exist "node_modules\" (
    echo [INFO] Installing dependencies... >> "%LOG_FILE%"
    call npm install >> "%LOG_FILE%" 2>&1
)

REM Start the scheduler
echo [INFO] Starting scheduler... >> "%LOG_FILE%"
call npm run gbp:daily >> "%LOG_FILE%" 2>&1

REM If we get here, something went wrong
echo [ERROR] Scheduler exited unexpectedly >> "%LOG_FILE%"
exit /b 1
