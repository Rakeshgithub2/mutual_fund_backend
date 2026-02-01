import { Router } from 'express';
import authRoutes from './auth.routes';
import fundsRoutes from './funds';
import fundsQuickRoutes from './funds-quick';
import fundManagersRoutes from './fundManagers';
import usersRoutes from './users';
import watchlistRoutes from './watchlist';
import portfolioRoutes from './portfolio';
import investmentRoutes from './investments';
import kycRoutes from './kyc';
import marketIndicesRoutes from './marketIndices';
import newsRoutes from './news';
import rankingsRoutes from './rankings';
import governanceRoutes from './governance';
import adminRoutes from './admin';
import calculatorRoutes from './calculator';
import comparisonRoutes from './comparison';
import taxRoutes from './tax';
import aiRoutes from './ai';
import suggestRoutes from './suggest';
import feedbackRoutes from './feedback';
import v2Routes from './v2.routes';
import searchRoutes from './search.routes';
import holdingsRoutes from './holdings.routes';

const router = Router();

// Core routes
router.use('/auth', authRoutes);
router.use('/funds', fundsQuickRoutes); // Quick load routes BEFORE main funds routes
router.use('/funds', fundsRoutes);
router.use('/fund-managers', fundManagersRoutes);
router.use('/suggest', suggestRoutes); // Autocomplete endpoint
router.use('/search', searchRoutes); // Full-text search

// User & Portfolio routes
router.use('/users', usersRoutes);
router.use('/watchlist', watchlistRoutes);
router.use('/portfolio', portfolioRoutes);
router.use('/investments', investmentRoutes);
router.use('/kyc', kycRoutes);

// Market Data routes
router.use('/market-indices', marketIndicesRoutes);
router.use('/market', marketIndicesRoutes); // Alias for /api/market/indices compatibility
router.use('/holdings', holdingsRoutes);
router.use('/news', newsRoutes);
router.use('/rankings', rankingsRoutes);

// Analysis & Tools routes
router.use('/comparison', comparisonRoutes);
router.use('/calculator', calculatorRoutes);
router.use('/tax', taxRoutes);
router.use('/governance', governanceRoutes);

// Advanced routes
router.use('/ai', aiRoutes);
router.use('/feedback', feedbackRoutes);
router.use('/admin', adminRoutes);

// V2 Professional routes
router.use('/v2', v2Routes); // Professional architecture routes

export default router;
