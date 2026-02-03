# 🚀 AWS Deployment - Dist Folder Issue & Solution

## 🔴 THE PROBLEM

Your build works locally but fails on AWS because:

### Local (Working ✅)

```
1. You have .env file with DATABASE_URL
2. npm run build → prisma generate → tsc compiles
3. dist/ folder created (206 files)
4. npm start runs the app from dist/
```

### AWS (Failing ❌)

```
1. Git clone → NO .env file (gitignored)
2. Git clone → NO dist/ folder (gitignored)
3. npm install → Only installs packages
4. npm start → FAILS (no dist/ folder to run from)
```

---

## ✅ THE SOLUTION

You **MUST build the application on AWS** after cloning from GitHub.

---

## 📋 Step-by-Step AWS Deployment

### **Step 1: SSH into Your EC2 Instance**

```bash
ssh -i your-key.pem ubuntu@your-ec2-ip
```

### **Step 2: Clone Your Repository**

```bash
cd /home/ubuntu
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git mutual-funds-backend
cd mutual-funds-backend
```

### **Step 3: Create .env File**

```bash
nano .env
```

Paste your environment variables:

```env
DATABASE_URL=your_mongodb_connection_string_here
JWT_SECRET=your_jwt_secret_here
JWT_REFRESH_SECRET=your_jwt_refresh_secret_here
PORT=3002
NODE_ENV=production
FRONTEND_URL=https://yourdomain.com
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
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
```

Press `Ctrl+X`, then `Y`, then `Enter` to save.

### **Step 4: Install Dependencies**

```bash
npm install -g pnpm
pnpm install --frozen-lockfile
```

### **Step 5: BUILD THE APPLICATION** ⚠️ CRITICAL STEP

```bash
npm run build
```

This command:

1. Runs `prisma generate` (creates Prisma client in node_modules/.prisma)
2. Runs `tsc` (compiles TypeScript to JavaScript in dist/ folder)

**Verify build succeeded:**

```bash
ls -la dist/
```

You should see folders like: `api/`, `src/`, `models/`, etc.

### **Step 6: Test the Application**

```bash
npm start
```

Check if it's running:

```bash
curl http://localhost:3002/health
```

### **Step 7: Setup PM2 for Production**

```bash
# Install PM2
npm install -g pm2

# Stop test server (Ctrl+C)

# Start with PM2
pm2 start dist/src/app.js --name backend-api

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Copy and run the command PM2 outputs

# View logs
pm2 logs
```

---

## 🐳 Alternative: Docker Deployment (Easier!)

Your Dockerfile already handles the build automatically.

### **On AWS EC2:**

```bash
# Install Docker
sudo apt update
sudo apt install -y docker.io
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ubuntu
# Log out and back in

# Clone repo
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd mutual-funds-backend

# Build Docker image (builds dist/ automatically)
docker build -t mutual-funds-backend .

# Run container
docker run -d \
  -p 3002:3002 \
  --name backend-api \
  --restart unless-stopped \
  -e DATABASE_URL="your_mongodb_connection_string_here" \
  -e JWT_SECRET="your_jwt_secret_here" \
  -e PORT=3002 \
  -e NODE_ENV=production \
  mutual-funds-backend

# Check logs
docker logs -f backend-api
```

---

## 📊 What Gets Built?

When you run `npm run build`, it creates:

```
dist/
├── api/
│   ├── controllers/
│   ├── routes/
│   └── index.js
├── src/
│   ├── controllers/
│   ├── services/
│   ├── routes/
│   ├── middleware/
│   ├── models/
│   ├── scripts/
│   ├── workers/
│   ├── jobs/
│   └── app.js          ← Main entry point
└── ...
```

**Total: ~206 JavaScript files** (compiled from TypeScript)

---

## 🔍 Troubleshooting

### ❌ "Cannot find module './app'"

**Cause:** `dist/` folder not created  
**Solution:** Run `npm run build`

### ❌ "Prisma Client not found"

**Cause:** `prisma generate` not run  
**Solution:** Run `npm run build` (includes prisma generate)

### ❌ Build fails with "DATABASE_URL not found"

**Cause:** `.env` file missing  
**Solution:** Create `.env` file (Step 3 above)

### ❌ "Permission denied" when running commands

**Cause:** Need sudo or user permissions  
**Solution:** Use `sudo` or add user to docker group

---

## 📝 Summary Checklist

Before deploying to AWS, ensure:

- [ ] `.gitignore` has `dist/` (so it's not committed)
- [ ] `.gitignore` has `.env` (so secrets aren't committed)
- [ ] `package.json` has build script: `"build": "prisma generate && tsc"`
- [ ] `tsconfig.json` has `"outDir": "./dist"`
- [ ] Your deployment script includes `npm run build`
- [ ] Environment variables are set on AWS (via .env or environment)

---

## 🎯 Key Takeaway

**NEVER commit `dist/` to git!**  
**ALWAYS build on the deployment server!**

```
Local:  Code → Build → Run
AWS:    Clone → Build → Run
         ↑
   (This step is missing in your current setup)
```

---

## 📚 Additional Resources

- [AWS EC2 Setup Guide](AWS_FREE_TIER_DEPLOYMENT_GUIDE.md)
- [Docker Deployment](https://docs.docker.com/get-started/)
- [PM2 Process Manager](https://pm2.keymetrics.io/docs/usage/quick-start/)
