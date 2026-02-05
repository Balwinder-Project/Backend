import { Request, Response } from 'express';
import { uploadImageToCloudinary, uploadMultipleImages } from '../utils/imageUpload';

/**
 * Upload single image
 * POST /api/v1/upload/image
 */
export const uploadSingleImage = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
      return;
    }

    const folder = req.body.folder || 'products';
    const imageUrl = await uploadImageToCloudinary(
      req.file.buffer,
      req.file.originalname,
      folder
    );

    res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      data: {
        url: imageUrl
      }
    });
  } catch (error: any) {
    console.error('Error uploading image:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload image',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Upload multiple images
 * POST /api/v1/upload/images
 */
export const uploadMultipleImagesController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      res.status(400).json({
        success: false,
        message: 'No image files provided'
      });
      return;
    }

    const folder = req.body.folder || 'products';
    const files = req.files.map((file) => ({
      buffer: file.buffer,
      filename: file.originalname
    }));

    const imageUrls = await uploadMultipleImages(files, folder);

    res.status(200).json({
      success: true,
      message: 'Images uploaded successfully',
      data: {
        urls: imageUrls,
        count: imageUrls.length
      }
    });
  } catch (error: any) {
    console.error('Error uploading images:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload images',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

