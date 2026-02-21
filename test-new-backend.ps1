# Backend API Testing Script for New EC2 Instance
# Tests all endpoints on your freshly deployed backend

$ErrorActionPreference = "SilentlyContinue"

Write-Host @"

╔════════════════════════════════════════════════════════════╗
║                                                            ║
║        🧪 BACKEND API TESTING SUITE                       ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Cyan

# Load configuration
$ConfigFile = Join-Path $PSScriptRoot "ec2-config.json"
if (-not (Test-Path $ConfigFile)) {
    Write-Host "✗ Configuration not found!`n" -ForegroundColor Red
    Write-Host "Please run: .\configure-new-instance.ps1 first`n" -ForegroundColor Yellow
    exit 1
}

$Config = Get-Content $ConfigFile | ConvertFrom-Json
$baseUrl = "http://$($Config.ec2_ip):3002"

Write-Host "Testing backend at: $baseUrl`n" -ForegroundColor White
Write-Host "════════════════════════════════════════════════════════════`n" -ForegroundColor Gray

$testResults = @()
$passedTests = 0
$failedTests = 0

# Function to test GET endpoint
function Test-GetEndpoint {
    param(
        [string]$Endpoint,
        [string]$Name,
        [string]$ExpectedStatus = "200"
    )
    
    $url = "$baseUrl$Endpoint"
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    Write-Host "🔍 Testing: " -NoNewline -ForegroundColor Yellow
    Write-Host "$Name" -ForegroundColor White
    Write-Host "   URL: $url" -ForegroundColor DarkGray
    
    try {
        $response = Invoke-WebRequest -Uri $url -Method Get -TimeoutSec 10
        
        if ($response.StatusCode -eq $ExpectedStatus) {
            Write-Host "   ✅ PASS - Status: $($response.StatusCode)" -ForegroundColor Green
            
            # Try to parse JSON and show preview
            try {
                $json = $response.Content | ConvertFrom-Json
                $preview = ($response.Content | ConvertFrom-Json | ConvertTo-Json -Compress).Substring(0, [Math]::Min(100, $response.Content.Length))
                Write-Host "   Preview: $preview..." -ForegroundColor DarkGray
            } catch {
                Write-Host "   Content: $($response.Content.Substring(0, [Math]::Min(100, $response.Content.Length)))..." -ForegroundColor DarkGray
            }
            
            $script:passedTests++
            return @{ Name = $Name; Status = "PASS"; Code = $response.StatusCode }
        } else {
            Write-Host "   ❌ FAIL - Unexpected status: $($response.StatusCode)" -ForegroundColor Red
            $script:failedTests++
            return @{ Name = $Name; Status = "FAIL"; Code = $response.StatusCode }
        }
    } catch {
        Write-Host "   ❌ FAIL - $($_.Exception.Message)" -ForegroundColor Red
        $script:failedTests++
        return @{ Name = $Name; Status = "FAIL"; Error = $_.Exception.Message }
    }
    Write-Host ""
}

# Function to test POST endpoint
function Test-PostEndpoint {
    param(
        [string]$Endpoint,
        [string]$Name,
        [hashtable]$Body,
        [string]$ExpectedStatus = "200"
    )
    
    $url = "$baseUrl$Endpoint"
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    Write-Host "🔍 Testing: " -NoNewline -ForegroundColor Yellow
    Write-Host "$Name" -ForegroundColor White
    Write-Host "   URL: $url" -ForegroundColor DarkGray
    
    try {
        $jsonBody = $Body | ConvertTo-Json
        $response = Invoke-WebRequest -Uri $url -Method Post -Body $jsonBody -ContentType "application/json" -TimeoutSec 10
        
        if ($response.StatusCode -eq $ExpectedStatus -or $response.StatusCode -eq 201) {
            Write-Host "   ✅ PASS - Status: $($response.StatusCode)" -ForegroundColor Green
            try {
                $json = $response.Content | ConvertFrom-Json
                $preview = ($json | ConvertTo-Json -Compress).Substring(0, [Math]::Min(100, $response.Content.Length))
                Write-Host "   Preview: $preview..." -ForegroundColor DarkGray
            } catch {}
            
            $script:passedTests++
            return @{ Name = $Name; Status = "PASS"; Code = $response.StatusCode; Response = ($response.Content | ConvertFrom-Json) }
        } else {
            Write-Host "   ❌ FAIL - Unexpected status: $($response.StatusCode)" -ForegroundColor Red
            $script:failedTests++
            return @{ Name = $Name; Status = "FAIL"; Code = $response.StatusCode }
        }
    } catch {
        Write-Host "   ❌ FAIL - $($_.Exception.Message)" -ForegroundColor Red
        $script:failedTests++
        return @{ Name = $Name; Status = "FAIL"; Error = $_.Exception.Message }
    }
    Write-Host ""
}

# Start Tests
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "                  RUNNING TEST SUITE" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════`n" -ForegroundColor Cyan

# Test 1: Health Check
$testResults += Test-GetEndpoint -Endpoint "/health" -Name "Health Check" -ExpectedStatus "200"

# Test 2: API Root
$testResults += Test-GetEndpoint -Endpoint "/api" -Name "API Root" -ExpectedStatus "200"

# Test 3: Get All Funds
$testResults += Test-GetEndpoint -Endpoint "/api/funds?limit=5" -Name "Get Funds (Limit 5)" -ExpectedStatus "200"

# Test 4: Search Funds
$testResults += Test-GetEndpoint -Endpoint "/api/funds/search?query=sbi&limit=3" -Name "Search Funds (SBI)" -ExpectedStatus "200"

# Test 5: Get Fund Categories
$testResults += Test-GetEndpoint -Endpoint "/api/categories" -Name "Get Categories" -ExpectedStatus "200"

# Test 6: Register User
$randomEmail = "testuser$(Get-Random -Minimum 1000 -Maximum 9999)@test.com"
$registerResult = Test-PostEndpoint -Endpoint "/api/auth/register" -Name "Register New User" -Body @{
    name = "Test User"
    email = $randomEmail
    password = "TestPassword123!"
} -ExpectedStatus "201"
$testResults += $registerResult

# Test 7: Login User
if ($registerResult.Status -eq "PASS") {
    $loginResult = Test-PostEndpoint -Endpoint "/api/auth/login" -Name "Login User" -Body @{
        email = $randomEmail
        password = "TestPassword123!"
    } -ExpectedStatus "200"
    $testResults += $loginResult
    
    if ($loginResult.Status -eq "PASS" -and $loginResult.Response.token) {
        $authToken = $loginResult.Response.token
        Write-Host "   🔑 Auth token received" -ForegroundColor Green
    }
}

# Summary
Write-Host "`n═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "                    TEST SUMMARY" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════`n" -ForegroundColor Cyan

Write-Host "Total Tests:  " -NoNewline -ForegroundColor White
Write-Host ($passedTests + $failedTests) -ForegroundColor White

Write-Host "Passed:       " -NoNewline -ForegroundColor White
Write-Host $passedTests -ForegroundColor Green

Write-Host "Failed:       " -NoNewline -ForegroundColor White
if ($failedTests -gt 0) {
    Write-Host $failedTests -ForegroundColor Red
} else {
    Write-Host $failedTests -ForegroundColor Green
}

$successRate = [math]::Round(($passedTests / ($passedTests + $failedTests)) * 100, 2)
Write-Host "Success Rate: " -NoNewline -ForegroundColor White
if ($successRate -ge 80) {
    Write-Host "$successRate%" -ForegroundColor Green
} elseif ($successRate -ge 50) {
    Write-Host "$successRate%" -ForegroundColor Yellow
} else {
    Write-Host "$successRate%" -ForegroundColor Red
}

Write-Host "`n═══════════════════════════════════════════════════════════`n" -ForegroundColor Gray

if ($failedTests -eq 0) {
    Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║                                                            ║" -ForegroundColor Green
    Write-Host "║              ✅ ALL TESTS PASSED! 🎉                       ║" -ForegroundColor Green
    Write-Host "║                                                            ║" -ForegroundColor Green
    Write-Host "╚════════════════════════════════════════════════════════════╝`n" -ForegroundColor Green
    
    Write-Host "Your backend is fully operational!" -ForegroundColor Green
    Write-Host "`n🌐 Backend URLs:" -ForegroundColor Cyan
    Write-Host "  Health:     $baseUrl/health" -ForegroundColor White
    Write-Host "  API Docs:   $baseUrl/api" -ForegroundColor White
    Write-Host "  Funds:      $baseUrl/api/funds" -ForegroundColor White
    Write-Host "  Categories: $baseUrl/api/categories`n" -ForegroundColor White
    
} elseif ($passedTests -gt 0) {
    Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Yellow
    Write-Host "║                                                            ║" -ForegroundColor Yellow
    Write-Host "║              ⚠️  SOME TESTS FAILED                         ║" -ForegroundColor Yellow
    Write-Host "║                                                            ║" -ForegroundColor Yellow
    Write-Host "╚════════════════════════════════════════════════════════════╝`n" -ForegroundColor Yellow
    
    Write-Host "Backend is running but some features may not work correctly." -ForegroundColor Yellow
    Write-Host "Check the failed tests above for details.`n" -ForegroundColor Yellow
    
} else {
    Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Red
    Write-Host "║                                                            ║" -ForegroundColor Red
    Write-Host "║              ❌ ALL TESTS FAILED                           ║" -ForegroundColor Red
    Write-Host "║                                                            ║" -ForegroundColor Red
    Write-Host "╚════════════════════════════════════════════════════════════╝`n" -ForegroundColor Red
    
    Write-Host "Backend is not responding correctly." -ForegroundColor Red
    Write-Host "`n🔍 Troubleshooting steps:" -ForegroundColor Yellow
    Write-Host "  1. Check if EC2 instance is running" -ForegroundColor White
    Write-Host "  2. Verify Security Group allows port 3002" -ForegroundColor White
    Write-Host "  3. SSH into EC2 and run: pm2 status" -ForegroundColor White
    Write-Host "  4. Check logs: pm2 logs mutual-funds-backend`n" -ForegroundColor White
}

Write-Host "📋 Detailed Results:" -ForegroundColor Cyan
$testResults | ForEach-Object {
    $status = if ($_.Status -eq "PASS") { "✅" } else { "❌" }
    Write-Host "  $status $($_.Name)" -ForegroundColor Gray
}

Write-Host ""
