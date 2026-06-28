import { Router } from 'express';
import {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  generateProductMockups
} from '../controllers/product.controller';
import { authenticateUser, optionalAuth, requireAnyAdminPermission } from '../middleware/auth.middleware';
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
router.post('/', authenticateUser, requireAnyAdminPermission(['PRODUCT_EDITOR', 'OWNER']), validateProductData(false), createProduct);

/**
 * PUT /api/v1/products/:id
 * Update a product
 * Requires admin authentication
 */
router.put('/:id', authenticateUser, requireAnyAdminPermission(['PRODUCT_EDITOR', 'OWNER']), validateObjectId, validateProductData(true), updateProduct);

/**
 * DELETE /api/v1/products/:id
 * Delete a product
 * Requires admin authentication
 */
router.delete('/:id', authenticateUser, requireAnyAdminPermission(['PRODUCT_EDITOR', 'OWNER']), validateObjectId, deleteProduct);

/**
 * POST /api/v1/products/:id/mockups/generate
 * Generate mockups from the product's design image + matching templates.
 * Requires admin authentication
 */
router.post('/:id/mockups/generate', authenticateUser, requireAnyAdminPermission(['PRODUCT_EDITOR', 'OWNER']), validateObjectId, generateProductMockups);

export default router;

