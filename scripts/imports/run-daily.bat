@echo off
REM Curious Tails imports daily run (T25).
REM Manual entry point; the scheduled task calls node directly so it does not
REM depend on PATH. This batch is the same command for a human:
REM   scripts\imports\run-daily.bat --no-fetch
REM It never builds, commits or deploys.
setlocal
cd /d "%~dp0..\.."
if not defined IMPORTS_DOTENV set "IMPORTS_DOTENV=%USERPROFILE%\.claude\.env"
node scripts\imports\run-daily.mjs %*
exit /b %errorlevel%
