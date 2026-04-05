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

REM Start dashboard
echo Starting dashboard...
start /B python n8n\dashboard\serve.py
timeout /t 2 /nobreak >nul

echo.
echo ========================================
echo   Agent Command Center — RUNNING
echo ========================================
echo   Dashboard:  http://localhost:3333
echo   Open in browser to start working!
echo ========================================
echo.
start http://localhost:3333
pause
