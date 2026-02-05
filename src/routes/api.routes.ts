import { Router } from 'express';
import userRoutes from './user.routes';
import authRoutes from './auth.routes';
import adminRoutes from './admin.routes';
import retailerRoutes from './retailer.routes';
import categoryRoutes from './category.routes';
import tagRoutes from './tag.routes';
import productRoutes from './product.routes';
import walletRoutes from './wallet.routes';
import uploadRoutes from './upload.routes';

const router = Router();

// API version prefix
const API_VERSION = '/v1';

// Mount routes
router.use(`${API_VERSION}/users`, userRoutes);
router.use(`${API_VERSION}/auth`, authRoutes);
router.use(`${API_VERSION}/admin`, adminRoutes);
router.use(`${API_VERSION}/retailers`, retailerRoutes);
router.use(`${API_VERSION}/categories`, categoryRoutes);
router.use(`${API_VERSION}/tags`, tagRoutes);
router.use(`${API_VERSION}/products`, productRoutes);
router.use(`${API_VERSION}/wallets`, walletRoutes);
router.use(`${API_VERSION}/upload`, uploadRoutes);

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
      retailers: `${API_VERSION}/retailers`,
      categories: `${API_VERSION}/categories`,
      tags: `${API_VERSION}/tags`,
      products: `${API_VERSION}/products`,
      wallets: `${API_VERSION}/wallets`,
      upload: `${API_VERSION}/upload`
    }
  });
});

export default router;

