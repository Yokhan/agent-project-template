@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
REM Start Agent OS — double-click to launch
echo === Agent OS — Preflight ===

REM Check Node.js (only required runtime)
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js not found. Install from https://nodejs.org/
    pause & exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do echo + Node: %%v

REM Check Claude CLI
where claude >nul 2>&1
if %errorlevel% neq 0 (
    echo WARNING: Claude CLI not found. Chat will not work.
    echo Install: https://docs.anthropic.com/claude-code
)

REM Install MCP deps if missing
if not exist "mcp-servers\context-router\node_modules" (
    echo Installing MCP context-router...
    pushd mcp-servers\context-router
    call npm install --silent 2>nul
    popd
)

REM Create config if missing
if not exist "n8n\config.json" (
    echo {"documents_dir": "%USERPROFILE%\\Documents", "orchestrator_project": ""} > n8n\config.json
)

echo.
echo === Starting Agent OS ===

REM Find the binary
set "APP_EXE="
if exist "desktop\src-tauri\target\release\agent-os.exe" (
    set "APP_EXE=desktop\src-tauri\target\release\agent-os.exe"
) else if exist "desktop\src-tauri\target\release\Agent OS.exe" (
    set "APP_EXE=desktop\src-tauri\target\release\Agent OS.exe"
)

if "%APP_EXE%"=="" (
    echo ERROR: Desktop app not built.
    echo Run: cd desktop ^&^& cargo tauri build
    pause & exit /b 1
)

REM Watchdog loop — restart if crashed
:watchdog
echo Starting: %APP_EXE%
start /WAIT "" "%APP_EXE%"
set "EXIT_CODE=%errorlevel%"

if %EXIT_CODE% equ 0 (
    echo Agent OS exited normally.
    goto :end
)

echo.
echo Agent OS crashed (exit code: %EXIT_CODE%). Restarting in 3s...
echo Press Ctrl+C to stop.
timeout /t 3 /nobreak >nul

REM Check if source was modified — try quick rebuild
git diff --quiet desktop\src-ui\index.html 2>nul
if %errorlevel% neq 0 (
    echo UI changed — no rebuild needed (hot reload on restart).
)

goto :watchdog

:end
echo.
echo Agent OS stopped.
pause
