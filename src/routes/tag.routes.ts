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

// All tag routes require admin authentication
router.use(authenticateUser, requireAdmin);

/**
 * POST /api/v1/tags
 * Create a new tag
 */
router.post('/', validateTagData(false), createTag);

/**
 * GET /api/v1/tags
 * Get all tags
 */
router.get('/', getAllTags);

/**
 * GET /api/v1/tags/:id
 * Get a single tag by ID
 */
router.get('/:id', validateObjectId, getTagById);

/**
 * PUT /api/v1/tags/:id
 * Update a tag
 */
router.put('/:id', validateObjectId, validateTagData(true), updateTag);

/**
 * DELETE /api/v1/tags/:id
 * Delete a tag
 */
router.delete('/:id', validateObjectId, deleteTag);

export default router;


