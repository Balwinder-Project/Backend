import { Router } from 'express';
import {
  approveQcCheck1,
  approveQcCheck2,
  getQcRequest,
  listMyQcSubmissions,
  listQcCheck1,
  listQcCheck2,
  rejectQcCheck1,
  rejectQcCheck2,
} from '../controllers/qc.controller';
import { authenticateUser, requireAdmin, requireAdminPermission, requireModulePermission } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateUser, requireAdmin);

router.get('/check-1', requireModulePermission('qcCheck1', 'view', ['QC_CHECK_1']), listQcCheck1);
router.get('/check-2', requireModulePermission('qcCheck2', 'view', ['QC_CHECK_2']), listQcCheck2);
router.get('/my-submissions', requireAdminPermission('PRODUCT_EDITOR'), listMyQcSubmissions);
router.get('/requests/:id', getQcRequest);
router.post('/check-1/:id/approve', requireModulePermission('qcCheck1', 'approve', ['QC_CHECK_1']), approveQcCheck1);
router.post('/check-1/:id/reject', requireModulePermission('qcCheck1', 'approve', ['QC_CHECK_1']), rejectQcCheck1);
router.post('/check-2/:id/approve', requireModulePermission('qcCheck2', 'approve', ['QC_CHECK_2']), approveQcCheck2);
router.post('/check-2/:id/reject', requireModulePermission('qcCheck2', 'approve', ['QC_CHECK_2']), rejectQcCheck2);

export default router;
