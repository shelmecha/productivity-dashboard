@echo off
REM Sync the latest dashboard files from the AUS Operations source folder
REM into this GitHub repo folder. Run after any Claude refresh, then
REM commit + push in GitHub Desktop.

set "SRC=C:\Users\Shelvi\Documents\Claude\Projects\AUS Operations\AUS Operations\productivity-dashboard"
set "DST=%~dp0"

copy /Y "%SRC%\index.html" "%DST%index.html" >nul
copy /Y "%SRC%\data.js"    "%DST%data.js"    >nul
copy /Y "%SRC%\data.json"  "%DST%data.json"  >nul
if not exist "%DST%tasks" mkdir "%DST%tasks"
copy /Y "%SRC%\tasks\*.*" "%DST%tasks\" >nul

echo Synced dashboard files from AUS Operations source.
echo Now open GitHub Desktop, commit, and push to update the live site.
pause
