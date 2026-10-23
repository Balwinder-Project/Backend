import { Router } from 'express';
import {
  getAllCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
} from '../controllers/discountCampaign.controller';
import { authenticateUser, requireModulePermission } from '../middleware/auth.middleware';

const router = Router();

const canView = requireModulePermission('discounts', 'view', ['PRODUCT_EDITOR']);
const canCreate = requireModulePermission('discounts', 'create', ['PRODUCT_EDITOR']);
const canEdit = requireModulePermission('discounts', 'edit', ['PRODUCT_EDITOR']);
const canDelete = requireModulePermission('discounts', 'delete', ['PRODUCT_EDITOR']);

router.get('/', authenticateUser, canView, getAllCampaigns);
router.post('/', authenticateUser, canCreate, createCampaign);
router.put('/:id', authenticateUser, canEdit, updateCampaign);
router.delete('/:id', authenticateUser, canDelete, deleteCampaign);

export default router;
