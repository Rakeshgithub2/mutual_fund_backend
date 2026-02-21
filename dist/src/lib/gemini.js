"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiClient = void 0;
const node_fetch_1 = __importDefault(require("node-fetch"));
class GeminiClient {
    constructor(apiKey) {
        this.apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
        this.apiKey = apiKey;
    }
    async getHoldingsAndSectors(prompt) {
        const body = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 2048,
            },
        };
        try {
            const response = await (0, node_fetch_1.default)(`${this.apiUrl}?key=${this.apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await response.json();
            // Debug: Log raw response
            if (data?.error) {
                console.error('Gemini API Error:', data.error?.message || data.error);
                return null;
            }
            // Expect Gemini to return JSON in the first candidate
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) {
                console.error('No text in Gemini response');
                return null;
            }
            // Try to parse JSON from Gemini response
            const match = text.match(/\{[\s\S]*\}/);
            if (!match) {
                console.error('No JSON found in response:', text.substring(0, 200));
                return null;
            }
            const json = JSON.parse(match[0]);
            return {
                holdings: json.holdings || [],
                sectors: json.sectors || {},
            };
        }
        catch (err) {
            console.error('Gemini API error:', err);
            return null;
        }
    }
}
exports.GeminiClient = GeminiClient;
