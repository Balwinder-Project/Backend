import { Router } from 'express';
import {
  createMockupTemplate,
  deleteMockupTemplate,
  getAllMockupTemplates,
  getMockupTemplateById,
  previewMockupTemplate,
  previewMockupsForSelection,
  updateMockupTemplate,
} from '../controllers/mockupTemplate.controller';
import { authenticateUser, requireAnyAdminPermission, requireAdminPermission } from '../middleware/auth.middleware';
import { validateMockupTemplateData, validateObjectId } from '../validators/mockupTemplate.validator';

const router = Router();

// Reads: any catalogue admin may view templates.
router.get('/', authenticateUser, requireAnyAdminPermission(['PRODUCT_EDITOR', 'QC_CHECK_1', 'QC_CHECK_2', 'OWNER']), getAllMockupTemplates);
router.get('/:id', authenticateUser, requireAnyAdminPermission(['PRODUCT_EDITOR', 'QC_CHECK_1', 'QC_CHECK_2', 'OWNER']), validateObjectId, getMockupTemplateById);

// Preview rendering: editors and owners. (literal path registered before '/:id/...')
router.post('/preview-selection', authenticateUser, requireAnyAdminPermission(['PRODUCT_EDITOR', 'OWNER']), previewMockupsForSelection);
router.post('/:id/preview', authenticateUser, requireAnyAdminPermission(['PRODUCT_EDITOR', 'OWNER']), validateObjectId, previewMockupTemplate);

// Writes: OWNER only — templates are catalogue-wide configuration.
router.post('/', authenticateUser, requireAdminPermission('OWNER'), validateMockupTemplateData(false), createMockupTemplate);
router.put('/:id', authenticateUser, requireAdminPermission('OWNER'), validateObjectId, validateMockupTemplateData(true), updateMockupTemplate);
router.delete('/:id', authenticateUser, requireAdminPermission('OWNER'), validateObjectId, deleteMockupTemplate);

export default router;
