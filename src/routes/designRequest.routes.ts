import { Router } from 'express';
import {
  createDesignRequest,
  designRequestUpload,
  listDesignRequestsAdmin,
  getDesignRequestAdmin,
  updateDesignRequestAdmin,
} from '../controllers/designRequest.controller';
import {
  authenticateUser,
  optionalAuth,
  requireAdmin,
} from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validateRequest';
import {
  createDesignRequestValidator,
  updateDesignRequestValidator,
  listDesignRequestsValidator,
  designRequestIdValidator,
} from '../validators/designRequest.validator';

const router = Router();

// Public submit (optional auth attaches firebaseUid when logged in)
// Order: optionalAuth → multer → validators → handler
router.post(
  '/',
  optionalAuth,
  designRequestUpload,
  createDesignRequestValidator,
  validateRequest,
  createDesignRequest
);

// Admin routes (before /:id patterns if any)
router.get(
  '/admin/all',
  authenticateUser,
  requireAdmin,
  listDesignRequestsValidator,
  validateRequest,
  listDesignRequestsAdmin
);

router.get(
  '/admin/:id',
  authenticateUser,
  requireAdmin,
  designRequestIdValidator,
  validateRequest,
  getDesignRequestAdmin
);

router.put(
  '/admin/:id',
  authenticateUser,
  requireAdmin,
  updateDesignRequestValidator,
  validateRequest,
  updateDesignRequestAdmin
);

export default router;
