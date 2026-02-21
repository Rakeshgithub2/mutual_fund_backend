"use strict";
/**
 * AI Chat Routes
 * Gemini AI-powered chatbot for mutual fund queries
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const generative_ai_1 = require("@google/generative-ai");
const mongodb_1 = require("../db/mongodb");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Initialize Gemini AI
const genAI = process.env.GEMINI_API_KEY
    ? new generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    : null;
/**
 * POST /api/chat
 *
 * Body: { message: string, conversationHistory?: Array }
 *
 * Returns AI response based on mutual fund data
 */
router.post('/', auth_middleware_1.optionalAuth, async (req, res) => {
    try {
        const { message, conversationHistory = [] } = req.body;
        if (!message ||
            typeof message !== 'string' ||
            message.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Message is required',
            });
        }
        if (!genAI) {
            return res.status(503).json({
                success: false,
                message: 'AI service is not configured. Please set GEMINI_API_KEY in environment variables.',
            });
        }
        // Get the generative model
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
        // Build context from database
        const fundsCollection = mongodb_1.mongodb.getCollection('funds');
        const fundsCount = await fundsCollection.countDocuments({ isActive: true });
        // Get sample fund categories
        const categories = await fundsCollection.distinct('category');
        const fundHouses = await fundsCollection.distinct('fundHouse');
        // Build system prompt with context
        const systemContext = `You are MutualFunBot, an AI assistant specialized in mutual funds investment in India.
    
Current Database Stats:
- Total Active Funds: ${fundsCount}
- Categories: ${categories.join(', ')}
- Fund Houses: ${fundHouses.slice(0, 20).join(', ')}${fundHouses.length > 20 ? ' and more' : ''}

Your role is to:
1. Help users understand mutual funds
2. Explain different fund categories (Equity, Debt, Hybrid, Commodity)
3. Provide general investment guidance
4. Answer queries about returns, risk, and fund selection
5. Explain financial terms in simple language

Important Guidelines:
- DO NOT provide specific investment advice or recommendations
- DO NOT guarantee returns
- Always mention that past performance doesn't guarantee future results
- Suggest users consult a certified financial advisor for personalized advice
- Be helpful, educational, and user-friendly

User Query: ${message}

Provide a helpful, accurate response in a conversational tone.`;
        // Generate response
        const result = await model.generateContent(systemContext);
        const response = await result.response;
        const aiResponse = response.text();
        // Save conversation to database (optional)
        if (req.user) {
            const conversationsCollection = mongodb_1.mongodb.getCollection('chat_conversations');
            await conversationsCollection.insertOne({
                userId: req.user._id,
                message,
                response: aiResponse,
                timestamp: new Date(),
            });
        }
        return res.json({
            success: true,
            reply: aiResponse, // Frontend expects 'reply' directly, not nested in 'data'
            data: {
                response: aiResponse,
                timestamp: new Date().toISOString(),
            },
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        console.error('AI Chat Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to generate AI response',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
/**
 * GET /api/chat/suggestions
 *
 * Returns suggested questions users can ask
 */
router.get('/suggestions', async (req, res) => {
    const suggestions = [
        'What is the difference between equity and debt funds?',
        'How do I choose the right mutual fund?',
        'What is SIP and how does it work?',
        'Explain expense ratio in mutual funds',
        'What are large cap, mid cap, and small cap funds?',
        'How are mutual fund returns calculated?',
        'What is NAV in mutual funds?',
        'Should I invest in direct or regular plans?',
        'What is the ideal portfolio allocation?',
        'How much should I invest in mutual funds?',
    ];
    res.json({
        success: true,
        data: suggestions,
    });
});
/**
 * POST /api/chat/analyze-fund
 *
 * Get AI analysis of a specific fund
 * Body: { fundId: string }
 */
router.post('/analyze-fund', auth_middleware_1.optionalAuth, async (req, res) => {
    try {
        const { fundId } = req.body;
        if (!fundId) {
            return res.status(400).json({
                success: false,
                message: 'fundId is required',
            });
        }
        if (!genAI) {
            return res.status(503).json({
                success: false,
                message: 'AI service is not configured',
            });
        }
        // Fetch fund details
        const fundsCollection = mongodb_1.mongodb.getCollection('funds');
        const fund = await fundsCollection.findOne({ fundId });
        if (!fund) {
            return res.status(404).json({
                success: false,
                message: 'Fund not found',
            });
        }
        // Generate AI analysis
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
        const analysisPrompt = `Analyze this mutual fund and provide insights:

Fund Name: ${fund.name}
Category: ${fund.category} - ${fund.subCategory}
Fund House: ${fund.fundHouse}
Fund Manager: ${fund.fundManager?.name || 'N/A'}
Current NAV: ₹${fund.nav}
1Y Return: ${fund.returns?.oneYear || 'N/A'}%
3Y Return: ${fund.returns?.threeYear || 'N/A'}%
AUM: ₹${fund.aum || 'N/A'} Cr
Expense Ratio: ${fund.expenseRatio || 'N/A'}%
Risk Level: ${fund.riskLevel || 'N/A'}

Please provide:
1. Brief overview of this fund
2. Key strengths
3. Potential considerations
4. Who might consider this fund (risk profile)
5. General investment perspective

Keep it concise (3-4 paragraphs) and educational. Don't provide buy/sell recommendations.`;
        const result = await model.generateContent(analysisPrompt);
        const response = await result.response;
        const analysis = response.text();
        return res.json({
            success: true,
            data: {
                fundId,
                fundName: fund.name,
                analysis,
                timestamp: new Date().toISOString(),
            },
        });
    }
    catch (error) {
        console.error('Fund Analysis Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to analyze fund',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
exports.default = router;
