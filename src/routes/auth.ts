import { Router } from 'express';
import { register, login, refreshTokens } from '../controllers/auth';
import { googleLogin } from '../controllers/googleAuth';
import { googleSignIn } from '../controllers/auth.controller';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refreshTokens);

// Google OAuth - Production-ready ID Token verification flow (POST)
router.post('/google', googleLogin);

export default router;
