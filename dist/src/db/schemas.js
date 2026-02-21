"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.indexes = void 0;
exports.createIndexes = createIndexes;
exports.getCollections = getCollections;
// ==================== INDEX DEFINITIONS ====================
exports.indexes = {
    funds: [
        { key: { fundId: 1 }, unique: true },
        { key: { amfiCode: 1 }, unique: true, sparse: true },
        { key: { name: 'text', searchTerms: 'text', tags: 'text' } }, // Full-text search
        { key: { category: 1, subCategory: 1 } },
        { key: { fundHouse: 1 } },
        { key: { fundManagerId: 1 } },
        { key: { schemeType: 1, planType: 1 } }, // Direct/Regular, Growth/IDCW
        { key: { riskOMeter: 1 } },
        { key: { 'returns.oneYear': -1 } },
        { key: { 'returns.threeYear': -1 } },
        { key: { aum: -1 } },
        { key: { aumDate: -1 } }, // Track AUM freshness
        { key: { popularity: -1 } },
        { key: { isActive: 1, isPubliclyVisible: 1 } }, // Zero-NA policy
        { key: { 'dataCompleteness.completenessScore': -1 } },
        { key: { lastUpdated: -1 } },
        { key: { navDate: -1 } },
        // Compound indexes for common queries
        { key: { category: 1, 'returns.oneYear': -1 } },
        { key: { isActive: 1, isPubliclyVisible: 1, category: 1, aum: -1 } },
        { key: { category: 1, subCategory: 1, schemeType: 1 } },
    ],
    fundPrices: [
        { key: { fundId: 1, date: -1 }, unique: true },
        { key: { fundId: 1, date: 1 } }, // For historical queries
        { key: { date: -1 } },
    ],
    fundManagers: [
        { key: { managerId: 1 }, unique: true },
        { key: { name: 'text', bio: 'text' } },
        { key: { currentFundHouse: 1 } },
        { key: { experience: -1 } },
        { key: { totalAumManaged: -1 } },
        { key: { isActive: 1 } },
    ],
    users: [
        { key: { userId: 1 }, unique: true },
        { key: { googleId: 1 }, unique: true, sparse: true },
        { key: { email: 1 }, unique: true },
        { key: { authMethod: 1 } },
        { key: { createdAt: -1 } },
        { key: { isActive: 1 } },
    ],
    watchlists: [
        { key: { userId: 1, fundId: 1 }, unique: true },
        { key: { userId: 1, addedAt: -1 } },
        { key: { fundId: 1 } },
    ],
    portfolios: [
        { key: { userId: 1, portfolioId: 1 }, unique: true },
        { key: { userId: 1, isActive: 1 } },
        { key: { 'holdings.fundId': 1 } },
    ],
    comparisonHistory: [
        { key: { userId: 1, createdAt: -1 } },
        { key: { fundIds: 1 } },
        { key: { createdAt: -1 }, expireAfterSeconds: 2592000 }, // 30 days TTL
    ],
    cacheEntries: [
        { key: { key: 1 }, unique: true },
        { key: { expiresAt: 1 }, expireAfterSeconds: 0 }, // TTL index
    ],
    rateLimits: [
        { key: { identifier: 1, endpoint: 1, windowStart: 1 } },
        { key: { windowEnd: 1 }, expireAfterSeconds: 0 }, // TTL index
    ],
    apiCallLogs: [
        { key: { service: 1, timestamp: -1 } },
        { key: { timestamp: -1 } },
        { key: { timestamp: -1 }, expireAfterSeconds: 2592000 }, // 30 days TTL
    ],
    goals: [
        { key: { userId: 1, goalId: 1 }, unique: true },
        { key: { userId: 1, status: 1 } },
        { key: { userId: 1, createdAt: -1 } },
    ],
    marketIndices: [
        { key: { indexId: 1 }, unique: true },
        { key: { symbol: 1 } },
        { key: { lastUpdated: -1 } },
        { key: { marketStatus: 1, lastUpdated: -1 } },
        { key: { tradingDay: -1 } },
        { key: { sanityCheckPassed: 1, staleness: 1 } }, // Data quality
    ],
    news: [
        { key: { newsId: 1 }, unique: true },
        { key: { publishedAt: -1 } },
        { key: { category: 1, publishedAt: -1 } },
        { key: { source: 1, publishedAt: -1 } },
        { key: { sourceVerified: 1, isPromotional: -1, publishedAt: -1 } }, // Verified, non-promotional
        { key: { tags: 1 } },
        { key: { relatedFunds: 1 } },
        { key: { relatedAMCs: 1 } },
        { key: { title: 'text', summary: 'text', content: 'text' } }, // Full-text search
    ],
};
// ==================== COLLECTION HELPERS ====================
async function createIndexes(db) {
    console.log('Creating MongoDB indexes...');
    const collections = Object.keys(exports.indexes);
    for (const collectionName of collections) {
        const collection = db.collection(collectionName);
        const indexSpecs = exports.indexes[collectionName];
        try {
            for (const indexSpec of indexSpecs) {
                await collection.createIndex(indexSpec.key, {
                    unique: indexSpec.unique,
                    expireAfterSeconds: indexSpec.expireAfterSeconds,
                });
            }
            console.log(`✓ Indexes created for ${collectionName}`);
        }
        catch (error) {
            console.error(`✗ Error creating indexes for ${collectionName}:`, error);
        }
    }
    console.log('All indexes created successfully!');
}
function getCollections(db) {
    return {
        funds: db.collection('funds'),
        fundPrices: db.collection('fundPrices'),
        fundManagers: db.collection('fundManagers'),
        users: db.collection('users'),
        watchlists: db.collection('watchlists'),
        portfolios: db.collection('portfolios'),
        comparisonHistory: db.collection('comparisonHistory'),
        cacheEntries: db.collection('cacheEntries'),
        rateLimits: db.collection('rateLimits'),
        apiCallLogs: db.collection('apiCallLogs'),
        goals: db.collection('goals'),
        marketIndices: db.collection('marketIndices'),
        news: db.collection('news'),
    };
}
