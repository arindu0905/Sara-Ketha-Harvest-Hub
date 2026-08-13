import { Router } from 'express';
import { getBotInteractionPrompt, predictCropRecommendations } from '../controllers/botController';

const router = Router();

// GET /api/bot/prompt - Fetch dynamic localized conversational prompts
router.get('/prompt', getBotInteractionPrompt);

// POST /api/bot/recommend - Generate Java ML powered crop recommendations
router.post('/recommend', predictCropRecommendations);

export default router;
