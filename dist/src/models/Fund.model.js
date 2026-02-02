"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FundModel = exports.FundSchema = void 0;
const mongodb_1 = require("../db/mongodb");
const zod_1 = require("zod");
/**
 * Zod validation schema for Fund
 */
exports.FundSchema = zod_1.z.object({
    fundId: zod_1.z.string().min(1, 'Fund ID is required'),
    amfiCode: zod_1.z.string().optional(),
    name: zod_1.z.string().min(1, 'Fund name is required'),
    category: zod_1.z.enum([
        'equity',
        'debt',
        'hybrid',
        'commodity',
        'etf',
        'index',
        'elss',
        'solution_oriented',
        'international',
    ]),
    subCategory: zod_1.z.string(),
    fundType: zod_1.z.enum(['mutual_fund', 'etf']),
    // SEBI Mandatory Fields
    schemeType: zod_1.z.enum(['direct', 'regular']),
    planType: zod_1.z.enum(['growth', 'idcw', 'dividend']),
    riskOMeter: zod_1.z
        .enum([
        'low',
        'low_to_moderate',
        'moderate',
        'moderately_high',
        'high',
        'very_high',
    ])
        .optional(),
    // Basic Info
    fundHouse: zod_1.z.string().min(1, 'Fund house is required'),
    benchmark: zod_1.z.string().optional(),
    launchDate: zod_1.z.date().optional(),
    aum: zod_1.z.number().min(0).optional(),
    aumDate: zod_1.z.date().optional(),
    expenseRatio: zod_1.z.number().min(0).max(5).optional(),
    exitLoad: zod_1.z.number().min(0).max(100).optional(),
    minInvestment: zod_1.z.number().min(0).optional(),
    sipMinAmount: zod_1.z.number().min(0).optional(),
    // Manager Info
    fundManagerId: zod_1.z.string().optional(),
    fundManager: zod_1.z.string().optional(),
    fundManagerExperience: zod_1.z.number().optional(),
    fundManagerTenure: zod_1.z.number().optional(),
    // Performance
    returns: zod_1.z.object({
        day: zod_1.z.number(),
        week: zod_1.z.number(),
        month: zod_1.z.number(),
        threeMonth: zod_1.z.number(),
        sixMonth: zod_1.z.number(),
        oneYear: zod_1.z.number(),
        threeYear: zod_1.z.number(),
        fiveYear: zod_1.z.number(),
        sinceInception: zod_1.z.number(),
    }),
    // Risk Metrics
    riskMetrics: zod_1.z.object({
        sharpeRatio: zod_1.z.number(),
        standardDeviation: zod_1.z.number(),
        beta: zod_1.z.number(),
        alpha: zod_1.z.number(),
        rSquared: zod_1.z.number(),
        sortino: zod_1.z.number(),
    }),
    // Holdings
    holdings: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string(),
        ticker: zod_1.z.string().optional(),
        percentage: zod_1.z.number(),
        sector: zod_1.z.string(),
        quantity: zod_1.z.number().optional(),
        value: zod_1.z.number().optional(),
    })),
    // Sector Allocation
    sectorAllocation: zod_1.z.array(zod_1.z.object({
        sector: zod_1.z.string(),
        percentage: zod_1.z.number(),
    })),
    // Current Price
    currentNav: zod_1.z.number().positive(),
    previousNav: zod_1.z.number().positive(),
    navDate: zod_1.z.date(),
    // Ratings
    ratings: zod_1.z.object({
        morningstar: zod_1.z.number().min(1).max(5).optional(),
        crisil: zod_1.z.number().min(1).max(5).optional(),
        valueResearch: zod_1.z.number().min(1).max(5).optional(),
    }),
    // Search & Discovery
    tags: zod_1.z.array(zod_1.z.string()),
    searchTerms: zod_1.z.array(zod_1.z.string()),
    popularity: zod_1.z.number().min(0).default(0),
    // Metadata
    isActive: zod_1.z.boolean().default(true),
    dataSource: zod_1.z.string(),
    lastUpdated: zod_1.z.date(),
    createdAt: zod_1.z.date(),
});
/**
 * Fund Model Class
 * Provides type-safe methods for interacting with the funds collection
 */
class FundModel {
    constructor() {
        this.collection = mongodb_1.mongodb.getCollection('funds');
    }
    /**
     * Get singleton instance
     */
    static getInstance() {
        if (!FundModel.instance) {
            FundModel.instance = new FundModel();
        }
        return FundModel.instance;
    }
    /**
     * Create a new fund
     */
    async create(fundData) {
        const now = new Date();
        const fund = {
            ...fundData,
            createdAt: fundData.createdAt || now,
            lastUpdated: fundData.lastUpdated || now,
            isActive: fundData.isActive ?? true,
            popularity: fundData.popularity || 0,
        };
        // Validate with Zod (partial validation)
        const result = await this.collection.insertOne(fund);
        return { ...fund, _id: result.insertedId.toString() };
    }
    /**
     * Find fund by fundId, _id, or id field
     * Tries multiple ID formats for compatibility
     * Populates holdings from the holdings collection
     */
    async findById(fundId) {
        const { ObjectId } = require('mongodb');
        // Try fundId first (custom ID)
        let fund = await this.collection.findOne({ fundId });
        // Try as MongoDB ObjectId string representation
        if (!fund) {
            try {
                if (ObjectId.isValid(fundId)) {
                    fund = await this.collection.findOne({
                        _id: new ObjectId(fundId),
                    });
                }
            }
            catch (e) {
                // Not a valid ObjectId, continue
            }
        }
        // Try as regular id field (converted from _id)
        if (!fund) {
            fund = await this.collection.findOne({ id: fundId });
        }
        if (!fund)
            return null;
        // Populate holdings from holdings collection ONLY if not already in fund document
        if (!fund.holdings || fund.holdings.length === 0) {
            try {
                const holdingsCollection = mongodb_1.mongodb.getCollection('holdings');
                const holdings = await holdingsCollection
                    .find({ fundId: fund._id })
                    .sort({ percent: -1 })
                    .limit(15)
                    .toArray();
                // Add holdings to fund object only if found in separate collection
                if (holdings && holdings.length > 0) {
                    fund.holdings = holdings.map((h) => ({
                        name: h.name,
                        ticker: h.ticker,
                        percentage: h.percent,
                        sector: h.sector || 'Unknown',
                        value: h.value || 0,
                    }));
                }
            }
            catch (e) {
                console.error('Error populating holdings:', e);
                // Don't override existing holdings on error
            }
        }
        return fund;
    }
    /**
     * Find fund by MongoDB _id
     */
    async findByMongoId(id) {
        return await this.collection.findOne({ _id: id });
    }
    /**
     * Update fund
     */
    async update(fundId, updateData) {
        const result = await this.collection.findOneAndUpdate({ fundId }, {
            $set: {
                ...updateData,
                lastUpdated: new Date(),
            },
        }, { returnDocument: 'after' });
        return result || null;
    }
    /**
     * Update NAV and price data
     */
    async updateNav(fundId, nav, navDate) {
        const fund = await this.findById(fundId);
        if (!fund)
            return null;
        return await this.update(fundId, {
            previousNav: fund.currentNav,
            currentNav: nav,
            navDate,
        });
    }
    /**
     * Delete fund (soft delete)
     */
    async delete(fundId) {
        const result = await this.collection.updateOne({ fundId }, { $set: { isActive: false, lastUpdated: new Date() } });
        return result.modifiedCount > 0;
    }
    /**
     * Hard delete fund
     */
    async hardDelete(fundId) {
        const result = await this.collection.deleteOne({ fundId });
        return result.deletedCount > 0;
    }
    /**
     * Search funds by name or tags
     */
    async search(query, options = {}) {
        const filter = {
            $text: { $search: query },
            isActive: true,
        };
        if (options.category) {
            filter.category = options.category;
        }
        if (options.fundType) {
            filter.fundType = options.fundType;
        }
        return await this.collection
            .find(filter)
            .limit(options.limit || 20)
            .skip(options.skip || 0)
            .sort({ score: { $meta: 'textScore' }, _id: -1 }) // Use _id instead of popularity
            .toArray();
    }
    /**
     * Get funds by category (Zero-NA Policy Enforced)
     */
    async findByCategory(category, options = {}) {
        const query = {
            category: category,
            isActive: true,
        };
        // Enforce zero-NA policy only if explicitly enabled
        // Default: false to show all active funds
        if (options.enforceVisibility === true) {
            query.isPubliclyVisible = true;
            // @ts-ignore
            query['dataCompleteness.completenessScore'] = { $gte: 60 };
        }
        // CRITICAL: Use ONLY _id for sorting (always indexed, prevents 32MB error)
        const sort = { _id: -1 };
        return await this.collection
            .find(query)
            .sort(sort)
            .limit(options.limit || 200)
            .skip(options.skip || 0)
            .toArray();
    }
    /**
     * Get funds by category with specific subcategories filter (Zero-NA Policy)
     */
    async findByCategoryWithSubcategories(category, subcategories, options = {}) {
        const query = {
            category: category,
            subCategory: { $in: subcategories },
            isActive: true,
        };
        // Enforce zero-NA policy only if explicitly enabled
        if (options.enforceVisibility === true) {
            query.isPubliclyVisible = true;
            // @ts-ignore
            query['dataCompleteness.completenessScore'] = { $gte: 60 };
        }
        const sort = {};
        if (options.sortBy === 'returns') {
            sort['returns.oneYear'] = -1;
        }
        else if (options.sortBy === 'aum') {
            sort.aum = -1;
        }
        else {
            // Sort by popularity first, then by recency (newer first)
            sort.popularity = -1;
            sort._id = -1; // Recent funds first when popularity is same
        }
        return await this.collection
            .find(query)
            .sort(sort)
            .limit(options.limit || 20)
            .skip(options.skip || 0)
            .toArray();
    }
    /**
     * Get funds by subcategory (Zero-NA Policy)
     */
    async findBySubCategory(subCategory, options = {}) {
        const query = {
            subCategory: subCategory,
            isActive: true,
        };
        // Enforce zero-NA policy only if explicitly enabled
        if (options.enforceVisibility === true) {
            query.isPubliclyVisible = true;
            // @ts-ignore
            query['dataCompleteness.completenessScore'] = { $gte: 60 };
        }
        // CRITICAL: Use ONLY _id for sorting (always indexed, prevents 32MB error)
        const sort = { _id: -1 };
        return await this.collection
            .find(query)
            .sort(sort)
            .limit(options.limit || 200)
            .skip(options.skip || 0)
            .toArray();
    }
    /**
     * Get top performing funds
     */
    async getTopPerformers(period = 'oneYear', limit = 10) {
        // CRITICAL: Use _id instead of returns (unindexed) to prevent 32MB error
        return await this.collection
            .find({ isActive: true })
            .sort({ _id: -1 })
            .limit(limit)
            .toArray();
    }
    /**
     * Get funds by fund house
     */
    async findByFundHouse(fundHouse) {
        // CRITICAL: Use _id instead of aum (unindexed) to prevent 32MB error
        return await this.collection
            .find({ fundHouse, isActive: true })
            .sort({ _id: -1 })
            .limit(200) // Add limit for safety
            .toArray();
    }
    /**
     * Get funds by manager
     */
    async findByManager(fundManagerId) {
        return await this.collection
            .find({ fundManagerId, isActive: true })
            .sort({ _id: -1 }) // Use _id to prevent 32MB error
            .toArray();
    }
    /**
     * Bulk update funds
     */
    async bulkUpdate(updates) {
        const bulkOps = updates.map((update) => ({
            updateOne: {
                filter: { fundId: update.fundId },
                update: { $set: { ...update.data, lastUpdated: new Date() } },
                upsert: false,
            },
        }));
        return await this.collection.bulkWrite(bulkOps);
    }
    /**
     * Get funds count by category
     */
    async countByCategory() {
        return (await this.collection
            .aggregate([
            { $match: { isActive: true } },
            { $group: { _id: '$category', count: { $sum: 1 } } },
            { $project: { category: '$_id', count: 1, _id: 0 } },
        ])
            .toArray());
    }
    /**
     * Get all active funds
     */
    async findAll(options = {}) {
        const query = { isActive: true };
        // CRITICAL: Use ONLY _id for sorting (always indexed, prevents 32MB error)
        const sort = { _id: -1 };
        return await this.collection
            .find(query)
            .sort(sort)
            .limit(options.limit || 200) // Safe limit for MongoDB free tier
            .skip(options.skip || 0)
            .toArray();
    }
    /**
     * Increment popularity
     */
    async incrementPopularity(fundId) {
        await this.collection.updateOne({ fundId }, { $inc: { popularity: 1 } });
    }
}
exports.FundModel = FundModel;
