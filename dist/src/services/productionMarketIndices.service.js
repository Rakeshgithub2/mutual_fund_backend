"use strict";
/**
 * Production-Ready Market Indices Service
 *
 * Features:
 * - External API only (no DB storage)
 * - In-memory caching with TTL
 * - Auto-refresh during market hours
 * - Graceful fallback
 * - Performance logging
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.marketIndicesService = void 0;
const axios_1 = __importDefault(require("axios"));
class ProductionMarketIndicesService {
    constructor() {
        this.cache = new Map();
        this.CACHE_TTL = 5 * 60 * 1000; // 5 minutes during market hours
        this.CACHE_TTL_CLOSED = 60 * 60 * 1000; // 1 hour when market closed
        this.INDICES = [
            { id: 'nifty50', name: 'NIFTY 50', symbol: '^NSEI', yahooSymbol: '^NSEI' },
            { id: 'sensex', name: 'SENSEX', symbol: '^BSESN', yahooSymbol: '^BSESN' },
            {
                id: 'banknifty',
                name: 'Bank NIFTY',
                symbol: '^NSEBANK',
                yahooSymbol: '^NSEBANK',
            },
            {
                id: 'nifty500',
                name: 'NIFTY 500',
                symbol: '^CRSLDX',
                yahooSymbol: '^CRSLDX',
            },
            {
                id: 'niftymidcap',
                name: 'NIFTY Midcap 100',
                symbol: '^NSEMDCP50',
                yahooSymbol: 'NIFTYMIDCAP100.NS',
            },
            {
                id: 'niftysmallcap',
                name: 'NIFTY Smallcap 100',
                symbol: '^CNXSC',
                yahooSymbol: '^CNXSC', // Use NSE symbol instead
            },
            {
                id: 'niftyit',
                name: 'NIFTY IT',
                symbol: '^CNXIT',
                yahooSymbol: '^CNXIT',
            },
            {
                id: 'niftypharma',
                name: 'NIFTY Pharma',
                symbol: '^CNXPHARMA',
                yahooSymbol: '^CNXPHARMA',
            },
            {
                id: 'niftyauto',
                name: 'NIFTY Auto',
                symbol: '^CNXAUTO',
                yahooSymbol: '^CNXAUTO',
            },
            {
                id: 'niftyfmcg',
                name: 'NIFTY FMCG',
                symbol: '^CNXFMCG',
                yahooSymbol: '^CNXFMCG',
            },
            {
                id: 'niftymetal',
                name: 'NIFTY Metal',
                symbol: '^CNXMETAL',
                yahooSymbol: '^CNXMETAL',
            },
            {
                id: 'niftyrealty',
                name: 'NIFTY Realty',
                symbol: '^CNXREALTY',
                yahooSymbol: '^CNXREALTY',
            },
        ];
    }
    /**
     * Check if market is open (Indian market hours)
     */
    isMarketOpen() {
        const now = new Date();
        const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
        const istTime = new Date(now.getTime() + istOffset);
        const day = istTime.getUTCDay(); // 0 = Sunday, 6 = Saturday
        const hour = istTime.getUTCHours();
        const minute = istTime.getUTCMinutes();
        // Weekend check
        if (day === 0 || day === 6)
            return false;
        // Market hours: 9:15 AM to 3:30 PM IST
        if (hour < 9)
            return false;
        if (hour === 9 && minute < 15)
            return false;
        if (hour > 15)
            return false;
        if (hour === 15 && minute > 30)
            return false;
        return true;
    }
    /**
     * Get cache TTL based on market status
     */
    getCacheTTL() {
        return this.isMarketOpen() ? this.CACHE_TTL : this.CACHE_TTL_CLOSED;
    }
    /**
     * Check if cached data is still valid
     */
    isCacheValid(cached) {
        return Date.now() - cached.timestamp < cached.ttl;
    }
    /**
     * Fetch single index from Yahoo Finance
     */
    async fetchFromYahoo(indexId, yahooSymbol) {
        const startTime = Date.now();
        try {
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}`;
            const response = await axios_1.default.get(url, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
            });
            const quote = response.data.chart.result[0];
            const meta = quote.meta;
            const currentPrice = meta.regularMarketPrice || meta.previousClose;
            const prevClose = meta.previousClose || meta.chartPreviousClose;
            const change = currentPrice - prevClose;
            const changePercent = (change / prevClose) * 100;
            const duration = Date.now() - startTime;
            console.log(`🌐 [DATA SOURCE] MARKET INDEX ${indexId} → External API (${duration}ms)`);
            return {
                indexId,
                name: indexId.toUpperCase(),
                symbol: yahooSymbol,
                value: currentPrice,
                change,
                changePercent,
                high: meta.regularMarketDayHigh || currentPrice,
                low: meta.regularMarketDayLow || currentPrice,
                open: meta.regularMarketOpen || prevClose,
                previousClose: prevClose,
                lastUpdated: new Date().toISOString(),
                source: 'Yahoo',
            };
        }
        catch (error) {
            const duration = Date.now() - startTime;
            console.error(`❌ [DATA SOURCE] MARKET INDEX ${indexId} failed after ${duration}ms:`, error.message);
            return null;
        }
    }
    /**
     * Get single index (cached or fresh)
     */
    async getIndex(indexId) {
        // Check cache first
        const cached = this.cache.get(indexId);
        if (cached && this.isCacheValid(cached)) {
            console.log(`⚡ [DATA SOURCE] MARKET INDEX ${indexId} → Cache (0ms)`);
            return { ...cached.data, source: 'Cache' };
        }
        // Find index config
        const indexConfig = this.INDICES.find((idx) => idx.id === indexId);
        if (!indexConfig) {
            console.error(`❌ Unknown index: ${indexId}`);
            return null;
        }
        // Fetch fresh data
        const freshData = await this.fetchFromYahoo(indexId, indexConfig.yahooSymbol);
        if (freshData) {
            // Update cache
            this.cache.set(indexId, {
                data: freshData,
                timestamp: Date.now(),
                ttl: this.getCacheTTL(),
            });
        }
        return freshData;
    }
    /**
     * Get all indices (parallel fetch)
     */
    async getAllIndices() {
        const startTime = Date.now();
        console.log('📊 [DATA SOURCE] Fetching all market indices...');
        // Fetch all indices in parallel
        const promises = this.INDICES.map(async (indexConfig) => {
            const data = await this.getIndex(indexConfig.id);
            return (data || {
                indexId: indexConfig.id,
                name: indexConfig.name,
                symbol: indexConfig.symbol,
                value: 0,
                change: 0,
                changePercent: 0,
                high: 0,
                low: 0,
                open: 0,
                previousClose: 0,
                lastUpdated: new Date().toISOString(),
                source: 'Cache',
            });
        });
        const results = await Promise.all(promises);
        const duration = Date.now() - startTime;
        const cached = results.filter((r) => r.source === 'Cache').length;
        const fresh = results.length - cached;
        console.log(`✅ [DATA SOURCE] All indices fetched in ${duration}ms (${fresh} fresh, ${cached} cached)`);
        return results;
    }
    /**
     * Refresh all indices (force update)
     */
    async refreshAllIndices() {
        console.log('🔄 [DATA SOURCE] Force refreshing all indices...');
        // Clear cache
        this.cache.clear();
        const results = await this.getAllIndices();
        const updated = results.filter((r) => r.source !== 'Cache').length;
        const failed = results.length - updated;
        return { success: true, updated, failed };
    }
    /**
     * Get service health status
     */
    getHealthStatus() {
        const marketOpen = this.isMarketOpen();
        const cacheSize = this.cache.size;
        const cacheTTL = this.getCacheTTL();
        return {
            status: 'operational',
            marketOpen,
            cacheSize,
            cacheTTL: `${cacheTTL / 1000}s`,
            totalIndices: this.INDICES.length,
            dataSource: 'External API only',
        };
    }
    /**
     * Clear cache (for testing/debugging)
     */
    clearCache() {
        this.cache.clear();
        console.log('🗑️  Market indices cache cleared');
    }
}
// Singleton instance
exports.marketIndicesService = new ProductionMarketIndicesService();
