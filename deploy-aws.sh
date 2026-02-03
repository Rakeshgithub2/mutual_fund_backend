#!/bin/bash

# ================================================================
# AWS EC2 Deployment Script for Mutual Funds Backend
# ================================================================
# This script automates the deployment of your backend to AWS EC2
# Run this ON YOUR EC2 INSTANCE after SSH login

set -e  # Exit on any error

echo "================================================================"
echo "🚀 Mutual Funds Backend - AWS EC2 Deployment"
echo "================================================================"

# ================================================================
# Step 1: Update System
# ================================================================
echo ""
echo "📦 Step 1: Updating system packages..."
sudo apt update && sudo apt upgrade -y

# ================================================================
# Step 2: Install Node.js 18
# ================================================================
echo ""
echo "📦 Step 2: Installing Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install pnpm
sudo npm install -g pnpm pm2

# Verify installation
node --version
npm --version
pnpm --version

# ================================================================
# Step 3: Clone Repository
# ================================================================
echo ""
echo "📂 Step 3: Setting up application..."
APP_DIR="/home/ubuntu/mutual-funds-backend"

if [ -d "$APP_DIR" ]; then
    echo "⚠️  Directory exists. Pulling latest changes..."
    cd $APP_DIR
    git pull origin main
else
    echo "📥 Cloning repository..."
    cd /home/ubuntu
    git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git mutual-funds-backend
    cd mutual-funds-backend
fi

# ================================================================
# Step 4: Setup Environment Variables
# ================================================================
echo ""
echo "🔐 Step 4: Setting up environment variables..."

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found. Creating from template..."
    
    cat > .env << 'EOF'
# =====================================================
# PRODUCTION ENVIRONMENT VARIABLES
# =====================================================
# ⚠️ IMPORTANT: Update these values with your actual credentials

# Database
DATABASE_URL=your_mongodb_connection_string_here

# JWT Secrets
JWT_SECRET=your_jwt_secret_here
JWT_REFRESH_SECRET=your_jwt_refresh_secret_here

# Server Configuration
PORT=3002
NODE_ENV=production

# Frontend URL (update with your domain)
FRONTEND_URL=https://yourdomain.com
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=https://api.yourdomain.com/api/auth/google/callback

# Redis
REDIS_URL=your_redis_url_here
REDIS_HOST=your_redis_host_here
REDIS_PORT=15749
REDIS_PASSWORD=your_redis_password_here

# Email Service
GMAIL_USER=your_gmail_here@gmail.com
GMAIL_APP_PASSWORD=your_gmail_app_password_here
USE_GMAIL=true
EMAIL_SERVICE=gmail

# APIs
RAPIDAPI_KEY=your_rapidapi_key_here
NEWS_API_KEY=your_news_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
EOF

    echo "✅ .env file created. Please review and update if needed."
    echo "⚠️  Edit with: nano .env"
else
    echo "✅ .env file already exists"
fi

# ================================================================
# Step 5: Install Dependencies
# ================================================================
echo ""
echo "📦 Step 5: Installing Node.js dependencies..."
pnpm install --frozen-lockfile

# ================================================================
# Step 6: Build Application
# ================================================================
echo ""
echo "🔨 Step 6: Building application..."
echo "   Running: prisma generate && tsc"

# This creates the dist/ folder with compiled JavaScript
pnpm run build

# Verify dist folder was created
if [ -d "dist" ]; then
    echo "✅ Build successful! dist/ folder created"
    echo "   Files in dist/:"
    ls -lh dist/ | head -10
else
    echo "❌ Build failed! dist/ folder not found"
    exit 1
fi

# ================================================================
# Step 7: Setup PM2 Process Manager
# ================================================================
echo ""
echo "⚙️  Step 7: Setting up PM2 process manager..."

# Create PM2 ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'backend-api',
      script: 'dist/src/app.js',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3002
      },
      error_file: 'logs/err.log',
      out_file: 'logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '500M'
    },
    {
      name: 'worker-market-indices',
      script: 'dist/src/workers/background-jobs.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M'
    }
  ]
};
EOF

echo "✅ PM2 configuration created"

# ================================================================
# Step 8: Start Application with PM2
# ================================================================
echo ""
echo "🚀 Step 8: Starting application..."

# Stop existing processes
pm2 stop all || true
pm2 delete all || true

# Start new processes
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu
pm2 save

echo "✅ Application started successfully!"

# ================================================================
# Step 9: Setup Nginx (Optional - Reverse Proxy)
# ================================================================
echo ""
echo "🔧 Step 9: Setting up Nginx reverse proxy..."

sudo apt install -y nginx

# Create Nginx configuration
sudo tee /etc/nginx/sites-available/mutual-funds-backend << 'EOF'
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# Enable site
sudo ln -sf /etc/nginx/sites-available/mutual-funds-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx

echo "✅ Nginx configured successfully!"

# ================================================================
# Step 10: Setup SSL with Let's Encrypt (Optional)
# ================================================================
echo ""
echo "🔒 Step 10: SSL Setup (Optional)..."
echo "To enable HTTPS, run:"
echo "  sudo apt install certbot python3-certbot-nginx"
echo "  sudo certbot --nginx -d api.yourdomain.com"

# ================================================================
# Final Status
# ================================================================
echo ""
echo "================================================================"
echo "✅ DEPLOYMENT COMPLETE!"
echo "================================================================"
echo ""
echo "📊 Application Status:"
pm2 status
echo ""
echo "📝 Useful Commands:"
echo "  View logs:        pm2 logs"
echo "  Restart:          pm2 restart all"
echo "  Stop:             pm2 stop all"
echo "  Monitor:          pm2 monit"
echo ""
echo "🌐 Access your API at:"
echo "  http://YOUR_EC2_PUBLIC_IP:3002/health"
echo "  or http://api.yourdomain.com (if Nginx configured)"
echo ""
echo "================================================================"
