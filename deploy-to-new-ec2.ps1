# Automated EC2 Backend Deployment - PowerShell Wrapper
# Launches the deployment automation script via Git Bash

$ErrorActionPreference = "Stop"

Write-Host @"

╔════════════════════════════════════════════════════════════╗
║                                                            ║
║        🚀 FRESH EC2 BACKEND DEPLOYMENT AUTOMATION         ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Cyan

# Check for configuration
$ConfigFile = Join-Path $PSScriptRoot "ec2-config.json"
if (-not (Test-Path $ConfigFile)) {
    Write-Host "✗ Configuration not found!`n" -ForegroundColor Red
    Write-Host "Please run the configuration helper first:" -ForegroundColor Yellow
    Write-Host "  .\configure-new-instance.ps1`n" -ForegroundColor Cyan
    exit 1
}

# Load configuration
$Config = Get-Content $ConfigFile | ConvertFrom-Json
$EC2_IP = $Config.ec2_ip
$KeyPath = $Config.key_path
$GithubRepo = $Config.github_repo

Write-Host "Configuration loaded:" -ForegroundColor Green
Write-Host "  EC2 IP:      $EC2_IP" -ForegroundColor Gray
Write-Host "  SSH Key:     $KeyPath" -ForegroundColor Gray
Write-Host "  GitHub Repo: $GithubRepo`n" -ForegroundColor Gray

# Verify SSH key
if (-not (Test-Path $KeyPath)) {
    Write-Host "✗ SSH key not found: $KeyPath`n" -ForegroundColor Red
    Write-Host "Please ensure your .pem file is at the specified location." -ForegroundColor Yellow
    exit 1
}

# Find Git Bash
Write-Host "Locating Git Bash..." -ForegroundColor Yellow
$GitBashPaths = @(
    "C:\Program Files\Git\bin\bash.exe",
    "C:\Program Files (x86)\Git\bin\bash.exe",
    "C:\Git\bin\bash.exe"
)

$GitBash = $null
foreach ($path in $GitBashPaths) {
    if (Test-Path $path) {
        $GitBash = $path
        Write-Host "  ✓ Found: $path`n" -ForegroundColor Green
        break
    }
}

if (-not $GitBash) {
    Write-Host "  ✗ Git Bash not found!`n" -ForegroundColor Red
    Write-Host "Please install Git for Windows from: https://git-scm.com/download/win" -ForegroundColor Yellow
    exit 1
}

# Verify deployment script
$DeployScript = Join-Path $PSScriptRoot "deploy-to-new-ec2.sh"
if (-not (Test-Path $DeployScript)) {
    Write-Host "✗ Deployment script not found!`n" -ForegroundColor Red
    exit 1
}

Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Deployment Process:" -ForegroundColor White
Write-Host "    1. ✅ Update system packages" -ForegroundColor Gray
Write-Host "    2. ✅ Install Node.js 20.x" -ForegroundColor Gray
Write-Host "    3. ✅ Install MongoDB 7.0" -ForegroundColor Gray
Write-Host "    4. ✅ Install Redis" -ForegroundColor Gray
Write-Host "    5. ✅ Install PM2 process manager" -ForegroundColor Gray
Write-Host "    6. ✅ Clone GitHub repository" -ForegroundColor Gray
Write-Host "    7. ✅ Setup environment variables" -ForegroundColor Gray
Write-Host "    8. ✅ Install dependencies" -ForegroundColor Gray
Write-Host "    9. ✅ Build TypeScript" -ForegroundColor Gray
Write-Host "   10. ✅ Start backend with PM2" -ForegroundColor Gray
Write-Host "════════════════════════════════════════════════════════════`n" -ForegroundColor Cyan

Write-Host "⏳ Estimated time: 5-7 minutes`n" -ForegroundColor Yellow
Write-Host "This will completely setup your EC2 instance from scratch." -ForegroundColor White
Write-Host "Press any key to start deployment (or Ctrl+C to cancel)..." -ForegroundColor Cyan
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

Write-Host "`n🚀 Starting automated deployment...`n" -ForegroundColor Green

# Convert Windows path to Git Bash path
$BashBackendPath = $PSScriptRoot -replace '\\', '/' -replace 'C:', '/c'

# Run deployment in Git Bash
$BashCommand = "cd '$BashBackendPath'; bash deploy-to-new-ec2.sh"

try {
    & $GitBash -c $BashCommand
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n╔════════════════════════════════════════════════════════════╗" -ForegroundColor Green
        Write-Host "║                                                            ║" -ForegroundColor Green
        Write-Host "║            ✅ DEPLOYMENT COMPLETED SUCCESSFULLY!           ║" -ForegroundColor Green
        Write-Host "║                                                            ║" -ForegroundColor Green
        Write-Host "╚════════════════════════════════════════════════════════════╝`n" -ForegroundColor Green
        
        Write-Host "🧪 Testing backend..." -ForegroundColor Cyan
        Start-Sleep -Seconds 5
        
        try {
            $healthResponse = Invoke-RestMethod -Uri "http://${EC2_IP}:3002/health" -TimeoutSec 15
            
            Write-Host "`n✅ Backend is LIVE and responding!" -ForegroundColor Green
            Write-Host "  Status: $($healthResponse.status)" -ForegroundColor White
            if ($healthResponse.services.database) {
                Write-Host "  Database: $($healthResponse.services.database.connected)" -ForegroundColor White
            }
            if ($healthResponse.services.cache) {
                Write-Host "  Redis: $($healthResponse.services.cache.connected)" -ForegroundColor White
            }
            
            Write-Host "`n🌐 Your backend is accessible at:" -ForegroundColor Cyan
            Write-Host "  Health: http://${EC2_IP}:3002/health" -ForegroundColor White
            Write-Host "  API:    http://${EC2_IP}:3002/api" -ForegroundColor White
            Write-Host "  Funds:  http://${EC2_IP}:3002/api/funds?limit=5`n" -ForegroundColor White
            
        } catch {
            Write-Host "`n⚠️  Backend deployed but not responding yet." -ForegroundColor Yellow
            Write-Host "  This may take a few more seconds to fully start..." -ForegroundColor Gray
            Write-Host "  Try: (Invoke-WebRequest http://${EC2_IP}:3002/health).Content`n" -ForegroundColor Cyan
        }
        
        Write-Host "📋 Next Steps:" -ForegroundColor Cyan
        Write-Host "  1. Test backend:  .\test-new-backend.ps1" -ForegroundColor White
        Write-Host "  2. Open browser:  http://${EC2_IP}:3002/health" -ForegroundColor White
        Write-Host "  3. Update frontend API URL with: $EC2_IP`n" -ForegroundColor White
        
    } else {
        Write-Host "`n✗ Deployment failed with exit code: $LASTEXITCODE`n" -ForegroundColor Red
        Write-Host "Please check the error messages above." -ForegroundColor Yellow
        Write-Host "You can try running the deployment again, or deploy manually.`n" -ForegroundColor Yellow
        exit 1
    }
    
} catch {
    Write-Host "`n✗ Error during deployment: $($_.Exception.Message)`n" -ForegroundColor Red
    exit 1
}

Write-Host "Deployment complete!" -ForegroundColor Green
Write-Host ""
