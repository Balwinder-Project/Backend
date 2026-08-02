import { Router } from 'express';
import userRoutes from './user.routes';
import authRoutes from './auth.routes';
import adminRoutes from './admin.routes';
import retailerRoutes from './retailer.routes';
import categoryRoutes from './category.routes';
import subCategoryRoutes from './subCategory.routes';
import tagRoutes from './tag.routes';
import productRoutes from './product.routes';
import walletRoutes from './wallet.routes';
import uploadRoutes from './upload.routes';
import addressRoutes from './address.routes';
import orderRoutes from './order.routes';
import qcRoutes from './qc.routes';
import heroSlideRoutes from './heroSlide.routes';
import mockupTemplateRoutes from './mockupTemplate.routes';
import dimensionTemplateRoutes from './dimensionTemplate.routes';
import discountCampaignRoutes from './discountCampaign.routes';
import designRequestRoutes from './designRequest.routes';
import wishlistRoutes from './wishlist.routes';

const router = Router();

// API version prefix
const API_VERSION = '/v1';

// Mount routes
router.use(`${API_VERSION}/users`, userRoutes);
router.use(`${API_VERSION}/auth`, authRoutes);
router.use(`${API_VERSION}/admin`, adminRoutes);
router.use(`${API_VERSION}/retailers`, retailerRoutes);
router.use(`${API_VERSION}/categories`, categoryRoutes);
router.use(`${API_VERSION}/sub-categories`, subCategoryRoutes);
router.use(`${API_VERSION}/tags`, tagRoutes);
router.use(`${API_VERSION}/products`, productRoutes);
router.use(`${API_VERSION}/wallets`, walletRoutes);
router.use(`${API_VERSION}/upload`, uploadRoutes);
router.use(`${API_VERSION}/addresses`, addressRoutes);
router.use(`${API_VERSION}/orders`, orderRoutes);
router.use(`${API_VERSION}/qc`, qcRoutes);
router.use(`${API_VERSION}/hero-slides`, heroSlideRoutes);
router.use(`${API_VERSION}/mockup-templates`, mockupTemplateRoutes);
router.use(`${API_VERSION}/dimension-templates`, dimensionTemplateRoutes);
router.use(`${API_VERSION}/discount-campaigns`, discountCampaignRoutes);
router.use(`${API_VERSION}/design-requests`, designRequestRoutes);
router.use(`${API_VERSION}/wishlist`, wishlistRoutes);

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
      subCategories: `${API_VERSION}/sub-categories`,
      tags: `${API_VERSION}/tags`,
      products: `${API_VERSION}/products`,
      wallets: `${API_VERSION}/wallets`,
      upload: `${API_VERSION}/upload`,
      addresses: `${API_VERSION}/addresses`,
      orders: `${API_VERSION}/orders`,
      qc: `${API_VERSION}/qc`,
      heroSlides: `${API_VERSION}/hero-slides`,
      mockupTemplates: `${API_VERSION}/mockup-templates`,
      designRequests: `${API_VERSION}/design-requests`,
      wishlist: `${API_VERSION}/wishlist`,
    }
  });
});

export default router;
