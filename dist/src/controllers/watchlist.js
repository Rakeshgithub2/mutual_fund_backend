"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWatchlist = exports.removeFromWatchlist = exports.addToWatchlist = void 0;
const zod_1 = require("zod");
const db_1 = require("../db");
const response_1 = require("../utils/response");
const cacheService_1 = require("../services/cacheService");
// import { emitWatchlistUpdate } from '../services/socket';
const addWatchlistSchema = zod_1.z.object({
    fundId: zod_1.z.string().cuid(),
});
const addToWatchlist = async (req, res) => {
    try {
        const { fundId } = addWatchlistSchema.parse(req.body);
        // Check if fund exists
        const fund = await db_1.prisma.fund.findUnique({
            where: { id: fundId },
        });
        if (!fund) {
            res.status(404).json({ error: 'Fund not found' });
            return;
        }
        // Check if already in watchlist
        const existingItem = await db_1.prisma.watchlistItem.findUnique({
            where: {
                userId_fundId: {
                    userId: req.user.id,
                    fundId,
                },
            },
        });
        if (existingItem) {
            res.status(409).json({ error: 'Fund already in watchlist' });
            return;
        }
        // Add to watchlist
        const watchlistItem = await db_1.prisma.watchlistItem.create({
            data: {
                userId: req.user.id,
                fundId,
            },
            include: {
                fund: {
                    select: {
                        id: true,
                        amfiCode: true,
                        name: true,
                        type: true,
                        category: true,
                        subCategory: true,
                    },
                },
            },
        });
        // Invalidate user's watchlist cache
        const cacheKey = cacheService_1.CacheService.keys.userWatchlist(req.user.id);
        await cacheService_1.cacheService.del(cacheKey);
        // Emit real-time update to user's socket (if Socket.IO is installed)
        try {
            // emitWatchlistUpdate(req.user!.id, {
            //   type: 'added',
            //   item: watchlistItem,
            //   timestamp: new Date(),
            // });
        }
        catch (error) {
            console.log('ℹ️ Socket.IO not available, skipping real-time update');
        }
        res
            .status(201)
            .json((0, response_1.formatResponse)(watchlistItem, 'Fund added to watchlist successfully', 201));
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({
                error: 'Validation error',
                details: error.errors,
            });
            return;
        }
        console.error('Add to watchlist error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.addToWatchlist = addToWatchlist;
const removeFromWatchlist = async (req, res) => {
    try {
        const { id } = req.params;
        // Check if watchlist item exists and belongs to user
        const watchlistItem = await db_1.prisma.watchlistItem.findUnique({
            where: { id },
        });
        if (!watchlistItem || watchlistItem.userId !== req.user.id) {
            res.status(404).json({ error: 'Watchlist item not found' });
            return;
        }
        // Remove from watchlist
        await db_1.prisma.watchlistItem.delete({
            where: { id },
        });
        // Invalidate user's watchlist cache
        const cacheKey = cacheService_1.CacheService.keys.userWatchlist(req.user.id);
        await cacheService_1.cacheService.del(cacheKey);
        // Emit real-time update to user's socket (if Socket.IO is installed)
        try {
            // emitWatchlistUpdate(req.user!.id, {
            //   type: 'removed',
            //   itemId: id,
            //   timestamp: new Date(),
            // });
        }
        catch (error) {
            console.log('ℹ️ Socket.IO not available, skipping real-time update');
        }
        res.json((0, response_1.formatResponse)(null, 'Fund removed from watchlist successfully'));
    }
    catch (error) {
        console.error('Remove from watchlist error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.removeFromWatchlist = removeFromWatchlist;
const getWatchlist = async (req, res) => {
    try {
        // Check cache first
        const cacheKey = cacheService_1.CacheService.keys.userWatchlist(req.user.id);
        const cachedData = await cacheService_1.cacheService.getJSON(cacheKey);
        if (cachedData) {
            res.json(cachedData);
            return;
        }
        const watchlistItems = await db_1.prisma.watchlistItem.findMany({
            where: { userId: req.user.id },
            include: {
                fund: {
                    select: {
                        id: true,
                        amfiCode: true,
                        name: true,
                        type: true,
                        category: true,
                        subCategory: true,
                        expenseRatio: true,
                        performances: {
                            orderBy: { date: 'desc' },
                            take: 1,
                            select: { nav: true, date: true },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        const response = (0, response_1.formatResponse)(watchlistItems, 'Watchlist retrieved successfully');
        // Cache the response
        await cacheService_1.cacheService.setJSON(cacheKey, response, cacheService_1.CacheService.TTL.USER_WATCHLIST);
        res.json(response);
    }
    catch (error) {
        console.error('Get watchlist error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getWatchlist = getWatchlist;
