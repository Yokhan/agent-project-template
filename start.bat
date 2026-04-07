@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
REM Start Agent Command Center — double-click to launch
echo === Agent Command Center — Preflight ===

REM Check Python
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python not found. Install Python 3.8+
    pause & exit /b 1
)
for /f "tokens=*" %%v in ('python --version 2^>^&1') do echo + Python: %%v

REM Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js not found. Install Node.js 18+
    pause & exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do echo + Node: %%v

REM Install MCP deps if missing
if not exist "mcp-servers\context-router\node_modules" (
    echo Installing MCP context-router...
    pushd mcp-servers\context-router
    call npm install --silent 2>nul
    popd
)

REM Create config if missing
if not exist "n8n\config.json" (
    echo {"documents_dir": "%USERPROFILE%\\Documents", "orchestrator_project": "PersonalAssistant"} > n8n\config.json
)

echo.
echo === Starting Services ===

REM Start n8n (optional, skip if not installed)
where n8n >nul 2>&1
if %errorlevel% equ 0 (
    echo Starting n8n...
    start /B cmd /C "set NODE_FUNCTION_ALLOW_BUILTIN=child_process,fs,path && n8n start"
    timeout /t 3 /nobreak >nul
) else (
    echo n8n not found — dashboard works without it
)

REM Check for updates (watchdog)
echo Checking for updates...
powershell -ExecutionPolicy Bypass -File "%~dp0desktop\watchdog.ps1" -Check 2>nul
if %errorlevel% equ 0 (
    echo Update available! Run: powershell desktop\watchdog.ps1
)

REM Start desktop app (required — build with: cd desktop && cargo tauri build)
if exist "desktop\src-tauri\target\release\agent-os.exe" (
    echo Starting Agent OS...
    start "" "desktop\src-tauri\target\release\agent-os.exe"
) else if exist "desktop\src-tauri\target\release\Agent OS.exe" (
    echo Starting Agent OS...
    start "" "desktop\src-tauri\target\release\Agent OS.exe"
) else (
    echo ERROR: Desktop app not built. Run: cd desktop ^&^& cargo tauri build
    echo For dev mode: cd desktop ^&^& cargo tauri dev
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Agent OS — RUNNING
echo ========================================
echo   Desktop app or http://localhost:3333
echo   Watchdog: powershell desktop\watchdog.ps1 -Install
echo ========================================
echo.
pause
