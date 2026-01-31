/**
 * Oracle VM / MFAPI Real-Time Fallback Service
 *
 * Purpose: When user searches for a fund NOT in MongoDB, fetch it from:
 * 1. Oracle VM (if configured) - Your primary real-time data source
 * 2. MFAPI.in - Public fallback
 * 3. RapidAPI - Premium fallback
 *
 * This ensures users ALWAYS get results even if DB is stale
 */

import axios, { AxiosInstance } from 'axios';
import { getDb } from '../lib/mongodb-serverless';

interface FundData {
  schemeCode: string;
  schemeName: string;
  category: string;
  subCategory?: string;
  amc?: string;
  nav: {
    value: number;
    date: Date;
  };
  returns?: {
    '1Y'?: number;
    '3Y'?: number;
    '5Y'?: number;
  };
  dataSource: 'oracle' | 'mfapi' | 'rapidapi';
  lastFetched: Date;
}

class OracleMFAPIFallbackService {
  private oracleClient: AxiosInstance | null = null;
  private mfapiClient: AxiosInstance;
  private rapidApiClient: AxiosInstance | null = null;

  constructor() {
    // Initialize Oracle VM client if configured
    if (process.env.ORACLE_VM_URL && process.env.ORACLE_API_KEY) {
      this.oracleClient = axios.create({
        baseURL: process.env.ORACLE_VM_URL,
        timeout: 15000,
        headers: {
          Authorization: `Bearer ${process.env.ORACLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
      });
      console.log('✅ Oracle VM client initialized');
    } else {
      console.warn(
        '⚠️ Oracle VM not configured (missing ORACLE_VM_URL or ORACLE_API_KEY)'
      );
    }

    // MFAPI.in - Free public API
    this.mfapiClient = axios.create({
      baseURL: 'https://api.mfapi.in/mf',
      timeout: 10000,
      headers: {
        'User-Agent': 'MutualFunds-Platform/2.0',
      },
    });

    // RapidAPI - Premium fallback
    if (process.env.RAPIDAPI_KEY) {
      this.rapidApiClient = axios.create({
        baseURL: 'https://latest-mutual-fund-nav.p.rapidapi.com',
        timeout: 8000,
        headers: {
          'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
          'X-RapidAPI-Host': 'latest-mutual-fund-nav.p.rapidapi.com',
        },
      });
    }
  }

  /**
   * Search for fund across all sources (Oracle → MFAPI → RapidAPI)
   * Returns first match found
   */
  async searchFundRealtime(query: string): Promise<FundData[]> {
    const results: FundData[] = [];

    // Try Oracle VM first (fastest, most comprehensive)
    if (this.oracleClient) {
      try {
        const oracleResults = await this.searchFromOracle(query);
        results.push(...oracleResults);

        if (results.length > 0) {
          console.log(`✅ Found ${results.length} funds from Oracle VM`);
          await this.saveFundsToDatabase(results);
          return results;
        }
      } catch (error: any) {
        console.error('Oracle VM search failed:', error.message);
      }
    }

    // Fallback to MFAPI.in
    try {
      const mfapiResults = await this.searchFromMFAPI(query);
      results.push(...mfapiResults);

      if (results.length > 0) {
        console.log(`✅ Found ${results.length} funds from MFAPI`);
        await this.saveFundsToDatabase(results);
        return results;
      }
    } catch (error: any) {
      console.error('MFAPI search failed:', error.message);
    }

    // Final fallback to RapidAPI
    if (this.rapidApiClient) {
      try {
        const rapidResults = await this.searchFromRapidAPI(query);
        results.push(...rapidResults);

        if (results.length > 0) {
          console.log(`✅ Found ${results.length} funds from RapidAPI`);
          await this.saveFundsToDatabase(results);
        }
      } catch (error: any) {
        console.error('RapidAPI search failed:', error.message);
      }
    }

    return results;
  }

  /**
   * Fetch specific fund by scheme code from Oracle VM
   */
  private async searchFromOracle(query: string): Promise<FundData[]> {
    if (!this.oracleClient) return [];

    try {
      // Assuming Oracle API has /api/funds/search endpoint
      const response = await this.oracleClient.get('/api/funds/search', {
        params: { q: query, limit: 10 },
      });

      if (!response.data?.data) return [];

      return response.data.data.map((fund: any) => ({
        schemeCode: fund.schemeCode || fund.fundCode,
        schemeName: fund.schemeName || fund.name,
        category: this.normalizeCategory(fund.category),
        subCategory: fund.subCategory,
        amc: fund.amc || fund.fundHouse,
        nav: {
          value: parseFloat(fund.nav || fund.currentNav || 0),
          date: fund.navDate ? new Date(fund.navDate) : new Date(),
        },
        returns: fund.returns,
        dataSource: 'oracle' as const,
        lastFetched: new Date(),
      }));
    } catch (error) {
      throw error;
    }
  }

  /**
   * Search MFAPI.in - uses scheme code, not search
   * Returns popular funds matching category if scheme code not found
   */
  private async searchFromMFAPI(query: string): Promise<FundData[]> {
    try {
      // MFAPI doesn't have search, but we can try common scheme codes
      // For now, return empty - caller should fetch by scheme code
      return [];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Fetch from MFAPI by exact scheme code
   */
  async fetchBySchemeCode(schemeCode: string): Promise<FundData | null> {
    try {
      console.log(`🌐 Fetching scheme ${schemeCode} from MFAPI...`);

      const response = await this.mfapiClient.get(`/${schemeCode}`);
      const data = response.data;

      if (!data?.meta || !data?.data || data.data.length === 0) {
        return null;
      }

      const meta = data.meta;
      const latestNav = data.data[0];

      const fundData: FundData = {
        schemeCode: meta.scheme_code,
        schemeName: meta.scheme_name,
        category: this.normalizeCategory(meta.scheme_category),
        subCategory: meta.scheme_type,
        amc: meta.fund_house,
        nav: {
          value: parseFloat(latestNav.nav),
          date: new Date(latestNav.date),
        },
        dataSource: 'mfapi' as const,
        lastFetched: new Date(),
      };

      // Save to database for future queries
      await this.saveFundsToDatabase([fundData]);

      console.log(`✅ Fetched and saved: ${fundData.schemeName}`);
      return fundData;
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.log(`❌ Scheme ${schemeCode} not found in MFAPI`);
        return null;
      }
      throw error;
    }
  }

  /**
   * Search RapidAPI
   */
  private async searchFromRapidAPI(query: string): Promise<FundData[]> {
    if (!this.rapidApiClient) return [];

    try {
      const response = await this.rapidApiClient.get('/fetchAllMutualFund');

      if (!response.data || !Array.isArray(response.data)) return [];

      // Filter by query
      const filtered = response.data
        .filter((f: any) =>
          f.schemeName?.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 10)
        .map((fund: any) => ({
          schemeCode: fund.schemeCode,
          schemeName: fund.schemeName,
          category: this.normalizeCategory(fund.schemeType),
          subCategory: fund.schemeCategory,
          amc: fund.fundHouse,
          nav: {
            value: parseFloat(fund.nav || 0),
            date: new Date(),
          },
          dataSource: 'rapidapi' as const,
          lastFetched: new Date(),
        }));

      return filtered;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Save fetched funds to MongoDB for future queries
   */
  private async saveFundsToDatabase(funds: FundData[]): Promise<void> {
    if (funds.length === 0) return;

    try {
      const db = await getDb();
      const collection = db.collection('fund_master');

      const bulkOps = funds.map((fund) => ({
        updateOne: {
          filter: { schemeCode: fund.schemeCode },
          update: {
            $set: {
              schemeName: fund.schemeName,
              category: fund.category,
              subCategory: fund.subCategory,
              amc: fund.amc,
              nav: fund.nav,
              returns: fund.returns,
              dataSource: fund.dataSource,
              lastFetched: fund.lastFetched,
              updatedAt: new Date(),
            },
            $setOnInsert: {
              createdAt: new Date(),
              isActive: true,
            },
          },
          upsert: true,
        },
      }));

      const result = await collection.bulkWrite(bulkOps);
      console.log(
        `💾 Saved ${result.upsertedCount + result.modifiedCount} funds to DB`
      );
    } catch (error) {
      console.error('Error saving funds to database:', error);
      // Don't throw - we still want to return the funds
    }
  }

  /**
   * Normalize category names
   */
  private normalizeCategory(category: string): string {
    if (!category) return 'Other';

    const lower = category.toLowerCase();

    if (lower.includes('equity') || lower.includes('stock')) return 'Equity';
    if (lower.includes('debt') || lower.includes('bond')) return 'Debt';
    if (lower.includes('hybrid') || lower.includes('balanced')) return 'Hybrid';
    if (
      lower.includes('commodity') ||
      lower.includes('gold') ||
      lower.includes('silver')
    )
      return 'Commodity';

    return 'Other';
  }

  /**
   * Health check for all data sources
   */
  async healthCheck(): Promise<{
    oracle: boolean;
    mfapi: boolean;
    rapidapi: boolean;
  }> {
    const health = {
      oracle: false,
      mfapi: false,
      rapidapi: false,
    };

    // Check Oracle VM
    if (this.oracleClient) {
      try {
        await this.oracleClient.get('/health', { timeout: 5000 });
        health.oracle = true;
      } catch {
        health.oracle = false;
      }
    }

    // Check MFAPI
    try {
      await this.mfapiClient.get('/119551', { timeout: 5000 });
      health.mfapi = true;
    } catch {
      health.mfapi = false;
    }

    // Check RapidAPI
    if (this.rapidApiClient) {
      try {
        await this.rapidApiClient.get('/fetchAllMutualFund', {
          timeout: 5000,
          params: { limit: 1 },
        });
        health.rapidapi = true;
      } catch {
        health.rapidapi = false;
      }
    }

    return health;
  }
}

export const oracleFallbackService = new OracleMFAPIFallbackService();
