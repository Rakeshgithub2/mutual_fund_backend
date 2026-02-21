"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const mongodb_1 = require("../src/db/mongodb");
async function handler(req, res) {
    try {
        console.log('[test-mongodb] Connecting...');
        await mongodb_1.mongodb.connect();
        console.log('[test-mongodb] Connected! isConnected:', mongodb_1.mongodb.isConnected());
        const db = mongodb_1.mongodb.getDb();
        const collections = await db.listCollections().toArray();
        res.status(200).json({
            success: true,
            message: 'MongoDB working!',
            isConnected: mongodb_1.mongodb.isConnected(),
            collections: collections.map((c) => c.name),
        });
    }
    catch (error) {
        console.error('[test-mongodb] Error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            stack: error.stack,
        });
    }
}
