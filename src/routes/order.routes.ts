import { Router } from 'express';
import {
  getShippingRates,
  createOrder,
  createRazorpayCheckoutOrder,
  getUserOrders,
  getOrderById,
  getAllOrdersAdmin,
  getAdminOrderById,
  updateAdminOrderStatus,
  retryShiprocketSync,
  shiprocketWebhook,
  razorpayWebhook,
} from '../controllers/order.controller';
import { authenticateUser, requireModulePermission } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validateRequest';
import { validateShippingCharge } from '../middleware/validateShippingCharge';
import { shippingRatesValidator, createOrderValidator, updateOrderStatusValidator } from '../validators/order.validator';

const router = Router();

// Webhook MUST come first — no auth, AWB-based verification
router.post('/shiprocket/webhook', shiprocketWebhook);
router.post('/razorpay/webhook', razorpayWebhook);

// Authenticated routes
router.post('/shipping-rates', authenticateUser, shippingRatesValidator, validateRequest, getShippingRates);
router.post('/', authenticateUser, createOrderValidator, validateRequest, validateShippingCharge, createOrder);
router.post('/razorpay/create-order', authenticateUser, validateShippingCharge, createRazorpayCheckoutOrder);

// Admin read routes — Product Editor and Owner can view orders.
// Keep these before /:id to prevent "admin" being parsed as an ObjectId.
router.get('/admin/all', authenticateUser, requireModulePermission('orders', 'view', ['PRODUCT_EDITOR']), getAllOrdersAdmin);
router.get('/admin/:id', authenticateUser, requireModulePermission('orders', 'view', ['PRODUCT_EDITOR']), getAdminOrderById);

// Order-changing actions remain on the existing admin guard.
router.put('/admin/:id/status', authenticateUser, requireModulePermission('orders', 'edit'), updateOrderStatusValidator, validateRequest, updateAdminOrderStatus);
router.post('/admin/:id/shiprocket-retry', authenticateUser, requireModulePermission('orders', 'edit'), retryShiprocketSync);

router.get('/', authenticateUser, getUserOrders);
router.get('/:id', authenticateUser, getOrderById);

export default router;
