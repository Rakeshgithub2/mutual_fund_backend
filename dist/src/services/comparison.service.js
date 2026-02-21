"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComparisonService = void 0;
class ComparisonService {
    constructor(db) {
        this.db = db;
    }
    /**
     * Compare two or more funds
     * For simplicity, pairwise comparisons are done for 2 funds
     * For 3+ funds, we compute all pairwise comparisons
     */
    async compareFunds(fundIds, options = {}) {
        if (fundIds.length < 2) {
            throw new Error('At least 2 fund IDs required for comparison');
        }
        const { topNHoldings = 50, correlationPeriod = '1y', includeCorrelation = true, } = options;
        // Fetch fund data
        const fundsCollection = this.db.collection('funds');
        const funds = await fundsCollection
            .find({ fundId: { $in: fundIds }, isActive: true })
            .project({
            fundId: 1,
            name: 1,
            fundHouse: 1,
            category: 1,
            subCategory: 1,
            currentNav: 1,
            aum: 1,
            expenseRatio: 1,
            returns: 1,
            riskMetrics: 1,
            holdings: 1,
            sectorAllocation: 1,
            _id: 0,
        })
            .toArray();
        if (funds.length < 2) {
            throw new Error('Some funds not found or inactive');
        }
        // For 2 funds, return single comparison
        if (funds.length === 2) {
            return this.compareTwoFunds(funds[0], funds[1], topNHoldings, correlationPeriod, includeCorrelation);
        }
        // For 3+ funds, return pairwise comparisons
        const pairwiseComparisons = [];
        for (let i = 0; i < funds.length; i++) {
            for (let j = i + 1; j < funds.length; j++) {
                const comparison = await this.compareTwoFunds(funds[i], funds[j], topNHoldings, correlationPeriod, includeCorrelation);
                pairwiseComparisons.push({
                    fundPair: [funds[i].fundId, funds[j].fundId],
                    ...comparison,
                });
            }
        }
        return {
            funds: funds.map((f) => ({
                fundId: f.fundId,
                name: f.name,
                fundHouse: f.fundHouse,
                category: f.category,
                subCategory: f.subCategory,
                currentNav: f.currentNav,
                aum: f.aum,
                expenseRatio: f.expenseRatio,
                returns: f.returns,
                riskMetrics: f.riskMetrics,
            })),
            pairwiseComparisons,
            totalComparisons: pairwiseComparisons.length,
        };
    }
    /**
     * Compare exactly two funds
     */
    async compareTwoFunds(fundA, fundB, topNHoldings, correlationPeriod, includeCorrelation) {
        // Calculate holdings overlap
        const holdingsOverlap = this.calculateHoldingsOverlap(fundA, fundB, topNHoldings);
        // Calculate sector overlap
        const sectorOverlap = this.calculateSectorOverlap(fundA, fundB);
        // Calculate returns correlation
        let returnsCorrelation = null;
        if (includeCorrelation) {
            returnsCorrelation = await this.calculateReturnsCorrelation(fundA.fundId, fundB.fundId, correlationPeriod);
        }
        return {
            funds: [
                {
                    fundId: fundA.fundId,
                    name: fundA.name,
                    fundHouse: fundA.fundHouse,
                    category: fundA.category,
                    subCategory: fundA.subCategory,
                    currentNav: fundA.currentNav,
                    aum: fundA.aum,
                    expenseRatio: fundA.expenseRatio,
                    returns: fundA.returns,
                    riskMetrics: fundA.riskMetrics,
                },
                {
                    fundId: fundB.fundId,
                    name: fundB.name,
                    fundHouse: fundB.fundHouse,
                    category: fundB.category,
                    subCategory: fundB.subCategory,
                    currentNav: fundB.currentNav,
                    aum: fundB.aum,
                    expenseRatio: fundB.expenseRatio,
                    returns: fundB.returns,
                    riskMetrics: fundB.riskMetrics,
                },
            ],
            holdingsOverlap,
            sectorOverlap,
            returnsCorrelation,
        };
    }
    /**
     * Calculate holdings overlap using Jaccard index and weighted overlap
     */
    calculateHoldingsOverlap(fundA, fundB, topN) {
        const holdingsA = (fundA.holdings || []).slice(0, topN);
        const holdingsB = (fundB.holdings || []).slice(0, topN);
        if (holdingsA.length === 0 || holdingsB.length === 0) {
            return null;
        }
        // Build ticker maps
        const tickersA = new Set();
        const weightsA = new Map();
        holdingsA.forEach((h) => {
            const ticker = this.normalizeTicker(h.ticker || h.name);
            tickersA.add(ticker);
            weightsA.set(ticker, {
                ticker: h.ticker || '',
                name: h.name,
                percentage: h.percentage || 0,
            });
        });
        const tickersB = new Set();
        const weightsB = new Map();
        holdingsB.forEach((h) => {
            const ticker = this.normalizeTicker(h.ticker || h.name);
            tickersB.add(ticker);
            weightsB.set(ticker, {
                ticker: h.ticker || '',
                name: h.name,
                percentage: h.percentage || 0,
            });
        });
        // Calculate intersection and union
        const intersection = new Set([...tickersA].filter((t) => tickersB.has(t)));
        const union = new Set([...tickersA, ...tickersB]);
        // Jaccard index: |Intersection| / |Union|
        const jaccard = union.size > 0 ? intersection.size / union.size : 0;
        // Weighted overlap: sum of min(weightA, weightB) for common holdings
        let weightedOverlap = 0;
        const commonHoldings = [];
        intersection.forEach((ticker) => {
            const weightA = weightsA.get(ticker);
            const weightB = weightsB.get(ticker);
            const minWeight = Math.min(weightA.percentage, weightB.percentage);
            weightedOverlap += minWeight;
            commonHoldings.push({
                ticker: weightA.ticker || weightB.ticker,
                name: weightA.name || weightB.name,
                weightA: weightA.percentage,
                weightB: weightB.percentage,
                minWeight,
            });
        });
        // Sort common holdings by minWeight descending
        commonHoldings.sort((a, b) => b.minWeight - a.minWeight);
        return {
            jaccard: Math.round(jaccard * 10000) / 10000,
            weightedOverlap: Math.round(weightedOverlap * 100) / 100,
            commonHoldings: commonHoldings.slice(0, 10), // Top 10 for output
            uniqueToFundA: tickersA.size - intersection.size,
            uniqueToFundB: tickersB.size - intersection.size,
            totalHoldingsA: holdingsA.length,
            totalHoldingsB: holdingsB.length,
        };
    }
    /**
     * Calculate sector overlap using cosine similarity
     */
    calculateSectorOverlap(fundA, fundB) {
        const sectorsA = fundA.sectorAllocation || [];
        const sectorsB = fundB.sectorAllocation || [];
        if (sectorsA.length === 0 || sectorsB.length === 0) {
            return null;
        }
        // Build sector maps
        const sectorMapA = {};
        const sectorMapB = {};
        sectorsA.forEach((s) => {
            const sector = this.normalizeSector(s.sector);
            sectorMapA[sector] = s.percentage || 0;
        });
        sectorsB.forEach((s) => {
            const sector = this.normalizeSector(s.sector);
            sectorMapB[sector] = s.percentage || 0;
        });
        // Get all unique sectors
        const allSectors = new Set([
            ...Object.keys(sectorMapA),
            ...Object.keys(sectorMapB),
        ]);
        // Calculate cosine similarity and percent overlap
        let dotProduct = 0;
        let magnitudeA = 0;
        let magnitudeB = 0;
        let percentOverlap = 0;
        const commonSectors = [];
        allSectors.forEach((sector) => {
            const weightA = sectorMapA[sector] || 0;
            const weightB = sectorMapB[sector] || 0;
            dotProduct += weightA * weightB;
            magnitudeA += weightA * weightA;
            magnitudeB += weightB * weightB;
            percentOverlap += Math.min(weightA, weightB);
            if (weightA > 0 && weightB > 0) {
                commonSectors.push({
                    sector,
                    weightA,
                    weightB,
                    difference: Math.abs(weightA - weightB),
                });
            }
        });
        const cosineSimilarity = magnitudeA > 0 && magnitudeB > 0
            ? dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB))
            : 0;
        // Sort common sectors by average weight
        commonSectors.sort((a, b) => (b.weightA + b.weightB) / 2 - (a.weightA + a.weightB) / 2);
        return {
            cosineSimilarity: Math.round(cosineSimilarity * 10000) / 10000,
            percentOverlap: Math.round(percentOverlap * 100) / 100,
            commonSectors: commonSectors.slice(0, 10), // Top 10
            sectorsA: sectorMapA,
            sectorsB: sectorMapB,
        };
    }
    /**
     * Calculate Pearson correlation on daily returns
     */
    async calculateReturnsCorrelation(fundIdA, fundIdB, period) {
        try {
            // Calculate date range based on period
            const endDate = new Date();
            const startDate = new Date();
            switch (period) {
                case '3m':
                    startDate.setMonth(endDate.getMonth() - 3);
                    break;
                case '6m':
                    startDate.setMonth(endDate.getMonth() - 6);
                    break;
                case '1y':
                    startDate.setFullYear(endDate.getFullYear() - 1);
                    break;
                case '3y':
                    startDate.setFullYear(endDate.getFullYear() - 3);
                    break;
                default:
                    startDate.setFullYear(endDate.getFullYear() - 1);
            }
            // Fetch price history
            const pricesCollection = this.db.collection('fundPrices');
            const [pricesA, pricesB] = await Promise.all([
                pricesCollection
                    .find({
                    fundId: fundIdA,
                    date: { $gte: startDate, $lte: endDate },
                })
                    .sort({ date: 1 })
                    .project({ date: 1, nav: 1, _id: 0 })
                    .toArray(),
                pricesCollection
                    .find({
                    fundId: fundIdB,
                    date: { $gte: startDate, $lte: endDate },
                })
                    .sort({ date: 1 })
                    .project({ date: 1, nav: 1, _id: 0 })
                    .toArray(),
            ]);
            // Check if we have enough data
            if (pricesA.length < 30 || pricesB.length < 30) {
                return {
                    period,
                    correlation: null,
                    dataPoints: Math.min(pricesA.length, pricesB.length),
                    startDate,
                    endDate,
                    error: 'Insufficient price history data (minimum 30 days required)',
                };
            }
            // Align dates (only keep dates that exist in both datasets)
            const datesA = new Map(pricesA.map((p) => [p.date.toISOString().split('T')[0], p.nav]));
            const datesB = new Map(pricesB.map((p) => [p.date.toISOString().split('T')[0], p.nav]));
            const commonDates = [...datesA.keys()].filter((date) => datesB.has(date));
            if (commonDates.length < 30) {
                return {
                    period,
                    correlation: null,
                    dataPoints: commonDates.length,
                    startDate,
                    endDate,
                    error: 'Insufficient overlapping price data',
                };
            }
            // Calculate daily returns
            const returnsA = [];
            const returnsB = [];
            for (let i = 1; i < commonDates.length; i++) {
                const prevDate = commonDates[i - 1];
                const currDate = commonDates[i];
                const prevNavA = datesA.get(prevDate);
                const currNavA = datesA.get(currDate);
                const returnA = (currNavA - prevNavA) / prevNavA;
                const prevNavB = datesB.get(prevDate);
                const currNavB = datesB.get(currDate);
                const returnB = (currNavB - prevNavB) / prevNavB;
                returnsA.push(returnA);
                returnsB.push(returnB);
            }
            // Calculate Pearson correlation
            const correlation = this.pearsonCorrelation(returnsA, returnsB);
            return {
                period,
                correlation: correlation !== null ? Math.round(correlation * 10000) / 10000 : null,
                dataPoints: returnsA.length,
                startDate,
                endDate,
            };
        }
        catch (error) {
            console.error('Error calculating returns correlation:', error);
            return {
                period,
                correlation: null,
                dataPoints: 0,
                startDate: null,
                endDate: null,
                error: error.message,
            };
        }
    }
    /**
     * Calculate Pearson correlation coefficient
     */
    pearsonCorrelation(x, y) {
        if (x.length !== y.length || x.length === 0) {
            return null;
        }
        const n = x.length;
        // Calculate means
        const meanX = x.reduce((sum, val) => sum + val, 0) / n;
        const meanY = y.reduce((sum, val) => sum + val, 0) / n;
        // Calculate correlation
        let numerator = 0;
        let denomX = 0;
        let denomY = 0;
        for (let i = 0; i < n; i++) {
            const diffX = x[i] - meanX;
            const diffY = y[i] - meanY;
            numerator += diffX * diffY;
            denomX += diffX * diffX;
            denomY += diffY * diffY;
        }
        const denominator = Math.sqrt(denomX * denomY);
        if (denominator === 0) {
            return null;
        }
        return numerator / denominator;
    }
    /**
     * Normalize ticker for comparison
     */
    normalizeTicker(ticker) {
        if (!ticker)
            return '';
        return ticker
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]/g, '');
    }
    /**
     * Normalize sector name for comparison
     */
    normalizeSector(sector) {
        if (!sector)
            return '';
        return sector.toLowerCase().trim();
    }
}
exports.ComparisonService = ComparisonService;
