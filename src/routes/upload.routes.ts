import { Router } from 'express';
import { uploadSingleImage, uploadMultipleImagesController } from '../controllers/upload.controller';
import { uploadSingleImage as uploadSingle, uploadMultipleImages as uploadMultiple } from '../middleware/upload.middleware';
import { authenticateUser, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

// All upload routes require admin authentication
router.use(authenticateUser, requireAdmin);

/**
 * POST /api/v1/upload/image
 * Upload single image
 */
router.post('/image', uploadSingle, uploadSingleImage);

/**
 * POST /api/v1/upload/images
 * Upload multiple images (max 5)
 */
router.post('/images', uploadMultiple, uploadMultipleImagesController);

export default router;



