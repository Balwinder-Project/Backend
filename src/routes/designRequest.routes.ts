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
  requireModulePermission, 
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
  requireModulePermission('designRequests', 'view', ['PRODUCT_EDITOR']),
  listDesignRequestsValidator,
  validateRequest,
  listDesignRequestsAdmin
);

router.get(
  '/admin/:id',
  authenticateUser,
  requireModulePermission('designRequests', 'view', ['PRODUCT_EDITOR']),
  designRequestIdValidator,
  validateRequest,
  getDesignRequestAdmin
);

router.put(
  '/admin/:id',
  authenticateUser,
  requireModulePermission('designRequests', 'edit', ['PRODUCT_EDITOR']),
  updateDesignRequestValidator,
  validateRequest,
  updateDesignRequestAdmin
);

export default router;
