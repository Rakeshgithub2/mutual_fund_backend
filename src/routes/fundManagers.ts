import { Router } from 'express';
import {
  getFundManagers,
  getFundManagerById,
} from '../controllers/fundManagers.controller';

const router = Router();

// GET /fund-managers - Get all fund managers with filters
router.get('/', getFundManagers);

// GET /fund-managers/:id - Get fund manager details
router.get('/:id', getFundManagerById);

export default router;
