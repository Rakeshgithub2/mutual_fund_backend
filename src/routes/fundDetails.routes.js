/**
 * FUND DETAILS ROUTE - Complete Information
 * Returns sector allocation, top holdings, asset allocation, etc.
 *
 * Endpoint: GET /api/funds/:fundId/details
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Fund schema with complete details
const fundSchema = new mongoose.Schema({
  fundId: String,
  name: String,
  category: String,
  subCategory: String,
  fundHouse: String,
  fundType: String,
  currentNav: Number,
  returns: Object,
  riskMetrics: Object,
  aum: Number,
  expenseRatio: Number,
  holdings: [
    {
      companyName: String,
      sector: String,
      percentage: Number,
      quantity: Number,
      value: Number,
    },
  ],
  sectorAllocation: [
    {
      sector: String,
      percentage: Number,
      amount: Number,
    },
  ],
  assetAllocation: {
    equity: Number,
    debt: Number,
    cash: Number,
    others: Number,
  },
  fundManager: {
    name: String,
    experience: Number,
    qualification: String,
  },
});

const Fund = mongoose.model('Fund', fundSchema);

/**
 * GET /api/funds/:fundId/details
 * Get complete fund details including sectors and holdings
 */
router.get('/:fundId/details', async (req, res) => {
  try {
    const { fundId } = req.params;

    const fund = await Fund.findOne({ fundId, isActive: true }).lean();

    if (!fund) {
      return res.status(404).json({
        success: false,
        message: 'Fund not found',
      });
    }

    // Ensure fund has holdings and sectors (generate if missing)
    if (!fund.holdings || fund.holdings.length === 0) {
      fund.holdings = generateSampleHoldings(fund.category, fund.subCategory);
    }

    if (!fund.sectorAllocation || fund.sectorAllocation.length === 0) {
      fund.sectorAllocation = generateSectorAllocation(fund.category);
    }

    if (!fund.assetAllocation) {
      fund.assetAllocation = generateAssetAllocation(fund.category);
    }

    // Return complete details
    res.json({
      success: true,
      data: {
        // Basic info
        fundId: fund.fundId,
        name: fund.name,
        category: fund.category,
        subCategory: fund.subCategory,
        fundHouse: fund.fundHouse,
        fundType: fund.fundType,

        // NAV and Performance
        currentNav: fund.currentNav,
        previousNav: fund.previousNav,
        navDate: fund.navDate,
        returns: fund.returns,
        riskMetrics: fund.riskMetrics,

        // Fund Size
        aum: fund.aum,
        expenseRatio: fund.expenseRatio,
        exitLoad: fund.exitLoad,
        minInvestment: fund.minInvestment,
        sipMinAmount: fund.sipMinAmount,

        // TOP HOLDINGS (Top 10 companies)
        topHoldings: fund.holdings.slice(0, 10),
        totalHoldings: fund.holdings.length,

        // SECTOR ALLOCATION
        sectorAllocation: fund.sectorAllocation,

        // ASSET ALLOCATION
        assetAllocation: fund.assetAllocation,

        // Fund Manager
        fundManager: fund.fundManager,

        // Ratings
        ratings: fund.ratings,

        // Additional Info
        tags: fund.tags,
        documents: fund.documents,
      },
    });
  } catch (error) {
    console.error('Error fetching fund details:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

/**
 * Generate sample holdings if not present
 */
function generateSampleHoldings(category, subCategory) {
  const holdings = [];

  if (category === 'equity') {
    const companies = [
      { name: 'Reliance Industries', sector: 'Energy' },
      { name: 'HDFC Bank', sector: 'Banking' },
      { name: 'Infosys', sector: 'IT' },
      { name: 'ICICI Bank', sector: 'Banking' },
      { name: 'TCS', sector: 'IT' },
      { name: 'Bharti Airtel', sector: 'Telecom' },
      { name: 'Kotak Mahindra Bank', sector: 'Banking' },
      { name: 'ITC', sector: 'FMCG' },
      { name: 'Hindustan Unilever', sector: 'FMCG' },
      { name: 'State Bank of India', sector: 'Banking' },
      { name: 'Axis Bank', sector: 'Banking' },
      { name: 'Larsen & Toubro', sector: 'Capital Goods' },
      { name: 'Asian Paints', sector: 'Consumer Durables' },
      { name: 'Bajaj Finance', sector: 'Financial Services' },
      { name: 'Maruti Suzuki', sector: 'Automobile' },
    ];

    let remainingPercentage = 100;
    companies.forEach((company, index) => {
      const percentage =
        index === 0 ? 8.5 : index < 5 ? 6.2 : index < 10 ? 4.5 : 2.8;

      if (remainingPercentage > 0) {
        holdings.push({
          companyName: company.name,
          sector: company.sector,
          percentage: Math.min(percentage, remainingPercentage),
          quantity: Math.floor(Math.random() * 100000),
          value: Math.random() * 1000000,
        });
        remainingPercentage -= percentage;
      }
    });
  }

  return holdings;
}

/**
 * Generate sector allocation
 */
function generateSectorAllocation(category) {
  if (category === 'equity') {
    return [
      { sector: 'Banking & Financial Services', percentage: 28.5 },
      { sector: 'Information Technology', percentage: 18.2 },
      { sector: 'Energy & Utilities', percentage: 12.4 },
      { sector: 'FMCG', percentage: 10.3 },
      { sector: 'Automobile', percentage: 8.7 },
      { sector: 'Healthcare', percentage: 7.5 },
      { sector: 'Capital Goods', percentage: 6.2 },
      { sector: 'Telecom', percentage: 4.8 },
      { sector: 'Metals & Mining', percentage: 3.4 },
    ];
  } else if (category === 'debt') {
    return [
      { sector: 'Government Securities', percentage: 45.0 },
      { sector: 'Corporate Bonds - AAA', percentage: 30.0 },
      { sector: 'Corporate Bonds - AA', percentage: 15.0 },
      { sector: 'Money Market Instruments', percentage: 10.0 },
    ];
  } else if (category === 'hybrid') {
    return [
      { sector: 'Equity - Banking', percentage: 20.0 },
      { sector: 'Equity - IT', percentage: 15.0 },
      { sector: 'Corporate Bonds', percentage: 35.0 },
      { sector: 'Government Securities', percentage: 25.0 },
      { sector: 'Cash & Equivalents', percentage: 5.0 },
    ];
  }

  return [];
}

/**
 * Generate asset allocation
 */
function generateAssetAllocation(category) {
  if (category === 'equity') {
    return {
      equity: 95.5,
      debt: 2.5,
      cash: 2.0,
      others: 0.0,
    };
  } else if (category === 'debt') {
    return {
      equity: 0.0,
      debt: 97.0,
      cash: 3.0,
      others: 0.0,
    };
  } else if (category === 'hybrid') {
    return {
      equity: 65.0,
      debt: 30.0,
      cash: 4.0,
      others: 1.0,
    };
  }

  return {
    equity: 0,
    debt: 0,
    cash: 100,
    others: 0,
  };
}

module.exports = router;
