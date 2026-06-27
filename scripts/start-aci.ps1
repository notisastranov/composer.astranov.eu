# ASTRANOV COLLECTIVE INTELLIGENCE — cloud only (Grok memory, no local session files)
$env:GROK_MEMORY = '1'
$WORKSPACE = $env:USERPROFILE
$COLLECTIVE_NAME = 'ASTRANOV COLLECTIVE INTELLIGENCE'

function Get-GrokExe {
  $fallback = Join-Path $WORKSPACE '.grok\bin\grok.exe'
  if (Test-Path -LiteralPath $fallback) { return $fallback }
  $cmd = Get-Command grok-native -CommandType Application -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $cmd = Get-Command grok -CommandType Application -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  return $null
}

Set-Location -LiteralPath $WORKSPACE
$grokb = Get-GrokExe
if (-not $grokb) { Write-Error 'grok not found - install Grok CLI first'; exit 1 }

Write-Host $COLLECTIVE_NAME -ForegroundColor Cyan
Write-Host 'Cloud-only: Grok memory + Supabase (no local session sync)' -ForegroundColor DarkGray
& $grokb --experimental-memory @args