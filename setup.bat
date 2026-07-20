@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

echo.
echo  ========================================================
echo    Agent Project Template - Setup
echo    Project payload + MCP bootstrap + sync-ready scaffolding
echo  ========================================================
echo.

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
  "$templateRoot = (Resolve-Path $env:RAW_TEMPLATE_DIR).Path;" ^
  "$projectRoot = (Resolve-Path $env:RAW_PROJECT_DIR).Path;" ^
  "$payloadPrefixes = @('.agents/','.claude/','.codex/','.github/','.vscode/','_reference/','brain/','docs/','integrations/','mcp-servers/','scripts/','tasks/','tests/');" ^
  "$payloadFiles = @('.editorconfig','.env.example','.gitattributes','.gitignore','.mcp.json','AGENTS.md','CLAUDE.md','CONTRIBUTING.md','ecosystem.md','Makefile','PROJECT_SPEC.md','README.md','SECURITY.md','SETUP_GUIDE.md','upgrade-project.sh');" ^
  "$excludePatterns = @('.claude/settings.local.json','.github/workflows/release-template.yml','brain/.obsidian/*','brain/01-daily/*','brain/03-knowledge/research/*','brain/03-knowledge/audits/*','tasks/.current.md.bak','tasks/audit/*','tasks/debug-recovery-log.md','tasks/template-production-ready-plan.md','tasks/toolchain-discovery.json','tasks/toolchain-change-strategy.json','tasks/change-strategy.json','mcp-servers/context-router/node_modules/*','mcp-servers/context-router/dist/*');" ^
  "$starterOverrides = @('tasks/current.md','tasks/goal.md','tasks/.research-cache.md','tasks/lessons.md');" ^
  "$candidateMap = @{};" ^
  "foreach ($rel in (& git -C $templateRoot ls-files)) { if ($rel) { $candidateMap[$rel.Replace('\','/')] = $true } }" ^
  "foreach ($rel in ($payloadFiles + $candidateMap.Keys)) {" ^
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
  "  Copy-Item $source $target -Force;" ^
  "}" ^
  "$starterRoot = Join-Path $templateRoot 'templates/project-starter';" ^
  "if (Test-Path $starterRoot) {" ^
  "  Get-ChildItem $starterRoot -Recurse -File | ForEach-Object {" ^
  "    $rel = $_.FullName.Substring($starterRoot.Length + 1).Replace('\','/');" ^
  "    $target = Join-Path $projectRoot $rel;" ^
  "    New-Item -ItemType Directory -Force -Path ([System.IO.Path]::GetDirectoryName($target)) | Out-Null;" ^
  "    Copy-Item $_.FullName $target -Force;" ^
  "  }" ^
  "}"

if exist "%TEMPLATE_DIR%scripts\task-brief.sh" (
    if not exist "%PROJECT_DIR%\\scripts" mkdir "%PROJECT_DIR%\\scripts"
    copy /Y "%TEMPLATE_DIR%scripts\task-brief.sh" "%PROJECT_DIR%\\scripts\\task-brief.sh" >nul
)

set "RAW_TEMPLATE_DIR="
set "RAW_PROJECT_DIR="
set "GIT_INDEX_FILE="

:: Create project-local settings (never touched by template sync)
if not exist "%PROJECT_DIR%\.claude\settings.local.json" (
    copy /Y "%TEMPLATE_DIR%.claude\settings.local.json.example" "%PROJECT_DIR%\.claude\settings.local.json" >nul 2>&1
)

:: Generate template manifest
echo [2/6] Generating template manifest...
cd "%PROJECT_DIR%"
powershell -NoProfile -Command ^
  "$today = (Get-Date -Format 'yyyy-MM-dd');" ^
  "$templateVersion = '4.0.1';" ^
  "try {" ^
  "  $versionMatch = Select-String -Path (Join-Path '%TEMPLATE_DIR%' 'AGENTS.md') -Pattern 'Template Version:\s*([0-9.]+)' -ErrorAction Stop | Select-Object -First 1;" ^
  "  if ($versionMatch.Matches.Count -gt 0) { $templateVersion = $versionMatch.Matches[0].Groups[1].Value }" ^
  "} catch {}" ^
  "$templateFiles = @(" ^
  "  '.codex/config.toml'," ^
  "  '.codex/hooks.json'," ^
  "  '.codex/agents/*.toml'," ^
  "  '.claude/settings.json'," ^
  "  '.claude/settings.local.json.example'," ^
  "  '.github/ci.yml.template'," ^
  "  '.editorconfig'," ^
  "  '.env.example'," ^
  "  '.gitattributes'," ^
  "  'Makefile'," ^
  "  'SECURITY.md'," ^
  "  'CONTRIBUTING.md'," ^
  "  'README.md'," ^
  "  'SETUP_GUIDE.md'," ^
  "  'upgrade-project.sh'," ^
  "  'AGENTS.md'," ^
  "  'CLAUDE.md'," ^
  "  'DESIGN.md'," ^
  "  'design-policy.ignore'," ^
  "  'PROJECT_SPEC.md'," ^
  "  'ecosystem.md'," ^
  "  '.gitignore'," ^
  "  '.mcp.json'," ^
  "  '.vscode/extensions.json'" ^
  ");" ^
  "$templatePatterns = @(" ^
  "  '.agents/skills/*/SKILL.md'," ^
  "  '.agents/skills/*/agents/openai.yaml'," ^
  "  '.agents/skills/*/references/*.md'," ^
  "  '.claude/docs/*.md'," ^
  "  '.claude/docs/domain-full/*.md'," ^
  "  '.claude/rules/*.md'," ^
  "  '.claude/library/process/*.md'," ^
  "  '.claude/library/technical/*.md'," ^
  "  '.claude/library/technical/*.json'," ^
  "  '.claude/library/meta/*.md'," ^
  "  '.claude/library/domain/*.md'," ^
  "  '.claude/library/product/*.md'," ^
  "  '.claude/library/conflict/*.md'," ^
  "  '.claude/agents/*.md'," ^
  "  '.claude/skills/*/SKILL.md'," ^
  "  '.claude/commands/*.md'," ^
  "  '.claude/hooks/*.sh'," ^
  "  '.claude/pipelines/*.md'," ^
  "  'scripts/*.sh'," ^
  "  'scripts/*.js'," ^
  "  'scripts/*.cmd'," ^
  "  'scripts/lib/*.sh'," ^
  "  'scripts/lib/*.js'," ^
  "  'mcp-servers/context-router/package-lock.json'," ^
  "  'mcp-servers/context-router/src/*.ts'," ^
  "  'mcp-servers/context-router/package.json'," ^
  "  'mcp-servers/context-router/tsconfig.json'," ^
  "  'tests/rules/*.test.md'," ^
  "  'tests/fixtures/writing-tools/*.js'," ^
  "  'tests/fixtures/change-strategy/*.json'," ^
  "  'docs/AGENT_PIPELINES.md'," ^
  "  'docs/CODEX_FANOUT_PATTERNS.md'," ^
  "  'docs/CODEX_SKILLS_AUDIT.md'," ^
  "  'docs/CODEX_SUBAGENTS_AUDIT.md'," ^
  "  'docs/CODE_INTELLIGENCE_TOOLCHAIN.md'," ^
  "  'docs/MIGRATION_MATRIX.md'," ^
  "  'docs/OPENAI_MODEL_GUIDANCE.md'," ^
  "  'docs/WRITING_REFERENCE_PROVENANCE.md'," ^
  "  'docs/WRITING_WORKFLOW.md'," ^
  "  'docs/PRODUCT_BOUNDARY.md'," ^
  "  'docs/RELEASE_CHECKLIST.md'," ^
  "  'docs/TEMPLATE_RELEASES.md'," ^
  "  'docs/SAFE_DEFAULTS.md'," ^
  "  'docs/SHARED_CONVENTIONS.md'," ^
  "  'docs/SUPPORTED_ENVIRONMENTS.md'," ^
  "  'docs/*.md.template'," ^
  "  '_reference/*.md'," ^
  "  '_reference/*.json'," ^
  "  '_reference/*.toml'," ^
  "  '.github/workflows/validate-template.yml'" ^
  ");" ^
  "$projectPatterns = @(" ^
  "  'tasks/*'," ^
  "  'brain/*'" ^
  ");" ^
  "$getCategory = {" ^
  "  param([string]$path)" ^
  "  switch -Wildcard ($path.Replace('\','/')) {" ^
  "    'CLAUDE.md' { 'project'; break }" ^
  "    'DESIGN.md' { 'project'; break }" ^
  "    'design-policy.ignore' { 'project'; break }" ^
  "    'PROJECT_SPEC.md' { 'project'; break }" ^
  "    'ecosystem.md' { 'project'; break }" ^
  "    'tasks/*' { 'project'; break }" ^
  "    'brain/*' { 'project'; break }" ^
  "    '.gitignore' { 'hybrid'; break }" ^
  "    '.codex/config.toml' { 'hybrid'; break }" ^
  "    '.mcp.json' { 'hybrid'; break }" ^
  "    '.vscode/extensions.json' { 'hybrid'; break }" ^
  "    default { 'template' }" ^
  "  }" ^
  "};" ^
  "$files = @{};" ^
  "foreach ($f in $templateFiles) {" ^
  "  if (Test-Path $f) {" ^
  "    $h = (Get-FileHash $f -Algorithm SHA256).Hash.ToLower();" ^
  "    $files[$f] = @{ category = (& $getCategory $f); hash = $h };" ^
  "  }" ^
  "};" ^
  "foreach ($p in $templatePatterns) {" ^
  "  foreach ($item in (Get-ChildItem -Path $p -File -ErrorAction SilentlyContinue)) {" ^
  "    $rel = $item.FullName.Substring((Get-Location).Path.Length + 1).Replace('\','/');" ^
  "    $h = (Get-FileHash $item.FullName -Algorithm SHA256).Hash.ToLower();" ^
  "    $files[$rel] = @{ category = (& $getCategory $rel); hash = $h };" ^
  "  }" ^
  "};" ^
  "foreach ($p in $projectPatterns) {" ^
  "  $dir = $p.Replace('/*','');" ^
  "  if (Test-Path $dir) {" ^
  "    foreach ($item in (Get-ChildItem -Path $dir -Recurse -File -ErrorAction SilentlyContinue)) {" ^
  "      $rel = $item.FullName.Substring((Get-Location).Path.Length + 1).Replace('\','/');" ^
  "      $h = (Get-FileHash $item.FullName -Algorithm SHA256).Hash.ToLower();" ^
  "      $files[$rel] = @{ category = (& $getCategory $rel); hash = $h };" ^
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
  "$json += '  \"template_version\": \"' + $templateVersion + '\",' + [Environment]::NewLine;" ^
  "$json += '  \"template_remote\": \"' + $templateRemote + '\",' + [Environment]::NewLine;" ^
  "$json += '  \"created\": \"' + $today + '\",' + [Environment]::NewLine;" ^
  "$json += '  \"updated\": \"' + $today + '\",' + [Environment]::NewLine;" ^
  "$json += '  \"files\": {' + [Environment]::NewLine;" ^
  "$json += ($entries -join (',' + [Environment]::NewLine));" ^
  "$json += [Environment]::NewLine + '  }' + [Environment]::NewLine + '}';" ^
  "[System.IO.File]::WriteAllText('.template-manifest.json', $json, [System.Text.UTF8Encoding]::new($false));" ^
  "Write-Host 'Generated .template-manifest.json'"

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
    npm.cmd --prefix "%PROJECT_DIR%\mcp-servers\context-router" ci || exit /b 1
    npm.cmd --prefix "%PROJECT_DIR%\mcp-servers\context-router" run build || exit /b 1
)
echo.
echo [6/6] Done!
echo.
echo  ========================================================
echo    Project "%PROJECT_DIR%" created successfully!
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
