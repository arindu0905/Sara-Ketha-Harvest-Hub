import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, requireRole } from '../middleware/auth';
import { getBotInteractionPrompt, predictCropRecommendations } from '../controllers/botController';

const router = Router();

// Recommendations may call a paid LLM for wording, so they require a login and are rate limited.
const recommendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, message: 'Too many crop advisory requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(authenticate, requireRole('farmer', 'collection_centre_officer'));

// GET /api/bot/prompt - localized conversational prompts
router.get('/prompt', getBotInteractionPrompt);

// POST /api/bot/recommend - suitability-scored crop recommendations (see services/cropAdvisor.ts)
router.post('/recommend', recommendLimiter, predictCropRecommendations);

export default router;
