# MongoDB Models Documentation

This directory contains MongoDB models for the Mutual Funds application. Each model provides type-safe methods for interacting with MongoDB collections.

## 📁 Models Overview

### 1. **User Model** (`User.model.ts`)

Manages user authentication, profiles, and preferences.

**Key Features:**

- Google OAuth integration
- User preferences (theme, language, risk profile)
- KYC status management
- Subscription handling
- Login history tracking
- Refresh token management

**Usage Example:**

```typescript
import { userModel } from './models';

// Create a new user
const user = await userModel.create({
  userId: 'user_123',
  googleId: 'google_456',
  email: 'user@example.com',
  name: 'John Doe',
  firstName: 'John',
  lastName: 'Doe',
  emailVerified: true,
});

// Find user by email
const foundUser = await userModel.findByEmail('user@example.com');

// Update preferences
await userModel.updatePreferences('user_123', {
  theme: 'dark',
  riskProfile: 'aggressive',
});

// Record login
await userModel.recordLogin('user_123', {
  ip: '192.168.1.1',
  userAgent: 'Mozilla/5.0...',
});
```

---

### 2. **Fund Model** (`Fund.model.ts`)

Manages mutual fund data including NAV, holdings, and performance metrics.

**Key Features:**

- Fund details (NAV, AUM, expense ratio)
- Performance returns (1Y, 3Y, 5Y)
- Risk metrics (Sharpe, Beta, Alpha)
- Holdings and sector allocation
- Full-text search
- Category-based filtering

**Usage Example:**

```typescript
import { fundModel } from './models';

// Create a new fund
const fund = await fundModel.create({
  fundId: 'FUND001',
  name: 'HDFC Top 100 Fund',
  category: 'equity',
  subCategory: 'Large Cap',
  fundType: 'mutual_fund',
  fundHouse: 'HDFC Mutual Fund',
  currentNav: 850.5,
  // ... other fields
});

// Search funds
const results = await fundModel.search('HDFC', {
  category: 'equity',
  limit: 10,
});

// Get top performers
const topFunds = await fundModel.getTopPerformers('threeYear', 10);

// Update NAV
await fundModel.updateNav('FUND001', 855.2, new Date());
```

---

### 3. **FundPrice Model** (`FundPrice.model.ts`)

Manages historical NAV/price data for funds.

**Key Features:**

- Daily price tracking
- Historical data queries
- Price range analysis
- OHLC data for charting
- Moving averages
- Volatility calculations
- Returns calculation

**Usage Example:**

```typescript
import { fundPriceModel } from './models';

// Add price data
await fundPriceModel.create({
  fundId: 'FUND001',
  date: new Date('2024-01-15'),
  nav: 850.5,
  changePercent: 1.2,
});

// Get price history
const history = await fundPriceModel.getHistory('FUND001', {
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-12-31'),
  limit: 365,
});

// Calculate returns
const returns = await fundPriceModel.calculateReturns(
  'FUND001',
  new Date('2024-01-01'),
  new Date('2024-12-31')
);

// Get volatility
const volatility = await fundPriceModel.getVolatility(
  'FUND001',
  new Date('2024-01-01'),
  new Date('2024-12-31')
);
```

---

### 4. **FundManager Model** (`FundManager.model.ts`)

Manages fund manager profiles and track records.

**Key Features:**

- Manager profiles and experience
- Funds managed history
- Performance track record
- Awards and recognition
- AUM tracking
- Average returns calculation

**Usage Example:**

```typescript
import { fundManagerModel } from './models';

// Create fund manager
const manager = await fundManagerModel.create({
  managerId: 'MGR001',
  name: 'Prashant Jain',
  bio: 'Veteran fund manager...',
  experience: 25,
  currentFundHouse: 'HDFC Mutual Fund',
  designation: 'Chief Investment Officer',
  // ... other fields
});

// Add fund to manager's portfolio
await fundManagerModel.addFund('MGR001', {
  fundId: 'FUND001',
  fundName: 'HDFC Top 100',
  startDate: new Date('2020-01-01'),
  aum: 50000,
  returns: {
    oneYear: 15.5,
    threeYear: 18.2,
    fiveYear: 20.1,
  },
});

// Get top managers by AUM
const topManagers = await fundManagerModel.getTopByAUM(10);
```

---

### 5. **Watchlist Model** (`Watchlist.model.ts`)

Manages user watchlists and price alerts.

**Key Features:**

- Add/remove funds from watchlist
- Price alerts (above, below, change%)
- Alert triggering
- Notes on funds
- Most watched funds

**Usage Example:**

```typescript
import { watchlistModel } from './models';

// Add to watchlist
await watchlistModel.add({
  userId: 'user_123',
  fundId: 'FUND001',
  fundName: 'HDFC Top 100',
});

// Add price alert
await watchlistModel.addPriceAlert('user_123', 'FUND001', {
  type: 'above',
  value: 900,
});

// Get user's watchlist
const watchlist = await watchlistModel.getUserWatchlist('user_123');

// Get most watched funds
const popular = await watchlistModel.getMostWatchedFunds(10);
```

---

### 6. **Portfolio Model** (`Portfolio.model.ts`)

Manages user investment portfolios.

**Key Features:**

- Multiple portfolios per user
- SIP and lumpsum tracking
- Holdings management
- Returns calculation
- Category and sector allocation
- Portfolio summary

**Usage Example:**

```typescript
import { portfolioModel } from './models';

// Create portfolio
const portfolio = await portfolioModel.create({
  userId: 'user_123',
  portfolioId: 'port_001',
  name: 'My Retirement Portfolio',
});

// Add holding
await portfolioModel.addHolding('user_123', 'port_001', {
  fundId: 'FUND001',
  fundName: 'HDFC Top 100',
  investmentType: 'both',
  sipAmount: 10000,
  sipDate: 5,
  lumpsumInvestments: [
    {
      amount: 100000,
      date: new Date('2024-01-15'),
      nav: 850.5,
      units: 117.58,
    },
  ],
  totalInvested: 100000,
  totalUnits: 117.58,
  currentValue: 105000,
  currentNav: 855.2,
  returns: 5000,
  returnsPercent: 5.0,
  xirr: 15.5,
  addedAt: new Date(),
  lastUpdated: new Date(),
});

// Get portfolio summary
const summary = await portfolioModel.getSummary('user_123', 'port_001');
```

---

### 7. **Goal Model** (`Goal.model.ts`)

Manages financial goals and investment planning.

**Key Features:**

- Goal creation and tracking
- Progress monitoring
- Required investment calculation
- Fund recommendations
- Projected completion dates
- Goal statistics

**Usage Example:**

```typescript
import { goalModel } from './models';

// Create goal
const goal = await goalModel.create({
  userId: 'user_123',
  goalId: 'goal_001',
  title: 'Buy House',
  description: 'Save for down payment',
  targetAmount: 5000000,
  currentSavings: 500000,
  monthlyInvestment: 50000,
  timeframe: 5,
});

// Calculate required monthly investment
const requiredSIP = goalModel.calculateRequiredMonthlyInvestment(
  5000000, // target
  500000, // current savings
  5, // years
  12 // expected return %
);

// Update progress
await goalModel.updateProgress('user_123', 'goal_001', 800000);

// Add suggested fund
await goalModel.addSuggestedFund('user_123', 'goal_001', {
  fundId: 'FUND001',
  fundName: 'HDFC Top 100',
  allocationPercent: 60,
  sipAmount: 30000,
});
```

---

## 🔄 Common Patterns

### 1. **Creating Records**

```typescript
const record = await model.create({
  // ... data
});
```

### 2. **Finding Records**

```typescript
// By ID
const record = await model.findById(id);

// By custom field
const record = await model.findByEmail(email);

// Multiple records
const records = await model.findAll({ limit: 10, skip: 0 });
```

### 3. **Updating Records**

```typescript
const updated = await model.update(id, {
  field: 'new value',
});
```

### 4. **Deleting Records**

```typescript
// Soft delete (sets isActive = false)
await model.delete(id);

// Hard delete (removes from database)
await model.hardDelete(id);
```

### 5. **Searching**

```typescript
const results = await model.search('query', {
  limit: 20,
  skip: 0,
});
```

---

## 🔍 Validation with Zod

All models include Zod schemas for validation:

```typescript
import { FundSchema } from './models';

// Validate data
const validationResult = FundSchema.safeParse(data);

if (!validationResult.success) {
  console.error(validationResult.error);
}
```

---

## 📊 Indexes

All collections have optimized indexes defined in `src/db/schemas.ts`:

- **Full-text search** indexes for searchable fields
- **Compound indexes** for common query patterns
- **TTL indexes** for auto-expiring data
- **Unique indexes** for primary keys

To create indexes:

```typescript
import { createIndexes } from './db/schemas';
import { mongodb } from './db/mongodb';

await createIndexes(mongodb.getDb());
```

---

## 🚀 Best Practices

1. **Always use models** instead of direct MongoDB operations
2. **Validate input** before creating/updating records
3. **Handle null returns** from find operations
4. **Use transactions** for multi-document operations
5. **Leverage indexes** by querying on indexed fields
6. **Soft delete** by default, hard delete only when necessary
7. **Update timestamps** automatically (models handle this)

---

## 🧪 Testing

Example test pattern:

```typescript
import { userModel } from './models';
import { mongodb } from './db/mongodb';

beforeAll(async () => {
  await mongodb.connect();
});

afterAll(async () => {
  await mongodb.disconnect();
});

test('should create user', async () => {
  const user = await userModel.create({
    userId: 'test_user',
    email: 'test@example.com',
    // ... other fields
  });

  expect(user.userId).toBe('test_user');
});
```

---

## 📝 Notes

- All models are **singleton instances** exported from files
- **Date handling**: Always use Date objects, not strings
- **Timestamps**: `createdAt` and `updatedAt` are auto-managed
- **References**: Use string IDs for cross-collection references
- **Aggregations**: Use for complex queries with joins

---

## 🔗 Related Files

- `src/db/mongodb.ts` - MongoDB connection
- `src/db/schemas.ts` - Schema definitions and indexes
- `src/controllers/` - API controllers using models
