import { Router } from 'express';
import {
  getMe, getFarmers, createFarmer, getFarmerById, updateFarmer,
  updateFarmerStatus, getFarmerCrops, getFarmerCollections,
  getFarmerPayments, getFarmerDistricts
} from '../controllers/farmerController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.get('/me', getMe);
router.get('/districts', getFarmerDistricts);
router.get('/', requireRole('farmer', 'collection_centre_officer', 'quality_inspector', 'inventory_manager', 'finance_officer', 'transport_coordinator', 'administrator'), getFarmers);
router.post('/', requireRole('collection_centre_officer', 'administrator'), createFarmer);
router.get('/:id', getFarmerById);
router.put('/:id', updateFarmer);
router.patch('/:id/status', requireRole('collection_centre_officer', 'administrator'), updateFarmerStatus);
router.get('/:id/crops', getFarmerCrops);
router.get('/:id/collections', getFarmerCollections);
router.get('/:id/payments', getFarmerPayments);

export default router;
