import { Router } from 'express';
import {
  createTag,
  getAllTags,
  getTagById,
  updateTag,
  deleteTag
} from '../controllers/tag.controller';
import { authenticateUser, requireAdmin } from '../middleware/auth.middleware';
import { validateTagData, validateObjectId } from '../validators/tag.validator';

const router = Router();

/**
 * GET /api/v1/tags
 * Get all tags
 * Public endpoint - no authentication required
 */
router.get('/', getAllTags);

/**
 * GET /api/v1/tags/:id
 * Get a single tag by ID
 * Public endpoint - no authentication required
 */
router.get('/:id', validateObjectId, getTagById);

/**
 * POST /api/v1/tags
 * Create a new tag
 * Requires admin authentication
 */
router.post('/', authenticateUser, requireAdmin, validateTagData(false), createTag);

/**
 * PUT /api/v1/tags/:id
 * Update a tag
 * Requires admin authentication
 */
router.put('/:id', authenticateUser, requireAdmin, validateObjectId, validateTagData(true), updateTag);

/**
 * DELETE /api/v1/tags/:id
 * Delete a tag
 * Requires admin authentication
 */
router.delete('/:id', authenticateUser, requireAdmin, validateObjectId, deleteTag);

export default router;


