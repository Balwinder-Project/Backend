import cloudinary from '../config/cloudinary';
import { randomUUID } from 'crypto';

/**
 * Upload image to Cloudinary
 * @param fileBuffer - File buffer
 * @param filename - Original filename
 * @param folder - Storage folder (e.g., 'products', 'categories')
 * @returns Public URL of uploaded image
 */
export const uploadImageToCloudinary = async (
  fileBuffer: Buffer,
  filename: string,
  folder: string = 'products'
): Promise<string> => {
  try {
    // Convert buffer to base64
    const base64Image = `data:image/jpeg;base64,${fileBuffer.toString('base64')}`;
    
    // Generate unique public_id
    const publicId = `balwinder/${folder}/${randomUUID()}-${filename.split('.')[0]}`;
    
    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(base64Image, {
      public_id: publicId,
      folder: `balwinder/${folder}`,
      resource_type: 'auto',
      transformation: [
        { quality: 'auto', fetch_format: 'auto' }
      ]
    });
    
    // Return secure URL
    return result.secure_url;
  } catch (error) {
    console.error('Error uploading image to Cloudinary:', error);
    throw new Error('Failed to upload image');
  }
};

/**
 * Upload multiple images to Cloudinary
 * @param files - Array of file buffers with filenames
 * @param folder - Storage folder
 * @returns Array of public URLs
 */
export const uploadMultipleImages = async (
  files: Array<{ buffer: Buffer; filename: string }>,
  folder: string = 'products'
): Promise<string[]> => {
  try {
    const uploadPromises = files.map((file) =>
      uploadImageToCloudinary(file.buffer, file.filename, folder)
    );
    
    const urls = await Promise.all(uploadPromises);
    return urls;
  } catch (error) {
    console.error('Error uploading multiple images:', error);
    throw new Error('Failed to upload images');
  }
};

/**
 * Delete image from Cloudinary
 * @param imageUrl - Public URL of the image
 */
export const deleteImageFromCloudinary = async (imageUrl: string): Promise<void> => {
  try {
    // Extract public_id from Cloudinary URL
    // Example: https://res.cloudinary.com/cloud-name/image/upload/v1234567890/balwinder/products/uuid-filename.jpg
    const urlParts = imageUrl.split('/');
    const uploadIndex = urlParts.indexOf('upload');
    
    if (uploadIndex === -1) {
      console.warn('Invalid Cloudinary URL format');
      return;
    }
    
    // Get everything after 'upload/vXXXXXXXX/'
    const publicIdWithExtension = urlParts.slice(uploadIndex + 2).join('/');
    // Remove file extension
    const publicId = publicIdWithExtension.substring(0, publicIdWithExtension.lastIndexOf('.')) || publicIdWithExtension;
    
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Error deleting image from Cloudinary:', error);
    // Don't throw error - image might already be deleted
  }
};

/**
 * Delete multiple images from Cloudinary
 * @param imageUrls - Array of public URLs
 */
export const deleteMultipleImages = async (imageUrls: string[]): Promise<void> => {
  try {
    const deletePromises = imageUrls.map((url) => deleteImageFromCloudinary(url));
    await Promise.all(deletePromises);
  } catch (error) {
    console.error('Error deleting multiple images:', error);
  }
};

