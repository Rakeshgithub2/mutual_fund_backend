#!/usr/bin/env tsx
"use strict";
/**
 * Fund Import Script
 * Run this script to import funds, managers, and price history
 *
 * Usage:
 *   npm run import:funds
 *   npm run import:funds -- --etfs=30 --mutual-funds=70
 *   npm run import:prices
 *   npm run import:update-navs
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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const mongodb_1 = require("../db/mongodb");
async function main() {
    try {
        // Connect to database FIRST, before importing models
        console.log('🔌 Connecting to MongoDB...');
        await mongodb_1.mongodb.connect();
        console.log('✅ Connected to MongoDB\n');
        // NOW import the orchestrator (which will import models)
        const { fundIngestionOrchestrator } = await Promise.resolve().then(() => __importStar(require('../services/importers/orchestrator')));
        // Parse command line arguments
        const args = process.argv.slice(2);
        const command = args[0] || 'all';
        switch (command) {
            case 'all':
            case 'funds': {
                // Import all funds
                const etfLimit = parseInt(args.find((a) => a.startsWith('--etfs='))?.split('=')[1] || '50');
                const mfLimit = parseInt(args.find((a) => a.startsWith('--mutual-funds='))?.split('=')[1] ||
                    '100');
                await fundIngestionOrchestrator.importAllFunds({
                    etfLimit,
                    mutualFundLimit: mfLimit,
                    skipExisting: true,
                });
                break;
            }
            case 'prices':
            case 'history': {
                // Import historical prices
                const fundIds = args.slice(1);
                if (fundIds.length === 0) {
                    console.error('❌ Please provide fund IDs to import prices for');
                    console.log('Example: npm run import:funds prices SPY QQQ NIFTYBEES.NS');
                    process.exit(1);
                }
                await fundIngestionOrchestrator.importHistoricalPrices(fundIds, '1y');
                break;
            }
            case 'update-navs':
            case 'navs': {
                // Update latest NAVs
                await fundIngestionOrchestrator.updateLatestNAVs();
                break;
            }
            default:
                console.error(`❌ Unknown command: ${command}`);
                console.log('\nAvailable commands:');
                console.log('  all, funds     - Import all funds and managers');
                console.log('  prices, history - Import historical prices');
                console.log('  update-navs, navs - Update latest NAVs');
                process.exit(1);
        }
        console.log('\n🎉 All done!');
        process.exit(0);
    }
    catch (error) {
        console.error('\n❌ Fatal error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}
// Run the script
main();
