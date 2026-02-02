"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.newsService = exports.NewsService = void 0;
// Using native fetch available in Node.js 18+
const db_1 = require("../db");
class NewsService {
    constructor() {
        this.apiKey = process.env.NEWSDATA_API_KEY || '';
        this.baseUrl = 'https://newsdata.io/api/1/news';
    }
    async ingestNews(category = 'business', keywords = [
        'mutual fund',
        'investment',
        'portfolio',
        'equity',
        'debt',
    ]) {
        const errors = [];
        let processed = 0;
        try {
            if (!this.apiKey) {
                throw new Error('NEWSDATA_API_KEY is not configured');
            }
            console.log(`Starting news ingestion for category: ${category}`);
            const keywordParam = keywords.join(',');
            const url = `${this.baseUrl}?apikey=${this.apiKey}&q=${encodeURIComponent(keywordParam)}&language=en&country=in&category=business`;
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`News API error: ${response.status} ${response.statusText}`);
            }
            const data = (await response.json());
            if (data.status !== 'success') {
                throw new Error('News API returned error status');
            }
            console.log(`Fetched ${data.results.length} news articles`);
            // Process articles in batches
            const batchSize = 10;
            for (let i = 0; i < data.results.length; i += batchSize) {
                const batch = data.results.slice(i, i + batchSize);
                try {
                    await this.processBatch(batch, category);
                    processed += batch.length;
                    console.log(`Processed news batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(data.results.length / batchSize)}`);
                }
                catch (error) {
                    const errorMsg = `News batch ${Math.floor(i / batchSize) + 1} failed: ${error}`;
                    console.error(errorMsg);
                    errors.push(errorMsg);
                }
            }
            console.log(`News ingestion completed. Processed: ${processed}, Errors: ${errors.length}`);
            return { processed, errors };
        }
        catch (error) {
            console.error('News ingestion failed:', error);
            errors.push(`News ingestion failed: ${error}`);
            return { processed, errors };
        }
    }
    async processBatch(articles, category) {
        for (const article of articles) {
            try {
                await this.processArticle(article, category);
            }
            catch (error) {
                console.warn(`Failed to process article ${article.article_id}:`, error);
            }
        }
    }
    async processArticle(article, category) {
        // Check if article already exists
        const existing = await db_1.prisma.news.findFirst({
            where: {
                title: article.title,
                source: article.source_id,
            },
        });
        if (existing) {
            console.log(`Article already exists: ${article.title}`);
            return;
        }
        // Parse publish date
        const publishedAt = new Date(article.pubDate);
        if (isNaN(publishedAt.getTime())) {
            console.warn(`Invalid publish date for article: ${article.title}`);
            return;
        }
        // Extract relevant tags
        const tags = this.extractTags(article.title, article.description || '', article.content || '');
        // Create news record
        await db_1.prisma.news.create({
            data: {
                title: article.title.slice(0, 500), // Limit title length
                content: article.content || article.description || '',
                source: article.source_id,
                category: this.mapCategory(category),
                tags,
                publishedAt,
            },
        });
        console.log(`Processed news article: ${article.title}`);
    }
    extractTags(title, description, content) {
        const text = `${title} ${description} ${content}`.toLowerCase();
        const financialTerms = [
            'mutual fund',
            'sip',
            'equity',
            'debt',
            'hybrid',
            'nifty',
            'sensex',
            'nav',
            'portfolio',
            'investment',
            'dividend',
            'returns',
            'risk',
            'aum',
            'expense ratio',
            'large cap',
            'mid cap',
            'small cap',
            'elss',
            'liquid fund',
        ];
        return financialTerms.filter((term) => text.includes(term));
    }
    mapCategory(category) {
        const categoryMap = {
            business: 'MARKET',
            finance: 'MARKET',
            economy: 'MARKET',
            policy: 'REGULATORY',
            government: 'REGULATORY',
        };
        return categoryMap[category.toLowerCase()] || 'GENERAL';
    }
    async getRecentNews(limit = 10) {
        try {
            const news = await db_1.prisma.news.findMany({
                orderBy: { publishedAt: 'desc' },
                take: limit,
                select: {
                    id: true,
                    title: true,
                    source: true,
                    category: true,
                    tags: true,
                    publishedAt: true,
                },
            });
            return news;
        }
        catch (error) {
            console.error('Error fetching recent news:', error);
            return [];
        }
    }
}
exports.NewsService = NewsService;
exports.newsService = new NewsService();
