# DI Marketing AI - Backend Start Script
# Usage: .\scripts\start.ps1

$root = Split-Path -Parent $PSScriptRoot
$env:PYTHONPATH = $root

Set-Location $root

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DI Marketing AI Backend" -ForegroundColor Cyan
Write-Host "  http://localhost:8000" -ForegroundColor Cyan
Write-Host "  Swagger UI: http://localhost:8000/docs" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$envFile = Join-Path $root "backend\.env"
if (-not (Test-Path $envFile)) {
    Write-Host "[ERROR] backend\.env not found." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Starting server... (Ctrl+C to stop)" -ForegroundColor Green
Write-Host ""

python -m uvicorn backend.main:app --reload --port 8000 --host 0.0.0.0
