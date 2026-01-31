import { Router } from 'express';
import {
  getLatestNews,
  getNewsByCategory,
  searchNews,
  refreshNews,
} from '../controllers/news.controller';

const router = Router();

/**
 * @route   GET /api/news
 * @desc    Get latest verified news
 * @access  Public
 */
router.get('/', getLatestNews);

/**
 * @route   GET /api/news/category/:category
 * @desc    Get news by category
 * @access  Public
 */
router.get('/category/:category', getNewsByCategory);

/**
 * @route   GET /api/news/search
 * @desc    Search news
 * @access  Public
 */
router.get('/search', searchNews);

/**
 * @route   POST /api/news/refresh
 * @desc    Refresh news from all sources (admin)
 * @access  Admin
 */
router.post('/refresh', refreshNews);

export default router;
