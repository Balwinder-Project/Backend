import { Router } from 'express';
import {
  getNamePlateConfig,
  getMetalNamePlateConfig,
  upsertNamePlateConfig,
  getSubCategoryNamePlateConfig,
  upsertSubCategoryNamePlateConfig,
} from '../controllers/namePlateConfig.controller';
import { authenticateUser, requireAnyAdminPermission } from '../middleware/auth.middleware';

const router = Router();
const canManage = requireAnyAdminPermission(['PRODUCT_EDITOR', 'OWNER']);

// Public storefront trial route. Keep it before /:productId.
router.get('/metal', getMetalNamePlateConfig);

// Category/subcategory-level design library. Keep these routes before /:productId.
router.get('/subcategory/:subCategoryId', getSubCategoryNamePlateConfig);
router.put('/subcategory/:subCategoryId', authenticateUser, canManage, upsertSubCategoryNamePlateConfig);

// Public storefront product-level configuration read.
router.get('/:productId', getNamePlateConfig);
router.put('/:productId', authenticateUser, canManage, upsertNamePlateConfig);

export default router;
