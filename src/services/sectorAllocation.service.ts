import { mongodb } from '../db/mongodb';
import axios from 'axios';

/**
 * Sector Allocation Service
 *
 * Generates sector allocation for funds missing this data:
 * 1. Check if fund has holdings data
 * 2. Aggregate holdings by sector
 * 3. If missing, fetch from external API (RapidAPI/AMFI)
 * 4. Map company names to sectors
 * 5. Store in database
 *
 * Usage:
 * - Background worker: Process all funds missing sectors
 * - On-demand: Generate for specific fund when requested
 */

interface Holding {
  companyName: string;
  sector: string;
  percentage: number;
  value?: number;
  quantity?: number;
}

interface SectorAllocation {
  sector: string;
  percentage: number;
  amount?: number;
}

// Top 200 companies → sector mapping (expandable)
const COMPANY_SECTOR_MAP: Record<string, string> = {
  // Financial Services
  'HDFC Bank': 'Financial Services',
  'ICICI Bank': 'Financial Services',
  'State Bank of India': 'Financial Services',
  'Kotak Mahindra Bank': 'Financial Services',
  'Axis Bank': 'Financial Services',
  'Bajaj Finance': 'Financial Services',
  'Bajaj Finserv': 'Financial Services',
  'HDFC Life Insurance': 'Financial Services',
  'SBI Life Insurance': 'Financial Services',

  // Information Technology
  Infosys: 'Information Technology',
  TCS: 'Information Technology',
  'Tata Consultancy Services': 'Information Technology',
  Wipro: 'Information Technology',
  'HCL Technologies': 'Information Technology',
  'Tech Mahindra': 'Information Technology',
  LTI: 'Information Technology',
  'Persistent Systems': 'Information Technology',

  // Energy & Oil/Gas
  'Reliance Industries': 'Energy',
  'Oil and Natural Gas Corporation': 'Energy',
  ONGC: 'Energy',
  'Indian Oil Corporation': 'Energy',
  'Bharat Petroleum': 'Energy',
  'Hindustan Petroleum': 'Energy',
  'GAIL India': 'Energy',
  'Power Grid Corporation': 'Energy',
  NTPC: 'Energy',

  // FMCG
  'Hindustan Unilever': 'FMCG',
  ITC: 'FMCG',
  'Nestle India': 'FMCG',
  'Britannia Industries': 'FMCG',
  'Dabur India': 'FMCG',
  Marico: 'FMCG',
  'Godrej Consumer Products': 'FMCG',
  'Colgate Palmolive': 'FMCG',

  // Automobile
  'Maruti Suzuki': 'Automobile',
  'Tata Motors': 'Automobile',
  'Mahindra & Mahindra': 'Automobile',
  'Bajaj Auto': 'Automobile',
  'Hero MotoCorp': 'Automobile',
  'TVS Motor Company': 'Automobile',
  'Eicher Motors': 'Automobile',

  // Pharma & Healthcare
  'Sun Pharmaceutical': 'Healthcare',
  'Sun Pharma': 'Healthcare',
  "Dr Reddy's Laboratories": 'Healthcare',
  Cipla: 'Healthcare',
  "Divi's Laboratories": 'Healthcare',
  Biocon: 'Healthcare',
  Lupin: 'Healthcare',
  'Aurobindo Pharma': 'Healthcare',
  'Apollo Hospitals': 'Healthcare',

  // Telecom
  'Bharti Airtel': 'Telecom',
  'Vodafone Idea': 'Telecom',

  // Materials & Metals
  'Tata Steel': 'Materials',
  'JSW Steel': 'Materials',
  'Hindalco Industries': 'Materials',
  'UltraTech Cement': 'Materials',
  'Grasim Industries': 'Materials',
  'Coal India': 'Materials',

  // Consumer Durables
  'Asian Paints': 'Consumer Durables',
  'Titan Company': 'Consumer Durables',
  'Havells India': 'Consumer Durables',
  Voltas: 'Consumer Durables',

  // Real Estate & Construction
  DLF: 'Real Estate',
  'Godrej Properties': 'Real Estate',
  'Larsen & Toubro': 'Industrials',
  'L&T': 'Industrials',

  // Add more companies as needed
};

export class SectorAllocationService {
  /**
   * Generate sector allocation from holdings array
   */
  static generateFromHoldings(holdings: Holding[]): SectorAllocation[] {
    if (!holdings || holdings.length === 0) {
      return [];
    }

    const sectorMap = new Map<string, number>();

    holdings.forEach((holding) => {
      const sector = holding.sector || this.inferSector(holding.companyName);
      const current = sectorMap.get(sector) || 0;
      sectorMap.set(sector, current + holding.percentage);
    });

    const allocation = Array.from(sectorMap.entries()).map(
      ([sector, percentage]) => ({
        sector,
        percentage: Math.round(percentage * 100) / 100,
      })
    );

    // Normalize to 100%
    const total = allocation.reduce((sum, s) => sum + s.percentage, 0);
    if (total > 0) {
      allocation.forEach((s) => {
        s.percentage = Math.round((s.percentage / total) * 100 * 100) / 100;
      });
    }

    return allocation.sort((a, b) => b.percentage - a.percentage);
  }

  /**
   * Infer sector from company name using mapping + keyword matching
   */
  static inferSector(companyName: string): string {
    // Try exact match first
    const sector = COMPANY_SECTOR_MAP[companyName];
    if (sector) return sector;

    // Fallback: keyword-based inference
    const lower = companyName.toLowerCase();

    if (
      lower.includes('bank') ||
      lower.includes('financial') ||
      lower.includes('insurance') ||
      lower.includes('finance')
    )
      return 'Financial Services';

    if (
      lower.includes('tech') ||
      lower.includes('software') ||
      lower.includes('infotech') ||
      lower.includes('it services')
    )
      return 'Information Technology';

    if (lower.includes('pharma') || lower.includes('health'))
      return 'Healthcare';

    if (
      lower.includes('energy') ||
      lower.includes('power') ||
      lower.includes('oil') ||
      lower.includes('gas')
    )
      return 'Energy';

    if (lower.includes('auto') || lower.includes('motor')) return 'Automobile';

    if (
      lower.includes('cement') ||
      lower.includes('steel') ||
      lower.includes('metal')
    )
      return 'Materials';

    if (
      lower.includes('fmcg') ||
      lower.includes('consumer goods') ||
      lower.includes('unilever') ||
      lower.includes('britannia')
    )
      return 'FMCG';

    if (lower.includes('telecom') || lower.includes('airtel')) return 'Telecom';

    if (lower.includes('real estate') || lower.includes('properties'))
      return 'Real Estate';

    return 'Others';
  }

  /**
   * Fetch holdings from external API and generate sector allocation
   * Returns null if unable to fetch
   */
  static async fetchAndGenerateSectors(fundId: string): Promise<{
    holdings: Holding[];
    sectorAllocation: SectorAllocation[];
  } | null> {
    try {
      console.log(`🔍 Fetching holdings for fund: ${fundId}`);

      // Try RapidAPI first (most reliable for Indian mutual funds)
      let holdings = await this.fetchFromRapidAPI(fundId);

      if (!holdings || holdings.length === 0) {
        console.log(`⚠️  No holdings found for fund: ${fundId}`);
        return null;
      }

      // Generate sector allocation from holdings
      const sectorAllocation = this.generateFromHoldings(holdings);

      console.log(
        `✅ Generated ${sectorAllocation.length} sectors from ${holdings.length} holdings`
      );

      return { holdings, sectorAllocation };
    } catch (error: any) {
      console.error(`❌ Error fetching holdings for ${fundId}:`, error.message);
      return null;
    }
  }

  /**
   * Fetch holdings from RapidAPI Mutual Fund API
   */
  static async fetchFromRapidAPI(fundId: string): Promise<Holding[]> {
    try {
      const apiKey = process.env.RAPIDAPI_KEY;
      if (!apiKey) {
        console.error('❌ RAPIDAPI_KEY not found in .env');
        return [];
      }

      const response = await axios.get(
        `https://latest-mutual-fund-nav.p.rapidapi.com/fetchPortfolio`,
        {
          headers: {
            'X-RapidAPI-Key': apiKey,
            'X-RapidAPI-Host': 'latest-mutual-fund-nav.p.rapidapi.com',
          },
          params: { Scheme_Code: fundId },
          timeout: 15000,
        }
      );

      if (!response.data || !response.data.holdings) {
        return [];
      }

      const holdings: Holding[] = response.data.holdings
        .slice(0, 15) // Top 15 holdings
        .map((h: any) => ({
          companyName: h.company_name || h.companyName || 'Unknown',
          sector: this.inferSector(
            h.company_name || h.companyName || 'Unknown'
          ),
          percentage: parseFloat(h.percentage || h.weight || 0),
          value: parseFloat(h.market_value || h.value || 0),
          quantity: parseInt(h.quantity || 0),
        }));

      return holdings;
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.log(`📭 Fund ${fundId} not found in RapidAPI`);
      } else {
        console.error(`❌ RapidAPI fetch failed:`, error.message);
      }
      return [];
    }
  }

  /**
   * Process single fund - check if it needs sector data, fetch if needed
   */
  static async processSingleFund(fundId: string): Promise<boolean> {
    try {
      const db = mongodb.getDb();
      const fundsCollection = db.collection('funds');

      const fund = await fundsCollection.findOne({ fundId, isActive: true });

      if (!fund) {
        console.log(`❌ Fund not found: ${fundId}`);
        return false;
      }

      // Check if fund is equity (only equity funds need sector allocation)
      if (fund.category !== 'equity') {
        console.log(`⏭️  Skipping non-equity fund: ${fund.name}`);
        return false;
      }

      // Check if fund already has sector allocation
      if (
        fund.sectorAllocation &&
        Array.isArray(fund.sectorAllocation) &&
        fund.sectorAllocation.length > 0
      ) {
        console.log(`✅ Fund already has sector data: ${fund.name}`);
        return true;
      }

      // Fetch and generate sector allocation
      const result = await this.fetchAndGenerateSectors(fundId);

      if (!result) {
        console.log(`❌ Could not generate sector data for: ${fund.name}`);
        return false;
      }

      // Update database
      await fundsCollection.updateOne(
        { fundId },
        {
          $set: {
            holdings: result.holdings,
            sectorAllocation: result.sectorAllocation,
            lastUpdated: new Date(),
          },
        }
      );

      console.log(`✅ Updated sector data for: ${fund.name}`);
      return true;
    } catch (error: any) {
      console.error(`❌ Error processing fund ${fundId}:`, error.message);
      return false;
    }
  }

  /**
   * Process all equity funds missing sector allocation
   * Run as background job
   */
  static async processAllFunds(limit: number = 100): Promise<void> {
    try {
      const db = mongodb.getDb();
      const fundsCollection = db.collection('funds');

      // Find equity funds without sector allocation
      const fundsWithoutSectors = await fundsCollection
        .find({
          category: 'equity',
          isActive: true,
          $or: [
            { sectorAllocation: { $exists: false } },
            { sectorAllocation: { $size: 0 } },
            { sectorAllocation: null },
          ],
        })
        .limit(limit)
        .toArray();

      console.log(
        `\n📊 Processing ${fundsWithoutSectors.length} equity funds without sector data...\n`
      );

      if (fundsWithoutSectors.length === 0) {
        console.log('✅ All equity funds already have sector allocation!');
        return;
      }

      let successCount = 0;
      let failCount = 0;
      let skippedCount = 0;

      for (let i = 0; i < fundsWithoutSectors.length; i++) {
        const fund = fundsWithoutSectors[i];
        console.log(
          `\n[${i + 1}/${fundsWithoutSectors.length}] Processing: ${fund.name}`
        );

        const success = await this.processSingleFund(fund.fundId);

        if (success) {
          successCount++;
        } else {
          failCount++;
        }

        // Rate limit: 1 request per second to avoid API throttling
        if (i < fundsWithoutSectors.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      console.log(`\n\n📈 SECTOR ALLOCATION PROCESSING COMPLETE:`);
      console.log(`✅ Success: ${successCount}`);
      console.log(`❌ Failed: ${failCount}`);
      console.log(`⏭️  Skipped: ${skippedCount}`);
      console.log(
        `📊 Total Processed: ${successCount + failCount + skippedCount}`
      );
    } catch (error: any) {
      console.error(`❌ Error in processAllFunds:`, error.message);
      throw error;
    }
  }

  /**
   * Get statistics on sector allocation coverage
   */
  static async getStats(): Promise<{
    totalEquityFunds: number;
    fundsWithSectors: number;
    fundsWithoutSectors: number;
    coveragePercent: number;
  }> {
    const db = mongodb.getDb();
    const fundsCollection = db.collection('funds');

    const totalEquityFunds = await fundsCollection.countDocuments({
      category: 'equity',
      isActive: true,
    });

    const fundsWithSectors = await fundsCollection.countDocuments({
      category: 'equity',
      isActive: true,
      sectorAllocation: { $exists: true, $not: { $in: [[], null] } },
    });

    const fundsWithoutSectors = totalEquityFunds - fundsWithSectors;
    const coveragePercent =
      totalEquityFunds > 0 ? (fundsWithSectors / totalEquityFunds) * 100 : 0;

    return {
      totalEquityFunds,
      fundsWithSectors,
      fundsWithoutSectors,
      coveragePercent: Math.round(coveragePercent * 100) / 100,
    };
  }
}
