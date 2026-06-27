# One-shot setup on a second PC. Fixes FS_NOT_FOUND / path not found from /resume.
$ErrorActionPreference = 'Stop'
$REPO = Split-Path $PSScriptRoot -Parent
$zip = Join-Path $REPO '.collective-exports\aci-session-pack.zip'
$sync = Join-Path $PSScriptRoot 'sync-collective-session.ps1'
$unify = Join-Path $PSScriptRoot 'unify-collective.ps1'

Write-Host '=== ASTRANOV OTHER-PC BOOTSTRAP ===' -ForegroundColor Cyan
Write-Host "User: $env:USERNAME"
Write-Host "Home: $env:USERPROFILE"
Write-Host ""

if (-not (Test-Path $zip)) {
  Write-Host "MISSING: $zip" -ForegroundColor Red
  Write-Host ""
  Write-Host "On your MAIN PC run:" -ForegroundColor Yellow
  Write-Host "  powershell -ExecutionPolicy Bypass -File scripts\sync-collective-session.ps1 -Action pack"
  Write-Host "Copy aci-session-pack.zip to this folder:" -ForegroundColor Yellow
  Write-Host "  $zip"
  exit 1
}

& $sync -Action install -ZipPath $zip
& $unify
& $sync -Action status

Write-Host ""
Write-Host "Do NOT use /resume (causes FS_NOT_FOUND on cloud entries)." -ForegroundColor Yellow
Write-Host "Open a NEW PowerShell window, then run:" -ForegroundColor Green
Write-Host "  aci"