import { Router } from 'express';
import { createAdminUser } from '../controllers/admin.controller';

const router = Router();

/**
 * POST /api/admin/create-admin-user
 * Create a new admin user with custom claims
 * Note: In production, this should be protected with admin authentication
 */
router.post('/create-admin-user', createAdminUser);

export default router;

