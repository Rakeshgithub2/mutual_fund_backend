import { Router } from 'express';
import { compareFunds } from '../controllers/compare.controller';

const router = Router();

// POST / - Compare multiple funds
router.post('/', compareFunds);

export default router;
