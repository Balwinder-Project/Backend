import { Router } from 'express';
import { authenticateUser, requireAdminPermission } from '../middleware/auth.middleware';
import { listCustomerCarts, getCustomerCart } from '../controllers/adminCart.controller';

const router = Router();
router.get('/', authenticateUser, requireAdminPermission('OWNER'), listCustomerCarts);
router.get('/:id', authenticateUser, requireAdminPermission('OWNER'), getCustomerCart);
export default router;