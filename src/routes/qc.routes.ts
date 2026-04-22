import { Router } from 'express';
import {
  approveQcCheck1,
  approveQcCheck2,
  getQcRequest,
  listQcCheck1,
  listQcCheck2,
  rejectQcCheck1,
  rejectQcCheck2,
} from '../controllers/qc.controller';
import { authenticateUser, requireAdmin, requireAdminPermission } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateUser, requireAdmin);

router.get('/check-1', requireAdminPermission('QC_CHECK_1'), listQcCheck1);
router.get('/check-2', requireAdminPermission('QC_CHECK_2'), listQcCheck2);
router.get('/requests/:id', getQcRequest);
router.post('/check-1/:id/approve', requireAdminPermission('QC_CHECK_1'), approveQcCheck1);
router.post('/check-1/:id/reject', requireAdminPermission('QC_CHECK_1'), rejectQcCheck1);
router.post('/check-2/:id/approve', requireAdminPermission('QC_CHECK_2'), approveQcCheck2);
router.post('/check-2/:id/reject', requireAdminPermission('QC_CHECK_2'), rejectQcCheck2);

export default router;
