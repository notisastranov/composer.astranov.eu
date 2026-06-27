# Cloud-only ACI setup on any PC — no zip, no local session files.
$ErrorActionPreference = 'Stop'
$COLLECTIVE_ID = '019efdcc-ee91-7572-9b29-240c4edaa26c'
$GROK_HOME = Join-Path $env:USERPROFILE '.grok'

[Environment]::SetEnvironmentVariable('GROK_MEMORY', '1', 'User')
[Environment]::SetEnvironmentVariable('ASTRANOV_COLLECTIVE_SESSION', $COLLECTIVE_ID, 'User')
[Environment]::SetEnvironmentVariable('ASTRANOV_CLOUD_ONLY', '1', 'User')

$grokb = Join-Path $GROK_HOME 'bin\grok.exe'
if (-not (Test-Path $grokb)) {
  $cmd = Get-Command grok -CommandType Application -ErrorAction SilentlyContinue
  if ($cmd) { $grokb = $cmd.Source }
}
if (-not (Test-Path $grokb)) {
  Write-Host 'Set env vars. Install Grok CLI, then run: aci' -ForegroundColor Yellow
  exit 0
}

$marker = '# ASTRANOV COLLECTIVE GROK'
$profilePath = $PROFILE
$profileDir = Split-Path $profilePath -Parent
if (-not (Test-Path $profileDir)) { New-Item -ItemType Directory -Force -Path $profileDir | Out-Null }
$startScript = Join-Path $PSScriptRoot 'start-aci.ps1'
if (-not (Test-Path $startScript)) {
  $startScript = Join-Path $env:USERPROFILE 'Documents\GitHub\Astranov\scripts\start-aci.ps1'
}
$startEsc = $startScript.Replace("'", "''")
$block = @"
$marker
function aci { & '$startEsc' @args }
function grok {
  `$sub = @('agent','completions','dashboard','export','help','import','inspect','leader','login','logout','mcp','memory','models','plugin','sessions','setup','trace','update','version','worktree','v')
  if (`$args.Count -gt 0 -and `$sub -contains `$args[0]) { & '$($grokb.Replace("'", "''"))' @args; return }
  & '$startEsc' @args
}
"@
if (Test-Path $profilePath) {
  $existing = Get-Content $profilePath -Raw
  if ($existing -match [regex]::Escape($marker)) {
    $start = $existing.IndexOf($marker)
    $existing = $existing.Substring(0, $start) + $block.TrimEnd()
  } else {
    $existing = $existing.TrimEnd() + "`n`n" + $block
  }
  Set-Content $profilePath $existing.TrimEnd() -Encoding UTF8
} else {
  Set-Content $profilePath $block -Encoding UTF8
}

Write-Host 'ACI cloud-only profile installed.' -ForegroundColor Green
Write-Host 'Open a NEW PowerShell window, then run: aci' -ForegroundColor Cyan