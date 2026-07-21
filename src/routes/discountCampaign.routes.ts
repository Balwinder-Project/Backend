import { Router } from 'express';
import {
  getAllCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
} from '../controllers/discountCampaign.controller';
import { authenticateUser, requireAnyAdminPermission } from '../middleware/auth.middleware';

const router = Router();

const canManage = requireAnyAdminPermission(['PRODUCT_EDITOR', 'OWNER']);

router.get('/', authenticateUser, canManage, getAllCampaigns);
router.post('/', authenticateUser, canManage, createCampaign);
router.put('/:id', authenticateUser, canManage, updateCampaign);
router.delete('/:id', authenticateUser, canManage, deleteCampaign);

export default router;
