"use strict";
/**
 * AI Chat Routes
 * Knowledge Base + Gemini AI-powered chatbot for mutual fund queries
 * First checks knowledge base, then uses AI for complex queries
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const generative_ai_1 = require("@google/generative-ai");
const mongodb_1 = require("../db/mongodb");
const auth_middleware_1 = require("../middleware/auth.middleware");
const knowledge_base_service_1 = require("../services/knowledge-base.service");
const knowledge_base_1000_complete_1 = require("../data/knowledge-base-1000-complete");
const router = (0, express_1.Router)();
// Initialize Gemini AI
const genAI = process.env.GEMINI_API_KEY
    ? new generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    : null;
// Seed knowledge base on startup
(0, knowledge_base_service_1.seedKnowledgeBase)().catch(console.error);
/**
 * POST /api/chat
 *
 * Body: { message: string, conversationHistory?: Array }
 *
 * Returns AI response based on knowledge base first, then Gemini AI
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
        const userQuery = message.trim();
        console.log(`💬 [Chat] User query: "${userQuery}"`);
        // STEP 1: Check if this is a calculation query
        if ((0, knowledge_base_service_1.isCalculationQuery)(userQuery)) {
            const calcParams = (0, knowledge_base_service_1.parseCalculationQuery)(userQuery);
            if (calcParams) {
                const calcResult = (0, knowledge_base_service_1.performCalculation)(calcParams.type, calcParams.params);
                console.log(`🧮 [Chat] Calculation performed: ${calcParams.type}`);
                return res.json({
                    success: true,
                    reply: calcResult,
                    source: 'calculator',
                    timestamp: new Date().toISOString(),
                });
            }
        }
        // STEP 2: Check if query contains multiple questions
        const questions = (0, knowledge_base_service_1.extractMultipleQuestions)(userQuery);
        if (questions.length > 1) {
            console.log(`📝 [Chat] Multi-question detected: ${questions.length} questions`);
            // Find matches for all questions
            const matches = await (0, knowledge_base_service_1.findMultipleMatches)(questions);
            if (matches.length >= 2) {
                // Format multi-answer response
                let multiResponse = `I found answers to ${matches.length} of your questions:\n\n`;
                matches.forEach((match, idx) => {
                    multiResponse += `**Question ${idx + 1}: ${match.entry.question}**\n\n`;
                    multiResponse += `**Definition:**\n${match.entry.definition}\n\n`;
                    multiResponse += `**Key Points:**\n`;
                    match.entry.points.forEach((point, pointIdx) => {
                        multiResponse += `${pointIdx + 1}. ${point}\n`;
                    });
                    if (match.entry.formula) {
                        multiResponse += `\n**Formula:** ${match.entry.formula}\n`;
                    }
                    multiResponse += `\n---\n\n`;
                });
                // Save to conversation history
                if (req.user && mongodb_1.mongodb.isConnected()) {
                    const conversationsCollection = mongodb_1.mongodb.getCollection('chat_conversations');
                    await conversationsCollection.insertOne({
                        userId: req.user._id,
                        message: userQuery,
                        response: multiResponse,
                        source: 'knowledge_base_multi',
                        matchedQuestions: matches.map((m) => m.entry.id),
                        questionCount: matches.length,
                        timestamp: new Date(),
                    });
                }
                return res.json({
                    success: true,
                    reply: multiResponse,
                    source: 'knowledge_base',
                    matchedQuestions: matches.map((m) => ({
                        id: m.entry.id,
                        question: m.entry.question,
                        score: m.score,
                    })),
                    timestamp: new Date().toISOString(),
                });
            }
        }
        // STEP 3: Search knowledge base for single question match
        const { entry: knowledgeMatch, score, related, } = await (0, knowledge_base_service_1.findBestMatch)(userQuery);
        if (knowledgeMatch && score >= 0.4) {
            // Found a good match in knowledge base
            console.log(`📚 [Chat] Knowledge match found: "${knowledgeMatch.question}" (score: ${score.toFixed(2)})`);
            const response = (0, knowledge_base_service_1.formatKnowledgeResponse)(knowledgeMatch);
            // Add related questions as suggestions
            const followUpQuestions = related.slice(0, 3).map((r) => r.question);
            // Save to conversation history
            if (req.user && mongodb_1.mongodb.isConnected()) {
                const conversationsCollection = mongodb_1.mongodb.getCollection('chat_conversations');
                await conversationsCollection.insertOne({
                    userId: req.user._id,
                    message: userQuery,
                    response,
                    source: 'knowledge_base',
                    matchedQuestionId: knowledgeMatch.id,
                    matchScore: score,
                    timestamp: new Date(),
                });
            }
            return res.json({
                success: true,
                reply: response,
                source: 'knowledge_base',
                matchedQuestion: knowledgeMatch.question,
                confidence: score,
                followUpQuestions,
                relatedTopics: related.slice(0, 3).map((r) => ({
                    id: r.id,
                    question: r.question,
                    category: r.category,
                })),
                timestamp: new Date().toISOString(),
            });
        }
        // STEP 3: Fall back to Gemini AI for complex/unique queries
        if (!genAI) {
            // No AI available, provide helpful response
            return res.json({
                success: true,
                reply: `Currently, I am not able to answer your question. I will update more information and get back to you. Please try asking about mutual funds, stocks, commodities, debt funds, or financial calculations.`,
                source: 'no_match',
                timestamp: new Date().toISOString(),
            });
        }
        console.log(`🤖 [Chat] Using Gemini AI for: "${userQuery}"`);
        // Get the generative model
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
        // Build context from database
        let fundsCount = 0;
        let categories = [];
        let fundHouses = [];
        if (mongodb_1.mongodb.isConnected()) {
            const fundsCollection = mongodb_1.mongodb.getCollection('funds');
            fundsCount = await fundsCollection.countDocuments({ isActive: true });
            categories = await fundsCollection.distinct('category');
            fundHouses = await fundsCollection.distinct('fundHouse');
        }
        // Include knowledge base context for better answers
        const relevantKnowledge = await (0, knowledge_base_service_1.searchQuestions)(userQuery, 3);
        const knowledgeContext = relevantKnowledge.length > 0
            ? `\n\nRelevant knowledge base entries:\n${relevantKnowledge.map((k) => `- ${k.question}: ${k.definition}`).join('\n')}`
            : '';
        // Build system prompt with context
        const systemContext = `You are MutualFunBot, an AI assistant specialized in mutual funds investment in India (2026).
    
Current Database Stats:
- Total Active Funds: ${fundsCount}
- Categories: ${categories.join(', ')}
- Fund Houses: ${fundHouses.slice(0, 20).join(', ')}${fundHouses.length > 20 ? ' and more' : ''}
${knowledgeContext}

Your role is to:
1. Help users understand mutual funds in simple language
2. Explain investment terms clearly (assume user is a beginner)
3. Provide accurate information about Indian mutual funds
4. Answer queries about returns, risk, taxation, and fund selection
5. Use bullet points for clarity
6. Include practical examples with Indian Rupee (₹)

Important Guidelines:
- Keep answers simple and beginner-friendly
- Use bullet points (•) for key information
- DO NOT provide specific investment advice or recommendations
- DO NOT guarantee returns
- Always mention that past performance doesn't guarantee future results
- Be helpful, educational, and user-friendly
- Current tax rules: LTCG 12.5% above ₹1.25L, STCG 20% for equity funds

User Query: ${message}

Provide a helpful, accurate response in a conversational tone with bullet points.`;
        // Generate response
        const result = await model.generateContent(systemContext);
        const response = await result.response;
        const aiResponse = response.text();
        // Save conversation to database
        if (req.user && mongodb_1.mongodb.isConnected()) {
            const conversationsCollection = mongodb_1.mongodb.getCollection('chat_conversations');
            await conversationsCollection.insertOne({
                userId: req.user._id,
                message: userQuery,
                response: aiResponse,
                source: 'gemini_ai',
                timestamp: new Date(),
            });
        }
        return res.json({
            success: true,
            reply: aiResponse,
            source: 'gemini_ai',
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        console.error('AI Chat Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to generate response',
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
    // Return popular questions from knowledge base
    const popularIds = [1, 8, 3, 6, 16, 41, 56, 82, 27, 29];
    const suggestions = knowledge_base_1000_complete_1.knowledgeBase
        .filter((k) => popularIds.includes(k.id))
        .map((k) => k.question);
    res.json({
        success: true,
        data: suggestions,
        categories: knowledge_base_1000_complete_1.knowledgeCategories,
    });
});
/**
 * GET /api/chat/knowledge
 *
 * Get all knowledge base questions grouped by category
 */
router.get('/knowledge', async (req, res) => {
    const { category, level, search, limit = 20 } = req.query;
    try {
        let results = [...knowledge_base_1000_complete_1.knowledgeBase];
        // Filter by category
        if (category && typeof category === 'string') {
            results = results.filter((k) => k.category.toLowerCase() === category.toLowerCase());
        }
        // Filter by level
        if (level && typeof level === 'string') {
            results = results.filter((k) => k.level === level);
        }
        // Search
        if (search && typeof search === 'string') {
            const searchLower = search.toLowerCase();
            results = results.filter((k) => k.question.toLowerCase().includes(searchLower) ||
                k.keywords.some((kw) => kw.toLowerCase().includes(searchLower)) ||
                k.definition.toLowerCase().includes(searchLower));
        }
        // Limit results
        results = results.slice(0, Number(limit));
        // Group by category if no specific category requested
        let grouped = null;
        if (!category) {
            grouped = {};
            for (const entry of results) {
                if (!grouped[entry.category]) {
                    grouped[entry.category] = [];
                }
                grouped[entry.category].push(entry);
            }
        }
        res.json({
            success: true,
            data: grouped || results,
            total: results.length,
            categories: knowledge_base_1000_complete_1.knowledgeCategories,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch knowledge base',
        });
    }
});
/**
 * GET /api/chat/knowledge/:id
 *
 * Get a specific question by ID
 */
router.get('/knowledge/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid question ID',
        });
    }
    const entry = knowledge_base_1000_complete_1.knowledgeBase.find((k) => k.id === id);
    if (!entry) {
        return res.status(404).json({
            success: false,
            message: 'Question not found',
        });
    }
    // Get related questions
    const related = entry.relatedQuestions
        ? knowledge_base_1000_complete_1.knowledgeBase.filter((k) => entry.relatedQuestions?.includes(k.id))
        : [];
    res.json({
        success: true,
        data: entry,
        related: related.map((r) => ({
            id: r.id,
            question: r.question,
            category: r.category,
            level: r.level,
        })),
    });
});
/**
 * POST /api/chat/calculate
 *
 * Perform financial calculations
 */
router.post('/calculate', async (req, res) => {
    const { type, params } = req.body;
    if (!type || !params) {
        return res.status(400).json({
            success: false,
            message: 'Calculation type and parameters are required',
        });
    }
    try {
        const result = (0, knowledge_base_service_1.performCalculation)(type, params);
        res.json({
            success: true,
            result,
            type,
            params,
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            message: 'Invalid calculation parameters',
        });
    }
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
        if (!mongodb_1.mongodb.isConnected()) {
            return res.status(503).json({
                success: false,
                message: 'Database connection not available',
            });
        }
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
        const analysisPrompt = `Analyze this mutual fund and provide insights for a beginner investor:

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

Please provide in simple bullet points:
1. What this fund does (1-2 lines)
2. Key strengths (3 bullets)
3. Things to consider (3 bullets)
4. Who should consider this fund (risk profile)
5. Ideal investment horizon

Keep it beginner-friendly. Don't provide buy/sell recommendations.`;
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
