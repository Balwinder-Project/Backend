import { Router } from 'express';
import { authenticateUser, requireAdmin } from '../middleware/auth.middleware';
import { assignWholesalerToSalesman, createSalesman, getSummary, listLedger, listSalesmen, updateLedgerStatus, updateSalesman, getMySalesmanSummary, getMySalesmanLedger, getMySalesmanWholesalers } from '../controllers/salesIncentive.controller';

const router = Router();

// Salesman routes are deliberately mounted before the admin-only guard and always scope data by Firebase UID.
router.get('/me/summary', authenticateUser, (req, res, next) => req.user?.role === 'salesman' ? next() : res.status(403).json({ success: false, message: 'Salesman access required' }), getMySalesmanSummary);
router.get('/me/ledger', authenticateUser, (req, res, next) => req.user?.role === 'salesman' ? next() : res.status(403).json({ success: false, message: 'Salesman access required' }), getMySalesmanLedger);
router.get('/me/wholesalers', authenticateUser, (req, res, next) => req.user?.role === 'salesman' ? next() : res.status(403).json({ success: false, message: 'Salesman access required' }), getMySalesmanWholesalers);

router.use(authenticateUser, requireAdmin);
router.get('/admin/summary', getSummary);
router.get('/admin/salesmen', listSalesmen);
router.post('/admin/salesmen', createSalesman);
router.post('/admin/assign-wholesaler', assignWholesalerToSalesman);
router.put('/admin/salesmen/:id', updateSalesman);
router.get('/admin/ledger', listLedger);
router.put('/admin/ledger/:id/status', updateLedgerStatus);
export default router;
