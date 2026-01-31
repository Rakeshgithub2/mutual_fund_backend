import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Environment Configuration
 *
 * All secrets and API keys should be stored in .env file
 * Never commit .env to version control
 */

export const config = {
  // Server
  server: {
    port: parseInt(process.env.PORT || '3002'),
    nodeEnv: process.env.NODE_ENV || 'development',
  },

  // MongoDB
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/mutual_funds_db',
    options: {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    },
  },

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    ttl: {
      prices: 15 * 60, // 15 minutes for prices
      funds: 60 * 60, // 1 hour for fund metadata
      search: 30 * 60, // 30 minutes for search results
      suggestions: 60 * 60, // 1 hour for autocomplete suggestions
    },
  },

  // JWT
  jwt: {
    accessTokenSecret:
      process.env.JWT_ACCESS_SECRET ||
      'your-access-token-secret-change-in-production',
    refreshTokenSecret:
      process.env.JWT_REFRESH_SECRET ||
      'your-refresh-token-secret-change-in-production',
    accessTokenExpiry: '1h',
    refreshTokenExpiry: '7d',
  },

  // Google OAuth
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  },

  // CORS
  cors: {
    allowedOrigins: [
      'http://localhost:5001',
      'http://localhost:3000',
      'http://localhost:3001',
      'https://mf-frontend-coral.vercel.app',
      'https://mutual-fun-frontend-osed.vercel.app',
      process.env.FRONTEND_URL,
      ...(process.env.ALLOWED_ORIGINS?.split(',') || []),
    ].filter(Boolean),
  },

  // External APIs
  apis: {
    // Yahoo Finance (RapidAPI)
    yahooFinance: {
      apiKey: process.env.YAHOO_FINANCE_API_KEY || '',
      baseUrl: 'https://yahoo-finance15.p.rapidapi.com',
      rateLimit: {
        requestsPerSecond: 1,
        requestsPerDay: 500, // Free tier
      },
    },

    // Alpha Vantage
    alphaVantage: {
      apiKey: process.env.ALPHA_VANTAGE_KEY || '',
      baseUrl: 'https://www.alphavantage.co',
      rateLimit: {
        requestsPerMinute: 5, // Free tier
        requestsPerDay: 500,
      },
    },

    // IEX Cloud
    iexCloud: {
      token: process.env.IEX_CLOUD_TOKEN || '',
      baseUrl: 'https://cloud.iexapis.com',
      rateLimit: {
        requestsPerSecond: 10, // Paid tier
      },
    },

    // AMFI
    amfi: {
      navUrl: 'https://www.amfiindia.com/spages/NAVAll.txt',
      rateLimit: {
        requestsPerMinute: 1,
      },
    },

    // NSE India
    nse: {
      baseUrl: 'https://www.nseindia.com',
      rateLimit: {
        requestsPerSecond: 0.5, // 1 request per 2 seconds
      },
    },
  },

  // Background Jobs
  jobs: {
    // Daily NAV update (run at 8 PM IST)
    dailyNavUpdate: {
      cron: '0 20 * * *', // 8:00 PM every day
      timezone: 'Asia/Kolkata',
    },

    // Weekly holdings update (run Sunday 2 AM IST)
    weeklyHoldingsUpdate: {
      cron: '0 2 * * 0', // 2:00 AM every Sunday
      timezone: 'Asia/Kolkata',
    },

    // Price refresh (every 15 minutes during market hours)
    priceRefresh: {
      cron: '*/15 9-15 * * 1-5', // Every 15 min, 9 AM - 3 PM, Mon-Fri
      timezone: 'Asia/Kolkata',
    },
  },

  // Feature Flags
  features: {
    enableAtlasSearch: process.env.ENABLE_ATLAS_SEARCH === 'true',
    enableRealTimePrice: process.env.ENABLE_REALTIME_PRICE === 'true',
    enableBackgroundJobs: process.env.ENABLE_BACKGROUND_JOBS !== 'false',
  },
};

// Validation
export function validateConfig(): void {
  const errors: string[] = [];

  // Check required secrets
  if (!config.google.clientId) {
    errors.push('GOOGLE_CLIENT_ID is required');
  }

  if (config.server.nodeEnv === 'production') {
    if (config.jwt.accessTokenSecret.includes('change-in-production')) {
      errors.push('JWT_ACCESS_SECRET must be set in production');
    }
    if (config.jwt.refreshTokenSecret.includes('change-in-production')) {
      errors.push('JWT_REFRESH_SECRET must be set in production');
    }
  }

  if (errors.length > 0) {
    console.error('❌ Configuration validation failed:');
    errors.forEach((error) => console.error(`   - ${error}`));
    throw new Error('Invalid configuration');
  }
}

// Log configuration (without secrets)
export function logConfig(): void {
  console.log('📋 Server Configuration:');
  console.log(`   - Environment: ${config.server.nodeEnv}`);
  console.log(`   - Port: ${config.server.port}`);
  console.log(
    `   - MongoDB: ${config.mongodb.uri.replace(/\/\/.*@/, '//***@')}`
  );
  console.log(`   - Redis: ${config.redis.host}:${config.redis.port}`);
  console.log(
    `   - Google OAuth: ${config.google.clientId ? 'Configured' : 'Not configured'}`
  );
  console.log(
    `   - Yahoo Finance API: ${config.apis.yahooFinance.apiKey ? 'Configured' : 'Not configured'}`
  );
  console.log(
    `   - Alpha Vantage API: ${config.apis.alphaVantage.apiKey ? 'Configured' : 'Not configured'}`
  );
  console.log(
    `   - Atlas Search: ${config.features.enableAtlasSearch ? 'Enabled' : 'Disabled'}`
  );
  console.log(
    `   - Background Jobs: ${config.features.enableBackgroundJobs ? 'Enabled' : 'Disabled'}\n`
  );
}
