"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PortfolioModel = exports.PortfolioSchema = void 0;
const zod_1 = require("zod");
// Lazy import to avoid circular dependency
let mongodb = null;
function getMongoDB() {
    if (!mongodb) {
        mongodb = require('../db/mongodb').mongodb;
    }
    return mongodb;
}
/**
 * Zod validation schema for Portfolio
 */
exports.PortfolioSchema = zod_1.z.object({
    userId: zod_1.z.string().min(1, 'User ID is required'),
    portfolioId: zod_1.z.string().min(1, 'Portfolio ID is required'),
    name: zod_1.z.string().min(1, 'Portfolio name is required'),
    holdings: zod_1.z.array(zod_1.z.object({
        fundId: zod_1.z.string(),
        fundName: zod_1.z.string(),
        investmentType: zod_1.z.enum(['sip', 'lumpsum', 'both']),
        // SIP Details
        sipAmount: zod_1.z.number().optional(),
        sipDate: zod_1.z.number().min(1).max(31).optional(),
        sipStartDate: zod_1.z.date().optional(),
        sipCount: zod_1.z.number().optional(),
        // Lumpsum Details
        lumpsumInvestments: zod_1.z.array(zod_1.z.object({
            amount: zod_1.z.number(),
            date: zod_1.z.date(),
            nav: zod_1.z.number(),
            units: zod_1.z.number(),
        })),
        // Totals
        totalInvested: zod_1.z.number(),
        totalUnits: zod_1.z.number(),
        currentValue: zod_1.z.number(),
        currentNav: zod_1.z.number(),
        returns: zod_1.z.number(),
        returnsPercent: zod_1.z.number(),
        xirr: zod_1.z.number(),
        addedAt: zod_1.z.date(),
        lastUpdated: zod_1.z.date(),
    })),
    // Portfolio Summary
    totalInvested: zod_1.z.number(),
    currentValue: zod_1.z.number(),
    totalReturns: zod_1.z.number(),
    returnsPercent: zod_1.z.number(),
    xirr: zod_1.z.number(),
    // Allocation
    categoryAllocation: zod_1.z.array(zod_1.z.object({
        category: zod_1.z.string(),
        value: zod_1.z.number(),
        percentage: zod_1.z.number(),
    })),
    sectorAllocation: zod_1.z.array(zod_1.z.object({
        sector: zod_1.z.string(),
        value: zod_1.z.number(),
        percentage: zod_1.z.number(),
    })),
    isActive: zod_1.z.boolean().default(true),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
/**
 * Portfolio Model Class
 * Manages user investment portfolios
 */
class PortfolioModel {
    constructor() {
        this._collection = null;
        // Don't initialize collection here - do it lazily
    }
    get collection() {
        if (!this._collection) {
            const db = getMongoDB();
            this._collection = db.getCollection('portfolios');
        }
        return this._collection;
    }
    static getInstance() {
        if (!PortfolioModel.instance) {
            PortfolioModel.instance = new PortfolioModel();
        }
        return PortfolioModel.instance;
    }
    /**
     * Create a new portfolio
     */
    async create(portfolioData) {
        const now = new Date();
        const portfolio = {
            ...portfolioData,
            holdings: portfolioData.holdings || [],
            categoryAllocation: portfolioData.categoryAllocation || [],
            sectorAllocation: portfolioData.sectorAllocation || [],
            totalInvested: portfolioData.totalInvested || 0,
            currentValue: portfolioData.currentValue || 0,
            totalReturns: portfolioData.totalReturns || 0,
            returnsPercent: portfolioData.returnsPercent || 0,
            xirr: portfolioData.xirr || 0,
            isActive: portfolioData.isActive ?? true,
            createdAt: portfolioData.createdAt || now,
            updatedAt: portfolioData.updatedAt || now,
        };
        const result = await this.collection.insertOne(portfolio);
        return { ...portfolio, _id: result.insertedId.toString() };
    }
    /**
     * Find portfolio by ID
     */
    async findById(userId, portfolioId) {
        return await this.collection.findOne({ userId, portfolioId });
    }
    /**
     * Get all user portfolios
     */
    async getUserPortfolios(userId) {
        return await this.collection
            .find({ userId, isActive: true })
            .sort({ createdAt: -1 })
            .toArray();
    }
    /**
     * Update portfolio
     */
    async update(userId, portfolioId, updateData) {
        const result = await this.collection.findOneAndUpdate({ userId, portfolioId }, {
            $set: {
                ...updateData,
                updatedAt: new Date(),
            },
        }, { returnDocument: 'after' });
        return result || null;
    }
    /**
     * Add holding to portfolio
     */
    async addHolding(userId, portfolioId, holding) {
        const now = new Date();
        const holdingData = {
            ...holding,
            addedAt: holding.addedAt || now,
            lastUpdated: holding.lastUpdated || now,
        };
        const result = await this.collection.findOneAndUpdate({ userId, portfolioId }, {
            $push: { holdings: holdingData },
            $set: { updatedAt: new Date() },
        }, { returnDocument: 'after' });
        // Recalculate portfolio totals
        if (result) {
            await this.recalculateTotals(userId, portfolioId);
        }
        return result || null;
    }
    /**
     * Update holding
     */
    async updateHolding(userId, portfolioId, fundId, updateData) {
        const portfolio = await this.findById(userId, portfolioId);
        if (!portfolio)
            return null;
        const holdingIndex = portfolio.holdings.findIndex((h) => h.fundId === fundId);
        if (holdingIndex === -1)
            return null;
        portfolio.holdings[holdingIndex] = {
            ...portfolio.holdings[holdingIndex],
            ...updateData,
            lastUpdated: new Date(),
        };
        const result = await this.collection.findOneAndUpdate({ userId, portfolioId }, {
            $set: {
                holdings: portfolio.holdings,
                updatedAt: new Date(),
            },
        }, { returnDocument: 'after' });
        // Recalculate portfolio totals
        if (result) {
            await this.recalculateTotals(userId, portfolioId);
        }
        return result || null;
    }
    /**
     * Remove holding
     */
    async removeHolding(userId, portfolioId, fundId) {
        const result = await this.collection.findOneAndUpdate({ userId, portfolioId }, {
            $pull: { holdings: { fundId } },
            $set: { updatedAt: new Date() },
        }, { returnDocument: 'after' });
        // Recalculate portfolio totals
        if (result) {
            await this.recalculateTotals(userId, portfolioId);
        }
        return result || null;
    }
    /**
     * Add lumpsum investment
     */
    async addLumpsumInvestment(userId, portfolioId, fundId, investment) {
        const portfolio = await this.findById(userId, portfolioId);
        if (!portfolio)
            return null;
        const holdingIndex = portfolio.holdings.findIndex((h) => h.fundId === fundId);
        if (holdingIndex === -1)
            return null;
        portfolio.holdings[holdingIndex].lumpsumInvestments.push(investment);
        const result = await this.collection.findOneAndUpdate({ userId, portfolioId }, {
            $set: {
                holdings: portfolio.holdings,
                updatedAt: new Date(),
            },
        }, { returnDocument: 'after' });
        // Recalculate holding and portfolio totals
        if (result) {
            await this.recalculateHolding(userId, portfolioId, fundId);
            await this.recalculateTotals(userId, portfolioId);
        }
        return result || null;
    }
    /**
     * Recalculate holding totals
     */
    async recalculateHolding(userId, portfolioId, fundId) {
        const portfolio = await this.findById(userId, portfolioId);
        if (!portfolio)
            return;
        const holdingIndex = portfolio.holdings.findIndex((h) => h.fundId === fundId);
        if (holdingIndex === -1)
            return;
        const holding = portfolio.holdings[holdingIndex];
        // Calculate total invested
        let totalInvested = 0;
        let totalUnits = 0;
        // From lumpsum
        holding.lumpsumInvestments.forEach((inv) => {
            totalInvested += inv.amount;
            totalUnits += inv.units;
        });
        // From SIP (if applicable)
        if (holding.sipAmount && holding.sipCount) {
            totalInvested += holding.sipAmount * holding.sipCount;
            // Units calculation would need historical NAV data
        }
        // Calculate current value
        const currentValue = totalUnits * holding.currentNav;
        // Calculate returns
        const returns = currentValue - totalInvested;
        const returnsPercent = totalInvested > 0 ? (returns / totalInvested) * 100 : 0;
        // Update holding
        portfolio.holdings[holdingIndex] = {
            ...holding,
            totalInvested,
            totalUnits,
            currentValue,
            returns,
            returnsPercent,
            lastUpdated: new Date(),
        };
        await this.collection.updateOne({ userId, portfolioId }, {
            $set: {
                holdings: portfolio.holdings,
                updatedAt: new Date(),
            },
        });
    }
    /**
     * Recalculate portfolio totals
     */
    async recalculateTotals(userId, portfolioId) {
        const portfolio = await this.findById(userId, portfolioId);
        if (!portfolio)
            return;
        // Calculate totals
        let totalInvested = 0;
        let currentValue = 0;
        portfolio.holdings.forEach((holding) => {
            totalInvested += holding.totalInvested;
            currentValue += holding.currentValue;
        });
        const totalReturns = currentValue - totalInvested;
        const returnsPercent = totalInvested > 0 ? (totalReturns / totalInvested) * 100 : 0;
        // Calculate category allocation
        const categoryMap = new Map();
        portfolio.holdings.forEach((holding) => {
            // Would need to fetch fund details for category
            // For now, we'll skip this
        });
        await this.collection.updateOne({ userId, portfolioId }, {
            $set: {
                totalInvested,
                currentValue,
                totalReturns,
                returnsPercent,
                updatedAt: new Date(),
            },
        });
    }
    /**
     * Delete portfolio (soft delete)
     */
    async delete(userId, portfolioId) {
        const result = await this.collection.updateOne({ userId, portfolioId }, { $set: { isActive: false, updatedAt: new Date() } });
        return result.modifiedCount > 0;
    }
    /**
     * Hard delete portfolio
     */
    async hardDelete(userId, portfolioId) {
        const result = await this.collection.deleteOne({ userId, portfolioId });
        return result.deletedCount > 0;
    }
    /**
     * Get portfolio summary
     */
    async getSummary(userId, portfolioId) {
        const portfolio = await this.findById(userId, portfolioId);
        if (!portfolio)
            return null;
        // Sort holdings by value
        const sortedHoldings = [...portfolio.holdings].sort((a, b) => b.currentValue - a.currentValue);
        const topHoldings = sortedHoldings.slice(0, 5).map((h) => ({
            fundName: h.fundName,
            value: h.currentValue,
            percentage: (h.currentValue / portfolio.currentValue) * 100,
        }));
        return {
            totalInvested: portfolio.totalInvested,
            currentValue: portfolio.currentValue,
            totalReturns: portfolio.totalReturns,
            returnsPercent: portfolio.returnsPercent,
            xirr: portfolio.xirr,
            holdingsCount: portfolio.holdings.length,
            topHoldings,
        };
    }
    /**
     * Get portfolio with fund details
     */
    async getWithFundDetails(userId, portfolioId) {
        const result = await this.collection
            .aggregate([
            { $match: { userId, portfolioId } },
            { $unwind: '$holdings' },
            {
                $lookup: {
                    from: 'funds',
                    localField: 'holdings.fundId',
                    foreignField: 'fundId',
                    as: 'fundDetails',
                },
            },
            {
                $unwind: { path: '$fundDetails', preserveNullAndEmptyArrays: true },
            },
            {
                $group: {
                    _id: '$_id',
                    userId: { $first: '$userId' },
                    portfolioId: { $first: '$portfolioId' },
                    name: { $first: '$name' },
                    holdings: {
                        $push: {
                            holding: '$holdings',
                            fundDetails: '$fundDetails',
                        },
                    },
                    totalInvested: { $first: '$totalInvested' },
                    currentValue: { $first: '$currentValue' },
                    totalReturns: { $first: '$totalReturns' },
                    returnsPercent: { $first: '$returnsPercent' },
                    xirr: { $first: '$xirr' },
                    createdAt: { $first: '$createdAt' },
                    updatedAt: { $first: '$updatedAt' },
                },
            },
        ])
            .next();
        return result;
    }
}
exports.PortfolioModel = PortfolioModel;
PortfolioModel.instance = null;
