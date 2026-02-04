# 🚀 Quick Start Guide

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file
cp .env.local.example .env

# 3. Configure your .env file with local settings

# 4. Build the project
npm run build

# 5. Start development server
npm run dev:direct

# 6. Verify server is running
.\verify-server.ps1
# OR manually test:
# curl http://localhost:3002/health
```

Your server should now be running at: **http://localhost:3002**

---

## AWS EC2 Production Deployment

```bash
# 1. SSH into your EC2 instance
ssh -i your-key.pem ubuntu@YOUR_EC2_IP

# 2. Clone repository
git clone <your-repo-url>
cd mutual-funds-backend

# 3. Install dependencies
npm install --production

# 4. Setup production environment
cp .env.production.example .env.production
nano .env.production
# Update all values, especially:
# - DATABASE_URL
# - JWT_SECRET & JWT_REFRESH_SECRET
# - FRONTEND_URL

# 5. Build project
npm run build

# 6. Install PM2 globally
sudo npm install -g pm2

# 7. Create logs directory
mkdir -p logs

# 8. Start with PM2
pm2 start ecosystem.config.js --env production

# 9. Save PM2 configuration
pm2 save

# 10. Enable PM2 startup on boot
pm2 startup systemd
# Run the command it outputs

# 11. Configure firewall
sudo ufw allow 3002/tcp
sudo ufw enable

# 12. Verify deployment
./verify-server.sh
# OR manually:
# curl http://localhost:3002/health
```

From your local machine, test:

```bash
curl http://YOUR_EC2_IP:3002/health
```

---

## Common Commands

### Local Development

```bash
npm run dev:direct      # Start development server
npm run build           # Build TypeScript
npm start               # Start production mode locally
```

### Production (PM2)

```bash
pm2 list                # View all processes
pm2 logs                # View logs
pm2 restart all         # Restart application
pm2 reload all          # Zero-downtime reload
pm2 stop all            # Stop application
pm2 monit              # Monitor resources
```

---

## Verification URLs

**Local:**

- http://localhost:3002/
- http://localhost:3002/health
- http://localhost:3002/api/test

**Production:**

- http://YOUR_EC2_IP:3002/
- http://YOUR_EC2_IP:3002/health
- http://YOUR_EC2_IP:3002/api/test

---

## Troubleshooting

**Issue:** Can't connect to server

**Solutions:**

1. Check server is running: `pm2 list` or `netstat -tlnp | grep 3002`
2. Check logs: `pm2 logs mutual-funds-backend`
3. Verify AWS Security Group allows port 3002
4. Check server binds to 0.0.0.0 in index.ts

**Issue:** Routes return 404

**Solution:**

1. Verify build completed: `ls dist/`
2. Check routes are loaded in logs
3. Restart server: `pm2 restart mutual-funds-backend`

---

For detailed instructions, see [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
