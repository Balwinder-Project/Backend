import { Router } from 'express';
import {
  createProduct,
  bulkUpdateProductPricing,
  previewBulkProductPricing,
  bulkUpdateImageFit,
  previewBulkImageFit,
  bulkAssignSubcategory,
  previewBulkSubcategoryAssignment,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  generateProductMockups
} from '../controllers/product.controller';
import { authenticateUser, optionalAuth, requireAnyAdminPermission, requireModulePermission } from '../middleware/auth.middleware';
import { validateProductData, validateObjectId } from '../validators/product.validator';

const router = Router();

/**
 * GET /api/v1/products
 * Get all products with pagination, search, and filters
 * Public endpoint - no authentication required
 */
router.get('/', optionalAuth, getAllProducts);

/**
 * GET /api/v1/products/:id
 * Get a single product by ID
 * Public endpoint - no authentication required
 */
router.get('/:id', optionalAuth, validateObjectId, getProductById);

/**
 * POST /api/v1/products
 * Create a new product
 * Requires admin authentication
 */
router.post('/', authenticateUser, requireModulePermission('products', 'create', ['PRODUCT_EDITOR']), validateProductData(false), createProduct);

/**
 * PUT /api/v1/products/:id
 * Update a product
 * Requires admin authentication
 */
router.post('/bulk-image-fit/preview', authenticateUser, requireAnyAdminPermission(['OWNER']), previewBulkImageFit);
router.patch('/bulk-image-fit', authenticateUser, requireAnyAdminPermission(['OWNER']), bulkUpdateImageFit);
router.post('/bulk-pricing/preview', authenticateUser, requireAnyAdminPermission(['OWNER']), previewBulkProductPricing);
router.post('/bulk-subcategory/preview', authenticateUser, requireAnyAdminPermission(['OWNER']), previewBulkSubcategoryAssignment);
router.patch('/bulk-subcategory', authenticateUser, requireAnyAdminPermission(['OWNER']), bulkAssignSubcategory);
router.patch('/bulk-pricing', authenticateUser, requireAnyAdminPermission(['OWNER']), bulkUpdateProductPricing);

router.put('/:id', authenticateUser, requireModulePermission('products', 'edit', ['PRODUCT_EDITOR']), validateObjectId, validateProductData(true), updateProduct);

/**
 * DELETE /api/v1/products/:id
 * Delete a product
 * Requires admin authentication
 */
router.delete('/:id', authenticateUser, requireModulePermission('products', 'delete', ['PRODUCT_EDITOR']), validateObjectId, deleteProduct);

/**
 * POST /api/v1/products/:id/mockups/generate
 * Generate mockups from the product's design image + matching templates.
 * Requires admin authentication
 */
router.post('/:id/mockups/generate', authenticateUser, requireModulePermission('products', 'edit', ['PRODUCT_EDITOR']), validateObjectId, generateProductMockups);

export default router;

