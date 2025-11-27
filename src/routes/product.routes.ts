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

// All product routes require admin authentication
router.use(authenticateUser, requireAdmin);

/**
 * POST /api/v1/products
 * Create a new product
 */
router.post('/', validateProductData(false), createProduct);

/**
 * GET /api/v1/products
 * Get all products with pagination, search, and filters
 */
router.get('/', getAllProducts);

/**
 * GET /api/v1/products/:id
 * Get a single product by ID
 */
router.get('/:id', validateObjectId, getProductById);

/**
 * PUT /api/v1/products/:id
 * Update a product
 */
router.put('/:id', validateObjectId, validateProductData(true), updateProduct);

/**
 * DELETE /api/v1/products/:id
 * Delete a product
 */
router.delete('/:id', validateObjectId, deleteProduct);

export default router;

