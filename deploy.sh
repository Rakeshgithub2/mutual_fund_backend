#!/bin/bash
# ONE-COMMAND EC2 DEPLOYMENT
# Upload this file to EC2 and run: bash deploy.sh

echo "🚀 Starting deployment..."
cd ~/mutual_fund_backend

# Backup old dist
if [ -d "dist" ]; then
    echo "📦 Backing up old dist..."
    mv dist dist.backup.$(date +%Y%m%d_%H%M%S)
fi

# Extract new dist
echo "📂 Extracting dist.zip..."
unzip -o -q dist.zip

# Check critical files
echo "✅ Verifying files..."
if [ -f "dist/src/controllers/emailAuth.js" ]; then
    echo "   ✅ emailAuth.js found"
else
    echo "   ❌ emailAuth.js MISSING!"
    exit 1
fi

if [ -f "dist/src/controllers/googleAuth.js" ]; then
    echo "   ✅ googleAuth.js found"
else
    echo "   ❌ googleAuth.js MISSING!"
    exit 1
fi

# Check exports
echo "🔍 Checking exports..."
if grep -q "exports.emailRegister" dist/src/controllers/emailAuth.js; then
    echo "   ✅ emailRegister export found"
else
    echo "   ❌ emailRegister export MISSING!"
    exit 1
fi

if grep -q "exports.emailLogin" dist/src/controllers/emailAuth.js; then
    echo "   ✅ emailLogin export found"
else
    echo "   ❌ emailLogin export MISSING!"
    exit 1
fi

if grep -q "exports.googleLogin" dist/src/controllers/googleAuth.js; then
    echo "   ✅ googleLogin export found"
else
    echo "   ❌ googleLogin export MISSING!"
    exit 1
fi

# Restart PM2
echo "🔄 Restarting PM2..."
pm2 restart all

# Wait for startup
sleep 3

# Show status
echo ""
echo "📊 PM2 Status:"
pm2 status

echo ""
echo "📋 Last 15 log lines:"
pm2 logs --lines 15 --nostream

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🧪 Test registration:"
echo "curl -X POST http://localhost:3002/api/auth/register \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"email\":\"test@example.com\",\"password\":\"Test123!\",\"name\":\"Test\"}'"
