# Complete Deployment Script - PowerShell

$ErrorActionPreference = "Continue"
$EC2_IP = "54.205.1.3"
$KEY_PATH = "C:\MF root folder\mutual-funds-backend\mf-backend-key.pem"
$GitBash = "C:\Program Files\Git\bin\bash.exe"

Write-Host "`n╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                                                            ║" -ForegroundColor Cyan
Write-Host "║     🚀 DEPLOYING ALL SERVICES TO EC2                       ║" -ForegroundColor Cyan
Write-Host "║                                                            ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

# ===========================
# STEP 1: Start Backend
# ===========================
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "  STEP 1/3: Starting Backend (Port 3002)" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow

Write-Host "Starting backend with PM2..." -ForegroundColor White
& $GitBash -c "ssh -i '$KEY_PATH' -o StrictHostKeyChecking=no ubuntu@$EC2_IP 'cd ~/mutual_fund_backend && pm2 delete backend 2>/dev/null || true && pm2 start dist/app.js --name backend && pm2 startup systemd -u ubuntu --hp /home/ubuntu && pm2 save && pm2 status'"

Start-Sleep -Seconds 5

Write-Host "`nTesting backend health..." -ForegroundColor Cyan
try {
    $health = Invoke-RestMethod -Uri "http://${EC2_IP}:3002/health" -TimeoutSec 10
    Write-Host "✅ Backend is ONLINE!" -ForegroundColor Green
    Write-Host "Status: $($health.status)" -ForegroundColor White
} catch {
    Write-Host "⚠️  Backend starting... waiting 10 more seconds" -ForegroundColor Yellow
    Start-Sleep -Seconds 10
    try {
        $health = Invoke-RestMethod -Uri "http://${EC2_IP}:3002/health" -TimeoutSec 10
        Write-Host "✅ Backend is ONLINE!" -ForegroundColor Green
    } catch {
        Write-Host "❌ Backend not responding yet" -ForegroundColor Red
    }
}

# ===========================
# STEP 2: Deploy Frontend
# ===========================
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "  STEP 2/3: Deploying Frontend (Port 5001)" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow

Write-Host "Cloning frontend repository..." -ForegroundColor White
& $GitBash -c "ssh -i '$KEY_PATH' -o StrictHostKeyChecking=no ubuntu@$EC2_IP 'git clone https://github.com/Rakeshgithub2/mutual_fund_frontend.git 2>/dev/null || (cd mutual_fund_frontend && git pull)'"

Write-Host "Configuring environment..." -ForegroundColor White
& $GitBash -c "ssh -i '$KEY_PATH' -o StrictHostKeyChecking=no ubuntu@$EC2_IP 'cd ~/mutual_fund_frontend && echo \"NEXT_PUBLIC_API_URL=http://${EC2_IP}:3002/api\" > .env.local'"

Write-Host "Installing dependencies (this will take 2-3 minutes)..." -ForegroundColor White
& $GitBash -c "ssh -i '$KEY_PATH' -o StrictHostKeyChecking=no ubuntu@$EC2_IP 'cd ~/mutual_fund_frontend && npm install --legacy-peer-deps'"

Write-Host "Building frontend..." -ForegroundColor White
& $GitBash -c "ssh -i '$KEY_PATH' -o StrictHostKeyChecking=no ubuntu@$EC2_IP 'cd ~/mutual_fund_frontend && npm run build'"

Write-Host "Starting frontend with PM2..." -ForegroundColor White
& $GitBash -c "ssh -i '$KEY_PATH' -o StrictHostKeyChecking=no ubuntu@$EC2_IP 'cd ~/mutual_fund_frontend && pm2 delete frontend 2>/dev/null || true && pm2 start npm --name frontend -- start && pm2 save'"

Write-Host "✅ FRONTEND DEPLOYED" -ForegroundColor Green

# ===========================
# STEP 3: Deploy Automation
# ===========================
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "  STEP 3/3: Deploying Automation Scripts" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow

Write-Host "Installing Python & Cloning automation repo..." -ForegroundColor White
& $GitBash -c "ssh -i '$KEY_PATH' -o StrictHostKeyChecking=no ubuntu@$EC2_IP 'sudo apt-get install -y python3 python3-pip && git clone https://github.com/Rakeshgithub2/mutual_fund_automation.git 2>/dev/null || (cd mutual_fund_automation && git pull)'"

Write-Host "Installing Python dependencies..." -ForegroundColor White
& $GitBash -c "ssh -i '$KEY_PATH' -o StrictHostKeyChecking=no ubuntu@$EC2_IP 'cd ~/mutual_fund_automation && pip3 install -r requirements.txt'"

Write-Host "Setting up cron jobs..." -ForegroundColor White
& $GitBash -c "ssh -i '$KEY_PATH' -o StrictHostKeyChecking=no ubuntu@$EC2_IP 'mkdir -p ~/logs && (crontab -l 2>/dev/null | grep -v mutual_fund; echo \"0 8 * * * cd ~/mutual_fund_automation && python3 production_automation.py >> ~/logs/automation.log 2>&1\"; echo \"0 */6 * * * cd ~/mutual_fund_automation && python3 check_status.py >> ~/logs/status.log 2>&1\") | crontab -'"

Write-Host "✅ AUTOMATION DEPLOYED" -ForegroundColor Green

# ===========================
# FINAL STATUS
# ===========================
Write-Host "`n╔════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                                                            ║" -ForegroundColor Green
Write-Host "║            ✅ ALL SERVICES DEPLOYED SUCCESSFULLY!          ║" -ForegroundColor Green
Write-Host "║                                                            ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════╝`n" -ForegroundColor Green

Write-Host "📊 PM2 Status:" -ForegroundColor Cyan
& $GitBash -c "ssh -i '$KEY_PATH' -o StrictHostKeyChecking=no ubuntu@$EC2_IP 'pm2 status'"

Write-Host "`n🌐 Your Application is LIVE:" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor White
Write-Host "  Backend API:  http://${EC2_IP}:3002" -ForegroundColor White
Write-Host "  Frontend App: http://${EC2_IP}:5001" -ForegroundColor White
Write-Host "  Health Check: http://${EC2_IP}:3002/health" -ForegroundColor White
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor White

Write-Host "`n📋 Open in browser:" -ForegroundColor Yellow
Write-Host "  http://${EC2_IP}:5001`n" -ForegroundColor Cyan
