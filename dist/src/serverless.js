"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
exports.default = handler;
const app_1 = __importDefault(require("./app"));
exports.app = app_1.default;
const mongodb_1 = require("./db/mongodb");
// Cache for serverless - maintain connection across invocations
let isConnected = false;
const connectDB = async () => {
    // Always check if connected, don't rely on cached flag alone
    if (mongodb_1.mongodb.isConnected()) {
        return;
    }
    try {
        console.log('🔄 Attempting MongoDB connection...');
        console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
        await mongodb_1.mongodb.connect();
        isConnected = true;
        console.log('✅ MongoDB connected for serverless function');
    }
    catch (error) {
        console.error('❌ MongoDB connection error:', error);
        isConnected = false;
        throw error; // Don't continue if DB connection fails
    }
};
// Serverless handler for Vercel
async function handler(req, res) {
    try {
        // Ensure DB is connected
        await connectDB();
        // Handle the request with Express app
        // We need to wrap this properly for serverless
        await new Promise((resolve, reject) => {
            // Set a flag to track if response was sent
            let responseSent = false;
            // Override res.end to know when response is complete
            const originalEnd = res.end.bind(res);
            res.end = function (...args) {
                if (!responseSent) {
                    responseSent = true;
                    originalEnd(...args);
                    resolve();
                }
                return res;
            };
            // Call Express app
            (0, app_1.default)(req, res, (err) => {
                if (err && !responseSent) {
                    responseSent = true;
                    reject(err);
                }
                else if (!responseSent) {
                    // If no error and response not sent, something went wrong
                    responseSent = true;
                    resolve();
                }
            });
        });
    }
    catch (error) {
        console.error('❌ Serverless function error:', error);
        // Only send error response if headers haven't been sent
        if (!res.headersSent) {
            return res.status(500).json({
                error: 'Internal server error',
                message: error.message,
                timestamp: new Date().toISOString(),
            });
        }
    }
}
