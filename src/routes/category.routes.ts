import { Router } from 'express';
import {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory
} from '../controllers/category.controller';
import { authenticateUser, requireAdmin } from '../middleware/auth.middleware';
import { validateCategoryData, validateObjectId } from '../validators/category.validator';

const router = Router();

// All category routes require admin authentication
router.use(authenticateUser, requireAdmin);

/**
 * POST /api/v1/categories
 * Create a new category
 */
router.post('/', validateCategoryData(false), createCategory);

/**
 * GET /api/v1/categories
 * Get all categories with pagination and search
 */
router.get('/', getAllCategories);

/**
 * GET /api/v1/categories/:id
 * Get a single category by ID
 */
router.get('/:id', validateObjectId, getCategoryById);

/**
 * PUT /api/v1/categories/:id
 * Update a category
 */
router.put('/:id', validateObjectId, validateCategoryData(true), updateCategory);

/**
 * DELETE /api/v1/categories/:id
 * Delete a category
 */
router.delete('/:id', validateObjectId, deleteCategory);

export default router;

