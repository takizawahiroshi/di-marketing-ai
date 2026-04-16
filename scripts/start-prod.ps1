# DI Marketing AI - Production Start Script
# Usage: .\scripts\start-prod.ps1

$root = Split-Path -Parent $PSScriptRoot
$env:PYTHONPATH = $root

Set-Location $root

Write-Host "========================================" -ForegroundColor Green
Write-Host "  DI Marketing AI  [PRODUCTION]" -ForegroundColor Green
Write-Host "  http://0.0.0.0:8000" -ForegroundColor Green
Write-Host "  API: /api/health  /api/agents  /api/run" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

$envFile = Join-Path $root "backend\.env"
if (-not (Test-Path $envFile)) {
    Write-Host "[ERROR] backend\.env not found." -ForegroundColor Red
    Write-Host "  -> backend\.env.example をコピーして ANTHROPIC_API_KEY を設定してください" -ForegroundColor Yellow
    exit 1
}

# ANTHROPIC_API_KEY チェック
$content = Get-Content $envFile -Raw
if ($content -notmatch "sk-ant-") {
    Write-Host "[WARN] ANTHROPIC_API_KEY が設定されていない可能性があります" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Starting production server... (Ctrl+C to stop)" -ForegroundColor Green
Write-Host ""

# 本番: --reload なし、workers 指定（Windowsはシングルプロセス）
python -m uvicorn backend.main:app --port 8000 --host 0.0.0.0 --workers 1 --log-level info
