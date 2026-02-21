# Quick Deployment Script for EC2
# Uploads and deploys the fixed backend

param(
    [Parameter(Mandatory=$false)]
    [string]$KeyPath = ""
)

Write-Host @"

╔════════════════════════════════════════════════════════════╗
║                                                            ║
║     🚀 MUTUAL FUNDS BACKEND DEPLOYMENT                    ║
║     Bug Fix: Import/Export Mismatch Resolved              ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Cyan

# Find SSH key if not provided
if ([string]::IsNullOrEmpty($KeyPath)) {
    Write-Host "🔍 Searching for SSH key..." -ForegroundColor Yellow
    
    $possiblePaths = @(
        "$env:USERPROFILE\.ssh\backend-key.pem",
        "$env:USERPROFILE\Downloads\backend-key.pem",
        ".\backend-key.pem",
        "..\backend-key.pem"
    )
    
    foreach ($path in $possiblePaths) {
        if (Test-Path $path) {
            $KeyPath = $path
            Write-Host "✅ Found key: $KeyPath" -ForegroundColor Green
            break
        }
    }
    
    if ([string]::IsNullOrEmpty($KeyPath)) {
        Write-Host "❌ SSH key not found!" -ForegroundColor Red
        Write-Host "Please provide path:" -ForegroundColor Yellow
        Write-Host "  .\deploy-to-ec2.ps1 -KeyPath 'C:\path\to\backend-key.pem'" -ForegroundColor Cyan
        exit 1
    }
}

# Verify key exists
if (-not (Test-Path $KeyPath)) {
    Write-Host "❌ Key file not found: $KeyPath" -ForegroundColor Red
    exit 1
}

# Verify dist.zip exists
if (-not (Test-Path "dist.zip")) {
    Write-Host "❌ dist.zip not found. Building first..." -ForegroundColor Yellow
    npm run build
    if (-not (Test-Path "dist.zip")) {
        Write-Host "❌ Build failed!" -ForegroundColor Red
        exit 1
    }
}

$SERVER = "ubuntu@13.60.156.3"
$REMOTE_PATH = "~/mutual_fund_backend"

Write-Host "`n📦 Step 1: Uploading dist.zip to EC2..." -ForegroundColor Cyan
scp -i $KeyPath dist.zip "$SERVER:$REMOTE_PATH/"

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Upload failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Upload successful!" -ForegroundColor Green

Write-Host "`n🚀 Step 2: Deploying on server..." -ForegroundColor Cyan
$deployScript = @"
cd $REMOTE_PATH && \
echo '📂 Backing up old dist...' && \
[ -d dist ] && mv dist dist.backup.\$(date +%Y%m%d_%H%M%S) || true && \
echo '📦 Extracting new build...' && \
unzip -o -q dist.zip && \
echo '🔄 Restarting PM2...' && \
pm2 restart all && \
echo '✅ Deployment complete!' && \
echo '' && \
echo '📊 PM2 Status:' && \
pm2 status && \
echo '' && \
echo '🔍 Last 10 log lines:' && \
pm2 logs --lines 10 --nostream
"@

ssh -i $KeyPath $SERVER $deployScript

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Deployment failed!" -ForegroundColor Red
    Write-Host "Check logs: ssh -i $KeyPath $SERVER 'pm2 logs --lines 50'" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n✅ Deployment successful!" -ForegroundColor Green

Write-Host "`n🧪 Step 3: Testing endpoints..." -ForegroundColor Cyan
Write-Host "Testing health endpoint..." -ForegroundColor Gray

try {
    $healthResponse = Invoke-RestMethod -Uri "http://13.60.156.3:3002/health" -TimeoutSec 10
    if ($healthResponse.status -eq "healthy") {
        Write-Host "✅ Health check: PASSED" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Health check: Unexpected response" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Health check: FAILED - $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nTesting funds API..." -ForegroundColor Gray
try {
    $fundsResponse = Invoke-RestMethod -Uri "http://13.60.156.3:3002/api/funds?limit=5" -TimeoutSec 10
    if ($fundsResponse.totalFunds -gt 14000) {
        Write-Host "✅ Funds API: PASSED ($($fundsResponse.totalFunds) funds)" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Funds API: Unexpected fund count" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Funds API: FAILED - $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nTesting registration (THE FIX!)..." -ForegroundColor Gray
$testEmail = "test_$(Get-Date -Format 'yyyyMMddHHmmss')@example.com"
$registerData = @{
    email = $testEmail
    password = "Test123!@"
    name = "Test User"
} | ConvertTo-Json

try {
    $registerResponse = Invoke-RestMethod -Uri "http://13.60.156.3:3002/api/auth/register" `
        -Method POST `
        -Body $registerData `
        -ContentType "application/json" `
        -TimeoutSec 10
    
    if ($registerResponse.success -and $registerResponse.data.tokens.accessToken) {
        Write-Host "✅ Registration: PASSED (Bug is FIXED! 🎉)" -ForegroundColor Green
        Write-Host "   Token received: $($registerResponse.data.tokens.accessToken.Substring(0,20))..." -ForegroundColor Gray
    } else {
        Write-Host "⚠️  Registration: Succeeded but unexpected response format" -ForegroundColor Yellow
    }
} catch {
    $errorMsg = $_.Exception.Message
    if ($errorMsg -like "*Route.post() requires a callback*") {
        Write-Host "❌ Registration: STILL BROKEN - Import/export issue persists!" -ForegroundColor Red
    } elseif ($errorMsg -like "*User.findOne is not a function*") {
        Write-Host "❌ Registration: OLD BUG - Wrong controller loaded!" -ForegroundColor Red
    } else {
        Write-Host "❌ Registration: FAILED - $errorMsg" -ForegroundColor Red
    }
}

Write-Host @"

╔════════════════════════════════════════════════════════════╗
║                                                            ║
║                  🎉 DEPLOYMENT SUMMARY                     ║
║                                                            ║
║  Server: http://13.60.156.3:3002                          ║
║  Status: Check results above                               ║
║                                                            ║
║  📖 Full Testing Guide:                                    ║
║     - BUG_FIX_DEPLOYMENT_GUIDE.md                         ║
║     - PRODUCTION_TESTING_CHECKLIST.md                     ║
║                                                            ║
║  🧪 Automated Tests:                                       ║
║     .\test-production.ps1                                 ║
║                                                            ║
║  📋 Interactive Tester:                                    ║
║     Open api-tester.html in browser                       ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Cyan

Write-Host "💡 View server logs: ssh -i $KeyPath $SERVER 'pm2 logs --lines 30'" -ForegroundColor Gray
Write-Host "💡 Check PM2 status: ssh -i $KeyPath $SERVER 'pm2 status'" -ForegroundColor Gray
