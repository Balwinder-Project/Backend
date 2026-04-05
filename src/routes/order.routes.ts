import { Router } from 'express';
import {
  getShippingRates,
  createOrder,
  getUserOrders,
  getOrderById,
  getAllOrdersAdmin,
  getAdminOrderById,
  updateAdminOrderStatus,
  shiprocketWebhook,
} from '../controllers/order.controller';
import { authenticateUser } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validateRequest';
import { shippingRatesValidator, createOrderValidator, updateOrderStatusValidator } from '../validators/order.validator';

const router = Router();

// Webhook MUST come first — no auth, AWB-based verification
router.post('/shiprocket/webhook', shiprocketWebhook);

// Authenticated routes
router.post('/shipping-rates', authenticateUser, shippingRatesValidator, validateRequest, getShippingRates);
router.post('/', authenticateUser, createOrderValidator, validateRequest, createOrder);

// Admin — must be before /:id to prevent "admin" being parsed as an ObjectId
router.get('/admin/all', authenticateUser, requireAdmin, getAllOrdersAdmin);
router.get('/admin/:id', authenticateUser, requireAdmin, getAdminOrderById);
router.put('/admin/:id/status', authenticateUser, requireAdmin, updateOrderStatusValidator, validateRequest, updateAdminOrderStatus);

router.get('/', authenticateUser, getUserOrders);
router.get('/:id', authenticateUser, getOrderById);

export default router;
