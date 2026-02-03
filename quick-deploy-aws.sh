#!/bin/bash
# QUICK AWS DEPLOYMENT SCRIPT - Run this on your EC2 instance

echo "🚀 Starting Mutual Funds Backend Deployment..."

# 1. Clone repository
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git /home/ubuntu/mutual-funds-backend
cd /home/ubuntu/mutual-funds-backend

# 2. Create .env file (⚠️  REPLACE WITH YOUR ACTUAL CREDENTIALS!)
cat > .env << 'ENVEOF'
DATABASE_URL=your_mongodb_connection_string_here
JWT_SECRET=your_jwt_secret_here
JWT_REFRESH_SECRET=your_jwt_refresh_secret_here
PORT=3002
NODE_ENV=production
FRONTEND_URL=https://yourdomain.com
ALLOWED_ORIGINS=https://yourdomain.com,http://localhost:5001
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
REDIS_URL=your_redis_url_here
REDIS_HOST=your_redis_host_here
REDIS_PORT=15749
REDIS_PASSWORD=your_redis_password_here
GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASSWORD=your_gmail_app_password_here
RAPIDAPI_KEY=your_rapidapi_key_here
NEWS_API_KEY=your_news_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
ENVEOF

# 3. Install dependencies
npm install

# 4. Check if build is needed
if grep -q '"start": "node dist/' package.json; then
    echo "📦 TypeScript detected - Building application..."
    npm run build
    
    # Verify dist was created
    if [ ! -d "dist" ]; then
        echo "❌ Build failed - dist/ not created!"
        exit 1
    fi
    echo "✅ Build successful - dist/ created"
else
    echo "✅ JavaScript mode - no build needed"
fi

# 5. Test the application
echo "🧪 Testing application..."
npm start &
APP_PID=$!
sleep 5

# Check if running
if kill -0 $APP_PID 2>/dev/null; then
    echo "✅ Application started successfully!"
    kill $APP_PID
else
    echo "❌ Application failed to start"
    exit 1
fi

# 6. Setup PM2
echo "⚙️  Setting up PM2..."
npm install -g pm2

# Determine entry point
if grep -q '"start": "node dist/' package.json; then
    ENTRY_POINT="dist/src/app.js"
else
    ENTRY_POINT="src/app.js"
fi

pm2 start $ENTRY_POINT --name backend-api
pm2 save
pm2 startup

echo ""
echo "================================================================"
echo "✅ DEPLOYMENT COMPLETE!"
echo "================================================================"
echo "Entry Point: $ENTRY_POINT"
echo "Status: pm2 status"
echo "Logs: pm2 logs backend-api"
echo "================================================================"
