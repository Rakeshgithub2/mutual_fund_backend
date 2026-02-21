"use strict";
/**
 * FUND DETAILS CONTROLLER
 * Returns complete fund information including:
 * - Sector allocation
 * - Top 15 holdings
 * - Asset allocation
 * - NAV history
 * - Fund manager details
 * - Risk metrics
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFundHoldings = exports.getFundSectors = exports.getFundDetails = void 0;
const Fund = require('../models/Fund.model');
const redis_1 = require("../cache/redis");
const holdings_1 = require("../db/models/holdings");
const sectorAllocation_1 = require("../db/models/sectorAllocation");
const mongodb_1 = require("../db/mongodb");
const geminiHoldings_1 = require("../utils/geminiHoldings");
/**
 * GET /api/funds/:fundId/details
 * Returns complete fund details with sectors and holdings
 */
const getFundDetails = async (req, res) => {
    try {
        const { fundId } = req.params;
        console.log(`📊 Fetching complete details for fund: ${fundId}`);
        // Fetch fund with all details
        const fund = await Fund.findOne({
            $or: [{ fundId }, { _id: fundId }],
        }).lean();
        if (!fund) {
            return res.status(404).json({
                success: false,
                error: 'Fund not found',
            });
        }
        // Extract complete details
        const fundDetails = {
            // Basic Info
            fundId: fund.fundId,
            name: fund.name,
            category: fund.category,
            subCategory: fund.subCategory,
            fundHouse: fund.fundHouse,
            fundType: fund.fundType,
            // NAV & Returns
            currentNav: fund.currentNav,
            previousNav: fund.previousNav,
            navDate: fund.navDate,
            returns: fund.returns,
            // Holdings (Top 15)
            holdings: fund.holdings?.slice(0, 15).map((holding) => ({
                companyName: holding.companyName,
                sector: holding.sector,
                percentage: holding.percentage,
                value: holding.value,
                quantity: holding.quantity,
            })) || [],
            // Sector Allocation
            sectorAllocation: fund.sectorAllocation?.map((sector) => ({
                sector: sector.sector,
                percentage: sector.percentage,
                amount: sector.amount,
            })) || [],
            // Asset Allocation
            assetAllocation: fund.assetAllocation || {
                equity: 0,
                debt: 0,
                cash: 0,
                others: 0,
            },
            // Fund Manager
            fundManager: fund.fundManager || {
                name: 'Not Available',
                experience: 0,
                since: null,
            },
            // Risk Metrics
            riskMetrics: fund.riskMetrics || {},
            // Additional Details
            aum: fund.aum,
            expenseRatio: fund.expenseRatio?.value || fund.expenseRatio,
            exitLoad: fund.exitLoad?.value || fund.exitLoad,
            minInvestment: fund.minInvestment,
            inceptionDate: fund.inceptionDate,
            status: fund.status || 'Active',
            // Ratings
            ratings: fund.ratings || {},
            // Performance Metrics
            categoryRank: fund.categoryRank,
            totalFundsInCategory: fund.totalFundsInCategory,
        };
        console.log(`✅ Fund details fetched: ${fundDetails.holdings.length} holdings, ${fundDetails.sectorAllocation.length} sectors`);
        res.json({
            success: true,
            data: fundDetails,
        });
    }
    catch (error) {
        console.error('❌ Error fetching fund details:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch fund details',
        });
    }
};
exports.getFundDetails = getFundDetails;
/**
 * GET /api/funds/:fundId/sectors
 * Returns only sector allocation for a fund
 */
const getFundSectors = async (req, res) => {
    try {
        const { fundId } = req.params;
        const fund = await Fund.findOne({
            $or: [{ fundId }, { _id: fundId }],
        }, { sectorAllocation: 1, name: 1, category: 1 }).lean();
        if (!fund) {
            return res.status(404).json({
                success: false,
                error: 'Fund not found',
            });
        }
        res.json({
            success: true,
            data: {
                fundId,
                name: fund.name,
                category: fund.category,
                sectors: fund.sectorAllocation || [],
            },
        });
    }
    catch (error) {
        console.error('❌ Error fetching fund sectors:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch fund sectors',
        });
    }
};
exports.getFundSectors = getFundSectors;
/**
 * GET /api/funds/:fundId/holdings
 * Returns only top holdings for a fund
 */
const getFundHoldings = async (req, res) => {
    try {
        const { fundId } = req.params;
        const limit = parseInt(req.query.limit) || 15;
        const cacheKey = `holdings:${fundId}`;
        await redis_1.redis.connect();
        // 1. Check Redis
        const cached = await redis_1.redis.get(cacheKey);
        if (cached) {
            return res.json({ success: true, data: cached });
        }
        // 2. Check MongoDB
        const db = mongodb_1.mongodb.getDb();
        const holdingsCol = (0, holdings_1.getHoldingsCollection)(db);
        const doc = await holdingsCol.findOne({ schemeCode: fundId });
        if (doc) {
            await redis_1.redis.set(cacheKey, doc, 3600);
            return res.json({ success: true, data: doc });
        }
        // 3. Fetch from Gemini API
        let geminiHoldings = null;
        try {
            // Fetch fund name for prompt
            const fund = await db.collection('funds').findOne({ fundId });
            const fundName = fund?.name || fundId;
            const holdings = await (0, geminiHoldings_1.fetchHoldingsFromGemini)(fundId, fundName);
            if (Array.isArray(holdings) && holdings.length > 0) {
                geminiHoldings = {
                    schemeCode: fundId,
                    holdings: holdings.slice(0, limit),
                    fetchedAt: new Date(),
                };
                await holdingsCol.insertOne(geminiHoldings);
                await redis_1.redis.set(cacheKey, geminiHoldings, 3600);
            }
        }
        catch (err) {
            console.error('Gemini holdings API fetch failed:', err.message);
        }
        if (geminiHoldings) {
            // 4. Compute sector allocation
            const sectorMap = {};
            for (const h of geminiHoldings.holdings) {
                if (!h.sector)
                    continue;
                sectorMap[h.sector] = (sectorMap[h.sector] || 0) + h.percentage;
            }
            const sectors = Object.entries(sectorMap).map(([sector, percentage]) => ({
                sector,
                percentage,
            }));
            const sectorCol = (0, sectorAllocation_1.getSectorAllocationCollection)(db);
            await sectorCol.updateOne({ schemeCode: fundId }, { $set: { schemeCode: fundId, sectors } }, { upsert: true });
            return res.json({ success: true, data: geminiHoldings });
        }
        // Not found
        return res
            .status(404)
            .json({ success: false, error: 'Holdings not found in real world' });
    }
    catch (error) {
        console.error('❌ Error fetching fund holdings:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch fund holdings',
        });
    }
};
exports.getFundHoldings = getFundHoldings;
