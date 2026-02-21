# COMPLETE DEPLOYMENT TO EC2
# This script uploads dist.zip and deploys it automatically

param(
    [Parameter(Mandatory=$false)]
    [string]$KeyPath = "",
    [string]$Server = "ubuntu@13.60.156.3",
    [string]$RemotePath = "~/mutual_fund_backend"
)

Write-Host @"

╔════════════════════════════════════════════════════════════╗
║                                                            ║
║     🚀 EC2 DEPLOYMENT - ONE COMMAND                       ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Cyan

# Find SSH key
if ([string]::IsNullOrEmpty($KeyPath)) {
    $possibleKeys = @(
        "$env:USERPROFILE\.ssh\backend-key.pem",
        "$env:USERPROFILE\Downloads\backend-key.pem",
        ".\backend-key.pem",
        "..\backend-key.pem",
        "$env:USERPROFILE\Desktop\backend-key.pem"
    )
    
    foreach ($key in $possibleKeys) {
        if (Test-Path $key) {
            $KeyPath = $key
            Write-Host "✅ Found SSH key: $KeyPath" -ForegroundColor Green
            break
        }
    }
}

if ([string]::IsNullOrEmpty($KeyPath) -or -not (Test-Path $KeyPath)) {
    Write-Host "❌ SSH key not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please specify key path:" -ForegroundColor Yellow
    Write-Host '  .\deploy-complete.ps1 -KeyPath "C:\path\to\backend-key.pem"' -ForegroundColor White
    exit 1
}

# Verify dist.zip exists
if (-not (Test-Path "dist.zip")) {
    Write-Host "❌ dist.zip not found! Run 'npm run build' first." -ForegroundColor Red
    exit 1
}

Write-Host "📦 Local dist.zip: $([math]::Round((Get-Item 'dist.zip').Length/1MB, 2)) MB" -ForegroundColor Green

# Upload dist.zip
Write-Host "`n📤 Step 1/3: Uploading dist.zip..." -ForegroundColor Cyan
scp -i $KeyPath dist.zip "$Server`:$RemotePath/"
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Upload failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Upload complete" -ForegroundColor Green

# Upload deploy.sh script
Write-Host "`n📤 Step 2/3: Uploading deploy.sh..." -ForegroundColor Cyan
scp -i $KeyPath deploy.sh "$Server`:$RemotePath/"
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Deploy script upload failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Deploy script uploaded" -ForegroundColor Green

# Execute deployment
Write-Host "`n🚀 Step 3/3: Executing deployment on EC2..." -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Gray

ssh -i $KeyPath $Server "cd $RemotePath && chmod +x deploy.sh && bash deploy.sh"

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n❌ Deployment failed! Check logs above." -ForegroundColor Red
    exit 1
}

Write-Host "=" * 60 -ForegroundColor Gray

# Test endpoints
Write-Host "`n🧪 Testing endpoints..." -ForegroundColor Cyan

try {
    $health = Invoke-RestMethod -Uri "http://13.60.156.3:3002/health" -TimeoutSec 5
    if ($health.status -eq "healthy") {
        Write-Host "✅ Health check: PASSED" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Health check: FAILED" -ForegroundColor Red
}

try {
    $funds = Invoke-RestMethod -Uri "http://13.60.156.3:3002/api/funds?limit=1" -TimeoutSec 5
    if ($funds.totalFunds -gt 14000) {
        Write-Host "✅ Funds API: PASSED ($($funds.totalFunds) funds)" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Funds API: FAILED" -ForegroundColor Red
}

Write-Host "`n🧪 Testing registration (THE FIX!)..." -ForegroundColor Yellow
$testEmail = "test_$(Get-Date -Format 'yyyyMMddHHmmss')@example.com"
$body = @{
    email = $testEmail
    password = "Test123!@"
    name = "Test User"
} | ConvertTo-Json

try {
    $register = Invoke-RestMethod -Uri "http://13.60.156.3:3002/api/auth/register" `
        -Method POST `
        -Body $body `
        -ContentType "application/json" `
        -TimeoutSec 10
    
    if ($register.success -and $register.data.tokens.accessToken) {
        Write-Host "✅ Registration: PASSED - BUG IS FIXED! 🎉" -ForegroundColor Green
        Write-Host "   Email: $testEmail" -ForegroundColor Gray
        Write-Host "   Token: $($register.data.tokens.accessToken.Substring(0,30))..." -ForegroundColor Gray
    } else {
        Write-Host "⚠️  Registration: Unexpected response" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Registration: FAILED - $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host @"

╔════════════════════════════════════════════════════════════╗
║                                                            ║
║                  ✅ DEPLOYMENT COMPLETE                    ║
║                                                            ║
║  Server: http://13.60.156.3:3002                          ║
║  API Docs: PRODUCTION_TESTING_CHECKLIST.md                ║
║                                                            ║
║  Run full tests: .\test-production.ps1                    ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Cyan
