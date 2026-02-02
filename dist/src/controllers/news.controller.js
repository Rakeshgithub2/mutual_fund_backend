"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshNews = exports.searchNews = exports.getNewsByCategory = exports.getLatestNews = void 0;
const newsAggregation_service_1 = require("../services/newsAggregation.service");
/**
 * News Controller
 *
 * Endpoints:
 * - GET /api/news - Get latest news
 * - GET /api/news/category/:category - Get news by category
 * - GET /api/news/search - Search news
 * - POST /api/news/refresh - Refresh news (admin)
 */
/**
 * Get latest news
 * @route GET /api/news
 */
const getLatestNews = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const news = await newsAggregation_service_1.newsAggregationService.fetchLatestNews(limit);
        return res.json({
            success: true,
            message: 'Latest news retrieved successfully',
            data: news,
            metadata: {
                count: news.length,
                verifiedOnly: true,
                nonPromotional: true,
            },
        });
    }
    catch (error) {
        console.error('Error fetching latest news:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch news',
            error: error.message,
        });
    }
};
exports.getLatestNews = getLatestNews;
/**
 * Get news by category
 * @route GET /api/news/category/:category
 */
const getNewsByCategory = async (req, res) => {
    try {
        const { category } = req.params;
        const limit = parseInt(req.query.limit) || 20;
        // Validate category
        const validCategories = [
            'mutual_fund',
            'equity_market',
            'debt_market',
            'commodity',
            'amc_announcement',
            'regulatory',
            'general',
        ];
        if (!validCategories.includes(category)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid category',
                validCategories,
            });
        }
        const news = await newsAggregation_service_1.newsAggregationService.getNewsByCategory(category, limit);
        return res.json({
            success: true,
            message: `${category} news retrieved successfully`,
            data: news,
            metadata: {
                count: news.length,
                category,
            },
        });
    }
    catch (error) {
        console.error(`Error fetching news for category ${req.params.category}:`, error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch news',
            error: error.message,
        });
    }
};
exports.getNewsByCategory = getNewsByCategory;
/**
 * Search news
 * @route GET /api/news/search
 */
const searchNews = async (req, res) => {
    try {
        const query = req.query.q;
        const limit = parseInt(req.query.limit) || 20;
        if (!query) {
            return res.status(400).json({
                success: false,
                message: 'Search query is required',
            });
        }
        const news = await newsAggregation_service_1.newsAggregationService.searchNews(query, limit);
        return res.json({
            success: true,
            message: 'Search results retrieved successfully',
            data: news,
            metadata: {
                count: news.length,
                query,
            },
        });
    }
    catch (error) {
        console.error('Error searching news:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to search news',
            error: error.message,
        });
    }
};
exports.searchNews = searchNews;
/**
 * Refresh news from all sources (admin endpoint)
 * @route POST /api/news/refresh
 */
const refreshNews = async (req, res) => {
    try {
        await newsAggregation_service_1.newsAggregationService.aggregateNewsFromAllSources();
        return res.json({
            success: true,
            message: 'News refreshed successfully from all verified sources',
        });
    }
    catch (error) {
        console.error('Error refreshing news:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to refresh news',
            error: error.message,
        });
    }
};
exports.refreshNews = refreshNews;
