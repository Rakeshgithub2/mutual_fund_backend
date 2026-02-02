#!/usr/bin/env tsx
"use strict";
/**
 * Real-World Fund Data Import Script
 * Fetches 100+ equity funds and 50+ commodity funds from real APIs
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
        console.log('🔌 Connecting to MongoDB...');
        await mongodb_1.mongodb.connect();
        console.log('✅ Connected to MongoDB\n');
        // Import the orchestrator
        const { fundIngestionOrchestrator } = await Promise.resolve().then(() => __importStar(require('../services/importers/orchestrator')));
        // Parse command line arguments
        const args = process.argv.slice(2);
        const equityCount = parseInt(args.find((a) => a.startsWith('--equity='))?.split('=')[1] || '100');
        const commodityCount = parseInt(args.find((a) => a.startsWith('--commodity='))?.split('=')[1] || '50');
        console.log('🎯 Import Configuration:');
        console.log(`   • Equity Funds Target: ${equityCount}`);
        console.log(`   • Commodity Funds Target: ${commodityCount}`);
        console.log('');
        // Start the enhanced import
        const stats = await fundIngestionOrchestrator.importRealWorldFunds({
            equityCount,
            commodityCount,
            skipExisting: true,
        });
        console.log('\n🎉 Real-world data import completed successfully!');
        console.log('\n📊 Final Statistics:');
        console.log(`   • Total Funds Imported: ${stats.totalImported}`);
        console.log(`   • Equity Funds: ${stats.equity}`);
        console.log(`     - Large Cap: ~${Math.floor(stats.equity * 0.3)}`);
        console.log(`     - Mid Cap: ~${Math.floor(stats.equity * 0.25)}`);
        console.log(`     - Small Cap: ~${Math.floor(stats.equity * 0.2)}`);
        console.log(`     - Multi Cap: ~${Math.floor(stats.equity * 0.25)}`);
        console.log(`   • Commodity Funds: ${stats.commodity}`);
        console.log(`     - Gold/Silver/Commodity Mix`);
        console.log(`   • Fund Managers: ${stats.managers}`);
        process.exit(0);
    }
    catch (error) {
        console.error('\n❌ Import failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}
// Run the script
main();
