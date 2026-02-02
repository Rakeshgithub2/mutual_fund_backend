"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserModel = exports.UserSchema = void 0;
const mongodb_1 = require("../db/mongodb");
const zod_1 = require("zod");
/**
 * Zod validation schema for User
 */
exports.UserSchema = zod_1.z.object({
    userId: zod_1.z.string().min(1, 'User ID is required'),
    googleId: zod_1.z.string(),
    email: zod_1.z.string().email('Valid email is required'),
    emailVerified: zod_1.z.boolean().default(false),
    // Profile
    name: zod_1.z.string().min(1, 'Name is required'),
    firstName: zod_1.z.string(),
    lastName: zod_1.z.string(),
    picture: zod_1.z.string().url().optional(),
    phone: zod_1.z.string().optional(),
    // Preferences
    preferences: zod_1.z.object({
        theme: zod_1.z.enum(['light', 'dark']).default('light'),
        language: zod_1.z.enum(['en', 'hi']).default('en'),
        currency: zod_1.z.string().default('INR'),
        riskProfile: zod_1.z
            .enum(['conservative', 'moderate', 'aggressive'])
            .default('moderate'),
        notifications: zod_1.z.object({
            email: zod_1.z.boolean().default(true),
            push: zod_1.z.boolean().default(true),
            priceAlerts: zod_1.z.boolean().default(true),
            newsAlerts: zod_1.z.boolean().default(true),
        }),
    }),
    // KYC Status
    kyc: zod_1.z.object({
        status: zod_1.z.enum(['pending', 'verified', 'rejected']).default('pending'),
        panNumber: zod_1.z.string().optional(),
        aadharNumber: zod_1.z.string().optional(),
        verifiedAt: zod_1.z.date().optional(),
    }),
    // Subscription
    subscription: zod_1.z.object({
        plan: zod_1.z.enum(['free', 'basic', 'premium']).default('free'),
        startDate: zod_1.z.date().optional(),
        endDate: zod_1.z.date().optional(),
        autoRenew: zod_1.z.boolean().default(false),
    }),
    // Security
    refreshTokens: zod_1.z.array(zod_1.z.string()).default([]),
    lastLogin: zod_1.z.date(),
    loginHistory: zod_1.z.array(zod_1.z.object({
        timestamp: zod_1.z.date(),
        ip: zod_1.z.string(),
        userAgent: zod_1.z.string(),
    })),
    // Metadata
    isActive: zod_1.z.boolean().default(true),
    isBlocked: zod_1.z.boolean().default(false),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
/**
 * User Model Class
 * Manages user authentication, profiles, and preferences
 */
class UserModel {
    constructor() {
        this.collection = mongodb_1.mongodb.getCollection('users');
    }
    static getInstance() {
        if (!UserModel.instance) {
            UserModel.instance = new UserModel();
        }
        return UserModel.instance;
    }
    /**
     * Create a new user
     */
    async create(userData) {
        const now = new Date();
        // Set default preferences
        const defaultPreferences = {
            theme: 'light',
            language: 'en',
            currency: 'INR',
            riskProfile: 'moderate',
            notifications: {
                email: true,
                push: true,
                priceAlerts: true,
                newsAlerts: true,
            },
        };
        const defaultKyc = {
            status: 'pending',
        };
        const defaultSubscription = {
            plan: 'free',
            autoRenew: false,
        };
        const user = {
            ...userData,
            preferences: { ...defaultPreferences, ...userData.preferences },
            kyc: { ...defaultKyc, ...userData.kyc },
            subscription: { ...defaultSubscription, ...userData.subscription },
            refreshTokens: userData.refreshTokens || [],
            loginHistory: userData.loginHistory || [],
            lastLogin: userData.lastLogin || now,
            isActive: userData.isActive ?? true,
            isBlocked: userData.isBlocked ?? false,
            createdAt: userData.createdAt || now,
            updatedAt: userData.updatedAt || now,
        };
        const result = await this.collection.insertOne(user);
        return { ...user, _id: result.insertedId.toString() };
    }
    /**
     * Find user by ID
     */
    async findById(userId) {
        return await this.collection.findOne({ userId });
    }
    /**
     * Find user by email
     */
    async findByEmail(email) {
        return await this.collection.findOne({ email });
    }
    /**
     * Find user by Google ID
     */
    async findByGoogleId(googleId) {
        return await this.collection.findOne({ googleId });
    }
    /**
     * Find user by MongoDB _id
     */
    async findByMongoId(id) {
        return await this.collection.findOne({ _id: id });
    }
    /**
     * Update user
     */
    async update(userId, updateData) {
        const result = await this.collection.findOneAndUpdate({ userId }, {
            $set: {
                ...updateData,
                updatedAt: new Date(),
            },
        }, { returnDocument: 'after' });
        return result || null;
    }
    /**
     * Update user profile
     */
    async updateProfile(userId, profileData) {
        return await this.update(userId, profileData);
    }
    /**
     * Update preferences
     */
    async updatePreferences(userId, preferences) {
        const user = await this.findById(userId);
        if (!user)
            return null;
        const updatedPreferences = {
            ...user.preferences,
            ...preferences,
            notifications: {
                ...user.preferences.notifications,
                ...(preferences.notifications || {}),
            },
        };
        return await this.update(userId, { preferences: updatedPreferences });
    }
    /**
     * Update KYC status
     */
    async updateKYC(userId, kycData) {
        const user = await this.findById(userId);
        if (!user)
            return null;
        const updatedKyc = {
            ...user.kyc,
            ...kycData,
        };
        if (kycData.status === 'verified' && !updatedKyc.verifiedAt) {
            updatedKyc.verifiedAt = new Date();
        }
        return await this.update(userId, { kyc: updatedKyc });
    }
    /**
     * Update subscription
     */
    async updateSubscription(userId, subscriptionData) {
        const user = await this.findById(userId);
        if (!user)
            return null;
        const updatedSubscription = {
            ...user.subscription,
            ...subscriptionData,
        };
        return await this.update(userId, { subscription: updatedSubscription });
    }
    /**
     * Add refresh token
     */
    async addRefreshToken(userId, token) {
        return await this.collection.findOneAndUpdate({ userId }, {
            $push: { refreshTokens: token },
            $set: { updatedAt: new Date() },
        }, { returnDocument: 'after' });
    }
    /**
     * Remove refresh token
     */
    async removeRefreshToken(userId, token) {
        return await this.collection.findOneAndUpdate({ userId }, {
            $pull: { refreshTokens: token },
            $set: { updatedAt: new Date() },
        }, { returnDocument: 'after' });
    }
    /**
     * Clear all refresh tokens
     */
    async clearRefreshTokens(userId) {
        return await this.update(userId, { refreshTokens: [] });
    }
    /**
     * Record login
     */
    async recordLogin(userId, loginData) {
        const loginEntry = {
            timestamp: new Date(),
            ip: loginData.ip,
            userAgent: loginData.userAgent,
        };
        return await this.collection.findOneAndUpdate({ userId }, {
            $push: {
                loginHistory: {
                    $each: [loginEntry],
                    $slice: -50, // Keep only last 50 logins
                },
            },
            $set: {
                lastLogin: new Date(),
                updatedAt: new Date(),
            },
        }, { returnDocument: 'after' });
    }
    /**
     * Block user
     */
    async blockUser(userId) {
        return await this.update(userId, { isBlocked: true, isActive: false });
    }
    /**
     * Unblock user
     */
    async unblockUser(userId) {
        return await this.update(userId, { isBlocked: false, isActive: true });
    }
    /**
     * Deactivate user
     */
    async deactivate(userId) {
        return await this.update(userId, { isActive: false });
    }
    /**
     * Reactivate user
     */
    async reactivate(userId) {
        return await this.update(userId, { isActive: true });
    }
    /**
     * Delete user (soft delete)
     */
    async delete(userId) {
        const result = await this.collection.updateOne({ userId }, { $set: { isActive: false, updatedAt: new Date() } });
        return result.modifiedCount > 0;
    }
    /**
     * Hard delete user
     */
    async hardDelete(userId) {
        const result = await this.collection.deleteOne({ userId });
        return result.deletedCount > 0;
    }
    /**
     * Get active users count
     */
    async getActiveCount() {
        return await this.collection.countDocuments({
            isActive: true,
            isBlocked: false,
        });
    }
    /**
     * Get users by subscription plan
     */
    async findBySubscription(plan) {
        return await this.collection
            .find({
            'subscription.plan': plan,
            isActive: true,
        })
            .toArray();
    }
    /**
     * Get users with expired subscriptions
     */
    async findExpiredSubscriptions() {
        const now = new Date();
        return await this.collection
            .find({
            'subscription.endDate': { $lt: now },
            'subscription.plan': { $ne: 'free' },
            isActive: true,
        })
            .toArray();
    }
    /**
     * Get users with pending KYC
     */
    async findPendingKYC() {
        return await this.collection
            .find({
            'kyc.status': 'pending',
            isActive: true,
        })
            .toArray();
    }
    /**
     * Search users
     */
    async search(query, options = {}) {
        const searchRegex = new RegExp(query, 'i');
        return await this.collection
            .find({
            $or: [{ name: searchRegex }, { email: searchRegex }],
            isActive: true,
        })
            .limit(options.limit || 20)
            .skip(options.skip || 0)
            .toArray();
    }
    /**
     * Get user statistics
     */
    async getStatistics(userId) {
        const user = await this.findById(userId);
        if (!user)
            return null;
        const now = new Date();
        const accountAge = Math.floor((now.getTime() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24));
        const lastLoginDaysAgo = Math.floor((now.getTime() - user.lastLogin.getTime()) / (1000 * 60 * 60 * 24));
        return {
            accountAge,
            loginCount: user.loginHistory.length,
            lastLoginDaysAgo,
            subscriptionStatus: user.subscription.plan,
            kycStatus: user.kyc.status,
        };
    }
    /**
     * Get all active users
     */
    async findAll(options = {}) {
        const query = { isActive: true };
        const sort = {};
        if (options.sortBy === 'name') {
            sort.name = 1;
        }
        else if (options.sortBy === 'email') {
            sort.email = 1;
        }
        else {
            sort.createdAt = -1;
        }
        return await this.collection
            .find(query)
            .sort(sort)
            .limit(options.limit || 100)
            .skip(options.skip || 0)
            .toArray();
    }
    /**
     * Bulk update users
     */
    async bulkUpdate(updates) {
        const bulkOps = updates.map((update) => ({
            updateOne: {
                filter: { userId: update.userId },
                update: { $set: { ...update.data, updatedAt: new Date() } },
                upsert: false,
            },
        }));
        return await this.collection.bulkWrite(bulkOps);
    }
}
exports.UserModel = UserModel;
UserModel.instance = null;
