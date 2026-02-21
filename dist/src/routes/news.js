"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const news_controller_1 = require("../controllers/news.controller");
const router = (0, express_1.Router)();
/**
 * @route   GET /api/news
 * @desc    Get latest verified news
 * @access  Public
 */
router.get('/', news_controller_1.getLatestNews);
/**
 * @route   GET /api/news/category/:category
 * @desc    Get news by category
 * @access  Public
 */
router.get('/category/:category', news_controller_1.getNewsByCategory);
/**
 * @route   GET /api/news/search
 * @desc    Search news
 * @access  Public
 */
router.get('/search', news_controller_1.searchNews);
/**
 * @route   POST /api/news/refresh
 * @desc    Refresh news from all sources (admin)
 * @access  Admin
 */
router.post('/refresh', news_controller_1.refreshNews);
exports.default = router;
