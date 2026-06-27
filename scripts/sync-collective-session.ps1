# DEPRECATED: cloud-only mode — session state lives in Supabase + Grok memory, not local files.
param(
  [ValidateSet('pack', 'install', 'status')]
  [string]$Action = 'status'
)

Write-Host '=== ASTRANOV CLOUD-ONLY ===' -ForegroundColor Cyan
Write-Host 'Local session pack/install is disabled.'
Write-Host 'Globe app: Supabase profiles.globe_session'
Write-Host 'Grok: run aci (memory enabled, no --resume)'
Write-Host ''
Write-Host 'On any PC:'
Write-Host '  powershell -ExecutionPolicy Bypass -File scripts\install-aci-only.ps1'
Write-Host '  aci'
exit 0