import { Router } from 'express';
import { getNamePlateConfigBySubCategory, getPublicNamePlateConfigBySubCategory, saveNamePlateConfigBySubCategory } from '../controllers/namePlateConfig.controller';
import { authenticateUser, requireAnyAdminPermission } from '../middleware/auth.middleware';

const router = Router();

// Customer preview endpoint: read-only and limited to active, customer-facing design data.
router.get('/public/subcategory/:subCategoryId', getPublicNamePlateConfigBySubCategory);

// The editor is part of product management; restrict both operations to authorized catalogue admins.
router.get('/subcategory/:subCategoryId', authenticateUser, requireAnyAdminPermission(['PRODUCT_EDITOR', 'OWNER']), getNamePlateConfigBySubCategory);
router.put('/subcategory/:subCategoryId', authenticateUser, requireAnyAdminPermission(['PRODUCT_EDITOR', 'OWNER']), saveNamePlateConfigBySubCategory);

export default router;
