import express from 'express';
import { mongodb } from './db/mongodb';
import { FundModel } from './models/Fund.model';

const app = express();
const PORT = 3003; // Use different port

async function start() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongodb.connect();
    console.log('✅ MongoDB connected');

    app.get('/test', async (req, res) => {
      try {
        console.log('📥 /test request received');
        const fundModel = FundModel.getInstance();
        const funds = await fundModel.findAll({ limit: 10 });

        console.log(`✅ Found ${funds.length} funds`);

        res.json({
          success: true,
          total: funds.length,
          funds: funds.map((f) => ({
            name: f.name,
            category: f.category,
            fundHouse: f.fundHouse,
          })),
        });
      } catch (error: any) {
        console.error('❌ Error in handler:', error);
        res.status(500).json({ error: error.message, stack: error.stack });
      }
    });

    const server = app.listen(PORT, () => {
      console.log(`✅ Test server running on http://localhost:${PORT}`);
      console.log(`📍 Try: http://localhost:${PORT}/test`);
    });

    server.on('error', (error) => {
      console.error('❌ Server error:', error);
    });
  } catch (error) {
    console.error('❌ Failed to start:', error);
    process.exit(1);
  }
}

start();
