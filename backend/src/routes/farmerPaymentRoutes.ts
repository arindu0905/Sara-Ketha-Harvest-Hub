import { Router } from 'express';
import { calculatePayment, getPayments, getPaymentById, approvePayment, markPaymentPaid } from '../controllers/farmerPaymentController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', getPayments);
router.post('/calculate', requireRole('finance_officer', 'administrator'), calculatePayment);
router.get('/:id', getPaymentById);
router.patch('/:id/approve', requireRole('finance_officer', 'administrator'), approvePayment);
router.patch('/:id/mark-paid', requireRole('finance_officer', 'administrator'), markPaymentPaid);

export default router;
