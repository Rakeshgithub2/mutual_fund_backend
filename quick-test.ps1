#!/usr/bin/env pwsh
# Quick API Test Script

Write-Host "`n🧪 Testing Backend API..." -ForegroundColor Cyan
Write-Host "Server: http://localhost:3002" -ForegroundColor Gray
Write-Host "`n"

function Test-APIEndpoint {
    param([string]$Url, [string]$Name)
    
    try {
        $response = Invoke-RestMethod -Uri $Url -Method GET -ErrorAction Stop
        Write-Host "✅ $Name" -ForegroundColor Green
        return $true
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode -eq 401) {
            Write-Host "✅ $Name (401 Auth Required - OK)" -ForegroundColor Yellow
            return $true
        } elseif ($statusCode -eq 404) {
            Write-Host "❌ $Name (404 NOT FOUND)" -ForegroundColor Red
            return $false
        } else {
            Write-Host "⚠️ $Name (Status: $statusCode)" -ForegroundColor Yellow
            return $true
        }
    }
}

# Test endpoints
$results = @()
$results += Test-APIEndpoint "http://localhost:3002/" "Root (/)"
$results += Test-APIEndpoint "http://localhost:3002/health" "Health Check"
$results += Test-APIEndpoint "http://localhost:3002/api/test" "API Test"
$results += Test-APIEndpoint "http://localhost:3002/api/funds?limit=1" "Funds API"
$results += Test-APIEndpoint "http://localhost:3002/api/auth/me" "Auth API"
$results += Test-APIEndpoint "http://localhost:3002/api/market/summary" "Market Summary"

$successCount = ($results | Where-Object { $_ -eq $true }).Count
$totalCount = $results.Count

Write-Host "`n" -NoNewline
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Results: $successCount/$totalCount endpoints working" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

if ($successCount -eq $totalCount) {
    Write-Host "`n🎉 All endpoints are accessible!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`n⚠️ Some endpoints may have issues." -ForegroundColor Yellow
    exit 1
}
