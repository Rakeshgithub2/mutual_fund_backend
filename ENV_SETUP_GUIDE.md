# 🔐 Production Environment Setup

## Quick Start

**Copy `.env.production.complete` to your server as `.env`**

```bash
# On your local machine
scp .env.production.complete ubuntu@your-ec2-ip:/home/ubuntu/mutual-funds-backend/.env

# On your server
cd /home/ubuntu/mutual-funds-backend
nano .env  # Edit and replace placeholder values
```

---

## 🔑 Required API Keys & Services

### 1. MongoDB Atlas (Database)

- **Free tier:** 512MB storage
- **Get from:** https://cloud.mongodb.com/
- **Setup:**
  1. Create cluster
  2. Create database user
  3. Whitelist IP (0.0.0.0/0 for AWS)
  4. Get connection string
- **Paste into:** `DATABASE_URL`

### 2. Redis (Caching - CRITICAL)

- **Upstash (Recommended for AWS):**
  - Free: 10,000 commands/day
  - Get from: https://console.upstash.com/redis
  - Setup: Create database → Copy Redis URL
  - Paste into: `REDIS_URL`

- **Redis Labs (Alternative):**
  - Free: 30MB storage
  - Get from: https://redis.com/try-free/
  - Paste into: `REDIS_URL`

### 3. Google OAuth (User Login)

- **Get from:** https://console.cloud.google.com/apis/credentials
- **Setup:**
  1. Create project
  2. Configure OAuth consent screen
  3. Create OAuth 2.0 Client ID
  4. Add authorized origins: `https://your-backend.com`
  5. Add redirect URI: `https://your-backend.com/api/auth/google/callback`
- **Paste into:** `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`

### 4. RapidAPI - Yahoo Finance (Market Data)

- **Free tier:** 500 requests/month
- **Paid:** $9.99/month for 10,000 requests
- **Get from:** https://rapidapi.com/apidojo/api/yahoo-finance1
- **Setup:** Subscribe → Copy API key
- **Paste into:** `RAPIDAPI_KEY`

### 5. Resend (Email Service)

- **Free tier:** 3,000 emails/month, 100/day
- **Get from:** https://resend.com/api-keys
- **Setup:** Create API key → Verify domain (optional)
- **Paste into:** `RESEND_API_KEY`

### 6. NewsData.io (News Feed)

- **Free tier:** 200 requests/day
- **Get from:** https://newsdata.io/api-key
- **Setup:** Create account → Copy API key
- **Paste into:** `NEWSDATA_API_KEY`

### 7. Google Gemini AI (Chatbot)

- **Free tier:** 60 requests/minute, 1500/day
- **Get from:** https://makersuite.google.com/app/apikey
- **Setup:** Create API key
- **Paste into:** `GEMINI_API_KEY`

### 8. JWT Secrets (Security)

- **Generate on server:**
  ```bash
  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
  ```
- **Run twice** to get two different secrets
- **Paste into:** `JWT_SECRET` and `JWT_REFRESH_SECRET`
- **CRITICAL:** Never reuse development secrets

---

## 📋 Environment Variables Checklist

Copy this checklist and mark as you complete each:

```
[ ] DATABASE_URL - MongoDB Atlas connection string
[ ] JWT_SECRET - Generated 64-char hex string (NEW, not from dev)
[ ] JWT_REFRESH_SECRET - Different 64-char hex string
[ ] REDIS_URL - Upstash or Redis Labs connection
[ ] GOOGLE_CLIENT_ID - OAuth client ID
[ ] GOOGLE_CLIENT_SECRET - OAuth client secret
[ ] RAPIDAPI_KEY - Yahoo Finance API key
[ ] RESEND_API_KEY - Email service API key
[ ] NEWSDATA_API_KEY - News API key
[ ] GEMINI_API_KEY - Google AI API key
[ ] FRONTEND_URL - Your deployed frontend URL
[ ] ALLOWED_ORIGINS - Same as frontend URL
[ ] FROM_EMAIL - Your email for sending (noreply@yourdomain.com)
[ ] ADMIN_EMAIL - Your admin email
```

---

## 🧪 Testing After Setup

### 1. Test backend health:

```bash
curl http://localhost:3002/api/health
```

Expected:

```json
{
  "status": "ok",
  "redis": "connected",
  "mongodb": "connected"
}
```

### 2. Test optimized fund loading:

```bash
node test-optimized-loading.js
```

Expected:

```
✅ Quick Load (500): < 500ms
✅ Batch Load (500): < 500ms
✅ ALL TESTS PASSED
```

### 3. Test specific endpoint:

```bash
curl http://localhost:3002/api/funds/quick
```

Expected:

```json
{
  "success": true,
  "data": [...500 funds...],
  "hasMore": true
}
```

---

## 🚨 Common Issues

### "Connection refused" or "ECONNREFUSED"

- **Redis not connected**
- Fix: Check `REDIS_URL` is correct
- Verify: `redis-cli ping` should return `PONG`

### "JWT secret not configured"

- **JWT_SECRET missing or invalid**
- Fix: Generate new secret with crypto command above

### "Google OAuth error"

- **Redirect URI mismatch**
- Fix: Add exact redirect URI to Google Console

### "Timeout errors still happening"

- **Redis not caching properly**
- Fix: Clear cache with `redis-cli FLUSHDB`
- Verify Redis connection in health check

---

## 🔒 Security Checklist

```
[ ] Generated NEW JWT secrets (not from development)
[ ] MongoDB IP whitelist configured
[ ] Redis password set (if using Redis Labs)
[ ] Google OAuth redirect URIs restricted to your domain
[ ] NODE_ENV set to 'production'
[ ] .env file NOT committed to Git
[ ] .env file has restricted permissions (chmod 600)
[ ] Backup of .env stored securely
```

---

## 📊 Cost Estimate (Free Tier)

All services below are **FREE** for small-medium traffic:

| Service       | Free Tier        | Sufficient For             |
| ------------- | ---------------- | -------------------------- |
| MongoDB Atlas | 512MB            | ~50K funds + user data     |
| Upstash Redis | 10K commands/day | ~5K users/day              |
| Google OAuth  | Unlimited        | ✓                          |
| RapidAPI      | 500 req/month    | ~16 market updates/day     |
| Resend        | 3K emails/month  | ~100 users/day             |
| NewsData      | 200 req/day      | 2-3 news updates/day       |
| Gemini AI     | 1500 req/day     | ~50 chat conversations/day |

**Total monthly cost: $0** (within free tiers)

---

## 📞 Need Help?

1. Check logs: `pm2 logs backend`
2. Check errors: `pm2 show backend`
3. Test endpoints: Run `test-optimized-loading.js`
4. Check Redis: `redis-cli ping`
5. Check MongoDB: Test connection in Atlas dashboard

---

**🎯 Once all checkboxes are complete, your backend is production-ready!**
