import multer from 'multer';
import { Request } from 'express';

// Configure multer to use memory storage
const storage = multer.memoryStorage();

// File filter to accept only images
const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  // Accept images only
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'));
  }
};

// Configure multer
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per file
  },
});

// Middleware for single image upload
export const uploadSingleImage = upload.single('image');

// Middleware for multiple image uploads (max 5 images)
export const uploadMultipleImages = upload.array('images', 5);

