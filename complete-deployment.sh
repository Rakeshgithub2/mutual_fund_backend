#!/bin/bash
# Quick deployment completion script

ssh -i "C:/MF root folder/mutual-funds-backend/mf-backend-key.pem" -o StrictHostKeyChecking=no ubuntu@54.205.1.3 <<'ENDSSH'

echo "🔍 Checking build status..."
cd ~/mutual_fund_backend

if [ ! -d "dist" ]; then
    echo "❌ dist folder not found. Running build..."
    npm run build
fi

echo "�� Starting backend with PM2..."
pm2 delete backend 2>/dev/null
pm2 start dist/app.js --name backend

echo "✅ Configuring PM2 auto-restart..."
pm2 startup systemd -u ubuntu --hp /home/ubuntu
pm2 save

echo "📊 PM2 Status:"
pm2 status

echo "🧪 Testing backend..."
sleep 3
curl -s http://localhost:3002/health | jq . || echo "Waiting for backend to start..."

ENDSSH
