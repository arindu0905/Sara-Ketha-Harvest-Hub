import { Router } from 'express';
import {
  createCollection, getCollections, getCollectionById, weighCollection, updateCollectionStatus, completeCollection,
  listReceipts, getCollectionReport, getCollectionReceipt, issueCollectionReceipt, confirmCollectionReceipt,
} from '../controllers/collectionController';
import { authenticate, requireRole, validate } from '../middleware/auth';
import { collectionSchema, weighSchema } from '../schemas/validationSchemas';

const router = Router();
router.use(authenticate);

router.get('/receipts', listReceipts);
router.get('/', requireRole('farmer', 'collection_centre_officer', 'quality_inspector', 'inventory_manager', 'finance_officer', 'transport_coordinator', 'manager'), getCollections);
router.post('/', requireRole('collection_centre_officer'), validate(collectionSchema), createCollection);
router.get('/:id', getCollectionById);
router.get('/:id/receipt', getCollectionReceipt);
router.get('/:id/report', requireRole('farmer', 'collection_centre_officer', 'quality_inspector', 'inventory_manager', 'finance_officer', 'transport_coordinator', 'manager'), getCollectionReport);
router.post('/:id/receipt', requireRole('collection_centre_officer'), issueCollectionReceipt);
router.post('/:id/receipt/confirm', requireRole('farmer'), confirmCollectionReceipt);
router.put('/:id', requireRole('collection_centre_officer'), updateCollectionStatus);
router.post('/:id/weigh', requireRole('collection_centre_officer'), validate(weighSchema), weighCollection);
router.patch('/:id/status', requireRole('collection_centre_officer', 'quality_inspector'), updateCollectionStatus);
router.post('/:id/complete', requireRole('collection_centre_officer'), completeCollection);

export default router;
