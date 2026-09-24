import { Router, Request, Response } from 'express';
import multer from 'multer';
import { uploadImageToB2 } from '../utils/imageUpload';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
}).single('design');

router.post('/', (req: Request, res: Response) => {
  upload(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      res.status(400).json({
        success: false,
        message: err.code === 'LIMIT_FILE_SIZE'
          ? 'Design file must be 5MB or smaller'
          : 'Only one design file can be uploaded',
      });
      return;
    }
    if (err) {
      res.status(400).json({ success: false, message: err instanceof Error ? err.message : 'Design upload failed' });
      return;
    }
    try {
      if (!req.file) {
        res.status(400).json({ success: false, message: 'Please upload one design file' });
        return;
      }
      const url = await uploadImageToB2(req.file.buffer, req.file.originalname, 'nameplate-designs');
      res.status(200).json({
        success: true,
        message: 'Design uploaded successfully',
        data: { url, fileName: req.file.originalname },
      });
    } catch (error) {
      console.error('Customer name plate design upload error:', error);
      res.status(500).json({ success: false, message: 'Failed to upload design' });
    }
  });
});

export default router;
