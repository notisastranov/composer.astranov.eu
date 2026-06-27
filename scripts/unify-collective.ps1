# Unify Grok + Astranov: one user ASTRANOV, one session ASTRANOV COLLECTIVE INTELLIGENCE
$ErrorActionPreference = 'Stop'

$COLLECTIVE_ID = '019efdcc-ee91-7572-9b29-240c4edaa26c'
$COLLECTIVE_NAME = 'ASTRANOV COLLECTIVE INTELLIGENCE'
$WORKSPACE = 'C:\Users\Astranov'
$GROK_HOME = Join-Path $env:USERPROFILE '.grok'
$REPO = Split-Path $PSScriptRoot -Parent
$EXPORTS = Join-Path $REPO '.collective-exports'
$START_SCRIPT = Join-Path $REPO 'scripts\start-aci.ps1'

Write-Host "=== ASTRANOV COLLECTIVE UNIFY ===" -ForegroundColor Cyan
Write-Host "User: ASTRANOV"
Write-Host "Session: $COLLECTIVE_NAME"
Write-Host "Session ID: $COLLECTIVE_ID"
Write-Host ""

if ($env:USERNAME -ne 'Astranov') {
  Write-Warning "Windows user is '$($env:USERNAME)' not Astranov - switch Windows account on every device."
}

[Environment]::SetEnvironmentVariable('GROK_MEMORY', '1', 'User')
[Environment]::SetEnvironmentVariable('ASTRANOV_COLLECTIVE_SESSION', $COLLECTIVE_ID, 'User')
[Environment]::SetEnvironmentVariable('ASTRANOV_COLLECTIVE_USER', 'ASTRANOV', 'User')

$summaryPath = Join-Path $GROK_HOME "sessions\C%3A%5CUsers%5CAstranov\$COLLECTIVE_ID\summary.json"
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

$marker = '# ASTRANOV COLLECTIVE GROK'
$profileBlock = @"
$marker
`$script:AstranovCollectiveSession = '$COLLECTIVE_ID'
function aci { & '$START_SCRIPT' @args }
if (-not (Get-Command grok-native -ErrorAction SilentlyContinue)) {
  `$grokb = (Get-Command grok -CommandType Application -ErrorAction SilentlyContinue).Source
  if (`$grokb) {
    function grok-native { & `$grokb @args }
    function grok {
      if (`$args.Count -eq 0) { & `$grokb --resume `$script:AstranovCollectiveSession; return }
      & `$grokb @args
    }
  }
}
"@

if (Test-Path $profilePath) {
  $existing = Get-Content $profilePath -Raw
  if ($existing -notmatch [regex]::Escape($marker)) {
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
Write-Host "IMPORTANT: The /resume picker lists cloud sessions from ALL PCs (Users-N included)." -ForegroundColor Yellow
Write-Host "Do NOT use /resume. Use one of these instead:" -ForegroundColor Yellow
Write-Host "  1. Desktop shortcut: ASTRANOV COLLECTIVE INTELLIGENCE"
Write-Host "  2. Command: aci"
Write-Host "  3. Command: grok --resume $COLLECTIVE_ID"
Write-Host ""
grok sessions list