@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

echo.
echo  ========================================================
echo    Agent Project Template - Setup
echo    Project payload + MCP bootstrap + sync-ready scaffolding
echo  ========================================================
echo.

:: Validate runtime before prompting or creating any project files.
where node >nul 2>nul
if errorlevel 1 (
    echo ERROR: Node.js 24+ with working node:sqlite is required. Install Node.js 24 LTS from https://nodejs.org/ and ensure it is on PATH.
    exit /b 1
)
node "%~dp0scripts\lib\codex-runtime.js"
if errorlevel 1 exit /b 1

:: Ask for project name
set /p "PROJECT_NAME=Enter project name: "
if "%PROJECT_NAME%"=="" (
    echo ERROR: Project name cannot be empty.
    exit /b 1
)

where git >nul 2>nul
if errorlevel 1 (
    echo ERROR: git is not installed or not in PATH. Please install git first.
    exit /b 1
)

set "RAW_PROJECT_NAME=%PROJECT_NAME%"
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "$env:RAW_PROJECT_NAME.Trim().ToLower().Replace(' ','-')"` ) do set "PROJECT_DIR=%%i"
set "RAW_PROJECT_NAME="
if "%PROJECT_DIR%"=="" (
    echo ERROR: Project name produced an empty directory name.
    exit /b 1
)

:: Check if directory already exists
if exist "%PROJECT_DIR%" (
    echo ERROR: Directory "%PROJECT_DIR%" already exists.
    exit /b 1
)

echo.
echo Creating project: %PROJECT_DIR%
echo.

:: Get the directory where this bat file lives (the template)
set "TEMPLATE_DIR=%~dp0"

:: Create project directory
mkdir "%PROJECT_DIR%"

set "RAW_TEMPLATE_DIR=%TEMPLATE_DIR%"
set "RAW_PROJECT_DIR=%PROJECT_DIR%"

:: Copy the project-facing payload from tracked files only so local artifacts never leak.
echo [1/6] Copying template payload...
powershell -NoProfile -Command ^
  "$ErrorActionPreference = 'Stop';" ^
  "$templateRoot = (Resolve-Path $env:RAW_TEMPLATE_DIR).Path;" ^
  "$projectRoot = (Resolve-Path $env:RAW_PROJECT_DIR).Path;" ^
  "$payloadPrefixes = @('.agents/','.claude/','.codex/','.github/','.vscode/','_reference/','brain/','docs/','integrations/','mcp-servers/','scripts/','tasks/','tests/');" ^
  "$payloadFiles = @('.editorconfig','.env.example','.gitattributes','.gitignore','.mcp.json','AGENTS.md','CLAUDE.md','CONTRIBUTING.md','ecosystem.md','orca.yaml','Makefile','PROJECT_SPEC.md','README.md','SECURITY.md','SETUP_GUIDE.md','upgrade-project.sh');" ^
  "$excludePatterns = @('.claude/settings.local.json','.github/workflows/release-template.yml','brain/.obsidian/*','brain/01-daily/*','brain/03-knowledge/research/*','brain/03-knowledge/audits/*','tasks/.current.md.bak','tasks/audit/*','tasks/debug-recovery-log.md','tasks/template-production-ready-plan.md','tasks/toolchain-discovery.json','tasks/toolchain-change-strategy.json','tasks/change-strategy.json','mcp-servers/context-router/node_modules/*','mcp-servers/context-router/dist/*');" ^
  "$starterOverrides = @('tasks/current.md','tasks/goal.md','tasks/.research-cache.md','tasks/lessons.md');" ^
  "$candidateMap = @{};" ^
  "$trackedFiles = @(& git -C $templateRoot ls-files); if ($LASTEXITCODE -ne 0) { throw 'Could not enumerate tracked template files' };" ^
  "foreach ($rel in $trackedFiles) { if ($rel) { $candidateMap[$rel.Replace('\','/')] = $true } }" ^
  "$copied = New-Object 'System.Collections.Generic.List[string]';" ^
  "foreach ($rel in $candidateMap.Keys) {" ^
  "  $normalized = $rel.Replace('\','/');" ^
  "  $isPrefixed = $false;" ^
  "  foreach ($prefix in $payloadPrefixes) { if ($normalized.StartsWith($prefix)) { $isPrefixed = $true; break } }" ^
  "  if (-not $isPrefixed -and $normalized -notin $payloadFiles) { continue }" ^
  "  $isExcluded = $false;" ^
  "  foreach ($pattern in $excludePatterns) { if ($normalized -like $pattern) { $isExcluded = $true; break } }" ^
  "  if ($isExcluded) { continue }" ^
  "  if ($normalized -in $starterOverrides) { continue }" ^
  "  $source = Join-Path $templateRoot $normalized;" ^
  "  if (-not (Test-Path $source -PathType Leaf)) { continue }" ^
  "  $target = Join-Path $projectRoot $normalized;" ^
  "  New-Item -ItemType Directory -Force -Path ([System.IO.Path]::GetDirectoryName($target)) | Out-Null;" ^
  "  Copy-Item $source $target -Force; $copied.Add($normalized);" ^
  "}" ^
  "$starterRoot = Join-Path $templateRoot 'templates/project-starter';" ^
  "if (Test-Path $starterRoot) {" ^
  "  foreach ($sourceRel in $candidateMap.Keys) { if ($sourceRel.StartsWith('templates/project-starter/')) {" ^
  "    $rel = $sourceRel.Substring('templates/project-starter/'.Length);" ^
  "    $target = Join-Path $projectRoot $rel;" ^
  "    New-Item -ItemType Directory -Force -Path ([System.IO.Path]::GetDirectoryName($target)) | Out-Null;" ^
  "    $source = Join-Path $templateRoot $sourceRel; if (-not (Test-Path $source -PathType Leaf)) { continue };" ^
  "    Copy-Item $source $target -Force; $copied.Add($rel);" ^
  "  } }" ^
  "}" ^
  "[System.IO.File]::WriteAllText((Join-Path $projectRoot '.setup-copy-receipt.json'), (ConvertTo-Json -InputObject @{ files = @($copied | Sort-Object -Unique) } -Depth 3), [System.Text.UTF8Encoding]::new($false));"
if errorlevel 1 exit /b 1

set "RAW_TEMPLATE_DIR="
set "RAW_PROJECT_DIR="
set "GIT_INDEX_FILE="

:: Create project-local settings (never touched by template sync)
if not exist "%PROJECT_DIR%\.claude\settings.local.json" (
    copy /Y "%TEMPLATE_DIR%.claude\settings.local.json.example" "%PROJECT_DIR%\.claude\settings.local.json" >nul 2>&1
)

:: Generate template manifest from the exact successful copy receipt
echo [2/6] Generating template manifest...
cd "%PROJECT_DIR%"
node scripts\lib\setup-manifest.js --receipt .setup-copy-receipt.json --source "%TEMPLATE_DIR%."
if errorlevel 1 exit /b 1

:: Initialize git
echo [3/6] Initializing git repository...
git init >nul 2>&1
if errorlevel 1 (
    echo WARNING: git not found. Skipping git init.
) else (
    git update-index --chmod=+x scripts/check-drift.sh >nul 2>&1
    git add -A >nul 2>&1
    git config user.name >nul 2>&1 || git config user.name "Agent Project Template"
    git config user.email >nul 2>&1 || git config user.email "template@localhost.invalid"
    for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "$match = Select-String -Path 'AGENTS.md' -Pattern 'Template Version:\s*([0-9.]+)' | Select-Object -First 1; if ($match -and $match.Matches.Count -gt 0) { $match.Matches[0].Groups[1].Value } else { '4.0.1' }"`) do set "TEMPLATE_VERSION=%%i"
    git commit -m "chore: initialize project from agent-project-template v%TEMPLATE_VERSION%" >nul 2>&1
    echo Git repository initialized with initial commit.
)

:: Run checks that are native to the detected Windows environment.
echo [4/6] Running native Windows checks...
where node >nul 2>nul
if errorlevel 1 (
    echo WARNING: Node.js not found. Skipping template validators.
) else (
    node scripts/validate-text-policy.js || exit /b 1
    node scripts/validate-production-standard.js || exit /b 1
)

REM Store template origin for future updates
for /f "tokens=*" %%r in ('cd /d "%TEMPLATE_DIR%" ^&^& git remote get-url origin 2^>nul') do set TEMPLATE_REMOTE=%%r
if defined TEMPLATE_REMOTE (
    git remote add template "%TEMPLATE_REMOTE%" 2>nul
    echo Template remote added: %TEMPLATE_REMOTE%
)

cd ..

echo [5/6] Preparing context-router with native Windows tooling...
where npm.cmd >nul 2>nul
if errorlevel 1 (
    echo WARNING: npm.cmd not found. Run npm.cmd ci in mcp-servers\context-router later.
) else (
    call npm.cmd --prefix "%PROJECT_DIR%\mcp-servers\context-router" ci || exit /b 1
    call npm.cmd --prefix "%PROJECT_DIR%\mcp-servers\context-router" run build || exit /b 1
)
echo.
echo [6/6] Done!
echo.
echo  ========================================================
echo    Project "%PROJECT_DIR%" created successfully!
echo    Shared writing library discovery ^(read-only; no books copied^):
node "%PROJECT_DIR%\scripts\writing-library.js" discover
if errorlevel 1 echo    Writing source grounding is blocked until the shared machine library is available.
echo    Authorized private-library users: node scripts\writing-library.js provision ^(requires your gh account access^).
echo.
echo    Next steps:
echo    1. cd "%PROJECT_DIR%"
echo    2. Open and trust the project in Codex, then run the project setup workflow
echo    3. Run: node scripts\code-intelligence-tools.js install --profile full
echo    4. From Git Bash run: bash scripts/bootstrap-mcp.sh --install --tool-profile=full
echo    5. Restart Codex and verify: codex mcp list
echo.
echo    Included:
echo    - Shared agent rules, hooks, and sync tooling
echo    - MCP bootstrap scripts and context-router sources
echo    - Codex-first docs with Claude Code compatibility
echo    - Brain/tasks scaffolding and troubleshooting docs
echo  ========================================================
echo.
