import { Router } from 'express';
import { createOrder, getOrders, getOrderById, updateOrderStatus, allocateStock, cancelOrder, getOrderFeedback, submitOrderFeedback } from '../controllers/orderController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', getOrders);
router.post('/', requireRole('buyer', 'administrator'), createOrder);
router.get('/:id', getOrderById);
router.get('/:id/feedback', getOrderFeedback);
router.post('/:id/feedback', requireRole('buyer'), submitOrderFeedback);
router.put('/:id', requireRole('buyer', 'administrator'), updateOrderStatus);
router.patch('/:id/status', requireRole('inventory_manager', 'finance_officer', 'administrator'), updateOrderStatus);
router.post('/:id/allocate', requireRole('inventory_manager', 'administrator'), allocateStock);
router.post('/:id/cancel', requireRole('buyer', 'inventory_manager', 'administrator'), cancelOrder);

export default router;
