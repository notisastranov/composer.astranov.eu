# Cloud-only: block --resume and local session duplication
$ErrorActionPreference = 'Stop'
$raw = [Console]::In.ReadToEnd()
if (-not $raw) { Write-Output '{"decision":"allow"}'; exit 0 }

$input = $raw | ConvertFrom-Json
$cmd = [string]($input.toolInput.command)
if (-not $cmd) { Write-Output '{"decision":"allow"}'; exit 0 }

$maintenance = '(?i)\bgrok\s+(sessions|export|import|login|logout|mcp|memory|models|plugin|setup|trace|update|version|help|completions|inspect|leader|worktree)\b'
if ($cmd -match $maintenance) { Write-Output '{"decision":"allow"}'; exit 0 }

if ($cmd -match '(?i)(--resume|-r\b|--continue|-c\b|/resume|/fork|/new\b)') {
  $reason = 'Cloud-only ACI: use aci (Grok memory). No local --resume or /resume.'
  Write-Output (@{ decision = 'deny'; reason = $reason } | ConvertTo-Json -Compress)
  exit 2
}

Write-Output '{"decision":"allow"}'
exit 0