import { Router } from 'express';
import { authenticateUser, requireAdmin } from '../middleware/auth.middleware';
import { assignWholesalerToSalesman, createSalesman, getSummary, listLedger, listSalesmen, updateLedgerStatus, updateSalesman } from '../controllers/salesIncentive.controller';

const router = Router();
router.use(authenticateUser, requireAdmin);
router.get('/admin/summary', getSummary);
router.get('/admin/salesmen', listSalesmen);
router.post('/admin/salesmen', createSalesman);
router.post('/admin/assign-wholesaler', assignWholesalerToSalesman);
router.put('/admin/salesmen/:id', updateSalesman);
router.get('/admin/ledger', listLedger);
router.put('/admin/ledger/:id/status', updateLedgerStatus);
export default router;
