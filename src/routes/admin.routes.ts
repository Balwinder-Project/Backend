import { Router } from 'express';
import { createAdminUser, getDashboardSummary } from '../controllers/admin.controller';
import { authenticateUser, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

/**
 * POST /api/admin/create-admin-user
 * Create a new admin user with custom claims
 * Note: In production, this should be protected with admin authentication
 */
router.post('/create-admin-user', createAdminUser);
router.get('/dashboard', authenticateUser, requireAdmin, getDashboardSummary);

export default router;
