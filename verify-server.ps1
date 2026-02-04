#!/usr/bin/env pwsh
# Quick Verification Script for Backend Server

$host = "localhost"
$port = "3002"
$baseUrl = "http://${host}:${port}"

Write-Host ""
Write-Host "🔍 Backend Server Verification" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host "Target: $baseUrl" -ForegroundColor Gray
Write-Host ""

# Function to test endpoint
function Test-APIEndpoint {
    param(
        [string]$Endpoint,
        [string]$Name
    )
    
    $url = "$baseUrl$Endpoint"
    Write-Host "Testing: $Name" -ForegroundColor Yellow
    Write-Host "  → $url" -ForegroundColor Gray
    
    try {
        $response = Invoke-RestMethod -Uri $url -Method Get -TimeoutSec 5
        Write-Host "  ✅ SUCCESS" -ForegroundColor Green
        Write-Host "  Response: $($response | ConvertTo-Json -Compress)" -ForegroundColor Gray
        return $true
    }
    catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode) {
            Write-Host "  ⚠️  Status: $statusCode" -ForegroundColor Yellow
            if ($statusCode -eq 401 -or $statusCode -eq 403) {
                Write-Host "  ℹ️  Route exists (auth required)" -ForegroundColor Cyan
                return $true
            }
        } else {
            Write-Host "  ❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
        }
        return $false
    }
    Write-Host ""
}

# Test endpoints
Write-Host "Core Endpoints:" -ForegroundColor Cyan
Write-Host "---------------" -ForegroundColor Cyan
$result1 = Test-APIEndpoint -Endpoint "/" -Name "Root"
$result2 = Test-APIEndpoint -Endpoint "/health" -Name "Health Check"
$result3 = Test-APIEndpoint -Endpoint "/api/test" -Name "API Test"

Write-Host ""
Write-Host "API Endpoints:" -ForegroundColor Cyan
Write-Host "--------------" -ForegroundColor Cyan
$result4 = Test-APIEndpoint -Endpoint "/api/funds" -Name "Funds List"
$result5 = Test-APIEndpoint -Endpoint "/api/auth/me" -Name "Auth Check"

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
if ($result1 -and $result2 -and $result3) {
    Write-Host "✅ Backend is OPERATIONAL!" -ForegroundColor Green
} else {
    Write-Host "❌ Backend has issues!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "  1. Check if server is running: netstat -ano | findstr :$port"
    Write-Host "  2. Check logs: npm run dev:direct"
    Write-Host "  3. Check .env configuration"
}
Write-Host ""
