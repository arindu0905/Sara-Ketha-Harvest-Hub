import { Router } from 'express';
import {
  createInspection,
  getInspectionById,
  approveInspection,
  getPendingInspections,
  uploadInspectionImages,
  getInspectionImages,
  deleteInspectionImage,
} from '../controllers/inspectionController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const STAFF = requireRole('quality_inspector', 'collection_centre_officer', 'administrator');

router.get('/', getPendingInspections);
router.post('/', STAFF, createInspection);
router.get('/:id', getInspectionById);
router.post('/:id/approve', STAFF, approveInspection);

// Evidence image routes
router.post('/:id/images', STAFF, uploadInspectionImages);
router.get('/:id/images', getInspectionImages);
router.delete('/:id/images/:imageId', STAFF, deleteInspectionImage);

export default router;
