import { Router } from 'express';
import { createCollection, getCollections, getCollectionById, weighCollection, updateCollectionStatus, completeCollection } from '../controllers/collectionController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', getCollections);
router.post('/', requireRole('collection_centre_officer', 'administrator'), createCollection);
router.get('/:id', getCollectionById);
router.put('/:id', requireRole('collection_centre_officer', 'administrator'), updateCollectionStatus);
router.post('/:id/weigh', requireRole('collection_centre_officer', 'administrator'), weighCollection);
router.patch('/:id/status', requireRole('collection_centre_officer', 'quality_inspector', 'administrator'), updateCollectionStatus);
router.post('/:id/complete', requireRole('collection_centre_officer', 'administrator'), completeCollection);

export default router;
