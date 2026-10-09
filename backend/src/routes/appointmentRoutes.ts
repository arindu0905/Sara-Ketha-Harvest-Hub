import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { listAppointments, createAppointment, getAppointment, updateAppointmentStatus } from '../controllers/appointmentController';

const router = Router();
router.use(authenticate);

router.get('/', requireRole('farmer', 'collection_centre_officer', 'quality_inspector', 'inventory_manager', 'transport_coordinator', 'manager'), listAppointments);
router.post('/', requireRole('farmer', 'collection_centre_officer'), createAppointment);
router.get('/:id', requireRole('farmer', 'collection_centre_officer', 'quality_inspector', 'inventory_manager', 'transport_coordinator', 'manager'), getAppointment);
router.patch('/:id/status', requireRole('farmer', 'collection_centre_officer'), updateAppointmentStatus);

export default router;
