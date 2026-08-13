import { Router } from 'express';
import { register, login, logout, forgotPassword, getMe, refreshToken } from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.post('/forgot-password', forgotPassword);
router.post('/refresh', refreshToken);
router.get('/me', authenticate, getMe);

export default router;
