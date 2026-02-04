# 🚀 Complete Deployment Guide

This guide covers both **local development** and **AWS EC2 production deployment**.

---

## 📋 Table of Contents

1. [Local Development Setup](#local-development-setup)
2. [AWS EC2 Production Deployment](#aws-ec2-production-deployment)
3. [PM2 Process Management](#pm2-process-management)
4. [Troubleshooting](#troubleshooting)
5. [Future Updates Workflow](#future-updates-workflow)

---

## 🏠 Local Development Setup

### Prerequisites

- Node.js 18+ installed
- MongoDB running locally or MongoDB Atlas account
- Git installed

### Step 1: Clone Repository

```bash
git clone <your-repo-url>
cd mutual-funds-backend
```

### Step 2: Install Dependencies

```bash
npm install
# or
pnpm install
```

### Step 3: Environment Configuration

```bash
# Copy the example file
cp .env.local.example .env

# Edit .env with your local settings
nano .env
```

**Key local settings:**

- `PORT=3002`
- `NODE_ENV=development`
- `DATABASE_URL=mongodb://localhost:27017/mutual_funds_db`
- `FRONTEND_URL=http://localhost:3000`

### Step 4: Build TypeScript

```bash
npm run build
```

### Step 5: Start Development Server

```bash
# Development with hot reload
npm run dev:direct

# OR standard development
npm run dev

# OR production mode locally
npm start
```

### Step 6: Verify Local Server

```bash
# Test health endpoint
curl http://localhost:3002/health

# Test API endpoint
curl http://localhost:3002/api/test
```

**Expected Response:**

```json
{
  "status": "OK",
  "timestamp": "2026-02-04T...",
  "uptime": 123.456,
  "version": "2.0.0"
}
```

---

## ☁️ AWS EC2 Production Deployment

### Prerequisites

- AWS EC2 instance (Ubuntu 20.04/22.04 recommended)
- Security Group: Allow inbound port 3002
- SSH access to your instance

### Step 1: Connect to EC2

```bash
ssh -i your-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

### Step 2: Install Node.js 18+

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should be v18+
npm --version
```

### Step 3: Install PM2 Globally

```bash
sudo npm install -g pm2
pm2 --version
```

### Step 4: Clone Repository

```bash
cd ~
git clone <your-repo-url>
cd mutual-funds-backend
```

### Step 5: Install Dependencies

```bash
npm install --production
```

### Step 6: Production Environment Setup

```bash
# Copy production example
cp .env.production.example .env.production

# Edit with production values
nano .env.production
```

**Critical Production Settings:**

```env
PORT=3002
NODE_ENV=production
DATABASE_URL=mongodb+srv://user:pass@cluster.mongodb.net/dbname
FRONTEND_URL=http://YOUR_EC2_PUBLIC_IP:3000
JWT_SECRET=<generate-64-char-secret>
JWT_REFRESH_SECRET=<generate-64-char-secret>
```

**Generate secure secrets:**

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Step 7: Build TypeScript

```bash
npm run build
```

### Step 8: Create Logs Directory

```bash
mkdir -p logs
```

### Step 9: Start with PM2

```bash
# Start application using ecosystem config
pm2 start ecosystem.config.js --env production

# Save PM2 process list
pm2 save

# Setup PM2 to start on system reboot
pm2 startup systemd
# Copy and run the command it outputs
```

### Step 10: Configure Firewall

```bash
# Allow port 3002
sudo ufw allow 3002/tcp
sudo ufw enable
sudo ufw status
```

### Step 11: Verify Production Deployment

```bash
# From EC2 instance
curl http://localhost:3002/health

# From your local machine
curl http://YOUR_EC2_PUBLIC_IP:3002/health
```

**Expected Response:**

```json
{
  "status": "OK",
  "timestamp": "2026-02-04T...",
  "uptime": 123.456,
  "version": "2.0.0"
}
```

---

## 🔧 PM2 Process Management

### Basic Commands

```bash
# View all processes
pm2 list

# View logs (real-time)
pm2 logs mutual-funds-backend

# View specific log files
pm2 logs mutual-funds-backend --lines 100
tail -f logs/pm2-out.log
tail -f logs/pm2-error.log

# Monitor CPU/Memory
pm2 monit

# Restart application
pm2 restart mutual-funds-backend

# Stop application
pm2 stop mutual-funds-backend

# Delete from PM2
pm2 delete mutual-funds-backend

# Reload (zero-downtime restart)
pm2 reload mutual-funds-backend
```

### PM2 Configuration

The `ecosystem.config.js` file includes:

- **Cluster mode**: 2 instances for load balancing
- **Auto-restart**: On crashes
- **Memory limit**: 500MB per instance
- **Graceful shutdown**: 5s timeout
- **Logging**: Separate error and output logs

---

## 🔍 Troubleshooting

### Issue: ERR_CONNECTION_REFUSED

**Symptom:** Cannot connect to `http://YOUR_EC2_IP:3002`

**Solutions:**

1. **Check if server is running:**

   ```bash
   pm2 list
   pm2 logs mutual-funds-backend
   ```

2. **Check if port is listening:**

   ```bash
   sudo netstat -tlnp | grep 3002
   # Should show: 0.0.0.0:3002 LISTEN
   ```

3. **Verify server binds to 0.0.0.0 (not just localhost):**
   - Check `src/index.ts` has: `server.listen(PORT, '0.0.0.0', ...)`

4. **Check AWS Security Group:**
   - Go to EC2 Console → Security Groups
   - Add inbound rule: Port 3002, TCP, Source: 0.0.0.0/0

5. **Check EC2 firewall:**
   ```bash
   sudo ufw status
   sudo ufw allow 3002/tcp
   ```

### Issue: Server Starts Then Crashes

**Check logs:**

```bash
pm2 logs mutual-funds-backend --lines 200
```

**Common causes:**

- Database connection failed (check `DATABASE_URL`)
- Missing environment variables
- Port already in use

**Solution:**

```bash
# Kill process on port 3002
sudo lsof -ti:3002 | xargs kill -9

# Restart PM2
pm2 restart mutual-funds-backend
```

### Issue: CORS Errors

**Symptom:** Frontend can't access backend API

**Solution:**

1. Update `.env.production`:

   ```env
   FRONTEND_URL=http://YOUR_EC2_IP:3000
   ALLOWED_ORIGINS=http://YOUR_EC2_IP:3000,http://YOUR_EC2_IP:3001
   ```

2. Restart server:
   ```bash
   pm2 restart mutual-funds-backend
   ```

### Issue: 404 on API Routes

**Symptom:** Routes like `/api/funds` return 404

**Check:**

```bash
# Test base route
curl http://localhost:3002/

# Test health
curl http://localhost:3002/health

# Test API test endpoint
curl http://localhost:3002/api/test
```

**Verify routes are loaded:**

```bash
pm2 logs mutual-funds-backend | grep "Available Routes"
```

---

## 🔄 Future Updates Workflow

### Local Development → Production Pipeline

#### 1. Local Development

```bash
# Pull latest code
git pull origin main

# Install dependencies
npm install

# Build and test
npm run build
npm run dev:direct

# Test endpoints
curl http://localhost:3002/api/test
```

#### 2. Push to GitHub

```bash
git add .
git commit -m "Your changes"
git push origin main
```

#### 3. Deploy to EC2

```bash
# SSH into EC2
ssh -i your-key.pem ubuntu@YOUR_EC2_IP

# Navigate to project
cd ~/mutual-funds-backend

# Pull latest code
git pull origin main

# Install new dependencies (if any)
npm install --production

# Rebuild TypeScript
npm run build

# Zero-downtime reload
pm2 reload mutual-funds-backend

# Verify
curl http://localhost:3002/health
pm2 logs mutual-funds-backend --lines 50
```

#### 4. Rollback (If Needed)

```bash
# Revert to previous commit
git reset --hard HEAD~1

# Rebuild
npm run build

# Reload
pm2 reload mutual-funds-backend
```

---

## ✅ Production Checklist

Before going live:

- [ ] Environment variables are set correctly in `.env.production`
- [ ] Database connection tested
- [ ] JWT secrets are unique and secure (64+ characters)
- [ ] CORS configured with production frontend URL
- [ ] PM2 ecosystem.config.js configured
- [ ] Logs directory exists
- [ ] PM2 startup script configured for auto-start on reboot
- [ ] AWS Security Group allows port 3002
- [ ] EC2 firewall (ufw) allows port 3002
- [ ] Server binds to `0.0.0.0` (not `localhost`)
- [ ] Health check endpoint returns 200
- [ ] All API routes accessible
- [ ] PM2 logs show no errors
- [ ] Frontend can connect to backend

---

## 📞 Support

**Test Endpoints:**

- Root: `http://YOUR_SERVER:3002/`
- Health: `http://YOUR_SERVER:3002/health`
- API Test: `http://YOUR_SERVER:3002/api/test`
- Funds: `http://YOUR_SERVER:3002/api/funds`

**Common URLs:**

- Local: `http://localhost:3002`
- EC2: `http://YOUR_EC2_PUBLIC_IP:3002`
- Production: `https://api.yourdomain.com` (if using domain)

---

## 🎯 Best Practices

1. **Never commit `.env` files** - Use `.env.example` templates
2. **Use PM2 for production** - Don't use `npm start` directly
3. **Enable PM2 startup** - Survive server reboots
4. **Monitor logs regularly** - `pm2 logs` and log files
5. **Use cluster mode** - Multiple instances for reliability
6. **Set memory limits** - Prevent memory leaks
7. **Configure graceful shutdown** - Prevent data loss
8. **Test locally first** - Always verify before deploying
9. **Use zero-downtime reloads** - `pm2 reload` instead of `restart`
10. **Keep dependencies updated** - Security patches

---

**Last Updated:** February 4, 2026
