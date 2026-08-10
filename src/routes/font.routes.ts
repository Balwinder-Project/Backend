import { Router } from 'express';
import { listFonts, getFontsCss, getFontFile } from '../controllers/font.controller';

const router = Router();

// Public — used by admin panel + storefront live preview
router.get('/', listFonts);
router.get('/css', getFontsCss);
router.get('/file/:id', getFontFile);

export default router;
