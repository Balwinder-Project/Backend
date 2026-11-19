import { Router } from 'express';
import { authenticateUser, requireModulePermission } from '../middleware/auth.middleware';
import { getProductReviews, createProductReview, listAdminReviews, moderateReview, deleteReview, getProductReviewSummaries } from '../controllers/productReview.controller';

const router = Router();
router.get('/summaries', getProductReviewSummaries);
router.get('/product/:productId', getProductReviews);
router.post('/', authenticateUser, createProductReview);
router.get('/admin/all', authenticateUser, requireModulePermission('reviews','view'), listAdminReviews);
router.patch('/admin/:id/moderate', authenticateUser, requireModulePermission('reviews','approve'), moderateReview);
router.delete('/admin/:id', authenticateUser, requireModulePermission('reviews','delete'), deleteReview);
export default router;
