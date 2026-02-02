# MongoDB Performance Fix - Quick Deploy Script for AWS EC2
# Run this script on your EC2 instance after updating code

Write-Host "🚀 MongoDB Performance Fix Deployment" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Error: Not in backend directory" -ForegroundColor Red
    Write-Host "Please cd to mutual-funds-backend folder first" -ForegroundColor Yellow
    exit 1
}

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "❌ Error: .env file not found" -ForegroundColor Red
    Write-Host "Please create .env with MONGO_URI" -ForegroundColor Yellow
    exit 1
}

# Build TypeScript
Write-Host "1️⃣  Building TypeScript..." -ForegroundColor Yellow
if (Get-Command pnpm -ErrorAction SilentlyContinue) {
    pnpm run build
} elseif (Get-Command npm -ErrorAction SilentlyContinue) {
    npm run build
} else {
    Write-Host "   ❌ No package manager found" -ForegroundColor Red
    exit 1
}
Write-Host "   ✅ Build complete" -ForegroundColor Green
Write-Host ""

# Create indexes
Write-Host "2️⃣  Creating MongoDB indexes..." -ForegroundColor Yellow
if (Test-Path "scripts\create-indexes.js") {
    node scripts\create-indexes.js
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Indexes created successfully" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Index creation failed" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "   ❌ scripts\create-indexes.js not found" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Restart backend (if PM2 is available)
Write-Host "3️⃣  Restarting backend..." -ForegroundColor Yellow
if (Get-Command pm2 -ErrorAction SilentlyContinue) {
    pm2 restart all
    Write-Host "   ✅ Backend restarted (PM2)" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  PM2 not found, please restart manually" -ForegroundColor Yellow
}
Write-Host ""

# Test endpoint
Write-Host "4️⃣  Testing API endpoint..." -ForegroundColor Yellow
Start-Sleep -Seconds 3
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5000/api/funds?limit=10" -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "   ✅ API is responding (HTTP $($response.StatusCode))" -ForegroundColor Green
    }
} catch {
    Write-Host "   ⚠️  API test failed" -ForegroundColor Yellow
    Write-Host "   Check logs: pm2 logs" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "🎉 Deployment Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  - Test in browser: http://YOUR_EC2_IP:5000/api/funds"
Write-Host "  - Check logs: pm2 logs"
Write-Host "  - Verify indexes: mongosh --eval 'use mutualfunds; db.funds.getIndexes()'"
Write-Host ""
