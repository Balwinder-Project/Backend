import { Router } from 'express';
import {
  createAdminUser,
  deleteAdminUser,
  getDashboardSummary,
  listAdminPermissions,
  updateAdminPermissions,
} from '../controllers/admin.controller';
import { authenticateUser, requireAdmin, requireAdminPermission } from '../middleware/auth.middleware';

const router = Router();

/**
 * POST /api/admin/create-admin-user
 * Create a new admin user with custom claims
 * Note: In production, this should be protected with admin authentication
 */
router.post('/create-admin-user', createAdminUser);
router.get('/dashboard', authenticateUser, requireAdmin, getDashboardSummary);
router.get('/permissions/admins', authenticateUser, requireAdminPermission('OWNER'), listAdminPermissions);
router.post('/permissions/admins', authenticateUser, requireAdminPermission('OWNER'), createAdminUser);
router.put('/permissions/admins/:uid', authenticateUser, requireAdminPermission('OWNER'), updateAdminPermissions);
router.delete('/permissions/admins/:uid', authenticateUser, requireAdminPermission('OWNER'), deleteAdminUser);

export default router;
