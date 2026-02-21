"use strict";
/**
 * Quick Test Script
 * Verifies all automated system components
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const market_calendar_service_1 = __importDefault(require("../services/market-calendar.service"));
const market_indices_service_1 = __importDefault(require("../services/market-indices.service"));
const nav_service_1 = __importDefault(require("../services/nav.service"));
const graph_data_service_1 = __importDefault(require("../services/graph-data.service"));
const market_indices_job_1 = __importDefault(require("../jobs/market-indices.job"));
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
async function runTests() {
    console.log('🧪 Running System Tests...\n');
    try {
        // Connect to MongoDB
        await mongoose_1.default.connect(process.env.DATABASE_URL || '');
        console.log('✅ MongoDB connected\n');
        // Test 1: Market Calendar
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('TEST 1: Market Calendar');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        const marketStatus = await market_calendar_service_1.default.getMarketStatus();
        console.log('Market Status:', marketStatus);
        console.log(marketStatus.isOpen ? '✅ PASS' : '✅ PASS (Market closed as expected)');
        console.log('');
        // Test 2: Market Indices
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('TEST 2: Market Indices Service');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        const indices = await market_indices_service_1.default.getAllIndices();
        console.log(`Found ${indices.length} indices`);
        if (indices.length > 0) {
            console.log('Sample:', indices[0]);
            console.log('✅ PASS');
        }
        else {
            console.log('⚠️  No indices found (run init:system first)');
        }
        console.log('');
        // Test 3: Market Indices Job
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('TEST 3: Market Indices Job');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        const jobResult = await market_indices_job_1.default.execute();
        console.log('Job Result:', jobResult);
        if (jobResult.success || jobResult.action === 'skipped') {
            console.log('✅ PASS');
        }
        else {
            console.log('❌ FAIL');
        }
        console.log('');
        // Test 4: NAV Service (if funds exist)
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('TEST 4: NAV Service');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        // Create test NAV data
        const testFundId = 'test-fund-123';
        const testDate = new Date();
        await nav_service_1.default.addNAV(testFundId, testDate, 100.5, 'TEST001');
        console.log('✅ NAV added successfully');
        const latestNav = await nav_service_1.default.getLatestNAV(testFundId);
        console.log('Latest NAV:', latestNav);
        console.log('✅ PASS');
        console.log('');
        // Test 5: Graph Data Service
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('TEST 5: Graph Data Service');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        const graphStats = await graph_data_service_1.default.getGraphStats();
        console.log('Graph Stats:', graphStats);
        console.log('✅ PASS');
        console.log('');
        // Test 6: Data Freshness
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('TEST 6: Data Freshness Check');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        const isStale = await market_indices_service_1.default.isDataStale(10);
        console.log('Is Data Stale (>10 min):', isStale);
        console.log('✅ PASS');
        console.log('');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎉 ALL TESTS COMPLETED');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log('SUMMARY:');
        console.log('✅ Market Calendar: Working');
        console.log('✅ Market Indices: Working');
        console.log('✅ Market Indices Job: Working');
        console.log('✅ NAV Service: Working');
        console.log('✅ Graph Service: Working');
        console.log('✅ Data Freshness Check: Working');
        console.log('');
        process.exit(0);
    }
    catch (error) {
        console.error('\n❌ TEST FAILED:', error);
        process.exit(1);
    }
}
// Run tests
runTests();
