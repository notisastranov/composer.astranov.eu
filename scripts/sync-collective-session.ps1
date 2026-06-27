# Pack or install ASTRANOV COLLECTIVE INTELLIGENCE Grok session for another PC.
# Remote /resume entries fail with "path not found" until local session files exist under THIS PC's profile.
param(
  [ValidateSet('pack', 'install', 'status')]
  [string]$Action = 'status',
  [string]$ZipPath = '',
  [switch]$EssentialOnly
)

$ErrorActionPreference = 'Stop'
$COLLECTIVE_ID = '019efdcc-ee91-7572-9b29-240c4edaa26c'
$COLLECTIVE_NAME = 'ASTRANOV COLLECTIVE INTELLIGENCE'
$REPO = Split-Path $PSScriptRoot -Parent
$EXPORTS = Join-Path $REPO '.collective-exports'
$GROK_HOME = Join-Path $env:USERPROFILE '.grok'
$WORKSPACE = $env:USERPROFILE

function Get-EncodedCwd([string]$Path) {
  $resolved = (Resolve-Path $Path).Path
  return [uri]::EscapeDataString($resolved)
}

function Get-SessionDir {
  $enc = Get-EncodedCwd $WORKSPACE
  return Join-Path $GROK_HOME "sessions\$enc\$COLLECTIVE_ID"
}

function Get-DefaultZip {
  return Join-Path $EXPORTS 'aci-session-pack.zip'
}

function Patch-Summary([string]$SessionDir) {
  $summaryPath = Join-Path $SessionDir 'summary.json'
  if (-not (Test-Path $summaryPath)) { return }
  $raw = Get-Content $summaryPath -Raw -Encoding UTF8
  $cwd = $WORKSPACE.Replace('\', '\\')
  $grokHomeEsc = $GROK_HOME.Replace('\', '\\')
  $raw = $raw -replace '"cwd"\s*:\s*"[^"]*"', ('"cwd": "' + $cwd + '"')
  $raw = $raw -replace '"grok_home"\s*:\s*"[^"]*"', ('"grok_home": "' + $grokHomeEsc + '"')
  $raw = $raw -replace '"session_summary"\s*:\s*"[^"]*"', ('"session_summary": "' + $COLLECTIVE_NAME + '"')
  $raw = $raw -replace '"generated_title"\s*:\s*"[^"]*"', ('"generated_title": "' + $COLLECTIVE_NAME + '"')
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($summaryPath, $raw, $utf8NoBom)
}

function Write-Status {
  $dir = Get-SessionDir
  Write-Host "=== ACI SESSION STATUS ===" -ForegroundColor Cyan
  Write-Host "PC user:    $env:USERNAME"
  Write-Host "Workspace:  $WORKSPACE"
  Write-Host "Session ID: $COLLECTIVE_ID"
  Write-Host "Local path: $dir"
  if (Test-Path $dir) {
    $files = Get-ChildItem $dir -Recurse -File -ErrorAction SilentlyContinue
    $mb = [math]::Round((($files | Measure-Object Length -Sum).Sum / 1MB), 1)
    Write-Host "Status:     LOCAL ($($files.Count) files, $mb MB)" -ForegroundColor Green
  } else {
    Write-Host "Status:     MISSING - /resume will fail with path not found" -ForegroundColor Red
    Write-Host ""
    Write-Host "On the PC that has the session, run:" -ForegroundColor Yellow
    Write-Host "  powershell -ExecutionPolicy Bypass -File scripts\sync-collective-session.ps1 -Action pack"
    Write-Host "Copy .collective-exports\aci-session-pack.zip here, then run:" -ForegroundColor Yellow
    Write-Host "  powershell -ExecutionPolicy Bypass -File scripts\sync-collective-session.ps1 -Action install"
  }
}

switch ($Action) {
  'status' { Write-Status; break }

  'pack' {
    New-Item -ItemType Directory -Force -Path $EXPORTS | Out-Null
    $src = Get-SessionDir
    if (-not (Test-Path $src)) {
      Write-Error "Session not found at $src - run Grok on this PC first."
    }
    $zip = if ($ZipPath) { $ZipPath } else { Get-DefaultZip }
    $staging = Join-Path $env:TEMP "aci-pack-$COLLECTIVE_ID"
    if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $staging | Out-Null
    if ($EssentialOnly) {
      $names = @('summary.json','updates.jsonl','chat_history.jsonl','plan.json','signals.json','events.jsonl','prompt_context.json','system_prompt.txt','resources_state.json','rewind_points.jsonl')
      foreach ($n in $names) {
        $f = Join-Path $src $n
        if (Test-Path $f) { Copy-Item $f (Join-Path $staging $n) }
      }
    } else {
      Copy-Item $src (Join-Path $staging 'session') -Recurse
    }
    if (Test-Path $zip) { Remove-Item $zip -Force }
    Compress-Archive -Path (Join-Path $staging '*') -DestinationPath $zip -Force
    Remove-Item $staging -Recurse -Force
    $mb = [math]::Round((Get-Item $zip).Length / 1MB, 1)
    Write-Host "Packed -> $zip ($mb MB)" -ForegroundColor Green
    Write-Host "Copy this zip to the other PC (USB, OneDrive, etc.), then run -Action install"
    break
  }

  'install' {
    $zip = if ($ZipPath) { $ZipPath } else { Get-DefaultZip }
    if (-not (Test-Path $zip)) {
      Write-Error "Zip not found: $zip"
    }
    $dest = Get-SessionDir
    New-Item -ItemType Directory -Force -Path (Split-Path $dest -Parent) | Out-Null
    $staging = Join-Path $env:TEMP "aci-install-$COLLECTIVE_ID"
    if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
    Expand-Archive -Path $zip -DestinationPath $staging -Force
    $sessionSrc = Join-Path $staging 'session'
    if (Test-Path $sessionSrc) {
      if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
      Copy-Item $sessionSrc $dest -Recurse
    } else {
      if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
      New-Item -ItemType Directory -Force -Path $dest | Out-Null
      Get-ChildItem $staging -File | Copy-Item -Destination $dest
    }
    Patch-Summary $dest
    Remove-Item $staging -Recurse -Force

    $required = @('summary.json', 'updates.jsonl')
    $missing = $required | Where-Object { -not (Test-Path (Join-Path $dest $_)) }
    if ($missing.Count) {
      Write-Error ("Install incomplete - missing: " + ($missing -join ', '))
    }

    Write-Host "Installed session for this PC -> $dest" -ForegroundColor Green
    Write-Host "Launch: open NEW PowerShell, cd `$env:USERPROFILE, run: aci" -ForegroundColor Cyan
    Write-Host "Do NOT use /resume (FS_NOT_FOUND on cloud-only entries)." -ForegroundColor Yellow
    break
  }
}