import { Router } from 'express';
import {
  getInventory, getBatchById, adjustStock, transferBatch, getInventorySummary, assignLocation,
  recordWastage, listWastage, getExpiryOverview, getMarketplaceProducts, listNearExpiryRecords, runExpirySweep, updateBatchExpiry, applyClearancePrice,
} from '../controllers/inventoryController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const STOCK_VIEWERS = ['inventory_manager', 'collection_centre_officer', 'quality_inspector', 'finance_officer', 'transport_coordinator', 'manager'] as const;
const INV = ['inventory_manager'] as const;

// Aggregated availability is safe for buyers (marketplace); batch-level data (cost prices, farmers) is staff-only.
router.get('/summary', getInventorySummary);
router.get('/marketplace/:categoryId', getMarketplaceProducts);
router.get('/expiry', requireRole(...STOCK_VIEWERS), getExpiryOverview);
router.get('/expiry/records', requireRole(...STOCK_VIEWERS), listNearExpiryRecords);
router.post('/expiry/sweep', requireRole(...INV), runExpirySweep);
router.get('/wastage', requireRole(...STOCK_VIEWERS), listWastage);
router.get('/', requireRole(...STOCK_VIEWERS), getInventory);
router.get('/:id', requireRole(...STOCK_VIEWERS), getBatchById);
router.post('/:id/wastage', requireRole(...INV), recordWastage);
router.patch('/:id/expiry', requireRole(...INV), updateBatchExpiry);
router.post('/:id/clearance', requireRole(...INV), applyClearancePrice);
router.post('/:id/adjust', requireRole(...INV), adjustStock);
router.post('/:id/transfer', requireRole(...INV), transferBatch);
router.post('/:id/assign-location', requireRole(...INV), assignLocation);

export default router;
