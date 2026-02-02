"use strict";
/**
 * Models Index
 * Central export point for all MongoDB models
 *
 * IMPORTANT: Ensure database is connected before using models!
 * Models use singleton pattern with getInstance() method.
 *
 * Usage:
 *   import { FundModel } from './models';
 *   const fundModel = FundModel.getInstance();
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoalSchema = exports.GoalModel = exports.PortfolioSchema = exports.PortfolioModel = exports.WatchlistSchema = exports.WatchlistModel = exports.UserSchema = exports.UserModel = exports.FundManagerSchema = exports.FundManagerModel = exports.FundPriceSchema = exports.FundPriceModel = exports.FundSchema = exports.FundModel = void 0;
var Fund_model_1 = require("./Fund.model");
Object.defineProperty(exports, "FundModel", { enumerable: true, get: function () { return Fund_model_1.FundModel; } });
Object.defineProperty(exports, "FundSchema", { enumerable: true, get: function () { return Fund_model_1.FundSchema; } });
var FundPrice_model_1 = require("./FundPrice.model");
Object.defineProperty(exports, "FundPriceModel", { enumerable: true, get: function () { return FundPrice_model_1.FundPriceModel; } });
Object.defineProperty(exports, "FundPriceSchema", { enumerable: true, get: function () { return FundPrice_model_1.FundPriceSchema; } });
var FundManager_model_1 = require("./FundManager.model");
Object.defineProperty(exports, "FundManagerModel", { enumerable: true, get: function () { return FundManager_model_1.FundManagerModel; } });
Object.defineProperty(exports, "FundManagerSchema", { enumerable: true, get: function () { return FundManager_model_1.FundManagerSchema; } });
var User_model_1 = require("./User.model");
Object.defineProperty(exports, "UserModel", { enumerable: true, get: function () { return User_model_1.UserModel; } });
Object.defineProperty(exports, "UserSchema", { enumerable: true, get: function () { return User_model_1.UserSchema; } });
var Watchlist_model_1 = require("./Watchlist.model");
Object.defineProperty(exports, "WatchlistModel", { enumerable: true, get: function () { return Watchlist_model_1.WatchlistModel; } });
Object.defineProperty(exports, "WatchlistSchema", { enumerable: true, get: function () { return Watchlist_model_1.WatchlistSchema; } });
var Portfolio_model_1 = require("./Portfolio.model");
Object.defineProperty(exports, "PortfolioModel", { enumerable: true, get: function () { return Portfolio_model_1.PortfolioModel; } });
Object.defineProperty(exports, "PortfolioSchema", { enumerable: true, get: function () { return Portfolio_model_1.PortfolioSchema; } });
var Goal_model_1 = require("./Goal.model");
Object.defineProperty(exports, "GoalModel", { enumerable: true, get: function () { return Goal_model_1.GoalModel; } });
Object.defineProperty(exports, "GoalSchema", { enumerable: true, get: function () { return Goal_model_1.GoalSchema; } });
// Re-export schemas from db/schemas for convenience
__exportStar(require("../db/schemas"), exports);
