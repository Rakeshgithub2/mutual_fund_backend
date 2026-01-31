import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import {
  getInvestments,
  getInvestmentById,
  createInvestment,
  cancelInvestment,
  getInvestmentStats,
} from '../controllers/investments';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get investment statistics
router.get('/stats', getInvestmentStats);

// Get all investments
router.get('/', getInvestments);

// Get investment by ID
router.get('/:id', getInvestmentById);

// Create new investment
router.post('/', createInvestment);

// Cancel investment
router.put('/:id/cancel', cancelInvestment);

export default router;
