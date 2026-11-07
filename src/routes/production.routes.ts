import { Router } from 'express';
import { authenticateUser, requireModulePermission } from '../middleware/auth.middleware';
import {
  assignProductionOrder,
  getAssignedProductionOrders,
  updateProductionProgress,
} from '../controllers/production.controller';

const router = Router();

// Admins can assign orders; only authenticated production staff can access their own queue.
router.put('/orders/:orderId/assign', authenticateUser, requireModulePermission('orders', 'edit'), assignProductionOrder);

router.get('/my-orders', authenticateUser, getAssignedProductionOrders);
router.put('/my-orders/:orderId/progress', authenticateUser, updateProductionProgress);

export default router;
