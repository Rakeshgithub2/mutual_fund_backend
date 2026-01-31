const { MongoClient } = require('mongodb');
require('dotenv').config();

async function getTop100EquityFunds() {
  const client = new MongoClient(process.env.DATABASE_URL);
  await client.connect();
  const db = client.db('mutualfunds');

  const categories = [
    { sub: 'largecap', count: 15 },
    { sub: 'midcap', count: 15 },
    { sub: 'smallcap', count: 15 },
    { sub: 'flexicap', count: 12 },
    { sub: 'multicap', count: 8 },
    { sub: 'elss', count: 15 },
    { sub: 'large', count: 10 },
    { sub: 'focused', count: 5 },
    { sub: 'value', count: 5 },
  ];

  let allFunds = [];

  for (const cat of categories) {
    const funds = await db
      .collection('funds')
      .find({
        category: 'equity',
        subCategory: { $regex: cat.sub, $options: 'i' },
        schemeName: { $regex: 'Direct', $options: 'i' },
      })
      .project({ schemeCode: 1, schemeName: 1, subCategory: 1 })
      .limit(cat.count * 3)
      .toArray();

    const growthFunds = funds
      .filter(
        (f) =>
          f.schemeName.toLowerCase().includes('growth') &&
          !f.schemeName.toLowerCase().includes('idcw')
      )
      .slice(0, cat.count);

    allFunds = allFunds.concat(growthFunds);
  }

  const seen = new Set();
  const uniqueFunds = allFunds
    .filter((f) => {
      if (seen.has(f.schemeCode)) return false;
      seen.add(f.schemeCode);
      return true;
    })
    .slice(0, 100);

  console.log('TOP 100 EQUITY FUNDS');
  console.log('====================\n');

  uniqueFunds.forEach((f, i) => {
    console.log(`${i + 1}. ${f.schemeName} | SchemeCode: ${f.schemeCode}`);
  });

  await client.close();
}

getTop100EquityFunds();
