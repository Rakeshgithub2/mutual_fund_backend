# Quick Production Testing Checklist

**Production URL:** http://13.60.156.3:3002  
**Date:** February 7, 2026

---

## ✅ QUICK VERIFICATION - Use Browser or cURL

### 1. Basic Health

- [ ] http://13.60.156.3:3002/health → `{"status":"healthy"}`
- [ ] http://13.60.156.3:3002/api/status → Server info

### 2. Funds API (Public)

- [ ] http://13.60.156.3:3002/api/funds → 14,225 funds
- [ ] http://13.60.156.3:3002/api/funds?query=hdfc → Search results
- [ ] http://13.60.156.3:3002/api/funds?category=equity → Filtered results
- [ ] http://13.60.156.3:3002/api/funds/categories → Category list

### 3. Market Data (Public)

- [ ] http://13.60.156.3:3002/api/market → All indices
- [ ] http://13.60.156.3:3002/api/market/nifty50 → NIFTY 50 data

### 4. Authentication (Use Postman/cURL)

- [ ] POST /api/auth/register → New user created + token
- [ ] POST /api/auth/login → Returns access token
- [ ] GET /api/auth/me (with token) → Current user data
- [ ] POST /api/auth/refresh → New access token
- [ ] POST /api/auth/logout → Success message

### 5. Comparison (Public)

- [ ] POST /api/compare → Fund comparison data
- [ ] POST /api/overlap → Overlap percentage

### 6. Watchlist (Protected - needs token)

- [ ] GET /api/watchlist/:userId → User's watchlist
- [ ] POST /api/watchlist → Add fund
- [ ] DELETE /api/watchlist/:userId/:fundId → Remove fund
- [ ] GET /api/watchlist/:userId/check/:fundId → Check status

### 7. Portfolio (Protected - needs token)

- [ ] GET /api/portfolio/:userId → User portfolio
- [ ] POST /api/portfolio → Add investment
- [ ] PUT /api/portfolio/:investmentId → Update investment
- [ ] DELETE /api/portfolio/:investmentId → Remove investment
- [ ] GET /api/portfolio/:userId/performance → Returns & XIRR

### 8. Goals (Protected - needs token)

- [ ] GET /api/goals?userId=:userId → User goals
- [ ] POST /api/goals → Create goal
- [ ] PUT /api/goals/:goalId → Update goal
- [ ] DELETE /api/goals/:goalId → Delete goal

### 9. Reminders (Protected - needs token)

- [ ] GET /api/reminders?userId=:userId → User reminders
- [ ] POST /api/reminders → Create reminder
- [ ] PUT /api/reminders/:reminderId → Update reminder
- [ ] DELETE /api/reminders/:reminderId → Delete reminder

### 10. Rankings (Public)

- [ ] http://13.60.156.3:3002/api/rankings/top → Top funds
- [ ] http://13.60.156.3:3002/api/rankings/category/equity → Top equity

### 11. Calculators (Public)

- [ ] POST /api/calculator/sip → SIP calculation
- [ ] POST /api/calculator/lumpsum → Lumpsum calculation
- [ ] POST /api/calculator/swp → SWP calculation

### 12. News (Public)

- [ ] http://13.60.156.3:3002/api/news → Latest news

### 13. Search (Public)

- [ ] http://13.60.156.3:3002/api/search?q=hdfc → Search results
- [ ] POST /api/search/advanced → Filtered search

### 14. User Profile (Protected - needs token)

- [ ] GET /api/users/:userId → User profile
- [ ] PUT /api/users/:userId → Update profile
- [ ] PUT /api/users/:userId/preferences → Update preferences

### 15. AMC (Public)

- [ ] http://13.60.156.3:3002/api/amc → All AMCs
- [ ] http://13.60.156.3:3002/api/amc/:amcId → AMC details

---

## 📊 Expected Results Summary

| Category    | Endpoints | Status | Notes                     |
| ----------- | --------- | ------ | ------------------------- |
| Health      | 2         | ✅     | Must work                 |
| Auth        | 6         | ⚠️     | Fixed - test after deploy |
| Funds       | 5+        | ✅     | 14,225 funds confirmed    |
| Market      | 3         | ✅     | 11+ indices               |
| Compare     | 2         | ⏳     | To test                   |
| Watchlist   | 4         | ⏳     | Needs auth                |
| Portfolio   | 5         | ⏳     | Needs auth                |
| Goals       | 4         | ⏳     | Needs auth                |
| Reminders   | 4         | ⏳     | Needs auth                |
| Rankings    | 3         | ⏳     | To test                   |
| Calculators | 3         | ⏳     | To test                   |
| News        | 2         | ⏳     | To test                   |
| Search      | 2         | ⏳     | To test                   |
| Profile     | 3         | ⏳     | Needs auth                |
| AMC         | 2         | ⏳     | To test                   |

**Legend:**

- ✅ Tested & Working
- ⚠️ Fixed, pending deployment
- ⏳ Awaiting testing
- ❌ Failed
- ⚪ Skipped

---

## 🚀 AUTOMATED TESTING

### Option 1: PowerShell Script (Windows)

```powershell
cd "c:\MF root folder\mutual-funds-backend"
.\test-production.ps1
```

**Result:** Tests all endpoints automatically, shows summary

### Option 2: Interactive HTML Tester

1. Open `api-tester.html` in browser
2. Click through each tab
3. Test endpoints with UI

### Option 3: Manual Browser Testing

Just visit these URLs in your browser:

1. http://13.60.156.3:3002/health
2. http://13.60.156.3:3002/api/funds
3. http://13.60.156.3:3002/api/market
4. http://13.60.156.3:3002/api/rankings/top

---

## 🔧 DEPLOYMENT STEPS

### 1. Build Locally

```powershell
cd "c:\MF root folder\mutual-funds-backend"
npm run build
```

### 2. Package

```powershell
Compress-Archive -Path dist\* -DestinationPath dist.zip -Force
```

### 3. Upload to EC2

```powershell
scp -i YOUR_KEY.pem dist.zip ubuntu@13.60.156.3:~/mutual_fund_backend/
```

### 4. Deploy on Server

```bash
ssh -i YOUR_KEY.pem ubuntu@13.60.156.3
cd ~/mutual_fund_backend
rm -rf dist
unzip -o dist.zip
pm2 restart all
pm2 logs --lines 20
```

### 5. Test Registration

```bash
curl -X POST http://localhost:3002/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"Test123!","name":"Test User"}'
```

**Expected:** `{"success":true, ... "accessToken":"..."}`

---

## 🐛 TROUBLESHOOTING

### Auth returns "User.findOne is not a function"

**Fixed!** Old JS file was overwriting compiled TypeScript.

- Deleted: `src/controllers/auth.controller.js`
- Rebuild and redeploy

### Check PM2 Status

```bash
ssh ubuntu@13.60.156.3 "pm2 status"
```

### Check PM2 Logs

```bash
ssh ubuntu@13.60.156.3 "pm2 logs --lines 50"
```

### Restart PM2

```bash
ssh ubuntu@13.60.156.3 "pm2 restart all"
```

### Check MongoDB Connection

- Look for "✅ MongoDB Connected" in logs
- Verify 14,225 funds: http://13.60.156.3:3002/api/funds

---

## 📝 NOTES

**Build Issue Fixed:**

- Problem: `copy-js-files.js` was copying old `.js` files from `src/` to `dist/`, overwriting compiled TypeScript
- Solution: Deleted old `auth.controller.js` from `src/controllers/`
- Status: Ready for deployment

**Database Status:**

- Total funds: 14,225
- Field: `status: "Active"` (not `isActive: true`)
- All queries updated to use correct field

**Authentication:**

- JWT tokens (15 min expiry)
- Refresh tokens (7 days)
- bcrypt password hashing (12 rounds)
- Google OAuth supported

---

**Next Steps:**

1. ✅ Build completed successfully
2. ⏳ Deploy dist.zip to EC2 (need SSH key)
3. ⏳ Run automated test script
4. ⏳ Verify all endpoints working

**Files Created:**

- ✅ `PRODUCTION_TESTING_CHECKLIST.md` - Full documentation
- ✅ `test-production.ps1` - Automated testing script
- ✅ `TESTING_QUICK_CHECKLIST.md` - This file (quick reference)
- ✅ `api-tester.html` - Interactive web tester (already exists)
