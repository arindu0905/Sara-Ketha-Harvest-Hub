import { Router } from 'express';
import { getInventory, getBatchById, adjustStock, transferBatch, getInventorySummary } from '../controllers/inventoryController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/summary', getInventorySummary);
router.get('/', getInventory);
router.get('/:id', getBatchById);
router.post('/:id/adjust', requireRole('inventory_manager', 'administrator'), adjustStock);
router.post('/:id/transfer', requireRole('inventory_manager', 'administrator'), transferBatch);

export default router;
