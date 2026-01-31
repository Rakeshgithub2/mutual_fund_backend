/**
 * Weekly Graph Aggregation Job
 * Runs once per week to generate optimized graph data
 */

import { PrismaClient } from '@prisma/client';
import GraphDataService from '../services/graph-data.service';

const prisma = new PrismaClient();

export class WeeklyGraphJob {
  /**
   * Aggregate graph data for all active funds
   */
  static async execute() {
    const startTime = Date.now();
    console.log('[Weekly Graph Job] Starting...');

    // Step 1: Get all active funds
    const funds = await prisma.fund.findMany({
      select: { id: true, name: true },
      where: { isActive: true },
    });

    console.log(`[Weekly Graph Job] Processing ${funds.length} funds...`);

    // Step 2: Process in batches
    const batchSize = 50;
    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < funds.length; i += batchSize) {
      const batch = funds.slice(i, i + batchSize);
      const fundIds = batch.map((f) => f.id);

      try {
        const results = await GraphDataService.bulkAggregateGraphData(fundIds);
        succeeded += results.length;
        processed += batch.length;

        console.log(
          `[Weekly Graph Job] Progress: ${processed}/${funds.length}`
        );
      } catch (error) {
        console.error(`[Weekly Graph Job] Batch error:`, error);
        failed += batch.length;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[Weekly Graph Job] Completed in ${duration}ms`);

    return {
      success: true,
      totalFunds: funds.length,
      succeeded,
      failed,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Aggregate for specific fund
   */
  static async aggregateFund(fundId: string) {
    console.log(`[Weekly Graph Job] Aggregating fund ${fundId}...`);

    const results = await GraphDataService.bulkAggregateGraphData([fundId]);

    return {
      success: true,
      fundId,
      periodsProcessed: results.length,
    };
  }

  /**
   * Cleanup stale graph data
   */
  static async cleanup() {
    console.log('[Weekly Graph Job] Cleaning up stale data...');
    const result = await GraphDataService.cleanupStaleData();
    console.log(
      `[Weekly Graph Job] Deleted ${result.deletedCount} stale records`
    );
    return result;
  }

  /**
   * Manual trigger for testing
   */
  static async runManually() {
    return await this.execute();
  }
}

export default WeeklyGraphJob;
