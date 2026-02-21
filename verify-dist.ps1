# Verify dist.zip contents and compare with EC2
# Run this to see what files will be deployed

Write-Host "`n🔍 LOCAL DIST.ZIP CONTENTS:" -ForegroundColor Cyan
Write-Host "=" * 60

$distZipPath = "dist.zip"
if (-not (Test-Path $distZipPath)) {
    Write-Host "❌ dist.zip not found!" -ForegroundColor Red
    exit 1
}

$zipInfo = Get-Item $distZipPath
Write-Host "📦 File: dist.zip" -ForegroundColor Green
Write-Host "   Size: $([math]::Round($zipInfo.Length / 1MB, 2)) MB"
Write-Host "   Last Modified: $($zipInfo.LastWriteTime)"
Write-Host ""

# Extract to temp to inspect
$tempDir = "dist_verify_temp"
if (Test-Path $tempDir) {
    Remove-Item $tempDir -Recurse -Force
}
Expand-Archive -Path $distZipPath -DestinationPath $tempDir

Write-Host "✅ CRITICAL FILES CHECK:" -ForegroundColor Yellow
Write-Host ""

# Check critical auth files
$criticalFiles = @(
    @{Path="src\index.js"; Name="Entry Point"},
    @{Path="src\routes\index.js"; Name="Main Router"},
    @{Path="src\routes\auth.routes.js"; Name="Auth Routes"},
    @{Path="src\controllers\auth.controller.js"; Name="Auth Controller"},
    @{Path="src\controllers\emailAuth.js"; Name="Email Auth Controller ⭐"},
    @{Path="src\controllers\googleAuth.js"; Name="Google Auth Controller ⭐"},
    @{Path="src\middleware\auth.middleware.js"; Name="Auth Middleware"}
)

foreach ($file in $criticalFiles) {
    $fullPath = Join-Path $tempDir $file.Path
    if (Test-Path $fullPath) {
        $size = (Get-Item $fullPath).Length
        Write-Host "   ✅ $($file.Name)" -ForegroundColor Green
        Write-Host "      Path: $($file.Path)" -ForegroundColor Gray
        Write-Host "      Size: $size bytes" -ForegroundColor Gray
        
        # Check exports for auth controllers
        if ($file.Path -like "*emailAuth.js") {
            $content = Get-Content $fullPath -Raw
            if ($content -match "exports\.emailRegister") {
                Write-Host "      ✅ exports.emailRegister found" -ForegroundColor Green
            } else {
                Write-Host "      ❌ exports.emailRegister MISSING!" -ForegroundColor Red
            }
            if ($content -match "exports\.emailLogin") {
                Write-Host "      ✅ exports.emailLogin found" -ForegroundColor Green
            } else {
                Write-Host "      ❌ exports.emailLogin MISSING!" -ForegroundColor Red
            }
        }
        
        if ($file.Path -like "*googleAuth.js") {
            $content = Get-Content $fullPath -Raw
            if ($content -match "exports\.googleLogin") {
                Write-Host "      ✅ exports.googleLogin found" -ForegroundColor Green
            } else {
                Write-Host "      ❌ exports.googleLogin MISSING!" -ForegroundColor Red
            }
        }
        Write-Host ""
    } else {
        Write-Host "   ❌ $($file.Name) - NOT FOUND!" -ForegroundColor Red
        Write-Host "      Expected: $($file.Path)" -ForegroundColor Gray
        Write-Host ""
    }
}

# Cleanup
Remove-Item $tempDir -Recurse -Force

Write-Host "`n📋 NEXT STEPS:" -ForegroundColor Cyan
Write-Host "=" * 60
Write-Host ""
Write-Host "If all files show ✅ above, you're ready to deploy!" -ForegroundColor Green
Write-Host ""
Write-Host "To upload to EC2:" -ForegroundColor Yellow
Write-Host "  scp -i YOUR_KEY.pem dist.zip ubuntu@13.60.156.3:~/mutual_fund_backend/" -ForegroundColor White
Write-Host ""
Write-Host "To verify files on EC2:" -ForegroundColor Yellow
Write-Host "  ssh ubuntu@13.60.156.3 ls -la ~/mutual_fund_backend/dist/src/controllers/" -ForegroundColor White
Write-Host ""
Write-Host "To check emailAuth.js on server:" -ForegroundColor Yellow  
Write-Host "  ssh ubuntu@13.60.156.3 tail -20 ~/mutual_fund_backend/dist/src/controllers/emailAuth.js" -ForegroundColor White
