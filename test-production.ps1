# Production API Testing Script
# Tests all critical endpoints on EC2 server

$BASE_URL = "http://13.60.156.3:3002"
$TOKEN = ""
$USER_ID = ""
$TEST_EMAIL = "test_$(Get-Date -Format 'yyyyMMddHHmmss')@example.com"

# Color output functions
function Write-TestHeader { param($text) Write-Host "`n========== $text ==========" -ForegroundColor Magenta }
function Write-Success { param($text) Write-Host "✅ $text" -ForegroundColor Green }
function Write-Failure { param($text) Write-Host "❌ $text" -ForegroundColor Red }
function Write-Info { param($text) Write-Host "📋 $text" -ForegroundColor Cyan }
function Write-Warning { param($text) Write-Host "⚠️  $text" -ForegroundColor Yellow }

$results = @{
    passed = 0
    failed = 0
    skipped = 0
}

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [string]$Method = "GET",
        [object]$Body = $null,
        [hashtable]$Headers = @{},
        [scriptblock]$Validator
    )
    
    Write-Info "Testing: $Name"
    
    try {
        $params = @{
            Uri = $Url
            Method = $Method
            ContentType = "application/json"
            Headers = $Headers
        }
        
        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json -Depth 10)
        }
        
        $response = Invoke-RestMethod @params
        
        if ($Validator) {
            $validationResult = & $Validator $response
            if ($validationResult) {
                Write-Success "$Name - PASSED"
                $script:results.passed++
                return $response
            } else {
                Write-Failure "$Name - Validation failed"
                $script:results.failed++
                return $null
            }
        } else {
            Write-Success "$Name - PASSED"
            $script:results.passed++
            return $response
        }
    }
    catch {
        Write-Failure "$Name - FAILED: $($_.Exception.Message)"
        $script:results.failed++
        return $null
    }
}

# Start Testing
Write-Host @"

╔════════════════════════════════════════════════════════════╗
║                                                            ║
║     🚀 PRODUCTION API TESTING SUITE                       ║
║     Server: $BASE_URL                   ║
║     Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')                        ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Yellow

# ==================== 1. HEALTH CHECK ====================
Write-TestHeader "1. Health & Status"

Test-Endpoint `
    -Name "Health Check" `
    -Url "$BASE_URL/health" `
    -Validator { param($r) $r.status -eq "healthy" }

Test-Endpoint `
    -Name "API Status" `
    -Url "$BASE_URL/api/status" `
    -Validator { param($r) $r -ne $null }

# ==================== 2. AUTHENTICATION ====================
Write-TestHeader "2. Authentication"

$registerResponse = Test-Endpoint `
    -Name "User Registration" `
    -Url "$BASE_URL/api/auth/register" `
    -Method "POST" `
    -Body @{
        email = $TEST_EMAIL
        password = "Test123!@"
        name = "Test User"
    } `
    -Validator { param($r) $r.success -and $r.data.tokens.accessToken }

if ($registerResponse) {
    $TOKEN = $registerResponse.data.tokens.accessToken
    $USER_ID = $registerResponse.data.user.userId
    Write-Info "Received Token: $($TOKEN.Substring(0, 20))..."
    Write-Info "User ID: $USER_ID"
}

$loginResponse = Test-Endpoint `
    -Name "User Login" `
    -Url "$BASE_URL/api/auth/login" `
    -Method "POST" `
    -Body @{
        email = $TEST_EMAIL
        password = "Test123!@"
    } `
    -Validator { param($r) $r.success -and $r.data.tokens.accessToken }

if ($TOKEN) {
    Test-Endpoint `
        -Name "Get Current User (Protected)" `
        -Url "$BASE_URL/api/auth/me" `
        -Headers @{ Authorization = "Bearer $TOKEN" } `
        -Validator { param($r) $r.email -eq $TEST_EMAIL }
} else {
    Write-Warning "Skipping protected tests - no auth token"
    $script:results.skipped++
}

# ==================== 3. FUNDS API ====================
Write-TestHeader "3. Funds API"

$fundsResponse = Test-Endpoint `
    -Name "Get All Funds (Paginated)" `
    -Url "$BASE_URL/api/funds?limit=20" `
    -Validator { param($r) $r.totalFunds -gt 14000 -and $r.funds.Count -eq 20 }

if ($fundsResponse) {
    Write-Info "Total Funds in Database: $($fundsResponse.totalFunds)"
}

Test-Endpoint `
    -Name "Search Funds by Query (HDFC)" `
    -Url "$BASE_URL/api/funds?query=hdfc&limit=10" `
    -Validator { param($r) $r.funds.Count -gt 0 }

Test-Endpoint `
    -Name "Filter by Category (Equity)" `
    -Url "$BASE_URL/api/funds?category=equity&limit=10" `
    -Validator { param($r) $r.funds.Count -gt 0 }

Test-Endpoint `
    -Name "Get Fund Categories" `
    -Url "$BASE_URL/api/funds/categories" `
    -Validator { param($r) $r.Count -gt 0 }

# ==================== 4. MARKET INDICES ====================
Write-TestHeader "4. Market Indices"

$marketResponse = Test-Endpoint `
    -Name "Get All Market Indices" `
    -Url "$BASE_URL/api/market" `
    -Validator { param($r) $r.Count -gt 0 }

if ($marketResponse) {
    Write-Info "Available Indices: $($marketResponse.Count)"
}

Test-Endpoint `
    -Name "Get NIFTY 50" `
    -Url "$BASE_URL/api/market/nifty50" `
    -Validator { param($r) $r.symbol -eq "nifty50" }

# ==================== 5. COMPARISON ====================
Write-TestHeader "5. Comparison & Analysis"

# Get two fund IDs from the funds list
if ($fundsResponse -and $fundsResponse.funds.Count -ge 2) {
    $fundId1 = $fundsResponse.funds[0].fundId
    $fundId2 = $fundsResponse.funds[1].fundId
    
    Test-Endpoint `
        -Name "Compare Multiple Funds" `
        -Url "$BASE_URL/api/compare" `
        -Method "POST" `
        -Body @{
            fundIds = @($fundId1, $fundId2)
        } `
        -Validator { param($r) $r -ne $null }
    
    Test-Endpoint `
        -Name "Portfolio Overlap Analysis" `
        -Url "$BASE_URL/api/overlap" `
        -Method "POST" `
        -Body @{
            fundIds = @($fundId1, $fundId2)
        } `
        -Validator { param($r) $r -ne $null }
} else {
    Write-Warning "Skipping comparison tests - insufficient funds data"
    $script:results.skipped += 2
}

# ==================== 6. WATCHLIST (Protected) ====================
Write-TestHeader "6. Watchlist (Protected Routes)"

if ($TOKEN -and $USER_ID) {
    Test-Endpoint `
        -Name "Get User Watchlist" `
        -Url "$BASE_URL/api/watchlist/$USER_ID" `
        -Headers @{ Authorization = "Bearer $TOKEN" } `
        -Validator { param($r) $r -is [array] -or $r -eq $null }
    
    if ($fundsResponse -and $fundsResponse.funds.Count -gt 0) {
        $testFundId = $fundsResponse.funds[0].fundId
        
        $addResponse = Test-Endpoint `
            -Name "Add Fund to Watchlist" `
            -Url "$BASE_URL/api/watchlist" `
            -Method "POST" `
            -Headers @{ Authorization = "Bearer $TOKEN" } `
            -Body @{
                userId = $USER_ID
                fundId = $testFundId
            } `
            -Validator { param($r) $r.success -or $r -ne $null }
        
        Test-Endpoint `
            -Name "Check if Fund is Watched" `
            -Url "$BASE_URL/api/watchlist/$USER_ID/check/$testFundId" `
            -Headers @{ Authorization = "Bearer $TOKEN" } `
            -Validator { param($r) $r.isWatched -ne $null }
    } else {
        Write-Warning "Skipping watchlist add test - no funds available"
        $script:results.skipped++
    }
} else {
    Write-Warning "Skipping watchlist tests - no auth token"
    $script:results.skipped += 3
}

# ==================== 7. GOALS (Protected) ====================
Write-TestHeader "7. Goals (Protected Routes)"

if ($TOKEN -and $USER_ID) {
    Test-Endpoint `
        -Name "Get User Goals" `
        -Url "$BASE_URL/api/goals?userId=$USER_ID" `
        -Headers @{ Authorization = "Bearer $TOKEN" } `
        -Validator { param($r) $r -is [array] -or $r -eq $null }
    
    Test-Endpoint `
        -Name "Create New Goal" `
        -Url "$BASE_URL/api/goals" `
        -Method "POST" `
        -Headers @{ Authorization = "Bearer $TOKEN" } `
        -Body @{
            userId = $USER_ID
            name = "Test Retirement Goal"
            targetAmount = 5000000
            targetDate = "2045-12-31"
            currentAmount = 0
        } `
        -Validator { param($r) $r.success -or $r._id -ne $null }
} else {
    Write-Warning "Skipping goals tests - no auth token"
    $script:results.skipped += 2
}

# ==================== 8. REMINDERS (Protected) ====================
Write-TestHeader "8. Reminders (Protected Routes)"

if ($TOKEN -and $USER_ID) {
    Test-Endpoint `
        -Name "Get User Reminders" `
        -Url "$BASE_URL/api/reminders?userId=$USER_ID" `
        -Headers @{ Authorization = "Bearer $TOKEN" } `
        -Validator { param($r) $r -is [array] -or $r -eq $null }
    
    Test-Endpoint `
        -Name "Create Reminder" `
        -Url "$BASE_URL/api/reminders" `
        -Method "POST" `
        -Headers @{ Authorization = "Bearer $TOKEN" } `
        -Body @{
            userId = $USER_ID
            title = "Test Portfolio Review"
            description = "Monthly review"
            reminderDate = (Get-Date).AddDays(30).ToString("yyyy-MM-ddTHH:mm:ssZ")
            frequency = "monthly"
        } `
        -Validator { param($r) $r.success -or $r._id -ne $null }
} else {
    Write-Warning "Skipping reminders tests - no auth token"
    $script:results.skipped += 2
}

# ==================== 9. RANKINGS ====================
Write-TestHeader "9. Rankings"

Test-Endpoint `
    -Name "Top Funds Overall" `
    -Url "$BASE_URL/api/rankings/top?limit=10" `
    -Validator { param($r) $r.Count -gt 0 -or $r.funds.Count -gt 0 }

Test-Endpoint `
    -Name "Top Equity Funds" `
    -Url "$BASE_URL/api/rankings/category/equity?limit=10" `
    -Validator { param($r) $r.Count -gt 0 -or $r.funds.Count -gt 0 }

# ==================== 10. CALCULATORS ====================
Write-TestHeader "10. Calculators"

Test-Endpoint `
    -Name "SIP Calculator" `
    -Url "$BASE_URL/api/calculator/sip" `
    -Method "POST" `
    -Body @{
        monthlyInvestment = 10000
        expectedReturn = 12
        timePeriod = 10
    } `
    -Validator { param($r) $r.futureValue -gt 0 }

Test-Endpoint `
    -Name "Lumpsum Calculator" `
    -Url "$BASE_URL/api/calculator/lumpsum" `
    -Method "POST" `
    -Body @{
        investment = 100000
        expectedReturn = 12
        timePeriod = 10
    } `
    -Validator { param($r) $r.futureValue -gt 0 }

# ==================== 11. NEWS ====================
Write-TestHeader "11. News & Updates"

Test-Endpoint `
    -Name "Get Latest News" `
    -Url "$BASE_URL/api/news" `
    -Validator { param($r) $r -is [array] -or $r.articles -is [array] }

# ==================== SUMMARY ====================
Write-Host @"

╔════════════════════════════════════════════════════════════╗
║                                                            ║
║                    📊 TEST SUMMARY                         ║
║                                                            ║
"@ -ForegroundColor Cyan

Write-Host "║     " -NoNewline -ForegroundColor Cyan
Write-Host "✅ PASSED: $($results.passed)" -NoNewline -ForegroundColor Green
Write-Host " " * (48 - $results.passed.ToString().Length) -NoNewline
Write-Host "║" -ForegroundColor Cyan

Write-Host "║     " -NoNewline -ForegroundColor Cyan
Write-Host "❌ FAILED: $($results.failed)" -NoNewline -ForegroundColor Red
Write-Host " " * (48 - $results.failed.ToString().Length) -NoNewline
Write-Host "║" -ForegroundColor Cyan

Write-Host "║     " -NoNewline -ForegroundColor Cyan
Write-Host "⚠️  SKIPPED: $($results.skipped)" -NoNewline -ForegroundColor Yellow
Write-Host " " * (47 - $results.skipped.ToString().Length) -NoNewline
Write-Host "║" -ForegroundColor Cyan

$total = $results.passed + $results.failed + $results.skipped
$successRate = if ($total -gt 0) { [math]::Round(($results.passed / $total) * 100, 2) } else { 0 }

Write-Host "║     " -NoNewline -ForegroundColor Cyan
Write-Host "📈 SUCCESS RATE: $successRate%" -NoNewline -ForegroundColor Magenta
Write-Host " " * (36 - $successRate.ToString().Length) -NoNewline
Write-Host "║" -ForegroundColor Cyan

Write-Host @"
║                                                            ║
╚════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Cyan

if ($results.failed -gt 0) {
    Write-Host "⚠️  Some tests failed. Check the logs above for details." -ForegroundColor Red
    Write-Host "   Run 'ssh ubuntu@13.60.156.3 `"pm2 logs --lines 50`"' to check server logs" -ForegroundColor Yellow
} else {
    Write-Host "🎉 All tests passed! Production API is working correctly." -ForegroundColor Green
}

Write-Host "`n💡 For detailed testing, open api-tester.html in your browser" -ForegroundColor Cyan
Write-Host "📖 Full documentation: PRODUCTION_TESTING_CHECKLIST.md" -ForegroundColor Cyan

# Return exit code based on results
if ($results.failed -gt 0) {
    exit 1
} else {
    exit 0
}
