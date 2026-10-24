import { Router } from 'express';
import { authenticateUser } from '../middleware/auth.middleware';
import { getMyCart, saveMyCart } from '../controllers/cart.controller';

const router = Router();

router.get('/', authenticateUser, getMyCart);
router.put('/', authenticateUser, saveMyCart);

export default router;
