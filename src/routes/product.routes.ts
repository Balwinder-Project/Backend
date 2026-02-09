import { Router } from 'express';
import {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct
} from '../controllers/product.controller';
import { authenticateUser, requireAdmin } from '../middleware/auth.middleware';
import { validateProductData, validateObjectId } from '../validators/product.validator';

const router = Router();

/**
 * GET /api/v1/products
 * Get all products with pagination, search, and filters
 * Public endpoint - no authentication required
 */
router.get('/', getAllProducts);

/**
 * GET /api/v1/products/:id
 * Get a single product by ID
 * Public endpoint - no authentication required
 */
router.get('/:id', validateObjectId, getProductById);

/**
 * POST /api/v1/products
 * Create a new product
 * Requires admin authentication
 */
router.post('/', authenticateUser, requireAdmin, validateProductData(false), createProduct);

/**
 * PUT /api/v1/products/:id
 * Update a product
 * Requires admin authentication
 */
router.put('/:id', authenticateUser, requireAdmin, validateObjectId, validateProductData(true), updateProduct);

/**
 * DELETE /api/v1/products/:id
 * Delete a product
 * Requires admin authentication
 */
router.delete('/:id', authenticateUser, requireAdmin, validateObjectId, deleteProduct);

export default router;


