import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { addToWatchlist, removeFromWatchlist, getWatchlist } from '../controllers/watchlist';

const router = Router();

router.use(authenticate);

router.post('/', addToWatchlist);
router.delete('/:id', removeFromWatchlist);
router.get('/', getWatchlist);

export default router;