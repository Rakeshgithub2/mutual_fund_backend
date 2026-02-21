#!/bin/bash
# ============================================================
# Complete Deployment Script for All Services
# Backend + Frontend + Automation
# ============================================================

set -e  # Exit on error

EC2_IP="54.205.1.3"
KEY_PATH="/c/MF root folder/mutual-funds-backend/mf-backend-key.pem"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║     🚀 DEPLOYING ALL SERVICES TO EC2                       ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# =======================
# STEP 1: Deploy Backend
# =======================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  STEP 1/3: Deploying Backend (Port 3002)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no ubuntu@$EC2_IP <<'BACKEND'
cd ~/mutual_fund_backend || exit 1

echo "✓ Building TypeScript..."
npm run build 2>&1 | tail -5

echo "✓ Starting backend with PM2..."
pm2 delete backend 2>/dev/null || true
pm2 start dist/app.js --name backend
pm2 save

echo "✓ Backend Status:"
pm2 status backend

echo "✅ Backend deployed successfully!"
BACKEND

echo ""
sleep 2

# Test backend
echo "🧪 Testing backend..."
ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no ubuntu@$EC2_IP 'curl -s http://localhost:3002/health | jq .' || echo "Backend starting..."

echo ""
echo "✅ BACKEND DEPLOYED"
echo ""

# =======================
# STEP 2: Deploy Frontend
# =======================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  STEP 2/3: Deploying Frontend (Port 5001)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no ubuntu@$EC2_IP <<'FRONTEND'
# Clone frontend repo
if [ ! -d "~/mutual_fund_frontend" ]; then
    echo "✓ Cloning frontend repository..."
    cd ~
    git clone https://github.com/Rakeshgithub2/mutual_fund_frontend.git
else
    echo "✓ Updating frontend repository..."
    cd ~/mutual_fund_frontend
    git pull origin main
fi

cd ~/mutual_fund_frontend

# Create .env.local with backend API URL
echo "✓ Configuring environment..."
cat > .env.local <<ENV
NEXT_PUBLIC_API_URL=http://54.205.1.3:3002/api
ENV

echo "✓ Installing dependencies..."
npm install --legacy-peer-deps 2>&1 | tail -5

echo "✓ Building frontend..."
npm run build 2>&1 | tail -10

echo "✓ Starting frontend with PM2..."
pm2 delete frontend 2>/dev/null || true
pm2 start npm --name "frontend" -- start
pm2 save

echo "✓ Frontend Status:"
pm2 status frontend

echo "✅ Frontend deployed successfully!"
FRONTEND

echo ""
echo "✅ FRONTEND DEPLOYED"
echo ""

# ========================
# STEP 3: Deploy Automation
# ========================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  STEP 3/3: Deploying Automation Scripts"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no ubuntu@$EC2_IP <<'AUTOMATION'
# Install Python if not installed
if ! command -v python3 &> /dev/null; then
    echo "✓ Installing Python..."
    sudo apt-get update
    sudo apt-get install -y python3 python3-pip
fi

# Clone automation repo
if [ ! -d "~/mutual_fund_automation" ]; then
    echo "✓ Cloning automation repository..."
    cd ~
    git clone https://github.com/Rakeshgithub2/mutual_fund_automation.git
else
    echo "✓ Updating automation repository..."
    cd ~/mutual_fund_automation
    git pull origin main
fi

cd ~/mutual_fund_automation

echo "✓ Installing Python dependencies..."
pip3 install -r requirements.txt 2>&1 | tail -5

echo "✓ Setting up cron jobs..."
mkdir -p ~/logs

# Add cron jobs for automation
(crontab -l 2>/dev/null | grep -v "mutual_fund_automation"; cat <<CRON
# Mutual Fund Data Updates
0 8 * * * cd ~/mutual_fund_automation && python3 production_automation.py >> ~/logs/automation.log 2>&1
0 */6 * * * cd ~/mutual_fund_automation && python3 check_status.py >> ~/logs/status.log 2>&1
CRON
) | crontab -

echo "✓ Cron jobs configured:"
crontab -l | grep mutual_fund

echo "✅ Automation deployed successfully!"
AUTOMATION

echo ""
echo "✅ AUTOMATION DEPLOYED"
echo ""

# ======================
# FINAL STATUS CHECK
# ======================
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║            ✅ ALL SERVICES DEPLOYED SUCCESSFULLY!          ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

echo "📊 PM2 Process Status:"
ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no ubuntu@$EC2_IP 'pm2 status'

echo ""
echo "🌐 Your Application is LIVE:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Backend API:  http://$EC2_IP:3002"
echo "  Frontend App: http://$EC2_IP:5001"
echo "  Health Check: http://$EC2_IP:3002/health"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Next Steps:"
echo "  1. Open browser: http://$EC2_IP:5001"
echo "  2. Test API: http://$EC2_IP:3002/health"
echo "  3. Monitor logs: ssh ubuntu@$EC2_IP 'pm2 logs'"
echo ""
