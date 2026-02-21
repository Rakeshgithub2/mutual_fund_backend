/**
 * Fund Data Fetch Service
 * Smart fetch logic: Check MongoDB → Check Redis → Fetch External API → Cache
 */

const FundStaticMaster = require('../models/FundStaticMaster.model');
const FundPeriodicReturns = require('../models/FundPeriodicReturns.model');
const FundNavDaily = require('../models/FundNavDaily.model');
const MarketIndicesHourly = require('../models/MarketIndicesHourly.model');
const { redisCache } = require('./redis.service');
const { isMarketHoliday, getLastTradingDay } = require('../utils/market.utils');
const axios = require('axios');

class FundFetchService {
  /**
   * Get complete fund data (static + periodic + daily)
   */
  async getFundData(fundCode) {
    try {
      // 1. Fetch static data (always from MongoDB)
      const staticData = await this.getStaticData(fundCode);

      if (!staticData) {
        throw new Error(`Fund ${fundCode} not found`);
      }

      // 2. Fetch periodic returns (MongoDB)
      const periodicData = await this.getPeriodicReturns(fundCode);

      // 3. Fetch daily NAV (Redis → MongoDB → External)
      const navData = await this.getDailyNAV(fundCode);

      return {
        ...staticData,
        returns: periodicData,
        nav: navData,
        lastUpdated: new Date(),
      };
    } catch (error) {
      console.error(`Failed to fetch fund data for ${fundCode}:`, error);
      throw error;
    }
  }

  /**
   * Get static fund data from MongoDB
   */
  async getStaticData(fundCode) {
    try {
      const fund = await FundStaticMaster.findOne({
        fundCode,
        isActive: true,
      }).lean();

      return fund;
    } catch (error) {
      console.error(`Failed to get static data for ${fundCode}:`, error);
      return null;
    }
  }

  /**
   * Get periodic returns from MongoDB
   */
  async getPeriodicReturns(fundCode) {
    try {
      // Get latest periodic data
      const returns = await FundPeriodicReturns.findOne({
        fundCode,
      })
        .sort({ dataMonth: -1 })
        .lean();

      return returns || null;
    } catch (error) {
      console.error(`Failed to get periodic returns for ${fundCode}:`, error);
      return null;
    }
  }

  /**
   * Get daily NAV with smart caching
   * Flow: Redis Cache → MongoDB → External API
   */
  async getDailyNAV(fundCode) {
    try {
      // Step 1: Check Redis cache (hot data)
      const cachedNAV = await redisCache.getNAV(fundCode);

      if (cachedNAV !== null) {
        console.log(`✅ NAV cache hit for ${fundCode}`);
        return { nav: cachedNAV, source: 'CACHE' };
      }

      // Step 2: Check MongoDB (warm data)
      const today = new Date();
      const isHoliday = await isMarketHoliday(today);
      const targetDate = isHoliday ? await getLastTradingDay(today) : today;

      const navRecord = await FundNavDaily.findOne({
        fundCode,
        navDate: {
          $gte: new Date(targetDate.setHours(0, 0, 0, 0)),
          $lte: new Date(targetDate.setHours(23, 59, 59, 999)),
        },
      }).lean();

      if (navRecord) {
        console.log(`✅ NAV found in MongoDB for ${fundCode}`);

        // Cache in Redis for next time
        await redisCache.setNAV(fundCode, navRecord.nav);

        return {
          nav: navRecord.nav,
          navDate: navRecord.navDate,
          navChange: navRecord.navChange,
          navChangePercent: navRecord.navChangePercent,
          source: 'DATABASE',
        };
      }

      // Step 3: Fetch from external API (cold start)
      console.log(
        `⚠️ NAV not found, fetching from external API for ${fundCode}`
      );
      const externalNAV = await this.fetchExternalNAV(fundCode);

      if (externalNAV) {
        // Save to MongoDB
        await this.saveDailyNAV(fundCode, externalNAV);

        // Cache in Redis
        await redisCache.setNAV(fundCode, externalNAV.nav);

        return {
          ...externalNAV,
          source: 'EXTERNAL_API',
        };
      }

      // Step 4: Fallback to last known NAV
      const lastNAV = await FundNavDaily.findOne({ fundCode })
        .sort({ navDate: -1 })
        .lean();

      if (lastNAV) {
        console.log(`⚠️ Using last known NAV for ${fundCode}`);
        return {
          nav: lastNAV.nav,
          navDate: lastNAV.navDate,
          source: 'LAST_KNOWN',
          isStale: true,
        };
      }

      throw new Error(`No NAV data available for ${fundCode}`);
    } catch (error) {
      console.error(`Failed to get daily NAV for ${fundCode}:`, error);
      throw error;
    }
  }

  /**
   * Fetch NAV from external API (AMFI/RapidAPI)
   */
  async fetchExternalNAV(fundCode) {
    try {
      // Try AMFI first
      const amfiNAV = await this.fetchAMFINAV(fundCode);
      if (amfiNAV) return amfiNAV;

      // Fallback to RapidAPI
      const rapidNAV = await this.fetchRapidAPINAV(fundCode);
      if (rapidNAV) return rapidNAV;

      return null;
    } catch (error) {
      console.error(`External NAV fetch failed for ${fundCode}:`, error);
      return null;
    }
  }

  /**
   * Fetch NAV from AMFI
   */
  async fetchAMFINAV(fundCode) {
    try {
      const url = 'https://www.amfiindia.com/spages/NAVAll.txt';
      const response = await axios.get(url, { timeout: 15000 });

      const lines = response.data.split('\n');

      for (const line of lines) {
        const parts = line.split(';');

        if (parts[0]?.trim() === fundCode) {
          const nav = parseFloat(parts[4]?.trim());
          const navDateStr = parts[7]?.trim();

          if (!isNaN(nav) && navDateStr) {
            return {
              nav,
              navDate: this.parseAMFIDate(navDateStr),
              dataSource: 'AMFI',
            };
          }
        }
      }

      return null;
    } catch (error) {
      console.error('AMFI fetch failed:', error.message);
      return null;
    }
  }

  /**
   * Fetch NAV from RapidAPI
   */
  async fetchRapidAPINAV(fundCode) {
    try {
      const rapidApiKey = process.env.RAPIDAPI_KEY;

      if (!rapidApiKey) {
        console.warn('RapidAPI key not configured');
        return null;
      }

      const url = `https://latest-mutual-fund-nav.p.rapidapi.com/fetchLatestNAV?SchemeCode=${fundCode}`;

      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'X-RapidAPI-Key': rapidApiKey,
          'X-RapidAPI-Host': 'latest-mutual-fund-nav.p.rapidapi.com',
        },
      });

      const data = response.data;

      if (data && data.nav) {
        return {
          nav: parseFloat(data.nav),
          navDate: new Date(data.date),
          dataSource: 'RAPIDAPI',
        };
      }

      return null;
    } catch (error) {
      console.error('RapidAPI fetch failed:', error.message);
      return null;
    }
  }

  /**
   * Save daily NAV to MongoDB
   */
  async saveDailyNAV(fundCode, navData) {
    try {
      await FundNavDaily.findOneAndUpdate(
        {
          fundCode,
          navDate: navData.navDate,
        },
        {
          $set: {
            nav: navData.nav,
            dataSource: navData.dataSource,
            isVerified: true,
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      );

      return true;
    } catch (error) {
      console.error(`Failed to save NAV for ${fundCode}:`, error);
      return false;
    }
  }

  /**
   * Get market indices with caching
   */
  async getMarketIndices() {
    try {
      // Step 1: Check Redis cache
      const cachedIndices = await redisCache.getAllIndices();

      if (cachedIndices && Object.keys(cachedIndices).length > 0) {
        console.log('✅ Market indices cache hit');
        return cachedIndices;
      }

      // Step 2: Check MongoDB (last hour)
      const oneHourAgo = new Date(Date.now() - 3600000);

      const indices = await MarketIndicesHourly.find({
        timestamp: { $gte: oneHourAgo },
      }).lean();

      if (indices && indices.length > 0) {
        console.log('✅ Market indices found in MongoDB');

        // Cache in Redis
        for (const index of indices) {
          await redisCache.setIndex(index.indexCode, index);
        }

        return this.formatIndices(indices);
      }

      // Step 3: Return empty if outside trading hours
      console.log('⚠️ No recent market indices data');
      return {};
    } catch (error) {
      console.error('Failed to get market indices:', error);
      return {};
    }
  }

  /**
   * Search funds with pagination
   */
  async searchFunds(query, options = {}) {
    try {
      const {
        page = 1,
        limit = 100,
        category = null,
        subCategory = null,
        sortBy = 'aum',
        sortOrder = 'desc',
      } = options;

      const filter = {
        isActive: true,
        fundStatus: 'Active',
      };

      if (query) {
        filter.$text = { $search: query };
      }

      if (category) {
        filter.category = category;
      }

      if (subCategory) {
        filter.subCategory = subCategory;
      }

      const skip = (page - 1) * limit;
      const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

      const [funds, total] = await Promise.all([
        FundStaticMaster.find(filter).sort(sort).skip(skip).limit(limit).lean(),
        FundStaticMaster.countDocuments(filter),
      ]);

      return {
        funds,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: page * limit < total,
        },
      };
    } catch (error) {
      console.error('Search funds failed:', error);
      throw error;
    }
  }

  /**
   * Helper: Parse AMFI date
   */
  parseAMFIDate(dateStr) {
    try {
      const [day, month, year] = dateStr.split('-');
      const months = {
        Jan: 0,
        Feb: 1,
        Mar: 2,
        Apr: 3,
        May: 4,
        Jun: 5,
        Jul: 6,
        Aug: 7,
        Sep: 8,
        Oct: 9,
        Nov: 10,
        Dec: 11,
      };

      return new Date(year, months[month], day);
    } catch (error) {
      return new Date();
    }
  }

  /**
   * Helper: Format indices for response
   */
  formatIndices(indices) {
    const formatted = {};

    for (const index of indices) {
      formatted[index.indexCode] = {
        value: index.currentValue,
        change: index.change,
        changePercent: index.changePercent,
        timestamp: index.timestamp,
      };
    }

    return formatted;
  }
}

// Singleton instance
const fundFetchService = new FundFetchService();

module.exports = { fundFetchService, FundFetchService };
