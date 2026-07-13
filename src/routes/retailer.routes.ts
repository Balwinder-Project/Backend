import { Router } from 'express';
import {
  createRetailer,
  getAllRetailers,
  getRetailerById,
  updateRetailer,
  deleteRetailer,
  getMyRetailerStatus
} from '../controllers/retailer.controller';
import { authenticateUser, requireAdmin } from '../middleware/auth.middleware';
import { validateRetailerData, validateObjectId } from '../validators/retailer.validator';

const router = Router();

/**
 * GET /api/retailers/me
 * Returns whether the logged-in user is a retailer. Any authenticated user
 * (not just admins) can call this — used by the storefront to resolve role.
 * Declared before the admin guard below.
 */
router.get('/me', authenticateUser, getMyRetailerStatus);

// All remaining retailer routes require admin authentication
router.use(authenticateUser, requireAdmin);

/**
 * POST /api/retailers
 * Create a new retailer
 */
router.post('/', validateRetailerData(false), createRetailer);

/**
 * GET /api/retailers
 * Get all retailers with pagination and search
 */
router.get('/', getAllRetailers);

/**
 * GET /api/retailers/:id
 * Get a single retailer by ID
 */
router.get('/:id', validateObjectId, getRetailerById);

/**
 * PUT /api/retailers/:id
 * Update a retailer
 */
router.put('/:id', validateObjectId, validateRetailerData(true), updateRetailer);

/**
 * DELETE /api/retailers/:id
 * Delete a retailer
 */
router.delete('/:id', validateObjectId, deleteRetailer);

export default router;

