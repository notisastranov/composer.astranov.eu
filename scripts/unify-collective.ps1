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

$encodedCwd = [uri]::EscapeDataString((Resolve-Path $WORKSPACE).Path)
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

Set-Location $WORKSPACE
New-Item -ItemType Directory -Force -Path $EXPORTS | Out-Null

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
`$script:AstranovCollectiveSession = '$COLLECTIVE_ID'
`$script:AstranovGrokSubcmds = @('agent','completions','dashboard','export','help','import','inspect','leader','login','logout','mcp','memory','models','plugin','sessions','setup','trace','update','version','worktree','v')
function aci { & '$startEsc' @args }
function Invoke-AstranovGrok {
  param([string[]]`$GrokArgs)
  `$grokb = (Get-Command grok-native -CommandType Application -ErrorAction SilentlyContinue).Source
  if (-not `$grokb) { `$grokb = (Get-Command grok -CommandType Application -ErrorAction SilentlyContinue).Source }
  if (-not `$grokb) { Write-Error 'grok not found'; return }
  `$cid = `$script:AstranovCollectiveSession
  if (`$GrokArgs.Count -gt 0 -and `$script:AstranovGrokSubcmds -contains `$GrokArgs[0]) {
    & `$grokb @GrokArgs; return
  }
  `$out = New-Object System.Collections.Generic.List[string]
  for (`$i = 0; `$i -lt `$GrokArgs.Count; `$i++) {
    `$a = `$GrokArgs[`$i]
    if (`$a -eq '--continue' -or `$a -eq '-c') {
      `$out.Add('--resume'); `$out.Add(`$cid); continue
    }
    if (`$a -eq '--session-id' -or `$a -eq '-s') {
      `$out.Add('--resume'); `$out.Add(`$cid)
      if (`$i + 1 -lt `$GrokArgs.Count -and -not `$GrokArgs[`$i + 1].StartsWith('-')) { `$i++ }
      continue
    }
    if (`$a -eq '--resume' -or `$a -eq '-r') {
      `$out.Add('--resume')
      if (`$i + 1 -lt `$GrokArgs.Count -and `$GrokArgs[`$i + 1] -match '^[0-9a-f-]{36}$') { `$out.Add(`$GrokArgs[++`$i]) }
      else { `$out.Add(`$cid) }
      continue
    }
    `$out.Add(`$a)
  }
  if (`$out -notcontains '--resume') { `$out.Insert(0, `$cid); `$out.Insert(0, '--resume') }
  Set-Location `$env:USERPROFILE
  & `$grokb @out
}
if (-not (Get-Command grok-native -ErrorAction SilentlyContinue)) {
  `$grokb = (Get-Command grok -CommandType Application -ErrorAction SilentlyContinue).Source
  if (`$grokb) {
    function grok-native { & `$grokb @args }
    function grok { Invoke-AstranovGrok -GrokArgs @args }
  }
} else {
  function grok { Invoke-AstranovGrok -GrokArgs @args }
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

$zip = Join-Path $EXPORTS 'aci-session-pack.zip'
if (Test-Path $SYNC_SCRIPT) { & $SYNC_SCRIPT -Action status }
if (-not (Test-Path $summaryPath) -and (Test-Path $zip) -and (Test-Path $SYNC_SCRIPT)) {
  Write-Host "Installing session from aci-session-pack.zip..." -ForegroundColor Yellow
  & $SYNC_SCRIPT -Action install -ZipPath $zip
}

Write-Host ""
Write-Host "IMPORTANT: /resume shows cloud sessions but they fail with path not found on other PCs." -ForegroundColor Yellow
Write-Host "Do NOT use /resume. On each PC use:" -ForegroundColor Yellow
Write-Host "  1. Desktop shortcut: ASTRANOV COLLECTIVE INTELLIGENCE"
Write-Host "  2. Command: aci"
Write-Host "  3. First time on a new PC: copy aci-session-pack.zip then run unify-collective.ps1"
Write-Host ""
grok sessions list