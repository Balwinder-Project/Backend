import { Router } from 'express';
import {
  getAllDimensionTemplates,
  createDimensionTemplate,
  updateDimensionTemplate,
  deleteDimensionTemplate,
} from '../controllers/dimensionTemplate.controller';
import { authenticateUser, requireAnyAdminPermission } from '../middleware/auth.middleware';

const router = Router();

// Reusable shipping-dimension presets — admin catalogue tooling only.
const canManage = requireAnyAdminPermission(['PRODUCT_EDITOR', 'OWNER']);

router.get('/', authenticateUser, canManage, getAllDimensionTemplates);
router.post('/', authenticateUser, canManage, createDimensionTemplate);
router.put('/:id', authenticateUser, canManage, updateDimensionTemplate);
router.delete('/:id', authenticateUser, canManage, deleteDimensionTemplate);

export default router;
