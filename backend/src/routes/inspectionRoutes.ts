import { Router } from 'express';
import { createInspection, getInspectionById, approveInspection, getPendingInspections } from '../controllers/inspectionController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', getPendingInspections);
router.post('/', requireRole('quality_inspector', 'administrator'), createInspection);
router.get('/:id', getInspectionById);
router.post('/:id/approve', requireRole('quality_inspector', 'administrator'), approveInspection);

export default router;
