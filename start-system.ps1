# Complete System Startup & Verification

Write-Host "`n╔══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                                                      ║" -ForegroundColor Cyan
Write-Host "║   MUTUAL FUNDS SYSTEM - COMPLETE STARTUP            ║" -ForegroundColor Cyan
Write-Host "║                                                      ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

# Step 1: Start Backend
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "STEP 1: Starting Backend Server..." -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Gray

# Check if backend is already running
try {
    $test = Invoke-RestMethod -Uri 'http://localhost:3002/api/health' -TimeoutSec 2 -ErrorAction Stop
    Write-Host "✅ Backend already running on port 3002`n" -ForegroundColor Green
} catch {
    Write-Host "Starting backend server..." -ForegroundColor White
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'c:\MF root folder\mutual-funds-backend' ; Write-Host 'Starting backend on port 3002...' -ForegroundColor Cyan ; npm start"
    Write-Host "⏳ Waiting for backend to start..." -ForegroundColor Yellow
    Start-Sleep -Seconds 8
    
    # Verify backend started
    try {
        $test = Invoke-RestMethod -Uri 'http://localhost:3002/api/health' -TimeoutSec 3
        Write-Host "✅ Backend started successfully!`n" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  Backend may still be starting...`n" -ForegroundColor Yellow
    }
}

# Step 2: Start Frontend
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "STEP 2: Starting Frontend Server..." -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Gray

# Check if frontend is already running
try {
    $test = Invoke-WebRequest -Uri 'http://localhost:5001' -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
    Write-Host "✅ Frontend already running on port 5001`n" -ForegroundColor Green
} catch {
    Write-Host "Starting frontend server..." -ForegroundColor White
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'c:\MF root folder\mutual fund' ; Write-Host 'Starting frontend on port 5001...' -ForegroundColor Cyan ; npm run dev"
    Write-Host "⏳ Waiting for frontend to start..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
    
    try {
        $test = Invoke-WebRequest -Uri 'http://localhost:5001' -TimeoutSec 3 -UseBasicParsing
        Write-Host "✅ Frontend started successfully!`n" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  Frontend may still be starting...`n" -ForegroundColor Yellow
    }
}

# Step 3: Verify System
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "STEP 3: Running System Verification..." -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Gray

Start-Sleep -Seconds 3

cd "c:\MF root folder\mutual-funds-backend"
node verify-system.js

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "STARTUP COMPLETE!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Gray

Write-Host "🌐 Access Points:" -ForegroundColor Yellow
Write-Host "   Backend:  http://localhost:3002" -ForegroundColor Cyan
Write-Host "   Frontend: http://localhost:5001`n" -ForegroundColor Cyan

Write-Host "📊 Quick Tests:" -ForegroundColor Yellow
Write-Host "   1. Open browser: http://localhost:5001" -ForegroundColor White
Write-Host "   2. Navigate to Equity > Large Cap" -ForegroundColor White
Write-Host "   3. Check if fund cards show data" -ForegroundColor White
Write-Host "   4. Click on market indices`n" -ForegroundColor White

Write-Host "⚠️  If funds show 0.00% returns:" -ForegroundColor Yellow
Write-Host "   Run: " -NoNewline -ForegroundColor White
Write-Host "node run-update-returns.js 100" -ForegroundColor Cyan
Write-Host "   (Takes ~5-8 minutes)`n" -ForegroundColor Gray

Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
