import { Collection, ObjectId } from 'mongodb';
import { mongodb } from '../db/mongodb';
import { z } from 'zod';

/**
 * Feedback type enum
 */
export type FeedbackType = 'bug' | 'feature' | 'general';

/**
 * Feedback status enum
 */
export type FeedbackStatus = 'pending' | 'reviewed' | 'resolved';

/**
 * Feedback interface
 */
export interface Feedback {
  _id?: ObjectId;
  feedbackType: FeedbackType;
  rating: number; // 0-5
  name?: string;
  email?: string | null;
  message: string;
  userId: string | null;
  status: FeedbackStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Zod validation schema for Feedback
 */
export const FeedbackSchema = z.object({
  feedbackType: z.enum(['bug', 'feature', 'general']),
  rating: z.number().min(0).max(5),
  name: z.string().min(1).optional(),
  email: z.string().email().nullable().optional(),
  message: z.string().min(1, 'Message is required'),
  userId: z.string().nullable(),
  status: z.enum(['pending', 'reviewed', 'resolved']).default('pending'),
});

/**
 * Feedback Model - MongoDB operations for feedback
 */
export class FeedbackModel {
  private _collection: Collection<Feedback> | null = null;

  private get collection(): Collection<Feedback> {
    if (!this._collection) {
      this._collection = mongodb.getCollection<Feedback>('feedback');
    }
    return this._collection;
  }

  /**
   * Ensure indexes are created
   */
  async ensureIndexes(): Promise<void> {
    try {
      await this.collection.createIndex({ createdAt: -1 });
      await this.collection.createIndex({ status: 1 });
      await this.collection.createIndex({ userId: 1 });
      await this.collection.createIndex({ feedbackType: 1 });
      console.log('✓ Feedback collection indexes created');
    } catch (error) {
      console.error('Error creating feedback indexes:', error);
    }
  }

  /**
   * Create a new feedback entry
   */
  async create(
    feedbackData: Omit<Feedback, '_id' | 'createdAt' | 'updatedAt'>
  ): Promise<Feedback> {
    const feedback: Feedback = {
      ...feedbackData,
      status: feedbackData.status || 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await this.collection.insertOne(feedback);
    return { ...feedback, _id: result.insertedId };
  }

  /**
   * Find feedback by ID
   */
  async findById(id: string): Promise<Feedback | null> {
    try {
      return await this.collection.findOne({ _id: new ObjectId(id) });
    } catch (error) {
      return null;
    }
  }

  /**
   * Find all feedback with optional filters
   */
  async findAll(
    options: {
      status?: FeedbackStatus;
      feedbackType?: FeedbackType;
      userId?: string;
      limit?: number;
      skip?: number;
    } = {}
  ): Promise<{ feedback: Feedback[]; total: number }> {
    const { status, feedbackType, userId, limit = 50, skip = 0 } = options;

    const filter: any = {};
    if (status) filter.status = status;
    if (feedbackType) filter.feedbackType = feedbackType;
    if (userId) filter.userId = userId;

    const [feedback, total] = await Promise.all([
      this.collection
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      this.collection.countDocuments(filter),
    ]);

    return { feedback, total };
  }

  /**
   * Update feedback status
   */
  async updateStatus(id: string, status: FeedbackStatus): Promise<boolean> {
    try {
      const result = await this.collection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            status,
            updatedAt: new Date(),
          },
        }
      );
      return result.modifiedCount > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get feedback statistics
   */
  async getStatistics(): Promise<{
    total: number;
    byStatus: Record<FeedbackStatus, number>;
    byType: Record<FeedbackType, number>;
    averageRating: number;
  }> {
    const [total, byStatus, byType, avgRating] = await Promise.all([
      // Total count
      this.collection.countDocuments(),

      // Count by status
      this.collection
        .aggregate([
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
            },
          },
        ])
        .toArray(),

      // Count by type
      this.collection
        .aggregate([
          {
            $group: {
              _id: '$feedbackType',
              count: { $sum: 1 },
            },
          },
        ])
        .toArray(),

      // Average rating
      this.collection
        .aggregate([
          {
            $group: {
              _id: null,
              avgRating: { $avg: '$rating' },
            },
          },
        ])
        .toArray(),
    ]);

    const statusCounts = {
      pending: 0,
      reviewed: 0,
      resolved: 0,
    } as Record<FeedbackStatus, number>;

    byStatus.forEach((item: any) => {
      statusCounts[item._id as FeedbackStatus] = item.count;
    });

    const typeCounts = {
      bug: 0,
      feature: 0,
      general: 0,
    } as Record<FeedbackType, number>;

    byType.forEach((item: any) => {
      typeCounts[item._id as FeedbackType] = item.count;
    });

    return {
      total,
      byStatus: statusCounts,
      byType: typeCounts,
      averageRating: avgRating[0]?.avgRating || 0,
    };
  }

  /**
   * Delete feedback by ID
   */
  async delete(id: string): Promise<boolean> {
    try {
      const result = await this.collection.deleteOne({ _id: new ObjectId(id) });
      return result.deletedCount > 0;
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
export const feedbackModel = new FeedbackModel();
