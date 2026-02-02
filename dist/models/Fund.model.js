"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.FundModel = exports.FundSchema = void 0;
var mongodb_1 = require("../db/mongodb");
var zod_1 = require("zod");
/**
 * Zod validation schema for Fund
 */
exports.FundSchema = zod_1.z.object({
    fundId: zod_1.z.string().min(1, 'Fund ID is required'),
    name: zod_1.z.string().min(1, 'Fund name is required'),
    category: zod_1.z.enum(['equity', 'debt', 'hybrid', 'commodity', 'etf', 'index']),
    subCategory: zod_1.z.string(),
    fundType: zod_1.z.enum(['mutual_fund', 'etf']),
    // Basic Info
    fundHouse: zod_1.z.string().min(1, 'Fund house is required'),
    launchDate: zod_1.z.date(),
    aum: zod_1.z.number().min(0),
    expenseRatio: zod_1.z.number().min(0).max(5),
    exitLoad: zod_1.z.number().min(0).max(100),
    minInvestment: zod_1.z.number().min(0),
    sipMinAmount: zod_1.z.number().min(0),
    // Manager Info
    fundManagerId: zod_1.z.string().optional(),
    fundManager: zod_1.z.string(),
    // Performance
    returns: zod_1.z.object({
        day: zod_1.z.number(),
        week: zod_1.z.number(),
        month: zod_1.z.number(),
        threeMonth: zod_1.z.number(),
        sixMonth: zod_1.z.number(),
        oneYear: zod_1.z.number(),
        threeYear: zod_1.z.number(),
        fiveYear: zod_1.z.number(),
        sinceInception: zod_1.z.number(),
    }),
    // Risk Metrics
    riskMetrics: zod_1.z.object({
        sharpeRatio: zod_1.z.number(),
        standardDeviation: zod_1.z.number(),
        beta: zod_1.z.number(),
        alpha: zod_1.z.number(),
        rSquared: zod_1.z.number(),
        sortino: zod_1.z.number(),
    }),
    // Holdings
    holdings: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string(),
        ticker: zod_1.z.string().optional(),
        percentage: zod_1.z.number(),
        sector: zod_1.z.string(),
        quantity: zod_1.z.number().optional(),
        value: zod_1.z.number().optional(),
    })),
    // Sector Allocation
    sectorAllocation: zod_1.z.array(zod_1.z.object({
        sector: zod_1.z.string(),
        percentage: zod_1.z.number(),
    })),
    // Current Price
    currentNav: zod_1.z.number().positive(),
    previousNav: zod_1.z.number().positive(),
    navDate: zod_1.z.date(),
    // Ratings
    ratings: zod_1.z.object({
        morningstar: zod_1.z.number().min(1).max(5).optional(),
        crisil: zod_1.z.number().min(1).max(5).optional(),
        valueResearch: zod_1.z.number().min(1).max(5).optional(),
    }),
    // Search & Discovery
    tags: zod_1.z.array(zod_1.z.string()),
    searchTerms: zod_1.z.array(zod_1.z.string()),
    popularity: zod_1.z.number().min(0).default(0),
    // Metadata
    isActive: zod_1.z.boolean().default(true),
    dataSource: zod_1.z.string(),
    lastUpdated: zod_1.z.date(),
    createdAt: zod_1.z.date(),
});
/**
 * Fund Model Class
 * Provides type-safe methods for interacting with the funds collection
 */
var FundModel = /** @class */ (function () {
    function FundModel() {
        this.collection = mongodb_1.mongodb.getCollection('funds');
    }
    /**
     * Get singleton instance
     */
    FundModel.getInstance = function () {
        if (!FundModel.instance) {
            FundModel.instance = new FundModel();
        }
        return FundModel.instance;
    };
    /**
     * Create a new fund
     */
    FundModel.prototype.create = function (fundData) {
        return __awaiter(this, void 0, void 0, function () {
            var now, fund, result;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        now = new Date();
                        fund = __assign(__assign({}, fundData), { createdAt: fundData.createdAt || now, lastUpdated: fundData.lastUpdated || now, isActive: (_a = fundData.isActive) !== null && _a !== void 0 ? _a : true, popularity: fundData.popularity || 0 });
                        return [4 /*yield*/, this.collection.insertOne(fund)];
                    case 1:
                        result = _b.sent();
                        return [2 /*return*/, __assign(__assign({}, fund), { _id: result.insertedId.toString() })];
                }
            });
        });
    };
    /**
     * Find fund by ID
     */
    FundModel.prototype.findById = function (fundId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.collection.findOne({ fundId: fundId })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Find fund by MongoDB _id
     */
    FundModel.prototype.findByMongoId = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.collection.findOne({ _id: id })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Update fund
     */
    FundModel.prototype.update = function (fundId, updateData) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.collection.findOneAndUpdate({ fundId: fundId }, {
                            $set: __assign(__assign({}, updateData), { lastUpdated: new Date() }),
                        }, { returnDocument: 'after' })];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result || null];
                }
            });
        });
    };
    /**
     * Update NAV and price data
     */
    FundModel.prototype.updateNav = function (fundId, nav, navDate) {
        return __awaiter(this, void 0, void 0, function () {
            var fund;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.findById(fundId)];
                    case 1:
                        fund = _a.sent();
                        if (!fund)
                            return [2 /*return*/, null];
                        return [4 /*yield*/, this.update(fundId, {
                                previousNav: fund.currentNav,
                                currentNav: nav,
                                navDate: navDate,
                            })];
                    case 2: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Delete fund (soft delete)
     */
    FundModel.prototype.delete = function (fundId) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.collection.updateOne({ fundId: fundId }, { $set: { isActive: false, lastUpdated: new Date() } })];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result.modifiedCount > 0];
                }
            });
        });
    };
    /**
     * Hard delete fund
     */
    FundModel.prototype.hardDelete = function (fundId) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.collection.deleteOne({ fundId: fundId })];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result.deletedCount > 0];
                }
            });
        });
    };
    /**
     * Search funds by name or tags
     */
    FundModel.prototype.search = function (query_1) {
        return __awaiter(this, arguments, void 0, function (query, options) {
            var filter;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        filter = {
                            $text: { $search: query },
                            isActive: true,
                        };
                        if (options.category) {
                            filter.category = options.category;
                        }
                        if (options.fundType) {
                            filter.fundType = options.fundType;
                        }
                        return [4 /*yield*/, this.collection
                                .find(filter)
                                .limit(options.limit || 20)
                                .skip(options.skip || 0)
                                .sort({ score: { $meta: 'textScore' }, popularity: -1 })
                                .toArray()];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Get funds by category
     */
    FundModel.prototype.findByCategory = function (category_1) {
        return __awaiter(this, arguments, void 0, function (category, options) {
            var query, sort;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        query = { category: category, isActive: true };
                        sort = {};
                        if (options.sortBy === 'returns') {
                            sort['returns.oneYear'] = -1;
                        }
                        else if (options.sortBy === 'aum') {
                            sort.aum = -1;
                        }
                        else {
                            sort.popularity = -1;
                        }
                        return [4 /*yield*/, this.collection
                                .find(query)
                                .sort(sort)
                                .limit(options.limit || 20)
                                .skip(options.skip || 0)
                                .toArray()];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Get top performing funds
     */
    FundModel.prototype.getTopPerformers = function () {
        return __awaiter(this, arguments, void 0, function (period, limit) {
            var sortField;
            var _a;
            if (period === void 0) { period = 'oneYear'; }
            if (limit === void 0) { limit = 10; }
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        sortField = "returns.".concat(period);
                        return [4 /*yield*/, this.collection
                                .find({ isActive: true })
                                .sort((_a = {}, _a[sortField] = -1, _a))
                                .limit(limit)
                                .toArray()];
                    case 1: return [2 /*return*/, _b.sent()];
                }
            });
        });
    };
    /**
     * Get funds by fund house
     */
    FundModel.prototype.findByFundHouse = function (fundHouse) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.collection
                            .find({ fundHouse: fundHouse, isActive: true })
                            .sort({ aum: -1 })
                            .toArray()];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Get funds by manager
     */
    FundModel.prototype.findByManager = function (fundManagerId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.collection
                            .find({ fundManagerId: fundManagerId, isActive: true })
                            .sort({ aum: -1 })
                            .toArray()];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Bulk update funds
     */
    FundModel.prototype.bulkUpdate = function (updates) {
        return __awaiter(this, void 0, void 0, function () {
            var bulkOps;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        bulkOps = updates.map(function (update) { return ({
                            updateOne: {
                                filter: { fundId: update.fundId },
                                update: { $set: __assign(__assign({}, update.data), { lastUpdated: new Date() }) },
                                upsert: false,
                            },
                        }); });
                        return [4 /*yield*/, this.collection.bulkWrite(bulkOps)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Get funds count by category
     */
    FundModel.prototype.countByCategory = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.collection
                            .aggregate([
                            { $match: { isActive: true } },
                            { $group: { _id: '$category', count: { $sum: 1 } } },
                            { $project: { category: '$_id', count: 1, _id: 0 } },
                        ])
                            .toArray()];
                    case 1: return [2 /*return*/, (_a.sent())];
                }
            });
        });
    };
    /**
     * Get all active funds
     */
    FundModel.prototype.findAll = function () {
        return __awaiter(this, arguments, void 0, function (options) {
            var query, sort;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        query = { isActive: true };
                        sort = {};
                        if (options.sortBy === 'name') {
                            sort.name = 1;
                        }
                        else if (options.sortBy === 'aum') {
                            sort.aum = -1;
                        }
                        else {
                            sort.popularity = -1;
                        }
                        return [4 /*yield*/, this.collection
                                .find(query)
                                .sort(sort)
                                .limit(options.limit || 100)
                                .skip(options.skip || 0)
                                .toArray()];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Increment popularity
     */
    FundModel.prototype.incrementPopularity = function (fundId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.collection.updateOne({ fundId: fundId }, { $inc: { popularity: 1 } })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    return FundModel;
}());
exports.FundModel = FundModel;
