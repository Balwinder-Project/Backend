import { Router } from 'express';
import {
  getWishlist,
  getWishlistIds,
  addToWishlist,
  removeFromWishlist,
} from '../controllers/wishlist.controller';
import { authenticateUser } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validateRequest';
import {
  addWishlistValidator,
  wishlistProductIdValidator,
} from '../validators/wishlist.validator';

const router = Router();

router.use(authenticateUser);

router.get('/', getWishlist);
router.get('/ids', getWishlistIds);
router.post('/', addWishlistValidator, validateRequest, addToWishlist);
router.delete(
  '/:productId',
  wishlistProductIdValidator,
  validateRequest,
  removeFromWishlist
);

export default router;
