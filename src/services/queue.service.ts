/**
 * Queue Service - Add missing funds to ingestion queue
 *
 * When a fund is not found in MongoDB, add it to the queue
 * for the Oracle VM worker to fetch
 */

import { getDb } from '../lib/mongodb-serverless';

export interface QueueItem {
  schemeCode?: string;
  searchQuery: string;
  requestedAt: Date;
  requestedBy?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  processedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  error?: string;
  result?: string;
}

/**
 * Add fund to missing funds queue
 */
export async function addToMissingFundsQueue(
  searchQuery: string,
  schemeCode?: string
): Promise<boolean> {
  try {
    const db = await getDb();
    const queueCollection = db.collection('missing_funds_queue');

    // Check if already in queue (pending or processing)
    const existing = await queueCollection.findOne({
      $or: [
        { searchQuery, status: { $in: ['pending', 'processing'] } },
        schemeCode
          ? { schemeCode, status: { $in: ['pending', 'processing'] } }
          : {},
      ],
    });

    if (existing) {
      console.log(`⏭️ Fund already in queue: ${searchQuery}`);
      return false;
    }

    // Add to queue
    const queueItem: QueueItem = {
      searchQuery,
      schemeCode,
      requestedAt: new Date(),
      status: 'pending',
    };

    await queueCollection.insertOne(queueItem);
    console.log(
      `✅ Added to queue: ${searchQuery} (${schemeCode || 'no code'})`
    );

    return true;
  } catch (error: any) {
    console.error('❌ Error adding to queue:', error.message);
    return false;
  }
}

/**
 * Check queue status for a search query
 */
export async function checkQueueStatus(
  searchQuery: string
): Promise<QueueItem | null> {
  try {
    const db = await getDb();
    const queueCollection = db.collection('missing_funds_queue');

    const item = await queueCollection.findOne(
      { searchQuery },
      { sort: { requestedAt: -1 } }
    );

    return item as QueueItem | null;
  } catch (error) {
    console.error('Error checking queue status:', error);
    return null;
  }
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<{
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}> {
  try {
    const db = await getDb();
    const queueCollection = db.collection('missing_funds_queue');

    const [pending, processing, completed, failed, total] = await Promise.all([
      queueCollection.countDocuments({ status: 'pending' }),
      queueCollection.countDocuments({ status: 'processing' }),
      queueCollection.countDocuments({ status: 'completed' }),
      queueCollection.countDocuments({ status: 'failed' }),
      queueCollection.countDocuments(),
    ]);

    return { pending, processing, completed, failed, total };
  } catch (error) {
    console.error('Error getting queue stats:', error);
    return { pending: 0, processing: 0, completed: 0, failed: 0, total: 0 };
  }
}
