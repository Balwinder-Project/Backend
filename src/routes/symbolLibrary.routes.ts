import { Router } from 'express';
import {
  getSymbolLibrary,
  createSymbolLibraryItem,
  updateSymbolLibraryItem,
  deleteSymbolLibraryItem,
} from '../controllers/symbolLibrary.controller';
import { authenticateUser, requireAnyAdminPermission } from '../middleware/auth.middleware';

const router = Router();
const canManage = requireAnyAdminPermission(['PRODUCT_EDITOR', 'OWNER']);

// Public storefront read exposes active symbols only.
router.get('/', getSymbolLibrary);
// Admin catalogue read may include inactive symbols.
router.get('/manage', authenticateUser, canManage, getSymbolLibrary);
router.post('/', authenticateUser, canManage, createSymbolLibraryItem);
router.put('/:id', authenticateUser, canManage, updateSymbolLibraryItem);
router.delete('/:id', authenticateUser, canManage, deleteSymbolLibraryItem);

export default router;
