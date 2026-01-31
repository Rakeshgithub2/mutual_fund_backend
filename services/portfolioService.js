const { mongodb } = require('../src/db/mongodb');
const { ObjectId } = require('mongodb');

/**
 * Portfolio Service
 * Manages user portfolios - starts at zero and updates based on user transactions
 */

/**
 * Get user portfolio or create empty one if doesn't exist
 */
const getUserPortfolio = async (userId) => {
  try {
    const db = mongodb.db;
    const portfoliosCollection = db.collection('portfolios');

    let portfolio = await portfoliosCollection.findOne({ userId });

    // If portfolio doesn't exist, create empty one
    if (!portfolio) {
      console.log(`📊 Creating new empty portfolio for user: ${userId}`);

      const newPortfolio = {
        userId,
        holdings: [],
        totalInvested: 0,
        currentValue: 0,
        totalGainLoss: 0,
        totalGainLossPercentage: 0,
        transactions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await portfoliosCollection.insertOne(newPortfolio);
      portfolio = newPortfolio;
    }

    return portfolio;
  } catch (error) {
    console.error('Error getting user portfolio:', error);
    throw error;
  }
};

/**
 * Add transaction to portfolio (buy or sell)
 */
const addTransaction = async (userId, transaction) => {
  try {
    const db = mongodb.db;
    const portfoliosCollection = db.collection('portfolios');
    const fundsCollection = db.collection('funds');

    // Validate transaction
    const { type, fundId, units, price, date } = transaction;

    if (!type || !fundId || !units || !price) {
      throw new Error('Missing required transaction fields');
    }

    if (!['buy', 'sell'].includes(type)) {
      throw new Error('Transaction type must be "buy" or "sell"');
    }

    if (units <= 0 || price <= 0) {
      throw new Error('Units and price must be positive numbers');
    }

    // Get fund details
    const fund = await fundsCollection.findOne({ _id: new ObjectId(fundId) });
    if (!fund) {
      throw new Error('Fund not found');
    }

    // Ensure we have currentNAV field (handle both currentNAV and currentNav)
    fund.currentNAV = fund.currentNAV || fund.currentNav || fund.nav || 0;

    // Normalize field names (handle both fundName/name and fundHouse formats)
    const fundName = fund.fundName || fund.name || 'Unknown Fund';
    const fundHouse = fund.fundHouse || fund.fundHouse || fund.amc || 'Unknown';

    // Get or create portfolio
    let portfolio = await getUserPortfolio(userId);

    // Calculate transaction amount
    const amount = units * price;

    // Create transaction record
    const newTransaction = {
      id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      fundId,
      fundName,
      fundHouse,
      units,
      price,
      amount,
      date: date || new Date(),
      createdAt: new Date(),
    };

    // Find existing holding
    const holdingIndex = portfolio.holdings.findIndex(
      (h) => h.fundId.toString() === fundId
    );

    if (type === 'buy') {
      if (holdingIndex >= 0) {
        // Update existing holding
        const holding = portfolio.holdings[holdingIndex];
        const newTotalUnits = holding.units + units;
        const newTotalInvested = holding.investedAmount + amount;

        portfolio.holdings[holdingIndex] = {
          ...holding,
          units: newTotalUnits,
          avgPrice: newTotalInvested / newTotalUnits,
          investedAmount: newTotalInvested,
          currentPrice: fund.currentNAV,
          currentValue: newTotalUnits * fund.currentNAV,
          gainLoss: newTotalUnits * fund.currentNAV - newTotalInvested,
          gainLossPercentage:
            ((newTotalUnits * fund.currentNAV - newTotalInvested) /
              newTotalInvested) *
            100,
          lastUpdated: new Date(),
        };
      } else {
        // Add new holding
        portfolio.holdings.push({
          fundId: new ObjectId(fundId),
          fundName,
          fundHouse,
          category: fund.category || fund.subCategory || 'Other',
          units,
          avgPrice: price,
          investedAmount: amount,
          currentPrice: fund.currentNAV,
          currentValue: units * fund.currentNAV,
          gainLoss: units * fund.currentNAV - amount,
          gainLossPercentage:
            ((units * fund.currentNAV - amount) / amount) * 100,
          addedAt: new Date(),
          lastUpdated: new Date(),
        });
      }

      portfolio.totalInvested += amount;
    } else if (type === 'sell') {
      if (holdingIndex < 0) {
        throw new Error('Cannot sell - fund not found in portfolio');
      }

      const holding = portfolio.holdings[holdingIndex];

      if (holding.units < units) {
        throw new Error(
          `Insufficient units. Available: ${holding.units}, Requested: ${units}`
        );
      }

      const remainingUnits = holding.units - units;
      const soldInvestedAmount =
        (units / holding.units) * holding.investedAmount;

      if (remainingUnits === 0) {
        // Remove holding completely
        portfolio.holdings.splice(holdingIndex, 1);
      } else {
        // Update holding
        const newInvestedAmount = holding.investedAmount - soldInvestedAmount;
        portfolio.holdings[holdingIndex] = {
          ...holding,
          units: remainingUnits,
          investedAmount: newInvestedAmount,
          currentValue: remainingUnits * fund.currentNAV,
          gainLoss: remainingUnits * fund.currentNAV - newInvestedAmount,
          gainLossPercentage:
            ((remainingUnits * fund.currentNAV - newInvestedAmount) /
              newInvestedAmount) *
            100,
          lastUpdated: new Date(),
        };
      }

      portfolio.totalInvested -= soldInvestedAmount;
    }

    // Recalculate portfolio totals
    portfolio.currentValue = portfolio.holdings.reduce(
      (sum, h) => sum + h.currentValue,
      0
    );
    portfolio.totalGainLoss = portfolio.currentValue - portfolio.totalInvested;
    portfolio.totalGainLossPercentage =
      portfolio.totalInvested > 0
        ? (portfolio.totalGainLoss / portfolio.totalInvested) * 100
        : 0;

    // Add transaction to history
    portfolio.transactions.unshift(newTransaction);
    portfolio.updatedAt = new Date();

    // Update in database
    await portfoliosCollection.updateOne({ userId }, { $set: portfolio });

    console.log(
      `✅ Transaction completed: ${type.toUpperCase()} ${units} units of ${fund.fundName}`
    );

    return {
      success: true,
      transaction: newTransaction,
      portfolio,
    };
  } catch (error) {
    console.error('Error adding transaction:', error);
    throw error;
  }
};

/**
 * Update portfolio values based on latest NAVs
 */
const updatePortfolioValues = async (userId) => {
  try {
    const db = mongodb.db;
    const portfoliosCollection = db.collection('portfolios');
    const fundsCollection = db.collection('funds');

    const portfolio = await getUserPortfolio(userId);

    if (portfolio.holdings.length === 0) {
      return portfolio; // No holdings to update
    }

    // Update each holding with latest NAV
    for (let i = 0; i < portfolio.holdings.length; i++) {
      const holding = portfolio.holdings[i];
      const fund = await fundsCollection.findOne({
        _id: new ObjectId(holding.fundId),
      });

      if (fund) {
        // Handle both currentNAV and currentNav field names
        const currentNav = fund.currentNAV || fund.currentNav || fund.nav || 0;

        holding.currentPrice = currentNav;
        holding.currentValue = holding.units * currentNav;
        holding.gainLoss = holding.currentValue - holding.investedAmount;
        holding.gainLossPercentage =
          (holding.gainLoss / holding.investedAmount) * 100;
        holding.lastUpdated = new Date();
      }
    }

    // Recalculate totals
    portfolio.currentValue = portfolio.holdings.reduce(
      (sum, h) => sum + h.currentValue,
      0
    );
    portfolio.totalGainLoss = portfolio.currentValue - portfolio.totalInvested;
    portfolio.totalGainLossPercentage =
      portfolio.totalInvested > 0
        ? (portfolio.totalGainLoss / portfolio.totalInvested) * 100
        : 0;
    portfolio.updatedAt = new Date();

    // Save to database
    await portfoliosCollection.updateOne({ userId }, { $set: portfolio });

    console.log(`✅ Portfolio values updated for user: ${userId}`);

    return portfolio;
  } catch (error) {
    console.error('Error updating portfolio values:', error);
    throw error;
  }
};

/**
 * Get transaction history for a user
 */
const getTransactionHistory = async (userId, limit = 50) => {
  try {
    const portfolio = await getUserPortfolio(userId);

    return {
      transactions: portfolio.transactions.slice(0, limit),
      totalTransactions: portfolio.transactions.length,
    };
  } catch (error) {
    console.error('Error getting transaction history:', error);
    throw error;
  }
};

/**
 * Get portfolio summary statistics
 */
const getPortfolioSummary = async (userId) => {
  try {
    const portfolio = await getUserPortfolio(userId);

    const summary = {
      totalInvested: portfolio.totalInvested,
      currentValue: portfolio.currentValue,
      totalGainLoss: portfolio.totalGainLoss,
      totalGainLossPercentage: portfolio.totalGainLossPercentage,
      totalHoldings: portfolio.holdings.length,
      totalTransactions: portfolio.transactions.length,
      lastUpdated: portfolio.updatedAt,
    };

    // Calculate category-wise allocation
    const categoryAllocation = {};
    portfolio.holdings.forEach((holding) => {
      const category = holding.category || 'Other';
      if (!categoryAllocation[category]) {
        categoryAllocation[category] = {
          invested: 0,
          currentValue: 0,
          count: 0,
        };
      }
      categoryAllocation[category].invested += holding.investedAmount;
      categoryAllocation[category].currentValue += holding.currentValue;
      categoryAllocation[category].count += 1;
    });

    summary.categoryAllocation = categoryAllocation;

    // Top performers
    const sortedHoldings = [...portfolio.holdings].sort(
      (a, b) => b.gainLossPercentage - a.gainLossPercentage
    );
    summary.topPerformers = sortedHoldings.slice(0, 5).map((h) => ({
      fundName: h.fundName,
      gainLossPercentage: h.gainLossPercentage,
      currentValue: h.currentValue,
    }));

    // Bottom performers
    summary.bottomPerformers = sortedHoldings
      .slice(-5)
      .reverse()
      .map((h) => ({
        fundName: h.fundName,
        gainLossPercentage: h.gainLossPercentage,
        currentValue: h.currentValue,
      }));

    return summary;
  } catch (error) {
    console.error('Error getting portfolio summary:', error);
    throw error;
  }
};

module.exports = {
  getUserPortfolio,
  addTransaction,
  updatePortfolioValues,
  getTransactionHistory,
  getPortfolioSummary,
};
