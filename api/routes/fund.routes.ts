import { Router } from 'express';
import { getAllFunds, getFundById } from '../controllers/fund.controller';

const router = Router();

// GET / - Get all funds with pagination and filters
router.get('/', getAllFunds);

// GET /:id - Get fund details by ID
router.get('/:id', getFundById);

export default router;
