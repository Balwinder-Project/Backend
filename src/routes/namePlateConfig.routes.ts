import { Router } from 'express';
import { getNamePlateConfig, upsertNamePlateConfig } from '../controllers/namePlateConfig.controller';
import { authenticateUser, requireAnyAdminPermission } from '../middleware/auth.middleware';

const router = Router();
const canManage = requireAnyAdminPermission(['PRODUCT_EDITOR', 'OWNER']);

// Public storefront configuration read can be added later; admin write is protected now.
router.get('/:productId', getNamePlateConfig);
router.put('/:productId', authenticateUser, canManage, upsertNamePlateConfig);

export default router;
