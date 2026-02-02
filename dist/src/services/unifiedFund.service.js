"use strict";
/**
 * Unified Fund Data Service with Data Source Enforcement
 *
 * Rules:
 * 1. Fund exists in DB → MongoDB only
 * 2. Fund not in DB → Fetch from external API → store in Mongo → return
 * 3. All fund queries must log data source
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.unifiedFundService = void 0;
const mongodb_1 = require("../db/mongodb");
class UnifiedFundService {
    constructor() {
        this.externalAPIAvailable = true;
        this.fundCollection = mongodb_1.mongodb.getCollection('funds');
    }
    /**
     * Log data source for transparency
     */
    logDataSource(log) {
        const emoji = {
            MongoDB: '💾',
            'External API → MongoDB': '🌐➡️💾',
            'External API': '🌐',
            Cache: '⚡',
        };
        console.log(`${emoji[log.source]} [DATA SOURCE] ${log.operation} → ${log.source} (${log.duration}ms)`);
    }
    /**
     * Get all funds with filters (DB-first)
     */
    async getFundList(filters) {
        const startTime = Date.now();
        try {
            const query = {};
            // Build query
            if (filters.fundType) {
                query.fundType = new RegExp(filters.fundType, 'i');
            }
            if (filters.category) {
                query.category = new RegExp(filters.category, 'i');
            }
            if (filters.subCategory) {
                query.subCategory = new RegExp(filters.subCategory, 'i');
            }
            if (filters.amc) {
                query.amc = new RegExp(filters.amc, 'i');
            }
            // Pagination
            const page = filters.page || 1;
            const limit = Math.min(filters.limit || 50, 100); // Max 100
            const skip = (page - 1) * limit;
            // Execute with timing
            const fundsPromise = this.fundCollection
                .find(query)
                .sort({ _id: -1 }) // Use _id to prevent 32MB error
                .skip(skip)
                .limit(limit)
                .toArray();
            const countPromise = this.fundCollection.countDocuments(query);
            const [funds, total] = await Promise.all([fundsPromise, countPromise]);
            const duration = Date.now() - startTime;
            const dataSource = {
                source: 'MongoDB',
                timestamp: new Date().toISOString(),
                operation: 'FUNDS LIST',
                duration,
            };
            this.logDataSource(dataSource);
            return { funds, total, dataSource };
        }
        catch (error) {
            const duration = Date.now() - startTime;
            console.error(`❌ [DATA SOURCE] FUNDS LIST failed after ${duration}ms`, error);
            throw error;
        }
    }
    /**
     * Get single fund by schemeCode (DB-first with external fallback)
     */
    async getFundDetails(schemeCode) {
        const startTime = Date.now();
        try {
            // Try MongoDB first
            const fund = await this.fundCollection.findOne({
                schemeCode: parseInt(schemeCode),
            });
            if (fund) {
                const duration = Date.now() - startTime;
                const dataSource = {
                    source: 'MongoDB',
                    timestamp: new Date().toISOString(),
                    operation: 'FUND DETAILS',
                    duration,
                };
                this.logDataSource(dataSource);
                return { fund, dataSource };
            }
            // Fund not in DB - return null (no external API calls)
            // Data must be pre-populated by background jobs
            console.log(`❌ [DATA SOURCE] Fund ${schemeCode} not found in database`);
            const duration = Date.now() - startTime;
            throw new Error(`Fund ${schemeCode} not found in database`);
        }
        catch (error) {
            const duration = Date.now() - startTime;
            console.error(`❌ [DATA SOURCE] FUND DETAILS ${schemeCode} failed after ${duration}ms`, error);
            throw error;
        }
    }
    /**
     * Search funds with autocomplete
     */
    async searchFunds(query, limit = 10) {
        const startTime = Date.now();
        try {
            // Use text index for fast search
            const funds = await this.fundCollection
                .find({
                $or: [
                    { fundName: new RegExp(query, 'i') },
                    { amc: new RegExp(query, 'i') },
                ],
            })
                .limit(limit)
                .project({
                schemeCode: 1,
                fundName: 1,
                amc: 1,
                category: 1,
                aum: 1,
                returns: 1,
            })
                .toArray();
            const duration = Date.now() - startTime;
            const dataSource = {
                source: 'MongoDB',
                timestamp: new Date().toISOString(),
                operation: 'FUND SEARCH',
                duration,
            };
            this.logDataSource(dataSource);
            return { funds, dataSource };
        }
        catch (error) {
            const duration = Date.now() - startTime;
            console.error(`❌ [DATA SOURCE] FUND SEARCH failed after ${duration}ms`, error);
            throw error;
        }
    }
    /**
     * Get commodity/debt funds (MongoDB only)
     */
    async getSpecialtyFunds(type) {
        const startTime = Date.now();
        try {
            const query = {};
            if (type === 'commodity') {
                query.category = new RegExp('commodity|gold|silver', 'i');
            }
            else if (type === 'debt') {
                query.fundType = new RegExp('debt|income|liquid|gilt', 'i');
            }
            const funds = await this.fundCollection
                .find(query)
                .sort({ _id: -1 }) // Use _id to prevent 32MB error
                .limit(100)
                .toArray();
            const duration = Date.now() - startTime;
            const dataSource = {
                source: 'MongoDB',
                timestamp: new Date().toISOString(),
                operation: `${type.toUpperCase()} FUNDS`,
                duration,
            };
            this.logDataSource(dataSource);
            return { funds, dataSource };
        }
        catch (error) {
            const duration = Date.now() - startTime;
            console.error(`❌ [DATA SOURCE] ${type.toUpperCase()} FUNDS failed after ${duration}ms`, error);
            throw error;
        }
    }
    /**
     * Fetch from external API (placeholder - implement actual API call)
     */
    async fetchFromExternalAPI(schemeCode) {
        // TODO: Implement actual external API fetch
        // For now, throw error to enforce DB-first
        throw new Error(`Fund ${schemeCode} not found in database. External API fetch not implemented yet.`);
    }
    /**
     * Get database health metrics
     */
    async getHealthMetrics() {
        try {
            const totalFunds = await this.fundCollection.countDocuments();
            const equityFunds = await this.fundCollection.countDocuments({
                fundType: /equity/i,
            });
            const debtFunds = await this.fundCollection.countDocuments({
                fundType: /debt/i,
            });
            const commodityFunds = await this.fundCollection.countDocuments({
                category: /commodity/i,
            });
            return {
                totalFunds,
                equityFunds,
                debtFunds,
                commodityFunds,
                externalAPIAvailable: this.externalAPIAvailable,
            };
        }
        catch (error) {
            console.error('❌ Failed to get health metrics:', error);
            return null;
        }
    }
}
// Singleton instance
exports.unifiedFundService = new UnifiedFundService();
