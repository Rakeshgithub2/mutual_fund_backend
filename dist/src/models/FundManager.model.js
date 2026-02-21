"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FundManagerModel = exports.FundManagerSchema = void 0;
const mongodb_1 = require("mongodb");
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
 * Zod validation schema for FundManager
 */
exports.FundManagerSchema = zod_1.z.object({
    managerId: zod_1.z.string().min(1, 'Manager ID is required'),
    name: zod_1.z.string().min(1, 'Manager name is required'),
    bio: zod_1.z.string(),
    experience: zod_1.z.number().min(0),
    qualification: zod_1.z.array(zod_1.z.string()),
    // Current Role
    currentFundHouse: zod_1.z.string(),
    designation: zod_1.z.string(),
    joinedDate: zod_1.z.date(),
    // Track Record
    fundsManaged: zod_1.z.array(zod_1.z.object({
        fundId: zod_1.z.string(),
        fundName: zod_1.z.string(),
        startDate: zod_1.z.date(),
        endDate: zod_1.z.date().optional(),
        aum: zod_1.z.number(),
        returns: zod_1.z.object({
            oneYear: zod_1.z.number(),
            threeYear: zod_1.z.number(),
            fiveYear: zod_1.z.number(),
        }),
    })),
    totalAumManaged: zod_1.z.number().min(0),
    averageReturns: zod_1.z.object({
        oneYear: zod_1.z.number(),
        threeYear: zod_1.z.number(),
        fiveYear: zod_1.z.number(),
    }),
    // Ratings & Recognition
    awards: zod_1.z.array(zod_1.z.object({
        title: zod_1.z.string(),
        year: zod_1.z.number(),
        organization: zod_1.z.string(),
    })),
    // Contact & Social
    email: zod_1.z.string().email().optional(),
    linkedin: zod_1.z.string().url().optional(),
    twitter: zod_1.z.string().optional(),
    // Metadata
    isActive: zod_1.z.boolean().default(true),
    lastUpdated: zod_1.z.date(),
    createdAt: zod_1.z.date(),
});
/**
 * FundManager Model Class
 * Manages fund manager data and relationships
 */
class FundManagerModel {
    constructor() {
        this._collection = null;
        // Don't initialize collection here - do it lazily
    }
    /**
     * Lazy-load collection to avoid initialization order issues
     */
    get collection() {
        if (!this._collection) {
            const db = getMongoDB();
            if (!db || typeof db.getCollection !== 'function') {
                throw new Error('[FundManagerModel] MongoDB instance not initialized. Ensure mongodb.connect() was called.');
            }
            this._collection = db.getCollection('fundManagers');
        }
        return this._collection;
    }
    /**
     * Get singleton instance
     */
    static getInstance() {
        if (!FundManagerModel.instance) {
            FundManagerModel.instance = new FundManagerModel();
        }
        return FundManagerModel.instance;
    }
    /**
     * Create a new fund manager
     */
    async create(managerData) {
        const now = new Date();
        const manager = {
            ...managerData,
            createdAt: managerData.createdAt || now,
            lastUpdated: managerData.lastUpdated || now,
            isActive: managerData.isActive ?? true,
            fundsManaged: managerData.fundsManaged || [],
            awards: managerData.awards || [],
            qualification: managerData.qualification || [],
        };
        const result = await this.collection.insertOne(manager);
        return { ...manager, _id: result.insertedId.toString() };
    }
    /**
     * Find manager by ID
     */
    async findById(managerId) {
        return await this.collection.findOne({ managerId });
    }
    /**
     * Find manager by MongoDB _id
     */
    async findByMongoId(id) {
        try {
            // Check if id is a valid ObjectId
            if (!mongodb_1.ObjectId.isValid(id)) {
                console.log('❌ Invalid ObjectId format:', id);
                return null;
            }
            return await this.collection.findOne({
                _id: new mongodb_1.ObjectId(id),
            });
        }
        catch (error) {
            console.error('Error in findByMongoId:', error);
            return null;
        }
    }
    /**
     * Find manager by name
     */
    async findByName(name) {
        return await this.collection.findOne({
            name: { $regex: new RegExp(name, 'i') },
        });
    }
    /**
     * Update manager
     */
    async update(managerId, updateData) {
        const result = await this.collection.findOneAndUpdate({ managerId }, {
            $set: {
                ...updateData,
                lastUpdated: new Date(),
            },
        }, { returnDocument: 'after' });
        return result || null;
    }
    /**
     * Delete manager (soft delete)
     */
    async delete(managerId) {
        const result = await this.collection.updateOne({ managerId }, { $set: { isActive: false, lastUpdated: new Date() } });
        return result.modifiedCount > 0;
    }
    /**
     * Hard delete manager
     */
    async hardDelete(managerId) {
        const result = await this.collection.deleteOne({ managerId });
        return result.deletedCount > 0;
    }
    /**
     * Search managers by name or bio
     */
    async search(query, options = {}) {
        return await this.collection
            .find({
            $text: { $search: query },
            isActive: true,
        })
            .limit(options.limit || 20)
            .skip(options.skip || 0)
            .sort({ score: { $meta: 'textScore' }, totalAumManaged: -1 })
            .toArray();
    }
    /**
     * Get managers by fund house
     */
    async findByFundHouse(fundHouse) {
        return await this.collection
            .find({ currentFundHouse: fundHouse, isActive: true })
            .sort({ totalAumManaged: -1 })
            .toArray();
    }
    /**
     * Get top managers by AUM
     */
    async getTopByAUM(limit = 10) {
        return await this.collection
            .find({ isActive: true })
            .sort({ totalAumManaged: -1 })
            .limit(limit)
            .toArray();
    }
    /**
     * Get top managers by returns
     */
    async getTopByReturns(period = 'threeYear', limit = 10) {
        const sortField = `averageReturns.${period}`;
        return await this.collection
            .find({ isActive: true })
            .sort({ [sortField]: -1 })
            .limit(limit)
            .toArray();
    }
    /**
     * Get managers by experience
     */
    async findByExperience(minYears) {
        return await this.collection
            .find({ experience: { $gte: minYears }, isActive: true })
            .sort({ experience: -1 })
            .toArray();
    }
    /**
     * Add fund to manager's portfolio
     */
    async addFund(managerId, fundData) {
        const result = await this.collection.findOneAndUpdate({ managerId }, {
            $push: {
                fundsManaged: fundData,
            },
            $set: { lastUpdated: new Date() },
        }, { returnDocument: 'after' });
        // Recalculate totals
        if (result) {
            await this.recalculateTotals(managerId);
        }
        return result || null;
    }
    /**
     * Update fund in manager's portfolio
     */
    async updateFund(managerId, fundId, updateData) {
        const result = await this.collection.findOneAndUpdate({ managerId, 'fundsManaged.fundId': fundId }, {
            $set: {
                'fundsManaged.$': updateData,
                lastUpdated: new Date(),
            },
        }, { returnDocument: 'after' });
        // Recalculate totals
        if (result) {
            await this.recalculateTotals(managerId);
        }
        return result || null;
    }
    /**
     * Remove fund from manager's portfolio
     */
    async removeFund(managerId, fundId) {
        const result = await this.collection.findOneAndUpdate({ managerId }, {
            $pull: {
                fundsManaged: { fundId },
            },
            $set: { lastUpdated: new Date() },
        }, { returnDocument: 'after' });
        // Recalculate totals
        if (result) {
            await this.recalculateTotals(managerId);
        }
        return result || null;
    }
    /**
     * Add award to manager
     */
    async addAward(managerId, award) {
        return await this.collection.findOneAndUpdate({ managerId }, {
            $push: { awards: award },
            $set: { lastUpdated: new Date() },
        }, { returnDocument: 'after' });
    }
    /**
     * Recalculate total AUM and average returns
     */
    async recalculateTotals(managerId) {
        const manager = await this.findById(managerId);
        if (!manager || manager.fundsManaged.length === 0)
            return;
        // Calculate total AUM
        const totalAumManaged = manager.fundsManaged.reduce((sum, fund) => sum + fund.aum, 0);
        // Calculate weighted average returns
        const weightedReturns = {
            oneYear: 0,
            threeYear: 0,
            fiveYear: 0,
        };
        manager.fundsManaged.forEach((fund) => {
            const weight = fund.aum / totalAumManaged;
            weightedReturns.oneYear += fund.returns.oneYear * weight;
            weightedReturns.threeYear += fund.returns.threeYear * weight;
            weightedReturns.fiveYear += fund.returns.fiveYear * weight;
        });
        await this.update(managerId, {
            totalAumManaged,
            averageReturns: weightedReturns,
        });
    }
    /**
     * Get all active managers
     */
    async findAll(options = {}) {
        const query = { isActive: true };
        const sort = {};
        if (options.sortBy === 'name') {
            sort.name = 1;
        }
        else if (options.sortBy === 'aum') {
            sort.totalAumManaged = -1;
        }
        else if (options.sortBy === 'experience') {
            sort.experience = -1;
        }
        else {
            sort.totalAumManaged = -1;
        }
        return await this.collection
            .find(query)
            .sort(sort)
            .limit(options.limit || 100)
            .skip(options.skip || 0)
            .toArray();
    }
    /**
     * Get manager statistics
     */
    async getStatistics(managerId) {
        const manager = await this.findById(managerId);
        if (!manager)
            return null;
        const bestFund = manager.fundsManaged.length > 0
            ? manager.fundsManaged.reduce((best, current) => current.returns.threeYear > best.returns.threeYear ? current : best)
            : null;
        return {
            totalFunds: manager.fundsManaged.length,
            totalAUM: manager.totalAumManaged,
            averageReturns: manager.averageReturns,
            bestPerformingFund: bestFund
                ? {
                    fundName: bestFund.fundName,
                    returns: bestFund.returns.threeYear,
                }
                : null,
            totalAwards: manager.awards.length,
        };
    }
    /**
     * Bulk update managers
     */
    async bulkUpdate(updates) {
        const bulkOps = updates.map((update) => ({
            updateOne: {
                filter: { managerId: update.managerId },
                update: { $set: { ...update.data, lastUpdated: new Date() } },
                upsert: false,
            },
        }));
        return await this.collection.bulkWrite(bulkOps);
    }
}
exports.FundManagerModel = FundManagerModel;
