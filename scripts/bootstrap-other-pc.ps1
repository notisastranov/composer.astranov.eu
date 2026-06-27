# Cloud-only setup on a second PC — no zip, no local session copies.
$ErrorActionPreference = 'Stop'
$installer = Join-Path $PSScriptRoot 'install-aci-only.ps1'
$unify = Join-Path $PSScriptRoot 'unify-collective.ps1'

Write-Host '=== ASTRANOV CLOUD-ONLY BOOTSTRAP ===' -ForegroundColor Cyan
Write-Host "User: $env:USERNAME"
Write-Host "Home: $env:USERPROFILE"
Write-Host ''

if (Test-Path -LiteralPath $installer) {
  & $installer
} else {
  Write-Host 'Run: git pull, then install-aci-only.ps1' -ForegroundColor Yellow
  exit 1
}
if (Test-Path -LiteralPath $unify) { & $unify }

Write-Host ''
Write-Host 'Do NOT use /resume. Open NEW PowerShell, run: aci' -ForegroundColor Green