import { Router } from 'express';
import {
  getNamePlateConfig,
  upsertNamePlateConfig,
  getSubCategoryNamePlateConfig,
  upsertSubCategoryNamePlateConfig,
} from '../controllers/namePlateConfig.controller';
import { authenticateUser, requireAnyAdminPermission } from '../middleware/auth.middleware';

const router = Router();
const canManage = requireAnyAdminPermission(['PRODUCT_EDITOR', 'OWNER']);

// Public storefront product-level configuration read.
router.get('/:productId', getNamePlateConfig);
router.put('/:productId', authenticateUser, canManage, upsertNamePlateConfig);

// Category/subcategory-level design library. Admin writes are protected.
router.get('/subcategory/:subCategoryId', getSubCategoryNamePlateConfig);
router.put('/subcategory/:subCategoryId', authenticateUser, canManage, upsertSubCategoryNamePlateConfig);

export default router;
