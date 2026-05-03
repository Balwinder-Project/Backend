import { Router } from 'express';
import {
  createHeroSlide,
  deleteHeroSlide,
  getAllHeroSlides,
  getHeroSlideById,
  updateHeroSlide,
} from '../controllers/heroSlide.controller';
import { authenticateUser, requireAnyAdminPermission } from '../middleware/auth.middleware';
import { validateHeroSlideData, validateObjectId } from '../validators/heroSlide.validator';

const router = Router();

router.get('/', getAllHeroSlides);
router.get('/:id', validateObjectId, getHeroSlideById);
router.post(
  '/',
  authenticateUser,
  requireAnyAdminPermission(['PRODUCT_EDITOR', 'OWNER']),
  validateHeroSlideData(false),
  createHeroSlide
);
router.put(
  '/:id',
  authenticateUser,
  requireAnyAdminPermission(['PRODUCT_EDITOR', 'OWNER']),
  validateObjectId,
  validateHeroSlideData(true),
  updateHeroSlide
);
router.delete(
  '/:id',
  authenticateUser,
  requireAnyAdminPermission(['PRODUCT_EDITOR', 'OWNER']),
  validateObjectId,
  deleteHeroSlide
);

export default router;
