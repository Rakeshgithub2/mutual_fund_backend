#!/bin/bash
# MongoDB Performance Fix - Quick Deploy Script for AWS EC2
# Run this script on your EC2 instance after updating code

set -e

echo "🚀 MongoDB Performance Fix Deployment"
echo "======================================"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Not in backend directory"
    echo "Please cd to mutual-funds-backend folder first"
    exit 1
fi

# Check if MongoDB is running
echo "1️⃣  Checking MongoDB..."
if systemctl is-active --quiet mongod; then
    echo "   ✅ MongoDB is running"
else
    echo "   ⚠️  MongoDB is not running, starting..."
    sudo systemctl start mongod
    sleep 2
fi
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "❌ Error: .env file not found"
    echo "Please create .env with MONGO_URI"
    exit 1
fi

# Build TypeScript
echo "2️⃣  Building TypeScript..."
if command -v pnpm &> /dev/null; then
    pnpm run build
elif command -v npm &> /dev/null; then
    npm run build
else
    echo "   ❌ No package manager found"
    exit 1
fi
echo "   ✅ Build complete"
echo ""

# Create indexes
echo "3️⃣  Creating MongoDB indexes..."
if [ -f "scripts/create-indexes.js" ]; then
    node scripts/create-indexes.js
    if [ $? -eq 0 ]; then
        echo "   ✅ Indexes created successfully"
    else
        echo "   ❌ Index creation failed"
        exit 1
    fi
else
    echo "   ❌ scripts/create-indexes.js not found"
    exit 1
fi
echo ""

# Restart backend
echo "4️⃣  Restarting backend..."
if command -v pm2 &> /dev/null; then
    pm2 restart all
    echo "   ✅ Backend restarted (PM2)"
else
    echo "   ⚠️  PM2 not found, please restart manually"
fi
echo ""

# Test endpoint
echo "5️⃣  Testing API endpoint..."
sleep 3
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/api/funds?limit=10)
if [ "$RESPONSE" -eq 200 ]; then
    echo "   ✅ API is responding (HTTP $RESPONSE)"
else
    echo "   ⚠️  API returned HTTP $RESPONSE"
    echo "   Check logs: pm2 logs"
fi
echo ""

echo "======================================"
echo "🎉 Deployment Complete!"
echo ""
echo "Next steps:"
echo "  - Test in browser: http://YOUR_EC2_IP:5000/api/funds"
echo "  - Check logs: pm2 logs"
echo "  - Verify indexes: mongosh --eval 'use mutualfunds; db.funds.getIndexes()'"
echo ""
