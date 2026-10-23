@echo off
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
 echo Node.js 24 is required. Install it, then try again.
 pause
 exit /b 1
)
if not exist node_modules (
 echo Run npm ci in this folder first. See README.md for setup.
 pause
 exit /b 1
)
echo Open http://localhost:4173 in your browser.
echo Keep this window open. Press Ctrl+C to stop GeoVoice.
node server.mjs
pause
