import { Request, Response, NextFunction, Router } from 'express';
import { authenticateUser, requireAdmin } from '../middleware/auth.middleware';
import { exchangeSalesmanPhoneToken, assignWholesalerToSalesman, createSalesman, getSummary, listLedger, listSalesmen, updateLedgerStatus, updateSalesman, getMySalesmanSummary, getMySalesmanLedger, getMySalesmanWholesalers } from '../controllers/salesIncentive.controller';

const router = Router();

// Phone OTP must be verified by Firebase before this endpoint exchanges the verified session for the existing salesman UID.
router.post('/auth/phone-exchange', exchangeSalesmanPhoneToken);

// Salesman routes are deliberately mounted before the admin-only guard and always scope data by Firebase UID.
const requireSalesman = (req: Request, res: Response, next: NextFunction): void => {
  if (req.user?.role !== 'salesman') {
    res.status(403).json({ success: false, message: 'Salesman access required' });
    return;
  }
  next();
};
router.get('/me/summary', authenticateUser, requireSalesman, getMySalesmanSummary);
router.get('/me/ledger', authenticateUser, requireSalesman, getMySalesmanLedger);
router.get('/me/wholesalers', authenticateUser, requireSalesman, getMySalesmanWholesalers);

router.use(authenticateUser, requireAdmin);
router.get('/admin/summary', getSummary);
router.get('/admin/salesmen', listSalesmen);
router.post('/admin/salesmen', createSalesman);
router.post('/admin/assign-wholesaler', assignWholesalerToSalesman);
router.put('/admin/salesmen/:id', updateSalesman);
router.get('/admin/ledger', listLedger);
router.put('/admin/ledger/:id/status', updateLedgerStatus);
export default router;
