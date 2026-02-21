require('dotenv').config();
const { MongoClient } = require('mongodb');

async function checkDatabase() {
  const client = new MongoClient(process.env.DATABASE_URL);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB Atlas\n');

    const db = client.db('mutualfunds');

    // List all collections
    const collections = await db.listCollections().toArray();
    console.log(
      'Collections found:',
      collections.map((c) => c.name).join(', ')
    );
    console.log('\n' + '='.repeat(60));

    // Check each possible collection name
    const possibleNames = [
      'funds',
      'Funds',
      'fundstaticsmaster',
      'fundenhanceds',
      'mutualfunds',
    ];

    for (const colName of possibleNames) {
      try {
        const count = await db.collection(colName).countDocuments();
        if (count > 0) {
          console.log(`\n✅ Collection: ${colName}`);
          console.log(`   Total documents: ${count.toLocaleString()}`);

          // Get sample document
          const sample = await db.collection(colName).findOne();
          const keys = Object.keys(sample);
          console.log(
            `   Fields (${keys.length}):`,
            keys.slice(0, 15).join(', ')
          );
          if (keys.length > 15)
            console.log(`   ... and ${keys.length - 15} more fields`);
        }
      } catch (e) {
        // Collection doesn't exist, skip
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n✅ Database check complete');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

checkDatabase();
