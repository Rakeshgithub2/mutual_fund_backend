import { yahooFinanceImporter } from './yahoo-finance.importer';
import { amfiImporter } from './amfi.importer';
import { mfApiImporter } from './mfapi.importer';
import { enhancedYahooImporter } from './enhanced-yahoo.importer';
import { fundManagerImporter } from './fund-manager.importer';
import { FundModel, FundPriceModel, FundManagerModel } from '../../models';
import { Fund, FundPrice, FundManager } from '../../db/schemas';

// Lazy-initialized model instances
let fundModel: ReturnType<typeof FundModel.getInstance> | null = null;
let fundPriceModel: ReturnType<typeof FundPriceModel.getInstance> | null = null;
let fundManagerModel: ReturnType<typeof FundManagerModel.getInstance> | null =
  null;

const getFundModel = () => {
  if (!fundModel) fundModel = FundModel.getInstance();
  return fundModel;
};
const getFundPriceModel = () => {
  if (!fundPriceModel) fundPriceModel = FundPriceModel.getInstance();
  return fundPriceModel;
};
const getFundManagerModel = () => {
  if (!fundManagerModel) fundManagerModel = FundManagerModel.getInstance();
  return fundManagerModel;
};

/**
 * Master Fund Data Ingestion Orchestrator
 * Coordinates the import of funds, managers, and price history
 */
export class FundIngestionOrchestrator {
  /**
   * Enhanced import for real-world fund data
   * Imports equity funds (100+) and commodity funds (50+) from real APIs
   */
  async importRealWorldFunds(
    options: {
      equityCount?: number;
      commodityCount?: number;
      skipExisting?: boolean;
    } = {}
  ): Promise<{
    totalImported: number;
    equity: number;
    commodity: number;
    managers: number;
  }> {
    const {
      equityCount = 100,
      commodityCount = 50,
      skipExisting = true,
    } = options;

    console.log('\n');
    console.log('════════════════════════════════════════════════════');
    console.log('   🚀 REAL-WORLD FUND DATA IMPORT - STARTING');
    console.log('════════════════════════════════════════════════════\n');

    const stats = {
      totalImported: 0,
      equity: 0,
      commodity: 0,
      managers: 0,
    };

    try {
      // Step 1: Import Real Equity Funds (Large Cap: 30, Mid Cap: 25, Small Cap: 20, Multi Cap: 25)
      console.log('\n📈 STEP 1: Importing Real Equity Funds');
      console.log('─────────────────────────────────────────────────\n');

      const equityResult = await mfApiImporter.importEquityFunds({
        limit: equityCount,
        targetCounts: {
          largeCap: Math.floor(equityCount * 0.3),
          midCap: Math.floor(equityCount * 0.25),
          smallCap: Math.floor(equityCount * 0.2),
          multiCap: Math.floor(equityCount * 0.25),
        },
      });

      console.log(`\n✅ Equity Import Results:`);
      console.log(`   • Imported: ${equityResult.imported}`);
      console.log(`   • Failed: ${equityResult.failed}`);

      // Step 2: Import Real Commodity Funds (Mutual Funds)
      console.log('\n\n🥇 STEP 2: Importing Real Commodity Mutual Funds');
      console.log('─────────────────────────────────────────────────\n');

      const commodityMFResult = await mfApiImporter.importCommodityFunds({
        limit: Math.floor(commodityCount * 0.6), // 60% from mutual funds
      });

      console.log(`\n✅ Commodity MF Import Results:`);
      console.log(`   • Imported: ${commodityMFResult.imported}`);
      console.log(`   • Failed: ${commodityMFResult.failed}`);

      // Step 3: Import Commodity ETFs
      console.log('\n\n🏆 STEP 3: Importing Commodity ETFs');
      console.log('─────────────────────────────────────────────────\n');

      const commodityETFResult =
        await enhancedYahooImporter.importCommodityETFs({
          limit: Math.floor(commodityCount * 0.4), // 40% from ETFs
        });

      console.log(`\n✅ Commodity ETF Import Results:`);
      console.log(`   • Imported: ${commodityETFResult.imported}`);
      console.log(`   • Failed: ${commodityETFResult.failed}`);

      // Combine all fund data
      const allFunds = [
        ...equityResult.data,
        ...commodityMFResult.data,
        ...commodityETFResult.data,
      ];

      // Step 4: Extract and import fund managers
      console.log('\n\n👥 STEP 4: Extracting Fund Managers');
      console.log('─────────────────────────────────────────────────\n');

      const managerResult = await fundManagerImporter.extractManagers(allFunds);
      const knownManagers = fundManagerImporter.getAllKnownManagers();
      managerResult.data.push(...knownManagers);

      console.log(`\n✅ Manager Extraction Results:`);
      console.log(`   • Total Managers: ${managerResult.data.length}`);

      // Step 5: Assign managers to funds
      console.log('\n\n🎯 STEP 5: Assigning Managers to Funds');
      console.log('─────────────────────────────────────────────────\n');

      const fundsWithManagers = fundManagerImporter.assignManagersToFunds(
        allFunds,
        managerResult.data
      );

      // Step 6: Save to database
      console.log('\n\n💾 STEP 6: Saving to Database');
      console.log('─────────────────────────────────────────────────\n');

      // Save managers first
      console.log('Saving fund managers...');
      const savedManagers = await this.saveManagers(managerResult.data);
      stats.managers = savedManagers;
      console.log(`✓ Saved ${savedManagers} managers`);

      // Save funds
      console.log('\nSaving funds...');
      const savedFunds = await this.saveFunds(fundsWithManagers);
      stats.totalImported = savedFunds;
      stats.equity = equityResult.imported;
      stats.commodity =
        commodityMFResult.imported + commodityETFResult.imported;
      console.log(`✓ Saved ${savedFunds} funds`);

      // Final summary
      console.log('\n\n════════════════════════════════════════════════════');
      console.log('   ✅ REAL-WORLD DATA IMPORT COMPLETED');
      console.log('════════════════════════════════════════════════════');
      console.log(`   📊 Total Funds: ${stats.totalImported}`);
      console.log(`   📈 Equity Funds: ${stats.equity}`);
      console.log(`   🥇 Commodity Funds: ${stats.commodity}`);
      console.log(`   👥 Managers: ${stats.managers}`);
      console.log('════════════════════════════════════════════════════\n');

      return stats;
    } catch (error: any) {
      console.error('\n\n❌ REAL-WORLD IMPORT FAILED:', error.message);
      throw error;
    }
  }

  /**
   * Import all funds (ETFs + Mutual Funds) - Legacy method
   */
  async importAllFunds(
    options: {
      etfLimit?: number;
      mutualFundLimit?: number;
      skipExisting?: boolean;
    } = {}
  ): Promise<{
    totalImported: number;
    etfs: number;
    mutualFunds: number;
    managers: number;
  }> {
    const {
      etfLimit = 50,
      mutualFundLimit = 100,
      skipExisting = true,
    } = options;

    console.log('\n');
    console.log('════════════════════════════════════════════════════');
    console.log('   🚀 FUND INGESTION SYSTEM - STARTING IMPORT');
    console.log('════════════════════════════════════════════════════\n');

    const stats = {
      totalImported: 0,
      etfs: 0,
      mutualFunds: 0,
      managers: 0,
    };

    try {
      // Step 1: Import ETFs from Yahoo Finance (skip if etfLimit is 0)
      let etfResult = {
        imported: 0,
        failed: 0,
        data: [],
        errors: [],
        success: true,
      };

      if (etfLimit > 0) {
        console.log('\n📊 STEP 1: Importing ETFs from Yahoo Finance');
        console.log('─────────────────────────────────────────────────\n');

        etfResult = await yahooFinanceImporter.importETFs({
          limit: etfLimit,
          skipExisting,
        });

        console.log(`\n✅ ETF Import Results:`);
        console.log(`   • Imported: ${etfResult.imported}`);
        console.log(`   • Failed: ${etfResult.failed}`);
      } else {
        console.log('\n📊 STEP 1: Skipping ETF import (etfLimit = 0)');
        console.log('─────────────────────────────────────────────────\n');
      }

      // Step 2: Import Mutual Funds from AMFI
      console.log('\n\n📈 STEP 2: Importing Mutual Funds from AMFI');
      console.log('─────────────────────────────────────────────────\n');

      const mfResult = await amfiImporter.importMutualFunds({
        limit: mutualFundLimit,
        skipExisting,
      });

      console.log(`\n✅ Mutual Fund Import Results:`);
      console.log(`   • Imported: ${mfResult.imported}`);
      console.log(`   • Failed: ${mfResult.failed}`);

      // Combine all fund data
      const allFunds = [...etfResult.data, ...mfResult.data];

      // Step 3: Extract and import fund managers
      console.log('\n\n👥 STEP 3: Extracting Fund Managers');
      console.log('─────────────────────────────────────────────────\n');

      const managerResult = await fundManagerImporter.extractManagers(allFunds);

      // Add known managers
      const knownManagers = fundManagerImporter.getAllKnownManagers();
      managerResult.data.push(...knownManagers);

      console.log(`\n✅ Manager Extraction Results:`);
      console.log(`   • Total Managers: ${managerResult.data.length}`);

      // Step 4: Assign managers to funds
      console.log('\n\n🎯 STEP 4: Assigning Managers to Funds');
      console.log('─────────────────────────────────────────────────\n');

      const fundsWithManagers = fundManagerImporter.assignManagersToFunds(
        allFunds,
        managerResult.data
      );

      // Step 5: Save to database
      console.log('\n\n💾 STEP 5: Saving to Database');
      console.log('─────────────────────────────────────────────────\n');

      // Save managers first
      console.log('Saving fund managers...');
      const savedManagers = await this.saveManagers(managerResult.data);
      stats.managers = savedManagers;
      console.log(`✓ Saved ${savedManagers} managers`);

      // Save funds
      console.log('\nSaving funds...');
      const savedFunds = await this.saveFunds(fundsWithManagers);
      stats.totalImported = savedFunds;
      stats.etfs = etfResult.imported;
      stats.mutualFunds = mfResult.imported;
      console.log(`✓ Saved ${savedFunds} funds`);

      // Final summary
      console.log('\n\n════════════════════════════════════════════════════');
      console.log('   ✅ IMPORT COMPLETED SUCCESSFULLY');
      console.log('════════════════════════════════════════════════════');
      console.log(`   📊 Total Funds: ${stats.totalImported}`);
      console.log(`   📈 ETFs: ${stats.etfs}`);
      console.log(`   📉 Mutual Funds: ${stats.mutualFunds}`);
      console.log(`   👥 Managers: ${stats.managers}`);
      console.log('════════════════════════════════════════════════════\n');

      return stats;
    } catch (error: any) {
      console.error('\n\n❌ IMPORT FAILED:', error.message);
      throw error;
    }
  }

  /**
   * Save funds to database
   */
  private async saveFunds(rawFunds: any[]): Promise<number> {
    let saved = 0;

    for (const rawFund of rawFunds) {
      try {
        // Check if fund exists
        const existing = await getFundModel().findById(rawFund.symbol);
        if (existing) {
          // Update existing fund
          await getFundModel().update(rawFund.symbol, {
            name: rawFund.name,
            currentNav: rawFund.nav,
            previousNav: rawFund.previousNav,
            navDate: new Date(),
            lastUpdated: new Date(),
          });
        } else {
          // Create new fund
          const fundData: Partial<Fund> = {
            fundId: rawFund.symbol,
            name: rawFund.name,
            category: rawFund.category,
            subCategory: rawFund.subCategory || 'General',
            fundType: rawFund.fundType,
            fundHouse: rawFund.fundHouse,
            launchDate: rawFund.launchDate || new Date(),
            aum: rawFund.aum || 0,
            expenseRatio: rawFund.expenseRatio || 1.0,
            exitLoad: rawFund.exitLoad || 0,
            minInvestment: rawFund.minInvestment || 5000,
            sipMinAmount: rawFund.sipMinAmount || 500,
            fundManager: rawFund.fundManager || 'N/A',
            returns: {
              day: rawFund.returns?.day || 0,
              week: rawFund.returns?.week || 0,
              month: rawFund.returns?.month || 0,
              threeMonth: rawFund.returns?.threeMonth || 0,
              sixMonth: rawFund.returns?.sixMonth || 0,
              oneYear: rawFund.returns?.oneYear || 0,
              threeYear: rawFund.returns?.threeYear || 0,
              fiveYear: rawFund.returns?.fiveYear || 0,
              sinceInception: rawFund.returns?.sinceInception || 0,
            },
            riskMetrics: {
              sharpeRatio: 0,
              standardDeviation: 0,
              beta: 1.0,
              alpha: 0,
              rSquared: 0,
              sortino: 0,
            },
            holdings: [],
            sectorAllocation: [],
            currentNav: rawFund.nav,
            previousNav: rawFund.previousNav || rawFund.nav,
            navDate: new Date(),
            ratings: {},
            tags: [rawFund.category, rawFund.subCategory],
            searchTerms: [
              rawFund.name.toLowerCase(),
              rawFund.fundHouse.toLowerCase(),
              rawFund.category.toLowerCase(),
            ],
            popularity: 0,
            isActive: true,
            dataSource: rawFund.dataSource,
            lastUpdated: new Date(),
            createdAt: new Date(),
          };

          await getFundModel().create(fundData);
        }
        saved++;
      } catch (error: any) {
        console.error(`Error saving fund ${rawFund.name}:`, error.message);
      }
    }

    return saved;
  }

  /**
   * Save managers to database
   */
  private async saveManagers(rawManagers: any[]): Promise<number> {
    let saved = 0;

    for (const rawManager of rawManagers) {
      try {
        // Generate manager ID
        const managerId = rawManager.name
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '');

        // Check if manager exists
        const existing = await getFundManagerModel().findById(managerId);
        if (existing) {
          continue; // Skip existing
        }

        // Create new manager
        const managerData: Partial<FundManager> = {
          managerId,
          name: rawManager.name,
          bio:
            rawManager.bio ||
            `Experienced fund manager at ${rawManager.fundHouse}`,
          experience: rawManager.experience || 15,
          qualification: rawManager.qualification || ['MBA - Finance'],
          currentFundHouse: rawManager.fundHouse,
          designation: rawManager.designation || 'Fund Manager',
          joinedDate: new Date('2015-01-01'),
          fundsManaged: [],
          totalAumManaged: 0,
          averageReturns: {
            oneYear: 0,
            threeYear: 0,
            fiveYear: 0,
          },
          awards: [],
          isActive: true,
          lastUpdated: new Date(),
          createdAt: new Date(),
        };

        await getFundManagerModel().create(managerData);
        saved++;
      } catch (error: any) {
        console.error(
          `Error saving manager ${rawManager.name}:`,
          error.message
        );
      }
    }

    return saved;
  }

  /**
   * Import historical prices for specific funds
   */
  async importHistoricalPrices(
    fundIds: string[],
    period: string = '1y'
  ): Promise<number> {
    console.log(
      `\n📊 Importing historical prices for ${fundIds.length} funds...`
    );
    let totalSaved = 0;

    for (const fundId of fundIds) {
      try {
        console.log(`\n  Processing ${fundId}...`);

        // Fetch historical data
        const historicalData =
          await yahooFinanceImporter.importHistoricalPrices(fundId, period);

        // Save to database
        for (const priceData of historicalData) {
          if (!priceData.close) continue;

          const previousClose = priceData.open || priceData.close;
          const changePercent =
            ((priceData.close - previousClose) / previousClose) * 100;

          await fundPriceModel.upsert({
            fundId,
            date: priceData.date,
            nav: priceData.close,
            open: priceData.open,
            high: priceData.high,
            low: priceData.low,
            close: priceData.close,
            volume: priceData.volume,
            changePercent,
          });

          totalSaved++;
        }

        console.log(`  ✓ Saved ${historicalData.length} price points`);

        // Small delay between funds
        await this.delay(1000);
      } catch (error: any) {
        console.error(
          `  ✗ Error importing prices for ${fundId}:`,
          error.message
        );
      }
    }

    console.log(`\n✅ Total price points saved: ${totalSaved}\n`);
    return totalSaved;
  }

  /**
   * Update latest NAV for all funds
   */
  async updateLatestNAVs(): Promise<number> {
    console.log('\n🔄 Updating latest NAVs for all funds...\n');

    const funds = await getFundModel().findAll({ limit: 1000 });
    let updated = 0;

    for (const fund of funds) {
      try {
        // For Yahoo Finance symbols
        if (
          fund.dataSource === 'Yahoo Finance' &&
          (fund.fundId.includes('.') || fund.fundId.length <= 5)
        ) {
          const quote = await yahooFinanceImporter.getQuote(fund.fundId);
          if (quote && quote.regularMarketPrice) {
            await getFundModel().updateNav(
              fund.fundId,
              quote.regularMarketPrice,
              new Date()
            );
            updated++;
            console.log(`  ✓ ${fund.name}: ₹${quote.regularMarketPrice}`);
          }
        }

        // Small delay
        await this.delay(300);
      } catch (error: any) {
        console.error(`  ✗ Error updating ${fund.name}`);
      }
    }

    console.log(`\n✅ Updated ${updated} funds\n`);
    return updated;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const fundIngestionOrchestrator = new FundIngestionOrchestrator();
