// Quick test for optimized fund loading endpoints
const axios = require('axios');

const BASE_URL = process.env.API_URL || 'http://localhost:3002/api';

async function testOptimizedLoading() {
  console.log('🧪 Testing Optimized Fund Loading\n');

  try {
    // Test 1: Quick load (500 funds)
    console.log('1️⃣ Testing /funds/quick endpoint...');
    const startQuick = Date.now();
    const quickRes = await axios.get(`${BASE_URL}/funds/quick`);
    const quickTime = Date.now() - startQuick;

    console.log(`   ✅ Response time: ${quickTime}ms`);
    console.log(`   ✅ Funds loaded: ${quickRes.data.data?.length || 0}`);
    console.log(`   ✅ Has more: ${quickRes.data.hasMore}`);

    if (quickRes.data.data?.length !== 500) {
      console.log('   ⚠️  Expected 500 funds, got', quickRes.data.data?.length);
    }

    // Test 2: Get total count
    console.log('\n2️⃣ Testing /funds/count endpoint...');
    const startCount = Date.now();
    const countRes = await axios.get(`${BASE_URL}/funds/count`);
    const countTime = Date.now() - startCount;

    console.log(`   ✅ Response time: ${countTime}ms`);
    console.log(`   ✅ Total funds: ${countRes.data.total}`);
    console.log(`   ✅ Total pages: ${countRes.data.pages500}`);

    // Test 3: Batch load
    console.log('\n3️⃣ Testing /funds/batch/2 endpoint...');
    const startBatch = Date.now();
    const batchRes = await axios.get(`${BASE_URL}/funds/batch/2`);
    const batchTime = Date.now() - startBatch;

    console.log(`   ✅ Response time: ${batchTime}ms`);
    console.log(`   ✅ Funds in batch: ${batchRes.data.data?.length || 0}`);
    console.log(`   ✅ Loaded: ${batchRes.data.pagination?.loaded}`);
    console.log(`   ✅ Remaining: ${batchRes.data.pagination?.remaining}`);

    // Test 4: Standard pagination with new defaults
    console.log('\n4️⃣ Testing /funds?page=1&limit=500 endpoint...');
    const startStd = Date.now();
    const stdRes = await axios.get(`${BASE_URL}/funds?page=1&limit=500`);
    const stdTime = Date.now() - startStd;

    console.log(`   ✅ Response time: ${stdTime}ms`);
    console.log(`   ✅ Funds loaded: ${stdRes.data.data?.length || 0}`);
    console.log(`   ✅ Total: ${stdRes.data.pagination?.total}`);

    // Performance summary
    console.log('\n📊 Performance Summary:');
    console.log('─────────────────────────────────────');
    console.log(`Quick Load (500):    ${quickTime}ms`);
    console.log(`Count:               ${countTime}ms`);
    console.log(`Batch Load (500):    ${batchTime}ms`);
    console.log(`Standard (500):      ${stdTime}ms`);
    console.log('─────────────────────────────────────');

    if (quickTime < 1000 && batchTime < 1000) {
      console.log('\n✅ ALL TESTS PASSED - Loading optimized!');
      console.log('🚀 First 500 funds load in < 1 second');
      console.log('📦 Background batches load efficiently');
    } else {
      console.log('\n⚠️  WARNING: Response times > 1s');
      console.log('💡 Consider checking:');
      console.log('   - Redis connection and caching');
      console.log('   - MongoDB indexes');
      console.log('   - Network latency');
    }
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Response:', error.response.status, error.response.data);
    }
    process.exit(1);
  }
}

// Run test
testOptimizedLoading();
