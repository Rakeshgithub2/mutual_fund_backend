"use strict";
/**
 * Enhanced AI Chatbot Service
 * Integrates knowledge base with calculation capabilities
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.enhancedChatbotService = exports.EnhancedChatbotService = void 0;
const knowledge_base_service_1 = require("./knowledge-base.service");
const calculation_service_1 = require("./calculation.service");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
class EnhancedChatbotService {
    /**
     * Process user query and generate response
     */
    async processQuery(query, userId, sessionId) {
        try {
            // 1. Check if it's a calculation query
            if (knowledge_base_service_1.knowledgeBaseService.isCalculationQuery(query)) {
                return await this.handleCalculationQuery(query, userId, sessionId);
            }
            // 2. Find similar questions from knowledge base
            const similarQuestions = await knowledge_base_service_1.knowledgeBaseService.findSimilarQuestions(query, 5, 0.15);
            if (similarQuestions.length === 0) {
                return this.handleNoMatch(query, userId, sessionId);
            }
            // 3. Get the best match
            const bestMatch = similarQuestions[0];
            const confidence = bestMatch.similarity;
            // 4. Build comprehensive answer
            const answer = this.buildAnswer(bestMatch, similarQuestions.slice(1, 4));
            // 5. Save to chat history
            await this.saveChatHistory(userId, sessionId || this.generateSessionId(), query, answer, bestMatch.questionId, confidence);
            return {
                answer,
                type: 'knowledge',
                matchedQuestion: bestMatch,
                relatedQuestions: similarQuestions.slice(1, 4),
                confidence,
                sources: [
                    `Question ID: ${bestMatch.questionId}`,
                    `Category: ${bestMatch.category}`,
                ],
            };
        }
        catch (error) {
            console.error('Error processing query:', error);
            return {
                answer: 'I apologize, but I encountered an error processing your question. Please try again.',
                type: 'general',
                confidence: 0,
            };
        }
    }
    /**
     * Handle calculation-related queries
     */
    async handleCalculationQuery(query, userId, sessionId) {
        // Parse the calculation query
        const parsedCalc = calculation_service_1.calculationService.parseCalculationQuery(query);
        let calculationResult = null;
        let answer = '';
        if (parsedCalc) {
            // Perform the calculation
            switch (parsedCalc.type) {
                case 'sip':
                    calculationResult = calculation_service_1.calculationService.calculateSIP(parsedCalc.params.monthly, parsedCalc.params.returns, parsedCalc.params.years);
                    answer = `**SIP Calculation Result:**\n\n`;
                    answer += `💰 **Monthly Investment:** ₹${parsedCalc.params.monthly.toLocaleString('en-IN')}\n`;
                    answer += `📅 **Investment Period:** ${parsedCalc.params.years} years\n`;
                    answer += `📈 **Expected Returns:** ${parsedCalc.params.returns}% per annum\n\n`;
                    answer += `**Results:**\n`;
                    answer += `✅ Future Value: ₹${calculationResult.futureValue.toLocaleString('en-IN')}\n`;
                    answer += `💵 Total Invested: ₹${calculationResult.totalInvested.toLocaleString('en-IN')}\n`;
                    answer += `🎯 Estimated Returns: ₹${calculationResult.returns.toLocaleString('en-IN')}\n`;
                    answer += `📊 Percentage Gain: ${calculationResult.percentageGain}%\n`;
                    break;
                case 'lumpsum':
                    calculationResult = calculation_service_1.calculationService.calculateLumpsum(parsedCalc.params.amount, parsedCalc.params.returns, parsedCalc.params.years);
                    answer = `**Lumpsum Calculation Result:**\n\n`;
                    answer += `💰 **Investment Amount:** ₹${parsedCalc.params.amount.toLocaleString('en-IN')}\n`;
                    answer += `📅 **Investment Period:** ${parsedCalc.params.years} years\n`;
                    answer += `📈 **Expected Returns:** ${parsedCalc.params.returns}% per annum\n\n`;
                    answer += `**Results:**\n`;
                    answer += `✅ Future Value: ₹${calculationResult.futureValue.toLocaleString('en-IN')}\n`;
                    answer += `💵 Total Invested: ₹${calculationResult.totalInvested.toLocaleString('en-IN')}\n`;
                    answer += `🎯 Estimated Returns: ₹${calculationResult.returns.toLocaleString('en-IN')}\n`;
                    answer += `📊 Percentage Gain: ${calculationResult.percentageGain}%\n`;
                    break;
                case 'cagr':
                    calculationResult = calculation_service_1.calculationService.calculateCAGR(parsedCalc.params.start, parsedCalc.params.end, parsedCalc.params.years);
                    answer = `**CAGR Calculation Result:**\n\n`;
                    answer += `📊 **Starting Value:** ₹${parsedCalc.params.start.toLocaleString('en-IN')}\n`;
                    answer += `📊 **Ending Value:** ₹${parsedCalc.params.end.toLocaleString('en-IN')}\n`;
                    answer += `📅 **Time Period:** ${parsedCalc.params.years} years\n\n`;
                    answer += `**Results:**\n`;
                    answer += `📈 CAGR: ${calculationResult.cagr}% per annum\n`;
                    answer += `💰 Total Return: ${calculationResult.totalReturn}%\n`;
                    answer += `🎯 Absolute Return: ₹${calculationResult.absoluteReturn.toLocaleString('en-IN')}\n`;
                    break;
            }
        }
        else {
            // Find calculation-related questions from knowledge base
            const calcQuestions = await knowledge_base_service_1.knowledgeBaseService.findSimilarQuestions(query, 3, 0.1);
            if (calcQuestions.length > 0) {
                const bestMatch = calcQuestions[0];
                answer = this.buildAnswer(bestMatch, calcQuestions.slice(1));
                if (bestMatch.formula) {
                    answer += `\n\n**Formula:** ${bestMatch.formula}\n`;
                }
                answer += `\n\n💡 **Tip:** Provide specific numbers for a calculated result!`;
                calculationResult = {
                    type: 'formula_provided',
                    question: bestMatch.question,
                    formula: bestMatch.formula,
                };
            }
            else {
                answer = `I can help you with calculations! Please provide specific details like:\n`;
                answer += `- Investment amount\n`;
                answer += `- Time period (in years)\n`;
                answer += `- Expected returns (in %)\n\n`;
                answer += `Example: "Calculate SIP for ₹5000 monthly for 10 years at 12% returns"`;
            }
        }
        // Save to chat history
        await this.saveChatHistory(userId, sessionId || this.generateSessionId(), query, answer, null, parsedCalc ? 0.9 : 0.5, parsedCalc?.type || 'calculation');
        return {
            answer,
            type: 'calculation',
            calculationResult,
            confidence: parsedCalc ? 0.9 : 0.5,
            sources: ['Calculation Service'],
        };
    }
    /**
     * Build comprehensive answer from matched question
     */
    buildAnswer(mainQuestion, relatedQuestions) {
        let answer = `**${mainQuestion.question}**\n\n`;
        // Add definition
        answer += `📖 **Definition:**\n${mainQuestion.definition}\n\n`;
        // Add key points
        answer += `📌 **Key Points:**\n`;
        mainQuestion.points.forEach((point, index) => {
            answer += `${index + 1}. ${point}\n`;
        });
        // Add formula if exists
        if (mainQuestion.formula) {
            answer += `\n📐 **Formula:**\n\`\`\`\n${mainQuestion.formula}\n\`\`\`\n`;
        }
        // Add category and level
        answer += `\n📂 **Category:** ${mainQuestion.category} | **Level:** ${mainQuestion.level}\n`;
        // Add related questions
        if (relatedQuestions.length > 0) {
            answer += `\n🔗 **Related Questions:**\n`;
            relatedQuestions.forEach((q, index) => {
                answer += `${index + 1}. ${q.question}\n`;
            });
        }
        return answer;
    }
    /**
     * Handle queries with no good match
     */
    handleNoMatch(query, userId, sessionId) {
        const answer = `I couldn't find a specific answer to your question in my knowledge base. Here are some suggestions:\n\n`;
        const suggestions = [
            '1. Try rephrasing your question',
            '2. Use keywords like "mutual fund", "SIP", "NAV", "returns", etc.',
            '3. Ask about specific calculations',
            '4. Explore categories: Mutual Funds, Stocks, Commodities, Debt Funds, Calculations',
        ];
        return {
            answer: answer + suggestions.join('\n'),
            type: 'general',
            confidence: 0,
        };
    }
    /**
     * Save chat interaction to history
     */
    async saveChatHistory(userId, sessionId, question, answer, matchedQuestionId, similarity, calculationType) {
        try {
            await prisma.chatHistory.create({
                data: {
                    userId: userId || undefined,
                    sessionId,
                    question,
                    answer,
                    matchedQuestionId,
                    similarity,
                    calculationType,
                },
            });
        }
        catch (error) {
            console.error('Error saving chat history:', error);
        }
    }
    /**
     * Generate session ID
     */
    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    /**
     * Get chat history for a session
     */
    async getChatHistory(sessionId) {
        return await prisma.chatHistory.findMany({
            where: { sessionId },
            orderBy: { createdAt: 'asc' },
        });
    }
    /**
     * Get user's chat history
     */
    async getUserChatHistory(userId, limit = 50) {
        return await prisma.chatHistory.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
    }
    /**
     * Get popular questions (most asked)
     */
    async getPopularQuestions(limit = 10) {
        const popular = await prisma.chatHistory.groupBy({
            by: ['matchedQuestionId'],
            where: {
                matchedQuestionId: { not: null },
            },
            _count: {
                matchedQuestionId: true,
            },
            orderBy: {
                _count: {
                    matchedQuestionId: 'desc',
                },
            },
            take: limit,
        });
        const questionIds = popular
            .filter((p) => p.matchedQuestionId !== null)
            .map((p) => p.matchedQuestionId);
        const questions = await prisma.knowledgeBase.findMany({
            where: {
                questionId: { in: questionIds },
            },
        });
        return questions.map((q) => ({
            ...q,
            askCount: popular.find((p) => p.matchedQuestionId === q.questionId)?._count
                .matchedQuestionId || 0,
        }));
    }
    /**
     * Search knowledge base by category
     */
    async searchByCategory(category, level) {
        return await knowledge_base_service_1.knowledgeBaseService.searchByCategory(category, level);
    }
    /**
     * Get all categories
     */
    async getCategories() {
        return await knowledge_base_service_1.knowledgeBaseService.getCategories();
    }
}
exports.EnhancedChatbotService = EnhancedChatbotService;
exports.enhancedChatbotService = new EnhancedChatbotService();
