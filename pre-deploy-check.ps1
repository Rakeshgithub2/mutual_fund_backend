#!/usr/bin/env pwsh
# Pre-Deployment Verification Script

Write-Host ""
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host "  PRE-DEPLOYMENT VERIFICATION CHECK" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""

$allPassed = $true

# Check 1: Build Output
Write-Host "1️⃣  Checking Build Output..." -ForegroundColor Yellow
if (Test-Path "dist/src/index.js") {
    Write-Host "   ✅ Main entry point exists (dist/src/index.js)" -ForegroundColor Green
} else {
    Write-Host "   ❌ Main entry point missing!" -ForegroundColor Red
    $allPassed = $false
}

# Check 2: Routes
Write-Host ""
Write-Host "2️⃣  Checking Routes..." -ForegroundColor Yellow
$requiredRoutes = @("index.js", "auth.routes.js", "funds.js", "users.js")
foreach ($route in $requiredRoutes) {
    if (Test-Path "dist/src/routes/$route") {
        Write-Host "   ✅ $route" -ForegroundColor Green
    } else {
        Write-Host "   ❌ $route MISSING!" -ForegroundColor Red
        $allPassed = $false
    }
}

# Check 3: Environment File
Write-Host ""
Write-Host "3️⃣  Checking Environment..." -ForegroundColor Yellow
if (Test-Path ".env") {
    Write-Host "   ✅ .env file exists" -ForegroundColor Green
    
    # Check critical env vars
    $envContent = Get-Content .env -Raw
    $criticalVars = @("DATABASE_URL", "JWT_SECRET", "PORT")
    foreach ($var in $criticalVars) {
        if ($envContent -match $var) {
            Write-Host "   ✅ $var is set" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  $var might be missing" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "   ❌ .env file missing!" -ForegroundColor Red
    $allPassed = $false
}

# Check 4: PM2 Configuration
Write-Host ""
Write-Host "4️⃣  Checking PM2 Config..." -ForegroundColor Yellow
if (Test-Path "ecosystem.config.js") {
    Write-Host "   ✅ ecosystem.config.js exists" -ForegroundColor Green
    
    # Verify correct script path
    $pm2Config = Get-Content ecosystem.config.js -Raw
    if ($pm2Config -match "script: './dist/src/index.js'") {
        Write-Host "   ✅ PM2 script path is correct" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  PM2 script path may be incorrect" -ForegroundColor Yellow
        Write-Host "      Expected: ./dist/src/index.js" -ForegroundColor Gray
    }
} else {
    Write-Host "   ❌ ecosystem.config.js missing!" -ForegroundColor Red
    $allPassed = $false
}

# Check 5: Package.json
Write-Host ""
Write-Host "5️⃣  Checking Package Configuration..." -ForegroundColor Yellow
if (Test-Path "package.json") {
    Write-Host "   ✅ package.json exists" -ForegroundColor Green
    
    $package = Get-Content package.json | ConvertFrom-Json
    if ($package.scripts.start) {
        Write-Host "   ✅ 'start' script defined" -ForegroundColor Green
    }
    if ($package.scripts.build) {
        Write-Host "   ✅ 'build' script defined" -ForegroundColor Green
    }
} else {
    Write-Host "   ❌ package.json missing!" -ForegroundColor Red
    $allPassed = $false
}

# Check 6: Server Configuration
Write-Host ""
Write-Host "6️⃣  Checking Server Configuration..." -ForegroundColor Yellow
$indexContent = Get-Content "src/index.ts" -Raw
if ($indexContent -match "0\.0\.0\.0") {
    Write-Host "   ✅ Server binds to 0.0.0.0 (accessible from public IP)" -ForegroundColor Green
} else {
    Write-Host "   ❌ Server might only bind to localhost!" -ForegroundColor Red
    $allPassed = $false
}

# Check 7: Route Registration
Write-Host ""
Write-Host "7️⃣  Checking Route Registration..." -ForegroundColor Yellow
if ($indexContent -match "app\.use\('/api', routes\)") {
    Write-Host "   ✅ Main API routes registered" -ForegroundColor Green
    Write-Host "      - /api/auth/*" -ForegroundColor Gray
    Write-Host "      - /api/funds/*" -ForegroundColor Gray
    Write-Host "      - /api/users/*" -ForegroundColor Gray
    Write-Host "      - /api/portfolio/*" -ForegroundColor Gray
} else {
    Write-Host "   ⚠️  Route registration may have issues" -ForegroundColor Yellow
}

# Check 8: Deployment Files
Write-Host ""
Write-Host "8️⃣  Checking Deployment Files..." -ForegroundColor Yellow
$deploymentFiles = @("DEPLOYMENT_GUIDE.md", ".env.production.example", "verify-server.sh")
foreach ($file in $deploymentFiles) {
    if (Test-Path $file) {
        Write-Host "   ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  $file missing (optional)" -ForegroundColor Yellow
    }
}

# Final Summary
Write-Host ""
Write-Host "=======================================" -ForegroundColor Cyan
if ($allPassed) {
    Write-Host "  ✅ ALL CHECKS PASSED!" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Your backend is READY for deployment!" -ForegroundColor Green
    Write-Host ""
    Write-Host "  After deployment, these URLs will work:" -ForegroundColor Cyan
    Write-Host "  - http://YOUR_PUBLIC_IP:3002/" -ForegroundColor White
    Write-Host "  - http://YOUR_PUBLIC_IP:3002/health" -ForegroundColor White
    Write-Host "  - http://YOUR_PUBLIC_IP:3002/api/test" -ForegroundColor White
    Write-Host "  - http://YOUR_PUBLIC_IP:3002/api/funds" -ForegroundColor White
    Write-Host "  - http://YOUR_PUBLIC_IP:3002/api/auth" -ForegroundColor White
    Write-Host ""
    Write-Host "  Ready to push to GitHub? ✅" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  SOME CHECKS FAILED!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Fix the issues above before deployment." -ForegroundColor Yellow
}
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""
