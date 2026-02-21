"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchHoldingsFromGemini = fetchHoldingsFromGemini;
const axios_1 = __importDefault(require("axios"));
async function fetchHoldingsFromGemini(schemeCode, fundName) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey)
        throw new Error('GEMINI_API_KEY not set');
    // Gemini API prompt for holdings extraction
    const prompt = `Fetch the latest real-world holdings (company, sector, percentage) for the Indian mutual fund: ${fundName} (Scheme Code: ${schemeCode}). Return as a JSON array.`;
    const response = await axios_1.default.post('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent', {
        contents: [{ parts: [{ text: prompt }] }],
    }, {
        params: { key: apiKey },
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000,
    });
    // Parse Gemini's response
    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    try {
        const holdings = JSON.parse(text);
        if (Array.isArray(holdings))
            return holdings;
        throw new Error('Gemini response is not a valid array');
    }
    catch (err) {
        throw new Error('Failed to parse Gemini holdings response: ' + err);
    }
}
