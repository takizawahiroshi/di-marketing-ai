# DI Marketing AI - Export task results to CSV
# Usage: .\scripts\export_memory.ps1

$root = Split-Path -Parent $PSScriptRoot
$resultsPath = Join-Path $root "data\memory\results.json"
$exportDir = Join-Path $root "data\exports"

if (-not (Test-Path $resultsPath)) {
    Write-Host "[ERROR] results.json not found: $resultsPath" -ForegroundColor Red
    exit 1
}

$data = Get-Content $resultsPath -Raw | ConvertFrom-Json
$results = $data.results

if ($results.Count -eq 0) {
    Write-Host "[INFO] No data to export." -ForegroundColor Yellow
    exit 0
}

if (-not (Test-Path $exportDir)) {
    New-Item -ItemType Directory -Path $exportDir | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$csvPath = Join-Path $exportDir "di_results_${timestamp}.csv"

$rows = $results | ForEach-Object {
    [PSCustomObject]@{
        id            = $_.id
        timestamp     = $_.timestamp
        goal          = $_.goal
        agents        = ($_.plan.agents -join " -> ")
        reason        = $_.plan.reason
        synthesis_len = $_.synthesis_len
    }
}

$rows | Export-Csv -Path $csvPath -NoTypeInformation -Encoding UTF8

Write-Host "[OK] Exported: $csvPath" -ForegroundColor Green
Write-Host "     Count: $($results.Count) tasks"
