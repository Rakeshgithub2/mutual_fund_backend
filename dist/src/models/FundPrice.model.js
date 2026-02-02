"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FundPriceModel = exports.FundPriceSchema = void 0;
const mongodb_1 = require("../db/mongodb");
const zod_1 = require("zod");
/**
 * Zod validation schema for FundPrice
 */
exports.FundPriceSchema = zod_1.z.object({
    fundId: zod_1.z.string().min(1, 'Fund ID is required'),
    date: zod_1.z.date(),
    nav: zod_1.z.number().positive(),
    open: zod_1.z.number().positive().optional(),
    high: zod_1.z.number().positive().optional(),
    low: zod_1.z.number().positive().optional(),
    close: zod_1.z.number().positive().optional(),
    volume: zod_1.z.number().min(0).optional(),
    changePercent: zod_1.z.number(),
    createdAt: zod_1.z.date(),
});
/**
 * FundPrice Model Class
 * Manages historical NAV/price data for funds
 */
class FundPriceModel {
    constructor() {
        this.collection = mongodb_1.mongodb.getCollection('fundPrices');
    }
    static getInstance() {
        if (!FundPriceModel.instance) {
            FundPriceModel.instance = new FundPriceModel();
        }
        return FundPriceModel.instance;
    }
    /**
     * Add new price entry
     */
    async create(priceData) {
        const price = {
            ...priceData,
            createdAt: priceData.createdAt || new Date(),
        };
        const result = await this.collection.insertOne(price);
        return { ...price, _id: result.insertedId.toString() };
    }
    /**
     * Bulk insert price data
     */
    async bulkCreate(prices) {
        const priceData = prices.map((p) => ({
            ...p,
            createdAt: p.createdAt || new Date(),
        }));
        const result = await this.collection.insertMany(priceData);
        return result.insertedCount;
    }
    /**
     * Get latest price for a fund
     */
    async getLatest(fundId) {
        return await this.collection
            .find({ fundId })
            .sort({ date: -1 })
            .limit(1)
            .next();
    }
    /**
     * Get price history for a fund
     */
    async getHistory(fundId, options = {}) {
        const filter = { fundId };
        if (options.startDate || options.endDate) {
            filter.date = {};
            if (options.startDate) {
                filter.date.$gte = options.startDate;
            }
            if (options.endDate) {
                filter.date.$lte = options.endDate;
            }
        }
        return await this.collection
            .find(filter)
            .sort({ date: -1 })
            .limit(options.limit || 365)
            .skip(options.skip || 0)
            .toArray();
    }
    /**
     * Get price for specific date
     */
    async getByDate(fundId, date) {
        // Normalize date to start of day
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        return await this.collection.findOne({
            fundId,
            date: { $gte: startOfDay, $lte: endOfDay },
        });
    }
    /**
     * Get price range
     */
    async getPriceRange(fundId, startDate, endDate) {
        return await this.collection
            .find({
            fundId,
            date: { $gte: startDate, $lte: endDate },
        })
            .sort({ date: 1 })
            .toArray();
    }
    /**
     * Calculate returns for a period
     */
    async calculateReturns(fundId, startDate, endDate) {
        const startPrice = await this.getByDate(fundId, startDate);
        const endPrice = await this.getByDate(fundId, endDate);
        if (!startPrice || !endPrice) {
            return null;
        }
        const returns = endPrice.nav - startPrice.nav;
        const returnsPercent = (returns / startPrice.nav) * 100;
        return {
            startPrice: startPrice.nav,
            endPrice: endPrice.nav,
            returns,
            returnsPercent,
        };
    }
    /**
     * Get OHLC data for charting
     */
    async getOHLC(fundId, options = {}) {
        const filter = { fundId };
        if (options.startDate || options.endDate) {
            filter.date = {};
            if (options.startDate) {
                filter.date.$gte = options.startDate;
            }
            if (options.endDate) {
                filter.date.$lte = options.endDate;
            }
        }
        const prices = await this.collection
            .find(filter)
            .sort({ date: 1 })
            .toArray();
        // For daily, return as-is
        if (options.interval === 'daily' || !options.interval) {
            return prices.map((p) => ({
                date: p.date,
                open: p.open || p.nav,
                high: p.high || p.nav,
                low: p.low || p.nav,
                close: p.close || p.nav,
                volume: p.volume,
            }));
        }
        // For weekly/monthly, aggregate
        // TODO: Implement aggregation logic
        return prices.map((p) => ({
            date: p.date,
            open: p.open || p.nav,
            high: p.high || p.nav,
            low: p.low || p.nav,
            close: p.close || p.nav,
            volume: p.volume,
        }));
    }
    /**
     * Get latest prices for multiple funds
     */
    async getLatestBatch(fundIds) {
        const prices = await this.collection
            .aggregate([
            { $match: { fundId: { $in: fundIds } } },
            { $sort: { date: -1 } },
            {
                $group: {
                    _id: '$fundId',
                    latestPrice: { $first: '$$ROOT' },
                },
            },
        ])
            .toArray();
        const priceMap = new Map();
        prices.forEach((p) => {
            priceMap.set(p._id, p.latestPrice);
        });
        return priceMap;
    }
    /**
     * Upsert price (update if exists, insert if not)
     */
    async upsert(priceData) {
        const { fundId, date, ...updateData } = priceData;
        if (!fundId || !date) {
            throw new Error('fundId and date are required for upsert');
        }
        // Normalize date to start of day
        const normalizedDate = new Date(date);
        normalizedDate.setHours(0, 0, 0, 0);
        const result = await this.collection.findOneAndUpdate({ fundId, date: normalizedDate }, {
            $set: {
                ...updateData,
                fundId,
                date: normalizedDate,
                createdAt: new Date(),
            },
        }, { upsert: true, returnDocument: 'after' });
        return result;
    }
    /**
     * Delete price data for a fund
     */
    async deleteByFund(fundId) {
        const result = await this.collection.deleteMany({ fundId });
        return result.deletedCount;
    }
    /**
     * Delete old price data (cleanup)
     */
    async deleteOlderThan(date) {
        const result = await this.collection.deleteMany({ date: { $lt: date } });
        return result.deletedCount;
    }
    /**
     * Get volatility (standard deviation of returns)
     */
    async getVolatility(fundId, startDate, endDate) {
        const prices = await this.getPriceRange(fundId, startDate, endDate);
        if (prices.length < 2) {
            return null;
        }
        // Calculate daily returns
        const returns = [];
        for (let i = 1; i < prices.length; i++) {
            const dailyReturn = (prices[i].nav - prices[i - 1].nav) / prices[i - 1].nav;
            returns.push(dailyReturn);
        }
        // Calculate standard deviation
        const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) /
            returns.length;
        const stdDev = Math.sqrt(variance);
        // Annualize (assuming 252 trading days)
        return stdDev * Math.sqrt(252);
    }
    /**
     * Get moving average
     */
    async getMovingAverage(fundId, days, endDate) {
        const end = endDate || new Date();
        const start = new Date(end);
        start.setDate(start.getDate() - days);
        const prices = await this.getPriceRange(fundId, start, end);
        if (prices.length === 0) {
            return null;
        }
        const sum = prices.reduce((total, p) => total + p.nav, 0);
        return sum / prices.length;
    }
}
exports.FundPriceModel = FundPriceModel;
FundPriceModel.instance = null;
