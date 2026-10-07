@echo off
title HuaShi Pet Desktop Mascot
cd /d "%~dp0electron"

if not exist "node_modules\electron\dist\electron.exe" goto install
goto run

:install
echo [1/2] First run - installing dependencies (Electron ~100MB, please wait)...
call npm install
if errorlevel 1 goto instfail
if not exist "node_modules\electron\dist\electron.exe" (
    echo [1/2] Fetching Electron runtime...
    call node node_modules\electron\install.js
    if errorlevel 1 goto instfail
)
if not exist "node_modules\electron\dist\electron.exe" goto instfail

:run
echo [2/2] Starting HuaShi Pet...
echo Tip: right-click the pet for menu; drag with long-press.
start "" "node_modules\electron\dist\electron.exe" .
exit /b 0

:instfail
echo.
echo [ERROR] Dependency install failed.
echo Check your network, then re-run this bat.
echo Manual fix: open cmd and run:
echo   cd /d "%~dp0electron"
echo   npm install --registry=https://registry.npmmirror.com
echo.
pause
exit /b 1