#!/bin/bash

# Oracle VM Ingestion Server Setup Script
# Run this on a fresh Oracle Cloud Ubuntu VM

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🏗️  Setting up MF Ingestion Server on Oracle VM"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
   echo "❌ Please run as normal user (ubuntu), not root"
   exit 1
fi

# Step 1: Update system
echo "📦 Step 1: Updating system packages..."
sudo apt update
sudo apt upgrade -y
echo "✅ System updated"
echo ""

# Step 2: Install Node.js 18
echo "📦 Step 2: Installing Node.js 18..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt install -y nodejs
    echo "✅ Node.js installed: $(node --version)"
else
    echo "✅ Node.js already installed: $(node --version)"
fi
echo ""

# Step 3: Install PM2
echo "📦 Step 3: Installing PM2..."
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
    echo "✅ PM2 installed: $(pm2 --version)"
else
    echo "✅ PM2 already installed: $(pm2 --version)"
fi
echo ""

# Step 4: Create directories
echo "📁 Step 4: Creating directories..."
mkdir -p ~/mf-workers
mkdir -p ~/logs
echo "✅ Directories created"
echo ""

# Step 5: Install worker dependencies
echo "📦 Step 5: Installing worker dependencies..."
cd ~/mf-workers

# Create package.json if it doesn't exist
if [ ! -f "package.json" ]; then
    cat > package.json << 'EOF'
{
  "name": "mf-ingestion-workers",
  "version": "1.0.0",
  "description": "24/7 fund ingestion workers",
  "main": "missing-fund-worker.js",
  "scripts": {
    "start": "pm2 start ecosystem.config.json",
    "stop": "pm2 stop all",
    "restart": "pm2 restart all",
    "logs": "pm2 logs",
    "status": "pm2 status"
  },
  "dependencies": {
    "axios": "^1.6.0",
    "mongodb": "^6.0.0",
    "dotenv": "^16.0.0"
  }
}
EOF
fi

npm install
echo "✅ Dependencies installed"
echo ""

# Step 6: Configure environment variables
echo "⚙️  Step 6: Configuring environment..."
if [ ! -f ".env" ]; then
    echo "📝 Please provide your MongoDB connection string:"
    echo "Example: mongodb+srv://user:pass@cluster.mongodb.net/mutual_funds_db"
    read -p "DATABASE_URL: " db_url
    
    cat > .env << EOF
NODE_ENV=production
DATABASE_URL=$db_url
EOF
    echo "✅ Environment configured"
else
    echo "✅ .env file already exists"
fi
echo ""

# Step 7: Setup PM2 startup
echo "🔧 Step 7: Configuring PM2 auto-start..."
pm2 startup systemd -u ubuntu --hp /home/ubuntu | grep "sudo" | sh
echo "✅ PM2 will auto-start on reboot"
echo ""

# Step 8: Display next steps
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Setup Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 Next Steps:"
echo ""
echo "1. Upload worker files from your local machine:"
echo "   scp workers/missing-fund-worker.js ubuntu@$(hostname -I | awk '{print $1}'):~/mf-workers/"
echo "   scp workers/ecosystem.config.json ubuntu@$(hostname -I | awk '{print $1}'):~/mf-workers/"
echo ""
echo "2. Edit ecosystem.config.json with your DATABASE_URL:"
echo "   cd ~/mf-workers"
echo "   nano ecosystem.config.json"
echo ""
echo "3. Start the workers:"
echo "   pm2 start ecosystem.config.json"
echo "   pm2 save"
echo ""
echo "4. Check status:"
echo "   pm2 status"
echo "   pm2 logs"
echo ""
echo "🚀 Your VM IP: $(hostname -I | awk '{print $1}')"
echo ""
echo "For help, see: ORACLE_VM_INGESTION_SETUP.md"
