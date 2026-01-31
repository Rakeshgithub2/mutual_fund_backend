import { Router } from 'express';
import {
  compareFunds,
  calculateOverlap,
} from '../controllers/comparison.controller';

const router = Router();

// POST /compare - Compare multiple funds with detailed analysis
router.post('/compare', compareFunds);

// POST /overlap - Calculate holdings overlap between funds
router.post('/overlap', calculateOverlap);

export default router;
