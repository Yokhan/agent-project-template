@echo off
REM Start Agent Command Center — double-click to launch
echo Starting Command Center...

start /B cmd /C "set NODE_FUNCTION_ALLOW_BUILTIN=child_process,fs,path && n8n start"
timeout /t 5 /nobreak >nul

start /B python n8n\dashboard\serve.py
timeout /t 2 /nobreak >nul

echo.
echo === Agent Command Center ===
echo Dashboard:  http://localhost:3333
echo n8n:        http://localhost:5678
echo.
start http://localhost:3333
pause
