"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.indexes = void 0;
exports.createIndexes = createIndexes;
exports.getCollections = getCollections;
// ==================== INDEX DEFINITIONS ====================
exports.indexes = {
    funds: [
        { key: { fundId: 1 }, unique: true },
        { key: { name: 'text', searchTerms: 'text', tags: 'text' } }, // Full-text search
        { key: { category: 1, subCategory: 1 } },
        { key: { fundHouse: 1 } },
        { key: { fundManagerId: 1 } },
        { key: { 'returns.oneYear': -1 } },
        { key: { 'returns.threeYear': -1 } },
        { key: { aum: -1 } },
        { key: { popularity: -1 } },
        { key: { isActive: 1, lastUpdated: -1 } },
        { key: { navDate: -1 } },
        { key: { amfiCode: 1 }, sparse: true }, // Allow null values
        // Compound indexes for common queries
        { key: { category: 1, 'returns.oneYear': -1 } },
        { key: { isActive: 1, category: 1, aum: -1 } },
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
};
// ==================== COLLECTION HELPERS ====================
function createIndexes(db) {
    return __awaiter(this, void 0, void 0, function () {
        var collections, _i, collections_1, collectionName, collection, indexSpecs, _a, indexSpecs_1, indexSpec, error_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log('Creating MongoDB indexes...');
                    collections = Object.keys(exports.indexes);
                    _i = 0, collections_1 = collections;
                    _b.label = 1;
                case 1:
                    if (!(_i < collections_1.length)) return [3 /*break*/, 9];
                    collectionName = collections_1[_i];
                    collection = db.collection(collectionName);
                    indexSpecs = exports.indexes[collectionName];
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 7, , 8]);
                    _a = 0, indexSpecs_1 = indexSpecs;
                    _b.label = 3;
                case 3:
                    if (!(_a < indexSpecs_1.length)) return [3 /*break*/, 6];
                    indexSpec = indexSpecs_1[_a];
                    return [4 /*yield*/, collection.createIndex(indexSpec.key, {
                            unique: indexSpec.unique,
                            expireAfterSeconds: indexSpec.expireAfterSeconds,
                        })];
                case 4:
                    _b.sent();
                    _b.label = 5;
                case 5:
                    _a++;
                    return [3 /*break*/, 3];
                case 6:
                    console.log("\u2713 Indexes created for ".concat(collectionName));
                    return [3 /*break*/, 8];
                case 7:
                    error_1 = _b.sent();
                    console.error("\u2717 Error creating indexes for ".concat(collectionName, ":"), error_1);
                    return [3 /*break*/, 8];
                case 8:
                    _i++;
                    return [3 /*break*/, 1];
                case 9:
                    console.log('All indexes created successfully!');
                    return [2 /*return*/];
            }
        });
    });
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
    };
}
