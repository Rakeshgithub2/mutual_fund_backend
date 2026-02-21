# 🚀 Complete API Endpoint Testing Guide

**Base URL (Production):** `http://13.60.156.3:3002`  
**Base URL (Local):** `http://localhost:3002`

---

## ✅ Health & Status

```bash
GET  http://13.60.156.3:3002/health
GET  http://13.60.156.3:3002/api/test
```

---

## 🔐 Authentication Endpoints

```bash
# Register new user
POST http://13.60.156.3:3002/api/auth/register
Body: {"email": "test@example.com", "password": "Test123!", "name": "Test User"}

# Login with email/password
POST http://13.60.156.3:3002/api/auth/login
Body: {"email": "test@example.com", "password": "Test123!"}

# Google OAuth
POST http://13.60.156.3:3002/api/auth/google
Body: {"idToken": "google_id_token_here"}

# Logout
POST http://13.60.156.3:3002/api/auth/logout
Headers: {"Authorization": "Bearer <token>"}

# Refresh token
POST http://13.60.156.3:3002/api/auth/refresh
Body: {"refreshToken": "refresh_token_here"}

# Get current user profile
GET  http://13.60.156.3:3002/api/auth/me
Headers: {"Authorization": "Bearer <token>"}
```

---

## 💰 Funds Endpoints (Main)

```bash
# Get all funds (with pagination)
GET  http://13.60.156.3:3002/api/funds?page=1&limit=20

# Search funds by name (HDFC, ICICI, etc.)
GET  http://13.60.156.3:3002/api/funds?query=hdfc&limit=10
GET  http://13.60.156.3:3002/api/funds?query=icici&limit=10

# Filter by category
GET  http://13.60.156.3:3002/api/funds?category=equity&limit=20
GET  http://13.60.156.3:3002/api/funds?category=debt&limit=20
GET  http://13.60.156.3:3002/api/funds?category=hybrid&limit=20

# Filter by subcategory
GET  http://13.60.156.3:3002/api/funds?subCategory=Large%20Cap&limit=20
GET  http://13.60.156.3:3002/api/funds?subCategory=Mid%20Cap&limit=20

# Top performers
GET  http://13.60.156.3:3002/api/funds?top=20
GET  http://13.60.156.3:3002/api/funds?top=50

# Get single fund by ID
GET  http://13.60.156.3:3002/api/funds/:fundId

# Get fund details with holdings
GET  http://13.60.156.3:3002/api/funds/:fundId/details

# Get fund NAV history
GET  http://13.60.156.3:3002/api/funds/:fundId/nav?period=1Y
GET  http://13.60.156.3:3002/api/funds/:fundId/nav?period=5Y

# Get fund returns
GET  http://13.60.156.3:3002/api/funds/:fundId/returns

# Get fund holdings
GET  http://13.60.156.3:3002/api/funds/:fundId/holdings
```

---

## 🔍 Search & Suggestions

```bash
# Autocomplete suggestions
GET  http://13.60.156.3:3002/api/suggest?q=hdfc

# Full-text search
GET  http://13.60.156.3:3002/api/search?q=hdfc%20equity&category=equity
```

---

## 👁️ Watchlist Endpoints

```bash
# Get user watchlist
GET  http://13.60.156.3:3002/api/watchlist/:userId
Headers: {"Authorization": "Bearer <token>"}

# Add fund to watchlist
POST http://13.60.156.3:3002/api/watchlist/:userId
Headers: {"Authorization": "Bearer <token>"}
Body: {"fundId": "123456"}

# Remove fund from watchlist
DELETE http://13.60.156.3:3002/api/watchlist/:userId/:fundId
Headers: {"Authorization": "Bearer <token>"}

# Check if fund is in watchlist
GET  http://13.60.156.3:3002/api/watchlist/:userId/check/:fundId
Headers: {"Authorization": "Bearer <token>"}
```

---

## 📊 Portfolio Endpoints

```bash
# Get user portfolio
GET  http://13.60.156.3:3002/api/portfolio/:userId
Headers: {"Authorization": "Bearer <token>"}

# Get portfolio summary
GET  http://13.60.156.3:3002/api/portfolio/:userId/summary
Headers: {"Authorization": "Bearer <token>"}

# Get portfolio transactions
GET  http://13.60.156.3:3002/api/portfolio/:userId/transactions
Headers: {"Authorization": "Bearer <token>"}

# Add transaction
POST http://13.60.156.3:3002/api/portfolio/:userId/transaction
Headers: {"Authorization": "Bearer <token>"}
Body: {
  "fundId": "123456",
  "type": "BUY",
  "amount": 10000,
  "units": 100,
  "nav": 100,
  "date": "2026-02-07"
}

# Update portfolio
PUT  http://13.60.156.3:3002/api/portfolio/:userId/update
Headers: {"Authorization": "Bearer <token>"}
Body: {"fundId": "123456", "units": 150}

# Delete transaction
DELETE http://13.60.156.3:3002/api/portfolio/:userId/transaction/:transactionId
Headers: {"Authorization": "Bearer <token>"}
```

---

## 🔄 Comparison & Overlap Endpoints

```bash
# Compare multiple funds
POST http://13.60.156.3:3002/api/comparison/compare
Body: {
  "fundIds": ["123456", "123457", "123458"]
}

# Check fund overlap (portfolio holdings overlap)
POST http://13.60.156.3:3002/api/comparison/overlap
Body: {
  "fundIds": ["123456", "123457"]
}

# Benchmark comparison
GET  http://13.60.156.3:3002/api/comparison/benchmark/:fundId?benchmark=NIFTY50
```

---

## 🧮 Calculator Endpoints

```bash
# SIP Calculator
POST http://13.60.156.3:3002/api/calculator/sip
Body: {
  "monthlyInvestment": 5000,
  "expectedReturn": 12,
  "timePeriod": 10
}

# Lumpsum Calculator
POST http://13.60.156.3:3002/api/calculator/lumpsum
Body: {
  "investment": 100000,
  "expectedReturn": 12,
  "timePeriod": 5
}

# SWP Calculator
POST http://13.60.156.3:3002/api/calculator/swp
Body: {
  "totalInvestment": 500000,
  "monthlyWithdrawal": 5000,
  "expectedReturn": 8,
  "timePeriod": 10
}

# Goal Calculator
POST http://13.60.156.3:3002/api/calculator/goal
Body: {
  "targetAmount": 1000000,
  "timePeriod": 10,
  "expectedReturn": 12,
  "currentSavings": 50000
}
```

---

## 📰 News & Market Data

```bash
# Get market news
GET  http://13.60.156.3:3002/api/news?limit=10

# Get fund-specific news
GET  http://13.60.156.3:3002/api/news/:fundId

# Get market indices
GET  http://13.60.156.3:3002/api/market-indices
GET  http://13.60.156.3:3002/api/market/indices

# Get specific index data
GET  http://13.60.156.3:3002/api/market-indices/:indexName

# Get index historical data
GET  http://13.60.156.3:3002/api/market-indices/:indexName/history?period=1M
```

---

## 🏆 Rankings & Top Performers

```bash
# Get top performing funds
GET  http://13.60.156.3:3002/api/rankings/top?limit=20

# Get top funds by category
GET  http://13.60.156.3:3002/api/rankings/category/equity?limit=20
GET  http://13.60.156.3:3002/api/rankings/category/debt?limit=20

# Get risk-adjusted rankings
GET  http://13.60.156.3:3002/api/rankings/risk-adjusted?limit=20

# Get trending funds
GET  http://13.60.156.3:3002/api/rankings/trending?limit=10
```

---

## 👤 User Management

```bash
# Get user profile
GET  http://13.60.156.3:3002/api/users/:userId
Headers: {"Authorization": "Bearer <token>"}

# Update user profile
PUT  http://13.60.156.3:3002/api/users/:userId
Headers: {"Authorization": "Bearer <token>"}
Body: {"name": "New Name", "phone": "9876543210"}

# Get user preferences
GET  http://13.60.156.3:3002/api/users/:userId/preferences
Headers: {"Authorization": "Bearer <token>"}

# Update user preferences
PUT  http://13.60.156.3:3002/api/users/:userId/preferences
Headers: {"Authorization": "Bearer <token>"}
Body: {"riskTolerance": "moderate", "investmentGoals": ["retirement", "wealth"]}
```

---

## 🤖 AI & Suggestions

```bash
# AI chat for fund recommendations
POST http://13.60.156.3:3002/api/ai/chat
Body: {
  "message": "Suggest best large cap funds for long term",
  "context": {"riskTolerance": "moderate"}
}

# Get AI suggestions
GET  http://13.60.156.3:3002/api/ai/suggestions

# Knowledge base search
GET  http://13.60.156.3:3002/api/ai/knowledge?q=sip

# Get specific knowledge article
GET  http://13.60.156.3:3002/api/ai/knowledge/:id
```

---

## 📝 KYC & Compliance

```bash
# Get KYC status
GET  http://13.60.156.3:3002/api/kyc/:userId
Headers: {"Authorization": "Bearer <token>"}

# Submit KYC documents
POST http://13.60.156.3:3002/api/kyc/:userId/submit
Headers: {"Authorization": "Bearer <token>"}
Body: {
  "panNumber": "ABCDE1234F",
  "aadhaarNumber": "1234567890",
  "documents": ["base64_string"]
}

# Update KYC status
PUT  http://13.60.156.3:3002/api/kyc/:userId/status
Headers: {"Authorization": "Bearer <token>"}
Body: {"status": "verified"}
```

---

## 📈 Fund Holdings & Sector Allocation

```bash
# Get fund holdings
GET  http://13.60.156.3:3002/api/holdings/:fundId

# Get sector allocation
GET  http://13.60.156.3:3002/api/holdings/:fundId/sectors

# Get top holdings
GET  http://13.60.156.3:3002/api/holdings/:fundId/top?limit=10
```

---

## 💳 Tax & Reports

```bash
# Generate tax report
GET  http://13.60.156.3:3002/api/tax/:userId/report?year=2025
Headers: {"Authorization": "Bearer <token>"}

# Get capital gains
GET  http://13.60.156.3:3002/api/tax/:userId/capital-gains
Headers: {"Authorization": "Bearer <token>"}
```

---

## 🎯 Fund Managers

```bash
# Get all fund managers
GET  http://13.60.156.3:3002/api/fund-managers

# Get specific fund manager
GET  http://13.60.156.3:3002/api/fund-managers/:managerId

# Get funds managed by a manager
GET  http://13.60.156.3:3002/api/fund-managers/:managerId/funds
```

---

## 💬 Feedback & Support

```bash
# Submit feedback
POST http://13.60.156.3:3002/api/feedback
Body: {
  "userId": "user_id_here",
  "type": "bug",
  "message": "Found an issue with fund search"
}

# Get user feedback history
GET  http://13.60.156.3:3002/api/feedback/:userId
Headers: {"Authorization": "Bearer <token>"}
```

---

## 🔧 Admin & Governance

```bash
# Refresh news data
POST http://13.60.156.3:3002/api/admin/refresh/news
Headers: {"Authorization": "Bearer <admin_token>"}

# Check refresh status
GET  http://13.60.156.3:3002/api/admin/refresh/status
Headers: {"Authorization": "Bearer <admin_token>"}

# Data governance report
GET  http://13.60.156.3:3002/api/governance/report

# Check data completeness
GET  http://13.60.156.3:3002/api/governance/completeness/:fundId
```

---

## 🌟 V2 Professional Routes (New Architecture)

```bash
# V2 funds endpoint with enhanced filtering
GET  http://13.60.156.3:3002/api/v2/funds?page=1&limit=20

# V2 fund details with complete data
GET  http://13.60.156.3:3002/api/v2/funds/:fundId
```

---

## 🧪 Testing Quick Commands

### Using cURL:

```bash
# Test health
curl http://13.60.156.3:3002/health

# Test funds API
curl "http://13.60.156.3:3002/api/funds?limit=5"

# Test HDFC search
curl "http://13.60.156.3:3002/api/funds?query=hdfc&limit=5"

# Test with authentication
curl -H "Authorization: Bearer YOUR_TOKEN" http://13.60.156.3:3002/api/watchlist/USER_ID
```

### Using Browser:

Simply paste these URLs in your browser:

```
http://13.60.156.3:3002/health
http://13.60.156.3:3002/api/funds?limit=5
http://13.60.156.3:3002/api/funds?query=hdfc
http://13.60.156.3:3002/api/market-indices
http://13.60.156.3:3002/api/rankings/top?limit=10
```

---

## 📌 Notes

1. **Authentication Required:** Endpoints marked with `Headers: {"Authorization": "Bearer <token>"}` require JWT token
2. **Replace Placeholders:**
   - `:userId` → actual user ID (e.g., `user_abc123`)
   - `:fundId` → actual fund scheme code (e.g., `119551`)
   - `<token>` → JWT token from login response

3. **Query Parameters:**
   - `limit` → number of results (default: 200, max: 500)
   - `page` → page number for pagination (default: 1)
   - `query` → search term for filtering
   - `category` → equity, debt, hybrid, commodity, other
   - `subCategory` → Large Cap, Mid Cap, Small Cap, etc.

4. **Date Formats:** Use ISO 8601 format: `2026-02-07T00:00:00.000Z`

5. **All endpoints return JSON** with structure:

```json
{
  "statusCode": 200,
  "message": "Success message",
  "data": [...],
  "pagination": {...},
  "timestamp": "2026-02-07T10:00:00.000Z"
}
```

---

## 🚀 Priority Testing Order

1. ✅ **Health & Funds** (Already Working)
2. 🔐 **Authentication** - Test login/register
3. 👁️ **Watchlist** - Test add/remove/list
4. 📊 **Portfolio** - Test create/update/delete
5. 🔄 **Comparison** - Test fund comparison
6. 🧮 **Calculators** - Test SIP/Lumpsum
7. 📰 **News** - Test news fetching
8. 🏆 **Rankings** - Test top performers
