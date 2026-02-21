"use strict";
/**
 * Chatbot API Routes
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const enhanced_chatbot_service_1 = require("../services/enhanced-chatbot.service");
const router = express_1.default.Router();
/**
 * POST /api/chatbot/ask
 * Process user query and get AI response
 */
router.post('/ask', async (req, res) => {
    try {
        const { query, userId, sessionId } = req.body;
        if (!query || typeof query !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'Query is required and must be a string',
            });
        }
        const response = await enhanced_chatbot_service_1.enhancedChatbotService.processQuery(query, userId, sessionId);
        res.json({
            success: true,
            data: response,
        });
    }
    catch (error) {
        console.error('Chatbot ask error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process query',
            error: error.message,
        });
    }
});
/**
 * GET /api/chatbot/history/:sessionId
 * Get chat history for a session
 */
router.get('/history/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const history = await enhanced_chatbot_service_1.enhancedChatbotService.getChatHistory(sessionId);
        res.json({
            success: true,
            data: history,
        });
    }
    catch (error) {
        console.error('Get chat history error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get chat history',
            error: error.message,
        });
    }
});
/**
 * GET /api/chatbot/user-history/:userId
 * Get user's chat history
 */
router.get('/user-history/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const limit = parseInt(req.query.limit) || 50;
        const history = await enhanced_chatbot_service_1.enhancedChatbotService.getUserChatHistory(userId, limit);
        res.json({
            success: true,
            data: history,
        });
    }
    catch (error) {
        console.error('Get user chat history error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get user chat history',
            error: error.message,
        });
    }
});
/**
 * GET /api/chatbot/popular
 * Get popular/frequently asked questions
 */
router.get('/popular', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const popular = await enhanced_chatbot_service_1.enhancedChatbotService.getPopularQuestions(limit);
        res.json({
            success: true,
            data: popular,
        });
    }
    catch (error) {
        console.error('Get popular questions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get popular questions',
            error: error.message,
        });
    }
});
/**
 * GET /api/chatbot/categories
 * Get all knowledge base categories
 */
router.get('/categories', async (req, res) => {
    try {
        const categories = await enhanced_chatbot_service_1.enhancedChatbotService.getCategories();
        res.json({
            success: true,
            data: categories,
        });
    }
    catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get categories',
            error: error.message,
        });
    }
});
/**
 * GET /api/chatbot/category/:category
 * Get questions by category
 */
router.get('/category/:category', async (req, res) => {
    try {
        const { category } = req.params;
        const { level } = req.query;
        const questions = await enhanced_chatbot_service_1.enhancedChatbotService.searchByCategory(category, level);
        res.json({
            success: true,
            data: questions,
        });
    }
    catch (error) {
        console.error('Get category questions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get category questions',
            error: error.message,
        });
    }
});
/**
 * POST /api/chatbot/calculate/sip
 * Calculate SIP returns
 */
router.post('/calculate/sip', async (req, res) => {
    try {
        const { monthlyInvestment, rateOfReturn, years } = req.body;
        if (!monthlyInvestment || !rateOfReturn || !years) {
            return res.status(400).json({
                success: false,
                message: 'monthlyInvestment, rateOfReturn, and years are required',
            });
        }
        const { calculationService } = await Promise.resolve().then(() => __importStar(require('../services/calculation.service')));
        const result = calculationService.calculateSIP(monthlyInvestment, rateOfReturn, years);
        res.json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        console.error('SIP calculation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to calculate SIP',
            error: error.message,
        });
    }
});
/**
 * POST /api/chatbot/calculate/lumpsum
 * Calculate Lumpsum returns
 */
router.post('/calculate/lumpsum', async (req, res) => {
    try {
        const { principal, rateOfReturn, years } = req.body;
        if (!principal || !rateOfReturn || !years) {
            return res.status(400).json({
                success: false,
                message: 'principal, rateOfReturn, and years are required',
            });
        }
        const { calculationService } = await Promise.resolve().then(() => __importStar(require('../services/calculation.service')));
        const result = calculationService.calculateLumpsum(principal, rateOfReturn, years);
        res.json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        console.error('Lumpsum calculation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to calculate Lumpsum',
            error: error.message,
        });
    }
});
/**
 * POST /api/chatbot/calculate/cagr
 * Calculate CAGR
 */
router.post('/calculate/cagr', async (req, res) => {
    try {
        const { beginningValue, endingValue, years } = req.body;
        if (!beginningValue || !endingValue || !years) {
            return res.status(400).json({
                success: false,
                message: 'beginningValue, endingValue, and years are required',
            });
        }
        const { calculationService } = await Promise.resolve().then(() => __importStar(require('../services/calculation.service')));
        const result = calculationService.calculateCAGR(beginningValue, endingValue, years);
        res.json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        console.error('CAGR calculation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to calculate CAGR',
            error: error.message,
        });
    }
});
/**
 * POST /api/chatbot/calculate/retirement
 * Calculate retirement corpus
 */
router.post('/calculate/retirement', async (req, res) => {
    try {
        const { currentAge, retirementAge, monthlyExpenses, inflation, postRetirementReturn, } = req.body;
        if (!currentAge || !retirementAge || !monthlyExpenses) {
            return res.status(400).json({
                success: false,
                message: 'currentAge, retirementAge, and monthlyExpenses are required',
            });
        }
        const { calculationService } = await Promise.resolve().then(() => __importStar(require('../services/calculation.service')));
        const result = calculationService.calculateRetirementCorpus(currentAge, retirementAge, monthlyExpenses, inflation, postRetirementReturn);
        res.json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        console.error('Retirement calculation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to calculate retirement corpus',
            error: error.message,
        });
    }
});
/**
 * POST /api/chatbot/calculate/goal
 * Calculate goal planning
 */
router.post('/calculate/goal', async (req, res) => {
    try {
        const { goalAmount, yearsToGoal, currentSavings, expectedReturn } = req.body;
        if (!goalAmount || !yearsToGoal) {
            return res.status(400).json({
                success: false,
                message: 'goalAmount and yearsToGoal are required',
            });
        }
        const { calculationService } = await Promise.resolve().then(() => __importStar(require('../services/calculation.service')));
        const result = calculationService.calculateGoalPlanning(goalAmount, yearsToGoal, currentSavings, expectedReturn);
        res.json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        console.error('Goal planning calculation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to calculate goal planning',
            error: error.message,
        });
    }
});
exports.default = router;
