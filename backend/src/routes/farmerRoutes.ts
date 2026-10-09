import { Router } from 'express';
import {
  getMe, getFarmers, createFarmer, getFarmerById, updateFarmer,
  updateFarmerStatus, getFarmerCrops, getFarmerCollections,
  getFarmerPayments, getFarmerDistricts
} from '../controllers/farmerController';
import { listFarmerDocuments, uploadFarmerDocument, deleteFarmerDocument, verifyFarmerDocument } from '../controllers/farmerDocumentController';
import { authenticate, requireRole, validate } from '../middleware/auth';
import { farmerSchema, farmerUpdateSchema } from '../schemas/validationSchemas';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.get('/me', getMe);
router.get('/districts', getFarmerDistricts);
router.get('/', requireRole('farmer', 'collection_centre_officer', 'quality_inspector', 'inventory_manager', 'finance_officer', 'transport_coordinator', 'manager'), getFarmers);
router.post('/', requireRole('collection_centre_officer', 'administrator'), validate(farmerSchema), createFarmer);
router.get('/:id', getFarmerById);
router.put('/:id', requireRole('farmer', 'collection_centre_officer'), validate(farmerUpdateSchema), updateFarmer);
router.patch('/:id/status', requireRole('collection_centre_officer', 'administrator'), updateFarmerStatus);
router.get('/:id/crops', getFarmerCrops);
router.get('/:id/collections', getFarmerCollections);
router.get('/:id/payments', getFarmerPayments);

const DOC_ROLES = requireRole('farmer', 'collection_centre_officer', 'administrator');
router.get('/:id/documents', DOC_ROLES, listFarmerDocuments);
router.post('/:id/documents', DOC_ROLES, uploadFarmerDocument);
router.patch('/:id/documents/:docId/verify', requireRole('collection_centre_officer', 'administrator'), verifyFarmerDocument);
router.delete('/:id/documents/:docId', DOC_ROLES, deleteFarmerDocument);

export default router;
