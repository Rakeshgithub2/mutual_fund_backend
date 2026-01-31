import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { getMe, updateMe } from '../controllers/users';

const router = Router();

router.use(authenticate);

router.get('/me', getMe);
router.put('/me', updateMe);

export default router;