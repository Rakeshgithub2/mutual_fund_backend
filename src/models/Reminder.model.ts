import { Collection, ObjectId, Filter } from 'mongodb';
import { z } from 'zod';

// Lazy import to avoid circular dependency
let mongodb: any = null;
function getMongoDB(): any {
  if (!mongodb) {
    mongodb = require('../db/mongodb').mongodb;
  }
  return mongodb;
}

/**
 * Reminder Interface
 */
export interface Reminder {
  _id?: string | ObjectId;
  userId: string | ObjectId;
  type: 'INVESTMENT' | 'PORTFOLIO_REVIEW' | 'SIP' | 'GOAL' | 'GENERAL';
  title: string;
  description?: string;
  reminderDate: Date;
  frequency: 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
  status: 'PENDING' | 'SENT' | 'FAILED' | 'CANCELLED';
  notifyVia?: {
    email?: boolean;
    push?: boolean;
  };
  linkedGoal?: string | ObjectId | null;
  linkedFunds?: Array<{
    schemeCode: string;
    schemeName: string;
  }>;
  sipDetails?: {
    amount: number;
    date: number; // Day of month (1-31)
  };
  createdAt: Date;
  updatedAt: Date;
  sentAt?: Date | null;
  errorMessage?: string | null;
}

/**
 * Zod validation schema for Reminder
 */
export const ReminderSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  type: z.enum(['INVESTMENT', 'PORTFOLIO_REVIEW', 'SIP', 'GOAL', 'GENERAL']),
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().max(1000, 'Description too long').optional(),
  reminderDate: z.date(),
  frequency: z.enum(['ONCE', 'DAILY', 'WEEKLY', 'MONTHLY']).default('ONCE'),
  status: z.enum(['PENDING', 'SENT', 'FAILED', 'CANCELLED']).default('PENDING'),
  notifyVia: z
    .object({
      email: z.boolean().optional(),
      push: z.boolean().optional(),
    })
    .optional(),
  linkedGoal: z.string().optional().nullable(),
  linkedFunds: z
    .array(
      z.object({
        schemeCode: z.string(),
        schemeName: z.string(),
      })
    )
    .optional(),
  sipDetails: z
    .object({
      amount: z.number().positive(),
      date: z.number().min(1).max(31),
    })
    .optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  sentAt: z.date().optional().nullable(),
  errorMessage: z.string().optional().nullable(),
});

export type ReminderInput = z.infer<typeof ReminderSchema>;

/**
 * Reminder Model Class
 * Manages reminders and notifications for users
 */
export class ReminderModel {
  private static instance: ReminderModel | null = null;
  private _collection: Collection<Reminder> | null = null;

  private constructor() {
    // Lazy initialization
  }

  private get collection(): Collection<Reminder> {
    if (!this._collection) {
      const db = getMongoDB();
      this._collection = db.getCollection('reminders') as Collection<Reminder>;
    }
    return this._collection;
  }

  static getInstance(): ReminderModel {
    if (!ReminderModel.instance) {
      ReminderModel.instance = new ReminderModel();
    }
    return ReminderModel.instance;
  }

  /**
   * Create a new reminder
   */
  async create(reminderData: Partial<Reminder>): Promise<Reminder> {
    const now = new Date();

    const reminder: Reminder = {
      ...reminderData,
      status: reminderData.status || 'PENDING',
      frequency: reminderData.frequency || 'ONCE',
      notifyVia: reminderData.notifyVia || { email: true },
      createdAt: reminderData.createdAt || now,
      updatedAt: reminderData.updatedAt || now,
      sentAt: null,
      errorMessage: null,
    } as Reminder;

    const result = await this.collection.insertOne(reminder as any);
    return { ...reminder, _id: result.insertedId.toString() };
  }

  /**
   * Find reminder by ID
   */
  async findById(userId: string, reminderId: string): Promise<Reminder | null> {
    try {
      const objectId = new ObjectId(reminderId);
      return await this.collection.findOne({
        _id: objectId,
        userId: userId,
      } as any);
    } catch (error) {
      return null;
    }
  }

  /**
   * Get all user reminders
   */
  async getUserReminders(
    userId: string,
    options: {
      status?: 'PENDING' | 'SENT' | 'FAILED' | 'CANCELLED';
      type?: string;
      limit?: number;
      skip?: number;
    } = {}
  ): Promise<Reminder[]> {
    const filter: Filter<Reminder> = { userId } as any;

    if (options.status) {
      filter.status = options.status as any;
    }

    if (options.type) {
      filter.type = options.type as any;
    }

    return await this.collection
      .find(filter)
      .sort({ reminderDate: 1 })
      .limit(options.limit || 100)
      .skip(options.skip || 0)
      .toArray();
  }

  /**
   * Get pending reminders (for scheduler)
   */
  async getPendingReminders(beforeDate?: Date): Promise<Reminder[]> {
    const now = beforeDate || new Date();

    return await this.collection
      .find({
        status: 'PENDING',
        reminderDate: { $lte: now },
      } as any)
      .sort({ reminderDate: 1 })
      .toArray();
  }

  /**
   * Get upcoming reminders (next 7 days)
   */
  async getUpcomingReminders(
    userId: string,
    days: number = 7
  ): Promise<Reminder[]> {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    return await this.collection
      .find({
        userId,
        status: 'PENDING',
        reminderDate: {
          $gte: now,
          $lte: futureDate,
        },
      } as any)
      .sort({ reminderDate: 1 })
      .toArray();
  }

  /**
   * Update reminder
   */
  async update(
    userId: string,
    reminderId: string,
    updateData: Partial<Reminder>
  ): Promise<Reminder | null> {
    try {
      const objectId = new ObjectId(reminderId);
      const result = await this.collection.findOneAndUpdate(
        { _id: objectId, userId } as any,
        {
          $set: {
            ...updateData,
            updatedAt: new Date(),
          },
        },
        { returnDocument: 'after' }
      );
      return result || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Update reminder status
   */
  async updateStatus(
    userId: string,
    reminderId: string,
    status: 'PENDING' | 'SENT' | 'FAILED' | 'CANCELLED',
    errorMessage?: string
  ): Promise<Reminder | null> {
    const updateData: Partial<Reminder> = {
      status,
      updatedAt: new Date(),
    };

    if (status === 'SENT') {
      updateData.sentAt = new Date();
    }

    if (errorMessage) {
      updateData.errorMessage = errorMessage;
    }

    return await this.update(userId, reminderId, updateData);
  }

  /**
   * Mark reminder as sent
   */
  async markAsSent(
    userId: string,
    reminderId: string
  ): Promise<Reminder | null> {
    return await this.updateStatus(userId, reminderId, 'SENT');
  }

  /**
   * Mark reminder as failed
   */
  async markAsFailed(
    userId: string,
    reminderId: string,
    errorMessage: string
  ): Promise<Reminder | null> {
    return await this.updateStatus(userId, reminderId, 'FAILED', errorMessage);
  }

  /**
   * Cancel reminder
   */
  async cancel(userId: string, reminderId: string): Promise<Reminder | null> {
    return await this.updateStatus(userId, reminderId, 'CANCELLED');
  }

  /**
   * Delete reminder
   */
  async delete(userId: string, reminderId: string): Promise<boolean> {
    try {
      const objectId = new ObjectId(reminderId);
      const result = await this.collection.deleteOne({
        _id: objectId,
        userId,
      } as any);
      return result.deletedCount === 1;
    } catch (error) {
      return false;
    }
  }

  /**
   * Complete reminder (mark as sent and optionally reschedule for recurring)
   */
  async complete(userId: string, reminderId: string): Promise<Reminder | null> {
    const reminder = await this.findById(userId, reminderId);
    if (!reminder) return null;

    // Mark current reminder as sent
    await this.markAsSent(userId, reminderId);

    // If recurring, create next reminder
    if (reminder.frequency !== 'ONCE') {
      const nextDate = this.calculateNextReminderDate(
        reminder.reminderDate,
        reminder.frequency
      );

      await this.create({
        userId: reminder.userId,
        type: reminder.type,
        title: reminder.title,
        description: reminder.description,
        reminderDate: nextDate,
        frequency: reminder.frequency,
        status: 'PENDING',
        notifyVia: reminder.notifyVia,
        linkedGoal: reminder.linkedGoal,
        linkedFunds: reminder.linkedFunds,
        sipDetails: reminder.sipDetails,
      });
    }

    return reminder;
  }

  /**
   * Calculate next reminder date for recurring reminders
   */
  private calculateNextReminderDate(
    currentDate: Date,
    frequency: string
  ): Date {
    const nextDate = new Date(currentDate);

    switch (frequency) {
      case 'DAILY':
        nextDate.setDate(nextDate.getDate() + 1);
        break;
      case 'WEEKLY':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'MONTHLY':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
    }

    return nextDate;
  }

  /**
   * Get reminder statistics for user
   */
  async getStats(userId: string): Promise<{
    total: number;
    pending: number;
    sent: number;
    failed: number;
    upcoming: number;
  }> {
    const total = await this.collection.countDocuments({ userId } as any);
    const pending = await this.collection.countDocuments({
      userId,
      status: 'PENDING',
    } as any);
    const sent = await this.collection.countDocuments({
      userId,
      status: 'SENT',
    } as any);
    const failed = await this.collection.countDocuments({
      userId,
      status: 'FAILED',
    } as any);

    const upcomingReminders = await this.getUpcomingReminders(userId, 7);
    const upcoming = upcomingReminders.length;

    return {
      total,
      pending,
      sent,
      failed,
      upcoming,
    };
  }

  /**
   * Create index for efficient queries
   */
  async createIndexes(): Promise<void> {
    try {
      await this.collection.createIndex({ userId: 1, reminderDate: 1 });
      await this.collection.createIndex({ status: 1, reminderDate: 1 });
      await this.collection.createIndex({ userId: 1, status: 1 });
      console.log('✅ Reminder indexes created');
    } catch (error) {
      console.error('Failed to create reminder indexes:', error);
    }
  }
}

// Default export for CommonJS compatibility
const ReminderModelInstance = ReminderModel.getInstance();
export default ReminderModelInstance;

// Named export for ES modules
export const reminderModel = ReminderModelInstance;
