import { Router } from 'express';
import { calculateOverlap } from '../controllers/overlap.controller';

const router = Router();

// POST / - Calculate portfolio overlap
router.post('/', calculateOverlap);

export default router;
