"use strict";
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
exports.newsAggregationService = exports.NewsAggregationService = void 0;
const axios_1 = __importDefault(require("axios"));
const mongodb_1 = require("../db/mongodb");
const cheerio = __importStar(require("cheerio"));
/**
 * VERIFIED NEWS AGGREGATION SERVICE
 *
 * Aggregates mutual fund and market news from verified Indian sources:
 * - Source attribution
 * - Verified sources only
 * - No promotional content
 * - Mobile-friendly summaries
 */
class NewsAggregationService {
    constructor() {
        /**
         * Verified Indian financial news sources
         */
        this.verifiedSources = [
            {
                name: 'Economic Times',
                baseUrl: 'https://economictimes.indiatimes.com',
                rssUrl: 'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms',
                verified: true,
            },
            {
                name: 'LiveMint',
                baseUrl: 'https://www.livemint.com',
                rssUrl: 'https://www.livemint.com/rss/markets',
                verified: true,
            },
            {
                name: 'Business Standard',
                baseUrl: 'https://www.business-standard.com',
                rssUrl: 'https://www.business-standard.com/rss/markets-106.rss',
                verified: true,
            },
            {
                name: 'MoneyControl',
                baseUrl: 'https://www.moneycontrol.com',
                rssUrl: 'https://www.moneycontrol.com/rss/mfnews.xml',
                verified: true,
            },
            {
                name: 'Value Research',
                baseUrl: 'https://www.valueresearchonline.com',
                verified: true,
            },
        ];
    }
    static getInstance() {
        if (!NewsAggregationService.instance) {
            NewsAggregationService.instance = new NewsAggregationService();
        }
        return NewsAggregationService.instance;
    }
    /**
     * Fetch latest news from all verified sources
     */
    async fetchLatestNews(limit = 50) {
        const newsCollection = mongodb_1.mongodb.getCollection('news');
        // Get recent news from DB first (cached)
        const recentNews = await newsCollection
            .find({
            sourceVerified: true,
            isPromotional: false,
        })
            .sort({ publishedAt: -1 })
            .limit(limit)
            .toArray();
        // If we have fresh news (< 1 hour old), return it
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const freshNews = recentNews.filter((news) => news.publishedAt >= oneHourAgo);
        if (freshNews.length >= 10) {
            return recentNews;
        }
        // Otherwise, fetch new news
        await this.aggregateNewsFromAllSources();
        // Return updated news
        return await newsCollection
            .find({
            sourceVerified: true,
            isPromotional: false,
        })
            .sort({ publishedAt: -1 })
            .limit(limit)
            .toArray();
    }
    /**
     * Aggregate news from all sources
     */
    async aggregateNewsFromAllSources() {
        console.log('📰 Aggregating news from verified sources...');
        for (const source of this.verifiedSources) {
            try {
                if (source.rssUrl) {
                    await this.fetchFromRSS(source);
                }
            }
            catch (error) {
                console.error(`Error fetching from ${source.name}:`, error);
            }
        }
        console.log('✅ News aggregation completed');
    }
    /**
     * Fetch news from RSS feed
     */
    async fetchFromRSS(source) {
        try {
            const response = await axios_1.default.get(source.rssUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 15000,
            });
            const $ = cheerio.load(response.data, { xmlMode: true });
            const newsCollection = mongodb_1.mongodb.getCollection('news');
            const items = $('item');
            console.log(`Found ${items.length} items from ${source.name}`);
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const title = $(item).find('title').text();
                const link = $(item).find('link').text();
                const description = $(item).find('description').text();
                const pubDate = $(item).find('pubDate').text();
                if (!title || !link)
                    continue;
                // Generate newsId from URL
                const newsId = this.generateNewsId(link);
                // Check if already exists
                const exists = await newsCollection.findOne({ newsId });
                if (exists)
                    continue;
                // Categorize news
                const category = this.categorizeNews(title, description);
                // Extract related entities
                const related = this.extractRelatedEntities(title + ' ' + description);
                // Create summary
                const summary = this.createSummary(description || title);
                // Check if promotional
                const isPromotional = this.isPromotionalContent(title, description);
                const news = {
                    newsId,
                    title,
                    content: description || title,
                    summary,
                    source: source.name,
                    sourceUrl: link,
                    sourceVerified: source.verified,
                    category,
                    tags: this.extractTags(title + ' ' + description),
                    relatedFunds: related.funds,
                    relatedAMCs: related.amcs,
                    relatedIndices: related.indices,
                    publishedAt: new Date(pubDate),
                    scrapedAt: new Date(),
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    views: 0,
                    isPromotional,
                    isFeatured: false,
                };
                await newsCollection.insertOne(news);
            }
            console.log(`✅ Processed news from ${source.name}`);
        }
        catch (error) {
            console.error(`Error processing RSS from ${source.name}:`, error.message);
        }
    }
    /**
     * Generate unique news ID from URL
     */
    generateNewsId(url) {
        // Extract unique part from URL or generate hash
        const match = url.match(/\/([a-zA-Z0-9-]+)$/);
        if (match) {
            return match[1];
        }
        // Fallback: use hash of URL
        return Buffer.from(url).toString('base64').substring(0, 32);
    }
    /**
     * Categorize news based on content
     */
    categorizeNews(title, description) {
        const text = (title + ' ' + description).toLowerCase();
        if (text.includes('mutual fund') ||
            text.includes('mf') ||
            text.includes('sip')) {
            return 'mutual_fund';
        }
        if (text.includes('nifty') ||
            text.includes('sensex') ||
            text.includes('equity')) {
            return 'equity_market';
        }
        if (text.includes('debt') ||
            text.includes('bond') ||
            text.includes('gilt')) {
            return 'debt_market';
        }
        if (text.includes('gold') ||
            text.includes('silver') ||
            text.includes('commodity')) {
            return 'commodity';
        }
        if (text.includes('amc') || text.includes('asset management')) {
            return 'amc_announcement';
        }
        if (text.includes('sebi') ||
            text.includes('regulation') ||
            text.includes('regulatory')) {
            return 'regulatory';
        }
        return 'general';
    }
    /**
     * Extract tags from text
     */
    extractTags(text) {
        const tags = [];
        const lowerText = text.toLowerCase();
        // Common tags
        const tagPatterns = [
            'nifty',
            'sensex',
            'bank nifty',
            'mutual fund',
            'sip',
            'equity',
            'debt',
            'hybrid',
            'sebi',
            'amc',
            'nav',
            'returns',
            'tax',
            'elss',
            'large cap',
            'mid cap',
            'small cap',
            'gold',
            'etf',
            'index fund',
        ];
        for (const pattern of tagPatterns) {
            if (lowerText.includes(pattern)) {
                tags.push(pattern);
            }
        }
        return [...new Set(tags)]; // Remove duplicates
    }
    /**
     * Extract related entities (funds, AMCs, indices)
     */
    extractRelatedEntities(text) {
        const lowerText = text.toLowerCase();
        // Extract AMCs
        const amcs = [];
        const amcPatterns = [
            'hdfc',
            'icici',
            'sbi',
            'axis',
            'kotak',
            'nippon',
            'aditya birla',
        ];
        for (const amc of amcPatterns) {
            if (lowerText.includes(amc)) {
                amcs.push(amc);
            }
        }
        // Extract indices
        const indices = [];
        const indexPatterns = ['nifty 50', 'sensex', 'bank nifty', 'nifty next 50'];
        for (const index of indexPatterns) {
            if (lowerText.includes(index)) {
                indices.push(index);
            }
        }
        return {
            funds: [], // TODO: Match against fund names in DB
            amcs,
            indices,
        };
    }
    /**
     * Create mobile-friendly summary (max 150 characters)
     */
    createSummary(content) {
        // Remove HTML tags
        const text = content.replace(/<[^>]*>/g, '');
        // Trim to 150 characters
        if (text.length <= 150) {
            return text;
        }
        // Find last complete sentence within 150 chars
        const trimmed = text.substring(0, 150);
        const lastPeriod = trimmed.lastIndexOf('.');
        const lastSpace = trimmed.lastIndexOf(' ');
        if (lastPeriod > 100) {
            return trimmed.substring(0, lastPeriod + 1);
        }
        else if (lastSpace > 100) {
            return trimmed.substring(0, lastSpace) + '...';
        }
        return trimmed + '...';
    }
    /**
     * Check if content is promotional
     */
    isPromotionalContent(title, description) {
        const text = (title + ' ' + description).toLowerCase();
        const promotionalKeywords = [
            'invest now',
            'best investment',
            'hurry',
            'limited time',
            'special offer',
            'guaranteed returns',
            'risk-free',
            'assured returns',
        ];
        return promotionalKeywords.some((keyword) => text.includes(keyword));
    }
    /**
     * Get news by category
     */
    async getNewsByCategory(category, limit = 20) {
        const newsCollection = mongodb_1.mongodb.getCollection('news');
        return await newsCollection
            .find({
            category,
            sourceVerified: true,
            isPromotional: false,
        })
            .sort({ publishedAt: -1 })
            .limit(limit)
            .toArray();
    }
    /**
     * Search news
     */
    async searchNews(query, limit = 20) {
        const newsCollection = mongodb_1.mongodb.getCollection('news');
        return await newsCollection
            .find({
            $text: { $search: query },
            sourceVerified: true,
            isPromotional: false,
        })
            .sort({ publishedAt: -1 })
            .limit(limit)
            .toArray();
    }
}
exports.NewsAggregationService = NewsAggregationService;
exports.newsAggregationService = NewsAggregationService.getInstance();
