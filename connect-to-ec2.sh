#!/bin/bash

# ============================================================
# EC2 SSH Connection Helper
# ============================================================
# Quick helper to connect to your EC2 instance
# ============================================================

# Colors
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

CONFIG_FILE="$(dirname "$0")/ec2-config.json"

echo -e "${CYAN}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║           🔌 EC2 SSH CONNECTION HELPER                    ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}\n"

# Check if configuration exists
if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${RED}✗ Configuration file not found!${NC}"
    echo -e "${YELLOW}Please run: ./configure-new-instance.ps1 first${NC}"
    exit 1
fi

# Read configuration
if command -v jq &> /dev/null; then
    EC2_IP=$(jq -r '.ec2_ip' "$CONFIG_FILE")
    KEY_PATH=$(jq -r '.key_path' "$CONFIG_FILE")
else
    EC2_IP=$(grep -oP '"ec2_ip":\s*"\K[^"]+' "$CONFIG_FILE")
    KEY_PATH=$(grep -oP '"key_path":\s*"\K[^"]+' "$CONFIG_FILE")
fi

# Convert Windows path to Git Bash path if needed
if [[ "$KEY_PATH" =~ ^[A-Z]: ]]; then
    KEY_PATH="/${KEY_PATH:0:1}${KEY_PATH:2}"
    KEY_PATH="${KEY_PATH//\\//}"
fi

echo -e "${GREEN}Connecting to EC2...${NC}"
echo -e "  IP:  ${CYAN}$EC2_IP${NC}"
echo -e "  Key: ${CYAN}$KEY_PATH${NC}\n"

# Fix key permissions
chmod 400 "$KEY_PATH" 2>/dev/null

# Connect via SSH
echo -e "${YELLOW}Establishing SSH connection...${NC}\n"
ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no ubuntu@$EC2_IP
