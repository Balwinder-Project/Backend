import { Router } from 'express';
import userRoutes from './user.routes';
import authRoutes from './auth.routes';
import adminRoutes from './admin.routes';
import retailerRoutes from './retailer.routes';

const router = Router();

// API version prefix
const API_VERSION = '/v1';

// Mount routes
router.use(`${API_VERSION}/users`, userRoutes);
router.use(`${API_VERSION}/auth`, authRoutes);
router.use(`${API_VERSION}/admin`, adminRoutes);
router.use(`${API_VERSION}/retailers`, retailerRoutes);

// API info endpoint
router.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    version: 'v1',
    endpoints: {
      users: `${API_VERSION}/users`,
      auth: `${API_VERSION}/auth`,
      admin: `${API_VERSION}/admin`,
      retailers: `${API_VERSION}/retailers`
    }
  });
});

export default router;

