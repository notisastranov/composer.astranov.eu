# Always open the single ASTRANOV COLLECTIVE INTELLIGENCE Grok session (no resume picker)
$COLLECTIVE_ID = $env:ASTRANOV_COLLECTIVE_SESSION
if (-not $COLLECTIVE_ID) { $COLLECTIVE_ID = '019efdcc-ee91-7572-9b29-240c4edaa26c' }
$env:GROK_MEMORY = '1'
$WORKSPACE = $env:USERPROFILE
$REPO = Join-Path $WORKSPACE 'Documents\GitHub\Astranov'
$SYNC = Join-Path $REPO 'scripts\sync-collective-session.ps1'

function Get-EncodedCwd([string]$Path) {
  return [uri]::EscapeDataString((Resolve-Path $Path).Path)
}

function Get-GrokExe {
  $cmd = Get-Command grok-native -CommandType Application -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $cmd = Get-Command grok -CommandType Application -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $fallback = Join-Path $env:USERPROFILE '.grok\bin\grok.exe'
  if (Test-Path $fallback) { return $fallback }
  return $null
}

Set-Location $WORKSPACE
$enc = Get-EncodedCwd $WORKSPACE
$sessionDir = Join-Path $env:USERPROFILE ".grok\sessions\$enc\$COLLECTIVE_ID"
$updates = Join-Path $sessionDir 'updates.jsonl'
$summary = Join-Path $sessionDir 'summary.json'

if (-not (Test-Path $updates) -or -not (Test-Path $summary)) {
  $zip = Join-Path $REPO '.collective-exports\aci-session-pack.zip'
  if ((Test-Path $zip) -and (Test-Path $SYNC)) {
    Write-Host 'Installing collective session for this PC...' -ForegroundColor Yellow
    & $SYNC -Action install -ZipPath $zip
  } else {
    Write-Host 'FS_NOT_FOUND: session files missing on this PC.' -ForegroundColor Red
    Write-Host "Expected: $sessionDir"
    Write-Host ''
    Write-Host 'Fix: copy aci-session-pack.zip from main PC, then run:'
    Write-Host "  powershell -ExecutionPolicy Bypass -File `"$REPO\scripts\bootstrap-other-pc.ps1`""
    exit 1
  }
}

$grokb = Get-GrokExe
if (-not $grokb) { Write-Error 'grok not found in PATH'; exit 1 }

Write-Host 'ASTRANOV COLLECTIVE INTELLIGENCE' -ForegroundColor Cyan
Write-Host "Session $COLLECTIVE_ID"
Write-Host "Workspace $WORKSPACE" -ForegroundColor DarkGray
& $grokb --resume $COLLECTIVE_ID @args