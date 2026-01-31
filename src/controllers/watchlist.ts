import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { AuthRequest } from '../middlewares/auth';
import { formatResponse } from '../utils/response';
import { cacheService, CacheService } from '../services/cacheService';
// import { emitWatchlistUpdate } from '../services/socket';

const addWatchlistSchema = z.object({
  fundId: z.string().cuid(),
});

export const addToWatchlist = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { fundId } = addWatchlistSchema.parse(req.body);

    // Check if fund exists
    const fund = await prisma.fund.findUnique({
      where: { id: fundId },
    });

    if (!fund) {
      res.status(404).json({ error: 'Fund not found' });
      return;
    }

    // Check if already in watchlist
    const existingItem = await prisma.watchlistItem.findUnique({
      where: {
        userId_fundId: {
          userId: req.user!.id,
          fundId,
        },
      },
    });

    if (existingItem) {
      res.status(409).json({ error: 'Fund already in watchlist' });
      return;
    }

    // Add to watchlist
    const watchlistItem = await prisma.watchlistItem.create({
      data: {
        userId: req.user!.id,
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
    const cacheKey = CacheService.keys.userWatchlist(req.user!.id);
    await cacheService.del(cacheKey);

    // Emit real-time update to user's socket (if Socket.IO is installed)
    try {
      // emitWatchlistUpdate(req.user!.id, {
      //   type: 'added',
      //   item: watchlistItem,
      //   timestamp: new Date(),
      // });
    } catch (error) {
      console.log('ℹ️ Socket.IO not available, skipping real-time update');
    }

    res
      .status(201)
      .json(
        formatResponse(
          watchlistItem,
          'Fund added to watchlist successfully',
          201
        )
      );
  } catch (error) {
    if (error instanceof z.ZodError) {
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

export const removeFromWatchlist = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if watchlist item exists and belongs to user
    const watchlistItem = await prisma.watchlistItem.findUnique({
      where: { id },
    });

    if (!watchlistItem || watchlistItem.userId !== req.user!.id) {
      res.status(404).json({ error: 'Watchlist item not found' });
      return;
    }

    // Remove from watchlist
    await prisma.watchlistItem.delete({
      where: { id },
    });

    // Invalidate user's watchlist cache
    const cacheKey = CacheService.keys.userWatchlist(req.user!.id);
    await cacheService.del(cacheKey);

    // Emit real-time update to user's socket (if Socket.IO is installed)
    try {
      // emitWatchlistUpdate(req.user!.id, {
      //   type: 'removed',
      //   itemId: id,
      //   timestamp: new Date(),
      // });
    } catch (error) {
      console.log('ℹ️ Socket.IO not available, skipping real-time update');
    }

    res.json(formatResponse(null, 'Fund removed from watchlist successfully'));
  } catch (error) {
    console.error('Remove from watchlist error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getWatchlist = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    // Check cache first
    const cacheKey = CacheService.keys.userWatchlist(req.user!.id);
    const cachedData = await cacheService.getJSON(cacheKey);
    if (cachedData) {
      res.json(cachedData);
      return;
    }

    const watchlistItems = await prisma.watchlistItem.findMany({
      where: { userId: req.user!.id },
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

    const response = formatResponse(
      watchlistItems,
      'Watchlist retrieved successfully'
    );

    // Cache the response
    await cacheService.setJSON(
      cacheKey,
      response,
      CacheService.TTL.USER_WATCHLIST
    );

    res.json(response);
  } catch (error) {
    console.error('Get watchlist error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
