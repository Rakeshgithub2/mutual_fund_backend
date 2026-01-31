import { mongodb } from '../src/db/mongodb';

export default async function handler(req: any, res: any) {
  try {
    console.log('[test-mongodb] Connecting...');
    await mongodb.connect();
    console.log(
      '[test-mongodb] Connected! isConnected:',
      mongodb.isConnected()
    );

    const db = mongodb.getDb();
    const collections = await db.listCollections().toArray();

    res.status(200).json({
      success: true,
      message: 'MongoDB working!',
      isConnected: mongodb.isConnected(),
      collections: collections.map((c) => c.name),
    });
  } catch (error: any) {
    console.error('[test-mongodb] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
    });
  }
}
