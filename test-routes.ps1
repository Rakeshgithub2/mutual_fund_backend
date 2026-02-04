#!/usr/bin/env pwsh
# Test script to verify all backend routes are accessible

$baseUrl = "http://localhost:3002"
$apiUrl = "$baseUrl/api"

Write-Host "🧪 Testing Backend Routes..." -ForegroundColor Cyan
Write-Host "Base URL: $baseUrl" -ForegroundColor Gray
Write-Host ""

# Function to test an endpoint
function Test-Endpoint {
    param(
        [string]$Url,
        [string]$Description
    )
    
    Write-Host "Testing: $Description" -ForegroundColor Yellow
    Write-Host "  URL: $Url" -ForegroundColor Gray
    
    try {
        $response = Invoke-WebRequest -Uri $Url -Method GET -UseBasicParsing -TimeoutSec 5
        if ($response.StatusCode -eq 200) {
            Write-Host "  ✅ Status: $($response.StatusCode) OK" -ForegroundColor Green
            return $true
        } else {
            Write-Host "  ⚠️ Status: $($response.StatusCode)" -ForegroundColor Yellow
            return $false
        }
    } catch {
        Write-Host "  ❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
    Write-Host ""
}

# Test Core Endpoints
Write-Host "=== CORE ENDPOINTS ===" -ForegroundColor Cyan
Test-Endpoint "$baseUrl/" "Root endpoint"
Test-Endpoint "$baseUrl/health" "Health check"
Test-Endpoint "$apiUrl/test" "API test endpoint"

Write-Host ""
Write-Host "=== API ENDPOINTS ===" -ForegroundColor Cyan

# Test API endpoints (these may return 401/403 without auth, but should not return 404)
$endpoints = @(
    @{Url="$apiUrl/funds"; Desc="Funds list"},
    @{Url="$apiUrl/funds/search"; Desc="Funds search"},
    @{Url="$apiUrl/auth/me"; Desc="Auth - Get current user (requires auth)"},
    @{Url="$apiUrl/users"; Desc="Users endpoint (requires auth)"},
    @{Url="$apiUrl/portfolio"; Desc="Portfolio endpoint (requires auth)"},
    @{Url="$apiUrl/watchlist"; Desc="Watchlist endpoint (requires auth)"},
    @{Url="$apiUrl/market-indices"; Desc="Market indices"},
    @{Url="$baseUrl/api/market/summary"; Desc="Market summary"}
)

$successCount = 0
$failCount = 0

foreach ($endpoint in $endpoints) {
    Write-Host "Testing: $($endpoint.Desc)" -ForegroundColor Yellow
    Write-Host "  URL: $($endpoint.Url)" -ForegroundColor Gray
    
    try {
        $response = Invoke-WebRequest -Uri $endpoint.Url -Method GET -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
        Write-Host "  ✅ Status: $($response.StatusCode)" -ForegroundColor Green
        $successCount++
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode -eq 401 -or $statusCode -eq 403) {
            Write-Host "  ⚠️ Status: $statusCode (Auth required - endpoint exists!)" -ForegroundColor Yellow
            $successCount++
        } elseif ($statusCode -eq 404) {
            Write-Host "  ❌ Status: 404 NOT FOUND - Route not registered!" -ForegroundColor Red
            $failCount++
        } else {
            Write-Host "  ⚠️ Status: $statusCode" -ForegroundColor Yellow
            $successCount++
        }
    }
    Write-Host ""
}

Write-Host ""
Write-Host "=== SUMMARY ===" -ForegroundColor Cyan
Write-Host "✅ Success: $successCount" -ForegroundColor Green
Write-Host "❌ Failed: $failCount" -ForegroundColor Red

if ($failCount -eq 0) {
    Write-Host ""
    Write-Host "🎉 All routes are accessible!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "⚠️ Some routes are not accessible. Check server logs." -ForegroundColor Yellow
}
