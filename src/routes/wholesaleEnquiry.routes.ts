import { Router } from 'express';
import multer from 'multer';
import { submitWholesaleEnquiry, getWholesaleEnquiries, updateWholesaleEnquiry, approveWholesaleEnquiry } from '../controllers/wholesaleEnquiry.controller';
import { validateRetailerData } from '../validators/retailer.validator';
import { authenticateUser, requireAdmin } from '../middleware/auth.middleware';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPG, PNG, WEBP or PDF files are allowed'));
  },
});

router.post('/', upload.single('visitingCard'), submitWholesaleEnquiry);
router.get('/', authenticateUser, requireAdmin, getWholesaleEnquiries);
router.post('/:id/approve', authenticateUser, requireAdmin, validateRetailerData(false), approveWholesaleEnquiry);
router.patch('/:id', authenticateUser, requireAdmin, updateWholesaleEnquiry);

export default router;
