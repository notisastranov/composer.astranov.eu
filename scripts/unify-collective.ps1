# Unify Grok + Astranov: one user ASTRANOV, one session ASTRANOV COLLECTIVE INTELLIGENCE
$ErrorActionPreference = 'Stop'

$COLLECTIVE_ID = '019efdcc-ee91-7572-9b29-240c4edaa26c'
$COLLECTIVE_NAME = 'ASTRANOV COLLECTIVE INTELLIGENCE'
$WORKSPACE = $env:USERPROFILE
$GROK_HOME = Join-Path $env:USERPROFILE '.grok'
$REPO = Split-Path $PSScriptRoot -Parent
$SYNC_SCRIPT = Join-Path $REPO 'scripts\sync-collective-session.ps1'
$EXPORTS = Join-Path $REPO '.collective-exports'
$START_SCRIPT = Join-Path $REPO 'scripts\start-aci.ps1'

Write-Host "=== ASTRANOV COLLECTIVE UNIFY ===" -ForegroundColor Cyan
Write-Host "User: ASTRANOV"
Write-Host "Session: $COLLECTIVE_NAME"
Write-Host "Session ID: $COLLECTIVE_ID"
Write-Host ""

if ($env:USERNAME -ne 'Astranov') {
  Write-Warning "Windows user is '$($env:USERNAME)' not Astranov - session sync will use $WORKSPACE on this PC."
}

[Environment]::SetEnvironmentVariable('GROK_MEMORY', '1', 'User')
[Environment]::SetEnvironmentVariable('ASTRANOV_COLLECTIVE_SESSION', $COLLECTIVE_ID, 'User')
[Environment]::SetEnvironmentVariable('ASTRANOV_COLLECTIVE_USER', 'ASTRANOV', 'User')
[Environment]::SetEnvironmentVariable('ASTRANOV_CLOUD_ONLY', '1', 'User')

$wsPath = $WORKSPACE
if (Test-Path -LiteralPath $wsPath) { $wsPath = (Get-Item -LiteralPath $wsPath).FullName }
$encodedCwd = [uri]::EscapeDataString($wsPath)
$summaryPath = Join-Path $GROK_HOME "sessions\$encodedCwd\$COLLECTIVE_ID\summary.json"
if (Test-Path $summaryPath) {
  $raw = Get-Content $summaryPath -Raw
  $raw = $raw -replace '"session_summary"\s*:\s*"[^"]*"', ('"session_summary": "' + $COLLECTIVE_NAME + '"')
  $raw = $raw -replace '"generated_title"\s*:\s*"[^"]*"', ('"generated_title": "' + $COLLECTIVE_NAME + '"')
  Set-Content $summaryPath $raw -Encoding UTF8 -NoNewline
  Write-Host "Canonical session title set." -ForegroundColor Green
}

$toDelete = @(
  '019ef933-8f60-7573-843b-12ef3f4f1f7c',
  '019eda39-ef3e-7e00-9eb2-62343c966b13',
  '019eb26b-c8fc-7723-8810-948981bb0676',
  '019e739e-cf5c-7d11-8c5e-f036fec61b9c'
)

if (Test-Path -LiteralPath $WORKSPACE) { Set-Location -LiteralPath $WORKSPACE }
New-Item -ItemType Directory -Force -Path $EXPORTS -ErrorAction SilentlyContinue | Out-Null

foreach ($id in $toDelete) {
  $safe = $id.Split('-')[0]
  $out = Join-Path $EXPORTS "archive-$safe.md"
  if (-not (Test-Path $out)) {
    try { grok export $id $out 2>$null } catch { }
  }
  try { grok sessions delete $id 2>$null; Write-Host "Removed local session $safe" -ForegroundColor Yellow } catch { }
}

# PowerShell profile: bare "grok" opens collective session (skips resume picker)
$profilePath = $PROFILE
$profileDir = Split-Path $profilePath -Parent
if (-not (Test-Path $profileDir)) { New-Item -ItemType Directory -Force -Path $profileDir | Out-Null }

# Install global Grok hooks (block new sessions from agent shell)
$hooksSrc = Join-Path $REPO '.grok\hooks'
$hooksDst = Join-Path $GROK_HOME 'hooks'
if (Test-Path $hooksSrc) {
  New-Item -ItemType Directory -Force -Path $hooksDst | Out-Null
  Copy-Item (Join-Path $hooksSrc '*') $hooksDst -Force
  Write-Host "Installed Grok session guard hooks." -ForegroundColor Green
}

$marker = '# ASTRANOV COLLECTIVE GROK'
$startEsc = $START_SCRIPT.Replace("'", "''")
$profileBlock = @"
$marker
function aci { & '$startEsc' @args }
function grok {
  `$sub = @('agent','completions','dashboard','export','help','import','inspect','leader','login','logout','mcp','memory','models','plugin','sessions','setup','trace','update','version','worktree','v')
  if (`$args.Count -gt 0 -and `$sub -contains `$args[0]) {
    `$g = (Get-Command grok-native -ErrorAction SilentlyContinue).Source
    if (-not `$g) { `$g = (Get-Command grok -CommandType Application -ErrorAction SilentlyContinue).Source }
    if (`$g) { & `$g @args; return }
  }
  & '$startEsc' @args
}
"@

if (Test-Path $profilePath) {
  $existing = Get-Content $profilePath -Raw
  if ($existing -match [regex]::Escape($marker)) {
    $start = $existing.IndexOf($marker)
    $existing = $existing.Substring(0, $start) + $profileBlock.TrimEnd()
    Set-Content $profilePath $existing.TrimEnd() -Encoding UTF8
  } else {
    Add-Content $profilePath "`n$profileBlock"
  }
} else {
  Set-Content $profilePath $profileBlock -Encoding UTF8
}
Write-Host "Installed PowerShell profile (grok with no args -> collective session)." -ForegroundColor Green

# Desktop shortcut
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop 'ASTRANOV COLLECTIVE INTELLIGENCE.lnk'
$wsh = New-Object -ComObject WScript.Shell
$sc = $wsh.CreateShortcut($shortcutPath)
$sc.TargetPath = 'powershell.exe'
$sc.Arguments = "-NoExit -ExecutionPolicy Bypass -File `"$START_SCRIPT`""
$sc.WorkingDirectory = $WORKSPACE
$sc.IconLocation = 'powershell.exe,0'
$sc.Description = $COLLECTIVE_NAME
$sc.Save()
Write-Host "Desktop shortcut created." -ForegroundColor Green

Write-Host ""
Write-Host "CLOUD ONLY: no local session sync. Grok memory + Supabase globe_session." -ForegroundColor Cyan
Write-Host "On every PC: aci  (do NOT use /resume)" -ForegroundColor Yellow
Write-Host ""