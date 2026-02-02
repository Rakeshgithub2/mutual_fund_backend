"use strict";
/**
 * Knowledge Base Service
 * Matches user queries with knowledge base entries using similarity
 * Provides calculation formulas for financial questions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculationFormulas = void 0;
exports.seedKnowledgeBase = seedKnowledgeBase;
exports.findBestMatch = findBestMatch;
exports.extractMultipleQuestions = extractMultipleQuestions;
exports.findMultipleMatches = findMultipleMatches;
exports.getQuestionsByCategory = getQuestionsByCategory;
exports.getQuestionsByLevel = getQuestionsByLevel;
exports.getQuestionById = getQuestionById;
exports.searchQuestions = searchQuestions;
exports.formatKnowledgeResponse = formatKnowledgeResponse;
exports.isCalculationQuery = isCalculationQuery;
exports.parseCalculationQuery = parseCalculationQuery;
exports.performCalculation = performCalculation;
const mongodb_1 = require("../db/mongodb");
const knowledge_base_1000_complete_1 = require("../data/knowledge-base-1000-complete");
const COLLECTION_NAME = 'knowledge_base';
/**
 * Seed the knowledge base to MongoDB
 */
async function seedKnowledgeBase() {
    try {
        // Check if MongoDB is connected
        if (!mongodb_1.mongodb.isConnected()) {
            console.log('⏸️  Knowledge base seeding skipped - MongoDB not connected yet');
            return;
        }
        const collection = mongodb_1.mongodb.getCollection(COLLECTION_NAME);
        // Check if already seeded
        const count = await collection.countDocuments();
        if (count > 0) {
            console.log(`📚 Knowledge base already seeded with ${count} entries`);
            return;
        }
        // Insert all knowledge entries
        await collection.insertMany(knowledge_base_1000_complete_1.knowledgeBase);
        // Create text index for searching
        await collection.createIndex({
            question: 'text',
            keywords: 'text',
            definition: 'text',
            points: 'text',
        }, {
            weights: {
                question: 10,
                keywords: 8,
                definition: 5,
                points: 3,
            },
            name: 'knowledge_search_index',
        });
        console.log(`✅ Knowledge base seeded with ${knowledge_base_1000_complete_1.knowledgeBase.length} entries`);
    }
    catch (error) {
        console.error('❌ Error seeding knowledge base:', error);
        throw error;
    }
}
/**
 * Calculate text similarity score between two strings
 */
function calculateSimilarity(str1, str2) {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    // Exact match
    if (s1 === s2)
        return 1.0;
    // Contains full query
    if (s1.includes(s2) || s2.includes(s1))
        return 0.8;
    // Word overlap
    const words1 = s1.split(/\s+/).filter((w) => w.length > 2);
    const words2 = s2.split(/\s+/).filter((w) => w.length > 2);
    let matchCount = 0;
    for (const word of words1) {
        if (words2.some((w) => w.includes(word) || word.includes(w))) {
            matchCount++;
        }
    }
    const maxWords = Math.max(words1.length, words2.length);
    if (maxWords === 0)
        return 0;
    return matchCount / maxWords;
}
/**
 * Find best match using in-memory knowledge base (fallback when MongoDB not available)
 */
function findBestMatchInMemory(query) {
    const normalizedQuery = query.toLowerCase().trim();
    let bestMatch = null;
    let bestScore = 0;
    for (const entry of knowledge_base_1000_complete_1.knowledgeBase) {
        // Check question similarity
        const questionScore = calculateSimilarity(normalizedQuery, entry.question);
        // Check keyword matches
        let keywordScore = 0;
        for (const keyword of entry.keywords) {
            const kwScore = calculateSimilarity(normalizedQuery, keyword);
            keywordScore = Math.max(keywordScore, kwScore);
        }
        // Check definition similarity
        const defScore = calculateSimilarity(normalizedQuery, entry.definition);
        // Calculate overall score
        const overallScore = Math.max(questionScore * 0.7 + keywordScore * 0.3, defScore * 0.4);
        if (overallScore > bestScore) {
            bestScore = overallScore;
            bestMatch = entry;
        }
    }
    // Get related questions
    const relatedIds = bestMatch?.relatedQuestions || [];
    const related = knowledge_base_1000_complete_1.knowledgeBase.filter((e) => relatedIds.includes(e.id));
    return {
        entry: bestMatch,
        score: bestScore,
        related,
    };
}
/**
 * Find the best matching knowledge entry for a user query
 */
async function findBestMatch(query) {
    try {
        // If MongoDB is not connected, use in-memory search
        if (!mongodb_1.mongodb.isConnected()) {
            return findBestMatchInMemory(query);
        }
        const collection = mongodb_1.mongodb.getCollection(COLLECTION_NAME);
        const normalizedQuery = query.toLowerCase().trim();
        // Try MongoDB text search first
        const textSearchResults = await collection
            .find({ $text: { $search: normalizedQuery } })
            .project({ score: { $meta: 'textScore' } })
            .sort({ score: { $meta: 'textScore' } })
            .limit(5)
            .toArray();
        if (textSearchResults.length > 0 &&
            textSearchResults[0].score > 1.5) {
            const bestMatch = textSearchResults[0];
            // Get related questions
            const relatedIds = bestMatch.relatedQuestions || [];
            const related = relatedIds.length > 0
                ? (await collection
                    .find({ id: { $in: relatedIds } })
                    .toArray())
                : [];
            return {
                entry: bestMatch,
                score: Math.min(textSearchResults[0].score / 10, 1),
                related,
            };
        }
        // Fallback: Manual keyword matching
        const allEntries = (await collection
            .find({})
            .toArray());
        let bestMatch = null;
        let bestScore = 0;
        for (const entry of allEntries) {
            // Check question similarity
            const questionScore = calculateSimilarity(normalizedQuery, entry.question);
            // Check keyword matches
            let keywordScore = 0;
            for (const keyword of entry.keywords) {
                const kwScore = calculateSimilarity(normalizedQuery, keyword);
                if (kwScore > keywordScore)
                    keywordScore = kwScore;
            }
            // Check definition similarity
            const defScore = calculateSimilarity(normalizedQuery, entry.definition) * 0.5;
            // Combined score
            const totalScore = Math.max(questionScore, keywordScore, defScore);
            if (totalScore > bestScore) {
                bestScore = totalScore;
                bestMatch = entry;
            }
        }
        // Get related questions
        let related = [];
        if (bestMatch && bestMatch.relatedQuestions) {
            related = allEntries.filter((e) => bestMatch.relatedQuestions?.includes(e.id));
        }
        return {
            entry: bestScore >= 0.3 ? bestMatch : null,
            score: bestScore,
            related,
        };
    }
    catch (error) {
        console.error('Error finding knowledge match:', error);
        return { entry: null, score: 0, related: [] };
    }
}
/**
 * Extract multiple questions from user query
 */
function extractMultipleQuestions(query) {
    // Split by common separators
    const separators = [
        /\?\s+/g, // Question mark followed by space
        /\band\b/gi, // " and "
        /,\s+/g, // Comma followed by space
        /\n/g, // New line
    ];
    let questions = [query];
    for (const separator of separators) {
        const newQuestions = [];
        for (const q of questions) {
            const splits = q
                .split(separator)
                .map((s) => s.trim())
                .filter((s) => s.length > 10);
            newQuestions.push(...splits);
        }
        if (newQuestions.length > questions.length) {
            questions = newQuestions;
        }
    }
    // Clean up and filter
    questions = questions
        .map((q) => {
        q = q.trim();
        if (!q.endsWith('?'))
            q += '?';
        return q;
    })
        .filter((q, index, self) => self.indexOf(q) === index) // Remove duplicates
        .slice(0, 5); // Limit to 5 questions max
    return questions;
}
/**
 * Find multiple matches for multi-question queries
 */
async function findMultipleMatches(questions) {
    const matches = [];
    for (const question of questions) {
        const result = await findBestMatch(question);
        if (result.entry && result.score >= 0.3) {
            // Slightly lower threshold for multi-questions
            matches.push({ entry: result.entry, score: result.score });
        }
    }
    return matches;
}
/**
 * Get all questions by category
 */
async function getQuestionsByCategory(category) {
    if (!mongodb_1.mongodb.isConnected()) {
        return knowledge_base_1000_complete_1.knowledgeBase.filter((e) => e.category.toLowerCase().includes(category.toLowerCase()));
    }
    const collection = mongodb_1.mongodb.getCollection(COLLECTION_NAME);
    return (await collection
        .find({ category: { $regex: new RegExp(category, 'i') } })
        .toArray());
}
/**
 * Get all questions by level
 */
async function getQuestionsByLevel(level) {
    if (!mongodb_1.mongodb.isConnected()) {
        return knowledge_base_1000_complete_1.knowledgeBase.filter((e) => e.level === level);
    }
    const collection = mongodb_1.mongodb.getCollection(COLLECTION_NAME);
    return (await collection
        .find({ level })
        .toArray());
}
/**
 * Get a specific question by ID
 */
async function getQuestionById(id) {
    if (!mongodb_1.mongodb.isConnected()) {
        return knowledge_base_1000_complete_1.knowledgeBase.find((e) => e.id === id) || null;
    }
    const collection = mongodb_1.mongodb.getCollection(COLLECTION_NAME);
    return (await collection.findOne({ id }));
}
/**
 * Search questions by keyword
 */
async function searchQuestions(query, limit = 10) {
    if (!mongodb_1.mongodb.isConnected()) {
        const queryLower = query.toLowerCase();
        return knowledge_base_1000_complete_1.knowledgeBase
            .filter((e) => e.question.toLowerCase().includes(queryLower) ||
            e.keywords.some((k) => k.toLowerCase().includes(queryLower)) ||
            e.definition.toLowerCase().includes(queryLower))
            .slice(0, limit);
    }
    const collection = mongodb_1.mongodb.getCollection(COLLECTION_NAME);
    // Try text search
    const results = await collection
        .find({ $text: { $search: query } })
        .project({ score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' } })
        .limit(limit)
        .toArray();
    if (results.length > 0) {
        return results;
    }
    // Fallback to regex search
    const regex = new RegExp(query.split(/\s+/).join('|'), 'i');
    return (await collection
        .find({
        $or: [{ question: regex }, { keywords: regex }, { definition: regex }],
    })
        .limit(limit)
        .toArray());
}
/**
 * Format knowledge entry as readable response
 */
function formatKnowledgeResponse(entry) {
    let response = `**${entry.question}**\n\n`;
    response += `${entry.definition}\n\n`;
    // Add bullet points
    entry.points.forEach((point) => {
        response += `• ${point}\n`;
    });
    // Add formula if present
    if (entry.formula) {
        response += `\n📐 **Formula:** ${entry.formula}\n`;
    }
    return response;
}
/**
 * Financial Calculation Formulas
 */
exports.calculationFormulas = {
    // SIP Future Value
    sipFutureValue: (monthlyAmount, annualRate, years) => {
        const monthlyRate = annualRate / 12 / 100;
        const months = years * 12;
        const fv = monthlyAmount *
            ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) *
            (1 + monthlyRate);
        return Math.round(fv);
    },
    // Lump Sum Future Value
    lumpSumFutureValue: (principal, annualRate, years) => {
        const fv = principal * Math.pow(1 + annualRate / 100, years);
        return Math.round(fv);
    },
    // CAGR Calculation
    cagr: (beginValue, endValue, years) => {
        const cagr = (Math.pow(endValue / beginValue, 1 / years) - 1) * 100;
        return Math.round(cagr * 100) / 100;
    },
    // SIP Required for Target
    sipForTarget: (targetAmount, annualRate, years) => {
        const monthlyRate = annualRate / 12 / 100;
        const months = years * 12;
        const sip = targetAmount /
            (((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) *
                (1 + monthlyRate));
        return Math.round(sip);
    },
    // Step-up SIP Future Value
    stepUpSipFutureValue: (startAmount, stepUpPercent, annualRate, years) => {
        let totalValue = 0;
        let currentSip = startAmount;
        const monthlyRate = annualRate / 12 / 100;
        for (let year = 1; year <= years; year++) {
            // Value of this year's SIPs
            const remainingMonths = (years - year + 1) * 12;
            for (let month = 1; month <= 12; month++) {
                const monthsRemaining = remainingMonths - month + 1;
                totalValue += currentSip * Math.pow(1 + monthlyRate, monthsRemaining);
            }
            // Step up for next year
            currentSip = currentSip * (1 + stepUpPercent / 100);
        }
        return Math.round(totalValue);
    },
    // SWP Monthly Withdrawal (Sustainable)
    swpMonthlyWithdrawal: (corpus, annualWithdrawalRate) => {
        return Math.round((corpus * (annualWithdrawalRate / 100)) / 12);
    },
    // Real Return (after inflation)
    realReturn: (nominalReturn, inflation) => {
        const real = ((1 + nominalReturn / 100) / (1 + inflation / 100) - 1) * 100;
        return Math.round(real * 100) / 100;
    },
    // Tax on LTCG (Equity)
    ltcgTax: (gain, exemption = 125000) => {
        const taxableGain = Math.max(0, gain - exemption);
        return Math.round(taxableGain * 0.125); // 12.5% LTCG
    },
    // Tax on STCG (Equity)
    stcgTax: (gain) => {
        return Math.round(gain * 0.2); // 20% STCG
    },
};
/**
 * Check if query is asking for calculation
 */
function isCalculationQuery(query) {
    const calcKeywords = [
        'calculate',
        'calculator',
        'how much',
        'what will be',
        'if i invest',
        'how many years',
        'how long',
        'need for',
        'required for',
        'to get',
        'to reach',
        'for 1 crore',
        'sip for',
        'amount needed',
        'what sip',
    ];
    const lowerQuery = query.toLowerCase();
    return calcKeywords.some((kw) => lowerQuery.includes(kw));
}
/**
 * Parse calculation parameters from query
 */
function parseCalculationQuery(query) {
    const lowerQuery = query.toLowerCase();
    // Extract numbers from query
    const numbers = query
        .match(/\d+(?:,\d+)*(?:\.\d+)?/g)
        ?.map((n) => parseFloat(n.replace(/,/g, ''))) || [];
    // SIP for target amount
    if (lowerQuery.includes('sip') &&
        (lowerQuery.includes('crore') || lowerQuery.includes('lakh'))) {
        let target = 0;
        if (lowerQuery.includes('crore')) {
            target = (numbers.find((n) => n <= 100) || 1) * 10000000;
        }
        else if (lowerQuery.includes('lakh')) {
            target = (numbers.find((n) => n <= 1000) || 10) * 100000;
        }
        const years = numbers.find((n) => n >= 5 && n <= 40) || 20;
        const rate = numbers.find((n) => n >= 8 && n <= 20) || 12;
        return {
            type: 'sipForTarget',
            params: { target, years, rate },
        };
    }
    // Future value of SIP
    if (lowerQuery.includes('sip') &&
        (lowerQuery.includes('become') ||
            lowerQuery.includes('grow') ||
            lowerQuery.includes('value'))) {
        const monthlyAmount = numbers.find((n) => n >= 100 && n <= 1000000) || 10000;
        const years = numbers.find((n) => n >= 1 && n <= 50 && n !== monthlyAmount) || 15;
        const rate = numbers.find((n) => n >= 5 && n <= 25 && n !== monthlyAmount && n !== years) || 12;
        return {
            type: 'sipFutureValue',
            params: { monthlyAmount, years, rate },
        };
    }
    // CAGR calculation
    if (lowerQuery.includes('cagr') || lowerQuery.includes('return')) {
        if (numbers.length >= 3) {
            return {
                type: 'cagr',
                params: {
                    beginValue: numbers[0],
                    endValue: numbers[1],
                    years: numbers[2],
                },
            };
        }
    }
    return null;
}
/**
 * Perform financial calculation
 */
function performCalculation(type, params) {
    switch (type) {
        case 'sipForTarget': {
            const monthlyRequired = exports.calculationFormulas.sipForTarget(params.target, params.rate, params.years);
            const totalInvested = monthlyRequired * params.years * 12;
            const wealthGained = params.target - totalInvested;
            return `📊 **SIP Calculator Result**

To accumulate **₹${(params.target / 10000000).toFixed(2)} Cr** in **${params.years} years** at **${params.rate}% return**:

• **Monthly SIP Required:** ₹${monthlyRequired.toLocaleString('en-IN')}
• **Total Investment:** ₹${totalInvested.toLocaleString('en-IN')}
• **Wealth Gained:** ₹${wealthGained.toLocaleString('en-IN')}

💡 _Start early, stay invested, and let compounding work for you!_`;
        }
        case 'sipFutureValue': {
            const futureValue = exports.calculationFormulas.sipFutureValue(params.monthlyAmount, params.rate, params.years);
            const totalInvested = params.monthlyAmount * params.years * 12;
            const wealthGained = futureValue - totalInvested;
            return `📊 **SIP Growth Calculator**

If you invest **₹${params.monthlyAmount.toLocaleString('en-IN')}/month** for **${params.years} years** at **${params.rate}% return**:

• **Future Value:** ₹${futureValue.toLocaleString('en-IN')}
• **Total Investment:** ₹${totalInvested.toLocaleString('en-IN')}
• **Wealth Gained:** ₹${wealthGained.toLocaleString('en-IN')}
• **Returns Multiplier:** ${(futureValue / totalInvested).toFixed(1)}x

💡 _This is the power of compounding!_`;
        }
        case 'cagr': {
            const cagrValue = exports.calculationFormulas.cagr(params.beginValue, params.endValue, params.years);
            return `📊 **CAGR Calculator**

• **Initial Value:** ₹${params.beginValue.toLocaleString('en-IN')}
• **Final Value:** ₹${params.endValue.toLocaleString('en-IN')}
• **Time Period:** ${params.years} years

**CAGR = ${cagrValue}% per year**

💡 _CAGR shows the consistent annual growth rate._`;
        }
        default:
            return 'Sorry, I could not perform that calculation.';
    }
}
