@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

echo.
echo  ========================================================
echo    Agent Project Template v2 - Setup
echo    Autonomous AI agents + persistent memory + self-improvement
echo    19 rules, 9 agents, 22 skills, 12 commands
echo  ========================================================
echo.

:: Ask for project name
set /p "PROJECT_NAME=Enter project name: "
if "%PROJECT_NAME%"=="" (
    echo ERROR: Project name cannot be empty.
    pause
    exit /b 1
)

where git >nul 2>nul
if errorlevel 1 (
    echo ERROR: git is not installed or not in PATH. Please install git first.
    exit /b 1
)

:: Check if directory already exists
if exist "%PROJECT_NAME%" (
    echo ERROR: Directory "%PROJECT_NAME%" already exists.
    pause
    exit /b 1
)

echo.
echo Creating project: %PROJECT_NAME%
echo.

:: Get the directory where this bat file lives (the template)
set "TEMPLATE_DIR=%~dp0"

:: Create project directory
mkdir "%PROJECT_NAME%"

:: Copy entire template structure
echo [1/7] Copying template files...
xcopy "%TEMPLATE_DIR%CLAUDE.md" "%PROJECT_NAME%\" /Y /Q >nul 2>&1
xcopy "%TEMPLATE_DIR%README.md" "%PROJECT_NAME%\" /Y /Q >nul 2>&1
xcopy "%TEMPLATE_DIR%.env.example" "%PROJECT_NAME%\" /Y /Q >nul 2>&1
xcopy "%TEMPLATE_DIR%.claude" "%PROJECT_NAME%\.claude\" /E /Y /Q >nul 2>&1
xcopy "%TEMPLATE_DIR%docs" "%PROJECT_NAME%\docs\" /E /Y /Q >nul 2>&1
xcopy "%TEMPLATE_DIR%templates" "%PROJECT_NAME%\templates\" /E /Y /Q >nul 2>&1
xcopy "%TEMPLATE_DIR%_reference" "%PROJECT_NAME%\_reference\" /E /Y /Q >nul 2>&1
xcopy "%TEMPLATE_DIR%brain" "%PROJECT_NAME%\brain\" /E /Y /Q >nul 2>&1
xcopy "%TEMPLATE_DIR%integrations" "%PROJECT_NAME%\integrations\" /E /Y /Q >nul 2>&1
xcopy "%TEMPLATE_DIR%scripts" "%PROJECT_NAME%\scripts\" /E /Y /Q >nul 2>&1
xcopy "%TEMPLATE_DIR%tasks" "%PROJECT_NAME%\tasks\" /E /Y /Q >nul 2>&1
xcopy "%TEMPLATE_DIR%.github" "%PROJECT_NAME%\.github\" /E /Y /Q >nul 2>&1
xcopy "%TEMPLATE_DIR%SECURITY.md" "%PROJECT_NAME%\" /Y /Q >nul 2>&1
xcopy "%TEMPLATE_DIR%CONTRIBUTING.md" "%PROJECT_NAME%\" /Y /Q >nul 2>&1
xcopy "%TEMPLATE_DIR%Makefile" "%PROJECT_NAME%\" /Y /Q >nul 2>&1
xcopy "%TEMPLATE_DIR%.editorconfig" "%PROJECT_NAME%\" /Y /Q >nul 2>&1
xcopy "%TEMPLATE_DIR%.vscode\" "%PROJECT_NAME%\.vscode\" /E /I /Y /Q >nul 2>&1

:: Don't copy setup.bat itself into the new project
if exist "%PROJECT_NAME%\setup.bat" del "%PROJECT_NAME%\setup.bat" >nul 2>&1

:: Create .gitignore
echo [2/7] Creating .gitignore...
xcopy "%TEMPLATE_DIR%.gitignore" "%PROJECT_NAME%\" /Y /Q >nul 2>&1

:: Create project-local settings (never touched by template sync)
if not exist "%PROJECT_NAME%\.claude\settings.local.json" (
    xcopy "%TEMPLATE_DIR%.claude\settings.local.json.example" "%PROJECT_NAME%\.claude\settings.local.json*" /Y /Q >nul 2>&1
)

:: Create empty directories that git needs
echo [3/7] Creating directory structure...
mkdir "%PROJECT_NAME%\src" >nul 2>&1

:: Generate template manifest
echo [4/7] Generating template manifest...
cd "%PROJECT_NAME%"
powershell -NoProfile -Command ^
  "$today = (Get-Date -Format 'yyyy-MM-dd');" ^
  "$templateFiles = @(" ^
  "  '.claude/settings.json'," ^
  "  '.claude/hooks/session-start.sh'," ^
  "  '.claude/hooks/session-stop.sh'," ^
  "  '.claude/hooks/pre-compact.sh'," ^
  "  '.claude/hooks/format.sh'," ^
  "  '.claude/hooks/post-edit.sh'," ^
  "  '.claude/hooks/pre-edit-safety.sh'," ^
  "  '.editorconfig'," ^
  "  'Makefile'," ^
  "  'SECURITY.md'," ^
  "  'CONTRIBUTING.md'," ^
  "  'CLAUDE.md'," ^
  "  '.gitignore'," ^
  "  '.vscode/extensions.json'" ^
  ");" ^
  "$templatePatterns = @(" ^
  "  '.claude/rules/*.md'," ^
  "  '.claude/agents/*.md'," ^
  "  '.claude/skills/*/SKILL.md'," ^
  "  '.claude/commands/*.md'," ^
  "  '.claude/hooks/*.sh'," ^
  "  'scripts/*.sh'" ^
  ");" ^
  "$projectPatterns = @(" ^
  "  'tasks/*'," ^
  "  'brain/*'" ^
  ");" ^
  "$files = @{};" ^
  "foreach ($f in $templateFiles) {" ^
  "  if (Test-Path $f) {" ^
  "    $h = (Get-FileHash $f -Algorithm SHA256).Hash.ToLower();" ^
  "    $cat = 'template';" ^
  "    if ($f -eq 'CLAUDE.md') { $cat = 'project' };" ^
  "    if ($f -eq '.gitignore' -or $f -eq '.vscode/extensions.json') { $cat = 'hybrid' };" ^
  "    $files[$f] = @{ category = $cat; hash = $h };" ^
  "  }" ^
  "};" ^
  "foreach ($p in $templatePatterns) {" ^
  "  foreach ($item in (Get-ChildItem -Path $p -ErrorAction SilentlyContinue)) {" ^
  "    $rel = $item.FullName.Substring((Get-Location).Path.Length + 1).Replace('\','/');" ^
  "    $h = (Get-FileHash $item.FullName -Algorithm SHA256).Hash.ToLower();" ^
  "    $files[$rel] = @{ category = 'template'; hash = $h };" ^
  "  }" ^
  "};" ^
  "foreach ($p in $projectPatterns) {" ^
  "  $dir = $p.Replace('/*','');" ^
  "  if (Test-Path $dir) {" ^
  "    foreach ($item in (Get-ChildItem -Path $dir -Recurse -File -ErrorAction SilentlyContinue)) {" ^
  "      $rel = $item.FullName.Substring((Get-Location).Path.Length + 1).Replace('\','/');" ^
  "      $h = (Get-FileHash $item.FullName -Algorithm SHA256).Hash.ToLower();" ^
  "      $files[$rel] = @{ category = 'project'; hash = $h };" ^
  "    }" ^
  "  }" ^
  "};" ^
  "$entries = @();" ^
  "foreach ($key in ($files.Keys | Sort-Object)) {" ^
  "  $v = $files[$key];" ^
  "  $entries += ('    \"' + $key + '\": { \"category\": \"' + $v.category + '\", \"hash\": \"' + $v.hash + '\" }');" ^
  "};" ^
  "$templateRemote = '';" ^
  "try { $templateRemote = (& git -C '%TEMPLATE_DIR%' remote get-url origin 2>$null) } catch {};" ^
  "$json = '{' + [Environment]::NewLine;" ^
  "$json += '  \"template_version\": \"2.4.0\",' + [Environment]::NewLine;" ^
  "$json += '  \"template_remote\": \"' + $templateRemote + '\",' + [Environment]::NewLine;" ^
  "$json += '  \"created\": \"' + $today + '\",' + [Environment]::NewLine;" ^
  "$json += '  \"updated\": \"' + $today + '\",' + [Environment]::NewLine;" ^
  "$json += '  \"files\": {' + [Environment]::NewLine;" ^
  "$json += ($entries -join (',' + [Environment]::NewLine));" ^
  "$json += [Environment]::NewLine + '  }' + [Environment]::NewLine + '}';" ^
  "[System.IO.File]::WriteAllText('.template-manifest.json', $json, [System.Text.UTF8Encoding]::new($false));" ^
  "Write-Host 'Generated .template-manifest.json'"

:: Initialize git
echo [5/7] Initializing git repository...
git init >nul 2>&1
if errorlevel 1 (
    echo WARNING: git not found. Skipping git init.
) else (
    git update-index --chmod=+x scripts/check-drift.sh 2>nul || true
    git add -A >nul 2>&1
    git commit -m "feat: initialize agent-ready project from template v2" >nul 2>&1
    echo Git repository initialized with initial commit.
)

:: Test hooks compatibility
echo [6/7] Testing hooks compatibility...
bash scripts/test-hooks.sh 2>nul && echo Hooks OK || echo WARNING: Some hooks may need adjustment. See .claude/hooks/

REM Store template origin for future updates
for /f "tokens=*" %%r in ('cd /d "%TEMPLATE_DIR%" ^&^& git remote get-url origin 2^>nul') do set TEMPLATE_REMOTE=%%r
if defined TEMPLATE_REMOTE (
    cd /d "%PROJECT_NAME%"
    git remote add template "%TEMPLATE_REMOTE%" 2>nul
    echo Template remote added: %TEMPLATE_REMOTE%
    cd ..
)

cd ..

echo [7/7] Done!
echo.
echo  ========================================================
echo    Project "%PROJECT_NAME%" created successfully!
echo.
echo    Next steps:
echo    1. Open "%PROJECT_NAME%" in Claude Code or Zed
echo    2. Tell Claude: "Set up my project" or /setup-project
echo    3. Claude asks about your stack and configures everything
echo.
echo    What's ready:
echo    - 19 rules (8 core + 8 domain guards + critical-thinking + strategic-thinking + analysis-first)
echo    - 9 agents (reviewer, implementer, security, etc.)
echo    - 22 skills (15 core + 6 domain review + strategic-review)
echo    - 12 commands (/implement, /sprint, /review, etc.)
echo    - Obsidian brain vault (open brain/ in Obsidian)
echo    - Self-improvement loop (tasks/lessons.md)
echo.
echo    Optional integrations:
echo    - Memory MCP: see integrations/memory-mcp/README.md
echo    - Telegram: see integrations/telegram/README.md
echo    - Beads: see integrations/beads/README.md
echo  ========================================================
echo.
pause
