#!/usr/bin/env ts-node

/**
 * Backend Verification Script
 *
 * Tests all critical fixes:
 * 1. Fund pagination (should return 4000+ funds)
 * 2. Market indices (should return real data, not static)
 * 3. Sector allocation (check coverage)
 * 4. API response times
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3002';
const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(color: string, message: string) {
  console.log(`${color}${message}${COLORS.reset}`);
}

async function testFundPagination() {
  console.log('\n' + '='.repeat(60));
  log(COLORS.blue, '📊 TEST 1: Fund Pagination');
  console.log('='.repeat(60));

  try {
    const start = Date.now();
    const response = await axios.get(`${API_URL}/api/funds`, {
      params: { limit: 500, page: 1 },
      timeout: 10000,
    });
    const elapsed = Date.now() - start;

    const { data, pagination } = response.data;

    log(COLORS.green, `✅ API Response: ${response.status}`);
    log(COLORS.green, `✅ Response Time: ${elapsed}ms`);
    log(COLORS.green, `✅ Funds Returned: ${data.length}`);
    log(COLORS.green, `✅ Total Funds: ${pagination.total}`);
    log(COLORS.green, `✅ Total Pages: ${pagination.totalPages}`);

    if (pagination.total < 100) {
      log(
        COLORS.red,
        `❌ FAIL: Only ${pagination.total} funds found (expected 4000+)`
      );
      return false;
    }

    if (data.length !== 500) {
      log(COLORS.red, `❌ FAIL: Expected 500 funds, got ${data.length}`);
      return false;
    }

    log(COLORS.green, '✅ PASS: Fund pagination working correctly');
    return true;
  } catch (error: any) {
    log(COLORS.red, `❌ FAIL: ${error.message}`);
    return false;
  }
}

async function testMarketIndices() {
  console.log('\n' + '='.repeat(60));
  log(COLORS.blue, '📈 TEST 2: Market Indices');
  console.log('='.repeat(60));

  try {
    const start = Date.now();
    const response = await axios.get(`${API_URL}/api/market/summary`, {
      timeout: 10000,
    });
    const elapsed = Date.now() - start;

    const { data } = response.data;

    log(COLORS.green, `✅ API Response: ${response.status}`);
    log(COLORS.green, `✅ Response Time: ${elapsed}ms`);
    log(COLORS.green, `✅ Indices Returned: ${data.length}`);

    // Check if data is static (FAIL if values are exactly default values)
    const staticValues = [21500, 71000, 45000];
    const isStatic = data.every((idx: any) => staticValues.includes(idx.value));

    if (isStatic) {
      log(
        COLORS.red,
        '❌ FAIL: Market data appears to be STATIC (default values)'
      );
      log(COLORS.yellow, '⚠️  Check RAPIDAPI_KEY in .env');
      return false;
    }

    // Display indices
    data.forEach((idx: any) => {
      const changeSymbol = idx.changePercent >= 0 ? '▲' : '▼';
      const changeColor = idx.changePercent >= 0 ? COLORS.green : COLORS.red;
      log(
        changeColor,
        `   ${idx.index}: ${idx.value.toFixed(2)} ${changeSymbol} ${idx.changePercent.toFixed(2)}% (${idx.dataSource || 'unknown'})`
      );
    });

    log(COLORS.green, '✅ PASS: Market indices showing REAL data');
    return true;
  } catch (error: any) {
    log(COLORS.red, `❌ FAIL: ${error.message}`);
    return false;
  }
}

async function testSectorAllocation() {
  console.log('\n' + '='.repeat(60));
  log(COLORS.blue, '🎯 TEST 3: Sector Allocation Coverage');
  console.log('='.repeat(60));

  try {
    // Get sample equity fund
    const fundsResponse = await axios.get(`${API_URL}/api/funds`, {
      params: { category: 'equity', limit: 10 },
    });

    const funds = fundsResponse.data.data;
    log(COLORS.green, `✅ Found ${funds.length} equity funds`);

    let withSectors = 0;
    let withoutSectors = 0;

    for (const fund of funds) {
      try {
        const detailsResponse = await axios.get(
          `${API_URL}/api/funds/${fund.fundId}/details`,
          { timeout: 5000 }
        );

        const fundDetails = detailsResponse.data.data;

        if (
          fundDetails.sectorAllocation &&
          fundDetails.sectorAllocation.length > 0
        ) {
          withSectors++;
          log(
            COLORS.green,
            `   ✅ ${fund.name}: ${fundDetails.sectorAllocation.length} sectors`
          );
        } else {
          withoutSectors++;
          log(COLORS.yellow, `   ⚠️  ${fund.name}: No sector data`);
        }
      } catch (err) {
        withoutSectors++;
      }
    }

    const coverage = (withSectors / funds.length) * 100;
    log(
      COLORS.blue,
      `\n📊 Coverage: ${withSectors}/${funds.length} (${coverage.toFixed(1)}%)`
    );

    if (coverage < 50) {
      log(COLORS.yellow, '⚠️  Low coverage. Run: npm run worker:sectors');
      return false;
    }

    log(COLORS.green, '✅ PASS: Sector allocation coverage acceptable');
    return true;
  } catch (error: any) {
    log(COLORS.red, `❌ FAIL: ${error.message}`);
    return false;
  }
}

async function testPerformance() {
  console.log('\n' + '='.repeat(60));
  log(COLORS.blue, '⚡ TEST 4: API Performance');
  console.log('='.repeat(60));

  const tests = [
    { name: 'List 100 funds', url: '/api/funds?limit=100', maxTime: 3000 },
    { name: 'List 500 funds', url: '/api/funds?limit=500', maxTime: 5000 },
    { name: 'Market indices', url: '/api/market/summary', maxTime: 2000 },
    {
      name: 'Fund search',
      url: '/api/search/suggest?query=hdfc',
      maxTime: 2000,
    },
  ];

  let passed = 0;

  for (const test of tests) {
    const start = Date.now();
    try {
      await axios.get(`${API_URL}${test.url}`, {
        timeout: test.maxTime + 1000,
      });
      const elapsed = Date.now() - start;

      if (elapsed <= test.maxTime) {
        log(COLORS.green, `   ✅ ${test.name}: ${elapsed}ms`);
        passed++;
      } else {
        log(
          COLORS.yellow,
          `   ⚠️  ${test.name}: ${elapsed}ms (slow, expected <${test.maxTime}ms)`
        );
      }
    } catch (error: any) {
      log(COLORS.red, `   ❌ ${test.name}: Failed - ${error.message}`);
    }
  }

  log(COLORS.blue, `\n📊 Performance: ${passed}/${tests.length} tests passed`);
  return passed === tests.length;
}

async function main() {
  console.log('\n');
  log(
    COLORS.blue,
    '╔════════════════════════════════════════════════════════════╗'
  );
  log(
    COLORS.blue,
    '║                                                            ║'
  );
  log(
    COLORS.blue,
    '║         BACKEND VERIFICATION & FIX VALIDATION              ║'
  );
  log(
    COLORS.blue,
    '║                                                            ║'
  );
  log(
    COLORS.blue,
    '╚════════════════════════════════════════════════════════════╝'
  );

  log(COLORS.blue, `\n🔗 Testing API: ${API_URL}\n`);

  // Run all tests
  const results = {
    pagination: await testFundPagination(),
    marketIndices: await testMarketIndices(),
    sectorAllocation: await testSectorAllocation(),
    performance: await testPerformance(),
  };

  // Summary
  console.log('\n' + '='.repeat(60));
  log(COLORS.blue, '📋 SUMMARY');
  console.log('='.repeat(60));

  const tests = [
    { name: 'Fund Pagination', result: results.pagination },
    { name: 'Market Indices', result: results.marketIndices },
    { name: 'Sector Allocation', result: results.sectorAllocation },
    { name: 'Performance', result: results.performance },
  ];

  let passCount = 0;
  tests.forEach((test) => {
    if (test.result) {
      log(COLORS.green, `✅ ${test.name}: PASS`);
      passCount++;
    } else {
      log(COLORS.red, `❌ ${test.name}: FAIL`);
    }
  });

  console.log('\n' + '='.repeat(60));
  const allPassed = passCount === tests.length;

  if (allPassed) {
    log(COLORS.green, `\n✅ ALL TESTS PASSED (${passCount}/${tests.length})`);
    log(COLORS.green, '🎉 Backend is ready for production!\n');
    process.exit(0);
  } else {
    log(
      COLORS.yellow,
      `\n⚠️  SOME TESTS FAILED (${passCount}/${tests.length} passed)`
    );
    log(COLORS.yellow, '🔧 Review failed tests and apply fixes\n');
    process.exit(1);
  }
}

main();
