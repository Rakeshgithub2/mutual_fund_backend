/**
 * Production Verification Script
 * Tests all critical endpoints and verifies performance
 */

const axios = require('axios');

// ===== CONFIGURATION =====
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3002';
const PERFORMANCE_THRESHOLDS = {
  fundList: 3000, // 3 seconds
  fundDetails: 2000, // 2 seconds
  marketIndices: 1000, // 1 second
  search: 500, // 500ms
  holdings: 2000, // 2 seconds
};

// ===== TEST UTILITIES =====
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function log(emoji, message, ...args) {
  console.log(`${emoji} ${message}`, ...args);
}

function logSuccess(message) {
  log('✅', message);
  passedTests++;
}

function logError(message, error) {
  log('❌', message);
  if (error) console.error('   Error:', error.message);
  failedTests++;
}

function logWarning(message) {
  log('⚠️ ', message);
}

async function testEndpoint(name, url, maxTime, checks = {}) {
  totalTests++;
  const startTime = Date.now();

  try {
    const response = await axios.get(url, { timeout: maxTime + 1000 });
    const duration = Date.now() - startTime;

    // Performance check
    if (duration > maxTime) {
      logWarning(
        `${name} - Slow response: ${duration}ms (target: ${maxTime}ms)`
      );
      failedTests++;
      return { success: false, duration, data: response.data };
    }

    // Custom checks
    let checksPass = true;
    if (checks.hasData) {
      const hasData = Array.isArray(response.data.data)
        ? response.data.data.length > 0
        : !!response.data.data;

      if (!hasData) {
        logError(`${name} - No data returned`);
        checksPass = false;
      }
    }

    if (checks.minCount && Array.isArray(response.data.data)) {
      if (response.data.data.length < checks.minCount) {
        logError(
          `${name} - Insufficient data: ${response.data.data.length} (expected: ${checks.minCount}+)`
        );
        checksPass = false;
      }
    }

    if (checksPass) {
      logSuccess(`${name} - ${duration}ms ✓`);
    }

    return { success: checksPass, duration, data: response.data };
  } catch (error) {
    const duration = Date.now() - startTime;
    logError(`${name} - Failed after ${duration}ms`, error);
    return { success: false, duration, error };
  }
}

// ===== TESTS =====

async function testHealth() {
  log('🏥', 'Testing health endpoint...');
  const result = await testEndpoint(
    'Health Check',
    `${BACKEND_URL}/health`,
    1000
  );

  if (result.success && result.data) {
    log('   ', `Status: ${result.data.status}`);
    log('   ', `Environment: ${result.data.environment}`);
  }

  return result.success;
}

async function testFundList() {
  log('📊', 'Testing fund list endpoint...');
  const result = await testEndpoint(
    'Fund List',
    `${BACKEND_URL}/api/funds?fundType=equity&limit=10`,
    PERFORMANCE_THRESHOLDS.fundList,
    { hasData: true, minCount: 1 }
  );

  if (result.success && result.data?.dataSource) {
    log('   ', `Data Source: ${result.data.dataSource.source}`);
    log('   ', `Total: ${result.data.total || result.data.data?.length || 0}`);
  }

  return result.success;
}

async function testFundDetails() {
  log('🔍', 'Testing fund details endpoint...');
  const result = await testEndpoint(
    'Fund Details',
    `${BACKEND_URL}/api/funds/120503`,
    PERFORMANCE_THRESHOLDS.fundDetails,
    { hasData: true }
  );

  if (result.success && result.data?.dataSource) {
    log('   ', `Data Source: ${result.data.dataSource.source}`);
    log('   ', `Fund: ${result.data.data?.fundName || 'Unknown'}`);
  }

  return result.success;
}

async function testMarketIndices() {
  log('📈', 'Testing market indices endpoint...');
  const result = await testEndpoint(
    'Market Indices',
    `${BACKEND_URL}/api/market-indices`,
    PERFORMANCE_THRESHOLDS.marketIndices,
    { hasData: true, minCount: 5 }
  );

  if (result.success && result.data) {
    const metadata = result.data.metadata;
    if (metadata) {
      log('   ', `Count: ${metadata.count}`);
      log('   ', `Fresh: ${metadata.fresh}, Cached: ${metadata.cached}`);
      log('   ', `Market Open: ${metadata.marketOpen}`);
    } else {
      log('   ', `Count: ${result.data.data?.length || 0}`);
    }
  }

  return result.success;
}

async function testSearch() {
  log('🔎', 'Testing search endpoint...');
  const result = await testEndpoint(
    'Search',
    `${BACKEND_URL}/api/search?q=hdfc`,
    PERFORMANCE_THRESHOLDS.search,
    { hasData: true }
  );

  if (result.success && result.data) {
    log(
      '   ',
      `Results: ${result.data.data?.length || result.data.length || 0}`
    );
  }

  return result.success;
}

async function testHoldings() {
  log('🏢', 'Testing holdings endpoint...');
  const result = await testEndpoint(
    'Holdings',
    `${BACKEND_URL}/api/holdings/120503`,
    PERFORMANCE_THRESHOLDS.holdings,
    { hasData: true }
  );

  if (result.success && result.data) {
    const holdings = result.data.holdings || result.data.data?.holdings;
    if (holdings) {
      log('   ', `Holdings: ${holdings.length}`);
    }
  }

  return result.success;
}

async function testDebtFunds() {
  log('💰', 'Testing debt funds endpoint...');
  const result = await testEndpoint(
    'Debt Funds',
    `${BACKEND_URL}/api/funds?fundType=debt&limit=10`,
    PERFORMANCE_THRESHOLDS.fundList,
    { hasData: true, minCount: 1 }
  );

  if (result.success && result.data) {
    log('   ', `Count: ${result.data.total || result.data.data?.length || 0}`);
  }

  return result.success;
}

async function testCommodityFunds() {
  log('🥇', 'Testing commodity funds endpoint...');
  const result = await testEndpoint(
    'Commodity Funds',
    `${BACKEND_URL}/api/funds?category=commodity&limit=10`,
    PERFORMANCE_THRESHOLDS.fundList,
    { hasData: true }
  );

  if (result.success && result.data) {
    log('   ', `Count: ${result.data.total || result.data.data?.length || 0}`);
  }

  return result.success;
}

// ===== MAIN =====

async function runTests() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('🚀 PRODUCTION VERIFICATION');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Backend URL: ${BACKEND_URL}\n`);

  const tests = [
    testHealth,
    testFundList,
    testFundDetails,
    testMarketIndices,
    testSearch,
    testHoldings,
    testDebtFunds,
    testCommodityFunds,
  ];

  for (const test of tests) {
    await test();
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════');
  console.log('📊 RESULTS');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Total Tests:  ${totalTests}`);
  console.log(`Passed:       ${passedTests} ✅`);
  console.log(`Failed:       ${failedTests} ❌`);
  console.log(`Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`);
  console.log('═══════════════════════════════════════════════════════\n');

  if (failedTests > 0) {
    console.log('❌ Some tests failed. Please check the logs above.');
    process.exit(1);
  } else {
    console.log('✅ All tests passed! Production is ready.');
    process.exit(0);
  }
}

// Run tests
runTests().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
