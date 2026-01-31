import { Collection, Filter } from 'mongodb';
import { mongodb } from '../db/mongodb';
import { Goal } from '../db/schemas';
import { z } from 'zod';

/**
 * Zod validation schema for Goal
 */
export const GoalSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  goalId: z.string().min(1, 'Goal ID is required'),
  title: z.string().min(1, 'Title is required'),
  description: z.string(),

  // Financial Details
  targetAmount: z.number().positive('Target amount must be positive'),
  currentSavings: z.number().min(0, 'Current savings cannot be negative'),
  monthlyInvestment: z.number().min(0, 'Monthly investment cannot be negative'),
  timeframe: z.number().positive('Timeframe must be positive'),

  // Suggested Funds
  suggestedFunds: z.array(
    z.object({
      fundId: z.string(),
      fundName: z.string(),
      allocationPercent: z.number().min(0).max(100),
      sipAmount: z.number().min(0),
    })
  ),

  // Progress
  status: z.enum(['active', 'completed', 'paused']).default('active'),
  progress: z.number().min(0).max(100),
  projectedCompletionDate: z.date(),

  // Metadata
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type GoalInput = z.infer<typeof GoalSchema>;

/**
 * Goal Model Class
 * Manages financial goals and investment planning
 */
export class GoalModel {
  private static instance: GoalModel | null = null;
  private collection: Collection<Goal>;

  private constructor() {
    this.collection = mongodb.getCollection<Goal>('goals');
  }

  static getInstance(): GoalModel {
    if (!GoalModel.instance) {
      GoalModel.instance = new GoalModel();
    }
    return GoalModel.instance;
  }

  /**
   * Create a new goal
   */
  async create(goalData: Partial<Goal>): Promise<Goal> {
    const now = new Date();

    // Calculate projected completion date
    const projectedDate = new Date();
    projectedDate.setFullYear(
      projectedDate.getFullYear() + (goalData.timeframe || 0)
    );

    const goal: Goal = {
      ...goalData,
      suggestedFunds: goalData.suggestedFunds || [],
      status: goalData.status || 'active',
      progress: goalData.progress || 0,
      projectedCompletionDate:
        goalData.projectedCompletionDate || projectedDate,
      createdAt: goalData.createdAt || now,
      updatedAt: goalData.updatedAt || now,
    } as Goal;

    const result = await this.collection.insertOne(goal as any);
    return { ...goal, _id: result.insertedId.toString() };
  }

  /**
   * Find goal by ID
   */
  async findById(userId: string, goalId: string): Promise<Goal | null> {
    return await this.collection.findOne({ userId, goalId });
  }

  /**
   * Get all user goals
   */
  async getUserGoals(
    userId: string,
    options: { status?: string; limit?: number; skip?: number } = {}
  ): Promise<Goal[]> {
    const filter: Filter<Goal> = { userId };

    if (options.status) {
      filter.status = options.status as any;
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
  async update(
    userId: string,
    goalId: string,
    updateData: Partial<Goal>
  ): Promise<Goal | null> {
    const result = await this.collection.findOneAndUpdate(
      { userId, goalId },
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
   * Update progress
   */
  async updateProgress(
    userId: string,
    goalId: string,
    currentSavings: number
  ): Promise<Goal | null> {
    const goal = await this.findById(userId, goalId);
    if (!goal) return null;

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
  async updateStatus(
    userId: string,
    goalId: string,
    status: 'active' | 'completed' | 'paused'
  ): Promise<Goal | null> {
    return await this.update(userId, goalId, { status });
  }

  /**
   * Add suggested fund
   */
  async addSuggestedFund(
    userId: string,
    goalId: string,
    fund: {
      fundId: string;
      fundName: string;
      allocationPercent: number;
      sipAmount: number;
    }
  ): Promise<Goal | null> {
    const result = await this.collection.findOneAndUpdate(
      { userId, goalId },
      {
        $push: { suggestedFunds: fund as any },
        $set: { updatedAt: new Date() },
      },
      { returnDocument: 'after' }
    );

    return result || null;
  }

  /**
   * Remove suggested fund
   */
  async removeSuggestedFund(
    userId: string,
    goalId: string,
    fundId: string
  ): Promise<Goal | null> {
    const result = await this.collection.findOneAndUpdate(
      { userId, goalId },
      {
        $pull: { suggestedFunds: { fundId } as any },
        $set: { updatedAt: new Date() },
      },
      { returnDocument: 'after' }
    );

    return result || null;
  }

  /**
   * Update suggested fund allocation
   */
  async updateSuggestedFund(
    userId: string,
    goalId: string,
    fundId: string,
    updateData: Partial<Goal['suggestedFunds'][0]>
  ): Promise<Goal | null> {
    const goal = await this.findById(userId, goalId);
    if (!goal) return null;

    const fundIndex = goal.suggestedFunds.findIndex((f) => f.fundId === fundId);
    if (fundIndex === -1) return null;

    goal.suggestedFunds[fundIndex] = {
      ...goal.suggestedFunds[fundIndex],
      ...updateData,
    };

    const result = await this.collection.findOneAndUpdate(
      { userId, goalId },
      {
        $set: {
          suggestedFunds: goal.suggestedFunds,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    return result || null;
  }

  /**
   * Delete goal (hard delete)
   */
  async delete(userId: string, goalId: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ userId, goalId });
    return result.deletedCount > 0;
  }

  /**
   * Get active goals count
   */
  async getActiveCount(userId: string): Promise<number> {
    return await this.collection.countDocuments({ userId, status: 'active' });
  }

  /**
   * Get completed goals count
   */
  async getCompletedCount(userId: string): Promise<number> {
    return await this.collection.countDocuments({
      userId,
      status: 'completed',
    });
  }

  /**
   * Get goals by status
   */
  async getByStatus(
    userId: string,
    status: 'active' | 'completed' | 'paused'
  ): Promise<Goal[]> {
    return await this.collection
      .find({ userId, status })
      .sort({ createdAt: -1 })
      .toArray();
  }

  /**
   * Get goals nearing completion
   */
  async getGoalsNearingCompletion(
    userId: string,
    threshold: number = 80
  ): Promise<Goal[]> {
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
  async getGoalsDueWithin(userId: string, months: number): Promise<Goal[]> {
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
  calculateRequiredMonthlyInvestment(
    targetAmount: number,
    currentSavings: number,
    timeframeYears: number,
    expectedReturnRate: number = 12 // Default 12% annual return
  ): number {
    const monthlyRate = expectedReturnRate / 12 / 100;
    const months = timeframeYears * 12;

    // Future value of current savings
    const futureValueOfSavings =
      currentSavings * Math.pow(1 + monthlyRate, months);

    // Remaining amount needed
    const remainingAmount = targetAmount - futureValueOfSavings;

    if (remainingAmount <= 0) {
      return 0; // Goal already achieved
    }

    // Calculate SIP amount using future value of annuity formula
    const sipAmount =
      remainingAmount / ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);

    return Math.ceil(sipAmount);
  }

  /**
   * Calculate projected completion date
   */
  calculateProjectedCompletionDate(
    targetAmount: number,
    currentSavings: number,
    monthlyInvestment: number,
    expectedReturnRate: number = 12
  ): Date | null {
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
  async getStatistics(userId: string): Promise<{
    totalGoals: number;
    activeGoals: number;
    completedGoals: number;
    pausedGoals: number;
    totalTargetAmount: number;
    totalCurrentSavings: number;
    totalMonthlyInvestment: number;
    averageProgress: number;
  }> {
    const goals = await this.collection.find({ userId }).toArray();

    const stats = {
      totalGoals: goals.length,
      activeGoals: goals.filter((g) => g.status === 'active').length,
      completedGoals: goals.filter((g) => g.status === 'completed').length,
      pausedGoals: goals.filter((g) => g.status === 'paused').length,
      totalTargetAmount: goals.reduce((sum, g) => sum + g.targetAmount, 0),
      totalCurrentSavings: goals.reduce((sum, g) => sum + g.currentSavings, 0),
      totalMonthlyInvestment: goals.reduce(
        (sum, g) => sum + g.monthlyInvestment,
        0
      ),
      averageProgress:
        goals.length > 0
          ? goals.reduce((sum, g) => sum + g.progress, 0) / goals.length
          : 0,
    };

    return stats;
  }

  /**
   * Get goal with suggested fund details
   */
  async getWithFundDetails(
    userId: string,
    goalId: string
  ): Promise<any | null> {
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
