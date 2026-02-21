"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoalModel = exports.GoalSchema = void 0;
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
 * Zod validation schema for Goal
 */
exports.GoalSchema = zod_1.z.object({
    userId: zod_1.z.string().min(1, 'User ID is required'),
    goalId: zod_1.z.string().min(1, 'Goal ID is required'),
    title: zod_1.z.string().min(1, 'Title is required'),
    description: zod_1.z.string(),
    // Financial Details
    targetAmount: zod_1.z.number().positive('Target amount must be positive'),
    currentSavings: zod_1.z.number().min(0, 'Current savings cannot be negative'),
    monthlyInvestment: zod_1.z.number().min(0, 'Monthly investment cannot be negative'),
    timeframe: zod_1.z.number().positive('Timeframe must be positive'),
    // Suggested Funds
    suggestedFunds: zod_1.z.array(zod_1.z.object({
        fundId: zod_1.z.string(),
        fundName: zod_1.z.string(),
        allocationPercent: zod_1.z.number().min(0).max(100),
        sipAmount: zod_1.z.number().min(0),
    })),
    // Progress
    status: zod_1.z.enum(['active', 'completed', 'paused']).default('active'),
    progress: zod_1.z.number().min(0).max(100),
    projectedCompletionDate: zod_1.z.date(),
    // Metadata
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
/**
 * Goal Model Class
 * Manages financial goals and investment planning
 */
class GoalModel {
    constructor() {
        this._collection = null;
        // Don't initialize collection here - do it lazily
    }
    get collection() {
        if (!this._collection) {
            const db = getMongoDB();
            this._collection = db.getCollection('goals');
        }
        return this._collection;
    }
    static getInstance() {
        if (!GoalModel.instance) {
            GoalModel.instance = new GoalModel();
        }
        return GoalModel.instance;
    }
    /**
     * Create a new goal
     */
    async create(goalData) {
        const now = new Date();
        // Calculate projected completion date
        const projectedDate = new Date();
        projectedDate.setFullYear(projectedDate.getFullYear() + (goalData.timeframe || 0));
        const goal = {
            ...goalData,
            suggestedFunds: goalData.suggestedFunds || [],
            status: goalData.status || 'active',
            progress: goalData.progress || 0,
            projectedCompletionDate: goalData.projectedCompletionDate || projectedDate,
            createdAt: goalData.createdAt || now,
            updatedAt: goalData.updatedAt || now,
        };
        const result = await this.collection.insertOne(goal);
        return { ...goal, _id: result.insertedId.toString() };
    }
    /**
     * Find goal by ID
     */
    async findById(userId, goalId) {
        return await this.collection.findOne({ userId, goalId });
    }
    /**
     * Get all user goals
     */
    async getUserGoals(userId, options = {}) {
        const filter = { userId };
        if (options.status) {
            filter.status = options.status;
        }
        return await this.collection
            .find(filter)
            .sort({ createdAt: -1 })
            .limit(options.limit || 100)
            .skip(options.skip || 0)
            .toArray();
    }
    /**
     * Update goal
     */
    async update(userId, goalId, updateData) {
        const result = await this.collection.findOneAndUpdate({ userId, goalId }, {
            $set: {
                ...updateData,
                updatedAt: new Date(),
            },
        }, { returnDocument: 'after' });
        return result || null;
    }
    /**
     * Update progress
     */
    async updateProgress(userId, goalId, currentSavings) {
        const goal = await this.findById(userId, goalId);
        if (!goal)
            return null;
        const progress = Math.min((currentSavings / goal.targetAmount) * 100, 100);
        const status = progress >= 100 ? 'completed' : goal.status;
        return await this.update(userId, goalId, {
            currentSavings,
            progress,
            status,
        });
    }
    /**
     * Update status
     */
    async updateStatus(userId, goalId, status) {
        return await this.update(userId, goalId, { status });
    }
    /**
     * Add suggested fund
     */
    async addSuggestedFund(userId, goalId, fund) {
        const result = await this.collection.findOneAndUpdate({ userId, goalId }, {
            $push: { suggestedFunds: fund },
            $set: { updatedAt: new Date() },
        }, { returnDocument: 'after' });
        return result || null;
    }
    /**
     * Remove suggested fund
     */
    async removeSuggestedFund(userId, goalId, fundId) {
        const result = await this.collection.findOneAndUpdate({ userId, goalId }, {
            $pull: { suggestedFunds: { fundId } },
            $set: { updatedAt: new Date() },
        }, { returnDocument: 'after' });
        return result || null;
    }
    /**
     * Update suggested fund allocation
     */
    async updateSuggestedFund(userId, goalId, fundId, updateData) {
        const goal = await this.findById(userId, goalId);
        if (!goal)
            return null;
        const fundIndex = goal.suggestedFunds.findIndex((f) => f.fundId === fundId);
        if (fundIndex === -1)
            return null;
        goal.suggestedFunds[fundIndex] = {
            ...goal.suggestedFunds[fundIndex],
            ...updateData,
        };
        const result = await this.collection.findOneAndUpdate({ userId, goalId }, {
            $set: {
                suggestedFunds: goal.suggestedFunds,
                updatedAt: new Date(),
            },
        }, { returnDocument: 'after' });
        return result || null;
    }
    /**
     * Delete goal (hard delete)
     */
    async delete(userId, goalId) {
        const result = await this.collection.deleteOne({ userId, goalId });
        return result.deletedCount > 0;
    }
    /**
     * Get active goals count
     */
    async getActiveCount(userId) {
        return await this.collection.countDocuments({ userId, status: 'active' });
    }
    /**
     * Get completed goals count
     */
    async getCompletedCount(userId) {
        return await this.collection.countDocuments({
            userId,
            status: 'completed',
        });
    }
    /**
     * Get goals by status
     */
    async getByStatus(userId, status) {
        return await this.collection
            .find({ userId, status })
            .sort({ createdAt: -1 })
            .toArray();
    }
    /**
     * Get goals nearing completion
     */
    async getGoalsNearingCompletion(userId, threshold = 80) {
        return await this.collection
            .find({
            userId,
            status: 'active',
            progress: { $gte: threshold },
        })
            .sort({ progress: -1 })
            .toArray();
    }
    /**
     * Get goals with projected completion within timeframe
     */
    async getGoalsDueWithin(userId, months) {
        const targetDate = new Date();
        targetDate.setMonth(targetDate.getMonth() + months);
        return await this.collection
            .find({
            userId,
            status: 'active',
            projectedCompletionDate: { $lte: targetDate },
        })
            .sort({ projectedCompletionDate: 1 })
            .toArray();
    }
    /**
     * Calculate required monthly investment
     */
    calculateRequiredMonthlyInvestment(targetAmount, currentSavings, timeframeYears, expectedReturnRate = 12 // Default 12% annual return
    ) {
        const monthlyRate = expectedReturnRate / 12 / 100;
        const months = timeframeYears * 12;
        // Future value of current savings
        const futureValueOfSavings = currentSavings * Math.pow(1 + monthlyRate, months);
        // Remaining amount needed
        const remainingAmount = targetAmount - futureValueOfSavings;
        if (remainingAmount <= 0) {
            return 0; // Goal already achieved
        }
        // Calculate SIP amount using future value of annuity formula
        const sipAmount = remainingAmount / ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
        return Math.ceil(sipAmount);
    }
    /**
     * Calculate projected completion date
     */
    calculateProjectedCompletionDate(targetAmount, currentSavings, monthlyInvestment, expectedReturnRate = 12) {
        if (monthlyInvestment <= 0) {
            return null;
        }
        const monthlyRate = expectedReturnRate / 12 / 100;
        let currentValue = currentSavings;
        let months = 0;
        const maxMonths = 600; // 50 years max
        while (currentValue < targetAmount && months < maxMonths) {
            currentValue = currentValue * (1 + monthlyRate) + monthlyInvestment;
            months++;
        }
        if (months >= maxMonths) {
            return null; // Goal not achievable with current plan
        }
        const completionDate = new Date();
        completionDate.setMonth(completionDate.getMonth() + months);
        return completionDate;
    }
    /**
     * Get goal statistics
     */
    async getStatistics(userId) {
        const goals = await this.collection.find({ userId }).toArray();
        const stats = {
            totalGoals: goals.length,
            activeGoals: goals.filter((g) => g.status === 'active').length,
            completedGoals: goals.filter((g) => g.status === 'completed').length,
            pausedGoals: goals.filter((g) => g.status === 'paused').length,
            totalTargetAmount: goals.reduce((sum, g) => sum + g.targetAmount, 0),
            totalCurrentSavings: goals.reduce((sum, g) => sum + g.currentSavings, 0),
            totalMonthlyInvestment: goals.reduce((sum, g) => sum + g.monthlyInvestment, 0),
            averageProgress: goals.length > 0
                ? goals.reduce((sum, g) => sum + g.progress, 0) / goals.length
                : 0,
        };
        return stats;
    }
    /**
     * Get goal with suggested fund details
     */
    async getWithFundDetails(userId, goalId) {
        const result = await this.collection
            .aggregate([
            { $match: { userId, goalId } },
            {
                $unwind: {
                    path: '$suggestedFunds',
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $lookup: {
                    from: 'funds',
                    localField: 'suggestedFunds.fundId',
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
                    goalId: { $first: '$goalId' },
                    title: { $first: '$title' },
                    description: { $first: '$description' },
                    targetAmount: { $first: '$targetAmount' },
                    currentSavings: { $first: '$currentSavings' },
                    monthlyInvestment: { $first: '$monthlyInvestment' },
                    timeframe: { $first: '$timeframe' },
                    suggestedFunds: {
                        $push: {
                            $cond: {
                                if: { $ifNull: ['$suggestedFunds', false] },
                                then: {
                                    fund: '$suggestedFunds',
                                    details: '$fundDetails',
                                },
                                else: '$$REMOVE',
                            },
                        },
                    },
                    status: { $first: '$status' },
                    progress: { $first: '$progress' },
                    projectedCompletionDate: { $first: '$projectedCompletionDate' },
                    createdAt: { $first: '$createdAt' },
                    updatedAt: { $first: '$updatedAt' },
                },
            },
        ])
            .next();
        return result;
    }
}
exports.GoalModel = GoalModel;
GoalModel.instance = null;
