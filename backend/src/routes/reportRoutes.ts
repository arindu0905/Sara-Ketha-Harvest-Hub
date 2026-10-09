import { Router } from 'express';
import { getDashboardStats, getCollectionReport, getInventoryReport, getPaymentReport, getFinancialReport, getWastageReport, getOrdersReport } from '../controllers/reportController';
import { getManagementReport, exportReportCsv } from '../controllers/managementReportController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// Management stakeholders have read-only access to every report.
router.get('/dashboard', getDashboardStats);
router.get('/management', requireRole('manager', 'finance_officer'), getManagementReport);
router.get('/export/:type', requireRole('manager', 'finance_officer', 'inventory_manager'), exportReportCsv);
router.get('/collections', requireRole('collection_centre_officer', 'quality_inspector', 'inventory_manager', 'finance_officer', 'manager'), getCollectionReport);
router.get('/inventory', requireRole('inventory_manager', 'finance_officer', 'manager'), getInventoryReport);
router.get('/payments', requireRole('finance_officer', 'manager'), getPaymentReport);
router.get('/financial', requireRole('finance_officer', 'manager'), getFinancialReport);
router.get('/wastage', requireRole('inventory_manager', 'finance_officer', 'manager'), getWastageReport);
router.get('/orders', requireRole('inventory_manager', 'finance_officer', 'manager'), getOrdersReport);

export default router;
