import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../../.env') });

import { mongodb } from '../db/mongodb';

async function showHoldings() {
  await mongodb.connect();
  const db = mongodb.getDb();

  const holdings = await db.collection('holdings').find({}).toArray();
  console.log('='.repeat(60));
  console.log('EXISTING HOLDINGS DATA IN DATABASE');
  console.log('='.repeat(60));
  console.log('Total records:', holdings.length);

  holdings.forEach((h, i) => {
    console.log('\n' + '-'.repeat(60));
    console.log(
      `${i + 1}. ${h.schemeName || h.fundName || 'Fund ' + h.schemeCode}`
    );
    console.log('   Code:', h.schemeCode || h.fundCode);
    console.log('   Top Holdings:');
    (h.holdings || []).slice(0, 5).forEach((stock: any) => {
      console.log(`     - ${stock.company} (${stock.holdingPercent}%)`);
    });
    console.log('   Sectors:', Object.keys(h.sectors || {}).join(', '));
  });

  process.exit(0);
}
showHoldings().catch(console.error);
