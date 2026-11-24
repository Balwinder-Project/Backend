import { Router } from 'express';
import { getCartPrintSettings, updateCartPrintSettings } from '../controllers/cartPrintSettings.controller';
import { authenticateUser, requireAdminPermission } from '../middleware/auth.middleware';
const router=Router();
router.get('/',authenticateUser,getCartPrintSettings);
router.put('/',authenticateUser,requireAdminPermission('OWNER'),updateCartPrintSettings);
export default router;