import { Router } from 'express';
import { getCurrentPrices, getPriceHistory, createPrice, updatePriceStatus, updatePrice, deletePrice } from '../controllers/priceController';
import { authenticate, requireRole, optionalAuth } from '../middleware/auth';

const router = Router();

router.get('/current', optionalAuth, getCurrentPrices);
router.get('/history', authenticate, getPriceHistory);
router.post('/', authenticate, requireRole('administrator', 'finance_officer', 'collection_centre_officer'), createPrice);
router.put('/:id/status', authenticate, requireRole('administrator', 'finance_officer', 'collection_centre_officer'), updatePriceStatus);
router.put('/:id', authenticate, requireRole('administrator', 'finance_officer', 'collection_centre_officer'), updatePrice);
router.delete('/:id', authenticate, requireRole('administrator', 'finance_officer'), deletePrice);

export default router;
