# Production Testing Checklist

## API Endpoint Verification for http://13.60.156.3:3002

---

## 1. ✅ Health & Status Endpoints

### 1.1 Health Check

```bash
curl http://13.60.156.3:3002/health
```

**Expected:** `200 OK` with `{"status": "healthy"}`

### 1.2 API Status

```bash
curl http://13.60.156.3:3002/api/status
```

**Expected:** System information with uptime

---

## 2. 🔐 Authentication Endpoints

### 2.1 Register New User

```bash
curl -X POST http://13.60.156.3:3002/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test_'$(date +%s)'@example.com",
    "password": "Test123!@",
    "name": "Test User"
  }'
```

**Expected:** `201 Created` with user object + `accessToken`
**Save:** Copy the `accessToken` from response

### 2.2 Login

```bash
curl -X POST http://13.60.156.3:3002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@"
  }'
```

**Expected:** `200 OK` with user + `accessToken`

### 2.3 Get Current User (Protected)

```bash
curl http://13.60.156.3:3002/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected:** `200 OK` with current user data

### 2.4 Refresh Token

```bash
curl -X POST http://13.60.156.3:3002/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "YOUR_REFRESH_TOKEN"
  }'
```

**Expected:** `200 OK` with new `accessToken`

### 2.5 Logout (Protected)

```bash
curl -X POST http://13.60.156.3:3002/api/auth/logout \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected:** `200 OK` with logout confirmation

### 2.6 Google OAuth

```bash
curl -X POST http://13.60.156.3:3002/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{
    "idToken": "GOOGLE_ID_TOKEN"
  }'
```

**Expected:** `200 OK` with user + tokens

---

## 3. 💰 Funds Endpoints

### 3.1 Get All Funds (Paginated)

```bash
curl "http://13.60.156.3:3002/api/funds?page=1&limit=20"
```

**Expected:** `200 OK` with 14,225 total funds, paginated list
**Browser:** [http://13.60.156.3:3002/api/funds](http://13.60.156.3:3002/api/funds)

### 3.2 Search Funds by Query

```bash
curl "http://13.60.156.3:3002/api/funds?query=hdfc&limit=10"
```

**Expected:** Funds matching "hdfc"
**Browser:** [http://13.60.156.3:3002/api/funds?query=hdfc](http://13.60.156.3:3002/api/funds?query=hdfc)

### 3.3 Filter by Category

```bash
curl "http://13.60.156.3:3002/api/funds?category=equity&limit=20"
```

**Expected:** Only equity funds
**Browser:** [http://13.60.156.3:3002/api/funds?category=equity](http://13.60.156.3:3002/api/funds?category=equity)

### 3.4 Get Fund Details by ID

```bash
curl "http://13.60.156.3:3002/api/funds/12345"
```

**Expected:** `200 OK` with complete fund details
**Replace:** `12345` with actual fund ID

### 3.5 Get Fund Details by Scheme Code

```bash
curl "http://13.60.156.3:3002/api/funds/scheme/119551"
```

**Expected:** `200 OK` with fund details

### 3.6 Top Performing Funds

```bash
curl "http://13.60.156.3:3002/api/funds/top?category=equity&limit=10"
```

**Expected:** Top 10 equity funds by returns

### 3.7 Fund Categories

```bash
curl "http://13.60.156.3:3002/api/funds/categories"
```

**Expected:** List of all fund categories
**Browser:** [http://13.60.156.3:3002/api/funds/categories](http://13.60.156.3:3002/api/funds/categories)

---

## 4. 📊 Comparison & Analysis

### 4.1 Compare Multiple Funds

```bash
curl -X POST http://13.60.156.3:3002/api/compare \
  -H "Content-Type: application/json" \
  -d '{
    "fundIds": ["fund_id_1", "fund_id_2", "fund_id_3"]
  }'
```

**Expected:** `200 OK` with side-by-side comparison

### 4.2 Portfolio Overlap Analysis

```bash
curl -X POST http://13.60.156.3:3002/api/overlap \
  -H "Content-Type: application/json" \
  -d '{
    "fundIds": ["fund_id_1", "fund_id_2"]
  }'
```

**Expected:** `200 OK` with overlap percentage + common holdings

### 4.3 Fund Overlap by Scheme Codes

```bash
curl -X POST http://13.60.156.3:3002/api/comparison/overlap \
  -H "Content-Type: application/json" \
  -d '{
    "schemeCodes": ["119551", "120503"]
  }'
```

**Expected:** Detailed overlap analysis

---

## 5. 👤 Watchlist (Protected Routes)

### 5.1 Get User Watchlist

```bash
curl http://13.60.156.3:3002/api/watchlist/:userId \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected:** `200 OK` with list of watched funds

### 5.2 Add Fund to Watchlist

```bash
curl -X POST http://13.60.156.3:3002/api/watchlist \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "YOUR_USER_ID",
    "fundId": "fund_id_123"
  }'
```

**Expected:** `201 Created` with updated watchlist

### 5.3 Remove Fund from Watchlist

```bash
curl -X DELETE http://13.60.156.3:3002/api/watchlist/:userId/:fundId \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected:** `200 OK` confirmation

### 5.4 Check if Fund is Watched

```bash
curl http://13.60.156.3:3002/api/watchlist/:userId/check/:fundId \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected:** `{"isWatched": true/false}`

---

## 6. 💼 Portfolio (Protected Routes)

### 6.1 Get User Portfolio

```bash
curl http://13.60.156.3:3002/api/portfolio/:userId \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected:** `200 OK` with portfolio holdings

### 6.2 Add Investment to Portfolio

```bash
curl -X POST http://13.60.156.3:3002/api/portfolio \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "YOUR_USER_ID",
    "fundId": "fund_id_123",
    "units": 100,
    "investedAmount": 50000,
    "purchaseDate": "2024-01-15"
  }'
```

**Expected:** `201 Created` with transaction details

### 6.3 Update Investment

```bash
curl -X PUT http://13.60.156.3:3002/api/portfolio/:investmentId \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "units": 150,
    "investedAmount": 75000
  }'
```

**Expected:** `200 OK` with updated investment

### 6.4 Delete Investment

```bash
curl -X DELETE http://13.60.156.3:3002/api/portfolio/:investmentId \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected:** `200 OK` confirmation

### 6.5 Portfolio Performance

```bash
curl http://13.60.156.3:3002/api/portfolio/:userId/performance \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected:** Overall returns, gain/loss, XIRR

---

## 7. 🎯 Goals (Protected Routes)

### 7.1 Get User Goals

```bash
curl http://13.60.156.3:3002/api/goals?userId=YOUR_USER_ID \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected:** `200 OK` with list of goals

### 7.2 Create New Goal

```bash
curl -X POST http://13.60.156.3:3002/api/goals \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "YOUR_USER_ID",
    "name": "Retirement Fund",
    "targetAmount": 5000000,
    "targetDate": "2045-12-31",
    "currentAmount": 500000
  }'
```

**Expected:** `201 Created` with goal object

### 7.3 Update Goal

```bash
curl -X PUT http://13.60.156.3:3002/api/goals/:goalId \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "currentAmount": 750000
  }'
```

**Expected:** `200 OK` with updated goal

### 7.4 Delete Goal

```bash
curl -X DELETE http://13.60.156.3:3002/api/goals/:goalId \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected:** `200 OK` confirmation

---

## 8. ⏰ Reminders (Protected Routes)

### 8.1 Get User Reminders

```bash
curl http://13.60.156.3:3002/api/reminders?userId=YOUR_USER_ID \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected:** `200 OK` with list of reminders

### 8.2 Create Reminder

```bash
curl -X POST http://13.60.156.3:3002/api/reminders \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "YOUR_USER_ID",
    "title": "Review Portfolio",
    "description": "Monthly portfolio review",
    "reminderDate": "2026-03-01T10:00:00Z",
    "frequency": "monthly"
  }'
```

**Expected:** `201 Created` with reminder object

### 8.3 Update Reminder

```bash
curl -X PUT http://13.60.156.3:3002/api/reminders/:reminderId \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "completed": true
  }'
```

**Expected:** `200 OK` with updated reminder

### 8.4 Delete Reminder

```bash
curl -X DELETE http://13.60.156.3:3002/api/reminders/:reminderId \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected:** `200 OK` confirmation

---

## 9. 📈 Market Indices

### 9.1 Get All Market Indices

```bash
curl http://13.60.156.3:3002/api/market
```

**Expected:** `200 OK` with NIFTY50, SENSEX, etc.
**Browser:** [http://13.60.156.3:3002/api/market](http://13.60.156.3:3002/api/market)

### 9.2 Get Specific Index

```bash
curl http://13.60.156.3:3002/api/market/nifty50
```

**Expected:** `200 OK` with NIFTY 50 data
**Browser:** [http://13.60.156.3:3002/api/market/nifty50](http://13.60.156.3:3002/api/market/nifty50)

### 9.3 Get Historical Data

```bash
curl "http://13.60.156.3:3002/api/market/nifty50/history?days=30"
```

**Expected:** Historical price data for last 30 days

---

## 10. 🏆 Rankings

### 10.1 Top Funds Overall

```bash
curl "http://13.60.156.3:3002/api/rankings/top?limit=20"
```

**Expected:** Top 20 funds by performance
**Browser:** [http://13.60.156.3:3002/api/rankings/top](http://13.60.156.3:3002/api/rankings/top)

### 10.2 Top Funds by Category

```bash
curl "http://13.60.156.3:3002/api/rankings/category/equity?limit=10"
```

**Expected:** Top 10 equity funds

### 10.3 Best Performers (1Y, 3Y, 5Y)

```bash
curl "http://13.60.156.3:3002/api/rankings/performers?period=1Y&limit=20"
```

**Expected:** Best performers for specified period

---

## 11. 📰 News & Updates

### 11.1 Get Latest News

```bash
curl http://13.60.156.3:3002/api/news
```

**Expected:** `200 OK` with latest mutual fund news
**Browser:** [http://13.60.156.3:3002/api/news](http://13.60.156.3:3002/api/news)

### 11.2 Get Fund-Specific News

```bash
curl http://13.60.156.3:3002/api/news/fund/:fundId
```

**Expected:** News related to specific fund

---

## 12. 🧮 Calculators

### 12.1 SIP Calculator

```bash
curl -X POST http://13.60.156.3:3002/api/calculator/sip \
  -H "Content-Type: application/json" \
  -d '{
    "monthlyInvestment": 10000,
    "expectedReturn": 12,
    "timePeriod": 10
  }'
```

**Expected:** Future value, total invested, returns

### 12.2 Lumpsum Calculator

```bash
curl -X POST http://13.60.156.3:3002/api/calculator/lumpsum \
  -H "Content-Type: application/json" \
  -d '{
    "investment": 100000,
    "expectedReturn": 12,
    "timePeriod": 10
  }'
```

**Expected:** Future value, total invested, returns

### 12.3 SWP Calculator

```bash
curl -X POST http://13.60.156.3:3002/api/calculator/swp \
  -H "Content-Type: application/json" \
  -d '{
    "investment": 1000000,
    "withdrawalAmount": 10000,
    "expectedReturn": 10,
    "timePeriod": 10
  }'
```

**Expected:** Final corpus, total withdrawn

---

## 13. 📝 User Profile (Protected)

### 13.1 Get User Profile

```bash
curl http://13.60.156.3:3002/api/users/:userId \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected:** `200 OK` with complete user profile

### 13.2 Update Profile

```bash
curl -X PUT http://13.60.156.3:3002/api/users/:userId \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Name",
    "phone": "+91-9876543210"
  }'
```

**Expected:** `200 OK` with updated profile

### 13.3 Update Preferences

```bash
curl -X PUT http://13.60.156.3:3002/api/users/:userId/preferences \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "emailNotifications": true,
    "theme": "dark",
    "language": "en"
  }'
```

**Expected:** `200 OK` with updated preferences

---

## 14. 🔍 Search

### 14.1 Global Search

```bash
curl "http://13.60.156.3:3002/api/search?q=hdfc%20tax%20saver"
```

**Expected:** Funds, AMCs, categories matching query

### 14.2 Advanced Search

```bash
curl -X POST http://13.60.156.3:3002/api/search/advanced \
  -H "Content-Type: application/json" \
  -d '{
    "category": "equity",
    "subCategory": "large cap",
    "minReturn1Y": 15,
    "maxExpenseRatio": 1.5,
    "minAUM": 1000
  }'
```

**Expected:** Filtered funds matching criteria

---

## 15. 🏢 AMC (Asset Management Companies)

### 15.1 Get All AMCs

```bash
curl http://13.60.156.3:3002/api/amc
```

**Expected:** List of all AMCs
**Browser:** [http://13.60.156.3:3002/api/amc](http://13.60.156.3:3002/api/amc)

### 15.2 Get AMC Details

```bash
curl http://13.60.156.3:3002/api/amc/:amcId
```

**Expected:** AMC details + fund list

---

## Testing Script

Create a file `test-all-endpoints.sh` (Linux/Mac) or `test-all-endpoints.ps1` (Windows):

### PowerShell Version:

```powershell
# Set base URL
$BASE_URL = "http://13.60.156.3:3002"
$TOKEN = ""

# Color output functions
function Write-Success { Write-Host "✅ $args" -ForegroundColor Green }
function Write-Error { Write-Host "❌ $args" -ForegroundColor Red }
function Write-Info { Write-Host "📋 $args" -ForegroundColor Cyan }

# Test health
Write-Info "Testing Health Check..."
$response = Invoke-WebRequest -Uri "$BASE_URL/health" -Method GET
if ($response.StatusCode -eq 200) { Write-Success "Health check passed" }
else { Write-Error "Health check failed" }

# Test register
Write-Info "Testing User Registration..."
$registerData = @{
    email = "test_$(Get-Date -Format 'yyyyMMddHHmmss')@example.com"
    password = "Test123!@"
    name = "Test User"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "$BASE_URL/api/auth/register" -Method POST -Body $registerData -ContentType "application/json"
if ($response.success) {
    Write-Success "Registration successful"
    $TOKEN = $response.data.tokens.accessToken
    Write-Host "Token: $TOKEN"
} else {
    Write-Error "Registration failed"
}

# Test funds API
Write-Info "Testing Funds API..."
$response = Invoke-RestMethod -Uri "$BASE_URL/api/funds?limit=10" -Method GET
if ($response.totalFunds -gt 14000) { Write-Success "Funds API: $($response.totalFunds) funds" }
else { Write-Error "Funds API failed" }

# Test market indices
Write-Info "Testing Market Indices..."
$response = Invoke-RestMethod -Uri "$BASE_URL/api/market" -Method GET
if ($response.Count -gt 0) { Write-Success "Market indices: $($response.Count) indices" }
else { Write-Error "Market indices failed" }

# Test with authentication
if ($TOKEN) {
    Write-Info "Testing Protected Routes..."
    $headers = @{ Authorization = "Bearer $TOKEN" }

    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/api/auth/me" -Method GET -Headers $headers
        Write-Success "Auth verification passed"
    } catch {
        Write-Error "Auth verification failed"
    }
}

Write-Host "`n🎉 Testing complete!" -ForegroundColor Yellow
```

Save this as `test-production.ps1` and run:

```powershell
cd "c:\MF root folder\mutual-funds-backend"
.\test-production.ps1
```

---

## Quick Test Checklist

- [ ] Health check returns 200
- [ ] User registration creates new user
- [ ] Login returns valid token
- [ ] Protected routes require auth token
- [ ] Funds API returns 14,225 funds
- [ ] Fund search works correctly
- [ ] Category filtering works
- [ ] Comparison endpoint works
- [ ] Overlap analysis works
- [ ] Watchlist CRUD operations work
- [ ] Portfolio CRUD operations work
- [ ] Goals CRUD operations work
- [ ] Reminders CRUD operations work
- [ ] Market indices update correctly
- [ ] Rankings display properly
- [ ] Calculators return correct values
- [ ] News endpoints work
- [ ] Search returns relevant results

---

## Automated Testing

For comprehensive testing, use the interactive HTML tester:
**File:** `api-tester.html` (already created)
**Open in browser** and test all endpoints with a UI

---

## Common Issues & Solutions

### Issue: 401 Unauthorized

**Solution:** Include valid `Authorization: Bearer TOKEN` header

### Issue: 404 Not Found

**Solution:** Check endpoint path and method (GET/POST/PUT/DELETE)

### Issue: 500 Internal Server Error

**Solution:** Check PM2 logs: `ssh ubuntu@13.60.156.3 "pm2 logs --lines 50"`

### Issue: CORS errors (browser)

**Solution:** Verify CORS is enabled for frontend domain

---

## Deployment Command

```powershell
# On your local machine:
cd "c:\MF root folder\mutual-funds-backend"
npm run build
Compress-Archive -Path dist\* -DestinationPath dist.zip -Force

# Upload (replace with your key path):
scp -i YOUR_KEY.pem dist.zip ubuntu@13.60.156.3:~/mutual_fund_backend/

# Deploy on server:
ssh -i YOUR_KEY.pem ubuntu@13.60.156.3
cd ~/mutual_fund_backend
rm -rf dist
unzip -o dist.zip
pm2 restart all
pm2 logs --lines 20
```

---

**Last Updated:** February 7, 2026
**Production URL:** http://13.60.156.3:3002
**Total Endpoints:** 50+
**Database:** MongoDB Atlas (14,225 funds)
