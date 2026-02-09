import { Router } from 'express';
import {
  createCategory,
  getAllCategories,
  getCategoryById,
  getCategoryBySlug,
  updateCategory,
  deleteCategory
} from '../controllers/category.controller';
import { authenticateUser, requireAdmin } from '../middleware/auth.middleware';
import { validateCategoryData, validateObjectId } from '../validators/category.validator';

const router = Router();

/**
 * GET /api/v1/categories
 * Get all categories with pagination and search
 * Public endpoint - no authentication required
 */
router.get('/', getAllCategories);

/**
 * GET /api/v1/categories/slug/:slug
 * Get a single category by slug
 * Public endpoint - no authentication required
 * IMPORTANT: This must come BEFORE /:id route
 */
router.get('/slug/:slug', getCategoryBySlug);

/**
 * GET /api/v1/categories/:id
 * Get a single category by ID
 * Public endpoint - no authentication required
 */
router.get('/:id', validateObjectId, getCategoryById);

/**
 * POST /api/v1/categories
 * Create a new category
 * Requires admin authentication
 */
router.post('/', authenticateUser, requireAdmin, validateCategoryData(false), createCategory);

/**
 * PUT /api/v1/categories/:id
 * Update a category
 * Requires admin authentication
 */
router.put('/:id', authenticateUser, requireAdmin, validateObjectId, validateCategoryData(true), updateCategory);

/**
 * DELETE /api/v1/categories/:id
 * Delete a category
 * Requires admin authentication
 */
router.delete('/:id', authenticateUser, requireAdmin, validateObjectId, deleteCategory);

export default router;


