"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const mongodb_1 = require("../src/db/mongodb");
const emailAuth_1 = require("../src/controllers/emailAuth");
async function handler(req, res) {
    try {
        // Set CORS headers
        const allowedOrigins = [
            'https://mf-frontend-coral.vercel.app',
            'https://mutual-fun-frontend-osed.vercel.app',
            'http://localhost:3000',
        ];
        const origin = req.headers.origin;
        if (origin && allowedOrigins.includes(origin)) {
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Access-Control-Allow-Credentials', 'true');
        }
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        if (req.method === 'OPTIONS') {
            return res.status(200).end();
        }
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method not allowed' });
        }
        // Connect to MongoDB
        await mongodb_1.mongodb.connect();
        // Call the login handler
        await (0, emailAuth_1.emailLogin)(req, res);
    }
    catch (error) {
        console.error('Login route error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
        });
    }
}
