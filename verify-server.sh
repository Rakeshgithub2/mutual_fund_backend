#!/bin/bash
# Quick Verification Script for Backend Server (Linux/EC2)

HOST="localhost"
PORT="3002"
BASE_URL="http://${HOST}:${PORT}"

echo ""
echo "🔍 Backend Server Verification"
echo "================================"
echo "Target: $BASE_URL"
echo ""

# Function to test endpoint
test_endpoint() {
    local endpoint=$1
    local name=$2
    local url="${BASE_URL}${endpoint}"
    
    echo "Testing: $name"
    echo "  → $url"
    
    response=$(curl -s -w "\n%{http_code}" "$url" 2>&1)
    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$status_code" = "200" ]; then
        echo "  ✅ SUCCESS (Status: 200)"
        echo "  Response: $body"
    elif [ "$status_code" = "401" ] || [ "$status_code" = "403" ]; then
        echo "  ℹ️  Route exists (Status: $status_code - Auth required)"
    else
        echo "  ❌ FAILED (Status: $status_code)"
    fi
    echo ""
    
    return $([ "$status_code" = "200" ] || [ "$status_code" = "401" ] || [ "$status_code" = "403" ])
}

# Test endpoints
echo "Core Endpoints:"
echo "---------------"
test_endpoint "/" "Root"
root_status=$?
test_endpoint "/health" "Health Check"
health_status=$?
test_endpoint "/api/test" "API Test"
test_status=$?

echo ""
echo "API Endpoints:"
echo "--------------"
test_endpoint "/api/funds" "Funds List"
test_endpoint "/api/auth/me" "Auth Check"

echo ""
echo "================================"
if [ $root_status -eq 0 ] && [ $health_status -eq 0 ] && [ $test_status -eq 0 ]; then
    echo "✅ Backend is OPERATIONAL!"
else
    echo "❌ Backend has issues!"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Check if server is running: netstat -tlnp | grep $PORT"
    echo "  2. Check PM2 logs: pm2 logs mutual-funds-backend"
    echo "  3. Check .env.production configuration"
    echo "  4. Verify server binds to 0.0.0.0 (not just localhost)"
fi
echo ""
