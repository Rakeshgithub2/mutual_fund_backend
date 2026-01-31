/**
 * Test the holdings fallback system
 */
const { MongoClient } = require('mongodb');
require('dotenv').config();

async function testFallback() {
  const client = new MongoClient(process.env.DATABASE_URL);
  await client.connect();
  const db = client.db('mutualfunds');

  // Get scheme codes that already have holdings
  const existingHoldings = await db
    .collection('holdings')
    .distinct('schemeCode');
  console.log('📊 Funds WITH holdings:', existingHoldings.length);

  // Get random funds from different categories that DON'T have holdings
  const categories = [
    'Large Cap',
    'Mid Cap',
    'Small Cap',
    'Flexi Cap',
    'ELSS',
    'Index',
  ];

  console.log('');
  console.log('=== Random funds WITHOUT holdings (will use fallback): ===');

  for (const cat of categories) {
    const fund = await db.collection('funds').findOne({
      subCategory: { $regex: cat, $options: 'i' },
      schemeCode: { $nin: existingHoldings },
    });

    if (fund) {
      console.log('');
      console.log(`📁 Category: ${cat}`);
      console.log(`   Name: ${fund.schemeName}`);
      console.log(`   SchemeCode: ${fund.schemeCode}`);
      console.log(`   SubCategory: ${fund.subCategory}`);
    }
  }

  // Also test debt fund
  const debtFund = await db.collection('funds').findOne({
    category: 'debt',
    schemeCode: { $nin: existingHoldings },
  });

  if (debtFund) {
    console.log('');
    console.log('📁 Category: Debt');
    console.log(`   Name: ${debtFund.schemeName}`);
    console.log(`   SchemeCode: ${debtFund.schemeCode}`);
    console.log(`   SubCategory: ${debtFund.subCategory}`);
  }

  await client.close();
}

testFallback();
