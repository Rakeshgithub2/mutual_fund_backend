/**
 * Daily NAV Update Job
 * Runs once per day at 10:30 PM IST
 * Fetches and stores NAV for all mutual funds
 */

import axios from 'axios';
import moment from 'moment-timezone';
import NAVService from '../services/nav.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class DailyNAVJob {
  /**
   * Fetch NAV data from AMFI API
   */
  private static async fetchNAVFromAMFI(): Promise<
    Array<{
      amfiCode: string;
      nav: number;
      date: Date;
    }>
  > {
    try {
      // AMFI NAV API endpoint
      const response = await axios.get(
        'https://www.amfiindia.com/spages/NAVAll.txt',
        {
          timeout: 30000,
          headers: {
            'User-Agent': 'Mozilla/5.0',
          },
        }
      );

      const lines = response.data.split('\n');
      const navData: Array<{ amfiCode: string; nav: number; date: Date }> = [];

      for (const line of lines) {
        // Parse AMFI format: Code;Name;NAV;Date
        const parts = line.split(';');

        if (parts.length >= 4 && parts[0].trim() !== '') {
          const amfiCode = parts[0].trim();
          const navValue = parseFloat(parts[parts.length - 2]);
          const dateStr = parts[parts.length - 1].trim();

          if (!isNaN(navValue) && amfiCode.length > 0) {
            navData.push({
              amfiCode,
              nav: navValue,
              date: moment(dateStr, 'DD-MMM-YYYY').toDate(),
            });
          }
        }
      }

      return navData;
    } catch (error) {
      console.error('Error fetching NAV from AMFI:', error);
      return [];
    }
  }

  /**
   * Match AMFI codes with database fund IDs
   */
  private static async matchFundsWithAMFI(
    navData: Array<{
      amfiCode: string;
      nav: number;
      date: Date;
    }>
  ) {
    const matched: Array<{
      fundId: string;
      amfiCode: string;
      date: Date;
      nav: number;
    }> = [];

    // Get all funds from database
    const funds = await prisma.fund.findMany({
      select: { id: true, amfiCode: true },
      where: {
        amfiCode: { not: null },
        isActive: true,
      },
    });

    // Create AMFI code to fund ID map
    const amfiToFundMap = new Map(funds.map((f) => [f.amfiCode, f.id]));

    // Match NAV data with funds
    for (const navEntry of navData) {
      const fundId = amfiToFundMap.get(navEntry.amfiCode);

      if (fundId) {
        matched.push({
          fundId,
          amfiCode: navEntry.amfiCode,
          date: navEntry.date,
          nav: navEntry.nav,
        });
      }
    }

    return matched;
  }

  /**
   * Main job execution
   */
  static async execute() {
    const startTime = Date.now();
    console.log('[Daily NAV Job] Starting...');

    // Step 1: Fetch NAV data from AMFI
    console.log('[Daily NAV Job] Fetching NAV from AMFI...');
    const navData = await this.fetchNAVFromAMFI();

    if (navData.length === 0) {
      console.error('[Daily NAV Job] No NAV data received');
      return {
        success: false,
        reason: 'No data received from AMFI',
      };
    }

    console.log(`[Daily NAV Job] Fetched ${navData.length} NAV entries`);

    // Step 2: Match with database funds
    console.log('[Daily NAV Job] Matching with database funds...');
    const matchedData = await this.matchFundsWithAMFI(navData);
    console.log(`[Daily NAV Job] Matched ${matchedData.length} funds`);

    // Step 3: Store in MongoDB (NAV History)
    console.log('[Daily NAV Job] Storing NAV data...');
    const result = await NAVService.bulkAddNAVs(matchedData);

    const duration = Date.now() - startTime;
    console.log(`[Daily NAV Job] Completed in ${duration}ms`);

    // Step 4: Trigger returns calculation (async)
    setTimeout(async () => {
      console.log('[Daily NAV Job] Triggering returns calculation...');
      const fundIds = matchedData.map((d) => d.fundId);
      await NAVService.bulkUpdateReturns(fundIds);
      console.log('[Daily NAV Job] Returns calculation completed');
    }, 5000);

    return {
      success: true,
      totalFetched: navData.length,
      matched: matchedData.length,
      stored: result.upsertedCount + result.modifiedCount,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Manual trigger for testing
   */
  static async runManually() {
    return await this.execute();
  }

  /**
   * Cleanup old NAV data (backup for TTL)
   */
  static async cleanupOldData() {
    console.log('[Daily NAV Job] Running cleanup...');
    const result = await NAVService.cleanupOldNAVs();
    console.log(
      `[Daily NAV Job] Deleted ${result.deletedCount} old NAV entries`
    );
    return result;
  }
}

export default DailyNAVJob;
