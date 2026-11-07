import { Router } from 'express';
import { authenticateUser } from '../middleware/auth.middleware';
import {
  assignProductionOrder,
  getAssignedProductionOrders,
  updateProductionProgress,
} from '../controllers/production.controller';

const router = Router();

// Admins can assign orders; only authenticated production staff can access their own queue.
router.put('/orders/:orderId/assign', authenticateUser, async (req, res, next) => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ success: false, message: 'Admin access required.' });
    return;
  }
  next();
}, assignProductionOrder);

router.get('/my-orders', authenticateUser, getAssignedProductionOrders);
router.put('/my-orders/:orderId/progress', authenticateUser, updateProductionProgress);

export default router;
