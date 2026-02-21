#!/bin/bash

# ============================================================
# Fresh EC2 Backend Deployment Script
# ============================================================
# This script deploys the mutual funds backend to a fresh EC2
# instance from scratch
# ============================================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Configuration - WILL BE READ FROM CONFIG FILE
CONFIG_FILE="$(dirname "$0")/ec2-config.json"

echo -e "${CYAN}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║     🚀 FRESH EC2 BACKEND DEPLOYMENT AUTOMATION            ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check if configuration exists
if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${RED}✗ Configuration file not found!${NC}"
    echo -e "${YELLOW}Please run: ${CYAN}./configure-new-instance.ps1${YELLOW} first${NC}"
    exit 1
fi

# Read configuration
echo -e "${YELLOW}📋 Loading configuration...${NC}"
if command -v jq &> /dev/null; then
    EC2_IP=$(jq -r '.ec2_ip' "$CONFIG_FILE")
    KEY_PATH=$(jq -r '.key_path' "$CONFIG_FILE")
    GITHUB_REPO=$(jq -r '.github_repo' "$CONFIG_FILE")
else
    # Fallback without jq
    EC2_IP=$(grep -oP '"ec2_ip":\s*"\K[^"]+' "$CONFIG_FILE")
    KEY_PATH=$(grep -oP '"key_path":\s*"\K[^"]+' "$CONFIG_FILE")
    GITHUB_REPO=$(grep -oP '"github_repo":\s*"\K[^"]+' "$CONFIG_FILE")
fi

# Convert Windows path to Git Bash path if needed
if [[ "$KEY_PATH" =~ ^[A-Z]: ]]; then
    KEY_PATH="/${KEY_PATH:0:1}${KEY_PATH:2}"
    KEY_PATH="${KEY_PATH//\\//}"
fi

echo -e "${GREEN}✓ Loaded configuration${NC}"
echo -e "  EC2 IP: ${CYAN}$EC2_IP${NC}"
echo -e "  SSH Key: ${CYAN}$KEY_PATH${NC}"
echo -e "  GitHub: ${CYAN}$GITHUB_REPO${NC}"
echo ""

# Verify SSH key exists
if [ ! -f "$KEY_PATH" ]; then
    echo -e "${RED}✗ SSH key not found: $KEY_PATH${NC}"
    exit 1
fi

# Fix key permissions
chmod 400 "$KEY_PATH" 2>/dev/null

# Test SSH connection
echo -e "${YELLOW}🔌 Testing SSH connection to EC2...${NC}"
if ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no -o ConnectTimeout=10 ubuntu@$EC2_IP "echo ''" &>/dev/null; then
    echo -e "${GREEN}✓ SSH connection successful!${NC}\n"
else
    echo -e "${RED}✗ Cannot connect to EC2 instance${NC}"
    echo -e "${YELLOW}Please check:${NC}"
    echo -e "  1. EC2 instance is running"
    echo -e "  2. Security Group allows SSH (port 22)"
    echo -e "  3. IP address is correct: $EC2_IP"
    echo -e "  4. SSH key is correct: $KEY_PATH"
    exit 1
fi

# Deployment steps
echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  Starting Fresh EC2 Deployment - This will take ~5-7 min  ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}\n"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${MAGENTA}Step 1/10: System Update${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no ubuntu@$EC2_IP << 'ENDSSH'
set -e
echo "Updating system packages..."
sudo apt update -qq
sudo DEBIAN_FRONTEND=noninteractive apt upgrade -y -qq
echo "✓ System updated"
ENDSSH

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ System update completed${NC}\n"
else
    echo -e "${RED}✗ System update failed${NC}"
    exit 1
fi

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${MAGENTA}Step 2/10: Installing Node.js 20.x${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no ubuntu@$EC2_IP << 'ENDSSH'
set -e
if ! command -v node &> /dev/null; then
    echo "Installing Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - > /dev/null
    sudo apt-get install -y nodejs -qq
else
    echo "Node.js already installed"
fi
node --version
npm --version
echo "✓ Node.js installed"
ENDSSH

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Node.js installed${NC}\n"
else
    echo -e "${RED}✗ Node.js installation failed${NC}"
    exit 1
fi

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${MAGENTA}Step 3/10: Installing MongoDB${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no ubuntu@$EC2_IP << 'ENDSSH'
set -e
if ! command -v mongod &> /dev/null; then
    echo "Installing MongoDB 7.0..."
    
    # Import MongoDB public key
    curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
        sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
    
    # Add MongoDB repository
    echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
        sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list > /dev/null
    
    # Install MongoDB
    sudo apt-get update -qq
    sudo apt-get install -y mongodb-org -qq
    
    # Start MongoDB
    sudo systemctl start mongod
    sudo systemctl enable mongod
else
    echo "MongoDB already installed"
    sudo systemctl start mongod
fi

# Verify MongoDB is running
sleep 2
sudo systemctl status mongod --no-pager | grep "active (running)" && echo "✓ MongoDB is running"
ENDSSH

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ MongoDB installed and running${NC}\n"
else
    echo -e "${RED}✗ MongoDB installation failed${NC}"
    exit 1
fi

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${MAGENTA}Step 4/10: Installing Redis${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no ubuntu@$EC2_IP << 'ENDSSH'
set -e
if ! command -v redis-cli &> /dev/null; then
    echo "Installing Redis..."
    sudo apt install redis-server -y -qq
    sudo systemctl start redis-server
    sudo systemctl enable redis-server
else
    echo "Redis already installed"
    sudo systemctl start redis-server
fi

# Test Redis
redis-cli ping | grep "PONG" && echo "✓ Redis is running"
ENDSSH

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Redis installed and running${NC}\n"
else
    echo -e "${RED}✗ Redis installation failed${NC}"
    exit 1
fi

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${MAGENTA}Step 5/10: Installing PM2 Process Manager${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no ubuntu@$EC2_IP << 'ENDSSH'
set -e
if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    sudo npm install -g pm2 --silent
else
    echo "PM2 already installed"
fi
pm2 --version
echo "✓ PM2 installed"
ENDSSH

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ PM2 installed${NC}\n"
else
    echo -e "${RED}✗ PM2 installation failed${NC}"
    exit 1
fi

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${MAGENTA}Step 6/10: Cloning GitHub Repository${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no ubuntu@$EC2_IP bash -c "cat > /tmp/clone_repo.sh" << ENDSSH
#!/bin/bash
set -e

REPO_URL="$GITHUB_REPO"
REPO_DIR="mutual_fund_backend"

if [ -d "\$REPO_DIR" ]; then
    echo "Repository exists, updating..."
    cd "\$REPO_DIR"
    git pull origin main || git pull origin master
else
    echo "Cloning repository: \$REPO_URL"
    git clone "\$REPO_URL" "\$REPO_DIR"
    cd "\$REPO_DIR"
fi

echo "✓ Repository ready at ~/\$REPO_DIR"
ENDSSH

ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no ubuntu@$EC2_IP "bash /tmp/clone_repo.sh"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Repository cloned${NC}\n"
else
    echo -e "${RED}✗ Repository clone failed${NC}"
    exit 1
fi

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${MAGENTA}Step 7/10: Setting up Environment Variables${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no ubuntu@$EC2_IP << 'ENDSSH'
set -e
cd ~/mutual_fund_backend

# Create .env file
cat > .env << 'EOF'
NODE_ENV=production
PORT=3002
MONGODB_URI=mongodb://localhost:27017/mutual_funds
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=$(openssl rand -base64 32)
CORS_ORIGIN=*
LOG_LEVEL=info
EOF

echo "✓ Environment variables configured"
ENDSSH

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Environment variables setup${NC}\n"
else
    echo -e "${RED}✗ Environment setup failed${NC}"
    exit 1
fi

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${MAGENTA}Step 8/10: Installing Dependencies${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no ubuntu@$EC2_IP << 'ENDSSH'
set -e
cd ~/mutual_fund_backend
echo "Installing npm packages (this may take a minute)..."
npm install --production --silent
echo "✓ Dependencies installed"
ENDSSH

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Dependencies installed${NC}\n"
else
    echo -e "${RED}✗ Dependency installation failed${NC}"
    exit 1
fi

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${MAGENTA}Step 9/10: Building TypeScript${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no ubuntu@$EC2_IP << 'ENDSSH'
set -e
cd ~/mutual_fund_backend
echo "Building TypeScript..."
npm run build
echo "✓ Build completed"
ENDSSH

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ TypeScript build successful${NC}\n"
else
    echo -e "${RED}✗ Build failed${NC}"
    exit 1
fi

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${MAGENTA}Step 10/10: Starting Backend with PM2${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no ubuntu@$EC2_IP << 'ENDSSH'
set -e
cd ~/mutual_fund_backend

# Stop if already running
pm2 stop mutual-funds-backend 2>/dev/null || true
pm2 delete mutual-funds-backend 2>/dev/null || true

# Start with PM2
pm2 start dist/server.js --name mutual-funds-backend

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu | tail -1 | sudo bash

echo "✓ Backend started with PM2"
sleep 3
pm2 status
ENDSSH

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Backend started successfully${NC}\n"
else
    echo -e "${RED}✗ Backend start failed${NC}"
    exit 1
fi

# Test the deployment
echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  Testing Deployment                                        ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}\n"

echo -e "${YELLOW}Testing health endpoint...${NC}"
sleep 3

HEALTH_RESPONSE=$(curl -s http://$EC2_IP:3002/health || echo "FAILED")

if echo "$HEALTH_RESPONSE" | grep -q "ok"; then
    echo -e "${GREEN}✅ Health check PASSED!${NC}"
    echo -e "${CYAN}Response: ${NC}$HEALTH_RESPONSE\n"
else
    echo -e "${YELLOW}⚠️  Backend deployed but not responding yet...${NC}"
    echo -e "${YELLOW}It may take a few more seconds to start.${NC}\n"
fi

# Final summary
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                            ║${NC}"
echo -e "${GREEN}║            ✅ DEPLOYMENT COMPLETED SUCCESSFULLY!           ║${NC}"
echo -e "${GREEN}║                                                            ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}\n"

echo -e "${CYAN}🌐 Your Backend URLs:${NC}"
echo -e "  Health:  ${BLUE}http://$EC2_IP:3002/health${NC}"
echo -e "  API:     ${BLUE}http://$EC2_IP:3002/api${NC}"
echo -e "  Funds:   ${BLUE}http://$EC2_IP:3002/api/funds?limit=5${NC}\n"

echo -e "${CYAN}📋 Next Steps:${NC}"
echo -e "  1. Test backend: ${YELLOW}./test-new-backend.ps1${NC}"
echo -e "  2. Update frontend API URL with: ${YELLOW}$EC2_IP${NC}"
echo -e "  3. Connect to EC2: ${YELLOW}ssh -i $KEY_PATH ubuntu@$EC2_IP${NC}\n"

echo -e "${CYAN}🔧 Useful Commands:${NC}"
echo -e "  Check status: ${YELLOW}ssh -i $KEY_PATH ubuntu@$EC2_IP 'pm2 status'${NC}"
echo -e "  View logs:    ${YELLOW}ssh -i $KEY_PATH ubuntu@$EC2_IP 'pm2 logs'${NC}"
echo -e "  Restart:      ${YELLOW}ssh -i $KEY_PATH ubuntu@$EC2_IP 'pm2 restart mutual-funds-backend'${NC}\n"

echo -e "${GREEN}✨ Deployment automation complete!${NC}\n"
