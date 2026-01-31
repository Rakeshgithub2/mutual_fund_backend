import { Collection, Db, IndexDescription } from 'mongodb';

/**
 * MongoDB Schema Definitions for Mutual Funds Platform
 * Production-ready schemas with comprehensive indexing
 */

// ==================== FUND SCHEMAS ====================

export interface Fund {
  _id?: string;
  fundId: string; // Unique identifier (e.g., ISIN, ticker, AMFI code)
  amfiCode?: string; // AMFI code for Indian funds
  name: string;
  category:
    | 'equity'
    | 'debt'
    | 'hybrid'
    | 'commodity'
    | 'etf'
    | 'index'
    | 'elss'
    | 'solution_oriented'
    | 'international';
  subCategory: string; // SEBI-aligned sub-categories
  fundType: 'mutual_fund' | 'etf';

  // SEBI Mandatory Fields
  schemeType: 'direct' | 'regular'; // Direct or Regular plan
  planType: 'growth' | 'idcw' | 'dividend'; // Growth or IDCW (Income Distribution cum Capital Withdrawal)
  riskOMeter:
    | 'low'
    | 'low_to_moderate'
    | 'moderate'
    | 'moderately_high'
    | 'high'
    | 'very_high'; // SEBI Risk-o-meter

  // Basic Info
  fundHouse: string; // AMC Name (e.g., "HDFC Mutual Fund")
  amcCode?: string; // AMC unique identifier
  launchDate: Date; // Inception date
  benchmark: string; // Benchmark index (e.g., "Nifty 50", "Nifty Midcap 100")

  // AUM & Financial Metrics
  aum: number; // Assets Under Management (in crores)
  aumDate: Date; // AUM reporting date (critical for freshness)
  aumHistory?: Array<{
    amount: number;
    date: Date;
  }>; // Monthly AUM tracking

  expenseRatio: number;
  exitLoad: number;
  minInvestment: number;
  sipMinAmount: number;

  // Manager Info (Transparency Required)
  fundManagerId?: string; // Reference to fund_managers collection
  fundManager: string; // Primary manager name
  fundManagerExperience?: number; // Years of experience
  fundManagerTenure?: number; // Years managing this fund
  coManagers?: Array<{
    name: string;
    experience: number;
    tenure: number;
  }>; // Co-managers if any

  // Performance
  returns: {
    day: number;
    week: number;
    month: number;
    threeMonth: number;
    sixMonth: number;
    oneYear: number;
    threeYear: number;
    fiveYear: number;
    sinceInception: number;
  };

  // Risk Metrics
  riskMetrics: {
    sharpeRatio: number;
    standardDeviation: number;
    beta: number;
    alpha: number;
    rSquared: number;
    sortino: number;
  };

  // Holdings (top 10-15)
  holdings: Array<{
    name: string;
    ticker?: string;
    percentage: number;
    sector: string;
    quantity?: number;
    value?: number;
  }>;

  // Sector Allocation
  sectorAllocation: Array<{
    sector: string;
    percentage: number;
  }>;

  // Current Price
  currentNav: number;
  previousNav: number;
  navDate: Date;

  // Ratings
  ratings: {
    morningstar?: number;
    crisil?: number;
    valueResearch?: number;
  };

  // Search & Discovery
  tags: string[];
  searchTerms: string[]; // For fuzzy search
  popularity: number; // For ranking

  // Metadata
  isActive: boolean;
  dataSource: string; // 'AMFI', 'SEBI', 'AMC_Website', 'Verified_Aggregator'
  lastUpdated: Date;
  createdAt: Date;

  // Data Completeness & Quality (Zero-NA Policy)
  dataCompleteness: {
    hasCompleteReturns: boolean; // All return periods available
    hasValidAUM: boolean; // AUM and AUM date present
    hasManagerInfo: boolean; // Manager name and experience
    hasHoldings: boolean; // Holdings data available
    hasBenchmark: boolean; // Benchmark defined
    hasRiskMetrics: boolean; // Risk metrics calculated
    lastValidated: Date; // Last validation timestamp
    completenessScore: number; // 0-100 score
  };

  // Visibility Control (Zero-NA Policy Enforcement)
  isPubliclyVisible: boolean; // Only show if completeness > threshold
  visibilityReason?: string; // Reason if hidden (e.g., "Insufficient performance history")
}

export interface FundPrice {
  _id?: string;
  fundId: string;
  date: Date;
  nav: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  changePercent: number;
  createdAt: Date;
}

// ==================== FUND MANAGER SCHEMAS ====================

export interface FundManager {
  _id?: string;
  managerId: string;
  name: string;
  bio: string;
  experience: number; // years of total experience
  qualification: string[];
  certifications?: string[]; // CFA, FRM, etc.

  // Current Role
  currentFundHouse: string;
  designation: string;
  joinedDate: Date;

  // Track Record (Comprehensive)
  fundsManaged: Array<{
    fundId: string;
    fundName: string;
    category: string;
    subCategory: string;
    startDate: Date;
    endDate?: Date;
    aum: number;
    tenure: number; // months
    returns: {
      oneYear: number;
      threeYear: number;
      fiveYear: number;
      sinceTenure: number; // Returns since manager took over
    };
  }>;

  totalAumManaged: number;
  averageReturns: {
    oneYear: number;
    threeYear: number;
    fiveYear: number;
  };

  // Performance Consistency
  consistencyMetrics?: {
    categoriesManaged: string[]; // All categories managed
    totalFundsManaged: number;
    activeFunds: number;
    bestPerformingFund: string;
    averageTenure: number; // Average tenure across all funds
    successRate: number; // % of funds beating benchmark
  };

  // Ratings & Recognition
  awards: Array<{
    title: string;
    year: number;
    organization: string;
  }>;

  // Contact & Social
  email?: string;
  linkedin?: string;
  twitter?: string;

  // Metadata
  isActive: boolean;
  lastUpdated: Date;
  createdAt: Date;
}

// ==================== MARKET INDICES SCHEMAS ====================

export interface MarketIndex {
  _id?: string;
  indexId: string; // e.g., "NIFTY_50", "SENSEX", "BANK_NIFTY"
  name: string; // Display name
  symbol: string; // Trading symbol

  // Current Values (No Zero / No Stale Data)
  currentValue: number;
  previousClose: number;
  change: number; // Absolute change
  changePercent: number; // Percentage change

  // Intraday Data
  open: number;
  high: number;
  low: number;
  volume?: number;

  // Market Status
  lastUpdated: Date;
  marketStatus: 'open' | 'closed' | 'pre_open' | 'post_close';
  tradingDay: Date; // Which trading day this data belongs to

  // Historical (for charts)
  history?: Array<{
    date: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;

  // Data Quality & Fallbacks
  dataSource: string; // 'NSE', 'BSE', 'Yahoo_Finance', 'Fallback_API'
  isFallbackData: boolean; // Using fallback source
  sanityCheckPassed: boolean; // Validation passed
  staleness: number; // Minutes since last update

  createdAt: Date;
}

export interface News {
  _id?: string;
  newsId: string;
  title: string;
  content: string; // Full content
  summary: string; // Mobile-friendly short summary

  // Source & Verification (MANDATORY)
  source: string; // Source name (e.g., "Economic Times", "LiveMint")
  sourceUrl: string; // Original article URL
  sourceVerified: boolean; // Is this a verified source?
  author?: string; // Article author if available

  // Classification
  category:
    | 'mutual_fund'
    | 'equity_market'
    | 'debt_market'
    | 'commodity'
    | 'amc_announcement'
    | 'regulatory'
    | 'general';
  tags: string[]; // For filtering

  // Related Entities
  relatedFunds?: string[]; // Fund IDs mentioned
  relatedAMCs?: string[]; // AMC names mentioned
  relatedIndices?: string[]; // Index names mentioned

  // Timestamps
  publishedAt: Date;
  scrapedAt: Date;
  createdAt: Date;
  updatedAt: Date;

  // Engagement
  views: number;
  isPromotional: boolean; // Flag promotional content (excluded)
  isFeatured: boolean; // Featured news
}

// ==================== USER SCHEMAS ====================

export interface User {
  _id?: string;
  userId: string;

  // Authentication Methods
  // Google OAuth
  googleId?: string; // Optional now - only for Google users

  // Email/Password Auth
  email: string;
  password?: string; // Hashed password for email/password users
  emailVerified: boolean;
  authMethod: 'google' | 'email' | 'both'; // Track authentication method

  // Profile
  name: string;
  firstName: string;
  lastName: string;
  picture?: string;
  phone?: string;

  // Preferences
  preferences: {
    theme: 'light' | 'dark';
    language: 'en' | 'hi';
    currency: string;
    riskProfile: 'conservative' | 'moderate' | 'aggressive';
    notifications: {
      email: boolean;
      push: boolean;
      priceAlerts: boolean;
      newsAlerts: boolean;
    };
  };

  // KYC Status
  kyc: {
    status: 'pending' | 'verified' | 'rejected';
    panNumber?: string;
    aadharNumber?: string;
    verifiedAt?: Date;
  };

  // Subscription
  subscription: {
    plan: 'free' | 'basic' | 'premium';
    startDate?: Date;
    endDate?: Date;
    autoRenew: boolean;
  };

  // Security
  refreshTokens: string[]; // For JWT refresh
  lastLogin: Date;
  loginHistory: Array<{
    timestamp: Date;
    ip: string;
    userAgent: string;
  }>;

  // Metadata
  isActive: boolean;
  isBlocked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== WATCHLIST & PORTFOLIO ====================

export interface Watchlist {
  _id?: string;
  userId: string;
  fundId: string;
  fundName: string;
  addedAt: Date;

  // Price Alerts
  priceAlerts: Array<{
    type: 'above' | 'below' | 'change_percent';
    value: number;
    isActive: boolean;
    triggeredAt?: Date;
  }>;

  notes?: string;
}

export interface Portfolio {
  _id?: string;
  userId: string;
  portfolioId: string;
  name: string;

  holdings: Array<{
    fundId: string;
    fundName: string;
    investmentType: 'sip' | 'lumpsum' | 'both';

    // SIP Details
    sipAmount?: number;
    sipDate?: number; // Day of month
    sipStartDate?: Date;
    sipCount?: number;

    // Lumpsum Details
    lumpsumInvestments: Array<{
      amount: number;
      date: Date;
      nav: number;
      units: number;
    }>;

    // Totals
    totalInvested: number;
    totalUnits: number;
    currentValue: number;
    currentNav: number;
    returns: number;
    returnsPercent: number;
    xirr: number;

    addedAt: Date;
    lastUpdated: Date;
  }>;

  // Portfolio Summary
  totalInvested: number;
  currentValue: number;
  totalReturns: number;
  returnsPercent: number;
  xirr: number;

  // Allocation
  categoryAllocation: Array<{
    category: string;
    value: number;
    percentage: number;
  }>;

  sectorAllocation: Array<{
    sector: string;
    value: number;
    percentage: number;
  }>;

  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== COMPARISON & OVERLAP ====================

export interface ComparisonHistory {
  _id?: string;
  userId?: string;
  fundIds: string[];
  results: {
    overlapScore: number;
    jaccardSimilarity: number;
    commonHoldings: Array<{
      name: string;
      ticker?: string;
      percentages: number[]; // For each fund
      sector: string;
    }>;
    sectorOverlap: Array<{
      sector: string;
      percentages: number[];
    }>;
    performanceComparison: Array<{
      fundId: string;
      returns: any;
      risk: any;
    }>;
  };
  createdAt: Date;
}

// ==================== CACHING & RATE LIMITING ====================

export interface CacheEntry {
  _id?: string;
  key: string;
  value: any;
  ttl: number; // Seconds
  expiresAt: Date;
  createdAt: Date;
}

export interface RateLimit {
  _id?: string;
  identifier: string; // IP or userId
  endpoint: string;
  count: number;
  windowStart: Date;
  windowEnd: Date;
}

export interface ApiCallLog {
  _id?: string;
  service: string; // 'yahoo_finance', 'amfi', 'rapidapi'
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  success: boolean;
  errorMessage?: string;
  rateLimit?: {
    remaining: number;
    reset: Date;
  };
  timestamp: Date;
}

// ==================== GOALS ====================

export interface Goal {
  _id?: string;
  userId: string;
  goalId: string;
  title: string;
  description: string;

  // Financial Details
  targetAmount: number;
  currentSavings: number;
  monthlyInvestment: number;
  timeframe: number; // years

  // Suggested Funds
  suggestedFunds: Array<{
    fundId: string;
    fundName: string;
    allocationPercent: number;
    sipAmount: number;
  }>;

  // Progress
  status: 'active' | 'completed' | 'paused';
  progress: number; // percentage
  projectedCompletionDate: Date;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

// ==================== INDEX DEFINITIONS ====================

export const indexes = {
  funds: [
    { key: { fundId: 1 }, unique: true },
    { key: { amfiCode: 1 }, unique: true, sparse: true },
    { key: { name: 'text', searchTerms: 'text', tags: 'text' } }, // Full-text search
    { key: { category: 1, subCategory: 1 } },
    { key: { fundHouse: 1 } },
    { key: { fundManagerId: 1 } },
    { key: { schemeType: 1, planType: 1 } }, // Direct/Regular, Growth/IDCW
    { key: { riskOMeter: 1 } },
    { key: { 'returns.oneYear': -1 } },
    { key: { 'returns.threeYear': -1 } },
    { key: { aum: -1 } },
    { key: { aumDate: -1 } }, // Track AUM freshness
    { key: { popularity: -1 } },
    { key: { isActive: 1, isPubliclyVisible: 1 } }, // Zero-NA policy
    { key: { 'dataCompleteness.completenessScore': -1 } },
    { key: { lastUpdated: -1 } },
    { key: { navDate: -1 } },
    // Compound indexes for common queries
    { key: { category: 1, 'returns.oneYear': -1 } },
    { key: { isActive: 1, isPubliclyVisible: 1, category: 1, aum: -1 } },
    { key: { category: 1, subCategory: 1, schemeType: 1 } },
  ],

  fundPrices: [
    { key: { fundId: 1, date: -1 }, unique: true },
    { key: { fundId: 1, date: 1 } }, // For historical queries
    { key: { date: -1 } },
  ],

  fundManagers: [
    { key: { managerId: 1 }, unique: true },
    { key: { name: 'text', bio: 'text' } },
    { key: { currentFundHouse: 1 } },
    { key: { experience: -1 } },
    { key: { totalAumManaged: -1 } },
    { key: { isActive: 1 } },
  ],

  users: [
    { key: { userId: 1 }, unique: true },
    { key: { googleId: 1 }, unique: true, sparse: true },
    { key: { email: 1 }, unique: true },
    { key: { authMethod: 1 } },
    { key: { createdAt: -1 } },
    { key: { isActive: 1 } },
  ],

  watchlists: [
    { key: { userId: 1, fundId: 1 }, unique: true },
    { key: { userId: 1, addedAt: -1 } },
    { key: { fundId: 1 } },
  ],

  portfolios: [
    { key: { userId: 1, portfolioId: 1 }, unique: true },
    { key: { userId: 1, isActive: 1 } },
    { key: { 'holdings.fundId': 1 } },
  ],

  comparisonHistory: [
    { key: { userId: 1, createdAt: -1 } },
    { key: { fundIds: 1 } },
    { key: { createdAt: -1 }, expireAfterSeconds: 2592000 }, // 30 days TTL
  ],

  cacheEntries: [
    { key: { key: 1 }, unique: true },
    { key: { expiresAt: 1 }, expireAfterSeconds: 0 }, // TTL index
  ],

  rateLimits: [
    { key: { identifier: 1, endpoint: 1, windowStart: 1 } },
    { key: { windowEnd: 1 }, expireAfterSeconds: 0 }, // TTL index
  ],

  apiCallLogs: [
    { key: { service: 1, timestamp: -1 } },
    { key: { timestamp: -1 } },
    { key: { timestamp: -1 }, expireAfterSeconds: 2592000 }, // 30 days TTL
  ],

  goals: [
    { key: { userId: 1, goalId: 1 }, unique: true },
    { key: { userId: 1, status: 1 } },
    { key: { userId: 1, createdAt: -1 } },
  ],

  marketIndices: [
    { key: { indexId: 1 }, unique: true },
    { key: { symbol: 1 } },
    { key: { lastUpdated: -1 } },
    { key: { marketStatus: 1, lastUpdated: -1 } },
    { key: { tradingDay: -1 } },
    { key: { sanityCheckPassed: 1, staleness: 1 } }, // Data quality
  ],

  news: [
    { key: { newsId: 1 }, unique: true },
    { key: { publishedAt: -1 } },
    { key: { category: 1, publishedAt: -1 } },
    { key: { source: 1, publishedAt: -1 } },
    { key: { sourceVerified: 1, isPromotional: -1, publishedAt: -1 } }, // Verified, non-promotional
    { key: { tags: 1 } },
    { key: { relatedFunds: 1 } },
    { key: { relatedAMCs: 1 } },
    { key: { title: 'text', summary: 'text', content: 'text' } }, // Full-text search
  ],
};

// ==================== COLLECTION HELPERS ====================

export async function createIndexes(db: Db): Promise<void> {
  console.log('Creating MongoDB indexes...');

  const collections = Object.keys(indexes) as Array<keyof typeof indexes>;

  for (const collectionName of collections) {
    const collection = db.collection(collectionName);
    const indexSpecs = indexes[collectionName];

    try {
      for (const indexSpec of indexSpecs) {
        await collection.createIndex(indexSpec.key as any, {
          unique: (indexSpec as any).unique,
          expireAfterSeconds: (indexSpec as any).expireAfterSeconds,
        });
      }
      console.log(`✓ Indexes created for ${collectionName}`);
    } catch (error) {
      console.error(`✗ Error creating indexes for ${collectionName}:`, error);
    }
  }

  console.log('All indexes created successfully!');
}

export function getCollections(db: Db) {
  return {
    funds: db.collection<Fund>('funds'),
    fundPrices: db.collection<FundPrice>('fundPrices'),
    fundManagers: db.collection<FundManager>('fundManagers'),
    users: db.collection<User>('users'),
    watchlists: db.collection<Watchlist>('watchlists'),
    portfolios: db.collection<Portfolio>('portfolios'),
    comparisonHistory: db.collection<ComparisonHistory>('comparisonHistory'),
    cacheEntries: db.collection<CacheEntry>('cacheEntries'),
    rateLimits: db.collection<RateLimit>('rateLimits'),
    apiCallLogs: db.collection<ApiCallLog>('apiCallLogs'),
    goals: db.collection<Goal>('goals'),
    marketIndices: db.collection<MarketIndex>('marketIndices'),
    news: db.collection<News>('news'),
  };
}
