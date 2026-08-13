import { Router } from 'express';
import { getDashboardStats, getCollectionReport, getInventoryReport, getPaymentReport, getFinancialReport, getWastageReport, getOrdersReport } from '../controllers/reportController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/dashboard', getDashboardStats);
router.get('/collections', requireRole('collection_centre_officer', 'quality_inspector', 'inventory_manager', 'finance_officer', 'administrator'), getCollectionReport);
router.get('/inventory', requireRole('inventory_manager', 'finance_officer', 'administrator'), getInventoryReport);
router.get('/payments', requireRole('finance_officer', 'administrator'), getPaymentReport);
router.get('/financial', requireRole('finance_officer', 'administrator'), getFinancialReport);
router.get('/wastage', requireRole('inventory_manager', 'finance_officer', 'administrator'), getWastageReport);
router.get('/orders', requireRole('inventory_manager', 'finance_officer', 'administrator'), getOrdersReport);

export default router;
