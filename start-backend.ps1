#!/usr/bin/env pwsh
# Start backend server on port 3002
$env:PORT = "3002"
Write-Host "🚀 Starting Backend Server on port 3002..." -ForegroundColor Green
npm run dev
