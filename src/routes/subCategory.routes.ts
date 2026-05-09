import { Router } from 'express';
import {
  createSubCategory,
  deleteSubCategory,
  getAllSubCategories,
  getSubCategoryById,
  getSubCategoryBySlugs,
  updateSubCategory,
} from '../controllers/subCategory.controller';
import { authenticateUser, requireAnyAdminPermission } from '../middleware/auth.middleware';
import { validateObjectId, validateSubCategoryData } from '../validators/subCategory.validator';

const router = Router();

router.get('/', getAllSubCategories);
router.get('/slug/:categorySlug/:subCategorySlug', getSubCategoryBySlugs);
router.get('/:id', validateObjectId, getSubCategoryById);

router.post(
  '/',
  authenticateUser,
  requireAnyAdminPermission(['PRODUCT_EDITOR', 'OWNER']),
  validateSubCategoryData(false),
  createSubCategory
);

router.put(
  '/:id',
  authenticateUser,
  requireAnyAdminPermission(['PRODUCT_EDITOR', 'OWNER']),
  validateObjectId,
  validateSubCategoryData(true),
  updateSubCategory
);

router.delete(
  '/:id',
  authenticateUser,
  requireAnyAdminPermission(['PRODUCT_EDITOR', 'OWNER']),
  validateObjectId,
  deleteSubCategory
);

export default router;
