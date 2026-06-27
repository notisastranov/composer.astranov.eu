# Always open the single ASTRANOV COLLECTIVE INTELLIGENCE Grok session (no resume picker)
$COLLECTIVE_ID = $env:ASTRANOV_COLLECTIVE_SESSION
if (-not $COLLECTIVE_ID) { $COLLECTIVE_ID = '019efdcc-ee91-7572-9b29-240c4edaa26c' }
$env:GROK_MEMORY = '1'
Set-Location 'C:\Users\Astranov'
Write-Host 'ASTRANOV COLLECTIVE INTELLIGENCE' -ForegroundColor Cyan
Write-Host "Session $COLLECTIVE_ID" -ForegroundColor DarkGray
$grokb = (Get-Command grok -CommandType Application -ErrorAction SilentlyContinue).Source
if (-not $grokb) { Write-Error 'grok not found in PATH'; exit 1 }
& $grokb --resume $COLLECTIVE_ID @args