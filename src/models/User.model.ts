import { Collection, Filter } from 'mongodb';
import { mongodb } from '../db/mongodb';
import { User } from '../db/schemas';
import { z } from 'zod';

/**
 * Zod validation schema for User
 */
export const UserSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  googleId: z.string(),
  email: z.string().email('Valid email is required'),
  emailVerified: z.boolean().default(false),

  // Profile
  name: z.string().min(1, 'Name is required'),
  firstName: z.string(),
  lastName: z.string(),
  picture: z.string().url().optional(),
  phone: z.string().optional(),

  // Preferences
  preferences: z.object({
    theme: z.enum(['light', 'dark']).default('light'),
    language: z.enum(['en', 'hi']).default('en'),
    currency: z.string().default('INR'),
    riskProfile: z
      .enum(['conservative', 'moderate', 'aggressive'])
      .default('moderate'),
    notifications: z.object({
      email: z.boolean().default(true),
      push: z.boolean().default(true),
      priceAlerts: z.boolean().default(true),
      newsAlerts: z.boolean().default(true),
    }),
  }),

  // KYC Status
  kyc: z.object({
    status: z.enum(['pending', 'verified', 'rejected']).default('pending'),
    panNumber: z.string().optional(),
    aadharNumber: z.string().optional(),
    verifiedAt: z.date().optional(),
  }),

  // Subscription
  subscription: z.object({
    plan: z.enum(['free', 'basic', 'premium']).default('free'),
    startDate: z.date().optional(),
    endDate: z.date().optional(),
    autoRenew: z.boolean().default(false),
  }),

  // Security
  refreshTokens: z.array(z.string()).default([]),
  lastLogin: z.date(),
  loginHistory: z.array(
    z.object({
      timestamp: z.date(),
      ip: z.string(),
      userAgent: z.string(),
    })
  ),

  // Metadata
  isActive: z.boolean().default(true),
  isBlocked: z.boolean().default(false),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type UserInput = z.infer<typeof UserSchema>;

/**
 * User Model Class
 * Manages user authentication, profiles, and preferences
 */
export class UserModel {
  private static instance: UserModel | null = null;
  private collection: Collection<User>;

  private constructor() {
    this.collection = mongodb.getCollection<User>('users');
  }

  static getInstance(): UserModel {
    if (!UserModel.instance) {
      UserModel.instance = new UserModel();
    }
    return UserModel.instance;
  }

  /**
   * Create a new user
   */
  async create(userData: Partial<User>): Promise<User> {
    const now = new Date();

    // Set default preferences
    const defaultPreferences = {
      theme: 'light' as const,
      language: 'en' as const,
      currency: 'INR',
      riskProfile: 'moderate' as const,
      notifications: {
        email: true,
        push: true,
        priceAlerts: true,
        newsAlerts: true,
      },
    };

    const defaultKyc = {
      status: 'pending' as const,
    };

    const defaultSubscription = {
      plan: 'free' as const,
      autoRenew: false,
    };

    const user: User = {
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
    } as User;

    const result = await this.collection.insertOne(user as any);
    return { ...user, _id: result.insertedId.toString() };
  }

  /**
   * Find user by ID
   */
  async findById(userId: string): Promise<User | null> {
    return await this.collection.findOne({ userId });
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    return await this.collection.findOne({ email });
  }

  /**
   * Find user by Google ID
   */
  async findByGoogleId(googleId: string): Promise<User | null> {
    return await this.collection.findOne({ googleId });
  }

  /**
   * Find user by MongoDB _id
   */
  async findByMongoId(id: string): Promise<User | null> {
    return await this.collection.findOne({ _id: id } as Filter<User>);
  }

  /**
   * Update user
   */
  async update(
    userId: string,
    updateData: Partial<User>
  ): Promise<User | null> {
    const result = await this.collection.findOneAndUpdate(
      { userId },
      {
        $set: {
          ...updateData,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );
    return result || null;
  }

  /**
   * Update user profile
   */
  async updateProfile(
    userId: string,
    profileData: {
      name?: string;
      firstName?: string;
      lastName?: string;
      picture?: string;
      phone?: string;
    }
  ): Promise<User | null> {
    return await this.update(userId, profileData);
  }

  /**
   * Update preferences
   */
  async updatePreferences(
    userId: string,
    preferences: Partial<User['preferences']>
  ): Promise<User | null> {
    const user = await this.findById(userId);
    if (!user) return null;

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
  async updateKYC(
    userId: string,
    kycData: Partial<User['kyc']>
  ): Promise<User | null> {
    const user = await this.findById(userId);
    if (!user) return null;

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
  async updateSubscription(
    userId: string,
    subscriptionData: Partial<User['subscription']>
  ): Promise<User | null> {
    const user = await this.findById(userId);
    if (!user) return null;

    const updatedSubscription = {
      ...user.subscription,
      ...subscriptionData,
    };

    return await this.update(userId, { subscription: updatedSubscription });
  }

  /**
   * Add refresh token
   */
  async addRefreshToken(userId: string, token: string): Promise<User | null> {
    return await this.collection.findOneAndUpdate(
      { userId },
      {
        $push: { refreshTokens: token },
        $set: { updatedAt: new Date() },
      },
      { returnDocument: 'after' }
    );
  }

  /**
   * Remove refresh token
   */
  async removeRefreshToken(
    userId: string,
    token: string
  ): Promise<User | null> {
    return await this.collection.findOneAndUpdate(
      { userId },
      {
        $pull: { refreshTokens: token as any },
        $set: { updatedAt: new Date() },
      },
      { returnDocument: 'after' }
    );
  }

  /**
   * Clear all refresh tokens
   */
  async clearRefreshTokens(userId: string): Promise<User | null> {
    return await this.update(userId, { refreshTokens: [] });
  }

  /**
   * Record login
   */
  async recordLogin(
    userId: string,
    loginData: {
      ip: string;
      userAgent: string;
    }
  ): Promise<User | null> {
    const loginEntry = {
      timestamp: new Date(),
      ip: loginData.ip,
      userAgent: loginData.userAgent,
    };

    return await this.collection.findOneAndUpdate(
      { userId },
      {
        $push: {
          loginHistory: {
            $each: [loginEntry],
            $slice: -50, // Keep only last 50 logins
          } as any,
        },
        $set: {
          lastLogin: new Date(),
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );
  }

  /**
   * Block user
   */
  async blockUser(userId: string): Promise<User | null> {
    return await this.update(userId, { isBlocked: true, isActive: false });
  }

  /**
   * Unblock user
   */
  async unblockUser(userId: string): Promise<User | null> {
    return await this.update(userId, { isBlocked: false, isActive: true });
  }

  /**
   * Deactivate user
   */
  async deactivate(userId: string): Promise<User | null> {
    return await this.update(userId, { isActive: false });
  }

  /**
   * Reactivate user
   */
  async reactivate(userId: string): Promise<User | null> {
    return await this.update(userId, { isActive: true });
  }

  /**
   * Delete user (soft delete)
   */
  async delete(userId: string): Promise<boolean> {
    const result = await this.collection.updateOne(
      { userId },
      { $set: { isActive: false, updatedAt: new Date() } }
    );
    return result.modifiedCount > 0;
  }

  /**
   * Hard delete user
   */
  async hardDelete(userId: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ userId });
    return result.deletedCount > 0;
  }

  /**
   * Get active users count
   */
  async getActiveCount(): Promise<number> {
    return await this.collection.countDocuments({
      isActive: true,
      isBlocked: false,
    });
  }

  /**
   * Get users by subscription plan
   */
  async findBySubscription(
    plan: 'free' | 'basic' | 'premium'
  ): Promise<User[]> {
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
  async findExpiredSubscriptions(): Promise<User[]> {
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
  async findPendingKYC(): Promise<User[]> {
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
  async search(
    query: string,
    options: { limit?: number; skip?: number } = {}
  ): Promise<User[]> {
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
  async getStatistics(userId: string): Promise<{
    accountAge: number; // days
    loginCount: number;
    lastLoginDaysAgo: number;
    subscriptionStatus: string;
    kycStatus: string;
  } | null> {
    const user = await this.findById(userId);
    if (!user) return null;

    const now = new Date();
    const accountAge = Math.floor(
      (now.getTime() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    const lastLoginDaysAgo = Math.floor(
      (now.getTime() - user.lastLogin.getTime()) / (1000 * 60 * 60 * 24)
    );

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
  async findAll(
    options: {
      limit?: number;
      skip?: number;
      sortBy?: string;
    } = {}
  ): Promise<User[]> {
    const query: Filter<User> = { isActive: true };
    const sort: any = {};

    if (options.sortBy === 'name') {
      sort.name = 1;
    } else if (options.sortBy === 'email') {
      sort.email = 1;
    } else {
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
  async bulkUpdate(updates: Array<{ userId: string; data: Partial<User> }>) {
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
