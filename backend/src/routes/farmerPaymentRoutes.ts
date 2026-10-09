import { Router } from 'express';
import {
  calculatePayment, getPayments, getPaymentById, approvePayment, rejectPayment, markPaymentPaid, getFarmerInvoices, getPaymentReceipt,
} from '../controllers/farmerPaymentController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const VIEW = ['farmer', 'finance_officer', 'manager'] as const;
router.get('/', requireRole(...VIEW), getPayments);
router.get('/invoices', requireRole(...VIEW), getFarmerInvoices);
router.post('/calculate', requireRole('finance_officer'), calculatePayment);
router.get('/:id', requireRole(...VIEW), getPaymentById);
router.get('/:id/receipt', requireRole(...VIEW), getPaymentReceipt);
router.patch('/:id/approve', requireRole('finance_officer'), approvePayment);
router.patch('/:id/reject', requireRole('finance_officer'), rejectPayment);
router.patch('/:id/mark-paid', requireRole('finance_officer'), markPaymentPaid);

export default router;
