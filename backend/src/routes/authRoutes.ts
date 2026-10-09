import { Router } from 'express';
import { register, login, logout, forgotPassword, getMe, refreshToken } from '../controllers/authController';
import { authenticate, validate } from '../middleware/auth';
import { registerSchema, loginSchema } from '../schemas/validationSchemas';

const router = Router();

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/logout', logout);
router.post('/forgot-password', forgotPassword);
router.post('/refresh', refreshToken);
router.get('/me', authenticate, getMe);

export default router;
